// SPDX-License-Identifier: AGPL-3.0-or-later
//! Konsistente vollständige native Sicherung; Krypto und Finanzregeln bleiben injizierte Ports.
use super::*;
use wimm_local_contracts::{
    checkpoint::LocalReceiptEntry,
    checkpoint_v2::LocalCheckpointV2,
    models::EncryptedBackupReceipt,
    ports::EncryptedBackupRequest,
    scalars::*,
    storage_port::{BackupReadPort, SnapshotProtectionPort},
};
pub(super) fn capture(
    c: &mut SqliteConnection,
    p: &EntityId,
    s: &EntityId,
) -> Result<LocalCheckpointV2, ReadError> {
    supported(c)?;
    read_schema(c)?;
    let snapshot = snapshot(c, p, s)?;
    let rows: Vec<(String, String, String, String)> = wimm_native_receipts::table
        .filter(wimm_native_receipts::profile.eq(p.as_str()))
        .filter(wimm_native_receipts::space.eq(s.as_str()))
        .order(wimm_native_receipts::identity)
        .select((
            wimm_native_receipts::identity,
            wimm_native_receipts::space,
            wimm_native_receipts::request,
            wimm_native_receipts::receipt,
        ))
        .load(c)?;
    let mut operations = Vec::new();
    for (key, space, original, saved) in rows {
        let request: LocalCommitRequest = decode(&original)?;
        let actual: LocalCommitReceipt = decode(&saved)?;
        if key != text(&request.identity)?
            || space != s.as_str()
            || request.identity.profile_id != *p
            || request.identity.space_id != *s
            || text(&receipt(&request)?)? != text(&actual)?
        {
            return Err(invalid().into());
        }
        operations.push(LocalReceiptEntry {
            request,
            receipt: actual,
        });
    }
    let recovery: Option<Vec<u8>> = wimm_native_recovery::table
        .find(p.as_str())
        .select(wimm_native_recovery::ticket)
        .first(c)
        .optional()?;
    let value = LocalCheckpointV2 {
        checkpoint_version: 2,
        physical_schema_version: storage_meta::table
            .find("storageSchemaVersion")
            .select(storage_meta::value)
            .first::<String>(c)?
            .parse()
            .map_err(|_| invalid())?,
        local_write_epoch: local_write_epoch(c, p, s)?,
        snapshot,
        operations,
        recovery,
    };
    value.validate().map_err(|_| invalid())?;
    Ok(value)
}
pub(super) fn hash(v: &LocalCheckpointV2) -> Result<String, ReadError> {
    Ok(Sha256::digest(text(v)?.as_bytes())
        .iter()
        .map(|b| format!("{b:02x}"))
        .collect())
}
impl<V: SnapshotValidationPort> SqliteWriter<V> {
    pub fn checkpoint_v2(&self, space: &EntityId) -> Result<LocalCheckpointV2, StorageFailure> {
        self.store
            .connection
            .borrow_mut()
            .transaction::<_, ReadError, _>(|c| capture(c, &self.store.profile, space))
            .map_err(|e| e.0)
    }
    pub fn backup_checkpoint_v2(
        &self,
        space: &EntityId,
        protection: &dyn SnapshotProtectionPort<LocalCheckpointV2, Error = StorageFailure>,
        backup: &dyn BackupReadPort<Error = StorageFailure>,
    ) -> Result<EncryptedBackupReceipt, StorageFailure> {
        let original = self.checkpoint_v2(space)?;
        self.validator.validate(&original.snapshot)?;
        let ciphertext = protection.seal(original.clone())?;
        if ciphertext.is_empty() {
            return Err(StorageFailure::not_committed(
                StorageFailureCode::InvalidResponse,
            ));
        }
        let receipt = backup.persist(EncryptedBackupRequest {
            profile_id: LocalId::new(self.store.profile.as_str().into()).map_err(|_| invalid())?,
            space_id: LocalId::new(space.as_str().into()).map_err(|_| invalid())?,
            epoch: LocalId::new(original.snapshot.epoch.as_str().into()).map_err(|_| invalid())?,
            snapshot_hash: LocalHash::new(hash(&original).map_err(|e| e.0)?)
                .map_err(|_| invalid())?,
            ciphertext: ciphertext.clone(),
        })?;
        if receipt.profile_id.as_str() != original.snapshot.profile_id.as_str()
            || receipt.space_id.as_str() != original.snapshot.space_id.as_str()
            || receipt.epoch.as_str() != original.snapshot.epoch.as_str()
            || receipt.snapshot_hash.as_str() != hash(&original).map_err(|e| e.0)?
        {
            return Err(StorageFailure::not_committed(
                StorageFailureCode::InvalidResponse,
            ));
        }
        let stored = backup.read(&receipt)?;
        if stored != ciphertext {
            return Err(StorageFailure::not_committed(
                StorageFailureCode::InvalidResponse,
            ));
        }
        let restored = protection.unseal(&stored)?;
        restored.validate().map_err(|_| invalid())?;
        if text(&restored).map_err(|e| e.0)? != text(&original).map_err(|e| e.0)? {
            return Err(StorageFailure::not_committed(
                StorageFailureCode::RevisionConflict,
            ));
        }
        Ok(receipt)
    }
}

impl<V: SnapshotValidationPort> SqliteWriter<V> {
    pub fn restore_checkpoint_v2(
        &mut self,
        request: wimm_local_contracts::checkpoint_v2::LocalCheckpointRestoreV2,
        protection: &dyn SnapshotProtectionPort<LocalCheckpointV2, Error = StorageFailure>,
        backup: &dyn BackupReadPort<Error = StorageFailure>,
        cancellation: &dyn CancellationPort,
    ) -> Result<(), StorageFailure> {
        request
            .validate()
            .map_err(|_| StorageFailure::not_committed(StorageFailureCode::InvalidResponse))?;
        let expected = &request.expected;
        let proof = &request.original_backup;
        if expected.snapshot.profile_id != self.store.profile
            || proof.profile_id.as_str() != expected.snapshot.profile_id.as_str()
            || proof.space_id.as_str() != expected.snapshot.space_id.as_str()
            || proof.epoch.as_str() != expected.snapshot.epoch.as_str()
            || proof.snapshot_hash.as_str() != hash(expected).map_err(|e| e.0)?
        {
            return Err(StorageFailure::not_committed(
                StorageFailureCode::EpochMismatch,
            ));
        }
        let saved = protection.unseal(&backup.read(proof)?)?;
        if text(&saved).map_err(|e| e.0)? != text(expected).map_err(|e| e.0)? {
            return Err(StorageFailure::not_committed(
                StorageFailureCode::RevisionConflict,
            ));
        }
        let mut restored = protection.unseal(&request.ciphertext)?;
        restored.validate().map_err(|_| invalid())?;
        if restored.snapshot.profile_id != self.store.profile
            || restored.snapshot.space_id != expected.snapshot.space_id
        {
            return Err(StorageFailure::not_committed(
                StorageFailureCode::EpochMismatch,
            ));
        }
        for op in &restored.operations {
            if text(&receipt(&op.request).map_err(|e| e.0)?).map_err(|e| e.0)?
                != text(&op.receipt).map_err(|e| e.0)?
            {
                return Err(invalid());
            }
        }
        // Nur standalone bindet die vorhandene Snapshotepoche an die neue lokale Schreibepoche.
        // Bestätigte Serverepochen und Synczustand werden nie vom Backend umetikettiert.
        if restored.snapshot.confirmed.is_empty() && restored.snapshot.sync_state.is_none() {
            restored.snapshot.epoch = request.restored_local_epoch.clone();
        }
        self.validator.validate(&restored.snapshot)?;
        if cancellation.is_cancelled() {
            return Err(StorageFailure::not_committed(StorageFailureCode::Cancelled));
        }
        self.write(|c, p, v| {
            let actual = capture(c, p, &expected.snapshot.space_id)?;
            if text(&actual)? != text(expected)? {
                return Err(fail(StorageFailureCode::RevisionConflict));
            }
            if cancellation.is_cancelled() {
                return Err(fail(StorageFailureCode::Cancelled));
            }
            let recovery = match (&actual.recovery, &restored.recovery) {
                (Some(current), Some(candidate)) if current != candidate => {
                    return Err(fail(StorageFailureCode::RevisionConflict));
                }
                (Some(current), _) => Some(current.clone()),
                (None, candidate) => candidate.clone(),
            };
            replace_in_transaction(c, p, v, &restored.snapshot)?;
            if cancellation.is_cancelled() {
                return Err(fail(StorageFailureCode::Cancelled));
            }
            for op in &restored.operations {
                if let Some((old, known)) = lookup(c, &op.request.identity)? {
                    if old != text(&op.request)? || text(&known)? != text(&op.receipt)? {
                        return Err(fail(StorageFailureCode::OperationIdReused));
                    }
                } else {
                    diesel::insert_into(wimm_native_receipts::table)
                        .values((
                            wimm_native_receipts::identity.eq(text(&op.request.identity)?),
                            wimm_native_receipts::profile.eq(p.as_str()),
                            wimm_native_receipts::space.eq(restored.snapshot.space_id.as_str()),
                            wimm_native_receipts::request.eq(text(&op.request)?),
                            wimm_native_receipts::receipt.eq(text(&op.receipt)?),
                        ))
                        .execute(c)?;
                }
            }
            if let Some(bytes) = recovery {
                diesel::insert_into(wimm_native_recovery::table)
                    .values((
                        wimm_native_recovery::profile.eq(p.as_str()),
                        wimm_native_recovery::ticket.eq(&bytes),
                    ))
                    .on_conflict(wimm_native_recovery::profile)
                    .do_update()
                    .set(wimm_native_recovery::ticket.eq(&bytes))
                    .execute(c)?;
            }
            write_local_epoch(
                c,
                p,
                &restored.snapshot.space_id,
                &request.restored_local_epoch,
            )?;
            if cancellation.is_cancelled() {
                return Err(fail(StorageFailureCode::Cancelled));
            }
            Ok(())
        })
    }
}
