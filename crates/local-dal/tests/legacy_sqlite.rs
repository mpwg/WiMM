// SPDX-License-Identifier: AGPL-3.0-or-later
#![forbid(unsafe_code)]
#![cfg(all(feature = "sqlite", not(target_family = "wasm")))]
mod support;
use diesel::{connection::SimpleConnection, prelude::*};
use support::*;
use wimm_local_contracts::{persistence_errors::StorageFailureCode, storage::*};
use wimm_local_dal::legacy_sqlite::LegacySqliteStore;

#[derive(QueryableByName)]
struct Payload {
    #[diesel(sql_type=diesel::sql_types::Text)]
    payload: String,
}
fn fixture(path: &std::path::Path) -> SqliteConnection {
    let mut db = SqliteConnection::establish(path.to_str().unwrap()).unwrap();
    db.batch_execute(include_str!("fixtures/legacy-schema.sql"))
        .unwrap();
    db.batch_execute("INSERT INTO storage_meta VALUES ('storageSchemaVersion','1');")
        .unwrap();
    // Vorhandene V1-Datenbank ohne Fachversionszeile; vollständige synthetische Fachmodelle.
    let r = request(30, 1);
    let a = &r.batch.aggregates[0];
    let pending = &r.batch.outbox[0];
    let projection = &r.batch.projections[0];
    diesel::sql_query("INSERT INTO aggregates VALUES (?,?,?,?,?)")
        .bind::<diesel::sql_types::Text, _>(id(1).as_str())
        .bind::<diesel::sql_types::Text, _>(a.handle.as_str())
        .bind::<diesel::sql_types::Text, _>(id(2).as_str())
        .bind::<diesel::sql_types::BigInt, _>(1i64)
        .bind::<diesel::sql_types::Text, _>(serde_json::to_string(a).unwrap())
        .execute(&mut db)
        .unwrap();
    let c = ConfirmedAggregate {
        space_id: id(2),
        epoch: id(3),
        aggregate: a.clone(),
    };
    diesel::sql_query("INSERT INTO confirmed VALUES (?,?,?,?,?,?)")
        .bind::<diesel::sql_types::Text, _>(id(1).as_str())
        .bind::<diesel::sql_types::Text, _>(a.handle.as_str())
        .bind::<diesel::sql_types::Text, _>(id(2).as_str())
        .bind::<diesel::sql_types::Text, _>(id(3).as_str())
        .bind::<diesel::sql_types::BigInt, _>(1i64)
        .bind::<diesel::sql_types::Text, _>(serde_json::to_string(&c).unwrap())
        .execute(&mut db)
        .unwrap();
    diesel::sql_query("INSERT INTO outbox VALUES (?,?,?,?,?)")
        .bind::<diesel::sql_types::Text, _>(id(1).as_str())
        .bind::<diesel::sql_types::Text, _>(pending.operation_id.as_str())
        .bind::<diesel::sql_types::Text, _>(id(2).as_str())
        .bind::<diesel::sql_types::Text, _>("queued")
        .bind::<diesel::sql_types::Text, _>(serde_json::to_string(pending).unwrap())
        .execute(&mut db)
        .unwrap();
    diesel::sql_query("INSERT INTO projections VALUES (?,?,?,?,?)")
        .bind::<diesel::sql_types::Text, _>(id(1).as_str())
        .bind::<diesel::sql_types::Text, _>(id(2).as_str())
        .bind::<diesel::sql_types::Text, _>("balance")
        .bind::<diesel::sql_types::Text, _>(a.handle.as_str())
        .bind::<diesel::sql_types::Text, _>(serde_json::to_string(projection).unwrap())
        .execute(&mut db)
        .unwrap();
    diesel::sql_query("INSERT INTO storage_meta VALUES (?,?)")
        .bind::<diesel::sql_types::Text, _>(format!(
            "localEpoch:{}",
            serde_json::json!([id(1).as_str(), id(2).as_str()])
        ))
        .bind::<diesel::sql_types::Text, _>(id(3).as_str())
        .execute(&mut db)
        .unwrap();
    db
}
#[test]
fn opens_existing_native_file_without_schema_or_data_change_and_reopens() {
    let file = path("legacy-read");
    drop(fixture(&file));
    let original = std::fs::read(&file).unwrap();
    for _ in 0..2 {
        let db = LegacySqliteStore::open(&file, id(1)).unwrap();
        let s = db.export_snapshot(&id(2)).unwrap();
        assert_eq!(s.storage_schema_version.value(), 1);
        assert_eq!(s.epoch, id(3));
        assert!(s.sync_state.is_none());
        assert_eq!(s.aggregates.len(), 1);
        assert_eq!(s.confirmed.len(), 1);
        assert_eq!(s.pending.len(), 1);
        assert_eq!(s.projections.len(), 1);
        let r = request(30, 1);
        assert_eq!(
            serde_json::to_value(&s.aggregates).unwrap(),
            serde_json::to_value(&r.batch.aggregates).unwrap()
        );
        assert_eq!(
            serde_json::to_value(&s.pending).unwrap(),
            serde_json::to_value(&r.batch.outbox).unwrap()
        );
        assert_eq!(
            serde_json::to_value(&s.projections).unwrap(),
            serde_json::to_value(&r.batch.projections).unwrap()
        );
        assert_eq!(
            serde_json::to_value(db.read_aggregate(&id(4)).unwrap()).unwrap(),
            serde_json::to_value(&s.aggregates[0]).unwrap()
        );
        assert!(
            LegacySqliteStore::open(&file, id(90))
                .unwrap()
                .read_aggregate(&id(4))
                .unwrap()
                .is_none()
        );
    }
    assert_eq!(std::fs::read(&file).unwrap(), original);
}
#[test]
fn missing_unknown_and_incomplete_migrated_files_are_never_created_or_repaired() {
    let file = path("legacy-missing");
    assert!(LegacySqliteStore::open(&file, id(1)).is_err());
    assert!(!file.exists());
    for sql in [
        "UPDATE storage_meta SET value='99' WHERE key='storageSchemaVersion'",
        "UPDATE storage_meta SET value='2' WHERE key='storageSchemaVersion'",
        "INSERT INTO storage_meta VALUES ('domainSchemaVersion','2')",
    ] {
        let file = path("legacy-version");
        let mut db = fixture(&file);
        db.batch_execute(sql).unwrap();
        drop(db);
        let before = std::fs::read(&file).unwrap();
        assert_eq!(
            LegacySqliteStore::open(&file, id(1)).err().unwrap().code,
            StorageFailureCode::UpdateRequired
        );
        assert_eq!(std::fs::read(&file).unwrap(), before);
    }
}
#[test]
fn mismatched_metadata_is_rejected_without_rewriting_originals() {
    for sql in [
        "UPDATE aggregates SET revision=2",
        "UPDATE confirmed SET revision=2",
        "UPDATE outbox SET state='conflict'",
        "UPDATE projections SET projection_kind='consumption'",
    ] {
        let file = path("legacy-corrupt");
        let mut c = fixture(&file);
        c.batch_execute(sql).unwrap();
        drop(c);
        let before = std::fs::read(&file).unwrap();
        let db = LegacySqliteStore::open(&file, id(1)).unwrap();
        assert_eq!(
            db.export_snapshot(&id(2)).unwrap_err().code,
            StorageFailureCode::InvalidResponse
        );
        drop(db);
        assert_eq!(std::fs::read(&file).unwrap(), before);
    }
}
#[test]
fn real_concurrent_writer_preserves_separate_confirmed_local_pending_and_cursor_views() {
    let file = path("legacy-concurrent");
    let mut writer = fixture(&file);
    writer.batch_execute("PRAGMA journal_mode=WAL").unwrap();
    let originals = diesel::sql_query("SELECT payload FROM outbox")
        .load::<Payload>(&mut writer)
        .unwrap();
    assert_eq!(
        serde_json::from_str::<serde_json::Value>(&originals[0].payload).unwrap(),
        serde_json::to_value(&request(30, 1).batch.outbox[0]).unwrap()
    );
    let reader = LegacySqliteStore::open(&file, id(1)).unwrap();
    writer
        .batch_execute("BEGIN IMMEDIATE; DELETE FROM outbox;")
        .unwrap();
    diesel::sql_query("INSERT INTO sync_state VALUES (?,?,?,?)")
        .bind::<diesel::sql_types::Text, _>(id(1).as_str())
        .bind::<diesel::sql_types::Text, _>(id(2).as_str())
        .bind::<diesel::sql_types::Text, _>(id(3).as_str())
        .bind::<diesel::sql_types::Text, _>("9007199254740993")
        .execute(&mut writer)
        .unwrap();
    let before = reader.export_snapshot(&id(2)).unwrap();
    assert_eq!(before.pending.len(), 1);
    assert!(before.sync_state.is_none());
    writer.batch_execute("COMMIT").unwrap();
    let after = reader.export_snapshot(&id(2)).unwrap();
    assert!(after.pending.is_empty());
    assert_eq!(after.sync_state.unwrap().cursor, "9007199254740993");
    assert_eq!(
        serde_json::to_value(before.aggregates).unwrap(),
        serde_json::to_value(after.aggregates).unwrap()
    );
    assert_eq!(
        serde_json::to_value(before.confirmed).unwrap(),
        serde_json::to_value(after.confirmed).unwrap()
    );
    // Die ursprüngliche opake Entwurfsform wurde beim Lesen nicht angefasst.
    assert!(
        diesel::sql_query("SELECT payload FROM outbox")
            .load::<Payload>(&mut writer)
            .unwrap()
            .is_empty()
    );
}

#[test]
fn existing_v2_registered_indexes_and_journal_open_without_changes() {
    let file = path("legacy-v2-ä-?#");
    let mut db = fixture(&file);
    let migration_source = include_str!("../../../apps/desktop/src-tauri/src/migration.rs");
    let sql = migration_source
        .split("CREATE INDEX transactions_by_account_date")
        .nth(1)
        .unwrap()
        .split("\";")
        .next()
        .unwrap();
    db.batch_execute(&format!("CREATE INDEX transactions_by_account_date{sql}"))
        .unwrap();
    db.batch_execute("INSERT INTO storage_migrations VALUES(1,1,2,1,'synthetic-backup','synthetic-hash','synthetic-profile','synthetic-space','synthetic-epoch'); UPDATE storage_meta SET value='2' WHERE key='storageSchemaVersion'; INSERT INTO storage_meta VALUES('domainSchemaVersion','1');").unwrap();
    drop(db);
    let original = std::fs::read(&file).unwrap();
    let reader = LegacySqliteStore::open(&file, id(1)).unwrap();
    assert_eq!(
        reader
            .export_snapshot(&id(2))
            .unwrap()
            .storage_schema_version
            .value(),
        2
    );
    drop(reader);
    assert_eq!(std::fs::read(&file).unwrap(), original);
}
#[test]
fn fixture_schema_matches_the_current_tauri_initial_schema() {
    let source = include_str!("../../../apps/desktop/src-tauri/src/storage.rs");
    let sql = source
        .split("\"CREATE TABLE IF NOT EXISTS storage_meta")
        .nth(1)
        .unwrap()
        .split("\",\n    )?;")
        .next()
        .unwrap();
    let fixture = include_str!("fixtures/legacy-schema.sql")
        .split("CREATE TABLE IF NOT EXISTS storage_meta")
        .nth(1)
        .unwrap();
    assert_eq!(fixture.trim(), sql.trim());
}

#[test]
fn child_process_reads_original_native_snapshot() {
    let Some(file) = std::env::var_os("WIMM_DAL03_READ_FILE") else {
        return;
    };
    let db = LegacySqliteStore::open(std::path::Path::new(&file), id(1)).unwrap();
    let snapshot = db.export_snapshot(&id(2)).unwrap();
    assert_eq!(snapshot.epoch, id(3));
    assert_eq!(
        serde_json::to_value(snapshot.aggregates).unwrap(),
        serde_json::to_value(request(30, 1).batch.aggregates).unwrap()
    );
    assert_eq!(
        serde_json::to_value(snapshot.pending).unwrap(),
        serde_json::to_value(request(30, 1).batch.outbox).unwrap()
    );
    assert_eq!(snapshot.confirmed.len(), 1);
    assert_eq!(snapshot.projections.len(), 1);
}
#[test]
fn native_file_is_read_by_a_separate_rust_process() {
    let file = path("legacy-process");
    drop(fixture(&file));
    let before = std::fs::read(&file).unwrap();
    let result = std::process::Command::new(std::env::current_exe().unwrap())
        .args([
            "--exact",
            "child_process_reads_original_native_snapshot",
            "--nocapture",
        ])
        .env("WIMM_DAL03_READ_FILE", &file)
        .output()
        .unwrap();
    assert!(
        result.status.success(),
        "{}",
        String::from_utf8_lossy(&result.stderr)
    );
    assert!(String::from_utf8_lossy(&result.stdout).contains("1 passed"));
    assert_eq!(std::fs::read(&file).unwrap(), before);
}
#[test]
fn versions_are_revalidated_after_opening_without_mutation() {
    let file = path("legacy-revalidate");
    let mut writer = fixture(&file);
    writer.batch_execute("PRAGMA journal_mode=WAL").unwrap();
    let reader = LegacySqliteStore::open(&file, id(1)).unwrap();
    assert!(reader.read_aggregate(&id(4)).unwrap().is_some());
    writer
        .batch_execute("UPDATE storage_meta SET value='99' WHERE key='storageSchemaVersion'")
        .unwrap();
    assert_eq!(
        reader.read_aggregate(&id(4)).unwrap_err().code,
        StorageFailureCode::UpdateRequired
    );
    assert_eq!(
        reader.export_snapshot(&id(2)).unwrap_err().code,
        StorageFailureCode::UpdateRequired
    );
}
