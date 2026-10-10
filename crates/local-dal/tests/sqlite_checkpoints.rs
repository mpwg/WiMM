// SPDX-License-Identifier: AGPL-3.0-or-later
#![forbid(unsafe_code)]
#![cfg(all(feature = "sqlite", feature = "receipt-probe"))]
mod support;
use std::{cell::Cell, io::Write, rc::Rc};
use support::*;
use wimm_local_contracts::{
    checkpoint::*, commit::*, models::EncryptedBackupReceipt, persistence_errors::*,
    ports::EncryptedBackupRequest, scalars::LocalId, storage::*, storage_port::*,
};
use wimm_local_dal::sqlite_commit::{CommitBoundary, SqliteCommitStore};
use wimm_persistence_contracts::CommitOutcome;
struct Validator;
impl SnapshotValidationPort for Validator {
    fn validate(&self, s: &LocalSnapshot) -> Result<(), StorageFailure> {
        let aggregates = s
            .aggregates
            .iter()
            .map(|a| serde_json::to_value(&a.aggregate).unwrap())
            .collect::<Vec<_>>();
        wimm_finance_core::validate(
            wimm_finance_types::state_contracts::ValidationRequest::Historical {
                contract_version: 1.into(),
                domain_schema_version: 1.into(),
                space_id: s.space_id.clone(),
                aggregates: s.aggregates.iter().map(|a| a.aggregate.clone()).collect(),
            },
        )
        .map_err(|_| StorageFailure::not_committed(StorageFailureCode::WriteFailed))?;
        let projections = s
            .projections
            .iter()
            .map(serde_json::to_value)
            .collect::<Result<Vec<_>, _>>()
            .map_err(|_| StorageFailure::not_committed(StorageFailureCode::WriteFailed))?;
        wimm_finance_core::projection_cache::validate(&aggregates, &projections)
            .map_err(|_| StorageFailure::not_committed(StorageFailureCode::WriteFailed))
    }
}
struct Protection(wimm_client_crypto::SecretKey);
impl SnapshotProtectionPort<LocalCommitCheckpoint> for Protection {
    type Error = StorageFailure;
    fn seal(&self, value: LocalCommitCheckpoint) -> Result<Vec<u8>, StorageFailure> {
        wimm_client_crypto::vault::seal_snapshot(&self.0, &serde_json::to_vec(&value).unwrap())
            .map_err(|_| StorageFailure::not_committed(StorageFailureCode::WriteFailed))
    }
    fn unseal(&self, bytes: &[u8]) -> Result<LocalCommitCheckpoint, StorageFailure> {
        let clear = wimm_client_crypto::vault::open_snapshot(&self.0, bytes)
            .map_err(|_| StorageFailure::not_committed(StorageFailureCode::InvalidResponse))?;
        serde_json::from_slice(&clear)
            .map_err(|_| StorageFailure::not_committed(StorageFailureCode::InvalidResponse))
    }
}
struct Backup {
    file: std::path::PathBuf,
    fail: Cell<bool>,
}
impl BackupPort for Backup {
    type Error = StorageFailure;
    fn persist(&self, r: EncryptedBackupRequest) -> Result<EncryptedBackupReceipt, StorageFailure> {
        if self.fail.get() {
            return Err(StorageFailure::not_committed(
                StorageFailureCode::WriteFailed,
            ));
        }
        let fail = |_| StorageFailure::not_committed(StorageFailureCode::WriteFailed);
        let mut file = std::fs::File::create(&self.file).map_err(fail)?;
        file.write_all(&r.ciphertext).map_err(fail)?;
        file.sync_all().map_err(fail)?;
        Ok(EncryptedBackupReceipt {
            backup_id: LocalId::new(id(90).as_str().into()).unwrap(),
            profile_id: r.profile_id,
            space_id: r.space_id,
            epoch: r.epoch,
            snapshot_hash: r.snapshot_hash,
        })
    }
}
impl BackupReadPort for Backup {
    fn read(&self, receipt: &EncryptedBackupReceipt) -> Result<Vec<u8>, StorageFailure> {
        if receipt.backup_id.as_str() != id(90).as_str() {
            return Err(StorageFailure::not_committed(
                StorageFailureCode::WriteFailed,
            ));
        }
        std::fs::read(&self.file)
            .map_err(|_| StorageFailure::not_committed(StorageFailureCode::WriteFailed))
    }
}
struct Cancellation(Rc<Cell<bool>>);
impl CancellationPort for Cancellation {
    fn is_cancelled(&self) -> bool {
        self.0.get()
    }
}
#[test]
fn real_before_and_after_commit_cancellation_preserves_correct_confidence() {
    for (boundary, committed) in [
        (CommitBoundary::AfterWrites, false),
        (CommitBoundary::AfterCommit, true),
    ] {
        let file = path("cancel");
        let mut db = SqliteCommitStore::open(&file, id(1)).unwrap();
        db.initialize_area(&id(2), &id(3)).unwrap();
        let cancelled = Rc::new(Cell::new(false));
        let token = Cancellation(cancelled.clone());
        db.observe_commit(move |event| {
            if event == boundary {
                cancelled.set(true)
            }
        });
        let r = request(100, 1);
        let result = db.commit_cancellable(r.clone(), &token);
        assert!(token.is_cancelled());
        if committed {
            assert!(matches!(result, CommitOutcome::Committed { .. }));
            assert!(db.lookup_result(&r.identity).unwrap().is_some());
        } else {
            assert!(matches!(
                result,
                CommitOutcome::NotCommitted {
                    error: StorageFailure {
                        code: StorageFailureCode::Cancelled,
                        ..
                    }
                }
            ));
            assert!(db.lookup_result(&r.identity).unwrap().is_none());
            assert!(db.read_aggregate(&id(4)).unwrap().is_none());
        }
        drop(db);
        std::fs::remove_file(file).unwrap();
    }
}
#[test]
fn protected_original_restore_cas_rollback_and_historical_receipts_are_durable() {
    wimm_client_crypto::initialize().unwrap();
    let file = path("restore");
    let protection = Protection(wimm_client_crypto::SecretKey::from_bytes(&[41; 32]).unwrap());
    let backup = Backup {
        file: file.with_extension("backup.enc"),
        fail: Cell::new(false),
    };
    let mut db = SqliteCommitStore::open(&file, id(1)).unwrap();
    db.initialize_area(&id(2), &id(3)).unwrap();
    let first = request(101, 1);
    assert!(matches!(
        db.commit(first.clone()),
        CommitOutcome::Committed { .. }
    ));
    let old = db.checkpoint(&id(2)).unwrap();
    let old_cipher = protection.seal(old.clone()).unwrap();
    assert!(!String::from_utf8_lossy(&old_cipher).contains("Synthetisch"));
    let second = request(102, 2);
    assert!(matches!(
        db.commit(second.clone()),
        CommitOutcome::Committed { .. }
    ));
    let before = db.checkpoint(&id(2)).unwrap();
    backup.fail.set(true);
    assert!(
        db.backup_checkpoint(&id(2), &id(90), &Validator, &protection, &backup)
            .is_err()
    );
    assert_eq!(
        serde_json::to_value(db.checkpoint(&id(2)).unwrap()).unwrap(),
        serde_json::to_value(&before).unwrap()
    );
    backup.fail.set(false);
    let (expected, receipt) = db
        .backup_checkpoint(&id(2), &id(90), &Validator, &protection, &backup)
        .unwrap();
    let restore = LocalCheckpointRestoreRequest {
        expected: expected.clone(),
        original_backup: receipt,
        ciphertext: old_cipher,
        restored_epoch: id(99),
    };
    let hidden = backup.file.with_extension("saved");
    std::fs::rename(&backup.file, &hidden).unwrap();
    assert!(
        db.restore_checkpoint(
            restore.clone(),
            &Validator,
            &protection,
            &backup,
            &NeverCancel
        )
        .is_err()
    );
    std::fs::rename(hidden, &backup.file).unwrap();
    let mut invalid = old.clone();
    if let StoredProjection::Balance { payload, .. } = &mut invalid.snapshot.projections[0] {
        *payload = wimm_finance_types::scalars::MoneyCents::new(123).unwrap();
    }
    let mut bad_cache = restore.clone();
    bad_cache.ciphertext = protection.seal(invalid).unwrap();
    assert!(
        db.restore_checkpoint(bad_cache, &Validator, &protection, &backup, &NeverCancel)
            .is_err()
    );
    let wrong = Protection(wimm_client_crypto::SecretKey::from_bytes(&[42; 32]).unwrap());
    assert!(
        db.restore_checkpoint(restore.clone(), &Validator, &wrong, &backup, &NeverCancel)
            .is_err()
    );
    let mut foreign = restore.clone();
    foreign.original_backup.profile_id = LocalId::new(id(800).as_str().into()).unwrap();
    assert!(
        db.restore_checkpoint(foreign, &Validator, &protection, &backup, &NeverCancel)
            .is_err()
    );
    let mut tampered = restore.clone();
    tampered.ciphertext[15] ^= 1;
    assert!(
        db.restore_checkpoint(tampered, &Validator, &protection, &backup, &NeverCancel)
            .is_err()
    );
    let cancelled = Cancellation(Rc::new(Cell::new(true)));
    assert!(
        db.restore_checkpoint(
            restore.clone(),
            &Validator,
            &protection,
            &backup,
            &cancelled
        )
        .is_err()
    );
    db.inject_before_receipt_failure();
    assert!(
        db.restore_checkpoint(
            restore.clone(),
            &Validator,
            &protection,
            &backup,
            &NeverCancel
        )
        .is_err()
    );
    assert_eq!(
        serde_json::to_value(db.checkpoint(&id(2)).unwrap()).unwrap(),
        serde_json::to_value(&before).unwrap()
    );
    db.restore_checkpoint(
        restore.clone(),
        &Validator,
        &protection,
        &backup,
        &NeverCancel,
    )
    .unwrap();
    drop(db);
    let mut db = SqliteCommitStore::open(&file, id(1)).unwrap();
    let actual = db.checkpoint(&id(2)).unwrap();
    assert_eq!(actual.snapshot.epoch, id(99));
    assert_eq!(
        serde_json::to_value(&actual.snapshot.aggregates).unwrap(),
        serde_json::to_value(&old.snapshot.aggregates).unwrap()
    );
    assert_eq!(actual.operations.len(), 2);
    assert!(db.lookup_result(&first.identity).unwrap().is_some());
    assert!(db.lookup_result(&second.identity).unwrap().is_some());
    assert!(matches!(db.commit(second), CommitOutcome::Committed { .. }));
    assert_eq!(
        db.restore_checkpoint(restore, &Validator, &protection, &backup, &NeverCancel)
            .unwrap_err()
            .code,
        StorageFailureCode::RevisionConflict
    );
    drop(db);
    std::fs::remove_file(file).unwrap();
    std::fs::remove_file(backup.file).unwrap();
}
#[test]
fn concurrent_write_invalidates_protected_original_without_losing_either_receipt() {
    wimm_client_crypto::initialize().unwrap();
    let file = path("restore-race");
    let protection = Protection(wimm_client_crypto::SecretKey::from_bytes(&[41; 32]).unwrap());
    let backup = Backup {
        file: file.with_extension("backup.enc"),
        fail: Cell::new(false),
    };
    let mut a = SqliteCommitStore::open(&file, id(1)).unwrap();
    a.initialize_area(&id(2), &id(3)).unwrap();
    let first = request(110, 1);
    assert!(matches!(
        a.commit(first.clone()),
        CommitOutcome::Committed { .. }
    ));
    let (expected, receipt) = a
        .backup_checkpoint(&id(2), &id(90), &Validator, &protection, &backup)
        .unwrap();
    let cipher = protection.seal(expected.clone()).unwrap();
    let mut b = SqliteCommitStore::open(&file, id(1)).unwrap();
    let second = request(111, 2);
    assert!(matches!(
        b.commit(second.clone()),
        CommitOutcome::Committed { .. }
    ));
    let before = b.checkpoint(&id(2)).unwrap();
    let restore = LocalCheckpointRestoreRequest {
        expected,
        original_backup: receipt,
        ciphertext: cipher,
        restored_epoch: id(99),
    };
    assert_eq!(
        a.restore_checkpoint(restore, &Validator, &protection, &backup, &NeverCancel)
            .unwrap_err()
            .code,
        StorageFailureCode::RevisionConflict
    );
    assert_eq!(
        serde_json::to_value(a.checkpoint(&id(2)).unwrap()).unwrap(),
        serde_json::to_value(before).unwrap()
    );
    assert!(a.lookup_result(&first.identity).unwrap().is_some());
    assert!(a.lookup_result(&second.identity).unwrap().is_some());
    drop(a);
    drop(b);
    std::fs::remove_file(file).unwrap();
    std::fs::remove_file(backup.file).unwrap();
}
#[test]
fn registered_initial_schema_and_future_checkpoint_versions_never_overwrite_foreign_data() {
    use diesel::connection::SimpleConnection;
    use diesel::prelude::*;
    use sea_query::{Alias, ColumnDef, SqliteQueryBuilder, Table};
    let file = path("foreign-schema");
    let mut conn = SqliteConnection::establish(file.to_str().unwrap()).unwrap();
    conn.batch_execute(
        &Table::create()
            .table(Alias::new("old_source"))
            .col(
                ColumnDef::new(Alias::new("id"))
                    .integer()
                    .not_null()
                    .primary_key(),
            )
            .to_string(SqliteQueryBuilder),
    )
    .unwrap();
    drop(conn);
    let mut db = SqliteCommitStore::open(&file, id(1)).unwrap();
    assert_eq!(
        db.initialize_area(&id(2), &id(3)).unwrap_err().code,
        StorageFailureCode::UpdateRequired
    );
    drop(db);
    std::fs::remove_file(&file).unwrap();
    let mut db = SqliteCommitStore::open(&file, id(1)).unwrap();
    db.initialize_area(&id(2), &id(3)).unwrap();
    let before = db.checkpoint(&id(2)).unwrap();
    let mut future = serde_json::to_value(&before).unwrap();
    future["checkpointVersion"] = 2.into();
    assert!(serde_json::from_value::<LocalCommitCheckpoint>(future).is_err());
    assert_eq!(
        serde_json::to_value(db.checkpoint(&id(2)).unwrap()).unwrap(),
        serde_json::to_value(before).unwrap()
    );
    drop(db);
    std::fs::remove_file(file).unwrap();
}
