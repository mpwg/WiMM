// SPDX-License-Identifier: AGPL-3.0-or-later
//! Ausschließlich synthetischer AR04-Prüfeinstieg; keine Produkt-/Bindingumschaltung.
use crate::sqlite_commit::{CommitBoundary, SqliteCommitStore};
use std::{cell::Cell, rc::Rc};
use wimm_finance_types::scalars::EntityId;
use wimm_local_contracts::storage_port::CancellationPort;
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
        #[serde(default)]
        cancel_before_commit: bool,
        #[serde(default)]
        cancel_after_commit: bool,
        #[serde(default)]
        cancel_before_start: bool,
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
            cancel_before_commit,
            cancel_after_commit,
            cancel_before_start,
        } => {
            if fail_before_receipt {
                db.inject_before_receipt_failure();
            }
            if lose_response {
                db.inject_after_commit_response_loss();
            }
            let flag = Rc::new(Cell::new(cancel_before_start));
            let token = ProbeCancellation(flag.clone());
            db.observe_commit(move |event| {
                if cancel_before_commit && event == CommitBoundary::AfterWrites
                    || cancel_after_commit && event == CommitBoundary::AfterCommit
                {
                    flag.set(true)
                }
            });
            let result = db.commit_cancellable(request, &token);
            db.observe_commit(|_| {});
            serde_json::to_value(result)
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
struct ProbeCancellation(Rc<Cell<bool>>);
impl CancellationPort for ProbeCancellation {
    fn is_cancelled(&self) -> bool {
        self.0.get()
    }
}
#[cfg(target_family = "wasm")]
mod browser {
    use super::*;
    mod checkpoint_environment;
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
        DB.with(|slot| {
            slot.borrow_mut().as_mut().map(|db| {
                let method: serde_json::Value = serde_json::from_str(json).map_err(|_| {
                    StorageFailure::not_committed(StorageFailureCode::InvalidResponse)
                })?;
                if ["checkpoint", "sealCheckpoint", "backup", "restore"]
                    .contains(&method["method"].as_str().unwrap_or(""))
                {
                    checkpoint_environment::run(db, json)
                } else {
                    run(db, json)
                }
            })
        })
        .ok_or_else(|| {
            error(StorageFailure::not_committed(
                StorageFailureCode::ResourceUnavailable,
            ))
        })?
        .map_err(error)
    }
}
