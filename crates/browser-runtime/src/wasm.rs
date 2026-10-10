// SPDX-License-Identifier: AGPL-3.0-or-later
//! Typisierte WASM-Grenze, genau ein OPFS-VFS; kein Memory-/IndexedDB-Fallback.
use super::*;
use diesel::Connection;
use serde::de::DeserializeOwned;
use sqlite_wasm_vfs::sahpool::{OpfsSAHPoolCfgBuilder, OpfsSAHPoolUtil};
use wasm_bindgen::prelude::*;
use wimm_local_contracts::{commit::*, index_ports::*, storage_port::NeverCancel};
use wimm_persistence_contracts::CommitOutcome;
fn failure(code: StorageFailureCode) -> StorageFailure {
    StorageFailure::not_committed(code)
}
fn js_error(error: StorageFailure) -> JsValue {
    tsify::Ts::from_rust(&error)
        .expect("Statische strukturierte Fehlerhülle")
        .js_value()
}
fn decode<T: tsify::Tsify + DeserializeOwned>(input: tsify::Ts<T>) -> Result<T, JsValue> {
    let raw = input.js_value();
    if !wimm_contract_primitives::wasm_data::check(&raw) {
        return Err(js_error(failure(StorageFailureCode::InvalidResponse)));
    }
    let json = js_sys::JSON::stringify(&raw)
        .map_err(|_| js_error(failure(StorageFailureCode::InvalidResponse)))?
        .as_string()
        .ok_or_else(|| js_error(failure(StorageFailureCode::InvalidResponse)))?;
    serde_json::from_str(&json).map_err(|_| js_error(failure(StorageFailureCode::InvalidResponse)))
}
fn output<T: tsify::Tsify + serde::Serialize>(value: &T) -> Result<tsify::Ts<T>, JsValue> {
    tsify::Ts::from_rust(value)
        .map_err(|_| js_error(StorageFailure::unknown(StorageFailureCode::InvalidResponse)))
}
#[derive(serde::Serialize, serde::Deserialize, tsify::Tsify)]
#[serde(
    tag = "status",
    rename_all = "camelCase",
    rename_all_fields = "camelCase",
    deny_unknown_fields
)]
pub enum BrowserCommitOutcome {
    Committed { value: LocalCommitReceipt },
    NotCommitted { error: StorageFailure },
    Unknown { identity: LocalOperationIdentity },
}
#[derive(serde::Serialize, serde::Deserialize, tsify::Tsify)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct BrowserReceiptLookup {
    contract_version: u32,
    receipt: Option<LocalCommitReceipt>,
}
#[derive(serde::Serialize, serde::Deserialize, tsify::Tsify)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct BrowserBackupInput {
    receipt: wimm_local_contracts::models::EncryptedBackupReceipt,
    ciphertext: Vec<u8>,
}
#[derive(serde::Serialize, serde::Deserialize, tsify::Tsify)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct BrowserCiphertext {
    contract_version: u32,
    ciphertext: Vec<u8>,
}
#[derive(serde::Serialize, serde::Deserialize, tsify::Tsify)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct BrowserRuntimeOpen {
    #[serde(deserialize_with = "wimm_contract_primitives::unsigned32")]
    contract_version: u32,
    context: wimm_client_application::CommitContext,
    mode: wimm_client_application::AreaMode,
    key: Vec<u8>,
}
#[derive(serde::Serialize, serde::Deserialize, tsify::Tsify)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct BrowserRuntimePage {
    #[serde(deserialize_with = "wimm_contract_primitives::unsigned32")]
    offset: u32,
    #[serde(deserialize_with = "wimm_contract_primitives::unsigned32")]
    limit: u32,
}
#[wasm_bindgen]
pub struct BrowserStorage {
    host: Option<StorageHost>,
    application: Option<wimm_local_runtime::RuntimeSession>,
    pool: OpfsSAHPoolUtil,
    backups: Option<wimm_local_dal::sqlite_backup::SqliteBackupStore>,
}
#[wasm_bindgen]
impl BrowserStorage {
    pub fn open_runtime(&mut self, input: tsify::Ts<BrowserRuntimeOpen>) -> Result<(), JsValue> {
        let input: BrowserRuntimeOpen = decode(input)?;
        let key = zeroize::Zeroizing::new(input.key);
        if input.contract_version != 2 {
            return Err(js_error(failure(StorageFailureCode::UpdateRequired)));
        }
        if self.application.is_some() {
            return Err(js_error(failure(StorageFailureCode::InvalidResponse)));
        }
        let host = self.host()?;
        if input.context.profile_id != host.profile {
            return Err(js_error(failure(StorageFailureCode::EpochMismatch)));
        }
        let protection = wimm_local_runtime::RuntimeProtection::new(
            wimm_client_crypto::SecretKey::from_bytes(&key)
                .map_err(|_| js_error(failure(StorageFailureCode::InvalidResponse)))?,
        );
        self.application = Some(
            wimm_local_runtime::RuntimeSession::new(
                input.context,
                input.mode,
                host.store.clone(),
                protection,
            )
            .map_err(js_error)?,
        );
        Ok(())
    }
    pub fn runtime(
        &mut self,
        input: tsify::Ts<wimm_client_application::runtime_contracts::RuntimeRequestV2>,
    ) -> Result<tsify::Ts<wimm_client_application::runtime_contracts::RuntimeEventV2>, JsValue>
    {
        let request = decode(input)?;
        let session = self
            .application
            .as_mut()
            .ok_or_else(|| js_error(failure(StorageFailureCode::ResourceUnavailable)))?;
        output(&session.invoke(request))
    }
    pub fn runtime_page(
        &self,
        input: tsify::Ts<BrowserRuntimePage>,
    ) -> Result<tsify::Ts<wimm_client_application::runtime_contracts::RuntimePageV2>, JsValue> {
        let input: BrowserRuntimePage = decode(input)?;
        let session = self
            .application
            .as_ref()
            .ok_or_else(|| js_error(failure(StorageFailureCode::ResourceUnavailable)))?;
        output(&session.page(input.offset, input.limit).map_err(js_error)?)
    }
    pub fn close_runtime(&mut self) {
        self.application.take();
    }
    pub fn contract_version(&self) -> u32 {
        2
    }
    pub fn rebuild_projection_cache(&mut self, space: String) -> Result<(), JsValue> {
        let space = EntityId::new(space)
            .map_err(|_| js_error(failure(StorageFailureCode::InvalidResponse)))?;
        self.host()?
            .rebuild_projection_cache(&space)
            .map_err(js_error)
    }
    pub fn port(
        &mut self,
        request: tsify::Ts<LocalPortRequestV2>,
    ) -> Result<tsify::Ts<LocalPortOutcomeV2>, JsValue> {
        let result = self.host()?.port(decode(request)?).map_err(js_error)?;
        output(&result)
    }
    pub fn query_transactions(
        &mut self,
        query: tsify::Ts<TransactionIndexQuery>,
    ) -> Result<tsify::Ts<LocalPortOutcomeV2>, JsValue> {
        let value = self
            .host()?
            .store
            .query_transactions(decode(query)?)
            .map_err(js_error)?;
        output(&LocalPortOutcomeV2::Aggregates {
            contract_version: 2,
            value,
        })
    }
    pub fn query_pending(
        &mut self,
        query: tsify::Ts<PendingIndexQuery>,
    ) -> Result<tsify::Ts<LocalPortOutcomeV2>, JsValue> {
        let value = self
            .host()?
            .store
            .query_pending(decode(query)?)
            .map_err(js_error)?;
        output(&LocalPortOutcomeV2::Pending {
            contract_version: 2,
            value,
        })
    }
    pub fn query_imported(
        &mut self,
        query: tsify::Ts<ImportSourceQuery>,
    ) -> Result<tsify::Ts<LocalPortOutcomeV2>, JsValue> {
        let value = self
            .host()?
            .store
            .query_imported(decode(query)?)
            .map_err(js_error)?;
        output(&LocalPortOutcomeV2::Aggregates {
            contract_version: 2,
            value,
        })
    }
    pub fn commit(
        &mut self,
        request: tsify::Ts<LocalCommitRequest>,
    ) -> Result<tsify::Ts<BrowserCommitOutcome>, JsValue> {
        let result = match self.host()?.store.commit(decode(request)?) {
            CommitOutcome::Committed { value } => BrowserCommitOutcome::Committed { value },
            CommitOutcome::NotCommitted { error } => BrowserCommitOutcome::NotCommitted { error },
            CommitOutcome::Unknown { identity } => BrowserCommitOutcome::Unknown { identity },
        };
        output(&result)
    }
    pub fn lookup_result(
        &mut self,
        identity: tsify::Ts<LocalOperationIdentity>,
    ) -> Result<tsify::Ts<BrowserReceiptLookup>, JsValue> {
        let receipt = self
            .host()?
            .store
            .lookup_result(&decode(identity)?)
            .map_err(js_error)?;
        output(&BrowserReceiptLookup {
            contract_version: 2,
            receipt,
        })
    }
    pub fn persist_backup(
        &mut self,
        input: tsify::Ts<BrowserBackupInput>,
    ) -> Result<tsify::Ts<wimm_local_contracts::models::EncryptedBackupReceipt>, JsValue> {
        let input: BrowserBackupInput = decode(input)?;
        if input.receipt.profile_id.as_str() != self.host()?.profile.as_str() {
            return Err(js_error(failure(StorageFailureCode::EpochMismatch)));
        }
        let saved = self
            .backups
            .as_mut()
            .ok_or_else(|| js_error(failure(StorageFailureCode::ResourceUnavailable)))?
            .persist(input.receipt, &input.ciphertext)
            .map_err(js_error)?;
        output(&saved)
    }
    pub fn read_backup(
        &mut self,
        receipt: tsify::Ts<wimm_local_contracts::models::EncryptedBackupReceipt>,
    ) -> Result<tsify::Ts<BrowserCiphertext>, JsValue> {
        let receipt: wimm_local_contracts::models::EncryptedBackupReceipt = decode(receipt)?;
        if receipt.profile_id.as_str() != self.host()?.profile.as_str() {
            return Err(js_error(failure(StorageFailureCode::EpochMismatch)));
        }
        let ciphertext = self
            .backups
            .as_ref()
            .ok_or_else(|| js_error(failure(StorageFailureCode::ResourceUnavailable)))?
            .read(&receipt)
            .map_err(js_error)?;
        output(&BrowserCiphertext {
            contract_version: 2,
            ciphertext,
        })
    }
    pub fn close(&mut self) -> Result<(), JsValue> {
        // Erst SQLite schließen, danach die tatsächlichen SyncAccessHandles freigeben.
        self.application.take();
        self.host.take();
        self.backups.take();
        self.pool.pause_vfs().map_err(|_| {
            js_error(StorageFailure::unknown(
                StorageFailureCode::ResourceUnavailable,
            ))
        })
    }
}
impl BrowserStorage {
    fn host(&mut self) -> Result<&mut StorageHost, JsValue> {
        self.host
            .as_mut()
            .ok_or_else(|| js_error(failure(StorageFailureCode::ResourceUnavailable)))
    }
}
#[wasm_bindgen]
pub async fn open_browser_storage(profile: String) -> Result<BrowserStorage, JsValue> {
    let profile = EntityId::new(profile)
        .map_err(|_| js_error(failure(StorageFailureCode::InvalidResponse)))?;
    let config = OpfsSAHPoolCfgBuilder::new()
        .vfs_name("wimm-browser-vfs")
        .directory("wimm-current-v5")
        .clear_on_init(false)
        .initial_capacity(6)
        .build();
    let pool = sqlite_wasm_vfs::sahpool::install::<sqlite_wasm_rs::WasmOsCallback>(&config, false)
        .await
        .map_err(|_| js_error(failure(StorageFailureCode::ResourceUnavailable)))?;
    pool.unpause_vfs()
        .await
        .map_err(|_| js_error(failure(StorageFailureCode::ResourceUnavailable)))?;
    let exists = pool
        .exists("/wimm-current.sqlite3")
        .map_err(|_| js_error(failure(StorageFailureCode::ResourceUnavailable)))?;
    let mut connection =
        SqliteConnection::establish("file:/wimm-current.sqlite3?vfs=wimm-browser-vfs")
            .map_err(|_| js_error(failure(StorageFailureCode::ResourceUnavailable)))?;
    if !exists {
        wimm_local_dal::sqlite::SqliteStore::initialize_connection_cancellable(
            &mut connection,
            &NeverCancel,
        )
        .map_err(js_error)?;
    }
    let host = StorageHost::from_connection(connection, profile).map_err(js_error)?;
    let backup_exists = pool
        .exists("/wimm-backups.sqlite3")
        .map_err(|_| js_error(failure(StorageFailureCode::ResourceUnavailable)))?;
    let backup_connection =
        SqliteConnection::establish("file:/wimm-backups.sqlite3?vfs=wimm-browser-vfs")
            .map_err(|_| js_error(failure(StorageFailureCode::ResourceUnavailable)))?;
    let backups = if backup_exists {
        wimm_local_dal::sqlite_backup::SqliteBackupStore::from_connection(backup_connection)
    } else {
        wimm_local_dal::sqlite_backup::SqliteBackupStore::initialize_connection(backup_connection)
    }
    .map_err(js_error)?;
    Ok(BrowserStorage {
        host: Some(host),
        application: None,
        pool,
        backups: Some(backups),
    })
}
