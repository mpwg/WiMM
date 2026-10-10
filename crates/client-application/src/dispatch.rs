// SPDX-License-Identifier: AGPL-3.0-or-later
//! Commitgewissheit und Ansichtsberechtigung bleiben getrennt.
use crate::{CommitContext, PreparedCommit};
use sha2::{Digest, Sha256};
use wimm_local_contracts::{
    commit::{CancellableLocalCommitPort, LocalCommitOutcome, LocalCommitPort, LocalCommitReceipt},
    persistence_errors::{FailureCommitState, StorageFailure, StorageFailureCode},
    storage_port::CancellationPort,
};

pub trait CommitContextPort {
    fn current(&self) -> CommitContext;
}

/// Keine Finanzdaten, Fehlermeldungen oder Originalentwürfe in Diagnosen.
pub enum DispatchResult {
    Committed {
        context: CommitContext,
        receipt: Box<LocalCommitReceipt>,
        current: bool,
    },
    NotCommitted {
        error: StorageFailure,
    },
    Unknown,
    ScopeChanged,
    Busy,
    Idle,
}

#[derive(Default)]
pub struct CommitPipeline {
    unresolved: Option<PreparedCommit>,
}

struct ScopedCancellation<'a> {
    context: &'a CommitContext,
    scope: &'a dyn CommitContextPort,
    cancellation: &'a dyn CancellationPort,
}
impl CancellationPort for ScopedCancellation<'_> {
    fn is_cancelled(&self) -> bool {
        self.cancellation.is_cancelled() || !self.context.is_current(&self.scope.current())
    }
}

impl CommitPipeline {
    /// Der Originalauftrag bleibt bei unknown gebunden; weitere Writes sind gesperrt.
    pub fn dispatch(
        &mut self,
        prepared: PreparedCommit,
        storage: &mut impl CancellableLocalCommitPort,
        scope: &dyn CommitContextPort,
        cancellation: &dyn CancellationPort,
    ) -> DispatchResult {
        if self.unresolved.is_some() {
            return DispatchResult::Busy;
        }
        if !prepared.context.is_current(&scope.current()) {
            return DispatchResult::ScopeChanged;
        }
        let guard = ScopedCancellation {
            context: &prepared.context,
            scope,
            cancellation,
        };
        let outcome = storage.commit_cancellable(prepared.request.clone(), &guard);
        match outcome {
            LocalCommitOutcome::Committed { value } if valid_receipt(&prepared, &value) => {
                committed(prepared, value, scope)
            }
            LocalCommitOutcome::NotCommitted { error }
                if error.contract_version == 2
                    && error.commit_state == FailureCommitState::NotCommitted
                    && error.code != StorageFailureCode::CommitUnknown =>
            {
                DispatchResult::NotCommitted { error }
            }
            // Fremde/ungültige Antworten beweisen keinen Rollback; Original behalten.
            _ => {
                self.unresolved = Some(prepared);
                DispatchResult::Unknown
            }
        }
    }

    /// Auch nach Scopewechsel ausschließlich das ursprüngliche Receipt lesen, nie erneut schreiben.
    pub fn resolve(
        &mut self,
        storage: &impl LocalCommitPort,
        scope: &dyn CommitContextPort,
    ) -> DispatchResult {
        let Some(prepared) = self.unresolved.as_ref() else {
            return DispatchResult::Idle;
        };
        match storage.lookup_result(&prepared.request.identity) {
            Ok(Some(receipt)) if valid_receipt(prepared, &receipt) => committed(
                self.unresolved.take().expect("Gebundener Originalauftrag"),
                receipt,
                scope,
            ),
            // Fehlendes Receipt oder Lesefehler beweist keine ausgebliebene Speicherung.
            _ => DispatchResult::Unknown,
        }
    }
}

fn committed(
    prepared: PreparedCommit,
    receipt: LocalCommitReceipt,
    scope: &dyn CommitContextPort,
) -> DispatchResult {
    let current = prepared.context.is_current(&scope.current());
    DispatchResult::Committed {
        context: prepared.context,
        receipt: Box::new(receipt),
        current,
    }
}

pub(crate) fn valid_receipt(prepared: &PreparedCommit, receipt: &LocalCommitReceipt) -> bool {
    let Ok(bytes) = serde_json::to_vec(&prepared.request) else {
        return false;
    };
    let hash = Sha256::digest(bytes)
        .iter()
        .map(|b| format!("{b:02x}"))
        .collect::<String>();
    receipt.identity.operation_contract_version
        == prepared.request.identity.operation_contract_version
        && receipt.identity.profile_id == prepared.request.identity.profile_id
        && receipt.identity.space_id == prepared.request.identity.space_id
        && receipt.identity.epoch == prepared.request.identity.epoch
        && receipt.identity.operation_id == prepared.request.identity.operation_id
        && receipt.content_hash.as_str() == hash
        && receipt.committed_revisions.len() == prepared.request.batch.aggregates.len()
        && receipt
            .committed_revisions
            .iter()
            .zip(&prepared.request.batch.aggregates)
            .all(|(r, a)| r.handle == a.handle && r.revision == a.aggregate.revision())
}
