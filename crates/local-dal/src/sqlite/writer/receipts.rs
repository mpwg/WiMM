// SPDX-License-Identifier: AGPL-3.0-or-later
//! Receipts im gemeinsamen nativen Bestand; Aktivierung ausschließlich über registrierte Migration.
use super::*;
use sha2::{Digest, Sha256};
use wimm_local_contracts::{
    Validate,
    commit::*,
    storage_port::{CancellationPort, NeverCancel},
};
use wimm_persistence_contracts::CommitOutcome;
diesel::table! { wimm_native_receipts (identity) { identity -> Text, profile -> Text, space -> Text, request -> Text, receipt -> Text, } }
diesel::table! { wimm_native_recovery (profile) { profile -> Text, ticket -> Binary, } }
pub(in crate::sqlite) fn read_schema(c: &mut SqliteConnection) -> Result<(), ReadError> {
    supported(c).map(|_| ())
}

fn receipt(original: &LocalCommitRequest) -> Result<LocalCommitReceipt, ReadError> {
    original
        .validate()
        .map_err(|_| fail(StorageFailureCode::UpdateRequired))?;
    let hash = Sha256::digest(text(original)?.as_bytes())
        .iter()
        .map(|b| format!("{b:02x}"))
        .collect::<String>();
    Ok(LocalCommitReceipt {
        identity: original.identity.clone(),
        content_hash: wimm_finance_types::scalars::FileHash::new(hash).map_err(|_| invalid())?,
        committed_revisions: original
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
fn lookup(
    c: &mut SqliteConnection,
    id: &LocalOperationIdentity,
) -> Result<Option<(String, LocalCommitReceipt)>, ReadError> {
    read_schema(c)?;
    let row: Option<(String, String, String)> = wimm_native_receipts::table
        .filter(wimm_native_receipts::profile.eq(id.profile_id.as_str()))
        .filter(wimm_native_receipts::identity.eq(text(id)?))
        .select((
            wimm_native_receipts::request,
            wimm_native_receipts::receipt,
            wimm_native_receipts::space,
        ))
        .first(c)
        .optional()?;
    row.map(|(original, saved, space)| {
        let r: LocalCommitRequest = decode(&original)?;
        let value: LocalCommitReceipt = decode(&saved)?;
        if space != id.space_id.as_str()
            || text(&r.identity)? != text(id)?
            || text(&receipt(&r)?)? != text(&value)?
        {
            return Err(invalid().into());
        }
        Ok((original, value))
    })
    .transpose()
}
impl<V: SnapshotValidationPort> LocalCommitPort for SqliteWriter<V> {
    fn commit(&mut self, request: LocalCommitRequest) -> LocalCommitOutcome {
        self.commit_cancellable(request, &NeverCancel)
    }
    fn lookup_result(
        &self,
        id: &LocalOperationIdentity,
    ) -> Result<Option<LocalCommitReceipt>, StorageFailure> {
        if id.profile_id != self.store.profile {
            return Err(StorageFailure::not_committed(
                StorageFailureCode::EpochMismatch,
            ));
        }
        id.validate()
            .map_err(|_| StorageFailure::not_committed(StorageFailureCode::UpdateRequired))?;
        self.store
            .connection
            .borrow_mut()
            .transaction::<_, ReadError, _>(|c| {
                supported(c)?;
                Ok(lookup(c, id)?.map(|(_, r)| r))
            })
            .map_err(|e| e.0)
    }
}
impl<V: SnapshotValidationPort> CancellableLocalCommitPort for SqliteWriter<V> {
    fn commit_cancellable(
        &mut self,
        request: LocalCommitRequest,
        cancel: &dyn CancellationPort,
    ) -> LocalCommitOutcome {
        let identity = request.identity.clone();
        let result = self.write(|c, p, _| {
            request
                .validate()
                .map_err(|_| fail(StorageFailureCode::UpdateRequired))?;
            if identity.profile_id != *p {
                return Err(fail(StorageFailureCode::EpochMismatch));
            }
            if let Some((original, known)) = lookup(c, &identity)? {
                if original != text(&request)? {
                    return Err(fail(StorageFailureCode::OperationIdReused));
                }
                return Ok(known);
            }
            if cancel.is_cancelled() {
                return Err(fail(StorageFailureCode::Cancelled));
            }
            if local_write_epoch(c, p, &identity.space_id)? != identity.epoch {
                return Err(fail(StorageFailureCode::EpochMismatch));
            }
            if request
                .batch
                .aggregates
                .iter()
                .any(|a| a.aggregate.space_id() != &identity.space_id)
                || request
                    .batch
                    .outbox
                    .iter()
                    .any(|a| a.space_id != identity.space_id)
                || request
                    .batch
                    .projections
                    .iter()
                    .any(|a| projection_key(a).0 != &identity.space_id)
            {
                return Err(fail(StorageFailureCode::WriteFailed));
            }
            for expected in &request.batch.expected_revisions {
                let area: Option<String> = aggregates::table
                    .filter(aggregates::profile_id.eq(p.as_str()))
                    .filter(aggregates::handle.eq(expected.handle.as_str()))
                    .select(aggregates::space_id)
                    .first(c)
                    .optional()?;
                if area
                    .as_ref()
                    .is_some_and(|a| a != identity.space_id.as_str())
                {
                    return Err(fail(StorageFailureCode::WriteFailed));
                }
            }
            let value = receipt(&request)?;
            write_batch(c, p, &request.batch)?;
            if cancel.is_cancelled() {
                return Err(fail(StorageFailureCode::Cancelled));
            }
            diesel::insert_into(wimm_native_receipts::table)
                .values((
                    wimm_native_receipts::identity.eq(text(&identity)?),
                    wimm_native_receipts::profile.eq(p.as_str()),
                    wimm_native_receipts::space.eq(identity.space_id.as_str()),
                    wimm_native_receipts::request.eq(text(&request)?),
                    wimm_native_receipts::receipt.eq(text(&value)?),
                ))
                .execute(c)?;
            if cancel.is_cancelled() {
                return Err(fail(StorageFailureCode::Cancelled));
            }
            Ok(value)
        });
        match result {
            Ok(value) => CommitOutcome::Committed { value },
            Err(error) if error.commit_state == FailureCommitState::NotCommitted => {
                CommitOutcome::NotCommitted { error }
            }
            Err(_) => CommitOutcome::Unknown { identity },
        }
    }
}
impl<V: SnapshotValidationPort> SqliteWriter<V> {
    /// Private profilgebundene Recoverybytes; Inhaltsschutz/Originalprüfung liegt im Rust-Anwendungsport.
    pub fn load_recovery(&self) -> Result<Option<Vec<u8>>, StorageFailure> {
        self.store
            .connection
            .borrow_mut()
            .transaction::<_, ReadError, _>(|c| {
                supported(c)?;
                read_schema(c)?;
                Ok(wimm_native_recovery::table
                    .find(self.store.profile.as_str())
                    .select(wimm_native_recovery::ticket)
                    .first(c)
                    .optional()?)
            })
            .map_err(|e| e.0)
    }
    pub fn save_recovery_if_absent(&mut self, bytes: &[u8]) -> Result<(), StorageFailure> {
        if bytes.is_empty() {
            return Err(StorageFailure::not_committed(
                StorageFailureCode::InvalidResponse,
            ));
        }
        self.write(|c, p, _| {
            read_schema(c)?;
            let current: Option<Vec<u8>> = wimm_native_recovery::table
                .find(p.as_str())
                .select(wimm_native_recovery::ticket)
                .first(c)
                .optional()?;
            match current {
                Some(current) if current == bytes => Ok(()),
                Some(_) => Err(fail(StorageFailureCode::RevisionConflict)),
                None => {
                    diesel::insert_into(wimm_native_recovery::table)
                        .values((
                            wimm_native_recovery::profile.eq(p.as_str()),
                            wimm_native_recovery::ticket.eq(bytes),
                        ))
                        .execute(c)?;
                    Ok(())
                }
            }
        })
    }
    pub fn clear_recovery(&mut self, expected: &[u8]) -> Result<(), StorageFailure> {
        self.write(|c, p, _| {
            read_schema(c)?;
            let current: Option<Vec<u8>> = wimm_native_recovery::table
                .find(p.as_str())
                .select(wimm_native_recovery::ticket)
                .first(c)
                .optional()?;
            if current.as_deref() != Some(expected) {
                return Err(fail(StorageFailureCode::RevisionConflict));
            }
            diesel::delete(wimm_native_recovery::table.find(p.as_str())).execute(c)?;
            Ok(())
        })
    }
}

mod checkpoint;
