// SPDX-License-Identifier: AGPL-3.0-or-later
//! Ausschließlich synthetische Port-/Katalogharnesses, keine produktiven Schlüssel oder Speicheradapter.
#[cfg(feature = "native")]
use wimm_client_application::runtime_contracts::{
    RuntimeCommitResultV2, RuntimeEventV2, RuntimeRequestV2, RuntimeSnapshotV2,
};
use wimm_finance_types::ContractError;
use wimm_local_contracts::commit::*;
fn invalid() -> ContractError {
    ContractError::invalid_command()
}
#[cfg(feature = "native")]
#[uniffi::export]
pub fn runtime_request_from_json(input: String) -> Result<RuntimeRequestV2, ContractError> {
    serde_json::from_str(&input).map_err(|_| invalid())
}
#[cfg(feature = "native")]
#[uniffi::export]
pub fn runtime_snapshot_from_json(input: String) -> Result<RuntimeSnapshotV2, ContractError> {
    serde_json::from_str(&input).map_err(|_| invalid())
}
#[cfg(feature = "native")]
#[uniffi::export]
pub fn runtime_event_to_json(input: RuntimeEventV2) -> String {
    serde_json::to_string(&input).expect("Vertragsdaten")
}
#[cfg(feature = "native")]
#[uniffi::export]
pub fn runtime_page_to_json(
    input: wimm_client_application::runtime_contracts::RuntimePageV2,
) -> String {
    serde_json::to_string(&input).expect("Vertragsdaten")
}
#[cfg(feature = "native")]
#[uniffi::export]
pub fn local_request_to_json(input: LocalCommitRequest) -> String {
    serde_json::to_string(&input).expect("Vertragsdaten")
}
#[cfg(feature = "native")]
#[uniffi::export]
pub fn local_receipt_from_json(input: String) -> Result<LocalCommitReceipt, ContractError> {
    serde_json::from_str(&input).map_err(|_| invalid())
}
#[cfg(feature = "native")]
#[uniffi::export]
pub fn runtime_commit_from_json(input: String) -> Result<RuntimeCommitResultV2, ContractError> {
    serde_json::from_str(&input).map_err(|_| invalid())
}
fn seal(request: LocalCommitRequest) -> Result<Vec<u8>, ContractError> {
    wimm_client_crypto::initialize().map_err(|_| invalid())?;
    let key = wimm_client_crypto::SecretKey::from_bytes(&[42; 32]).map_err(|_| invalid())?;
    let plain = serde_json::to_vec(&request).map_err(|_| invalid())?;
    let boxed = wimm_client_crypto::encrypt(&key, b"wimm/local/application-recovery/v1", &plain)
        .map_err(|_| invalid())?;
    let mut result = boxed.nonce;
    result.extend(boxed.ciphertext);
    Ok(result)
}
fn unseal(bytes: Vec<u8>) -> Result<LocalCommitRequest, ContractError> {
    if bytes.len() < 40 {
        return Err(invalid());
    }
    wimm_client_crypto::initialize().map_err(|_| invalid())?;
    let key = wimm_client_crypto::SecretKey::from_bytes(&[42; 32]).map_err(|_| invalid())?;
    let plain = wimm_client_crypto::decrypt(
        &key,
        &bytes[..24],
        b"wimm/local/application-recovery/v1",
        &bytes[24..],
    )
    .map_err(|_| invalid())?;
    serde_json::from_slice(&plain).map_err(|_| invalid())
}
#[cfg(feature = "native")]
#[uniffi::export]
pub fn seal_runtime_probe(request: LocalCommitRequest) -> Result<Vec<u8>, ContractError> {
    seal(request)
}
#[cfg(feature = "native")]
#[uniffi::export]
pub fn unseal_runtime_probe(bytes: Vec<u8>) -> Result<LocalCommitRequest, ContractError> {
    unseal(bytes)
}
#[cfg(all(feature = "wasm", not(feature = "native")))]
#[wasm_bindgen::prelude::wasm_bindgen]
pub fn seal_runtime_probe(
    request: tsify::Ts<LocalCommitRequest>,
) -> Result<Vec<u8>, wasm_bindgen::JsValue> {
    let raw = request.js_value();
    if !wimm_contract_primitives::wasm_data::check(&raw) {
        return Err(crate::wasm_boundary::wasm_error(invalid()));
    }
    let text = js_sys::JSON::stringify(&raw)
        .map_err(|_| crate::wasm_boundary::wasm_error(invalid()))?
        .as_string()
        .ok_or_else(|| crate::wasm_boundary::wasm_error(invalid()))?;
    let request =
        serde_json::from_str(&text).map_err(|_| crate::wasm_boundary::wasm_error(invalid()))?;
    seal(request).map_err(crate::wasm_boundary::wasm_error)
}
#[cfg(all(feature = "wasm", not(feature = "native")))]
#[wasm_bindgen::prelude::wasm_bindgen]
pub fn unseal_runtime_probe(
    bytes: Vec<u8>,
) -> Result<tsify::Ts<LocalCommitRequest>, wasm_bindgen::JsValue> {
    let request = unseal(bytes).map_err(crate::wasm_boundary::wasm_error)?;
    tsify::Ts::from_rust(&request).map_err(|_| crate::wasm_boundary::wasm_error(invalid()))
}
#[cfg(feature = "native")]
#[uniffi::export]
pub fn runtime_context_from_json(
    input: String,
) -> Result<wimm_client_application::CommitContext, ContractError> {
    serde_json::from_str(&input).map_err(|_| invalid())
}
#[cfg(feature = "native")]
#[uniffi::export]
pub fn runtime_receipt_probe(
    request: LocalCommitRequest,
) -> Result<LocalCommitReceipt, ContractError> {
    receipt(request)
}
fn receipt(request: LocalCommitRequest) -> Result<LocalCommitReceipt, ContractError> {
    use sha2::{Digest, Sha256};
    let bytes = serde_json::to_vec(&request).map_err(|_| invalid())?;
    let hash = Sha256::digest(bytes)
        .iter()
        .map(|b| format!("{b:02x}"))
        .collect::<String>();
    Ok(LocalCommitReceipt {
        identity: request.identity,
        content_hash: wimm_finance_types::scalars::FileHash::new(hash).map_err(|_| invalid())?,
        committed_revisions: request
            .batch
            .aggregates
            .into_iter()
            .map(|a| CommittedRevision {
                handle: a.handle,
                revision: a.aggregate.revision(),
            })
            .collect(),
    })
}
#[cfg(all(feature = "wasm", not(feature = "native")))]
#[wasm_bindgen::prelude::wasm_bindgen]
pub fn runtime_receipt_probe(
    input: tsify::Ts<LocalCommitRequest>,
) -> Result<tsify::Ts<LocalCommitReceipt>, wasm_bindgen::JsValue> {
    let text = js_sys::JSON::stringify(&input.js_value())
        .map_err(|_| crate::wasm_boundary::wasm_error(invalid()))?
        .as_string()
        .ok_or_else(|| crate::wasm_boundary::wasm_error(invalid()))?;
    let req =
        serde_json::from_str(&text).map_err(|_| crate::wasm_boundary::wasm_error(invalid()))?;
    tsify::Ts::from_rust(&receipt(req).map_err(crate::wasm_boundary::wasm_error)?)
        .map_err(|_| crate::wasm_boundary::wasm_error(invalid()))
}
#[cfg(feature = "native")]
#[uniffi::export]
pub fn aggregate_id_probe(value: wimm_finance_types::models::Aggregate) -> String {
    value.id().as_str().into()
}
#[cfg(feature = "native")]
#[uniffi::export]
pub fn aggregate_revision_probe(value: wimm_finance_types::models::Aggregate) -> i64 {
    value.revision().value()
}
#[cfg(feature = "native")]
#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct StatefulCase {
    snapshot: wimm_client_application::runtime_contracts::RuntimeSnapshotV2,
    fault: String,
    mode: wimm_client_application::AreaMode,
    actions: Vec<wimm_client_application::runtime_contracts::RuntimeRequestV2>,
}
#[cfg(feature = "native")]
struct ProbeState {
    context: wimm_client_application::CommitContext,
    rows: std::collections::BTreeMap<String, wimm_finance_types::models::Aggregate>,
    receipts: std::collections::BTreeMap<String, LocalCommitReceipt>,
    journal: Vec<u8>,
    writes: usize,
    fault: String,
}
#[cfg(feature = "native")]
struct ProbeHost(std::cell::RefCell<ProbeState>);
#[cfg(feature = "native")]
impl crate::runtime_bridge::RuntimeHost for ProbeHost {
    fn load(
        &self,
        _: wimm_client_application::CommitContext,
    ) -> Result<wimm_client_application::runtime_contracts::RuntimeSnapshotV2, ContractError> {
        let s = self.0.borrow();
        if s.fault == "readException" {
            return Err(invalid());
        }
        Ok(
            wimm_client_application::runtime_contracts::RuntimeSnapshotV2 {
                contract_version: if s.fault == "badSnapshot" { 1 } else { 2 },
                context: s.context.clone(),
                aggregates: s.rows.values().cloned().collect(),
            },
        )
    }
    fn commit(
        &self,
        r: LocalCommitRequest,
        _: wimm_client_application::CommitContext,
        cancelled: bool,
    ) -> Result<wimm_client_application::runtime_contracts::RuntimeCommitResultV2, ContractError>
    {
        use wimm_client_application::runtime_contracts::RuntimeCommitResultV2 as R;
        use wimm_local_contracts::persistence_errors::*;
        let mut s = self.0.borrow_mut();
        s.writes += 1;
        if s.fault == "exception" {
            return Err(invalid());
        }
        if cancelled {
            return Ok(R::NotCommitted {
                error: StorageFailure::not_committed(StorageFailureCode::Cancelled),
            });
        }
        if s.fault == "rollback" {
            return Ok(R::NotCommitted {
                error: StorageFailure::not_committed(StorageFailureCode::WriteFailed),
            });
        }
        for expected in &r.batch.expected_revisions {
            if s.rows
                .get(expected.handle.as_str())
                .map(|a| a.revision().value())
                .unwrap_or(0)
                != expected.expected_revision.value()
            {
                return Ok(R::NotCommitted {
                    error: StorageFailure::not_committed(StorageFailureCode::RevisionConflict),
                });
            }
        }
        let receipt = receipt(r.clone())?;
        for row in r.batch.aggregates {
            s.rows.insert(row.handle.as_str().into(), row.aggregate);
        }
        s.receipts
            .insert(r.identity.operation_id.as_str().into(), receipt.clone());
        if s.fault == "lateScope" {
            s.context.session_generation = wimm_finance_types::scalars::Revision::new(
                s.context.session_generation.value() + 1,
            )
            .map_err(|_| invalid())?;
        }
        if s.fault == "lost" {
            s.fault = "normal".into();
            return Ok(R::Unknown {
                identity: r.identity,
            });
        }
        if s.fault == "badReceipt" {
            s.fault = "normal".into();
            let mut broken = receipt;
            broken.content_hash = wimm_finance_types::scalars::FileHash::new("0".repeat(64))
                .map_err(|_| invalid())?;
            return Ok(R::Committed { receipt: broken });
        }
        Ok(R::Committed { receipt })
    }
    fn lookup(
        &self,
        i: LocalOperationIdentity,
    ) -> Result<Option<LocalCommitReceipt>, ContractError> {
        Ok(self
            .0
            .borrow()
            .receipts
            .get(i.operation_id.as_str())
            .cloned())
    }
    fn journal_load(&self) -> Result<Vec<u8>, ContractError> {
        let s = self.0.borrow();
        Ok(if s.fault == "journalCorrupt" {
            vec![0]
        } else {
            s.journal.clone()
        })
    }
    fn journal_save(&self, b: Vec<u8>) -> Result<bool, ContractError> {
        let mut s = self.0.borrow_mut();
        if !s.journal.is_empty() {
            return Ok(false);
        }
        s.journal = b;
        Ok(true)
    }
    fn journal_clear(&self, b: Vec<u8>) -> Result<bool, ContractError> {
        let mut s = self.0.borrow_mut();
        if s.journal != b {
            return Ok(false);
        }
        s.journal.clear();
        Ok(true)
    }
    fn seal(&self, r: LocalCommitRequest) -> Result<Vec<u8>, ContractError> {
        seal(r)
    }
    fn unseal(&self, b: Vec<u8>) -> Result<LocalCommitRequest, ContractError> {
        unseal(b)
    }
    fn current(&self) -> Result<wimm_client_application::CommitContext, ContractError> {
        Ok(self.0.borrow().context.clone())
    }
    fn cancelled(&self) -> Result<bool, ContractError> {
        Ok(self.0.borrow().fault == "cancelled")
    }
}
#[cfg(feature = "native")]
#[uniffi::export]
pub fn run_stateful_runtime_probe(input: String) -> Result<String, ContractError> {
    let c: StatefulCase = serde_json::from_str(&input).map_err(|_| invalid())?;
    let host = ProbeHost(std::cell::RefCell::new(ProbeState {
        context: c.snapshot.context.clone(),
        rows: c
            .snapshot
            .aggregates
            .into_iter()
            .map(|a| (a.id().as_str().to_owned(), a))
            .collect(),
        receipts: Default::default(),
        journal: vec![],
        writes: 0,
        fault: c.fault,
    }));
    let mut session = crate::runtime_bridge::Session::new(c.snapshot.context, c.mode);
    let mut events = c
        .actions
        .iter()
        .cloned()
        .map(|action| session.invoke(action, &host))
        .collect::<Vec<_>>();
    let mut pages = vec![];
    for offset in (0..u32::MAX).step_by(100) {
        match session.page(offset, 100, &host) {
            Ok(page) => {
                let last = page.aggregates.len() < 100;
                pages.push(page);
                if last {
                    break;
                }
            }
            Err(_) => {
                pages.clear();
                break;
            }
        }
    }
    events.push(session.close());
    events.push(session.invoke(c.actions[0].clone(), &host));
    serde_json::to_string(&serde_json::json!({"events":events,"page":pages.first(),"pages":pages,"writes":host.0.borrow().writes})).map_err(|_|invalid())
}
