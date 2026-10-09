// SPDX-License-Identifier: AGPL-3.0-or-later
//! Gemeinsame strikte und fallible WASM-Formgrenze.
use wimm_finance_types::ContractError;
#[cfg(all(feature = "wasm", not(feature = "native")))]
pub(crate) fn wasm_error(error: ContractError) -> wasm_bindgen::JsValue {
    tsify::Ts::from_rust(&error)
        .expect("Ein versionierter Fehler mit Strings und u32 ist serialisierbar.")
        .js_value()
}

pub(crate) fn decode<T: tsify::Tsify + serde::de::DeserializeOwned>(
    input: tsify::Ts<T>,
) -> Result<T, wasm_bindgen::JsValue> {
    use wasm_bindgen::JsValue;
    let raw = input.js_value();
    if !raw.is_object() || raw.is_null() || js_sys::Array::is_array(&raw) {
        return Err(wasm_error(ContractError::invalid_command()));
    }
    let binding = js_sys::Reflect::get(&raw, &JsValue::from_str("contractVersion"))
        .map_err(|_| wasm_error(ContractError::invalid_command()))?;
    let domain = js_sys::Reflect::get(&raw, &JsValue::from_str("domainSchemaVersion"))
        .map_err(|_| wasm_error(ContractError::invalid_command()))?;
    if binding.is_undefined() || domain.is_undefined() {
        return Err(wasm_error(ContractError::invalid_command()));
    }
    if binding.as_f64() != Some(2.0) || domain.as_f64() != Some(1.0) {
        return Err(wasm_error(
            (
                "UPDATE_REQUIRED",
                "Der Enginevertrag wird nicht unterstützt.",
            )
                .into(),
        ));
    }
    // Standard-JSON und dieselbe strikte Serdeform wie V1. Die fallible
    // JS-Stringify-Grenze vermeidet gloo::into_serde/unwrap_throw bei Zyklen.
    if !wimm_contract_primitives::wasm_data::check(&raw) {
        return Err(wasm_error(ContractError::invalid_command()));
    }
    let json = js_sys::JSON::stringify(&raw)
        .map_err(|_| wasm_error(ContractError::invalid_command()))?
        .as_string()
        .ok_or_else(|| wasm_error(ContractError::invalid_command()))?;
    serde_json::from_str(&json).map_err(|_| wasm_error(ContractError::invalid_command()))
}
