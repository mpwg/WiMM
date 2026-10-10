// SPDX-License-Identifier: AGPL-3.0-or-later
use wimm_client_application::api::{ApplicationPreparationV2, ApplicationRequestV2};
#[cfg(any(feature = "native", not(feature = "wasm")))]
#[cfg_attr(feature = "native", uniffi::export)]
pub fn prepare_application_v2(
    input: ApplicationRequestV2,
) -> Result<ApplicationPreparationV2, wimm_finance_types::ContractError> {
    Ok(wimm_client_application::api::prepare_application_v2(input))
}
#[cfg(all(feature = "wasm", not(feature = "native")))]
#[wasm_bindgen::prelude::wasm_bindgen]
pub fn prepare_application_v2(
    input: tsify::Ts<ApplicationRequestV2>,
) -> Result<tsify::Ts<ApplicationPreparationV2>, wasm_bindgen::JsValue> {
    let invalid =
        || crate::wasm_boundary::wasm_error(wimm_finance_types::ContractError::invalid_command());
    let raw = input.js_value();
    if !wimm_contract_primitives::wasm_data::check(&raw) {
        return Err(invalid());
    }
    let text = js_sys::JSON::stringify(&raw)
        .map_err(|_| invalid())?
        .as_string()
        .ok_or_else(invalid)?;
    let input: ApplicationRequestV2 = serde_json::from_str(&text).map_err(|_| invalid())?;
    tsify::Ts::from_rust(&wimm_client_application::api::prepare_application_v2(input)).map_err(
        |_| crate::wasm_boundary::wasm_error(wimm_finance_types::ContractError::invalid_command()),
    )
}
#[cfg(all(feature = "native", feature = "contract-probe"))]
#[uniffi::export]
pub fn application_request_from_json(
    input: String,
) -> Result<ApplicationRequestV2, wimm_finance_types::ContractError> {
    serde_json::from_str(&input).map_err(|_| wimm_finance_types::ContractError::invalid_command())
}
#[cfg(all(feature = "native", feature = "contract-probe"))]
#[uniffi::export]
pub fn application_preparation_to_json(result: ApplicationPreparationV2) -> String {
    serde_json::to_string(&result).expect("Vorbereitetes serialisierbares Ergebnis")
}
