// SPDX-License-Identifier: AGPL-3.0-or-later
//! Typisierte lokale Formannahme und unveränderter V1-Wirerundlauf; kein Backend.
use crate::{storage::*, wire_policy};
use serde::{Deserialize, Serialize};
use wimm_finance_types::ContractError;
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
#[cfg_attr(feature = "contract-schema", derive(schemars::JsonSchema))]
#[cfg_attr(feature = "native-bindings", derive(uniffi::Record))]
#[cfg_attr(feature = "wasm-bindings", derive(tsify::Tsify))]
pub struct SnapshotOutcomeV2 {
    #[cfg_attr(
        feature = "contract-schema",
        schemars(with = "wimm_public_contracts::schema::PublicBindingVersion")
    )]
    pub contract_version: u32,
    pub status: SnapshotStatus,
    pub snapshot: LocalSnapshot,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
#[cfg_attr(feature = "contract-schema", derive(schemars::JsonSchema))]
#[cfg_attr(feature = "native-bindings", derive(uniffi::Enum))]
#[cfg_attr(feature = "wasm-bindings", derive(tsify::Tsify))]
pub enum SnapshotStatus {
    Snapshot,
}
fn invalid() -> ContractError {
    (
        "INVALID_LOCAL_CONTRACT",
        "Die lokale Snapshot-/Portform ist ungültig.",
    )
        .into()
}
fn checked(snapshot: LocalSnapshot) -> Result<SnapshotOutcomeV2, ContractError> {
    if !snapshot.check_versions() {
        return Err((
            "UPDATE_REQUIRED",
            "Die lokale Storage-/Fachversion wird nicht unterstützt.",
        )
            .into());
    }
    if !wire_policy::check(&snapshot)
        || snapshot
            .sync_state
            .as_ref()
            .is_some_and(|s| !s.check_cursor())
    {
        return Err(invalid());
    }
    Ok(SnapshotOutcomeV2 {
        contract_version: 2,
        status: SnapshotStatus::Snapshot,
        snapshot,
    })
}
pub fn snapshot_from_v1_json(input: &str) -> Result<LocalSnapshot, ContractError> {
    let raw: serde_json::Value = serde_json::from_str(input).map_err(|_| invalid())?;
    if !raw["storageSchemaVersion"]
        .as_f64()
        .is_some_and(|v| v == 1.0 || v == 2.0)
        || raw["domainSchemaVersion"].as_f64() != Some(1.0)
    {
        return Err((
            "UPDATE_REQUIRED",
            "Die lokale Storage-/Fachversion wird nicht unterstützt.",
        )
            .into());
    }
    let snapshot: LocalSnapshot = serde_json::from_value(raw).map_err(|_| invalid())?;
    checked(snapshot).map(|r| r.snapshot)
}
pub fn snapshot_to_v1_json(snapshot: LocalSnapshot) -> Result<String, ContractError> {
    serde_json::to_string(&checked(snapshot)?.snapshot).map_err(|_| invalid())
}
pub fn check_port(request: LocalPortRequestV2) -> Result<(), ContractError> {
    if request.contract_version != 2 {
        return Err((
            "UPDATE_REQUIRED",
            "Die lokale Bindingversion wird nicht unterstützt.",
        )
            .into());
    }
    if !wire_policy::check(&request) {
        return Err(invalid());
    }
    match request.command {
        LocalPortCommand::ReplaceSnapshot { snapshot } => {
            checked(snapshot)?;
        }
        LocalPortCommand::SaveSyncPage { page } if !page.state.check_cursor() => {
            return Err(invalid());
        }
        _ => {}
    }
    Ok(())
}
#[cfg(any(feature = "native-bindings", not(feature = "wasm-bindings")))]
pub fn validate_local_port_form_v2(
    request: LocalPortRequestV2,
) -> Result<crate::errors::LocalFormOutcome, ContractError> {
    check_port(request)?;
    Ok(crate::errors::LocalFormOutcome {
        contract_version: 2,
        status: crate::errors::LocalFormStatus::FormValid,
    })
}
#[cfg(all(feature = "wasm-bindings", not(feature = "native-bindings")))]
#[wasm_bindgen::prelude::wasm_bindgen]
pub fn validate_local_port_form_v2(
    input: tsify::Ts<LocalPortRequestV2>,
) -> Result<tsify::Ts<crate::errors::LocalFormOutcome>, wasm_bindgen::JsValue> {
    fn error(e: ContractError) -> wasm_bindgen::JsValue {
        tsify::Ts::from_rust(&e)
            .expect("Statische Portfehler sind serialisierbar.")
            .js_value()
    }
    let raw = input.js_value();
    let version = js_sys::Reflect::get(&raw, &wasm_bindgen::JsValue::from_str("contractVersion"))
        .map_err(|_| error(invalid()))?;
    if version.as_f64() != Some(2.0) {
        return Err(error(
            (
                "UPDATE_REQUIRED",
                "Die lokale Bindingversion wird nicht unterstützt.",
            )
                .into(),
        ));
    }
    if !wimm_contract_primitives::wasm_data::check(&raw) {
        return Err(error(invalid()));
    }
    let text = js_sys::JSON::stringify(&raw)
        .map_err(|_| error(invalid()))?
        .as_string()
        .ok_or_else(|| error(invalid()))?;
    let request = serde_json::from_str(&text).map_err(|_| error(invalid()))?;
    check_port(request).map_err(error)?;
    tsify::Ts::from_rust(&crate::errors::LocalFormOutcome {
        contract_version: 2,
        status: crate::errors::LocalFormStatus::FormValid,
    })
    .map_err(|_| error(invalid()))
}
#[cfg(any(feature = "native-bindings", not(feature = "wasm-bindings")))]
pub fn roundtrip_local_snapshot_v2(
    snapshot: LocalSnapshot,
) -> Result<SnapshotOutcomeV2, ContractError> {
    checked(snapshot)
}
#[cfg(all(feature = "wasm-bindings", not(feature = "native-bindings")))]
#[wasm_bindgen::prelude::wasm_bindgen]
pub fn roundtrip_local_snapshot_v2(
    input: tsify::Ts<LocalSnapshot>,
) -> Result<tsify::Ts<SnapshotOutcomeV2>, wasm_bindgen::JsValue> {
    fn error(e: ContractError) -> wasm_bindgen::JsValue {
        tsify::Ts::from_rust(&e)
            .expect("Statische Snapshotfehler sind serialisierbar.")
            .js_value()
    }
    let raw = input.js_value();
    for (field, supported) in [
        ("storageSchemaVersion", vec![1.0, 2.0]),
        ("domainSchemaVersion", vec![1.0]),
    ] {
        let v = js_sys::Reflect::get(&raw, &wasm_bindgen::JsValue::from_str(field))
            .map_err(|_| error(invalid()))?;
        if v.is_undefined() {
            return Err(error(invalid()));
        }
        if !v.as_f64().is_some_and(|v| supported.contains(&v)) {
            return Err(error(
                (
                    "UPDATE_REQUIRED",
                    "Die lokale Storage-/Fachversion wird nicht unterstützt.",
                )
                    .into(),
            ));
        }
    }
    if !wimm_contract_primitives::wasm_data::check(&raw) {
        return Err(error(invalid()));
    }
    let text = js_sys::JSON::stringify(&raw)
        .map_err(|_| error(invalid()))?
        .as_string()
        .ok_or_else(|| error(invalid()))?;
    let snapshot = serde_json::from_str(&text).map_err(|_| error(invalid()))?;
    tsify::Ts::from_rust(&checked(snapshot).map_err(error)?).map_err(|_| error(invalid()))
}
