// SPDX-License-Identifier: AGPL-3.0-or-later
//! Gegenbefehle mit demselben typisierten Änderungsmengenvertrag wie execute.
use crate::CommandOutcomeV2;
use wimm_finance_types::{ContractError, reverse_contracts::ReverseRequest};

fn reverse_typed(mut request: ReverseRequest) -> Result<CommandOutcomeV2, ContractError> {
    if request.contract_version != 2 || request.domain_schema_version != 1 {
        return Err((
            "UPDATE_REQUIRED",
            "Der Enginevertrag wird nicht unterstützt.",
        )
            .into());
    }
    request.contract_version = 1.into();
    Ok(CommandOutcomeV2::Changed {
        contract_version: 2,
        change_set: wimm_finance_core::reverse(request).map_err(ContractError::from)?,
    })
}

#[cfg(feature = "native")]
#[uniffi::export]
pub fn reverse_v2(request: ReverseRequest) -> Result<CommandOutcomeV2, ContractError> {
    reverse_typed(request)
}

#[cfg(all(feature = "wasm", not(feature = "native")))]
#[wasm_bindgen::prelude::wasm_bindgen]
pub fn reverse_v2(
    request: tsify::Ts<ReverseRequest>,
) -> Result<tsify::Ts<CommandOutcomeV2>, wasm_bindgen::JsValue> {
    use crate::wasm_boundary::{decode, wasm_error};
    let result = reverse_typed(decode(request)?).map_err(wasm_error)?;
    tsify::Ts::from_rust(&result).map_err(|_| wasm_error(ContractError::invalid_command()))
}

#[cfg(all(feature = "native", feature = "contract-probe"))]
#[uniffi::export]
pub fn reverse_request_from_v1(input: String) -> Result<ReverseRequest, ContractError> {
    let mut request =
        wimm_finance_core::decode_reverse_request_v1(&input).map_err(ContractError::from)?;
    request.contract_version = 2.into();
    Ok(request)
}
