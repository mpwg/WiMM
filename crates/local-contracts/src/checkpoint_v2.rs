// SPDX-License-Identifier: AGPL-3.0-or-later
//! Vollständiger privater Checkpoint für das aktuelle native Schema, ohne historische Schemaformen.
use crate::{Validate, checkpoint::LocalReceiptEntry, record, storage::*};
use std::collections::BTreeSet;
record!(LocalCheckpointV2 {
    #[serde(deserialize_with="wimm_contract_primitives::unsigned32")]
    #[cfg_attr(feature="contract-schema",schemars(with="CheckpointVersion2"))]
    checkpoint_version:u32,
    #[serde(deserialize_with="wimm_contract_primitives::unsigned32")]
    #[cfg_attr(feature="contract-schema",schemars(with="PhysicalVersion5"))]
    physical_schema_version:u32,
    snapshot:LocalSnapshot,
    local_write_epoch:wimm_finance_types::scalars::EntityId,
    operations:Vec<LocalReceiptEntry>,
    #[serde(default,skip_serializing_if="Option::is_none",deserialize_with="wimm_finance_types::scalars::present")]
    #[cfg_attr(feature="contract-schema",schemars(with="Vec<u8>"))]
    recovery:Option<Vec<u8>>
});
fn unique<T: Ord>(values: impl Iterator<Item = T>) -> bool {
    let mut seen = BTreeSet::new();
    values.into_iter().all(|v| seen.insert(v))
}
fn projection(p: &StoredProjection) -> (&wimm_finance_types::scalars::EntityId, &str, &str) {
    match p {
        StoredProjection::Balance { space_id, key, .. } => (space_id, "balance", key.as_str()),
        StoredProjection::AccountBalance { space_id, key, .. } => {
            (space_id, "accountBalance", key.as_str())
        }
        StoredProjection::Consumption { space_id, key, .. } => {
            (space_id, "consumption", key.as_str())
        }
    }
}
impl Validate for LocalCheckpointV2 {
    fn validate(&self) -> Result<(), &'static str> {
        let s = &self.snapshot;
        if self.checkpoint_version != 2 || self.physical_schema_version != 5 || !s.check_versions()
        {
            return Err("Nicht unterstützte vollständige Checkpointversion.");
        }
        if !unique(s.aggregates.iter().map(|a| a.handle.as_str()))
            || !unique(s.confirmed.iter().map(|a| a.aggregate.handle.as_str()))
            || !unique(s.pending.iter().map(|a| a.operation_id.as_str()))
            || !unique(s.projections.iter().map(projection))
        {
            return Err("Doppelte Checkpointdaten.");
        }
        if s.aggregates
            .iter()
            .any(|a| a.handle != *a.aggregate.id() || a.aggregate.space_id() != &s.space_id)
            || s.confirmed.iter().any(|a| {
                a.space_id != s.space_id
                    || a.epoch != s.epoch
                    || a.aggregate.handle != *a.aggregate.aggregate.id()
                    || a.aggregate.aggregate.space_id() != &s.space_id
            })
            || s.pending.iter().any(|a| a.space_id != s.space_id)
            || s.projections.iter().any(|a| projection(a).0 != &s.space_id)
            || s.sync_state.as_ref().is_some_and(|a| {
                a.profile_id != s.profile_id
                    || a.space_id != s.space_id
                    || a.epoch != s.epoch
                    || !a.check_cursor()
            })
        {
            return Err("Fremde oder widersprüchliche Checkpointdaten.");
        }
        let mut identities = BTreeSet::new();
        for op in &self.operations {
            op.validate()?;
            let id = &op.request.identity;
            if id.profile_id != s.profile_id
                || id.space_id != s.space_id
                || !identities.insert((id.epoch.as_str(), id.operation_id.as_str()))
                || op
                    .request
                    .batch
                    .aggregates
                    .iter()
                    .any(|a| a.aggregate.space_id() != &s.space_id || a.handle != *a.aggregate.id())
                || op
                    .request
                    .batch
                    .outbox
                    .iter()
                    .any(|a| a.space_id != s.space_id)
                || op
                    .request
                    .batch
                    .projections
                    .iter()
                    .any(|a| projection(a).0 != &s.space_id)
            {
                return Err("Fremde oder doppelte Checkpointreceipts.");
            }
        }
        if self.recovery.as_ref().is_some_and(Vec::is_empty) {
            return Err("Leere Wiederanlaufreferenz.");
        }
        Ok(())
    }
}
#[cfg(feature = "contract-schema")]
struct CheckpointVersion2;
#[cfg(feature = "contract-schema")]
impl schemars::JsonSchema for CheckpointVersion2 {
    fn schema_name() -> std::borrow::Cow<'static, str> {
        "LocalCheckpointVersion2".into()
    }
    fn json_schema(_: &mut schemars::SchemaGenerator) -> schemars::Schema {
        schemars::json_schema!({"type":"integer","const":2})
    }
}
#[cfg(feature = "contract-schema")]
struct PhysicalVersion5;
#[cfg(feature = "contract-schema")]
impl schemars::JsonSchema for PhysicalVersion5 {
    fn schema_name() -> std::borrow::Cow<'static, str> {
        "LocalPhysicalVersion5".into()
    }
    fn json_schema(_: &mut schemars::SchemaGenerator) -> schemars::Schema {
        schemars::json_schema!({"type":"integer","const":5})
    }
}

record!(LocalCheckpointRestoreV2 {
    expected:LocalCheckpointV2,
    original_backup:crate::models::EncryptedBackupReceipt,
    ciphertext:Vec<u8>,
    restored_local_epoch:wimm_finance_types::scalars::EntityId
});
impl Validate for LocalCheckpointRestoreV2 {
    fn validate(&self) -> Result<(), &'static str> {
        self.expected.validate()?;
        if self.ciphertext.is_empty()
            || self.restored_local_epoch == self.expected.local_write_epoch
        {
            Err("Restore benötigt Chiffrat und eine neue lokale Schreibepoche.")
        } else {
            Ok(())
        }
    }
}
