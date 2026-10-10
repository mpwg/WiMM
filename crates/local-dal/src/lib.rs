// SPDX-License-Identifier: AGPL-3.0-or-later
//! Lokaler Rust-DAL mit Vertragsreferenz und optionaler SQLite-Persistenz; keine Fachengine.
#![forbid(unsafe_code)]
pub mod memory;

#[cfg(feature = "sqlite")]
pub mod sqlite_commit;

#[cfg(feature = "receipt-probe")]
pub mod receipt_probe;

#[cfg(feature = "sqlite")]
pub mod legacy_sqlite;
