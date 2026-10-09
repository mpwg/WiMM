// SPDX-License-Identifier: AGPL-3.0-or-later
//! Gemeinsame private Fachtypen; keine UI, HTTP, ORM oder Speicherung.
#![forbid(unsafe_code)]
use uuid::Uuid;
mod error;
pub use error::ContractError;
#[cfg(feature = "native-bindings")]
uniffi::setup_scaffolding!();
#[cfg(feature = "native-bindings")]
pub mod native;
pub const MAX_SAFE: i64 = 9_007_199_254_740_991;
pub type CoreResult<T> = Result<T, (&'static str, &'static str)>;
pub mod aggregate_schema;
pub mod calendar;
pub mod command_contracts;
pub mod models;
pub mod scalars;
#[cfg(feature = "contract-schema")]
pub mod schema;
pub mod versions;
pub fn valid_id(value: &str) -> bool {
    let b = value.as_bytes();
    b.len() == 36
        && b.iter().enumerate().all(|(n, c)| {
            if [8, 13, 18, 23].contains(&n) {
                *c == b'-'
            } else {
                c.is_ascii_hexdigit()
            }
        })
        && Uuid::parse_str(value).is_ok_and(|id| {
            id.is_nil()
                || id == Uuid::max()
                || (id.get_variant() == uuid::Variant::RFC4122
                    && (1..=8).contains(&id.get_version_num()))
        })
}
