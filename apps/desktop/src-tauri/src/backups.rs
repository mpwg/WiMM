// SPDX-License-Identifier: AGPL-3.0-or-later
//! Separater lokaler Chiffratspeicher: kein SQL-/Pfadport und kein Finanzklartext.
use crate::storage_failure::{StorageFailure, StorageFailureCode, failure};
#[cfg(test)]
use crate::storage_failure::{commit_error, storage_error};
#[cfg(test)]
use rusqlite::{Connection, OptionalExtension, TransactionBehavior, params};
use serde::{Deserialize, Serialize};
use std::sync::Mutex;

pub struct BackupState(pub Mutex<wimm_local_dal::sqlite_backup::SqliteBackupStore>);

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct BackupReceipt {
    pub backup_id: String,
    pub profile_id: String,
    pub space_id: String,
    pub epoch: String,
    pub snapshot_hash: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct BackupInput {
    pub receipt: BackupReceipt,
    pub ciphertext: Vec<u8>,
}

pub(crate) fn valid_uuid(value: &str) -> bool {
    let bytes = value.as_bytes();
    bytes.len() == 36
        && bytes.iter().enumerate().all(|(index, byte)| {
            if [8, 13, 18, 23].contains(&index) {
                *byte == b'-'
            } else {
                byte.is_ascii_hexdigit()
            }
        })
        && (matches!(bytes[14], b'1'..=b'8')
            && matches!(bytes[19], b'8' | b'9' | b'a' | b'b' | b'A' | b'B')
            || value == "00000000-0000-0000-0000-000000000000"
            || value.eq_ignore_ascii_case("ffffffff-ffff-ffff-ffff-ffffffffffff"))
}

fn valid_receipt(receipt: &BackupReceipt) -> bool {
    [
        &receipt.backup_id,
        &receipt.profile_id,
        &receipt.space_id,
        &receipt.epoch,
    ]
    .into_iter()
    .all(|value| valid_uuid(value))
        && !receipt.snapshot_hash.is_empty()
        && receipt.snapshot_hash.len() <= 65_536
        && receipt
            .snapshot_hash
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'_' | b'-'))
}

#[cfg(test)]
fn assert_schema(connection: &Connection) -> rusqlite::Result<()> {
    let exists: bool = connection.query_row(
        "SELECT EXISTS(SELECT 1 FROM sqlite_master WHERE type='table' AND name='backup_meta')",
        [],
        |row| row.get(0),
    )?;
    if exists {
        let version: Option<i64> = connection
            .query_row("SELECT version FROM backup_meta WHERE id=1", [], |row| {
                row.get(0)
            })
            .optional()?;
        if version != Some(1) {
            return Err(rusqlite::Error::InvalidQuery);
        }
    } else {
        let has_tables: bool = connection.query_row("SELECT EXISTS(SELECT 1 FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%')", [], |row| row.get(0))?;
        if has_tables {
            return Err(rusqlite::Error::InvalidQuery);
        }
    }
    Ok(())
}

#[cfg(test)]
pub fn initialize_backups(connection: &Connection) -> rusqlite::Result<()> {
    assert_schema(connection)?;
    connection.pragma_update(None, "synchronous", "FULL")?;
    let tx = connection.unchecked_transaction()?;
    tx.execute_batch("CREATE TABLE IF NOT EXISTS backup_meta(id INTEGER PRIMARY KEY CHECK(id=1), version INTEGER NOT NULL);
        INSERT OR IGNORE INTO backup_meta VALUES(1,1);
        CREATE TABLE IF NOT EXISTS encrypted_backups (
          backup_id TEXT PRIMARY KEY, profile_id TEXT NOT NULL, space_id TEXT NOT NULL,
          epoch TEXT NOT NULL, snapshot_hash TEXT NOT NULL, ciphertext BLOB NOT NULL CHECK(length(ciphertext)>0)
        );")?;
    tx.commit()
}

#[cfg(test)]
pub fn read_backup(
    connection: &Connection,
    receipt: &BackupReceipt,
) -> Result<Vec<u8>, StorageFailure> {
    if !valid_receipt(receipt) {
        return Err(failure(StorageFailureCode::WriteFailed));
    }
    assert_schema(connection).map_err(storage_error)?;
    connection.query_row("SELECT ciphertext FROM encrypted_backups WHERE backup_id=?1 AND profile_id=?2 AND space_id=?3 AND epoch=?4 AND snapshot_hash=?5",
        params![receipt.backup_id, receipt.profile_id, receipt.space_id, receipt.epoch, receipt.snapshot_hash], |row| row.get::<_, Vec<u8>>(0))
        .map_err(storage_error)
        .and_then(|bytes| if bytes.is_empty() { Err(failure(StorageFailureCode::WriteFailed)) } else { Ok(bytes) })
}

#[cfg(test)]
pub fn persist_backup(
    connection: &mut Connection,
    input: BackupInput,
) -> Result<BackupReceipt, StorageFailure> {
    if !valid_receipt(&input.receipt) || input.ciphertext.is_empty() {
        return Err(failure(StorageFailureCode::WriteFailed));
    }
    assert_schema(connection).map_err(storage_error)?;
    let durability: i64 = connection
        .pragma_query_value(None, "synchronous", |row| row.get(0))
        .map_err(storage_error)?;
    if durability < 2 {
        return Err(failure(StorageFailureCode::WriteFailed));
    }
    let tx = connection
        .transaction_with_behavior(TransactionBehavior::Immediate)
        .map_err(storage_error)?;
    tx.execute("INSERT INTO encrypted_backups(backup_id,profile_id,space_id,epoch,snapshot_hash,ciphertext) VALUES(?1,?2,?3,?4,?5,?6)",
        params![input.receipt.backup_id,input.receipt.profile_id,input.receipt.space_id,input.receipt.epoch,input.receipt.snapshot_hash,input.ciphertext]).map_err(storage_error)?;
    tx.commit().map_err(commit_error)?;
    if read_backup(connection, &input.receipt)
        .map_err(|_| StorageFailure::unknown(StorageFailureCode::CommitUnknown))?
        != input.ciphertext
    {
        return Err(StorageFailure::unknown(StorageFailureCode::CommitUnknown));
    }
    Ok(input.receipt)
}

pub trait EncryptedBackupReader {
    fn read_ciphertext(&self, receipt: &BackupReceipt) -> Result<Vec<u8>, StorageFailure>;
}
pub(crate) fn typed_receipt(
    receipt: &BackupReceipt,
) -> Result<wimm_local_contracts::models::EncryptedBackupReceipt, StorageFailure> {
    if !valid_receipt(receipt) {
        return Err(failure(StorageFailureCode::WriteFailed));
    }
    serde_json::from_value(
        serde_json::to_value(receipt).map_err(|_| failure(StorageFailureCode::WriteFailed))?,
    )
    .map_err(|_| failure(StorageFailureCode::WriteFailed))
}
impl EncryptedBackupReader for wimm_local_dal::sqlite_backup::SqliteBackupStore {
    fn read_ciphertext(&self, receipt: &BackupReceipt) -> Result<Vec<u8>, StorageFailure> {
        self.read(&typed_receipt(receipt)?)
    }
}
#[cfg(test)]
impl EncryptedBackupReader for Connection {
    fn read_ciphertext(&self, receipt: &BackupReceipt) -> Result<Vec<u8>, StorageFailure> {
        read_backup(self, receipt)
    }
}
#[tauri::command]
pub fn storage_persist_encrypted_backup(
    state: tauri::State<'_, BackupState>,
    input: BackupInput,
) -> Result<BackupReceipt, StorageFailure> {
    let typed = typed_receipt(&input.receipt)?;
    state
        .0
        .lock()
        .map_err(|_| failure(StorageFailureCode::ResourceUnavailable))?
        .persist(typed, &input.ciphertext)?;
    Ok(input.receipt)
}
#[tauri::command]
pub fn storage_read_encrypted_backup(
    state: tauri::State<'_, BackupState>,
    receipt: BackupReceipt,
) -> Result<Vec<u8>, StorageFailure> {
    state
        .0
        .lock()
        .map_err(|_| failure(StorageFailureCode::ResourceUnavailable))?
        .read_ciphertext(&receipt)
}

#[cfg(test)]
mod tests {
    use super::*;
    fn input() -> BackupInput {
        BackupInput {
            receipt: BackupReceipt {
                backup_id: "00000000-0000-4000-8000-000000000001".into(),
                profile_id: "00000000-0000-4000-8000-000000000002".into(),
                space_id: "00000000-0000-4000-8000-000000000003".into(),
                epoch: "00000000-0000-4000-8000-000000000004".into(),
                snapshot_hash: "c3ludGhldGlzY2g".into(),
            },
            ciphertext: vec![0, 255, 1, 128],
        }
    }
    #[test]
    fn commit_duplicates_and_context_are_checked_without_overwrite() {
        let mut db = Connection::open_in_memory().unwrap();
        initialize_backups(&db).unwrap();
        let receipt = persist_backup(&mut db, input()).unwrap();
        assert_eq!(read_backup(&db, &receipt).unwrap(), input().ciphertext);
        let mut duplicate = input();
        duplicate.ciphertext = vec![99];
        assert!(persist_backup(&mut db, duplicate).is_err());
        assert_eq!(read_backup(&db, &receipt).unwrap(), input().ciphertext);
        for field in 0..5 {
            let mut wrong = receipt.clone();
            match field {
                0 => wrong.backup_id = wrong.epoch.clone(),
                1 => wrong.profile_id = wrong.epoch.clone(),
                2 => wrong.space_id = wrong.epoch.clone(),
                3 => wrong.epoch = wrong.profile_id.clone(),
                _ => wrong.snapshot_hash.push('A'),
            }
            assert!(read_backup(&db, &wrong).is_err());
        }
    }
    #[test]
    fn failed_write_or_relaxed_durability_never_produces_receipt() {
        let mut db = Connection::open_in_memory().unwrap();
        initialize_backups(&db).unwrap();
        db.execute_batch("CREATE TRIGGER fail_backup BEFORE INSERT ON encrypted_backups BEGIN SELECT RAISE(ABORT,'synthetischer Schreibfehler'); END;").unwrap();
        assert_eq!(
            persist_backup(&mut db, input()).unwrap_err().code,
            StorageFailureCode::WriteFailed
        );
        assert_eq!(
            db.query_row("SELECT count(*) FROM encrypted_backups", [], |row| row
                .get::<_, i64>(0))
                .unwrap(),
            0
        );
        db.execute_batch("DROP TRIGGER fail_backup; PRAGMA synchronous=OFF;")
            .unwrap();
        assert!(persist_backup(&mut db, input()).is_err());
        assert!(read_backup(&db, &input().receipt).is_err());
    }
    #[test]
    fn invalid_input_is_rejected_before_mutation() {
        let mut db = Connection::open_in_memory().unwrap();
        initialize_backups(&db).unwrap();
        for field in 0..6 {
            let mut bad = input();
            match field {
                0 => bad.receipt.backup_id = "kein UUID".into(),
                1 => bad.receipt.profile_id = "kein UUID".into(),
                2 => bad.receipt.space_id = "kein UUID".into(),
                3 => bad.receipt.epoch = "kein UUID".into(),
                4 => bad.receipt.snapshot_hash = "nicht gepaddet=".into(),
                _ => bad.ciphertext.clear(),
            }
            assert!(persist_backup(&mut db, bad).is_err());
        }
        assert_eq!(
            db.query_row("SELECT count(*) FROM encrypted_backups", [], |row| row
                .get::<_, i64>(0))
                .unwrap(),
            0
        );
    }
    #[test]
    fn newer_backup_schema_is_not_modified() {
        let directory = tempfile::tempdir_in(".").unwrap();
        let path = directory.path().join("backups.sqlite3");
        let db = Connection::open(&path).unwrap();
        initialize_backups(&db).unwrap();
        db.execute("UPDATE backup_meta SET version=999", [])
            .unwrap();
        drop(db);
        let before = std::fs::read(&path).unwrap();
        let mut db = Connection::open(&path).unwrap();
        assert!(initialize_backups(&db).is_err());
        assert!(persist_backup(&mut db, input()).is_err());
        drop(db);
        assert_eq!(std::fs::read(&path).unwrap(), before);
    }
    #[test]
    fn backup_survives_actual_rust_process_restart() {
        let directory = tempfile::tempdir_in(".").unwrap();
        let path = directory
            .path()
            .canonicalize()
            .unwrap()
            .join("backups.sqlite3");
        for mode in ["write", "read"] {
            let result = std::process::Command::new(std::env::current_exe().unwrap())
                .args([
                    "--exact",
                    "backups::tests::process_driver",
                    "--ignored",
                    "--nocapture",
                ])
                .env("WIMM_BACKUP_TEST_PATH", &path)
                .env("WIMM_BACKUP_TEST_MODE", mode)
                .output()
                .unwrap();
            assert!(
                result.status.success(),
                "{}",
                String::from_utf8_lossy(&result.stderr)
            );
            assert!(String::from_utf8_lossy(&result.stdout).contains("BACKUP_PROCESS_OK"));
        }
    }
    #[test]
    #[ignore = "Unterprozess des nativen Neustarttests; benötigt synthetischen DB-Pfad"]
    fn process_driver() {
        let mut db = Connection::open(std::env::var("WIMM_BACKUP_TEST_PATH").unwrap()).unwrap();
        initialize_backups(&db).unwrap();
        if std::env::var("WIMM_BACKUP_TEST_MODE").unwrap() == "write" {
            persist_backup(&mut db, input()).unwrap();
        }
        assert_eq!(
            read_backup(&db, &input().receipt).unwrap(),
            input().ciphertext
        );
        println!("BACKUP_PROCESS_OK");
    }
}
