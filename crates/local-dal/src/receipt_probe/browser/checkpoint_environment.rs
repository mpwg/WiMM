// SPDX-License-Identifier: AGPL-3.0-or-later
//! Synthetische Clientcomposition: reale Crypto-/OPFS-Ports außerhalb des DAL.
use super::*;
use wimm_local_contracts::{
    checkpoint::*, models::EncryptedBackupReceipt, ports::EncryptedBackupRequest,
    storage::LocalSnapshot, storage_port::*,
};
#[wasm_bindgen]
extern "C" {
    #[wasm_bindgen(catch,js_name=receiptSeal)]
    fn seal(clear: &str) -> Result<String, JsValue>;
    #[wasm_bindgen(catch,js_name=receiptUnseal)]
    fn unseal(bytes: &str) -> Result<String, JsValue>;
    #[wasm_bindgen(catch,js_name=receiptPersist)]
    fn persist(request: &str) -> Result<String, JsValue>;
    #[wasm_bindgen(catch,js_name=receiptRead)]
    fn read(receipt: &str) -> Result<String, JsValue>;
    #[wasm_bindgen(catch,js_name=receiptValidate)]
    fn validate(snapshot: &str) -> Result<(), JsValue>;
}
struct Environment;
fn fail() -> StorageFailure {
    StorageFailure::not_committed(StorageFailureCode::WriteFailed)
}
impl SnapshotProtectionPort<LocalCommitCheckpoint> for Environment {
    type Error = StorageFailure;
    fn seal(&self, value: LocalCommitCheckpoint) -> Result<Vec<u8>, StorageFailure> {
        let encoded =
            seal(&serde_json::to_string(&value).map_err(|_| fail())?).map_err(|_| fail())?;
        serde_json::from_str(&encoded).map_err(|_| fail())
    }
    fn unseal(&self, bytes: &[u8]) -> Result<LocalCommitCheckpoint, StorageFailure> {
        let value =
            unseal(&serde_json::to_string(bytes).map_err(|_| fail())?).map_err(|_| fail())?;
        serde_json::from_str(&value).map_err(|_| fail())
    }
}
impl SnapshotValidationPort for Environment {
    fn validate(&self, value: &LocalSnapshot) -> Result<(), StorageFailure> {
        validate(&serde_json::to_string(value).map_err(|_| fail())?).map_err(|_| fail())
    }
}
impl BackupPort for Environment {
    type Error = StorageFailure;
    fn persist(
        &self,
        value: EncryptedBackupRequest,
    ) -> Result<EncryptedBackupReceipt, StorageFailure> {
        let value =
            persist(&serde_json::to_string(&value).map_err(|_| fail())?).map_err(|_| fail())?;
        serde_json::from_str(&value).map_err(|_| fail())
    }
}
impl BackupReadPort for Environment {
    fn read(&self, value: &EncryptedBackupReceipt) -> Result<Vec<u8>, StorageFailure> {
        let value = read(&serde_json::to_string(value).map_err(|_| fail())?).map_err(|_| fail())?;
        serde_json::from_str(&value).map_err(|_| fail())
    }
}
#[derive(serde::Deserialize)]
#[serde(
    tag = "method",
    rename_all = "camelCase",
    rename_all_fields = "camelCase",
    deny_unknown_fields
)]
enum Request {
    Checkpoint {
        space_id: EntityId,
    },
    SealCheckpoint {
        checkpoint: LocalCommitCheckpoint,
    },
    Backup {
        space_id: EntityId,
    },
    Restore {
        request: LocalCheckpointRestoreRequest,
        #[serde(default)]
        fail_before_receipt: bool,
        #[serde(default)]
        cancelled: bool,
    },
}
pub fn run(db: &mut SqliteCommitStore, json: &str) -> Result<String, StorageFailure> {
    let result = (|| {
        let request: Request = serde_json::from_str(json).map_err(|_| fail())?;
        match request {
            Request::Checkpoint { space_id } => {
                serde_json::to_value(db.checkpoint(&space_id)?).map_err(|_| fail())
            }
            Request::SealCheckpoint { checkpoint } => {
                serde_json::to_value(Environment.seal(checkpoint)?).map_err(|_| fail())
            }
            Request::Backup { space_id } => {
                let id = EntityId::new("50000000-0000-4000-8000-000000000090".into())
                    .map_err(|_| fail())?;
                let (checkpoint, receipt) =
                    db.backup_checkpoint(&space_id, &id, &Environment, &Environment, &Environment)?;
                Ok(serde_json::json!({"checkpoint":checkpoint,"receipt":receipt}))
            }
            Request::Restore {
                request,
                fail_before_receipt,
                cancelled,
            } => {
                if fail_before_receipt {
                    db.inject_before_receipt_failure();
                }
                let token = ProbeCancellation(Rc::new(Cell::new(cancelled)));
                db.restore_checkpoint(request, &Environment, &Environment, &Environment, &token)?;
                Ok(serde_json::json!({"status":"restored"}))
            }
        }
    })();
    Ok(match result {Ok(v)=>v,Err(e)=>serde_json::json!({"status":if e.commit_state==FailureCommitState::Unknown {"unknown"}else{"notCommitted"},"error":e})}.to_string())
}
