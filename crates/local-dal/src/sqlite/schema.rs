// SPDX-License-Identifier: AGPL-3.0-or-later
//! Vollständiges aktuelles Schema; keine historischen Upgrade- oder Bestandsübernahmepfade.
use super::*;
use diesel::connection::SimpleConnection;
use sea_query::{
    Alias, ColumnDef, ExprTrait, ForeignKey, ForeignKeyAction, Index, SqliteQueryBuilder, Table,
};
use wimm_local_contracts::storage_port::CancellationPort;
#[cfg(not(target_family = "wasm"))]
use wimm_local_contracts::storage_port::NeverCancel;
pub const PHYSICAL_VERSION: u32 = 5;
pub const SNAPSHOT_VERSION: u32 = 2;
fn cancelled() -> ReadError {
    StorageFailure::not_committed(StorageFailureCode::Cancelled).into()
}
pub(super) fn statements() -> Vec<(String, String, String)> {
    let mut statements = Vec::new();
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
        statements.push((
            name.to_owned(),
            "table".to_owned(),
            table.to_string(SqliteQueryBuilder),
        ));
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
        statements.push((
            name.to_owned(),
            "index".to_owned(),
            index.to_string(SqliteQueryBuilder),
        ));
    }

    for (name, columns, keys) in [
        (
            "wimm_native_receipts",
            vec![
                ("identity", false),
                ("profile", false),
                ("space", false),
                ("request", false),
                ("receipt", false),
            ],
            vec!["identity"],
        ),
        (
            "wimm_native_recovery",
            vec![("profile", false), ("ticket", true)],
            vec!["profile"],
        ),
    ] {
        let mut table = Table::create();
        table.table(Alias::new(name));
        for (field, binary) in columns {
            let mut column = ColumnDef::new(Alias::new(field));
            if binary {
                column.binary();
            } else {
                column.text();
            }
            column.not_null();
            table.col(column);
        }
        let mut primary = Index::create();
        for field in keys {
            primary.col(Alias::new(field));
        }
        table.primary_key(&mut primary);
        statements.push((
            name.into(),
            "table".into(),
            table.to_string(SqliteQueryBuilder),
        ));
    }
    let index = Index::create()
        .name("wimm_native_receipts_by_area")
        .table(Alias::new("wimm_native_receipts"))
        .col(Alias::new("profile"))
        .col(Alias::new("space"))
        .to_string(SqliteQueryBuilder);
    statements.push(("wimm_native_receipts_by_area".into(), "index".into(), index));
    let mut categories = Table::create();
    categories.table(Alias::new("transaction_categories"));
    for name in ["profile_id", "handle", "space_id", "category_id", "date"] {
        categories.col(ColumnDef::new(Alias::new(name)).text().not_null());
    }
    categories.primary_key(
        Index::create()
            .col(Alias::new("profile_id"))
            .col(Alias::new("handle"))
            .col(Alias::new("category_id")),
    );
    categories.foreign_key(
        ForeignKey::create()
            .from(
                Alias::new("transaction_categories"),
                (Alias::new("profile_id"), Alias::new("handle")),
            )
            .to(
                Alias::new("aggregates"),
                (Alias::new("profile_id"), Alias::new("handle")),
            )
            .on_delete(ForeignKeyAction::Cascade),
    );
    statements.push((
        "transaction_categories".into(),
        "table".into(),
        categories.to_string(SqliteQueryBuilder),
    ));
    for (name, table, fields, predicate) in [
        (
            "transactions_by_account_date",
            "aggregates",
            vec![
                "profile_id",
                "space_id",
                "json_extract(payload,'$.accountId')",
                "json_extract(payload,'$.date')",
                "handle",
            ],
            Some(
                "json_extract(payload,'$.aggregateType')='transaction' AND json_extract(payload,'$.deletedAt') IS NULL",
            ),
        ),
        (
            "transactions_by_import_reference",
            "aggregates",
            vec![
                "profile_id",
                "space_id",
                "json_extract(payload,'$.importReference')",
                "json_extract(payload,'$.date')",
                "handle",
            ],
            Some(
                "json_extract(payload,'$.aggregateType')='transaction' AND json_extract(payload,'$.deletedAt') IS NULL",
            ),
        ),
        (
            "import_sources_by_external",
            "aggregates",
            vec![
                "profile_id",
                "space_id",
                "json_extract(payload,'$.accountId')",
                "json_extract(payload,'$.parserSource')",
                "json_extract(payload,'$.externalId')",
                "handle",
            ],
            Some(
                "json_extract(payload,'$.aggregateType')='importFingerprint' AND json_extract(payload,'$.deletedAt') IS NULL",
            ),
        ),
        (
            "rules_by_order",
            "aggregates",
            vec![
                "profile_id",
                "space_id",
                "json_extract(payload,'$.order')",
                "handle",
            ],
            Some(
                "json_extract(payload,'$.aggregateType')='rule' AND json_extract(payload,'$.deletedAt') IS NULL",
            ),
        ),
        (
            "occurrences_by_schedule_date",
            "aggregates",
            vec![
                "profile_id",
                "space_id",
                "json_extract(payload,'$.scheduleId')",
                "json_extract(payload,'$.dueDate')",
                "handle",
            ],
            Some(
                "json_extract(payload,'$.aggregateType')='scheduleOccurrence' AND json_extract(payload,'$.deletedAt') IS NULL",
            ),
        ),
        (
            "outbox_by_state_created",
            "outbox",
            vec![
                "profile_id",
                "space_id",
                "state",
                "COALESCE(json_extract(payload,'$.createdAt'),'')",
                "operation_id",
            ],
            None,
        ),
        (
            "transactions_by_category_date",
            "transaction_categories",
            vec!["profile_id", "space_id", "category_id", "date", "handle"],
            None,
        ),
    ] {
        if fields
            .iter()
            .any(|field| field.starts_with("json_extract") || field.starts_with("COALESCE"))
        {
            // SeaQuery 1.0.2 unterstützt Expr-Indizes im SQLitebuilder nicht (panic).
            // Ausschließlich feste registrierte Ausdrücke/Namen; keine Caller-SQL-/DDLdaten.
            let suffix = predicate.map(|p| format!(" WHERE {p}")).unwrap_or_default();
            statements.push((
                name.into(),
                "index".into(),
                format!(
                    "CREATE INDEX {name} ON {table}({}){suffix}",
                    fields.join(",")
                ),
            ));
        } else {
            let mut index = Index::create();
            index.name(name).table(Alias::new(table));
            for field in fields {
                index.col(Alias::new(field));
            }
            statements.push((
                name.into(),
                "index".into(),
                index.to_string(SqliteQueryBuilder),
            ));
        }
    }

    // SeaQuery 1.0.2 besitzt keine SQLite-Trigger-/json_each-DSL. Ausschließlich feste interne DDL.
    for (name,sql) in [
        ("transaction_categories_insert", "CREATE TRIGGER transaction_categories_insert AFTER INSERT ON aggregates BEGIN
 INSERT INTO transaction_categories SELECT DISTINCT new.profile_id,new.handle,new.space_id,json_extract(j.value,'$.categoryId'),json_extract(new.payload,'$.date') FROM json_each(new.payload,'$.splits') j
 WHERE json_extract(new.payload,'$.aggregateType')='transaction' AND json_extract(new.payload,'$.deletedAt') IS NULL;
END"),
        ("transaction_categories_update", "CREATE TRIGGER transaction_categories_update AFTER UPDATE ON aggregates BEGIN
 DELETE FROM transaction_categories WHERE profile_id=old.profile_id AND handle=old.handle;
 INSERT INTO transaction_categories SELECT DISTINCT new.profile_id,new.handle,new.space_id,json_extract(j.value,'$.categoryId'),json_extract(new.payload,'$.date') FROM json_each(new.payload,'$.splits') j
 WHERE json_extract(new.payload,'$.aggregateType')='transaction' AND json_extract(new.payload,'$.deletedAt') IS NULL;
END"),
    ] {statements.push((name.into(),"trigger".into(),sql.into()));}
    statements
}
impl SqliteStore {
    #[cfg(not(target_family = "wasm"))]
    pub fn initialize_empty_file(path: &std::path::Path) -> Result<(), StorageFailure> {
        Self::initialize_empty_file_cancellable(path, &NeverCancel)
    }
    #[cfg(not(target_family = "wasm"))]
    pub fn initialize_empty_file_cancellable(
        path: &std::path::Path,
        cancel: &dyn CancellationPort,
    ) -> Result<(), StorageFailure> {
        if cancel.is_cancelled() {
            return Err(cancelled().0);
        }
        let mut c = SqliteConnection::establish(path.to_str().ok_or_else(invalid)?)
            .map_err(|_| database(diesel::result::Error::NotFound))?;
        Self::initialize_connection_cancellable(&mut c, cancel)
    }
    /// Ausschließlich expliziter Initialschritt auf einer leeren nativen oder WASM-Verbindung.
    pub fn initialize_connection_cancellable(
        c: &mut SqliteConnection,
        cancel: &dyn CancellationPort,
    ) -> Result<(), StorageFailure> {
        c.batch_execute("PRAGMA foreign_keys=ON; PRAGMA synchronous=FULL;")
            .map_err(database)?;
        c.immediate_transaction::<_, ReadError, _>(|c| {
            let objects: i64 = sqlite_master::table.count().get_result(c)?;
            if objects != 0 {
                return Err(
                    StorageFailure::not_committed(StorageFailureCode::UpdateRequired).into(),
                );
            }
            for (_, _, sql) in statements() {
                if cancel.is_cancelled() {
                    return Err(cancelled());
                }
                c.batch_execute(&sql)?;
            }
            diesel::insert_into(storage_meta::table)
                .values([
                    (
                        storage_meta::key.eq("storageSchemaVersion"),
                        storage_meta::value.eq(PHYSICAL_VERSION.to_string()),
                    ),
                    (
                        storage_meta::key.eq("domainSchemaVersion"),
                        storage_meta::value.eq("1".to_owned()),
                    ),
                    (
                        storage_meta::key.eq("snapshotSchemaVersion"),
                        storage_meta::value.eq(SNAPSHOT_VERSION.to_string()),
                    ),
                ])
                .execute(c)?;
            supported(c)?;
            if cancel.is_cancelled() {
                return Err(cancelled());
            }
            Ok(())
        })
        .map_err(|e| e.0)
    }
}
