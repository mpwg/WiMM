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
#[wasm_bindgen]
pub struct BrowserStorage {
    host: Option<StorageHost>,
    pool: OpfsSAHPoolUtil,
}
#[wasm_bindgen]
impl BrowserStorage {
    pub fn contract_version(&self) -> u32 {
        2
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
    pub fn close(&mut self) -> Result<(), JsValue> {
        // Erst SQLite schließen, danach die tatsächlichen SyncAccessHandles freigeben.
        self.host.take();
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
    Ok(BrowserStorage {
        host: Some(host),
        pool,
    })
}
