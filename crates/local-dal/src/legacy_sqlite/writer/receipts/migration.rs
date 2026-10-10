// SPDX-License-Identifier: AGPL-3.0-or-later
//! Registrierte native Erweiterung eins; vorhandene Finanz-/Speicherformen bleiben erhalten.
use super::*;
use diesel::connection::SimpleConnection;
use sea_query::{Alias, ColumnDef, Index, SqliteQueryBuilder, Table};
use wimm_local_contracts::{
    models::EncryptedBackupReceipt,
    storage_port::{BackupReadPort, SnapshotProtectionPort},
};
fn originals(c: &mut SqliteConnection) -> Result<Vec<LocalSnapshot>, ReadError> {
    let mut areas = BTreeSet::new();
    areas.extend(
        aggregates::table
            .select((aggregates::profile_id, aggregates::space_id))
            .distinct()
            .load::<(String, String)>(c)?,
    );
    areas.extend(
        confirmed::table
            .select((confirmed::profile_id, confirmed::space_id))
            .distinct()
            .load::<(String, String)>(c)?,
    );
    areas.extend(
        outbox::table
            .select((outbox::profile_id, outbox::space_id))
            .distinct()
            .load::<(String, String)>(c)?,
    );
    areas.extend(
        projections::table
            .select((projections::profile_id, projections::space_id))
            .distinct()
            .load::<(String, String)>(c)?,
    );
    areas.extend(
        sync_state::table
            .select((sync_state::profile_id, sync_state::space_id))
            .distinct()
            .load::<(String, String)>(c)?,
    );
    let keys: Vec<String> = storage_meta::table
        .filter(storage_meta::key.like("localEpoch:%"))
        .select(storage_meta::key)
        .load(c)?;
    for key in keys {
        let parts: [String; 2] = decode(key.strip_prefix("localEpoch:").ok_or_else(invalid)?)?;
        areas.insert((parts[0].clone(), parts[1].clone()));
    }
    areas
        .into_iter()
        .map(|(p, s)| {
            snapshot(
                c,
                &EntityId::new(p).map_err(|_| invalid())?,
                &EntityId::new(s).map_err(|_| invalid())?,
            )
        })
        .collect()
}
fn order(values: &mut [LocalSnapshot]) {
    values.sort_by(|a, b| {
        (a.profile_id.as_str(), a.space_id.as_str())
            .cmp(&(b.profile_id.as_str(), b.space_id.as_str()))
    });
}
impl<V: SnapshotValidationPort> LegacySqliteWriter<V> {
    /// Technische registrierte Schemaerweiterung eins, unabhängig von vorhandener Snapshotversion.
    /// Jede betroffene Profil-/Bereichssicherung muss tatsächlich gespeichert und entschlüsselt rückgelesen sein.
    pub fn enable_commit_schema(
        &mut self,
        expected: Vec<LocalSnapshot>,
        receipts: &[EncryptedBackupReceipt],
        protection: &dyn SnapshotProtectionPort<Error = StorageFailure>,
        backup: &dyn BackupReadPort<Error = StorageFailure>,
        cancellation: &dyn CancellationPort,
    ) -> Result<(), StorageFailure> {
        if cancellation.is_cancelled() {
            return Err(StorageFailure::not_committed(StorageFailureCode::Cancelled));
        }
        if expected.is_empty() || expected.len() != receipts.len() {
            return Err(StorageFailure::not_committed(
                StorageFailureCode::WriteFailed,
            ));
        }
        let mut expected = expected;
        let mut seen = BTreeSet::new();
        for (original, receipt) in expected.iter().zip(receipts) {
            if !seen.insert((original.profile_id.as_str(), original.space_id.as_str()))
                || !original.check_versions()
            {
                return Err(StorageFailure::not_committed(
                    StorageFailureCode::WriteFailed,
                ));
            }
            self.validator.validate(original)?;
            let hash = Sha256::digest(text(original).map_err(|e| e.0)?.as_bytes())
                .iter()
                .map(|b| format!("{b:02x}"))
                .collect::<String>();
            if receipt.profile_id.as_str() != original.profile_id.as_str()
                || receipt.space_id.as_str() != original.space_id.as_str()
                || receipt.epoch.as_str() != original.epoch.as_str()
                || receipt.snapshot_hash.as_str() != hash
            {
                return Err(StorageFailure::not_committed(
                    StorageFailureCode::InvalidResponse,
                ));
            }
            let cipher = backup.read(receipt)?;
            if cipher.is_empty() {
                return Err(StorageFailure::not_committed(
                    StorageFailureCode::InvalidResponse,
                ));
            }
            let restored = protection.unseal(&cipher)?;
            if text(&restored).map_err(|e| e.0)? != text(original).map_err(|e| e.0)? {
                return Err(StorageFailure::not_committed(
                    StorageFailureCode::InvalidResponse,
                ));
            }
            if cancellation.is_cancelled() {
                return Err(StorageFailure::not_committed(StorageFailureCode::Cancelled));
            }
        }
        order(&mut expected);
        self.write(|c, _, _| {
            let existing: i64 = sqlite_master::table
                .filter(sqlite_master::name.eq_any([
                    "wimm_native_schema",
                    "wimm_native_receipts",
                    "wimm_native_recovery",
                ]))
                .count()
                .get_result(c)?;
            if existing != 0 {
                return Err(fail(StorageFailureCode::UpdateRequired));
            }
            let original_version = supported(c)?;
            let current = originals(c)?;
            if text(&current)? != text(&expected)? {
                return Err(fail(StorageFailureCode::RevisionConflict));
            }
            let metadata: Vec<(String, String)> = storage_meta::table
                .order(storage_meta::key)
                .select((storage_meta::key, storage_meta::value))
                .load(c)?;
            if cancellation.is_cancelled() {
                return Err(fail(StorageFailureCode::Cancelled));
            }
            for (name, columns) in [
                (
                    "wimm_native_schema",
                    vec![
                        ("version", true, 0),
                        ("original_version", false, 0),
                        ("backups", false, 1),
                    ],
                ),
                (
                    "wimm_native_receipts",
                    vec![
                        ("identity", true, 1),
                        ("profile", false, 1),
                        ("space", false, 1),
                        ("request", false, 1),
                        ("receipt", false, 1),
                    ],
                ),
                (
                    "wimm_native_recovery",
                    vec![("profile", true, 1), ("ticket", false, 2)],
                ),
            ] {
                let mut ddl = Table::create();
                ddl.table(Alias::new(name));
                for (name, primary, kind) in columns {
                    let mut column = ColumnDef::new(Alias::new(name));
                    match kind {
                        0 => {
                            column.integer();
                        }
                        1 => {
                            column.text();
                        }
                        _ => {
                            column.binary();
                        }
                    };
                    column.not_null();
                    if primary {
                        column.primary_key();
                    }
                    ddl.col(column);
                }
                // SeaQuery erzeugt ausschließlich diesen registrierten DDL-Schritt.
                c.batch_execute(&ddl.to_string(SqliteQueryBuilder))?;
                if cancellation.is_cancelled() {
                    return Err(fail(StorageFailureCode::Cancelled));
                }
            }
            let index = Index::create()
                .name("wimm_native_receipts_by_area")
                .table(Alias::new("wimm_native_receipts"))
                .col(Alias::new("profile"))
                .col(Alias::new("space"))
                .to_string(SqliteQueryBuilder);
            c.batch_execute(&index)?;
            if cancellation.is_cancelled() {
                return Err(fail(StorageFailureCode::Cancelled));
            }
            diesel::insert_into(wimm_native_schema::table)
                .values((
                    wimm_native_schema::version.eq(1),
                    wimm_native_schema::original_version.eq(original_version as i32),
                    wimm_native_schema::backups.eq(text(receipts)?),
                ))
                .execute(c)?;
            // Alte Apps kennen nur die physischen Werte eins/zwei und müssen neue Writes verweigern.
            diesel::update(storage_meta::table.find("storageSchemaVersion"))
                .set(storage_meta::value.eq("3"))
                .execute(c)?;
            let after = originals(c)?;
            let after_metadata: Vec<(String, String)> = storage_meta::table
                .order(storage_meta::key)
                .select((storage_meta::key, storage_meta::value))
                .load(c)?;
            let mut preserved_metadata = metadata;
            for (key, value) in &mut preserved_metadata {
                if key == "storageSchemaVersion" {
                    *value = "3".into();
                }
            }
            if text(&after)? != text(&expected)? || after_metadata != preserved_metadata {
                return Err(fail(StorageFailureCode::InvalidResponse));
            }
            if cancellation.is_cancelled() {
                return Err(fail(StorageFailureCode::Cancelled));
            }
            Ok(())
        })
    }
}
