// SPDX-License-Identifier: AGPL-3.0-or-later
//! Typisierte V2-Projektion und Validierung mit expliziten V1-Formadaptern.
use wimm_finance_types::{
    ContractError,
    state_contracts::{
        ProjectionOutcome, ProjectionRequest, ProjectionStatus, ValidationOutcome,
        ValidationRequest, ValidationStatus,
    },
};

fn check_versions(binding: u32, domain: u32) -> Result<(), ContractError> {
    if binding == 2 && domain == 1 {
        Ok(())
    } else {
        Err((
            "UPDATE_REQUIRED",
            "Der Enginevertrag wird nicht unterstützt.",
        )
            .into())
    }
}

fn project_typed(mut request: ProjectionRequest) -> Result<ProjectionOutcome, ContractError> {
    check_versions(
        request.contract_version.value(),
        request.domain_schema_version.value(),
    )?;
    request.contract_version = 1.into();
    Ok(ProjectionOutcome {
        contract_version: 2,
        status: ProjectionStatus::Projected,
        projections: wimm_finance_core::project(request).map_err(ContractError::from)?,
    })
}

fn validate_typed(mut request: ValidationRequest) -> Result<ValidationOutcome, ContractError> {
    let (binding, domain) = request.versions();
    check_versions(binding.value(), domain.value())?;
    request.set_binding_version(1);
    wimm_finance_core::validate(request).map_err(ContractError::from)?;
    Ok(ValidationOutcome {
        contract_version: 2,
        status: ValidationStatus::Valid,
    })
}

#[cfg(feature = "native")]
#[uniffi::export]
pub fn project_v2(request: ProjectionRequest) -> Result<ProjectionOutcome, ContractError> {
    project_typed(request)
}

#[cfg(feature = "native")]
#[uniffi::export]
pub fn validate_v2(request: ValidationRequest) -> Result<ValidationOutcome, ContractError> {
    validate_typed(request)
}

#[cfg(all(feature = "wasm", not(feature = "native")))]
#[wasm_bindgen::prelude::wasm_bindgen]
pub fn project_v2(
    request: tsify::Ts<ProjectionRequest>,
) -> Result<tsify::Ts<ProjectionOutcome>, wasm_bindgen::JsValue> {
    use crate::wasm_boundary::{decode, wasm_error};
    let result = project_typed(decode(request)?).map_err(wasm_error)?;
    tsify::Ts::from_rust(&result).map_err(|_| wasm_error(ContractError::invalid_command()))
}

#[cfg(all(feature = "wasm", not(feature = "native")))]
#[wasm_bindgen::prelude::wasm_bindgen]
pub fn validate_v2(
    request: tsify::Ts<ValidationRequest>,
) -> Result<tsify::Ts<ValidationOutcome>, wasm_bindgen::JsValue> {
    use crate::wasm_boundary::{decode, wasm_error};
    let result = validate_typed(decode(request)?).map_err(wasm_error)?;
    tsify::Ts::from_rust(&result).map_err(|_| wasm_error(ContractError::invalid_command()))
}

#[cfg(all(feature = "native", feature = "contract-probe"))]
#[uniffi::export]
pub fn projection_request_from_v1(input: String) -> Result<ProjectionRequest, ContractError> {
    let mut request =
        wimm_finance_core::decode_projection_request_v1(&input).map_err(ContractError::from)?;
    request.contract_version = 2.into();
    Ok(request)
}

#[cfg(all(feature = "native", feature = "contract-probe"))]
#[uniffi::export]
pub fn validation_request_from_v1(input: String) -> Result<ValidationRequest, ContractError> {
    let mut request =
        wimm_finance_core::decode_validation_request_v1(&input).map_err(ContractError::from)?;
    request.set_binding_version(2);
    Ok(request)
}

#[cfg(all(feature = "native", feature = "contract-probe"))]
#[uniffi::export]
pub fn projection_outcome_to_v1(outcome: ProjectionOutcome) -> Result<String, ContractError> {
    if outcome.contract_version != 2 {
        return Err((
            "UPDATE_REQUIRED",
            "Der Enginevertrag wird nicht unterstützt.",
        )
            .into());
    }
    let mut wire = serde_json::to_value(outcome).map_err(|_| ContractError::invalid_command())?;
    wire["contractVersion"] = 1.into();
    Ok(wire.to_string())
}

#[cfg(all(feature = "native", feature = "contract-probe"))]
#[uniffi::export]
pub fn validation_outcome_to_v1(outcome: ValidationOutcome) -> Result<String, ContractError> {
    if outcome.contract_version != 2 {
        return Err((
            "UPDATE_REQUIRED",
            "Der Enginevertrag wird nicht unterstützt.",
        )
            .into());
    }
    let mut wire = serde_json::to_value(outcome).map_err(|_| ContractError::invalid_command())?;
    wire["contractVersion"] = 1.into();
    Ok(wire.to_string())
}
