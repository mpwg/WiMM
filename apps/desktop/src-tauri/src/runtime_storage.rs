// SPDX-License-Identifier: AGPL-3.0-or-later
//! Konkrete native Runtimeports; Produktaktivierung erfolgt erst mit geprüfter Tauri-Umschaltung.
use std::{
    path::Path,
    sync::{Arc, Mutex},
};
use wimm_client_application::{
    CommitContext,
    recovery::{RecoveryJournalPort, RecoveryTicket},
    runtime::{MutationReadPort, MutationSnapshot},
};
use wimm_finance_core::{projection_cache, validate};
use wimm_local_contracts::{commit::*, persistence_errors::*, storage::*, storage_port::*};
use wimm_local_dal::sqlite::SqliteWriter;
fn error(code: StorageFailureCode) -> StorageFailure {
    StorageFailure::unknown(code)
}
pub struct CoreSnapshotValidator;
impl SnapshotValidationPort for CoreSnapshotValidator {
    fn validate(&self, s: &LocalSnapshot) -> Result<(), StorageFailure> {
        // Die Fach-/Cacheengine bleibt ausschließlich im Rust-Fachkern.
        let invalid = || StorageFailure::not_committed(StorageFailureCode::WriteFailed);
        for aggregates in [
            s.aggregates.iter().map(|a| a.aggregate.clone()).collect(),
            s.confirmed
                .iter()
                .map(|a| a.aggregate.aggregate.clone())
                .collect(),
        ] {
            validate(
                wimm_finance_types::state_contracts::ValidationRequest::Historical {
                    contract_version: 1.into(),
                    domain_schema_version: 1.into(),
                    space_id: s.space_id.clone(),
                    aggregates,
                },
            )
            .map_err(|_| invalid())?;
        }
        let aggregates = s
            .aggregates
            .iter()
            .map(|a| serde_json::to_value(&a.aggregate))
            .collect::<Result<Vec<_>, _>>()
            .map_err(|_| invalid())?;
        let projections = s
            .projections
            .iter()
            .map(serde_json::to_value)
            .collect::<Result<Vec<_>, _>>()
            .map_err(|_| invalid())?;
        projection_cache::validate(&aggregates, &projections).map_err(|_| invalid())
    }
}
/// Mehrere Portansichten teilen genau einen profilgebundenen DAL, keinen zweiten Finanzwriter.
#[derive(Clone)]
pub struct NativeRuntimeStorage {
    store: Arc<Mutex<SqliteWriter<CoreSnapshotValidator>>>,
    profile: wimm_finance_types::scalars::EntityId,
}
impl NativeRuntimeStorage {
    /// Keine Aktivierung/Migration/Initialisierung beim Öffnen und kein Dateipfad im UI-Port.
    pub fn open(
        path: &Path,
        profile: wimm_finance_types::scalars::EntityId,
    ) -> Result<Self, StorageFailure> {
        let store = SqliteWriter::open(path, profile.clone(), CoreSnapshotValidator)?;
        store.ensure_runtime_schema()?;
        Ok(Self {
            store: Arc::new(Mutex::new(store)),
            profile,
        })
    }
}
impl MutationReadPort for NativeRuntimeStorage {
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
impl LocalCommitPort for NativeRuntimeStorage {
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
impl CancellableLocalCommitPort for NativeRuntimeStorage {
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
impl RecoveryJournalPort for NativeRuntimeStorage {
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
pub struct NativeRuntimeProtection {
    key: wimm_client_crypto::SecretKey,
}
impl NativeRuntimeProtection {
    pub fn new(key: wimm_client_crypto::SecretKey) -> Self {
        Self { key }
    }
}
impl SnapshotProtectionPort<LocalCommitRequest> for NativeRuntimeProtection {
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

impl NativeRuntimeProtection {
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
impl SnapshotProtectionPort<LocalSnapshot> for NativeRuntimeProtection {
    type Error = StorageFailure;
    fn seal(&self, value: LocalSnapshot) -> Result<Vec<u8>, StorageFailure> {
        self.seal_snapshot(&value)
    }
    fn unseal(&self, bytes: &[u8]) -> Result<LocalSnapshot, StorageFailure> {
        self.open_snapshot(bytes)
    }
}
impl SnapshotProtectionPort<wimm_local_contracts::checkpoint_v2::LocalCheckpointV2>
    for NativeRuntimeProtection
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
#[cfg(test)]
mod tests;
impl wimm_local_contracts::index_ports::LocalIndexQueryPort for NativeRuntimeStorage {
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
