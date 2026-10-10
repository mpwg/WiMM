// SPDX-License-Identifier: AGPL-3.0-or-later
//! Öffentliche Ciphertext-/Verwaltungsports, keine Finanz-/ORM-/Verbindungsobjekte.
use crate::{FormResult, Validate, envelopes::*, persistence::*, record, scalars::*};
#[derive(Debug, Clone, Copy, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
#[cfg_attr(feature = "contract-schema", derive(schemars::JsonSchema))]
#[cfg_attr(feature = "native-bindings", derive(uniffi::Enum))]
#[cfg_attr(feature = "wasm-bindings", derive(tsify::Tsify))]
pub enum ServerPersistenceCode {
    RevisionConflict,
    Quota,
    WriteFailed,
    UpdateRequired,
    EpochMismatch,
    OperationIdReused,
    Cancelled,
    ResourceUnavailable,
}
record!(ServerPersistenceFailure {
    #[cfg_attr(
        feature = "contract-schema",
        schemars(with = "crate::schema::PublicBindingVersion")
    )]
    #[serde(deserialize_with = "wimm_contract_primitives::unsigned32")]
    contract_version: u32,
    code: ServerPersistenceCode
});
impl Validate for ServerPersistenceFailure {
    fn validate(&self) -> FormResult<()> {
        if self.contract_version == 2 {
            Ok(())
        } else {
            Err("Unbekannte Persistenzfehler-Version.")
        }
    }
}
record!(ExpectedHead {
    handle: PublicId,
    expected_revision: PublicRevision
});
impl Validate for ExpectedHead {
    fn validate(&self) -> FormResult<()> {
        Ok(())
    }
}
pub trait CiphertextTransactionPort {
    fn read_head(
        &self,
        space: &PublicId,
        handle: &PublicId,
    ) -> Result<Option<OpaqueAggregateHead>, ServerPersistenceFailure>;
    fn lookup_receipt(
        &self,
        key: &ServerOperationKey,
    ) -> Result<Option<OperationReceiptRecord>, ServerPersistenceFailure>;
    fn write_operation(
        &mut self,
        operation: EncryptedOperation,
        expected: Vec<ExpectedHead>,
        content_hash: Base64Url,
    ) -> Result<OperationReceiptRecord, ServerPersistenceFailure>;
    fn read_snapshot(
        &self,
        space: &PublicId,
        epoch: &PublicId,
    ) -> Result<Option<EncryptedSnapshotRecord>, ServerPersistenceFailure>;
    fn replace_snapshot(
        &mut self,
        expected_epoch: PublicId,
        expected_cursor: String,
        snapshot: EncryptedSnapshotRecord,
    ) -> Result<(), ServerPersistenceFailure>;
    fn read_changes(
        &self,
        space: &PublicId,
        epoch: &PublicId,
        after: &str,
        limit: u32,
    ) -> Result<Vec<EncryptedChangeRecord>, ServerPersistenceFailure>;
}
pub trait AdministrationTransactionPort {
    fn read_identity(
        &self,
        id: &PublicId,
    ) -> Result<Option<PublicIdentityRecord>, ServerPersistenceFailure>;
    fn write_identity(
        &mut self,
        expected: PublicRevision,
        identity: PublicIdentityRecord,
    ) -> Result<(), ServerPersistenceFailure>;
    fn read_roster(
        &self,
        space: &PublicId,
    ) -> Result<Option<SignedKeyRoster>, ServerPersistenceFailure>;
    fn write_roster(
        &mut self,
        expected: Option<Base64Url>,
        roster: SignedKeyRoster,
    ) -> Result<(), ServerPersistenceFailure>;
}
pub trait ServerPersistenceTransaction:
    CiphertextTransactionPort + AdministrationTransactionPort
{
}
pub trait ServerPersistencePort {
    fn run_atomic<T>(
        &mut self,
        identity: ServerOperationKey,
        action: impl FnOnce(
            &mut dyn ServerPersistenceTransaction,
        ) -> Result<T, ServerPersistenceFailure>,
    ) -> wimm_persistence_contracts::CommitOutcome<T, ServerPersistenceFailure, ServerOperationKey>;
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn public_persistence_errors_are_versioned_and_do_not_accept_original_sql_details() {
        let value: ServerPersistenceFailure =
            serde_json::from_str(r#"{"contractVersion":2,"code":"REVISION_CONFLICT"}"#).unwrap();
        assert_eq!(value.code, ServerPersistenceCode::RevisionConflict);
        assert!(
            serde_json::from_str::<ServerPersistenceFailure>(
                r#"{"contractVersion":1,"code":"QUOTA"}"#
            )
            .is_err()
        );
        assert!(
            serde_json::from_str::<ServerPersistenceFailure>(
                r#"{"contractVersion":2,"code":"QUOTA","sql":"private value"}"#
            )
            .is_err()
        );
    }
}
