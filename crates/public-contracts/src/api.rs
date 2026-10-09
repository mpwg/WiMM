// SPDX-License-Identifier: AGPL-3.0-or-later
//! Öffentliche Formprüfung: keine Signatur-, Rollen-, Sitzungs- oder Finanzabnahme.
use crate::{
    Validate,
    envelopes::{EncryptedOperation, SignedKeyRoster},
    errors::{PublicContractError, PublicValidationOutcome, PublicValidationStatus},
};
fn checked<T: Validate>(value: T) -> Result<PublicValidationOutcome, PublicContractError> {
    value
        .validate()
        .map_err(|_| PublicContractError::invalid())?;
    Ok(PublicValidationOutcome {
        contract_version: 2,
        status: PublicValidationStatus::FormValid,
    })
}
#[cfg(any(feature = "native-bindings", not(feature = "wasm-bindings")))]
pub fn validate_public_operation_form_v2(
    operation: EncryptedOperation,
) -> Result<PublicValidationOutcome, PublicContractError> {
    checked(operation)
}
#[cfg(any(feature = "native-bindings", not(feature = "wasm-bindings")))]
pub fn validate_public_roster_form_v2(
    roster: SignedKeyRoster,
) -> Result<PublicValidationOutcome, PublicContractError> {
    checked(roster)
}

#[cfg(all(feature = "wasm-bindings", not(feature = "native-bindings")))]
fn error(value: PublicContractError) -> wasm_bindgen::JsValue {
    tsify::Ts::from_rust(&value)
        .expect("Statische öffentliche Formfehler sind serialisierbar.")
        .js_value()
}
#[cfg(all(feature = "wasm-bindings", not(feature = "native-bindings")))]
fn decode<T: tsify::Tsify + serde::de::DeserializeOwned>(
    input: tsify::Ts<T>,
    field: &str,
) -> Result<T, wasm_bindgen::JsValue> {
    use wasm_bindgen::JsValue;
    let raw = input.js_value();
    let header = js_sys::Reflect::get(&raw, &JsValue::from_str(field))
        .map_err(|_| error(PublicContractError::invalid()))?;
    let protocol = js_sys::Reflect::get(&header, &JsValue::from_str("protocolVersion"))
        .map_err(|_| error(PublicContractError::invalid()))?;
    if protocol.is_undefined() {
        return Err(error(PublicContractError::invalid()));
    }
    if protocol.as_f64() != Some(1.0) {
        return Err(error(PublicContractError::update_required()));
    }
    let text = js_sys::JSON::stringify(&raw)
        .map_err(|_| error(PublicContractError::invalid()))?
        .as_string()
        .ok_or_else(|| error(PublicContractError::invalid()))?;
    serde_json::from_str(&text).map_err(|_| error(PublicContractError::invalid()))
}
#[cfg(all(feature = "wasm-bindings", not(feature = "native-bindings")))]
#[wasm_bindgen::prelude::wasm_bindgen]
pub fn validate_public_operation_form_v2(
    input: tsify::Ts<EncryptedOperation>,
) -> Result<tsify::Ts<PublicValidationOutcome>, wasm_bindgen::JsValue> {
    let result = checked(decode::<EncryptedOperation>(input, "header")?).map_err(error)?;
    tsify::Ts::from_rust(&result).map_err(|_| error(PublicContractError::invalid()))
}
#[cfg(all(feature = "wasm-bindings", not(feature = "native-bindings")))]
#[wasm_bindgen::prelude::wasm_bindgen]
pub fn validate_public_roster_form_v2(
    input: tsify::Ts<SignedKeyRoster>,
) -> Result<tsify::Ts<PublicValidationOutcome>, wasm_bindgen::JsValue> {
    let result = checked(decode::<SignedKeyRoster>(input, "roster")?).map_err(error)?;
    tsify::Ts::from_rust(&result).map_err(|_| error(PublicContractError::invalid()))
}
