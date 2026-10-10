// SPDX-License-Identifier: AGPL-3.0-or-later
//! Registrierte Vorwärtsschritte; Sicherung und vollständiger Ausgangsstand vor DDL.
use crate::backups::{BackupReceipt, BackupState, EncryptedBackupReader};
use crate::storage_failure::{StorageFailure, StorageFailureCode, failure};
use serde::{Deserialize, Serialize};
use std::{
    collections::HashMap,
    sync::{
        Arc, Mutex,
        atomic::{AtomicBool, Ordering},
    },
};
use tauri::Manager;
use wimm_finance_types::scalars::EntityId;
use wimm_local_contracts::{models::StorageMigrationPlan, storage::LocalSnapshot};
#[derive(Default)]
pub struct MigrationCancellationState(pub Mutex<HashMap<String, Arc<AtomicBool>>>);

#[derive(Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct MigrationInput {
    plan: StorageMigrationPlan,
    expected_snapshot: LocalSnapshot,
    snapshot_bytes: Vec<u8>,
    backup: BackupReceipt,
}

// Nur abgeleitete lokale Indizes; keine Finanzpayloads, Entwürfe oder Epochen ändern.
pub(crate) fn migrate_orm(
    state: &crate::orm_storage::OrmStorageState,
    backups: &dyn EncryptedBackupReader,
    input: MigrationInput,
    cancelled: impl Fn() -> bool,
) -> Result<(), StorageFailure> {
    struct Cancel<F>(F);
    impl<F: Fn() -> bool> wimm_local_contracts::storage_port::CancellationPort for Cancel<F> {
        fn is_cancelled(&self) -> bool {
            (self.0)()
        }
    }
    let profile = input.backup.profile_id.as_str().to_owned();
    let backup = input.backup;
    state.with_profile(&profile, |dal| {
        dal.migrate_legacy_indexes(
            wimm_local_contracts::ports::LocalMigrationRequest {
                plan: input.plan,
                expected_snapshot: input.expected_snapshot,
                backup: Some(backup.clone()),
            },
            &input.snapshot_bytes,
            &|_| backups.read_ciphertext(&backup),
            &Cancel(cancelled),
        )
    })
}

#[tauri::command]
pub async fn storage_migrate(
    app: tauri::AppHandle,
    migration_id: EntityId,
    input: MigrationInput,
) -> Result<(), StorageFailure> {
    let migration_id = migration_id.as_str().to_owned();
    let flag = Arc::new(AtomicBool::new(false));
    {
        let registry = app.state::<MigrationCancellationState>();
        let mut entries = registry
            .0
            .lock()
            .map_err(|_| failure(StorageFailureCode::ResourceUnavailable))?;
        if entries.contains_key(&migration_id) {
            return Err(failure(StorageFailureCode::OperationIdReused));
        }
        entries.insert(migration_id.clone(), flag.clone());
    }
    let worker_app = app.clone();
    let result = tauri::async_runtime::spawn_blocking(move || {
        let backup_state = worker_app.state::<BackupState>();
        let backup_connection = backup_state
            .0
            .lock()
            .map_err(|_| failure(StorageFailureCode::ResourceUnavailable))?;
        let storage_state = worker_app.state::<crate::orm_storage::OrmStorageState>();
        migrate_orm(&storage_state, &*backup_connection, input, || {
            flag.load(Ordering::Acquire)
        })
    })
    .await;
    app.state::<MigrationCancellationState>()
        .0
        .lock()
        .map_err(|_| StorageFailure::unknown(StorageFailureCode::ResourceUnavailable))?
        .remove(&migration_id);
    result.map_err(|_| StorageFailure::unknown(StorageFailureCode::CommitUnknown))?
}
#[tauri::command]
pub fn storage_cancel_migration(
    state: tauri::State<'_, MigrationCancellationState>,
    migration_id: EntityId,
) -> Result<(), StorageFailure> {
    let migration_id = migration_id.as_str().to_owned();
    if let Some(flag) = state
        .0
        .lock()
        .map_err(|_| failure(StorageFailureCode::ResourceUnavailable))?
        .get(&migration_id)
    {
        flag.store(true, Ordering::Release);
    }
    Ok(())
}
