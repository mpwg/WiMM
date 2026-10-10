// SPDX-License-Identifier: AGPL-3.0-or-later
//! Gemeinsame native/WASM-Runtimeports auf demselben profilgebundenen SQLite-DAL.
#![forbid(unsafe_code)]
use std::sync::{Arc, Mutex};
use wimm_client_application::{
    CommitContext,
    recovery::{RecoveryJournalPort, RecoveryTicket},
    runtime::{MutationReadPort, MutationSnapshot},
};
use wimm_local_contracts::{commit::*, persistence_errors::*, storage::*, storage_port::*};
use wimm_local_dal::sqlite::SqliteWriter;
fn error(code: StorageFailureCode) -> StorageFailure {
    StorageFailure::unknown(code)
}
pub use wimm_client_application::CoreSnapshotValidator;
/// Mehrere Portansichten teilen genau einen profilgebundenen DAL, keinen zweiten Finanzwriter.
#[derive(Clone)]
pub struct RuntimeStorage {
    store: Arc<Mutex<SqliteWriter<CoreSnapshotValidator>>>,
    profile: wimm_finance_types::scalars::EntityId,
}
impl RuntimeStorage {
    /// Keine Aktivierung/Migration/Initialisierung beim Öffnen und kein Dateipfad im UI-Port.
    #[cfg(not(target_family = "wasm"))]
    pub fn open(
        path: &std::path::Path,
        profile: wimm_finance_types::scalars::EntityId,
    ) -> Result<Self, StorageFailure> {
        let store = SqliteWriter::open(path, profile.clone(), CoreSnapshotValidator)?;
        Self::from_writer(store, profile)
    }
    /// Diesel-Verbindung und Profil stammen ausschließlich vom jeweiligen Plattformhost.
    pub fn from_connection(
        connection: diesel::SqliteConnection,
        profile: wimm_finance_types::scalars::EntityId,
    ) -> Result<Self, StorageFailure> {
        Self::from_writer(
            SqliteWriter::from_connection(connection, profile.clone(), CoreSnapshotValidator)?,
            profile,
        )
    }
    fn from_writer(
        store: SqliteWriter<CoreSnapshotValidator>,
        profile: wimm_finance_types::scalars::EntityId,
    ) -> Result<Self, StorageFailure> {
        store.ensure_runtime_schema()?;
        Ok(Self {
            store: Arc::new(Mutex::new(store)),
            profile,
        })
    }
}
impl MutationReadPort for RuntimeStorage {
    fn load(&self, context: &CommitContext) -> Result<MutationSnapshot, StorageFailure> {
        if context.profile_id != self.profile {
            return Err(error(StorageFailureCode::EpochMismatch));
        }
        let (snapshot, local_epoch) = self
            .store
            .lock()
            .map_err(|_| error(StorageFailureCode::ResourceUnavailable))?
            .mutation_snapshot(&context.space_id)?;
        let mut actual = context.clone();
        actual.profile_id = snapshot.profile_id;
        actual.space_id = snapshot.space_id;
        actual.epoch = local_epoch;
        Ok(MutationSnapshot {
            context: actual,
            aggregates: snapshot
                .aggregates
                .into_iter()
                .map(|a| a.aggregate)
                .collect(),
        })
    }
}
impl LocalCommitPort for RuntimeStorage {
    fn commit(&mut self, request: LocalCommitRequest) -> LocalCommitOutcome {
        self.commit_cancellable(request, &NeverCancel)
    }
    fn lookup_result(
        &self,
        id: &LocalOperationIdentity,
    ) -> Result<Option<LocalCommitReceipt>, StorageFailure> {
        self.store
            .lock()
            .map_err(|_| error(StorageFailureCode::ResourceUnavailable))?
            .lookup_result(id)
    }
}
impl CancellableLocalCommitPort for RuntimeStorage {
    fn commit_cancellable(
        &mut self,
        request: LocalCommitRequest,
        cancel: &dyn CancellationPort,
    ) -> LocalCommitOutcome {
        match self.store.lock() {
            Ok(mut store) => store.commit_cancellable(request, cancel),
            Err(_) => LocalCommitOutcome::Unknown {
                identity: request.identity,
            },
        }
    }
}
impl RecoveryJournalPort for RuntimeStorage {
    fn load(&self) -> Result<Option<RecoveryTicket>, StorageFailure> {
        let bytes = self
            .store
            .lock()
            .map_err(|_| error(StorageFailureCode::ResourceUnavailable))?
            .load_recovery()?;
        bytes
            .map(|bytes| {
                let ticket: RecoveryTicket = serde_json::from_slice(&bytes)
                    .map_err(|_| error(StorageFailureCode::InvalidResponse))?;
                if ticket.context().profile_id != self.profile {
                    return Err(error(StorageFailureCode::InvalidResponse));
                }
                Ok(ticket)
            })
            .transpose()
    }
    fn save_if_absent(&mut self, ticket: &RecoveryTicket) -> Result<(), StorageFailure> {
        if ticket.context().profile_id != self.profile {
            return Err(StorageFailure::not_committed(
                StorageFailureCode::EpochMismatch,
            ));
        }
        let bytes =
            serde_json::to_vec(ticket).map_err(|_| error(StorageFailureCode::InvalidResponse))?;
        self.store
            .lock()
            .map_err(|_| error(StorageFailureCode::ResourceUnavailable))?
            .save_recovery_if_absent(&bytes)
    }
    fn clear(&mut self, expected: &RecoveryTicket) -> Result<(), StorageFailure> {
        if expected.context().profile_id != self.profile {
            return Err(error(StorageFailureCode::EpochMismatch));
        }
        let bytes =
            serde_json::to_vec(expected).map_err(|_| error(StorageFailureCode::InvalidResponse))?;
        self.store
            .lock()
            .map_err(|_| error(StorageFailureCode::ResourceUnavailable))?
            .clear_recovery(&bytes)
    }
}
/// Bereits entsperrter Schlüssel stammt vom Client-Keyport; niemals Erzeugung/Fallback im Speicherhost.
pub struct RuntimeProtection {
    key: wimm_client_crypto::SecretKey,
}
impl RuntimeProtection {
    pub fn new(key: wimm_client_crypto::SecretKey) -> Self {
        Self { key }
    }
}
impl SnapshotProtectionPort<LocalCommitRequest> for RuntimeProtection {
    type Error = StorageFailure;
    fn seal(&self, request: LocalCommitRequest) -> Result<Vec<u8>, StorageFailure> {
        let clear =
            serde_json::to_vec(&request).map_err(|_| error(StorageFailureCode::InvalidResponse))?;
        let sealed =
            wimm_client_crypto::encrypt(&self.key, b"wimm/local/application-recovery/v1", &clear)
                .map_err(|_| error(StorageFailureCode::WriteFailed))?;
        serde_json::to_vec(
            &serde_json::json!({"nonce":sealed.nonce,"ciphertext":sealed.ciphertext}),
        )
        .map_err(|_| error(StorageFailureCode::WriteFailed))
    }
    fn unseal(&self, bytes: &[u8]) -> Result<LocalCommitRequest, StorageFailure> {
        #[derive(serde::Deserialize)]
        #[serde(deny_unknown_fields)]
        struct Boxed {
            nonce: Vec<u8>,
            ciphertext: Vec<u8>,
        }
        let boxed: Boxed = serde_json::from_slice(bytes)
            .map_err(|_| error(StorageFailureCode::InvalidResponse))?;
        let clear = wimm_client_crypto::decrypt(
            &self.key,
            &boxed.nonce,
            b"wimm/local/application-recovery/v1",
            &boxed.ciphertext,
        )
        .map_err(|_| error(StorageFailureCode::InvalidResponse))?;
        serde_json::from_slice(&clear).map_err(|_| error(StorageFailureCode::InvalidResponse))
    }
}

impl RuntimeProtection {
    fn seal_snapshot<T: serde::Serialize>(&self, value: &T) -> Result<Vec<u8>, StorageFailure> {
        let clear =
            serde_json::to_vec(value).map_err(|_| error(StorageFailureCode::InvalidResponse))?;
        wimm_client_crypto::vault::seal_snapshot(&self.key, &clear)
            .map_err(|_| error(StorageFailureCode::WriteFailed))
    }
    fn open_snapshot<T: serde::de::DeserializeOwned>(
        &self,
        bytes: &[u8],
    ) -> Result<T, StorageFailure> {
        let clear = wimm_client_crypto::vault::open_snapshot(&self.key, bytes)
            .map_err(|_| error(StorageFailureCode::InvalidResponse))?;
        serde_json::from_slice(&clear).map_err(|_| error(StorageFailureCode::InvalidResponse))
    }
}
impl SnapshotProtectionPort<LocalSnapshot> for RuntimeProtection {
    type Error = StorageFailure;
    fn seal(&self, value: LocalSnapshot) -> Result<Vec<u8>, StorageFailure> {
        self.seal_snapshot(&value)
    }
    fn unseal(&self, bytes: &[u8]) -> Result<LocalSnapshot, StorageFailure> {
        self.open_snapshot(bytes)
    }
}
impl SnapshotProtectionPort<wimm_local_contracts::checkpoint_v2::LocalCheckpointV2>
    for RuntimeProtection
{
    type Error = StorageFailure;
    fn seal(
        &self,
        value: wimm_local_contracts::checkpoint_v2::LocalCheckpointV2,
    ) -> Result<Vec<u8>, StorageFailure> {
        self.seal_snapshot(&value)
    }
    fn unseal(
        &self,
        bytes: &[u8],
    ) -> Result<wimm_local_contracts::checkpoint_v2::LocalCheckpointV2, StorageFailure> {
        self.open_snapshot(bytes)
    }
}
#[cfg(all(test, not(target_family = "wasm")))]
mod tests;
impl wimm_local_contracts::index_ports::LocalIndexQueryPort for RuntimeStorage {
    fn query_transactions(
        &self,
        query: wimm_local_contracts::index_ports::TransactionIndexQuery,
    ) -> Result<Vec<StoredAggregate>, StorageFailure> {
        self.store
            .lock()
            .map_err(|_| error(StorageFailureCode::ResourceUnavailable))?
            .query_transactions(query)
    }
    fn query_pending(
        &self,
        query: wimm_local_contracts::index_ports::PendingIndexQuery,
    ) -> Result<Vec<PendingOperation>, StorageFailure> {
        self.store
            .lock()
            .map_err(|_| error(StorageFailureCode::ResourceUnavailable))?
            .query_pending(query)
    }
    fn query_imported(
        &self,
        query: wimm_local_contracts::index_ports::ImportSourceQuery,
    ) -> Result<Vec<StoredAggregate>, StorageFailure> {
        self.store
            .lock()
            .map_err(|_| error(StorageFailureCode::ResourceUnavailable))?
            .query_imported(query)
    }
}

impl LocalStoragePort for RuntimeStorage {
    type Error = StorageFailure;
    fn read_aggregate(
        &self,
        handle: &wimm_finance_types::scalars::EntityId,
    ) -> Result<Option<StoredAggregate>, StorageFailure> {
        self.store
            .lock()
            .map_err(|_| error(StorageFailureCode::ResourceUnavailable))?
            .read_aggregate(handle)
    }
    fn query(&self, query: AggregateQuery) -> Result<Vec<StoredAggregate>, StorageFailure> {
        self.store
            .lock()
            .map_err(|_| error(StorageFailureCode::ResourceUnavailable))?
            .query(query)
    }
    fn apply_atomic_batch(&mut self, batch: AtomicBatch) -> Result<(), StorageFailure> {
        self.store
            .lock()
            .map_err(|_| error(StorageFailureCode::ResourceUnavailable))?
            .apply_atomic_batch(batch)
    }
    fn load_confirmed(
        &self,
        space_id: &wimm_finance_types::scalars::EntityId,
    ) -> Result<Vec<ConfirmedAggregate>, StorageFailure> {
        self.store
            .lock()
            .map_err(|_| error(StorageFailureCode::ResourceUnavailable))?
            .load_confirmed(space_id)
    }
    fn load_pending(
        &self,
        space_id: &wimm_finance_types::scalars::EntityId,
    ) -> Result<Vec<PendingOperation>, StorageFailure> {
        self.store
            .lock()
            .map_err(|_| error(StorageFailureCode::ResourceUnavailable))?
            .load_pending(space_id)
    }
    fn save_sync_page(&mut self, page: SyncPage) -> Result<(), StorageFailure> {
        self.store
            .lock()
            .map_err(|_| error(StorageFailureCode::ResourceUnavailable))?
            .save_sync_page(page)
    }
    fn export_snapshot(
        &self,
        space_id: &wimm_finance_types::scalars::EntityId,
    ) -> Result<LocalSnapshot, StorageFailure> {
        self.store
            .lock()
            .map_err(|_| error(StorageFailureCode::ResourceUnavailable))?
            .export_snapshot(space_id)
    }
    fn replace_snapshot(&mut self, snapshot: LocalSnapshot) -> Result<(), StorageFailure> {
        self.store
            .lock()
            .map_err(|_| error(StorageFailureCode::ResourceUnavailable))?
            .replace_snapshot(snapshot)
    }
    fn rebuild_projections(&mut self, request: ProjectionRebuild) -> Result<(), StorageFailure> {
        self.store
            .lock()
            .map_err(|_| error(StorageFailureCode::ResourceUnavailable))?
            .rebuild_projections(request)
    }
    fn get_sync_state(
        &self,
        space_id: &wimm_finance_types::scalars::EntityId,
    ) -> Result<Option<SyncState>, StorageFailure> {
        self.store
            .lock()
            .map_err(|_| error(StorageFailureCode::ResourceUnavailable))?
            .get_sync_state(space_id)
    }
    fn initialize_area(
        &mut self,
        space_id: &wimm_finance_types::scalars::EntityId,
        proposed_epoch: &wimm_finance_types::scalars::EntityId,
    ) -> Result<wimm_finance_types::scalars::EntityId, StorageFailure> {
        self.store
            .lock()
            .map_err(|_| error(StorageFailureCode::ResourceUnavailable))?
            .initialize_area(space_id, proposed_epoch)
    }
}

/// Zustandsbehaftete Anwendung nutzt dieselbe Verbindung für Lesen, Receipts und Originaljournal.
pub struct RuntimeSession {
    context: CommitContext,
    runtime: wimm_client_application::runtime::ClientRuntime,
    storage: RuntimeStorage,
    protection: RuntimeProtection,
}
struct CurrentScope(CommitContext);
impl wimm_client_application::dispatch::CommitContextPort for CurrentScope {
    fn current(&self) -> CommitContext {
        self.0.clone()
    }
}
impl RuntimeSession {
    pub fn new(
        context: CommitContext,
        mode: wimm_client_application::AreaMode,
        storage: RuntimeStorage,
        protection: RuntimeProtection,
    ) -> Result<Self, StorageFailure> {
        if context.profile_id != storage.profile {
            return Err(StorageFailure::not_committed(
                StorageFailureCode::EpochMismatch,
            ));
        }
        Ok(Self {
            runtime: wimm_client_application::runtime::ClientRuntime::new(context.clone(), mode),
            context,
            storage,
            protection,
        })
    }
    fn event(
        &self,
        result: wimm_client_application::runtime_contracts::RuntimeResultV2,
    ) -> wimm_client_application::runtime_contracts::RuntimeEventV2 {
        let (can_undo, can_redo) = self.runtime.history_available();
        wimm_client_application::runtime_contracts::RuntimeEventV2 {
            contract_version: 2,
            context: self.context.clone(),
            can_undo,
            can_redo,
            result,
        }
    }
    pub fn invoke(
        &mut self,
        request: wimm_client_application::runtime_contracts::RuntimeRequestV2,
    ) -> wimm_client_application::runtime_contracts::RuntimeEventV2 {
        use wimm_client_application::{runtime::RuntimePorts, runtime_contracts::*};
        if request.contract_version != 2 || request.domain_schema_version != 1 {
            return self.event(RuntimeResultV2::Rejected {
                code: wimm_client_application::api::ApplicationFailureCode::UpdateRequired,
                finance_code: None,
            });
        }
        let actual = match MutationReadPort::load(&self.storage, &self.context) {
            Ok(snapshot) => snapshot.context,
            Err(error) => return self.event(RuntimeResultV2::ReadFailed { error }),
        };
        let scope = CurrentScope(actual);
        let reader = self.storage.clone();
        let mut writer = self.storage.clone();
        let mut journal = self.storage.clone();
        let mut ports = RuntimePorts {
            reader: &reader,
            storage: &mut writer,
            journal: &mut journal,
            protection: &self.protection,
            scope: &scope,
            cancellation: &NeverCancel,
        };
        let outcome = match request.action {
            RuntimeActionV2::Load => self.runtime.load(&ports),
            RuntimeActionV2::Execute {
                command,
                expected_revisions,
                operation,
            } => self
                .runtime
                .execute(command, expected_revisions, operation, &mut ports),
            RuntimeActionV2::History {
                direction,
                operation,
            } => self.runtime.move_history(direction, operation, &mut ports),
            RuntimeActionV2::Resolve => self.runtime.resolve(&mut ports),
        };
        self.event(outcome.into())
    }
    pub fn page(
        &self,
        offset: u32,
        limit: u32,
    ) -> Result<wimm_client_application::runtime_contracts::RuntimePageV2, StorageFailure> {
        let actual = MutationReadPort::load(&self.storage, &self.context)?.context;
        let aggregates = self
            .runtime
            .page(&CurrentScope(actual), offset as usize, limit as usize)
            .map_err(|failure| {
                StorageFailure::not_committed(match failure {
                    wimm_client_application::PreparationFailure::ScopeChanged => {
                        StorageFailureCode::EpochMismatch
                    }
                    _ => StorageFailureCode::InvalidResponse,
                })
            })?;
        Ok(wimm_client_application::runtime_contracts::RuntimePageV2 {
            contract_version: 2,
            context: self.context.clone(),
            offset,
            aggregates,
        })
    }
}

/// Pro Client getrennte Schlüsselsitzung/Historie auf derselben SQLite-Verbindung.
#[derive(Default)]
pub struct RuntimeSessions {
    sessions: std::collections::BTreeMap<wimm_finance_types::scalars::EntityId, RuntimeSession>,
}
impl RuntimeSessions {
    pub fn insert(
        &mut self,
        id: wimm_finance_types::scalars::EntityId,
        session: RuntimeSession,
    ) -> Result<(), StorageFailure> {
        if self.sessions.contains_key(&id) || self.sessions.len() >= 16 {
            return Err(StorageFailure::not_committed(
                StorageFailureCode::ResourceUnavailable,
            ));
        }
        self.sessions.insert(id, session);
        Ok(())
    }
    pub fn contains_key(&self, id: &wimm_finance_types::scalars::EntityId) -> bool {
        self.sessions.contains_key(id)
    }
    pub fn is_full(&self) -> bool {
        self.sessions.len() >= 16
    }
    pub fn get(&self, id: &wimm_finance_types::scalars::EntityId) -> Option<&RuntimeSession> {
        self.sessions.get(id)
    }
    pub fn get_mut(
        &mut self,
        id: &wimm_finance_types::scalars::EntityId,
    ) -> Option<&mut RuntimeSession> {
        self.sessions.get_mut(id)
    }
    pub fn remove(&mut self, id: &wimm_finance_types::scalars::EntityId) {
        self.sessions.remove(id);
    }
    pub fn clear(&mut self) {
        self.sessions.clear();
    }
}
