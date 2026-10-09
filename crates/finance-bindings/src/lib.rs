// SPDX-License-Identifier: AGPL-3.0-or-later
#![forbid(unsafe_code)]
#[cfg(feature = "native")]
uniffi::setup_scaffolding!();

pub mod v2;
pub use v2::{MoneyRequestV2, MoneyResultV2, MoneyStatusV2, calculate_money_v2};

#[cfg(feature = "native")]
mod command_v2;
#[cfg(feature = "native")]
pub use command_v2::{CommandOutcomeV2, execute_v2};

/// K01-JSON-Vertrag; alle Facharbeit verbleibt in der unabhängigen Kernbibliothek.
#[cfg_attr(feature = "native", uniffi::export)]
#[cfg_attr(feature = "wasm", wasm_bindgen::prelude::wasm_bindgen)]
pub fn execute_json(request: String) -> String {
    wimm_finance_core::execute_json(&request)
}

#[cfg_attr(feature = "native", uniffi::export)]
#[cfg_attr(feature = "wasm", wasm_bindgen::prelude::wasm_bindgen)]
pub fn calculate_json(request: String) -> String {
    wimm_finance_core::calculate_json(&request)
}

#[cfg(feature = "contract-probe")]
#[cfg_attr(feature = "native", uniffi::export)]
#[cfg_attr(feature = "wasm", wasm_bindgen::prelude::wasm_bindgen)]
pub fn roundtrip_json(request: String) -> String {
    wimm_finance_core::roundtrip_json(&request)
}

#[cfg(feature = "contract-probe")]
#[cfg_attr(feature = "native", uniffi::export)]
#[cfg_attr(feature = "wasm", wasm_bindgen::prelude::wasm_bindgen)]
pub fn primitive_json(request: String) -> String {
    wimm_finance_core::primitive_json(&request)
}

#[cfg_attr(feature = "native", uniffi::export)]
#[cfg_attr(feature = "wasm", wasm_bindgen::prelude::wasm_bindgen)]
pub fn validate_json(request: String) -> String {
    wimm_finance_core::validate_json(&request)
}

#[cfg_attr(feature = "native", uniffi::export)]
#[cfg_attr(feature = "wasm", wasm_bindgen::prelude::wasm_bindgen)]
pub fn project_json(request: String) -> String {
    wimm_finance_core::project_json(&request)
}

#[cfg_attr(feature = "native", uniffi::export)]
#[cfg_attr(feature = "wasm", wasm_bindgen::prelude::wasm_bindgen)]
pub fn reverse_json(request: String) -> String {
    wimm_finance_core::reverse_json(&request)
}

#[cfg(feature = "contract-probe")]
#[cfg_attr(feature = "native", uniffi::export)]
#[cfg_attr(feature = "wasm", wasm_bindgen::prelude::wasm_bindgen)]
pub fn cache_json(request: String) -> String {
    wimm_finance_core::projection_cache::cache_json(&request)
}
