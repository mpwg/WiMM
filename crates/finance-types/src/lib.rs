// SPDX-License-Identifier: AGPL-3.0-or-later
//! Gemeinsame private Fachtypen; keine UI, HTTP, ORM oder Speicherung.
#![forbid(unsafe_code)]
mod error;
pub use error::ContractError;
#[cfg(feature = "native-bindings")]
uniffi::setup_scaffolding!();
#[cfg(feature = "native-bindings")]
pub mod native;
pub use wimm_contract_primitives::MAX_SAFE;
pub type CoreResult<T> = Result<T, (&'static str, &'static str)>;
pub mod aggregate_schema;
pub mod calculation_contracts;
pub mod calendar;
pub mod command_contracts;
pub mod models;
pub mod reverse_contracts;
pub mod scalars;
#[cfg(feature = "contract-schema")]
pub mod schema;
pub mod state_contracts;
pub mod versions;
pub use wimm_contract_primitives::valid_uuid as valid_id;
