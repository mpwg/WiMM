// SPDX-License-Identifier: AGPL-3.0-or-later
//! Registrierter Indexschritt eins: vollständige Sicherung vor DSL/Backfill und atomarem Journal.
use super::*;
use sea_query::{Alias, ColumnDef, ForeignKey, ForeignKeyAction, Index, SqliteQueryBuilder, Table};
use wimm_local_contracts::{
    checkpoint_v2::LocalCheckpointV2,
    models::EncryptedBackupReceipt,
    storage_port::{BackupReadPort, SnapshotProtectionPort},
};
const SPLIT_MAINTENANCE:&str="
CREATE TRIGGER transaction_categories_insert AFTER INSERT ON aggregates BEGIN
 INSERT INTO transaction_categories SELECT DISTINCT new.profile_id,new.handle,new.space_id,json_extract(j.value,'$.categoryId'),json_extract(new.payload,'$.date') FROM json_each(new.payload,'$.splits') j
 WHERE json_extract(new.payload,'$.aggregateType')='transaction' AND json_extract(new.payload,'$.deletedAt') IS NULL;
END;
CREATE TRIGGER transaction_categories_update AFTER UPDATE ON aggregates BEGIN
 DELETE FROM transaction_categories WHERE profile_id=old.profile_id AND handle=old.handle;
 INSERT INTO transaction_categories SELECT DISTINCT new.profile_id,new.handle,new.space_id,json_extract(j.value,'$.categoryId'),json_extract(new.payload,'$.date') FROM json_each(new.payload,'$.splits') j
 WHERE json_extract(new.payload,'$.aggregateType')='transaction' AND json_extract(new.payload,'$.deletedAt') IS NULL;
END;
INSERT INTO transaction_categories SELECT DISTINCT a.profile_id,a.handle,a.space_id,json_extract(j.value,'$.categoryId'),json_extract(a.payload,'$.date') FROM aggregates a,json_each(a.payload,'$.splits') j
 WHERE json_extract(a.payload,'$.aggregateType')='transaction' AND json_extract(a.payload,'$.deletedAt') IS NULL;
";
diesel::table! { #[sql_name="storage_migrations"] index_journal (number) { #[sql_name="number"] number -> Integer, from_storage -> Integer,to_storage -> Integer,domain_version -> Integer,backup_id -> Text,snapshot_hash -> Text,profile_id -> Text,space_id -> Text,epoch -> Text, } }
fn ddl(c: &mut SqliteConnection, cancel: &dyn CancellationPort) -> Result<(), ReadError> {
    use diesel::connection::SimpleConnection;
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
    c.batch_execute(&categories.to_string(SqliteQueryBuilder))?;
    if cancel.is_cancelled() {
        return Err(fail(StorageFailureCode::Cancelled));
    }
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
                "CASE WHEN json_type(payload,'$.createdAt')='text' THEN json_extract(payload,'$.createdAt') WHEN json_type(payload,'$.draft.occurredAt')='text' THEN json_extract(payload,'$.draft.occurredAt') ELSE '' END",
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
            .any(|field| field.starts_with("json_extract") || field.starts_with("CASE "))
        {
            // SeaQuery 1.0.2 unterstützt Expr-Indizes im SQLitebuilder nicht (panic).
            // Ausschließlich feste registrierte Ausdrücke/Namen; keine Caller-SQL-/DDLdaten.
            let suffix = predicate.map(|p| format!(" WHERE {p}")).unwrap_or_default();
            c.batch_execute(&format!(
                "CREATE INDEX {name} ON {table}({}){suffix}",
                fields.join(",")
            ))?;
        } else {
            let mut index = Index::create();
            index.name(name).table(Alias::new(table));
            for field in fields {
                index.col(Alias::new(field));
            }
            c.batch_execute(&index.to_string(SqliteQueryBuilder))?;
        }
        if cancel.is_cancelled() {
            return Err(fail(StorageFailureCode::Cancelled));
        }
    }
    // SeaQuery besitzt keine SQLite-Trigger-/json_each-Backfill-DSL; exakt registrierte technische Ausnahme.
    c.batch_execute(SPLIT_MAINTENANCE)?;
    let mut journal = Table::create();
    journal.table(Alias::new("storage_migrations"));
    for name in ["number", "from_storage", "to_storage", "domain_version"] {
        let mut col = ColumnDef::new(Alias::new(name));
        col.integer().not_null();
        if name == "number" {
            col.primary_key();
        }
        journal.col(col);
    }
    for name in [
        "backup_id",
        "snapshot_hash",
        "profile_id",
        "space_id",
        "epoch",
    ] {
        journal.col(ColumnDef::new(Alias::new(name)).text().not_null());
    }
    c.batch_execute(&journal.to_string(SqliteQueryBuilder))?;
    if cancel.is_cancelled() {
        return Err(fail(StorageFailureCode::Cancelled));
    }
    Ok(())
}
impl<V: SnapshotValidationPort> LegacySqliteWriter<V> {
    pub fn migrate_indexes(
        &mut self,
        mut expected: Vec<LocalCheckpointV2>,
        proofs: &[EncryptedBackupReceipt],
        protection: &dyn SnapshotProtectionPort<LocalCheckpointV2, Error = StorageFailure>,
        backup: &dyn BackupReadPort<Error = StorageFailure>,
        cancel: &dyn CancellationPort,
    ) -> Result<(), StorageFailure> {
        if expected.is_empty() || expected.len() != proofs.len() {
            return Err(StorageFailure::not_committed(
                StorageFailureCode::InvalidResponse,
            ));
        }
        for (original, proof) in expected.iter().zip(proofs) {
            original.validate().map_err(|_| invalid())?;
            self.validator.validate(&original.snapshot)?;
            if original.physical_schema_version != 4
                || original.snapshot.storage_schema_version.value() != 1
                || proof.profile_id.as_str() != original.snapshot.profile_id.as_str()
                || proof.space_id.as_str() != original.snapshot.space_id.as_str()
                || proof.epoch.as_str() != original.snapshot.epoch.as_str()
                || proof.snapshot_hash.as_str() != checkpoint::hash(original).map_err(|e| e.0)?
            {
                return Err(StorageFailure::not_committed(
                    StorageFailureCode::InvalidResponse,
                ));
            }
            let saved = protection.unseal(&backup.read(proof)?)?;
            if text(&saved).map_err(|e| e.0)? != text(original).map_err(|e| e.0)? {
                return Err(StorageFailure::not_committed(
                    StorageFailureCode::RevisionConflict,
                ));
            }
        }
        expected.sort_by(|a, b| {
            (a.snapshot.profile_id.as_str(), a.snapshot.space_id.as_str())
                .cmp(&(b.snapshot.profile_id.as_str(), b.snapshot.space_id.as_str()))
        });
        self.write(|c, _, _| {
            if supported(c)? != 1 {
                return Err(fail(StorageFailureCode::UpdateRequired));
            }
            let existing: i64 = sqlite_master::table
                .filter(sqlite_master::name.eq_any([
                    "transaction_categories",
                    "storage_migrations",
                    "transactions_by_account_date",
                    "transactions_by_category_date",
                    "transactions_by_import_reference",
                    "outbox_by_state_created",
                    "rules_by_order",
                    "occurrences_by_schedule_date",
                    "import_sources_by_external",
                ]))
                .count()
                .get_result(c)?;
            if existing != 0 {
                return Err(fail(StorageFailureCode::UpdateRequired));
            }
            let mut current = Vec::new();
            for area in migration::originals(c)? {
                current.push(checkpoint::capture(c, &area.profile_id, &area.space_id)?);
            }
            if text(&current)? != text(&expected)? {
                return Err(fail(StorageFailureCode::RevisionConflict));
            }
            if cancel.is_cancelled() {
                return Err(fail(StorageFailureCode::Cancelled));
            }
            ddl(c, cancel)?;
            // DML bleibt ORM; alter Journalvertrag enthält den ersten Beleg, vollständige Belege zusätzlich separat.
            let first = &proofs[0];
            diesel::insert_into(index_journal::table)
                .values((
                    index_journal::number.eq(1),
                    index_journal::from_storage.eq(1),
                    index_journal::to_storage.eq(2),
                    index_journal::domain_version.eq(1),
                    index_journal::backup_id.eq(first.backup_id.as_str()),
                    index_journal::snapshot_hash.eq(first.snapshot_hash.as_str()),
                    index_journal::profile_id.eq(first.profile_id.as_str()),
                    index_journal::space_id.eq(first.space_id.as_str()),
                    index_journal::epoch.eq(first.epoch.as_str()),
                ))
                .execute(c)?;
            diesel::insert_into(storage_meta::table)
                .values((
                    storage_meta::key.eq("localIndexMigrationBackups"),
                    storage_meta::value.eq(text(proofs)?),
                ))
                .execute(c)?;
            diesel::insert_into(storage_meta::table)
                .values((
                    storage_meta::key.eq("domainSchemaVersion"),
                    storage_meta::value.eq("1"),
                ))
                .on_conflict(storage_meta::key)
                .do_update()
                .set(storage_meta::value.eq("1"))
                .execute(c)?;
            diesel::update(wimm_native_schema::table)
                .set(wimm_native_schema::original_version.eq(2))
                .execute(c)?;
            for original in &expected {
                let actual = checkpoint::capture(
                    c,
                    &original.snapshot.profile_id,
                    &original.snapshot.space_id,
                )?;
                let mut target = original.clone();
                target.snapshot.storage_schema_version =
                    SnapshotStorageVersion::new(2).map_err(|_| invalid())?;
                if text(&actual)? != text(&target)? {
                    return Err(fail(StorageFailureCode::InvalidResponse));
                }
            }
            if cancel.is_cancelled() {
                return Err(fail(StorageFailureCode::Cancelled));
            }
            Ok(())
        })
    }
}
