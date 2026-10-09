// SPDX-License-Identifier: AGPL-3.0-or-later
//! Gemeinsamer typisierter V2-Einstieg für alle vier Berechnungsarten.
use wimm_finance_types::{
    ContractError,
    calculation_contracts::{CalculationOutcome, CalculationRequest},
};

fn calculate_typed(mut request: CalculationRequest) -> Result<CalculationOutcome, ContractError> {
    let (binding, domain) = request.versions();
    if binding != 2 || domain != 1 {
        return Err((
            "UPDATE_REQUIRED",
            "Der Enginevertrag wird nicht unterstützt.",
        )
            .into());
    }
    request.set_binding_version(1);
    let mut outcome = wimm_finance_core::calculate(request).map_err(ContractError::from)?;
    outcome.set_binding_version(2);
    Ok(outcome)
}

#[cfg(feature = "native")]
#[uniffi::export]
pub fn calculate_v2(request: CalculationRequest) -> Result<CalculationOutcome, ContractError> {
    calculate_typed(request)
}

#[cfg(all(feature = "wasm", not(feature = "native")))]
#[wasm_bindgen::prelude::wasm_bindgen]
pub fn calculate_v2(
    request: tsify::Ts<CalculationRequest>,
) -> Result<tsify::Ts<CalculationOutcome>, wasm_bindgen::JsValue> {
    use crate::wasm_boundary::{decode, wasm_error};
    let result = calculate_typed(decode(request)?).map_err(wasm_error)?;
    tsify::Ts::from_rust(&result).map_err(|_| wasm_error(ContractError::invalid_command()))
}

#[cfg(all(feature = "native", feature = "contract-probe"))]
#[uniffi::export]
pub fn calculation_request_from_v1(input: String) -> Result<CalculationRequest, ContractError> {
    let mut request =
        wimm_finance_core::decode_calculation_request_v1(&input).map_err(ContractError::from)?;
    request.set_binding_version(2);
    Ok(request)
}

#[cfg(all(feature = "native", feature = "contract-probe"))]
#[uniffi::export]
pub fn calculation_outcome_to_v1(mut outcome: CalculationOutcome) -> Result<String, ContractError> {
    if outcome.binding_version() != 2 {
        return Err((
            "UPDATE_REQUIRED",
            "Der Enginevertrag wird nicht unterstützt.",
        )
            .into());
    }
    outcome.set_binding_version(1);
    serde_json::to_string(&outcome).map_err(|_| ContractError::invalid_command())
}
