// SPDX-License-Identifier: AGPL-3.0-or-later
//! Lokale Port-/Migrationsmetadaten; keine Speicherung oder Finanzregeln.
#![forbid(unsafe_code)]
pub mod api;
pub mod errors;
pub mod models;
#[cfg(feature = "native-bindings")]
mod native;
pub mod ports;
pub mod scalars;
#[cfg(feature = "contract-schema")]
pub mod schema;
pub mod storage;
pub mod storage_api;
pub mod storage_port;
mod wire_policy;
#[cfg(feature = "native-bindings")]
uniffi::setup_scaffolding!();
pub use wimm_contract_primitives::Validate;
pub(crate) use wimm_contract_primitives::record;
