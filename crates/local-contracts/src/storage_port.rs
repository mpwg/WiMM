// SPDX-License-Identifier: AGPL-3.0-or-later
//! Typisierte lokale Ports; keine Adapter/ORMimplementierung im Vertragscrate.
use crate::storage::*;
use wimm_finance_types::scalars::EntityId;
pub trait LocalStoragePort {
    type Error;
    fn read_aggregate(&self, handle: &EntityId) -> Result<Option<StoredAggregate>, Self::Error>;
    fn query(&self, query: AggregateQuery) -> Result<Vec<StoredAggregate>, Self::Error>;
    fn apply_atomic_batch(&mut self, batch: AtomicBatch) -> Result<(), Self::Error>;
    fn load_confirmed(&self, space_id: &EntityId) -> Result<Vec<ConfirmedAggregate>, Self::Error>;
    fn load_pending(&self, space_id: &EntityId) -> Result<Vec<PendingOperation>, Self::Error>;
    fn save_sync_page(&mut self, page: SyncPage) -> Result<(), Self::Error>;
    fn export_snapshot(&self, space_id: &EntityId) -> Result<LocalSnapshot, Self::Error>;
    fn replace_snapshot(&mut self, snapshot: LocalSnapshot) -> Result<(), Self::Error>;
    fn rebuild_projections(&mut self, request: ProjectionRebuild) -> Result<(), Self::Error>;
    fn get_sync_state(&self, space_id: &EntityId) -> Result<Option<SyncState>, Self::Error>;
    fn initialize_area(
        &mut self,
        space_id: &EntityId,
        proposed_epoch: &EntityId,
    ) -> Result<EntityId, Self::Error>;
}
pub trait CancellationPort {
    fn is_cancelled(&self) -> bool;
}
pub trait SnapshotProtectionPort<S = LocalSnapshot> {
    type Error;
    fn seal(&self, snapshot: S) -> Result<Vec<u8>, Self::Error>;
    fn unseal(&self, bytes: &[u8]) -> Result<S, Self::Error>;
}
pub trait BackupPort {
    type Error;
    fn persist(
        &self,
        request: crate::ports::EncryptedBackupRequest,
    ) -> Result<crate::models::EncryptedBackupReceipt, Self::Error>;
}
pub trait MigrationPort {
    type Error;
    fn migrate(
        &mut self,
        request: crate::ports::LocalMigrationRequest,
        cancellation: &dyn CancellationPort,
    ) -> Result<(), Self::Error>;
}
pub trait ProfileStorePort {
    type Error;
    fn load(&self) -> Result<crate::ports::ProfileLoadOutcome, Self::Error>;
    fn change(
        &mut self,
        expected_revision: crate::scalars::LocalRevision,
        profile: LegacyJson,
    ) -> Result<LegacyJson, Self::Error>;
}

/// Rücklesen bestätigt die tatsächliche Speicherung des verschlüsselten Originals.
pub trait BackupReadPort: BackupPort {
    fn read(&self, receipt: &crate::models::EncryptedBackupReceipt)
    -> Result<Vec<u8>, Self::Error>;
}
pub struct NeverCancel;
impl CancellationPort for NeverCancel {
    fn is_cancelled(&self) -> bool {
        false
    }
}
