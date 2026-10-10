// SPDX-License-Identifier: AGPL-3.0-or-later
//! Private Wiederanlaufmetadaten; keine Finanzpayloads oder Schlüssel.
use crate::{dispatch::*, *};
use sha2::{Digest, Sha256};
use wimm_local_contracts::{
    commit::*,
    persistence_errors::*,
    storage_port::{CancellationPort, SnapshotProtectionPort},
};

#[derive(Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields, try_from = "TicketWire")]
pub struct RecoveryTicket {
    recovery_version: u32,
    context: CommitContext,
    expected: LocalCommitReceipt,
    original: Vec<u8>,
}
#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct TicketWire {
    recovery_version: u32,
    context: CommitContext,
    expected: LocalCommitReceipt,
    original: Vec<u8>,
}
impl TryFrom<TicketWire> for RecoveryTicket {
    type Error = &'static str;
    fn try_from(w: TicketWire) -> Result<Self, Self::Error> {
        let ticket = Self {
            recovery_version: w.recovery_version,
            context: w.context,
            expected: w.expected,
            original: w.original,
        };
        let identity = &ticket.expected.identity;
        let mut handles = std::collections::BTreeSet::new();
        if ticket.original.is_empty()
            || ticket.recovery_version != 1
            || identity.operation_contract_version != 1
            || identity.profile_id != ticket.context.profile_id
            || identity.space_id != ticket.context.space_id
            || identity.epoch != ticket.context.epoch
            || ticket.expected.committed_revisions.is_empty()
            || ticket
                .expected
                .committed_revisions
                .iter()
                .any(|r| !handles.insert(r.handle.clone()))
        {
            return Err("Ungültige Wiederanlaufreferenz.");
        }
        Ok(ticket)
    }
}
impl RecoveryTicket {
    /// Original nur nach authentifizierter Entschlüsselung und vollständiger Inhaltsbindung lesen.
    pub fn open_original(
        &self,
        protection: &(impl SnapshotProtectionPort<LocalCommitRequest, Error = StorageFailure> + ?Sized),
    ) -> Result<LocalCommitRequest, StorageFailure> {
        let original = protection.unseal(&self.original)?;
        if !original_matches(self, &original) {
            return Err(StorageFailure::unknown(StorageFailureCode::InvalidResponse));
        }
        Ok(original)
    }
    pub fn context(&self) -> &CommitContext {
        &self.context
    }
    pub fn identity(&self) -> &LocalOperationIdentity {
        &self.expected.identity
    }
    fn new(
        prepared: &PreparedCommit,
        protection: &(impl SnapshotProtectionPort<LocalCommitRequest, Error = StorageFailure> + ?Sized),
    ) -> Result<Self, StorageFailure> {
        let bytes = serde_json::to_vec(&prepared.request).map_err(|_| failure())?;
        let hash = Sha256::digest(bytes)
            .iter()
            .map(|b| format!("{b:02x}"))
            .collect();
        Ok(Self {
            recovery_version: 1,
            context: prepared.context.clone(),
            original: protection.seal(prepared.request.clone())?,
            expected: LocalCommitReceipt {
                identity: prepared.request.identity.clone(),
                content_hash: FileHash::new(hash).map_err(|_| failure())?,
                committed_revisions: prepared
                    .request
                    .batch
                    .aggregates
                    .iter()
                    .map(|a| CommittedRevision {
                        handle: a.handle.clone(),
                        revision: a.aggregate.revision(),
                    })
                    .collect(),
            },
        })
    }
    fn matches(&self, receipt: &LocalCommitReceipt) -> bool {
        match (
            serde_json::to_vec(&self.expected),
            serde_json::to_vec(receipt),
        ) {
            (Ok(a), Ok(b)) => a == b,
            _ => false,
        }
    }
}
fn failure() -> StorageFailure {
    StorageFailure::not_committed(StorageFailureCode::ResourceUnavailable)
}
fn same_ticket(left: &RecoveryTicket, right: &RecoveryTicket) -> bool {
    match (serde_json::to_vec(left), serde_json::to_vec(right)) {
        (Ok(a), Ok(b)) => a == b,
        _ => false,
    }
}
/// Profilgebundener privater Port. Speichern und Entfernen sind dauerhafte CAS-Operationen:
/// save_if_absent ersetzt keinen bestehenden Auftrag; clear entfernt ausschließlich exakt expected.
/// Erfolgreiche Speicherung überlebt den Prozessabbruch. Kein Export-/Server-/Logport.
pub trait RecoveryJournalPort {
    fn load(&self) -> Result<Option<RecoveryTicket>, StorageFailure>;
    fn save_if_absent(&mut self, ticket: &RecoveryTicket) -> Result<(), StorageFailure>;
    fn clear(&mut self, expected: &RecoveryTicket) -> Result<(), StorageFailure>;
}
/// Keine Speicherimplementierung im Anwendungscrate; Runtime injiziert den privaten Journalport.
#[derive(Default)]
pub struct DurableCommitPipeline;
impl DurableCommitPipeline {
    pub fn dispatch(
        &mut self,
        prepared: PreparedCommit,
        storage: &mut (impl CancellableLocalCommitPort + ?Sized),
        journal: &mut (impl RecoveryJournalPort + ?Sized),
        protection: &(impl SnapshotProtectionPort<LocalCommitRequest, Error = StorageFailure> + ?Sized),
        scope: &dyn CommitContextPort,
        cancellation: &dyn CancellationPort,
    ) -> DispatchResult {
        if !prepared.context.is_current(&scope.current()) {
            return DispatchResult::ScopeChanged;
        }
        match journal.load() {
            Ok(None) => {}
            Ok(Some(_)) => return DispatchResult::Busy,
            Err(_) => return DispatchResult::NotCommitted { error: failure() },
        }
        let ticket = match RecoveryTicket::new(&prepared, protection) {
            Ok(ticket) => ticket,
            Err(_) => return DispatchResult::NotCommitted { error: failure() },
        };
        if !matches!(protection.unseal(&ticket.original), Ok(ref original) if original_matches(&ticket, original))
        {
            return DispatchResult::NotCommitted { error: failure() };
        }
        if journal.save_if_absent(&ticket).is_err() {
            return DispatchResult::NotCommitted { error: failure() };
        }
        // Tatsächliche Rücklesebindung vor dem ersten Finanzwrite; keine bloße Port-Erfolgsmeldung.
        if !matches!(journal.load(), Ok(Some(ref stored)) if same_ticket(stored, &ticket)) {
            return DispatchResult::NotCommitted { error: failure() };
        }
        let result = CommitPipeline::default().dispatch(prepared, storage, scope, cancellation);
        if matches!(
            result,
            DispatchResult::Committed { .. }
                | DispatchResult::NotCommitted { .. }
                | DispatchResult::ScopeChanged
        ) {
            // Ein Cleanupfehler erfindet weder Rollback noch unknown aus einem bekannten Commit.
            let _ = journal.clear(&ticket);
        }
        result
    }
    pub fn resume(
        &mut self,
        storage: &(impl LocalCommitPort + ?Sized),
        journal: &mut (impl RecoveryJournalPort + ?Sized),
        protection: &(impl SnapshotProtectionPort<LocalCommitRequest, Error = StorageFailure> + ?Sized),
        scope: &dyn CommitContextPort,
    ) -> DispatchResult {
        let ticket = match journal.load() {
            Ok(Some(ticket)) => ticket,
            Ok(None) => return DispatchResult::Idle,
            Err(_) => return DispatchResult::Unknown,
        };
        if !matches!(protection.unseal(&ticket.original), Ok(ref original) if original_matches(&ticket, original))
        {
            return DispatchResult::Unknown;
        }
        match storage.lookup_result(ticket.identity()) {
            Ok(Some(receipt)) if ticket.matches(&receipt) => {
                let current = ticket.context.is_current(&scope.current());
                let _ = journal.clear(&ticket);
                DispatchResult::Committed {
                    context: ticket.context,
                    receipt: Box::new(receipt),
                    current,
                }
            }
            // Auch fehlendes Receipt beweist nach Prozessabbruch keinen Rollback.
            _ => DispatchResult::Unknown,
        }
    }
}

fn original_matches(ticket: &RecoveryTicket, request: &LocalCommitRequest) -> bool {
    let Ok(bytes) = serde_json::to_vec(request) else {
        return false;
    };
    let hash = Sha256::digest(bytes)
        .iter()
        .map(|b| format!("{b:02x}"))
        .collect::<String>();
    let Ok(content_hash) = FileHash::new(hash) else {
        return false;
    };
    ticket.matches(&LocalCommitReceipt {
        identity: request.identity.clone(),
        content_hash,
        committed_revisions: request
            .batch
            .aggregates
            .iter()
            .map(|a| CommittedRevision {
                handle: a.handle.clone(),
                revision: a.aggregate.revision(),
            })
            .collect(),
    })
}
