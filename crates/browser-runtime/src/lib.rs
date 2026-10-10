// SPDX-License-Identifier: AGPL-3.0-or-later
//! Browser-Plattformadapter auf demselben vollständigen lokalen Rust-DAL; keine eigene Fachengine.
#![forbid(unsafe_code)]
use diesel::SqliteConnection;
use wimm_finance_types::scalars::EntityId;
use wimm_local_contracts::{persistence_errors::*, storage::*, storage_port::LocalStoragePort};
use wimm_local_runtime::RuntimeStorage;
pub struct StorageHost {
    pub(crate) store: RuntimeStorage,
    pub(crate) profile: EntityId,
}
impl StorageHost {
    pub fn from_connection(
        connection: SqliteConnection,
        profile: EntityId,
    ) -> Result<Self, StorageFailure> {
        Ok(Self {
            store: RuntimeStorage::from_connection(connection, profile.clone())?,
            profile,
        })
    }
    pub fn profile(&self) -> &EntityId {
        &self.profile
    }
    pub fn rebuild_projection_cache(&mut self, space: &EntityId) -> Result<(), StorageFailure> {
        let snapshot = self.store.export_snapshot(space)?;
        let projections = wimm_client_application::rebuild_projection_cache(&snapshot)?;
        self.store.rebuild_projections(ProjectionRebuild {
            space_id: space.clone(),
            source_aggregates: snapshot.aggregates,
            projections,
        })
    }
    pub fn port(
        &mut self,
        request: LocalPortRequestV2,
    ) -> Result<LocalPortOutcomeV2, StorageFailure> {
        use LocalPortCommand::*;
        use LocalPortOutcomeV2 as O;
        if request.contract_version != 2 {
            return Err(StorageFailure::not_committed(
                StorageFailureCode::UpdateRequired,
            ));
        }
        wimm_local_contracts::storage_api::check_port(request.clone())
            .map_err(|_| StorageFailure::not_committed(StorageFailureCode::InvalidResponse))?;
        let contract_version = 2;
        Ok(match request.command {
            ReadAggregate { handle } => O::Aggregate {
                contract_version,
                value: self.store.read_aggregate(&handle)?,
            },
            Query { query } => O::Aggregates {
                contract_version,
                value: self.store.query(query)?,
            },
            LoadConfirmed { space_id } => O::Confirmed {
                contract_version,
                value: self.store.load_confirmed(&space_id)?,
            },
            LoadPending { space_id } => O::Pending {
                contract_version,
                value: self.store.load_pending(&space_id)?,
            },
            ExportSnapshot { space_id } => O::Snapshot {
                contract_version,
                value: self.store.export_snapshot(&space_id)?,
            },
            GetSyncState { space_id } => O::SyncState {
                contract_version,
                value: self.store.get_sync_state(&space_id)?,
            },
            InitializeArea {
                space_id,
                proposed_epoch,
            } => O::Initialized {
                contract_version,
                epoch: self.store.initialize_area(&space_id, &proposed_epoch)?,
            },
            ApplyAtomicBatch { batch } => {
                self.store.apply_atomic_batch(batch)?;
                O::Applied { contract_version }
            }
            SaveSyncPage { page } => {
                self.store.save_sync_page(page)?;
                O::Applied { contract_version }
            }
            ReplaceSnapshot { snapshot } => {
                self.store.replace_snapshot(snapshot)?;
                O::Applied { contract_version }
            }
            RebuildProjections { request } => {
                self.store.rebuild_projections(request)?;
                O::Applied { contract_version }
            }
        })
    }
}
#[cfg(target_family = "wasm")]
mod wasm;
