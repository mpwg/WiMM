// SPDX-License-Identifier: AGPL-3.0-or-later
use super::*;
use wimm_local_contracts::{
    checkpoint::*, models::EncryptedBackupReceipt, ports::EncryptedBackupRequest, scalars::*,
    storage_port::*,
};
fn digest(value: &LocalCommitCheckpoint) -> Result<String, StorageFailure> {
    Ok(Sha256::digest(encode(value)?.as_bytes())
        .iter()
        .map(|b| format!("{b:02x}"))
        .collect())
}
fn check(value: &LocalCommitCheckpoint) -> Result<(), StorageFailure> {
    value
        .validate()
        .map_err(|_| failure(StorageFailureCode::InvalidResponse))?;
    let s = &value.snapshot;
    if !unique(s.aggregates.iter().map(|a| a.handle.as_str()))
        || !unique(s.pending.iter().map(|p| p.operation_id.as_str()))
        || !unique(s.projections.iter().map(projection))
    {
        return Err(failure(StorageFailureCode::InvalidResponse));
    }
    for op in &value.operations {
        checked_receipt(
            &encode(&op.receipt)?,
            &encode(&op.request.identity)?,
            &encode(&op.request)?,
        )?;
        if op
            .request
            .batch
            .aggregates
            .iter()
            .any(|a| a.handle != *a.aggregate.id() || a.aggregate.space_id() != &s.space_id)
            || op
                .request
                .batch
                .outbox
                .iter()
                .any(|p| p.space_id != s.space_id)
            || op
                .request
                .batch
                .projections
                .iter()
                .any(|p| projection(p).0 != &s.space_id)
        {
            return Err(failure(StorageFailureCode::InvalidResponse));
        }
    }
    Ok(())
}
fn capture(
    conn: &mut SqliteConnection,
    profile: &EntityId,
    space: &EntityId,
) -> Result<LocalCommitCheckpoint, TransactionError> {
    supported(conn, profile)?;
    let epoch: String = wimm_local_areas::table
        .find(space.as_str())
        .select(wimm_local_areas::epoch)
        .first(conn)?;
    let aggregates: Vec<(String, i64, String)> = wimm_local_aggregates::table
        .filter(wimm_local_aggregates::space.eq(space.as_str()))
        .order(wimm_local_aggregates::handle)
        .select((
            wimm_local_aggregates::handle,
            wimm_local_aggregates::revision,
            wimm_local_aggregates::payload,
        ))
        .load(conn)?;
    let mut typed = Vec::new();
    for (handle, revision, payload) in aggregates {
        let a: StoredAggregate = decode(&payload)?;
        if a.handle.as_str() != handle || a.aggregate.revision().value() != revision {
            return Err(StorageFailure::unknown(StorageFailureCode::InvalidResponse).into());
        }
        typed.push(a);
    }
    let pending: Vec<String> = wimm_local_pending::table
        .filter(wimm_local_pending::space.eq(space.as_str()))
        .order(wimm_local_pending::handle)
        .select(wimm_local_pending::payload)
        .load(conn)?;
    let projections: Vec<String> = wimm_local_projections::table
        .filter(wimm_local_projections::space.eq(space.as_str()))
        .order(wimm_local_projections::handle)
        .select(wimm_local_projections::payload)
        .load(conn)?;
    let entries: Vec<(String, String, String)> = wimm_local_receipts::table
        .order(wimm_local_receipts::identity)
        .select((
            wimm_local_receipts::identity,
            wimm_local_receipts::request,
            wimm_local_receipts::receipt,
        ))
        .load(conn)?;
    let mut operations = Vec::new();
    for (key, original, payload) in entries {
        let receipt = checked_receipt(&payload, &key, &original)?;
        if receipt.identity.space_id == *space {
            operations.push(LocalReceiptEntry {
                request: decode(&original)?,
                receipt,
            });
        }
    }
    let value = LocalCommitCheckpoint {
        checkpoint_version: 1,
        physical_schema_version: 1,
        snapshot: LocalSnapshot {
            storage_schema_version: SnapshotStorageVersion::new(1)
                .map_err(|_| failure(StorageFailureCode::UpdateRequired))?,
            domain_schema_version: SnapshotDomainVersion::new(1)
                .map_err(|_| failure(StorageFailureCode::UpdateRequired))?,
            profile_id: profile.clone(),
            space_id: space.clone(),
            epoch: EntityId::new(epoch)
                .map_err(|_| failure(StorageFailureCode::InvalidResponse))?,
            aggregates: typed,
            confirmed: vec![],
            pending: pending
                .iter()
                .map(|s| decode(s))
                .collect::<Result<_, _>>()?,
            projections: projections
                .iter()
                .map(|s| decode(s))
                .collect::<Result<_, _>>()?,
            sync_state: None,
        },
        operations,
    };
    check(&value)?;
    Ok(value)
}
impl LocalCheckpointPort for SqliteCommitStore {
    fn checkpoint(&self, space: &EntityId) -> Result<LocalCommitCheckpoint, StorageFailure> {
        self.connection
            .borrow_mut()
            .transaction::<_, TransactionError, _>(|conn| capture(conn, &self.profile, space))
            .map_err(read_error)
    }
}
impl SqliteCommitStore {
    pub fn backup_checkpoint(
        &self,
        space: &EntityId,
        backup_id: &EntityId,
        validator: &dyn SnapshotValidationPort,
        protection: &dyn SnapshotProtectionPort<LocalCommitCheckpoint, Error = StorageFailure>,
        backup: &dyn BackupReadPort<Error = StorageFailure>,
    ) -> Result<(LocalCommitCheckpoint, EncryptedBackupReceipt), StorageFailure> {
        let value = self.checkpoint(space)?;
        validator.validate(&value.snapshot)?;
        let ciphertext = protection.seal(value.clone())?;
        if ciphertext.is_empty() {
            return Err(failure(StorageFailureCode::WriteFailed));
        }
        let receipt = backup.persist(EncryptedBackupRequest {
            profile_id: LocalId::new(value.snapshot.profile_id.as_str().into())
                .map_err(|_| failure(StorageFailureCode::WriteFailed))?,
            space_id: LocalId::new(space.as_str().into())
                .map_err(|_| failure(StorageFailureCode::WriteFailed))?,
            epoch: LocalId::new(value.snapshot.epoch.as_str().into())
                .map_err(|_| failure(StorageFailureCode::WriteFailed))?,
            snapshot_hash: LocalHash::new(digest(&value)?)
                .map_err(|_| failure(StorageFailureCode::WriteFailed))?,
            ciphertext: ciphertext.clone(),
        })?;
        // Der Aufrufer bindet den Backup-ID-Generator über den Plattformport; keine Pfade im Vertrag.
        if receipt.backup_id.as_str() != backup_id.as_str()
            || !matches_receipt(&value, &receipt)?
            || backup.read(&receipt)? != ciphertext
        {
            return Err(failure(StorageFailureCode::WriteFailed));
        }
        Ok((value, receipt))
    }
    pub fn restore_checkpoint(
        &mut self,
        request: LocalCheckpointRestoreRequest,
        validator: &dyn SnapshotValidationPort,
        protection: &dyn SnapshotProtectionPort<LocalCommitCheckpoint, Error = StorageFailure>,
        backup: &dyn BackupReadPort<Error = StorageFailure>,
        cancellation: &dyn CancellationPort,
    ) -> Result<(), StorageFailure> {
        request
            .validate()
            .map_err(|_| failure(StorageFailureCode::UpdateRequired))?;
        let expected = &request.expected;
        check(expected)?;
        if expected.snapshot.profile_id != self.profile
            || !matches_receipt(expected, &request.original_backup)?
        {
            return Err(failure(StorageFailureCode::EpochMismatch));
        }
        let saved = protection.unseal(&backup.read(&request.original_backup)?)?;
        if encode(&saved)? != encode(expected)? {
            return Err(failure(StorageFailureCode::RevisionConflict));
        }
        let mut restored = protection.unseal(&request.ciphertext)?;
        check(&restored)?;
        if restored.snapshot.profile_id != self.profile
            || restored.snapshot.space_id != expected.snapshot.space_id
        {
            return Err(failure(StorageFailureCode::EpochMismatch));
        }
        restored.snapshot.epoch = request.restored_epoch;
        validator.validate(&restored.snapshot)?;
        if cancellation.is_cancelled() {
            return Err(failure(StorageFailureCode::Cancelled));
        }
        let profile = self.profile.clone();
        let inject = std::mem::take(&mut self.fail_before_receipt);
        let result = self
            .connection
            .get_mut()
            .immediate_transaction::<_, TransactionError, _>(|conn| {
                let actual = capture(conn, &profile, &expected.snapshot.space_id)?;
                if encode(&actual)? != encode(expected)? {
                    return Err(failure(StorageFailureCode::RevisionConflict).into());
                }
                let space = &restored.snapshot.space_id;
                for a in &restored.snapshot.aggregates {
                    let other: Option<String> = wimm_local_aggregates::table
                        .find(a.handle.as_str())
                        .select(wimm_local_aggregates::space)
                        .first(conn)
                        .optional()?;
                    if other.as_deref().is_some_and(|s| s != space.as_str()) {
                        return Err(failure(StorageFailureCode::WriteFailed).into());
                    }
                }
                for p in &restored.snapshot.pending {
                    let other: Option<String> = wimm_local_pending::table
                        .find(p.operation_id.as_str())
                        .select(wimm_local_pending::space)
                        .first(conn)
                        .optional()?;
                    if other.as_deref().is_some_and(|s| s != space.as_str()) {
                        return Err(failure(StorageFailureCode::WriteFailed).into());
                    }
                }
                diesel::delete(
                    wimm_local_aggregates::table
                        .filter(wimm_local_aggregates::space.eq(space.as_str())),
                )
                .execute(conn)?;
                diesel::delete(
                    wimm_local_pending::table.filter(wimm_local_pending::space.eq(space.as_str())),
                )
                .execute(conn)?;
                diesel::delete(
                    wimm_local_projections::table
                        .filter(wimm_local_projections::space.eq(space.as_str())),
                )
                .execute(conn)?;
                for a in &restored.snapshot.aggregates {
                    diesel::insert_into(wimm_local_aggregates::table)
                        .values((
                            wimm_local_aggregates::handle.eq(a.handle.as_str()),
                            wimm_local_aggregates::space.eq(space.as_str()),
                            wimm_local_aggregates::revision.eq(a.aggregate.revision().value()),
                            wimm_local_aggregates::payload.eq(encode(a)?),
                        ))
                        .execute(conn)?;
                }
                for p in &restored.snapshot.pending {
                    diesel::insert_into(wimm_local_pending::table)
                        .values((
                            wimm_local_pending::handle.eq(p.operation_id.as_str()),
                            wimm_local_pending::space.eq(space.as_str()),
                            wimm_local_pending::payload.eq(encode(p)?),
                        ))
                        .execute(conn)?;
                }
                for p in &restored.snapshot.projections {
                    let key = projection(p);
                    diesel::insert_into(wimm_local_projections::table)
                        .values((
                            wimm_local_projections::handle.eq(encode(&(
                                key.0.as_str(),
                                key.1,
                                key.2,
                            ))?),
                            wimm_local_projections::space.eq(space.as_str()),
                            wimm_local_projections::payload.eq(encode(p)?),
                        ))
                        .execute(conn)?;
                }
                if inject {
                    return Err(failure(StorageFailureCode::WriteFailed).into());
                }
                // Bestehende historische Receipts bleiben erhalten; Inhalt kollidierender IDs nie ersetzen.
                for op in &restored.operations {
                    let key = encode(&op.request.identity)?;
                    let text = encode(&op.request)?;
                    let old: Option<(String, String)> = wimm_local_receipts::table
                        .find(&key)
                        .select((wimm_local_receipts::request, wimm_local_receipts::receipt))
                        .first(conn)
                        .optional()?;
                    if let Some((original, value)) = old {
                        if original != text || value != encode(&op.receipt)? {
                            return Err(failure(StorageFailureCode::OperationIdReused).into());
                        }
                    } else {
                        diesel::insert_into(wimm_local_receipts::table)
                            .values((
                                wimm_local_receipts::identity.eq(key),
                                wimm_local_receipts::request.eq(text),
                                wimm_local_receipts::receipt.eq(encode(&op.receipt)?),
                            ))
                            .execute(conn)?;
                    }
                }
                diesel::update(wimm_local_areas::table.find(space.as_str()))
                    .set(wimm_local_areas::epoch.eq(restored.snapshot.epoch.as_str()))
                    .execute(conn)?;
                if cancellation.is_cancelled() {
                    return Err(failure(StorageFailureCode::Cancelled).into());
                }
                Ok(())
            });
        result.map_err(read_error)
    }
}
fn matches_receipt(
    value: &LocalCommitCheckpoint,
    receipt: &EncryptedBackupReceipt,
) -> Result<bool, StorageFailure> {
    Ok(
        receipt.profile_id.as_str() == value.snapshot.profile_id.as_str()
            && receipt.space_id.as_str() == value.snapshot.space_id.as_str()
            && receipt.epoch.as_str() == value.snapshot.epoch.as_str()
            && receipt.snapshot_hash.as_str() == digest(value)?,
    )
}
