// SPDX-License-Identifier: AGPL-3.0-or-later
//! Separater lokaler Chiffratspeicher: kein SQL-/Pfadport und kein Finanzklartext.
use crate::storage_failure::{StorageFailure, StorageFailureCode, failure};
use serde::Deserialize;
use std::sync::Mutex;
pub use wimm_local_contracts::models::EncryptedBackupReceipt as BackupReceipt;

pub struct BackupState(pub Mutex<wimm_local_dal::sqlite_backup::SqliteBackupStore>);

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct BackupInput {
    pub receipt: BackupReceipt,
    pub ciphertext: Vec<u8>,
}

pub trait EncryptedBackupReader {
    fn read_ciphertext(&self, receipt: &BackupReceipt) -> Result<Vec<u8>, StorageFailure>;
}
impl EncryptedBackupReader for wimm_local_dal::sqlite_backup::SqliteBackupStore {
    fn read_ciphertext(&self, receipt: &BackupReceipt) -> Result<Vec<u8>, StorageFailure> {
        self.read(receipt)
    }
}
#[tauri::command]
pub fn storage_persist_encrypted_backup(
    state: tauri::State<'_, BackupState>,
    input: BackupInput,
) -> Result<BackupReceipt, StorageFailure> {
    state
        .0
        .lock()
        .map_err(|_| failure(StorageFailureCode::ResourceUnavailable))?
        .persist(input.receipt.clone(), &input.ciphertext)?;
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
