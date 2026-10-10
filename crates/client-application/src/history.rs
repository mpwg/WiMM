// SPDX-License-Identifier: AGPL-3.0-or-later
//! Sitzungshistorie: nur bestätigte Commits bewegen Ziele, der Kern erzeugt Gegenbefehle.
use crate::{
    dispatch::{DispatchResult, valid_receipt},
    *,
};
use wimm_finance_types::{
    command_contracts::{Context, Expectation},
    models::Aggregate,
    reverse_contracts::{ReverseRequest, ReverseTarget},
};
#[derive(Clone, Copy, Debug, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
#[cfg_attr(feature = "native-bindings", derive(uniffi::Enum))]
#[cfg_attr(feature = "wasm-bindings", derive(tsify::Tsify))]
#[cfg_attr(feature = "contract-schema", derive(schemars::JsonSchema))]
pub enum Direction {
    Undo,
    Redo,
}
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum HistoryFailure {
    ScopeChanged,
    NotConfirmed,
    StaleHistory,
    Preparation(PreparationFailure),
}
#[derive(Clone)]
struct Entry {
    observed: Vec<Aggregate>,
    expectations: Vec<Expectation>,
    targets: NonEmptyVec<ReverseTarget>,
}
/// Private Ziele und frühere Finanzdaten erhalten keine Debugausgabe.
pub struct FinanceHistory {
    context: CommitContext,
    version: u64,
    accepted: std::collections::BTreeSet<EntityId>,
    undo: Vec<Entry>,
    redo: Vec<Entry>,
}
pub struct HistoryMove {
    version: u64,
    direction: Direction,
    prepared: PreparedCommit,
}
impl HistoryMove {
    pub fn prepared(&self) -> &PreparedCommit {
        &self.prepared
    }
}
impl FinanceHistory {
    pub fn new(context: CommitContext) -> Self {
        Self {
            context,
            version: 0,
            accepted: Default::default(),
            undo: vec![],
            redo: vec![],
        }
    }
    pub fn can_undo(&self) -> bool {
        !self.undo.is_empty()
    }
    pub fn can_redo(&self) -> bool {
        !self.redo.is_empty()
    }
    pub fn record(
        &mut self,
        prepared: &PreparedCommit,
        result: &DispatchResult,
        current: &CommitContext,
    ) -> Result<(), HistoryFailure> {
        self.confirm(prepared, result, current)?;
        let entry = if matches!(
            prepared.change.command_type.as_str(),
            "transaction.save"
                | "transaction.delete"
                | "transfer.save"
                | "transfer.delete"
                | "reconciliation.confirm"
                | "reconciliation.unlock"
        ) {
            Some(inverse(prepared)?)
        } else {
            None
        };
        self.bump()?;
        self.accepted.insert(prepared.change.operation_id.clone());
        if let Some(entry) = entry {
            self.undo.push(entry);
        } else {
            self.undo.clear();
        }
        self.redo.clear();
        Ok(())
    }
    pub fn prepare_move(
        &self,
        direction: Direction,
        aggregates: Vec<Aggregate>,
        context: Context,
        current: &CommitContext,
        mode: AreaMode,
    ) -> Result<Option<HistoryMove>, HistoryFailure> {
        if !self.context.is_current(current) {
            return Err(HistoryFailure::ScopeChanged);
        }
        let source = match direction {
            Direction::Undo => &self.undo,
            Direction::Redo => &self.redo,
        };
        let Some(entry) = source.last() else {
            return Ok(None);
        };
        let prepared = prepare_reverse(
            ReverseRequest {
                contract_version: 1.into(),
                domain_schema_version: 1.into(),
                space_id: self.context.space_id.clone(),
                aggregates,
                expected_revisions: entry.expectations.clone(),
                context,
                targets: entry.targets.clone(),
            },
            &self.context,
            current,
            mode,
        )
        .map_err(HistoryFailure::Preparation)?;
        Ok(Some(HistoryMove {
            version: self.version,
            direction,
            prepared,
        }))
    }
    pub fn accept_move(
        &mut self,
        movement: &HistoryMove,
        result: &DispatchResult,
        current: &CommitContext,
    ) -> Result<(), HistoryFailure> {
        if movement.version != self.version {
            return Err(HistoryFailure::StaleHistory);
        }
        self.confirm(&movement.prepared, result, current)?;
        let entry = inverse(&movement.prepared)?;
        self.bump()?;
        self.accepted
            .insert(movement.prepared.change.operation_id.clone());
        let (source, target) = match movement.direction {
            Direction::Undo => (&mut self.undo, &mut self.redo),
            Direction::Redo => (&mut self.redo, &mut self.undo),
        };
        source.pop();
        target.push(entry);
        // Nur nachweislich eigene, inhaltsgleiche Übergänge übernehmen neue Revisionen.
        for older in source {
            for expectation in &mut older.expectations {
                if let Some(changed) = movement
                    .prepared
                    .change
                    .aggregates
                    .iter()
                    .find(|a| a.id() == &expectation.id)
                    && older
                        .observed
                        .iter()
                        .any(|a| a.id() == changed.id() && same_content(a, changed))
                {
                    expectation.expected_revision = Revision::new(changed.revision().value())
                        .map_err(|_| HistoryFailure::StaleHistory)?;
                }
            }
        }
        Ok(())
    }
    fn confirm(
        &self,
        prepared: &PreparedCommit,
        result: &DispatchResult,
        current: &CommitContext,
    ) -> Result<(), HistoryFailure> {
        if !self.context.is_current(current) || !self.context.is_current(&prepared.context) {
            return Err(HistoryFailure::ScopeChanged);
        }
        if self.accepted.contains(&prepared.change.operation_id) {
            return Err(HistoryFailure::NotConfirmed);
        }
        match result {
            DispatchResult::Committed {
                context,
                receipt,
                current: true,
            } if context.is_current(current) && valid_receipt(prepared, receipt) => Ok(()),
            _ => Err(HistoryFailure::NotConfirmed),
        }
    }
    fn bump(&mut self) -> Result<(), HistoryFailure> {
        self.version = self
            .version
            .checked_add(1)
            .ok_or(HistoryFailure::StaleHistory)?;
        Ok(())
    }
}
fn inverse(prepared: &PreparedCommit) -> Result<Entry, HistoryFailure> {
    let targets = prepared
        .change
        .aggregates
        .iter()
        .filter(|a| {
            matches!(
                a,
                Aggregate::Transaction(_) | Aggregate::Transfer(_) | Aggregate::Reconciliation(_)
            )
        })
        .map(|a| ReverseTarget {
            id: a.id().clone(),
            previous: prepared
                .before
                .iter()
                .find(|old| old.id() == a.id())
                .cloned(),
        })
        .collect();
    let targets = NonEmptyVec::new(targets).map_err(|_| HistoryFailure::StaleHistory)?;
    let expectations = prepared
        .change
        .expected_revisions
        .iter()
        .map(|r| Expectation {
            id: r.id.clone(),
            expected_revision: prepared
                .change
                .aggregates
                .iter()
                .find(|a| a.id() == &r.id)
                .map(|a| Revision::new(a.revision().value()).expect("Sichere Kernrevision"))
                .unwrap_or(r.expected_revision),
        })
        .collect();
    Ok(Entry {
        observed: prepared.change.aggregates.clone(),
        expectations,
        targets,
    })
}
fn same_content(left: &Aggregate, right: &Aggregate) -> bool {
    let mut left = left.clone();
    *left.revision_mut() = right.revision();
    *left.updated_at_mut() = right.updated_at().clone();
    if left.is_live() != right.is_live() {
        return false;
    }
    *left.deleted_at_mut() = right.deleted_at().clone();
    left == *right
}
