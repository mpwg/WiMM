// SPDX-License-Identifier: AGPL-3.0-or-later
#![forbid(unsafe_code)]
#![cfg(all(feature = "sqlite", not(target_family = "wasm")))]
use diesel::{connection::SimpleConnection, prelude::*};
use wimm_local_contracts::{
    models::EncryptedBackupReceipt,
    persistence_errors::*,
    scalars::{LocalHash, LocalId},
};
use wimm_local_dal::sqlite_backup::SqliteBackupStore;
fn receipt() -> EncryptedBackupReceipt {
    EncryptedBackupReceipt {
        backup_id: LocalId::new(id(1).as_str().into()).unwrap(),
        profile_id: LocalId::new(id(2).as_str().into()).unwrap(),
        space_id: LocalId::new(id(3).as_str().into()).unwrap(),
        epoch: LocalId::new(id(4).as_str().into()).unwrap(),
        snapshot_hash: LocalHash::new("c3ludGhldGlzY2g".into()).unwrap(),
    }
}
#[test]
fn orm_cipher_commit_duplicate_and_all_receipt_dimensions_are_checked_after_reopen() {
    let file = path("orm-backup");
    let mut store = SqliteBackupStore::initialize_new(&file).unwrap();
    let r = receipt();
    let bytes = vec![0, 255, 1, 128];
    store.persist(r.clone(), &bytes).unwrap();
    assert_eq!(
        store.persist(r.clone(), &[99]).unwrap_err().code,
        StorageFailureCode::WriteFailed
    );
    drop(store);
    let store = SqliteBackupStore::open_existing(&file).unwrap();
    assert_eq!(store.read(&r).unwrap(), bytes);
    for field in 0..5 {
        let mut changed = r.clone();
        match field {
            0 => changed.backup_id = changed.epoch.clone(),
            1 => changed.profile_id = changed.epoch.clone(),
            2 => changed.space_id = changed.epoch.clone(),
            3 => changed.epoch = changed.profile_id.clone(),
            _ => changed.snapshot_hash = LocalHash::new("ZmFsc2No".into()).unwrap(),
        };
        assert_eq!(
            store.read(&changed).unwrap_err().code,
            StorageFailureCode::WriteFailed
        );
    }
}
#[test]
fn orm_backup_actual_abort_future_schema_and_nonempty_initialization_preserve_original_file() {
    let file = path("orm-backup-fault");
    let mut store = SqliteBackupStore::initialize_new(&file).unwrap();
    let mut raw = SqliteConnection::establish(file.to_str().unwrap()).unwrap();
    raw.batch_execute("CREATE TRIGGER backup_failure BEFORE INSERT ON encrypted_backups BEGIN SELECT RAISE(ABORT,'synthetic-private-message'); END;").unwrap();
    assert_eq!(
        store.persist(receipt(), &[1]).unwrap_err().commit_state,
        FailureCommitState::NotCommitted
    );
    assert!(store.read(&receipt()).is_err());
    raw.batch_execute("DROP TRIGGER backup_failure").unwrap();
    store.persist(receipt(), &[1, 2, 3]).unwrap();
    drop(store);
    drop(raw);
    let original = std::fs::read(&file).unwrap();
    assert!(SqliteBackupStore::initialize_new(&file).is_err());
    assert_eq!(std::fs::read(&file).unwrap(), original);
    let mut raw = SqliteConnection::establish(file.to_str().unwrap()).unwrap();
    raw.batch_execute("UPDATE backup_meta SET version=999")
        .unwrap();
    drop(raw);
    let before = std::fs::read(&file).unwrap();
    assert!(SqliteBackupStore::open_existing(&file).is_err());
    assert_eq!(std::fs::read(&file).unwrap(), before);
}
#[test]
fn actual_child_orm_backup_driver() {
    let Some(file) = std::env::var_os("WIMM_ORM_BACKUP_PATH") else {
        return;
    };
    let path = std::path::Path::new(&file);
    let mut store = if std::env::var("WIMM_ORM_BACKUP_MODE").unwrap() == "write" {
        SqliteBackupStore::initialize_new(path).unwrap()
    } else {
        SqliteBackupStore::open_existing(path).unwrap()
    };
    if std::env::var("WIMM_ORM_BACKUP_MODE").unwrap() == "write" {
        store.persist(receipt(), &[0, 255, 1, 128]).unwrap();
    }
    assert_eq!(store.read(&receipt()).unwrap(), vec![0, 255, 1, 128]);
}
#[test]
fn actual_orm_cipher_file_survives_two_separate_processes() {
    let file = path("orm-backup-process");
    for mode in ["write", "read"] {
        let result = std::process::Command::new(std::env::current_exe().unwrap())
            .args(["--exact", "actual_child_orm_backup_driver", "--nocapture"])
            .env("WIMM_ORM_BACKUP_PATH", &file)
            .env("WIMM_ORM_BACKUP_MODE", mode)
            .output()
            .unwrap();
        assert!(
            result.status.success(),
            "{}",
            String::from_utf8_lossy(&result.stderr)
        );
        assert!(String::from_utf8_lossy(&result.stdout).contains("1 passed"));
    }
}

fn id(n: u32) -> wimm_finance_types::scalars::EntityId {
    wimm_finance_types::scalars::EntityId::new(format!("50000000-0000-4000-8000-{n:012}")).unwrap()
}
fn path(name: &str) -> std::path::PathBuf {
    let root =
        std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("../../test-results/dal03/backups");
    std::fs::create_dir_all(&root).unwrap();
    root.join(format!(
        "{name}-{}-{}.sqlite3",
        std::process::id(),
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_nanos()
    ))
}
#[test]
#[cfg(feature = "receipt-probe")]
fn actual_relaxed_connection_durability_never_emits_a_backup_receipt() {
    let file = path("orm-durability");
    let mut store = SqliteBackupStore::initialize_new(&file).unwrap();
    store.probe_relax_durability().unwrap();
    assert_eq!(
        store
            .persist(receipt(), &[1, 2, 3])
            .unwrap_err()
            .commit_state,
        FailureCommitState::NotCommitted
    );
    assert!(store.read(&receipt()).is_err());
}

#[test]
fn shared_connection_backup_initialization_and_reopen_preserve_original_ciphertext() {
    let file = path("shared-connection-backup");
    let connection = SqliteConnection::establish(file.to_str().unwrap()).unwrap();
    let mut store = SqliteBackupStore::initialize_connection(connection).unwrap();
    let r = receipt();
    let ciphertext = [0, 255, 128, 7];
    assert_eq!(
        serde_json::to_value(store.persist(r.clone(), &ciphertext).unwrap()).unwrap(),
        serde_json::to_value(&r).unwrap()
    );
    drop(store);
    let connection = SqliteConnection::establish(file.to_str().unwrap()).unwrap();
    assert_eq!(
        SqliteBackupStore::initialize_connection(connection)
            .err()
            .unwrap()
            .code,
        StorageFailureCode::UpdateRequired
    );
    let connection = SqliteConnection::establish(file.to_str().unwrap()).unwrap();
    let store = SqliteBackupStore::from_connection(connection).unwrap();
    assert_eq!(store.read(&r).unwrap(), ciphertext);
    std::fs::remove_file(file).unwrap();
}
