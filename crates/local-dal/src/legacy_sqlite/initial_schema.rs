// SPDX-License-Identifier: AGPL-3.0-or-later
//! Expliziter registrierter Initialschritt für ausschließlich leere native Dateien.
use super::*;
use sea_query::{Alias, ColumnDef, ExprTrait, Index, SqliteQueryBuilder, Table};
impl LegacySqliteStore {
    #[cfg(not(target_family = "wasm"))]
    pub fn initialize_empty_file(path: &std::path::Path) -> Result<(), StorageFailure> {
        // SQLite darf nur beim ausdrücklichen Initialschritt eine neue Datei anlegen.
        let mut c = SqliteConnection::establish(path.to_str().ok_or_else(invalid)?)
            .map_err(|_| database(diesel::result::Error::NotFound))?;
        c.batch_execute("PRAGMA foreign_keys=ON; PRAGMA synchronous=FULL;")
            .map_err(database)?;
        c.immediate_transaction::<_, ReadError, _>(|c| {
            let tables: i64 = sqlite_master::table
                .filter(sqlite_master::type_.eq("table"))
                .count()
                .get_result(c)?;
            if tables != 0 {
                return Err(
                    StorageFailure::not_committed(StorageFailureCode::UpdateRequired).into(),
                );
            }
            for (name, fields, keys) in [
                (
                    "storage_meta",
                    vec![("key", false), ("value", false)],
                    vec!["key"],
                ),
                (
                    "aggregates",
                    vec![
                        ("profile_id", false),
                        ("handle", false),
                        ("space_id", false),
                        ("revision", true),
                        ("payload", false),
                    ],
                    vec!["profile_id", "handle"],
                ),
                (
                    "confirmed",
                    vec![
                        ("profile_id", false),
                        ("handle", false),
                        ("space_id", false),
                        ("epoch", false),
                        ("revision", true),
                        ("payload", false),
                    ],
                    vec!["profile_id", "handle"],
                ),
                (
                    "outbox",
                    vec![
                        ("profile_id", false),
                        ("operation_id", false),
                        ("space_id", false),
                        ("state", false),
                        ("payload", false),
                    ],
                    vec!["profile_id", "operation_id"],
                ),
                (
                    "projections",
                    vec![
                        ("profile_id", false),
                        ("space_id", false),
                        ("projection_kind", false),
                        ("projection_key", false),
                        ("payload", false),
                    ],
                    vec![
                        "profile_id",
                        "space_id",
                        "projection_kind",
                        "projection_key",
                    ],
                ),
                (
                    "sync_state",
                    vec![
                        ("profile_id", false),
                        ("space_id", false),
                        ("epoch", false),
                        ("cursor", false),
                    ],
                    vec!["profile_id", "space_id"],
                ),
            ] {
                let mut table = Table::create();
                table.table(Alias::new(name));
                for (field, integer) in fields {
                    let mut col = ColumnDef::new(Alias::new(field));
                    if integer {
                        col.big_integer();
                    } else {
                        col.text();
                    }
                    col.not_null();
                    if field == "revision" {
                        col.check(sea_query::Expr::col(Alias::new(field)).gte(1));
                    }
                    table.col(col);
                }
                let mut primary = Index::create();
                for key in keys {
                    primary.col(Alias::new(key));
                }
                table.primary_key(&mut primary);
                c.batch_execute(&table.to_string(SqliteQueryBuilder))?;
            }
            for (name, table, fields) in [
                (
                    "aggregates_by_space",
                    "aggregates",
                    vec!["profile_id", "space_id"],
                ),
                (
                    "confirmed_by_space",
                    "confirmed",
                    vec!["profile_id", "space_id"],
                ),
                (
                    "outbox_by_space_state",
                    "outbox",
                    vec!["profile_id", "space_id", "state"],
                ),
            ] {
                let mut index = Index::create();
                index.name(name).table(Alias::new(table));
                for field in fields {
                    index.col(Alias::new(field));
                }
                c.batch_execute(&index.to_string(SqliteQueryBuilder))?;
            }
            diesel::insert_into(storage_meta::table)
                .values(vec![
                    (
                        storage_meta::key.eq("storageSchemaVersion"),
                        storage_meta::value.eq("1"),
                    ),
                    (
                        storage_meta::key.eq("domainSchemaVersion"),
                        storage_meta::value.eq("1"),
                    ),
                ])
                .execute(c)?;
            Ok(())
        })
        .map_err(|e| e.0)
    }
}
