// SPDX-License-Identifier: AGPL-3.0-or-later
//! V2-Binding derselben privaten Rust-Befehlsformen und Fachhandler.
use wimm_finance_types::{
    ContractError,
    command_contracts::{ChangeSet, CommandResult, Request},
};

#[cfg_attr(feature = "native", derive(uniffi::Enum))]
#[cfg_attr(feature = "wasm", derive(tsify::Tsify))]
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(
    tag = "status",
    rename_all = "camelCase",
    rename_all_fields = "camelCase",
    deny_unknown_fields
)]
pub enum CommandOutcomeV2 {
    Changed {
        contract_version: u32,
        change_set: ChangeSet,
    },
    Unchanged {
        contract_version: u32,
    },
}

impl CommandOutcomeV2 {
    pub fn to_v1_json(self) -> Result<String, ContractError> {
        let wire = match self {
            Self::Changed {
                contract_version: 2,
                change_set,
            } => CommandResult::Changed(change_set).to_wire(),
            Self::Unchanged {
                contract_version: 2,
            } => CommandResult::Unchanged.to_wire(),
            _ => {
                return Err((
                    "UPDATE_REQUIRED",
                    "Der Enginevertrag wird nicht unterstützt.",
                )
                    .into());
            }
        };
        wire.map(|value| value.to_string())
            .map_err(ContractError::from)
    }
}

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
fn wasm_error(error: ContractError) -> wasm_bindgen::JsValue {
    tsify::Ts::from_rust(&error)
        .expect("Ein versionierter Fehler mit Strings und u32 ist serialisierbar.")
        .js_value()
}

#[cfg(all(feature = "wasm", not(feature = "native")))]
#[wasm_bindgen::prelude::wasm_bindgen]
pub fn execute_v2(
    input: tsify::Ts<Request>,
) -> Result<tsify::Ts<CommandOutcomeV2>, wasm_bindgen::JsValue> {
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
    let json = js_sys::JSON::stringify(&raw)
        .map_err(|_| wasm_error(ContractError::invalid_command()))?
        .as_string()
        .ok_or_else(|| wasm_error(ContractError::invalid_command()))?;
    let request =
        serde_json::from_str(&json).map_err(|_| wasm_error(ContractError::invalid_command()))?;
    let result = execute_typed_v2(request).map_err(wasm_error)?;
    tsify::Ts::from_rust(&result).map_err(|_| wasm_error(ContractError::invalid_command()))
}
