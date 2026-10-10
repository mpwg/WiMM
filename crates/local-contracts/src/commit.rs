// SPDX-License-Identifier: AGPL-3.0-or-later
//! Neue Operationsdimension eins; bestehende Binding-/Storage-/Cryptoformen bleiben unverändert.
use crate::storage::*;
use crate::{Validate, record};
use wimm_finance_types::scalars::{EntityId, FileHash, StoredRevision};
record!(LocalOperationIdentity {
    #[cfg_attr(
        feature = "contract-schema",
        schemars(with = "OperationContractVersionSchema")
    )]
    #[serde(deserialize_with = "wimm_contract_primitives::unsigned32")]
    operation_contract_version: u32,
    profile_id: EntityId,
    space_id: EntityId,
    epoch: EntityId,
    operation_id: EntityId
});
impl Validate for LocalOperationIdentity {
    fn validate(&self) -> Result<(), &'static str> {
        if self.operation_contract_version == 1 {
            Ok(())
        } else {
            Err("Unbekannte lokale Operationsvertragsversion.")
        }
    }
}
record!(LocalCommitRequest {
    identity: LocalOperationIdentity,
    batch: AtomicBatch
});
impl Validate for LocalCommitRequest {
    fn validate(&self) -> Result<(), &'static str> {
        self.identity.validate()
    }
}
record!(CommittedRevision {
    handle: EntityId,
    revision: StoredRevision
});
impl Validate for CommittedRevision {
    fn validate(&self) -> Result<(), &'static str> {
        Ok(())
    }
}
record!(LocalCommitReceipt{identity:LocalOperationIdentity,content_hash:FileHash,committed_revisions:Vec<CommittedRevision>});
impl Validate for LocalCommitReceipt {
    fn validate(&self) -> Result<(), &'static str> {
        self.identity.validate()
    }
}
pub type LocalCommitOutcome = wimm_persistence_contracts::CommitOutcome<
    LocalCommitReceipt,
    crate::persistence_errors::StorageFailure,
    LocalOperationIdentity,
>;
pub trait LocalCommitPort {
    fn commit(&mut self, request: LocalCommitRequest) -> LocalCommitOutcome;
    fn lookup_result(
        &self,
        identity: &LocalOperationIdentity,
    ) -> Result<Option<LocalCommitReceipt>, crate::persistence_errors::StorageFailure>;
}
pub trait SnapshotValidationPort {
    fn validate(
        &self,
        snapshot: &LocalSnapshot,
    ) -> Result<(), crate::persistence_errors::StorageFailure>;
}

#[cfg(feature = "contract-schema")]
pub(crate) struct OperationContractVersionSchema;
#[cfg(feature = "contract-schema")]
impl schemars::JsonSchema for OperationContractVersionSchema {
    fn schema_name() -> std::borrow::Cow<'static, str> {
        "LocalOperationContractVersion".into()
    }
    fn json_schema(_: &mut schemars::SchemaGenerator) -> schemars::Schema {
        schemars::json_schema!({"type":"integer","const":1})
    }
}

/// Abbruch wird vor dem neuen Commit beobachtet; bereits bestätigte Receipts bleiben bestätigt.
pub trait CancellableLocalCommitPort: LocalCommitPort {
    fn commit_cancellable(
        &mut self,
        request: LocalCommitRequest,
        cancellation: &dyn crate::storage_port::CancellationPort,
    ) -> LocalCommitOutcome;
}
