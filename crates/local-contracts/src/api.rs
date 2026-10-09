// SPDX-License-Identifier: AGPL-3.0-or-later
//! Formannahme für vorhandene Metadaten, kein Start einer Migration.
use crate::{
    Validate,
    errors::{LocalContractError, LocalFormOutcome, LocalFormStatus},
    models::StorageMigrationPlan,
};
fn checked(plan: StorageMigrationPlan) -> Result<LocalFormOutcome, LocalContractError> {
    plan.validate().map_err(|_| LocalContractError::invalid())?;
    Ok(LocalFormOutcome {
        contract_version: 2,
        status: LocalFormStatus::FormValid,
    })
}
#[cfg(any(feature = "native-bindings", not(feature = "wasm-bindings")))]
pub fn validate_local_migration_form_v2(
    plan: StorageMigrationPlan,
) -> Result<LocalFormOutcome, LocalContractError> {
    checked(plan)
}
#[cfg(all(feature = "wasm-bindings", not(feature = "native-bindings")))]
#[wasm_bindgen::prelude::wasm_bindgen]
pub fn validate_local_migration_form_v2(
    input: tsify::Ts<StorageMigrationPlan>,
) -> Result<tsify::Ts<LocalFormOutcome>, wasm_bindgen::JsValue> {
    fn error() -> wasm_bindgen::JsValue {
        tsify::Ts::from_rust(&LocalContractError::invalid())
            .expect("Statische lokale Formfehler sind serialisierbar.")
            .js_value()
    }
    let text = js_sys::JSON::stringify(&input.js_value())
        .map_err(|_| error())?
        .as_string()
        .ok_or_else(error)?;
    let plan = serde_json::from_str(&text).map_err(|_| error())?;
    let result = checked(plan).map_err(|_| error())?;
    tsify::Ts::from_rust(&result).map_err(|_| error())
}
