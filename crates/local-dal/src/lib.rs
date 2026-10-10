// SPDX-License-Identifier: AGPL-3.0-or-later
//! Lokaler Memory-Vertragsadapter; keine dauerhafte Datenbank-/Fachengine.
#![forbid(unsafe_code)]
pub mod memory;

#[cfg(feature = "sqlite")]
pub mod sqlite_commit;

#[cfg(feature = "receipt-probe")]
pub mod receipt_probe;
