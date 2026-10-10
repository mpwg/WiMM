// SPDX-License-Identifier: AGPL-3.0-or-later
//! Ausschließlich synthetischer AR04-Prüfeinstieg; keine Produkt-/Bindingumschaltung.
use crate::sqlite_commit::SqliteCommitStore;
use wimm_finance_types::scalars::EntityId;
use wimm_local_contracts::{commit::*, persistence_errors::*};
#[derive(serde::Deserialize)]
#[serde(
    tag = "method",
    rename_all = "camelCase",
    rename_all_fields = "camelCase",
    deny_unknown_fields
)]
enum Request {
    Initialize {
        space_id: EntityId,
        proposed_epoch: EntityId,
    },
    Commit {
        request: LocalCommitRequest,
        #[serde(default)]
        fail_before_receipt: bool,
        #[serde(default)]
        lose_response: bool,
    },
    Lookup {
        identity: LocalOperationIdentity,
    },
    Inspect {
        handle: EntityId,
        space_id: EntityId,
    },
}
pub fn run(db: &mut SqliteCommitStore, json: &str) -> Result<String, StorageFailure> {
    let request: Request = serde_json::from_str(json)
        .map_err(|_| StorageFailure::not_committed(StorageFailureCode::InvalidResponse))?;
    let value = match request {
        Request::Initialize {
            space_id,
            proposed_epoch,
        } => serde_json::json!({"epoch":db.initialize_area(&space_id,&proposed_epoch)?}),
        Request::Commit {
            request,
            fail_before_receipt,
            lose_response,
        } => {
            if fail_before_receipt {
                db.inject_before_receipt_failure();
            }
            if lose_response {
                db.inject_after_commit_response_loss();
            }
            serde_json::to_value(db.commit(request))
                .map_err(|_| StorageFailure::unknown(StorageFailureCode::InvalidResponse))?
        }
        Request::Lookup { identity } => serde_json::to_value(db.lookup_result(&identity)?)
            .map_err(|_| StorageFailure::unknown(StorageFailureCode::InvalidResponse))?,
        Request::Inspect { handle, space_id } => {
            serde_json::json!({"aggregate":db.read_aggregate(&handle)?,"pending":db.read_pending(&space_id)?,"projections":db.read_projections(&space_id)?})
        }
    };
    Ok(value.to_string())
}
#[cfg(target_family = "wasm")]
mod browser {
    use super::*;
    use std::cell::RefCell;
    use wasm_bindgen::prelude::*;
    thread_local! { static DB:RefCell<Option<SqliteCommitStore>>=const {RefCell::new(None)}; }
    fn error(e: StorageFailure) -> JsValue {
        JsValue::from_str(&serde_json::to_string(&e).expect("Strukturierter Fehler"))
    }
    #[wasm_bindgen]
    pub async fn open_receipt_probe(profile: String) -> Result<(), JsValue> {
        let profile = EntityId::new(profile).map_err(|_| {
            error(StorageFailure::not_committed(
                StorageFailureCode::InvalidResponse,
            ))
        })?;
        let db = SqliteCommitStore::open_browser(profile)
            .await
            .map_err(error)?;
        DB.with(|slot| *slot.borrow_mut() = Some(db));
        Ok(())
    }
    #[wasm_bindgen]
    pub fn receipt_probe_request(json: &str) -> Result<String, JsValue> {
        DB.with(|slot| slot.borrow_mut().as_mut().map(|db| run(db, json)))
            .ok_or_else(|| {
                error(StorageFailure::not_committed(
                    StorageFailureCode::ResourceUnavailable,
                ))
            })?
            .map_err(error)
    }
}
