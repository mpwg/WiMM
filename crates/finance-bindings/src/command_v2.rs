// SPDX-License-Identifier: AGPL-3.0-or-later
//! V2-Binding derselben privaten Rust-Befehlsformen und Fachhandler.
#[cfg(all(feature = "wasm", not(feature = "native")))]
use crate::wasm_boundary::wasm_error;
use wimm_finance_types::{
    ContractError,
    command_contracts::{CommandResult, Request},
};

pub use wimm_finance_types::command_contracts::CommandOutcomeV2;

/// Expliziter Formadapter für den synthetischen Bindingkatalog, keine Finanzberechnung.
#[cfg(all(feature = "native", feature = "contract-probe"))]
#[uniffi::export]
pub fn command_request_from_v1(input: String) -> Result<Request, ContractError> {
    let mut request =
        wimm_finance_core::decode_command_request_v1(&input).map_err(ContractError::from)?;
    request.contract_version = 2.into();
    Ok(request)
}

#[cfg(all(feature = "native", feature = "contract-probe"))]
#[uniffi::export]
pub fn command_outcome_to_v1(outcome: CommandOutcomeV2) -> Result<String, ContractError> {
    outcome.to_v1_json()
}

#[cfg(all(feature = "native", feature = "contract-probe"))]
#[uniffi::export]
pub fn command_error_to_v1(error: ContractError) -> String {
    let ContractError::Rejected { code, detail, .. } = error;
    serde_json::json!({"contractVersion":1,"status":"rejected","error":{"code":code,"message":detail}}).to_string()
}

#[cfg(feature = "native")]
#[uniffi::export]
pub fn execute_v2(request: Request) -> Result<CommandOutcomeV2, ContractError> {
    execute_typed_v2(request)
}

fn execute_typed_v2(mut request: Request) -> Result<CommandOutcomeV2, ContractError> {
    if request.contract_version != crate::v2::BINDING_VERSION || request.domain_schema_version != 1
    {
        return Err((
            "UPDATE_REQUIRED",
            "Der Enginevertrag wird nicht unterstützt.",
        )
            .into());
    }
    // Nur Bindingversion anpassen; dieselben Modelle, keine JSON-Rekonstruktion.
    request.contract_version = 1.into();
    match wimm_finance_core::execute(request).map_err(ContractError::from)? {
        CommandResult::Changed(change_set) => Ok(CommandOutcomeV2::Changed {
            contract_version: 2,
            change_set,
        }),
        CommandResult::Unchanged => Ok(CommandOutcomeV2::Unchanged {
            contract_version: 2,
        }),
    }
}

#[cfg(all(feature = "wasm", not(feature = "native")))]
#[wasm_bindgen::prelude::wasm_bindgen]
pub fn execute_v2(
    input: tsify::Ts<Request>,
) -> Result<tsify::Ts<CommandOutcomeV2>, wasm_bindgen::JsValue> {
    let request = crate::wasm_boundary::decode(input)?;
    let result = execute_typed_v2(request).map_err(wasm_error)?;
    tsify::Ts::from_rust(&result).map_err(|_| wasm_error(ContractError::invalid_command()))
}
