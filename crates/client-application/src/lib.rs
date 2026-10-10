// SPDX-License-Identifier: AGPL-3.0-or-later
//! Plattformfreie gemeinsame Commitvorbereitung; sämtliche Finanzregeln im Kern.
#![forbid(unsafe_code)]
#[cfg(feature = "native-bindings")]
uniffi::setup_scaffolding!();
use std::collections::BTreeMap;
use wimm_finance_types::{
    command_contracts::{ChangeSet, CommandResult, Request},
    scalars::*,
};
use wimm_local_contracts::{
    commit::{LocalCommitRequest, LocalOperationIdentity},
    storage::*,
};
#[derive(Clone, Debug, serde::Serialize, serde::Deserialize)]
#[cfg_attr(feature = "native-bindings", derive(uniffi::Record))]
#[cfg_attr(feature = "wasm-bindings", derive(tsify::Tsify))]
#[cfg_attr(feature = "contract-schema", derive(schemars::JsonSchema))]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct CommitContext {
    pub profile_id: EntityId,
    pub space_id: EntityId,
    pub epoch: EntityId,
    pub profile_revision: Revision,
    pub session_generation: Revision,
    pub generation: Revision,
}
impl CommitContext {
    pub fn is_current(&self, current: &Self) -> bool {
        self.profile_id == current.profile_id
            && self.space_id == current.space_id
            && self.epoch == current.epoch
            && self.profile_revision == current.profile_revision
            && self.session_generation == current.session_generation
            && self.generation == current.generation
    }
}
#[derive(Clone, Copy, PartialEq, Eq, Debug, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
#[cfg_attr(feature = "native-bindings", derive(uniffi::Enum))]
#[cfg_attr(feature = "wasm-bindings", derive(tsify::Tsify))]
#[cfg_attr(feature = "contract-schema", derive(schemars::JsonSchema))]
pub enum AreaMode {
    Standalone,
    Connected,
}
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum PreparationFailure {
    ScopeChanged,
    WrongArea,
    InvalidState,
    FinanceRejected(&'static str),
}
/// Keine Debugausgabe für private Finanz-/Originalentwurfsdaten.
#[derive(Clone)]
pub struct PreparedCommit {
    context: CommitContext,
    request: LocalCommitRequest,
    change: ChangeSet,
    before: Vec<wimm_finance_types::models::Aggregate>,
}
pub fn prepare_command(
    request: Request,
    started: &CommitContext,
    current: &CommitContext,
    mode: AreaMode,
) -> Result<Option<PreparedCommit>, PreparationFailure> {
    if !started.is_current(current) {
        return Err(PreparationFailure::ScopeChanged);
    }
    if request.space_id != started.space_id {
        return Err(PreparationFailure::WrongArea);
    }
    let before = request.aggregates.clone();
    match wimm_finance_core::execute(request)
        .map_err(|(code, _)| PreparationFailure::FinanceRejected(code))?
    {
        CommandResult::Changed(change) => {
            prepare_change(change, &before, started, current, mode).map(Some)
        }
        CommandResult::Unchanged => Ok(None),
    }
}
/// Gegenbefehle werden fachlich im Kern erzeugt und wie Normalbefehle atomar vorbereitet.
pub fn prepare_reverse(
    request: wimm_finance_types::reverse_contracts::ReverseRequest,
    started: &CommitContext,
    current: &CommitContext,
    mode: AreaMode,
) -> Result<PreparedCommit, PreparationFailure> {
    if !started.is_current(current) {
        return Err(PreparationFailure::ScopeChanged);
    }
    if request.space_id != started.space_id {
        return Err(PreparationFailure::WrongArea);
    }
    let before = request.aggregates.clone();
    let change = wimm_finance_core::reverse(request)
        .map_err(|(code, _)| PreparationFailure::FinanceRejected(code))?;
    prepare_change(change, &before, started, current, mode)
}
/// Normalbefehle, Importgruppen und Kern-Gegenbefehle erhalten denselben Speicherpfad.
fn prepare_change(
    change: ChangeSet,
    before: &[wimm_finance_types::models::Aggregate],
    started: &CommitContext,
    current: &CommitContext,
    mode: AreaMode,
) -> Result<PreparedCommit, PreparationFailure> {
    if !started.is_current(current) {
        return Err(PreparationFailure::ScopeChanged);
    }
    if change.space_id != started.space_id
        || before.iter().any(|a| a.space_id() != &started.space_id)
        || change
            .aggregates
            .iter()
            .any(|a| a.space_id() != &started.space_id)
    {
        return Err(PreparationFailure::WrongArea);
    }
    let mut combined = before
        .iter()
        .map(|a| (a.id().as_str().to_owned(), a.clone()))
        .collect::<BTreeMap<_, _>>();
    if combined.len() != before.len() {
        return Err(PreparationFailure::InvalidState);
    }
    for a in &change.aggregates {
        combined.insert(a.id().as_str().into(), a.clone());
    }
    let combined = combined.into_values().collect::<Vec<_>>();
    // Berechnung und sichere Summen/zwischenwerte ausschließlich im vorhandenen Fachkern.
    let projection =
        wimm_finance_core::project(wimm_finance_types::state_contracts::ProjectionRequest {
            contract_version: 1.into(),
            domain_schema_version: 1.into(),
            space_id: started.space_id.clone(),
            aggregates: combined,
        })
        .map_err(|(code, _)| PreparationFailure::FinanceRejected(code))?;
    let expected = change
        .expected_revisions
        .iter()
        .map(|r| RevisionExpectation {
            handle: r.id.clone(),
            expected_revision: r.expected_revision,
        })
        .collect::<Vec<_>>();
    let pending = if mode == AreaMode::Connected {
        vec![PendingOperation {
            operation_id: change.operation_id.clone(),
            space_id: change.space_id.clone(),
            expected_revisions: expected.clone(),
            depends_on: vec![],
            state: PendingState::Queued,
            // Privater Originalentwurf, keine Transporthülle oder automatische Veröffentlichung.
            draft: LegacyJson(
                serde_json::to_value(&change).map_err(|_| PreparationFailure::InvalidState)?,
            ),
            retry_count: Ordinal::new(0).map_err(|_| PreparationFailure::InvalidState)?,
            created_at: Some(change.occurred_at.clone()),
        }]
    } else {
        vec![]
    };
    let mut projections = projection
        .account_balances
        .into_iter()
        .map(|b| StoredProjection::Balance {
            space_id: started.space_id.clone(),
            key: b.account_id,
            payload: b.balance,
        })
        .collect::<Vec<_>>();
    projections.push(StoredProjection::Consumption {
        space_id: started.space_id.clone(),
        key: NonEmptyText::new("all".into()).map_err(|_| PreparationFailure::InvalidState)?,
        payload: projection.consumption,
    });
    let aggregates = change
        .aggregates
        .iter()
        .map(|a| StoredAggregate {
            handle: a.id().clone(),
            aggregate: a.clone(),
        })
        .collect();
    let identity = LocalOperationIdentity {
        operation_contract_version: 1,
        profile_id: started.profile_id.clone(),
        space_id: started.space_id.clone(),
        epoch: started.epoch.clone(),
        operation_id: change.operation_id.clone(),
    };
    Ok(PreparedCommit {
        context: started.clone(),
        before: before.to_vec(),
        request: LocalCommitRequest {
            identity,
            batch: AtomicBatch {
                expected_revisions: expected,
                aggregates,
                outbox: pending,
                projections,
            },
        },
        change,
    })
}

impl PreparedCommit {
    pub fn context(&self) -> &CommitContext {
        &self.context
    }
    pub fn request(&self) -> &LocalCommitRequest {
        &self.request
    }
    pub fn change(&self) -> &ChangeSet {
        &self.change
    }
}
pub mod dispatch;

pub mod history;

pub mod api;
pub mod recovery;

pub mod runtime;

pub mod runtime_contracts;

mod snapshot_validation;
pub use snapshot_validation::CoreSnapshotValidator;
