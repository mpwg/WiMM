// SPDX-License-Identifier: AGPL-3.0-or-later
//! Versionierte private DAL-Sicherung; keine Erweiterung alter Nutzerexporte.
use crate::{Validate, commit::*, record, storage::*};
use wimm_finance_types::scalars::EntityId;
record!(LocalReceiptEntry {
    request: LocalCommitRequest,
    receipt: LocalCommitReceipt
});
impl Validate for LocalReceiptEntry {
    fn validate(&self) -> Result<(), &'static str> {
        let (a, b) = (&self.request.identity, &self.receipt.identity);
        if a.operation_contract_version != b.operation_contract_version
            || a.profile_id != b.profile_id
            || a.space_id != b.space_id
            || a.epoch != b.epoch
            || a.operation_id != b.operation_id
            || self.request.batch.aggregates.len() != self.receipt.committed_revisions.len()
            || self
                .request
                .batch
                .aggregates
                .iter()
                .zip(&self.receipt.committed_revisions)
                .any(|(a, b)| a.handle != b.handle || a.aggregate.revision() != b.revision)
        {
            return Err("Receipt und ursprünglicher Auftrag gehören nicht zusammen.");
        }
        a.validate()
    }
}
record!(LocalCommitCheckpoint {
    #[serde(deserialize_with="wimm_contract_primitives::unsigned32")]
    #[cfg_attr(feature="contract-schema",schemars(with="crate::commit::OperationContractVersionSchema"))]
    checkpoint_version:u32,
    #[serde(deserialize_with="wimm_contract_primitives::unsigned32")]
    #[cfg_attr(feature="contract-schema",schemars(with="crate::commit::OperationContractVersionSchema"))]
    physical_schema_version:u32,
    snapshot:LocalSnapshot,
    operations:Vec<LocalReceiptEntry>
});
impl Validate for LocalCommitCheckpoint {
    fn validate(&self) -> Result<(), &'static str> {
        let s = &self.snapshot;
        if self.checkpoint_version != 1
            || self.physical_schema_version != 1
            || s.storage_schema_version.value() != 1
            || s.domain_schema_version.value() != 1
        {
            return Err("Die DAL-Sicherungs-/Schemaversion wird nicht unterstützt.");
        }
        // Dieser erste Commitstore besitzt noch keine bestätigten/Syncdaten; niemals verwerfen.
        if !s.confirmed.is_empty() || s.sync_state.is_some() {
            return Err("Dieser Commitstore unterstützt keine bestätigten Syncdaten.");
        }
        if s.aggregates
            .iter()
            .any(|a| a.handle != *a.aggregate.id() || a.aggregate.space_id() != &s.space_id)
            || s.pending.iter().any(|p| p.space_id != s.space_id)
            || s.projections.iter().any(|p| match p {
                StoredProjection::Balance { space_id, .. }
                | StoredProjection::AccountBalance { space_id, .. }
                | StoredProjection::Consumption { space_id, .. } => space_id != &s.space_id,
            })
        {
            return Err("Die Sicherung enthält bereichsfremde Daten.");
        }
        for p in &s.pending {
            if let Some(object) = p.draft.0.as_object() {
                if object
                    .get("spaceId")
                    .is_some_and(|id| id.as_str() != Some(s.space_id.as_str()))
                {
                    return Err("Bereichsfremder Originalentwurf.");
                }
                if let Some(rows) = object.get("aggregates") {
                    let rows = rows.as_array().ok_or("Ungültige Originalaggregate.")?;
                    for row in rows {
                        let a: wimm_finance_types::models::Aggregate =
                            crate::storage::decode_draft_aggregate(row)?;
                        if a.space_id() != &s.space_id {
                            return Err("Bereichsfremdes Originalaggregat.");
                        }
                    }
                }
            }
        }
        let mut ids = std::collections::BTreeSet::new();
        for entry in &self.operations {
            entry.validate()?;
            let id = &entry.request.identity;
            if id.profile_id != s.profile_id
                || id.space_id != s.space_id
                || !ids.insert((id.epoch.as_str(), id.operation_id.as_str()))
            {
                return Err("Die Sicherung enthält fremde oder doppelte Receipts.");
            }
        }
        Ok(())
    }
}
pub trait LocalCheckpointPort {
    fn checkpoint(
        &self,
        space: &EntityId,
    ) -> Result<LocalCommitCheckpoint, crate::persistence_errors::StorageFailure>;
}

record!(LocalCheckpointRestoreRequest {
    expected:LocalCommitCheckpoint,
    original_backup:crate::models::EncryptedBackupReceipt,
    ciphertext:Vec<u8>,
    restored_epoch:EntityId
});
impl Validate for LocalCheckpointRestoreRequest {
    fn validate(&self) -> Result<(), &'static str> {
        self.expected.validate()?;
        if self.ciphertext.is_empty() || self.restored_epoch == self.expected.snapshot.epoch {
            Err("Restore benötigt verschlüsselte Daten und eine vorbereitete neue Epoche.")
        } else {
            Ok(())
        }
    }
}
