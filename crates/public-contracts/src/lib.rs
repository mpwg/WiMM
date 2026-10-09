// SPDX-License-Identifier: AGPL-3.0-or-later
//! Öffentliche Hüllen und Metadaten; keine Finanzmodelle, Schlüssel oder Fachhandler.
#![forbid(unsafe_code)]
pub mod api;
pub mod envelopes;
pub mod errors;
pub mod scalars;
#[cfg(feature = "contract-schema")]
pub mod schema;
#[cfg(feature = "native-bindings")]
uniffi::setup_scaffolding!();
#[cfg(feature = "native-bindings")]
mod native;
pub const PROTOCOL_VERSION: u32 = 1;
pub const MAX_HANDLES: usize = 500;
pub const MAX_BASE64URL_LENGTH: usize = 65_536;
pub type FormResult<T> = Result<T, &'static str>;
pub use wimm_contract_primitives::Validate;

pub(crate) use wimm_contract_primitives::record;
