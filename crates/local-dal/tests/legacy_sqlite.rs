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

use wimm_local_contracts::{commit::SnapshotValidationPort, storage_port::LocalStoragePort};
use wimm_local_dal::legacy_sqlite::LegacySqliteWriter;
struct CoreValidator;
impl SnapshotValidationPort for CoreValidator {
    fn validate(
        &self,
        s: &LocalSnapshot,
    ) -> Result<(), wimm_local_contracts::persistence_errors::StorageFailure> {
        use wimm_finance_types::state_contracts::ValidationRequest;
        let invalid = || {
            wimm_local_contracts::persistence_errors::StorageFailure::not_committed(
                StorageFailureCode::WriteFailed,
            )
        };
        for aggregates in [
            s.aggregates.iter().map(|a| a.aggregate.clone()).collect(),
            s.confirmed
                .iter()
                .map(|a| a.aggregate.aggregate.clone())
                .collect(),
        ] {
            wimm_finance_core::validate(ValidationRequest::Historical {
                contract_version: 1.into(),
                domain_schema_version: 1.into(),
                space_id: s.space_id.clone(),
                aggregates,
            })
            .map_err(|_| invalid())?;
        }
        let aggregates = s
            .aggregates
            .iter()
            .map(|a| serde_json::to_value(&a.aggregate).unwrap())
            .collect::<Vec<_>>();
        let projections = s
            .projections
            .iter()
            .map(|a| serde_json::to_value(a).unwrap())
            .collect::<Vec<_>>();
        wimm_finance_core::projection_cache::validate(&aggregates, &projections)
            .map_err(|_| invalid())
    }
}
fn snapshot_value(db: &LegacySqliteWriter<CoreValidator>) -> serde_json::Value {
    serde_json::to_value(db.export_snapshot(&id(2)).unwrap()).unwrap()
}
fn sync_page(revision: u32) -> SyncPage {
    let a = request(31, revision).batch.aggregates.remove(0);
    SyncPage {
        state: SyncState {
            profile_id: id(1),
            space_id: id(2),
            epoch: id(3),
            cursor: "9007199254740993".into(),
        },
        confirmed: vec![ConfirmedAggregate {
            space_id: id(2),
            epoch: id(3),
            aggregate: a,
        }],
        remove_operation_ids: vec![id(130)],
        projections: request(31, revision).batch.projections,
    }
}
#[test]
fn all_eleven_orm_storage_ports_preserve_separate_data_and_real_restart() {
    let file = path("legacy-ports");
    drop(fixture(&file));
    let mut db = LegacySqliteWriter::open(&file, id(1), CoreValidator).unwrap();
    let original = db.export_snapshot(&id(2)).unwrap();
    db.replace_snapshot(original.clone()).unwrap();
    assert_eq!(snapshot_value(&db), serde_json::to_value(original).unwrap());
    assert_eq!(db.initialize_area(&id(2), &id(80)).unwrap(), id(3));
    assert!(db.get_sync_state(&id(2)).unwrap().is_none());
    assert_eq!(
        db.query(AggregateQuery { space_id: id(2) }).unwrap().len(),
        1
    );
    assert!(db.read_aggregate(&id(4)).unwrap().is_some());
    assert_eq!(
        db.load_confirmed(&id(2)).unwrap()[0]
            .aggregate
            .aggregate
            .revision()
            .value(),
        1
    );
    assert_eq!(db.load_pending(&id(2)).unwrap().len(), 1);
    db.apply_atomic_batch(request(31, 2).batch).unwrap();
    assert_eq!(
        db.read_aggregate(&id(4))
            .unwrap()
            .unwrap()
            .aggregate
            .revision()
            .value(),
        2
    );
    assert_eq!(
        db.load_confirmed(&id(2)).unwrap()[0]
            .aggregate
            .aggregate
            .revision()
            .value(),
        1
    );
    db.save_sync_page(sync_page(2)).unwrap();
    assert_eq!(
        db.load_confirmed(&id(2)).unwrap()[0]
            .aggregate
            .aggregate
            .revision()
            .value(),
        2
    );
    assert!(
        db.load_pending(&id(2))
            .unwrap()
            .iter()
            .all(|p| p.operation_id != id(130))
    );
    let s = db.export_snapshot(&id(2)).unwrap();
    db.rebuild_projections(ProjectionRebuild {
        space_id: id(2),
        source_aggregates: s.aggregates.clone(),
        projections: s.projections.clone(),
    })
    .unwrap();
    let final_state = snapshot_value(&db);
    drop(db);
    let reopened = LegacySqliteWriter::open(&file, id(1), CoreValidator).unwrap();
    assert_eq!(snapshot_value(&reopened), final_state);
    assert_eq!(
        reopened.get_sync_state(&id(2)).unwrap().unwrap().cursor,
        "9007199254740993"
    );
}
#[test]
fn orm_batch_rolls_back_after_actual_aggregate_and_outbox_writes() {
    let file = path("legacy-batch-rollback");
    drop(fixture(&file));
    let mut db = LegacySqliteWriter::open(&file, id(1), CoreValidator).unwrap();
    let before = snapshot_value(&db);
    let mut batch = request(31, 2).batch;
    batch.projections.push(batch.projections[0].clone());
    let error = db.apply_atomic_batch(batch).unwrap_err();
    assert_eq!(error.code, StorageFailureCode::WriteFailed);
    assert_eq!(
        error.commit_state,
        wimm_local_contracts::persistence_errors::FailureCommitState::NotCommitted
    );
    assert_eq!(snapshot_value(&db), before);
    let mut batch = request(31, 2).batch;
    batch.aggregates[0].handle = id(99);
    assert!(db.apply_atomic_batch(batch).is_err());
    assert_eq!(snapshot_value(&db), before);
}
#[test]
fn competing_orm_connections_enforce_stale_cas_without_partial_outbox() {
    let file = path("legacy-cas");
    drop(fixture(&file));
    let mut first = LegacySqliteWriter::open(&file, id(1), CoreValidator).unwrap();
    let mut second = LegacySqliteWriter::open(&file, id(1), CoreValidator).unwrap();
    first.apply_atomic_batch(request(31, 2).batch).unwrap();
    let before = snapshot_value(&first);
    assert_eq!(
        second
            .apply_atomic_batch(request(32, 2).batch)
            .unwrap_err()
            .code,
        StorageFailureCode::RevisionConflict
    );
    assert_eq!(snapshot_value(&first), before);
    assert_eq!(snapshot_value(&second), before);
}
#[test]
fn orm_sync_page_rolls_back_confirmations_pending_removal_and_cursor_together() {
    let file = path("legacy-sync-rollback");
    drop(fixture(&file));
    let mut db = LegacySqliteWriter::open(&file, id(1), CoreValidator).unwrap();
    let before = snapshot_value(&db);
    let mut page = sync_page(2);
    page.projections.push(page.projections[0].clone());
    assert!(db.save_sync_page(page).is_err());
    assert_eq!(snapshot_value(&db), before);
    let mut page = sync_page(2);
    page.state.epoch = id(99);
    assert_eq!(
        db.save_sync_page(page).unwrap_err().code,
        StorageFailureCode::EpochMismatch
    );
    assert_eq!(snapshot_value(&db), before);
    let mut page = sync_page(2);
    page.state.cursor = "01".into();
    assert!(db.save_sync_page(page).is_err());
    assert_eq!(snapshot_value(&db), before);
    db.save_sync_page(sync_page(2)).unwrap();
    assert!(db.load_pending(&id(2)).unwrap().is_empty());
    assert!(db.get_sync_state(&id(2)).unwrap().is_some());
    // Syncbestätigung ersetzt niemals den eigenen lokalen Finanzstand.
    assert_eq!(
        db.read_aggregate(&id(4))
            .unwrap()
            .unwrap()
            .aggregate
            .revision()
            .value(),
        1
    );
}
#[test]
fn snapshot_and_projection_replacement_require_actual_core_validation_and_original_cas() {
    let file = path("legacy-replace");
    drop(fixture(&file));
    let mut db = LegacySqliteWriter::open(&file, id(1), CoreValidator).unwrap();
    let before = snapshot_value(&db);
    let mut s = db.export_snapshot(&id(2)).unwrap();
    s.projections[0] = serde_json::from_value(
        serde_json::json!({"kind":"balance","spaceId":id(2),"key":id(4),"payload":123}),
    )
    .unwrap();
    assert!(db.replace_snapshot(s).is_err());
    assert_eq!(snapshot_value(&db), before);
    let s = db.export_snapshot(&id(2)).unwrap();
    let mut stale = s.aggregates.clone();
    stale[0] = request(31, 2).batch.aggregates.remove(0);
    assert_eq!(
        db.rebuild_projections(ProjectionRebuild {
            space_id: id(2),
            source_aggregates: stale,
            projections: s.projections.clone()
        })
        .unwrap_err()
        .code,
        StorageFailureCode::RevisionConflict
    );
    assert_eq!(snapshot_value(&db), before);
    let mut pending = s.pending[0].clone();
    pending.draft.0 = serde_json::json!({"spaceId":id(99)});
    let mut s = s;
    s.pending = vec![pending];
    assert!(db.replace_snapshot(s).is_err());
    assert_eq!(snapshot_value(&db), before);
}
#[test]
fn actual_sqlite_abort_after_snapshot_deletion_preserves_complete_original() {
    let file = path("legacy-replace-db-error");
    let mut raw = fixture(&file);
    let mut db = LegacySqliteWriter::open(&file, id(1), CoreValidator).unwrap();
    let before = snapshot_value(&db);
    let mut s = db.export_snapshot(&id(2)).unwrap();
    raw.batch_execute("CREATE TRIGGER synthetic_abort BEFORE INSERT ON confirmed BEGIN SELECT RAISE(ABORT,'synthetic-private-text'); END;").unwrap();
    s.epoch = id(90);
    s.confirmed[0].epoch = id(90);
    let error = db.replace_snapshot(s).unwrap_err();
    assert!(
        !serde_json::to_string(&error)
            .unwrap()
            .contains("synthetic-private-text")
    );
    assert_eq!(snapshot_value(&db), before);
    drop(db);
    drop(raw);
    assert_eq!(
        serde_json::to_value(
            LegacySqliteStore::open(&file, id(1))
                .unwrap()
                .export_snapshot(&id(2))
                .unwrap()
        )
        .unwrap(),
        before
    );
}
#[test]
fn orm_area_initialization_and_empty_ports_never_invent_server_cursor() {
    let file = path("legacy-empty");
    drop(fixture(&file));
    let mut db = LegacySqliteWriter::open(&file, id(90), CoreValidator).unwrap();
    assert!(
        db.query(AggregateQuery { space_id: id(2) })
            .unwrap()
            .is_empty()
    );
    assert!(db.load_pending(&id(2)).unwrap().is_empty());
    assert!(db.load_confirmed(&id(2)).unwrap().is_empty());
    assert!(db.get_sync_state(&id(2)).unwrap().is_none());
    assert_eq!(db.initialize_area(&id(2), &id(91)).unwrap(), id(91));
    let s = db.export_snapshot(&id(2)).unwrap();
    assert_eq!(s.epoch, id(91));
    assert!(s.sync_state.is_none());
    db.replace_snapshot(s).unwrap();
    assert_eq!(
        LegacySqliteStore::open(&file, id(1))
            .unwrap()
            .export_snapshot(&id(2))
            .unwrap()
            .aggregates
            .len(),
        1
    );
}

fn first_account_with_financial_anchor(account: u32) -> AtomicBatch {
    let mut batch = request(account, 1).batch;
    let mut a = serde_json::to_value(&batch.aggregates[0]).unwrap();
    a["id"] = serde_json::to_value(id(account)).unwrap();
    a["handle"] = a["id"].clone();
    batch.aggregates[0] = serde_json::from_value(a).unwrap();
    batch.expected_revisions[0].handle = id(account);
    batch.expected_revisions.push(RevisionExpectation {
        handle: id(2),
        expected_revision: wimm_finance_types::scalars::Revision::new(0).unwrap(),
    });
    batch.aggregates.push(serde_json::from_value(serde_json::json!({"handle":id(2),"aggregateType":"financialRevision","id":id(2),"spaceId":id(2),"revision":1,"createdAt":"2026-10-10T00:00:00Z","updatedAt":"2026-10-10T00:00:00Z"})).unwrap());
    batch.projections.clear();
    batch
}
#[test]
fn shared_financial_anchor_serializes_even_independent_first_accounts() {
    let file = path("legacy-financial-cas");
    drop(fixture(&file));
    let mut first = LegacySqliteWriter::open(&file, id(1), CoreValidator).unwrap();
    let mut second = LegacySqliteWriter::open(&file, id(1), CoreValidator).unwrap();
    first
        .apply_atomic_batch(first_account_with_financial_anchor(60))
        .unwrap();
    let before = snapshot_value(&first);
    assert_eq!(
        second
            .apply_atomic_batch(first_account_with_financial_anchor(61))
            .unwrap_err()
            .code,
        StorageFailureCode::RevisionConflict
    );
    assert!(second.read_aggregate(&id(61)).unwrap().is_none());
    assert_eq!(snapshot_value(&first), before);
    assert_eq!(
        first
            .read_aggregate(&id(2))
            .unwrap()
            .unwrap()
            .aggregate
            .revision()
            .value(),
        1
    );
}
#[test]
fn foreign_pending_collision_after_aggregate_write_rolls_back_without_moving_original() {
    let file = path("legacy-pending-scope");
    let mut raw = fixture(&file);
    let mut p = request(31, 2).batch.outbox.remove(0);
    p.space_id = id(99);
    diesel::sql_query("INSERT INTO outbox VALUES (?,?,?,?,?)")
        .bind::<diesel::sql_types::Text, _>(id(1).as_str())
        .bind::<diesel::sql_types::Text, _>(p.operation_id.as_str())
        .bind::<diesel::sql_types::Text, _>(id(99).as_str())
        .bind::<diesel::sql_types::Text, _>("queued")
        .bind::<diesel::sql_types::Text, _>(serde_json::to_string(&p).unwrap())
        .execute(&mut raw)
        .unwrap();
    let mut db = LegacySqliteWriter::open(&file, id(1), CoreValidator).unwrap();
    let before = snapshot_value(&db);
    assert_eq!(
        db.apply_atomic_batch(request(31, 2).batch)
            .unwrap_err()
            .code,
        StorageFailureCode::WriteFailed
    );
    assert_eq!(snapshot_value(&db), before);
    assert_eq!(
        serde_json::to_value(db.load_pending(&id(99)).unwrap()).unwrap(),
        serde_json::to_value(vec![p]).unwrap()
    );
}
