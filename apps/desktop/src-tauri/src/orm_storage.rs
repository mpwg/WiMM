// SPDX-License-Identifier: AGPL-3.0-or-later
//! Vorbereiteter vollständiger Tauri-Kommandokatalog auf dem gemeinsamen ORM-DAL.
use crate::runtime_storage::CoreSnapshotValidator;
use std::{
    collections::BTreeMap,
    path::{Path, PathBuf},
    sync::Mutex,
};
use wimm_finance_types::scalars::EntityId;
use wimm_local_contracts::{persistence_errors::*, storage::*, storage_port::LocalStoragePort};
use wimm_local_dal::legacy_sqlite::{LegacySqliteStore, LegacySqliteWriter};
fn invalid() -> StorageFailure {
    StorageFailure::not_committed(StorageFailureCode::WriteFailed)
}
/// Datei liegt im vertrauenswürdigen App-Datenverzeichnis, niemals in einem UI-Kommandoparameter.
pub struct OrmStorageState {
    path: PathBuf,
    profiles: Mutex<BTreeMap<String, LegacySqliteWriter<CoreSnapshotValidator>>>,
}
impl OrmStorageState {
    pub fn open_existing(path: &Path) -> Result<Self, StorageFailure> {
        if !path.is_file() {
            return Err(StorageFailure::not_committed(
                StorageFailureCode::ResourceUnavailable,
            ));
        }
        Ok(Self {
            path: path.into(),
            profiles: Mutex::new(BTreeMap::new()),
        })
    }
    pub fn initialize_new(path: &Path) -> Result<Self, StorageFailure> {
        LegacySqliteStore::initialize_empty_file(path)?;
        Self::open_existing(path)
    }
    fn with_profile<T>(
        &self,
        profile: &str,
        run: impl FnOnce(&mut LegacySqliteWriter<CoreSnapshotValidator>) -> Result<T, StorageFailure>,
    ) -> Result<T, StorageFailure> {
        let id = EntityId::new(profile.into()).map_err(|_| invalid())?;
        let mut profiles = self
            .profiles
            .lock()
            .map_err(|_| StorageFailure::unknown(StorageFailureCode::ResourceUnavailable))?;
        if !profiles.contains_key(profile) {
            profiles.insert(
                profile.into(),
                LegacySqliteWriter::open(&self.path, id, CoreSnapshotValidator).map_err(|e| {
                    if e.code == StorageFailureCode::UpdateRequired {
                        StorageFailure::not_committed(e.code)
                    } else {
                        e
                    }
                })?,
            );
        }
        run(profiles.get_mut(profile).ok_or_else(invalid)?).map_err(|e| {
            if e.code == StorageFailureCode::UpdateRequired {
                StorageFailure::not_committed(e.code)
            } else {
                e
            }
        })
    }
}
#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct StorageBatch {
    profile_id: EntityId,
    expected_revisions: Vec<RevisionExpectation>,
    aggregates: Vec<StoredAggregate>,
    outbox: Vec<PendingOperation>,
    projections: Vec<ProjectionInput>,
}
#[derive(serde::Deserialize)]
#[serde(untagged)]
pub enum ProjectionInput {
    Known(StoredProjection),
    Legacy(wimm_local_dal::legacy_sqlite::LegacyProjection),
}
#[tauri::command(rename = "storage_apply_batch")]
pub fn orm_storage_apply_batch(
    state: tauri::State<'_, OrmStorageState>,
    batch: StorageBatch,
) -> Result<(), StorageFailure> {
    state.with_profile(batch.profile_id.as_str(), |p| {
        let mut projections = Vec::new();
        let mut legacy = Vec::new();
        for value in batch.projections {
            match value {
                ProjectionInput::Known(v) => projections.push(v),
                ProjectionInput::Legacy(v) => legacy.push(v),
            }
        }
        p.apply_legacy_projection_batch(
            AtomicBatch {
                expected_revisions: batch.expected_revisions,
                aggregates: batch.aggregates,
                outbox: batch.outbox,
                projections,
            },
            legacy,
        )
    })
}
#[tauri::command(rename = "storage_initialize_area")]
pub fn orm_storage_initialize_area(
    state: tauri::State<'_, OrmStorageState>,
    profile_id: String,
    space_id: EntityId,
    proposed_epoch: EntityId,
) -> Result<EntityId, StorageFailure> {
    state.with_profile(&profile_id, |p| {
        p.initialize_area(&space_id, &proposed_epoch)
    })
}
#[tauri::command(rename = "storage_read_aggregate")]
pub fn orm_storage_read_aggregate(
    state: tauri::State<'_, OrmStorageState>,
    profile_id: String,
    handle: EntityId,
) -> Result<Option<StoredAggregate>, StorageFailure> {
    state.with_profile(&profile_id, |p| p.read_aggregate(&handle))
}
#[tauri::command(rename = "storage_query_aggregates")]
pub fn orm_storage_query_aggregates(
    state: tauri::State<'_, OrmStorageState>,
    profile_id: String,
    space_id: EntityId,
) -> Result<Vec<StoredAggregate>, StorageFailure> {
    state.with_profile(&profile_id, |p| p.query(AggregateQuery { space_id }))
}
#[tauri::command(rename = "storage_load_confirmed")]
pub fn orm_storage_load_confirmed(
    state: tauri::State<'_, OrmStorageState>,
    profile_id: String,
    space_id: EntityId,
) -> Result<Vec<ConfirmedAggregate>, StorageFailure> {
    state.with_profile(&profile_id, |p| p.load_confirmed(&space_id))
}
#[tauri::command(rename = "storage_load_pending")]
pub fn orm_storage_load_pending(
    state: tauri::State<'_, OrmStorageState>,
    profile_id: String,
    space_id: EntityId,
) -> Result<Vec<PendingOperation>, StorageFailure> {
    state.with_profile(&profile_id, |p| p.load_pending(&space_id))
}
#[tauri::command(rename = "storage_get_sync_state")]
pub fn orm_storage_get_sync_state(
    state: tauri::State<'_, OrmStorageState>,
    profile_id: String,
    space_id: EntityId,
) -> Result<Option<SyncState>, StorageFailure> {
    state.with_profile(&profile_id, |p| p.get_sync_state(&space_id))
}
#[tauri::command(rename = "storage_save_sync_page")]
pub fn orm_storage_save_sync_page(
    state: tauri::State<'_, OrmStorageState>,
    profile_id: String,
    page: SyncPage,
) -> Result<(), StorageFailure> {
    state.with_profile(&profile_id, |p| p.save_sync_page(page))
}
#[tauri::command(rename = "storage_export_snapshot")]
pub fn orm_storage_export_snapshot(
    state: tauri::State<'_, OrmStorageState>,
    profile_id: String,
    space_id: EntityId,
) -> Result<serde_json::Value, StorageFailure> {
    state.with_profile(&profile_id, |p| Ok(p.export_legacy_snapshot(&space_id)?.0))
}
#[tauri::command(rename = "storage_replace_snapshot")]
pub fn orm_storage_replace_snapshot(
    state: tauri::State<'_, OrmStorageState>,
    profile_id: String,
    snapshot: LocalSnapshot,
) -> Result<(), StorageFailure> {
    state.with_profile(&profile_id, |p| p.replace_snapshot(snapshot))
}
#[tauri::command(rename = "storage_rebuild_projections")]
pub fn orm_storage_rebuild_projections(
    state: tauri::State<'_, OrmStorageState>,
    profile_id: String,
    rebuild: ProjectionRebuild,
) -> Result<(), StorageFailure> {
    state.with_profile(&profile_id, |p| p.rebuild_projections(rebuild))
}
#[cfg(test)]
mod tests;
#[tauri::command(rename = "storage_query_indexed_transactions")]
pub fn orm_storage_query_indexed_transactions(
    state: tauri::State<'_, OrmStorageState>,
    profile_id: String,
    query: wimm_local_contracts::index_ports::TransactionIndexQuery,
) -> Result<Vec<StoredAggregate>, StorageFailure> {
    use wimm_local_contracts::index_ports::LocalIndexQueryPort;
    state.with_profile(&profile_id, |p| p.query_transactions(query))
}
#[tauri::command(rename = "storage_query_indexed_pending")]
pub fn orm_storage_query_indexed_pending(
    state: tauri::State<'_, OrmStorageState>,
    profile_id: String,
    query: wimm_local_contracts::index_ports::PendingIndexQuery,
) -> Result<Vec<PendingOperation>, StorageFailure> {
    use wimm_local_contracts::index_ports::LocalIndexQueryPort;
    state.with_profile(&profile_id, |p| p.query_pending(query))
}
#[tauri::command(rename = "storage_query_imported_transactions")]
pub fn orm_storage_query_imported_transactions(
    state: tauri::State<'_, OrmStorageState>,
    profile_id: String,
    query: wimm_local_contracts::index_ports::ImportSourceQuery,
) -> Result<Vec<StoredAggregate>, StorageFailure> {
    use wimm_local_contracts::index_ports::LocalIndexQueryPort;
    state.with_profile(&profile_id, |p| p.query_imported(query))
}
