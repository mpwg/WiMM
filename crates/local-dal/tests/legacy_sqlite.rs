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

use wimm_local_contracts::{
    commit::{CancellableLocalCommitPort, LocalCommitPort},
    models::EncryptedBackupReceipt,
    ports::EncryptedBackupRequest,
    scalars::{LocalHash, LocalId},
    storage_port::{
        BackupPort, BackupReadPort, CancellationPort, NeverCancel, SnapshotProtectionPort,
    },
};
struct NativeProtection(wimm_client_crypto::SecretKey);
impl SnapshotProtectionPort for NativeProtection {
    type Error = wimm_local_contracts::persistence_errors::StorageFailure;
    fn seal(&self, s: LocalSnapshot) -> Result<Vec<u8>, Self::Error> {
        wimm_client_crypto::vault::seal_snapshot(&self.0, &serde_json::to_vec(&s).unwrap())
            .map_err(|_| Self::Error::not_committed(StorageFailureCode::WriteFailed))
    }
    fn unseal(&self, bytes: &[u8]) -> Result<LocalSnapshot, Self::Error> {
        let value = wimm_client_crypto::vault::open_snapshot(&self.0, bytes)
            .map_err(|_| Self::Error::not_committed(StorageFailureCode::InvalidResponse))?;
        serde_json::from_slice(&value)
            .map_err(|_| Self::Error::not_committed(StorageFailureCode::InvalidResponse))
    }
}
struct NativeBackup {
    directory: std::path::PathBuf,
    next: std::cell::Cell<u32>,
}
impl NativeBackup {
    fn new() -> Self {
        let directory = path("native-backup");
        std::fs::create_dir_all(&directory).unwrap();
        Self {
            directory,
            next: std::cell::Cell::new(700),
        }
    }
}
impl BackupPort for NativeBackup {
    type Error = wimm_local_contracts::persistence_errors::StorageFailure;
    fn persist(&self, r: EncryptedBackupRequest) -> Result<EncryptedBackupReceipt, Self::Error> {
        use std::io::Write;
        let number = self.next.get();
        self.next.set(number + 1);
        let receipt = EncryptedBackupReceipt {
            backup_id: LocalId::new(id(number).as_str().into()).unwrap(),
            profile_id: r.profile_id,
            space_id: r.space_id,
            epoch: r.epoch,
            snapshot_hash: r.snapshot_hash,
        };
        let mut file =
            std::fs::File::create(self.directory.join(receipt.backup_id.as_str())).unwrap();
        file.write_all(&r.ciphertext).unwrap();
        file.sync_all().unwrap();
        let mut meta = std::fs::File::create(
            self.directory
                .join(format!("{}.json", receipt.backup_id.as_str())),
        )
        .unwrap();
        meta.write_all(&serde_json::to_vec(&receipt).unwrap())
            .unwrap();
        meta.sync_all().unwrap();
        std::fs::File::open(&self.directory)
            .unwrap()
            .sync_all()
            .unwrap();
        Ok(receipt)
    }
}
impl BackupReadPort for NativeBackup {
    fn read(&self, r: &EncryptedBackupReceipt) -> Result<Vec<u8>, Self::Error> {
        let invalid = || Self::Error::not_committed(StorageFailureCode::InvalidResponse);
        let meta = std::fs::read(
            self.directory
                .join(format!("{}.json", r.backup_id.as_str())),
        )
        .map_err(|_| invalid())?;
        let stored: EncryptedBackupReceipt =
            serde_json::from_slice(&meta).map_err(|_| invalid())?;
        if serde_json::to_value(stored).unwrap() != serde_json::to_value(r).unwrap() {
            return Err(invalid());
        }
        std::fs::read(self.directory.join(r.backup_id.as_str())).map_err(|_| invalid())
    }
}
fn protected_backup(
    s: &LocalSnapshot,
    p: &NativeProtection,
    b: &NativeBackup,
) -> EncryptedBackupReceipt {
    use sha2::{Digest, Sha256};
    let hash = Sha256::digest(serde_json::to_vec(s).unwrap())
        .iter()
        .map(|v| format!("{v:02x}"))
        .collect::<String>();
    b.persist(EncryptedBackupRequest {
        profile_id: LocalId::new(s.profile_id.as_str().into()).unwrap(),
        space_id: LocalId::new(s.space_id.as_str().into()).unwrap(),
        epoch: LocalId::new(s.epoch.as_str().into()).unwrap(),
        snapshot_hash: LocalHash::new(hash).unwrap(),
        ciphertext: p.seal(s.clone()).unwrap(),
    })
    .unwrap()
}
fn migrate_commit(db: &mut LegacySqliteWriter<CoreValidator>) {
    let s = db.export_snapshot(&id(2)).unwrap();
    let p = NativeProtection(wimm_client_crypto::SecretKey::from_bytes(&[42; 32]).unwrap());
    let b = NativeBackup::new();
    let r = protected_backup(&s, &p, &b);
    db.enable_commit_schema(vec![s], &[r], &p, &b, &NeverCancel)
        .unwrap();
}
#[derive(QueryableByName)]
struct Count {
    #[diesel(sql_type=diesel::sql_types::BigInt)]
    count: i64,
}
fn extension_tables(c: &mut SqliteConnection) -> i64 {
    diesel::sql_query("SELECT count(*) AS count FROM sqlite_master WHERE name IN ('wimm_native_schema','wimm_native_receipts','wimm_native_recovery')").get_result::<Count>(c).unwrap().count
}
#[test]
fn registered_dsl_extension_requires_real_encrypted_backup_and_preserves_all_scopes() {
    let file = path("native-migration");
    let mut raw = fixture(&file);
    let mut first = LegacySqliteWriter::open(&file, id(1), CoreValidator).unwrap();
    let mut other = LegacySqliteWriter::open(&file, id(90), CoreValidator).unwrap();
    other.initialize_area(&id(91), &id(92)).unwrap();
    let original = first.export_snapshot(&id(2)).unwrap();
    let foreign = other.export_snapshot(&id(91)).unwrap();
    let p = NativeProtection(wimm_client_crypto::SecretKey::from_bytes(&[42; 32]).unwrap());
    let b = NativeBackup::new();
    let r = protected_backup(&original, &p, &b);
    let foreign_receipt = protected_backup(&foreign, &p, &b);
    assert_eq!(
        first
            .enable_commit_schema(
                vec![original.clone()],
                std::slice::from_ref(&r),
                &p,
                &b,
                &NeverCancel
            )
            .unwrap_err()
            .code,
        StorageFailureCode::RevisionConflict
    );
    assert_eq!(extension_tables(&mut raw), 0);
    first
        .enable_commit_schema(
            vec![original.clone(), foreign.clone()],
            &[r, foreign_receipt],
            &p,
            &b,
            &NeverCancel,
        )
        .unwrap();
    assert_eq!(extension_tables(&mut raw), 3);
    let physical: Payload = diesel::sql_query(
        "SELECT value AS payload FROM storage_meta WHERE key='storageSchemaVersion'",
    )
    .get_result(&mut raw)
    .unwrap();
    assert_eq!(physical.payload, "4");
    let version: Payload = diesel::sql_query("SELECT sqlite_version() AS payload")
        .get_result(&mut raw)
        .unwrap();
    eprintln!("DAL03 SQLite-Version: {}", version.payload);
    assert_eq!(
        snapshot_value(&first),
        serde_json::to_value(original.clone()).unwrap()
    );
    assert_eq!(
        serde_json::to_value(other.export_snapshot(&id(91)).unwrap()).unwrap(),
        serde_json::to_value(foreign).unwrap()
    );
    let r = protected_backup(&original, &p, &b);
    assert_eq!(
        first
            .enable_commit_schema(vec![original], &[r], &p, &b, &NeverCancel)
            .unwrap_err()
            .code,
        StorageFailureCode::UpdateRequired
    );
}
#[test]
fn backup_tampering_wrong_key_missing_file_and_stale_original_never_install_schema() {
    for fault in ["missing", "cipher", "key", "stale"] {
        let file = path("native-backup-rejection");
        let mut raw = fixture(&file);
        let mut db = LegacySqliteWriter::open(&file, id(1), CoreValidator).unwrap();
        let original = db.export_snapshot(&id(2)).unwrap();
        let p = NativeProtection(wimm_client_crypto::SecretKey::from_bytes(&[42; 32]).unwrap());
        let b = NativeBackup::new();
        let r = protected_backup(&original, &p, &b);
        let selected = if fault == "key" {
            NativeProtection(wimm_client_crypto::SecretKey::from_bytes(&[99; 32]).unwrap())
        } else {
            NativeProtection(wimm_client_crypto::SecretKey::from_bytes(&[42; 32]).unwrap())
        };
        if fault == "missing" {
            std::fs::remove_file(b.directory.join(r.backup_id.as_str())).unwrap();
        }
        if fault == "cipher" {
            std::fs::write(b.directory.join(r.backup_id.as_str()), b"corrupt").unwrap();
        }
        if fault == "stale" {
            db.apply_atomic_batch(request(31, 2).batch).unwrap();
        }
        let before = snapshot_value(&db);
        assert!(
            db.enable_commit_schema(vec![original], &[r], &selected, &b, &NeverCancel)
                .is_err()
        );
        assert_eq!(extension_tables(&mut raw), 0);
        assert_eq!(snapshot_value(&db), before);
    }
}
struct CancelAt {
    at: u32,
    calls: std::cell::Cell<u32>,
}
impl CancellationPort for CancelAt {
    fn is_cancelled(&self) -> bool {
        let n = self.calls.get() + 1;
        self.calls.set(n);
        n >= self.at
    }
}
#[test]
fn cancellation_after_actual_registered_ddl_rolls_back_schema_and_journal() {
    let file = path("native-migration-cancel");
    let mut raw = fixture(&file);
    let mut db = LegacySqliteWriter::open(&file, id(1), CoreValidator).unwrap();
    let s = db.export_snapshot(&id(2)).unwrap();
    let before = snapshot_value(&db);
    let p = NativeProtection(wimm_client_crypto::SecretKey::from_bytes(&[42; 32]).unwrap());
    let b = NativeBackup::new();
    let r = protected_backup(&s, &p, &b);
    let cancel = CancelAt {
        at: 4,
        calls: std::cell::Cell::new(0),
    };
    assert_eq!(
        db.enable_commit_schema(vec![s], &[r], &p, &b, &cancel)
            .unwrap_err()
            .code,
        StorageFailureCode::Cancelled
    );
    assert_eq!(cancel.calls.get(), 4);
    assert_eq!(extension_tables(&mut raw), 0);
    assert_eq!(snapshot_value(&db), before);
    migrate_commit(&mut db);
    assert_eq!(extension_tables(&mut raw), 3);
}
#[test]
fn native_receipts_bind_original_hash_and_survive_reopen_without_repeat_write() {
    use wimm_persistence_contracts::CommitOutcome;
    let file = path("native-integrated-receipt");
    drop(fixture(&file));
    let mut db = LegacySqliteWriter::open(&file, id(1), CoreValidator).unwrap();
    assert!(matches!(
        db.commit(request(31, 2)),
        CommitOutcome::NotCommitted { .. }
    ));
    migrate_commit(&mut db);
    let r = request(31, 2);
    let receipt = match db.commit(r.clone()) {
        CommitOutcome::Committed { value } => value,
        other => panic!("{other:?}"),
    };
    let after = snapshot_value(&db);
    drop(db);
    let mut db = LegacySqliteWriter::open(&file, id(1), CoreValidator).unwrap();
    assert_eq!(
        serde_json::to_value(db.lookup_result(&r.identity).unwrap()).unwrap(),
        serde_json::to_value(&receipt).unwrap()
    );
    assert!(matches!(
        db.commit(r.clone()),
        CommitOutcome::Committed { .. }
    ));
    assert_eq!(snapshot_value(&db), after);
    let mut reused = r.clone();
    reused.batch.outbox.clear();
    assert!(
        matches!(db.commit(reused),CommitOutcome::NotCommitted{error} if error.code==StorageFailureCode::OperationIdReused)
    );
    let mut foreign = r.identity.clone();
    foreign.profile_id = id(90);
    assert_eq!(
        db.lookup_result(&foreign).unwrap_err().code,
        StorageFailureCode::EpochMismatch
    );
    let mut snapshot = db.export_snapshot(&id(2)).unwrap();
    snapshot.epoch = id(99);
    for confirmed in &mut snapshot.confirmed {
        confirmed.epoch = id(99);
    }
    db.replace_snapshot(snapshot).unwrap();
    assert!(matches!(db.commit(r), CommitOutcome::Committed { .. }));
    let mut wrong = request(32, 3);
    wrong.identity.epoch = id(99);
    assert!(
        matches!(db.commit(wrong),CommitOutcome::NotCommitted{error} if error.code==StorageFailureCode::EpochMismatch)
    );
    assert_eq!(db.initialize_area(&id(2), &id(80)).unwrap(), id(3));
}
#[test]
fn sqlite_receipt_abort_rolls_back_financial_write_and_preserves_private_recovery() {
    use wimm_persistence_contracts::CommitOutcome;
    let file = path("native-receipt-failure");
    let mut raw = fixture(&file);
    let mut db = LegacySqliteWriter::open(&file, id(1), CoreValidator).unwrap();
    migrate_commit(&mut db);
    db.save_recovery_if_absent(b"synthetic-encrypted-journal")
        .unwrap();
    let before = snapshot_value(&db);
    raw.batch_execute("CREATE TRIGGER synthetic_receipt_abort BEFORE INSERT ON wimm_native_receipts BEGIN SELECT RAISE(ABORT,'synthetic-private-diagnostic'); END;").unwrap();
    let r = request(31, 2);
    assert!(matches!(
        db.commit(r.clone()),
        CommitOutcome::Unknown { .. }
    ));
    assert_eq!(snapshot_value(&db), before);
    assert!(db.lookup_result(&r.identity).unwrap().is_none());
    assert_eq!(
        db.load_recovery().unwrap().unwrap(),
        b"synthetic-encrypted-journal"
    );
}
#[test]
fn native_private_recovery_is_durable_profile_bound_and_cas_protected() {
    let file = path("native-recovery");
    drop(fixture(&file));
    let mut db = LegacySqliteWriter::open(&file, id(1), CoreValidator).unwrap();
    migrate_commit(&mut db);
    let key = wimm_client_crypto::SecretKey::from_bytes(&[42; 32]).unwrap();
    let original = serde_json::to_vec(&request(31, 2)).unwrap();
    let sealed =
        wimm_client_crypto::encrypt(&key, b"wimm/local/application-recovery/v1", &original)
            .unwrap();
    let encrypted = serde_json::to_vec(
        &serde_json::json!({"nonce":sealed.nonce,"ciphertext":sealed.ciphertext}),
    )
    .unwrap();
    assert!(!String::from_utf8_lossy(&encrypted).contains("Synthetisch"));
    assert!(!String::from_utf8_lossy(&encrypted).contains("expectedRevisions"));
    assert!(db.save_recovery_if_absent(&[]).is_err());
    db.save_recovery_if_absent(&encrypted).unwrap();
    db.save_recovery_if_absent(&encrypted).unwrap();
    assert_eq!(
        db.save_recovery_if_absent(b"different").unwrap_err().code,
        StorageFailureCode::RevisionConflict
    );
    drop(db);
    let mut db = LegacySqliteWriter::open(&file, id(1), CoreValidator).unwrap();
    let other = LegacySqliteWriter::open(&file, id(90), CoreValidator).unwrap();
    assert!(other.load_recovery().unwrap().is_none());
    assert_eq!(db.load_recovery().unwrap().unwrap(), encrypted);
    assert_eq!(
        db.clear_recovery(b"different").unwrap_err().code,
        StorageFailureCode::RevisionConflict
    );
    let stored: serde_json::Value =
        serde_json::from_slice(&db.load_recovery().unwrap().unwrap()).unwrap();
    let nonce: Vec<u8> = serde_json::from_value(stored["nonce"].clone()).unwrap();
    let cipher: Vec<u8> = serde_json::from_value(stored["ciphertext"].clone()).unwrap();
    assert_eq!(
        wimm_client_crypto::decrypt(&key, &nonce, b"wimm/local/application-recovery/v1", &cipher)
            .unwrap()
            .as_slice(),
        original.as_slice()
    );
    let wrong = wimm_client_crypto::SecretKey::from_bytes(&[99; 32]).unwrap();
    assert!(
        wimm_client_crypto::decrypt(
            &wrong,
            &nonce,
            b"wimm/local/application-recovery/v1",
            &cipher
        )
        .is_err()
    );
    db.clear_recovery(&encrypted).unwrap();
    assert!(db.load_recovery().unwrap().is_none());
}

#[test]
fn integrated_commit_cancellation_preserves_original_but_never_revokes_known_receipt() {
    use wimm_persistence_contracts::CommitOutcome;
    let file = path("native-commit-cancel");
    drop(fixture(&file));
    let mut db = LegacySqliteWriter::open(&file, id(1), CoreValidator).unwrap();
    migrate_commit(&mut db);
    let before = snapshot_value(&db);
    let r = request(31, 2);
    for at in [1, 2, 3] {
        let cancel = CancelAt {
            at,
            calls: std::cell::Cell::new(0),
        };
        assert!(
            matches!(db.commit_cancellable(r.clone(),&cancel),CommitOutcome::NotCommitted{error} if error.code==StorageFailureCode::Cancelled)
        );
        assert_eq!(snapshot_value(&db), before);
        assert!(db.lookup_result(&r.identity).unwrap().is_none());
    }
    assert!(matches!(
        db.commit(r.clone()),
        CommitOutcome::Committed { .. }
    ));
    let cancel = CancelAt {
        at: 1,
        calls: std::cell::Cell::new(0),
    };
    assert!(matches!(
        db.commit_cancellable(r, &cancel),
        CommitOutcome::Committed { .. }
    ));
    assert_eq!(cancel.calls.get(), 0);
}

#[test]
fn child_process_resolves_integrated_receipt_and_private_ciphertext() {
    let Some(file) = std::env::var_os("WIMM_DAL03_RECEIPT_FILE") else {
        return;
    };
    let db = LegacySqliteWriter::open(std::path::Path::new(&file), id(1), CoreValidator).unwrap();
    let request = request(31, 2);
    let receipt = db.lookup_result(&request.identity).unwrap().unwrap();
    assert_eq!(
        serde_json::to_value(&receipt.identity).unwrap(),
        serde_json::to_value(&request.identity).unwrap()
    );
    assert_eq!(receipt.committed_revisions[0].revision.value(), 2);
    let stored: serde_json::Value =
        serde_json::from_slice(&db.load_recovery().unwrap().unwrap()).unwrap();
    let nonce: Vec<u8> = serde_json::from_value(stored["nonce"].clone()).unwrap();
    let cipher: Vec<u8> = serde_json::from_value(stored["ciphertext"].clone()).unwrap();
    let key = wimm_client_crypto::SecretKey::from_bytes(&[42; 32]).unwrap();
    let original =
        wimm_client_crypto::decrypt(&key, &nonce, b"wimm/local/application-recovery/v1", &cipher)
            .unwrap();
    assert_eq!(
        original.as_slice(),
        serde_json::to_vec(&request).unwrap().as_slice()
    );
}
#[test]
fn integrated_receipt_and_encrypted_original_survive_actual_process_restart() {
    use wimm_persistence_contracts::CommitOutcome;
    let file = path("native-integrated-process");
    drop(fixture(&file));
    let mut db = LegacySqliteWriter::open(&file, id(1), CoreValidator).unwrap();
    migrate_commit(&mut db);
    let original = request(31, 2);
    let key = wimm_client_crypto::SecretKey::from_bytes(&[42; 32]).unwrap();
    let sealed = wimm_client_crypto::encrypt(
        &key,
        b"wimm/local/application-recovery/v1",
        &serde_json::to_vec(&original).unwrap(),
    )
    .unwrap();
    db.save_recovery_if_absent(
        &serde_json::to_vec(
            &serde_json::json!({"nonce":sealed.nonce,"ciphertext":sealed.ciphertext}),
        )
        .unwrap(),
    )
    .unwrap();
    assert!(matches!(
        db.commit(original),
        CommitOutcome::Committed { .. }
    ));
    drop(db);
    let output = std::process::Command::new(std::env::current_exe().unwrap())
        .args([
            "--exact",
            "child_process_resolves_integrated_receipt_and_private_ciphertext",
            "--nocapture",
        ])
        .env("WIMM_DAL03_RECEIPT_FILE", &file)
        .output()
        .unwrap();
    assert!(
        output.status.success(),
        "{}",
        String::from_utf8_lossy(&output.stderr)
    );
    assert!(String::from_utf8_lossy(&output.stdout).contains("1 passed"));
}
#[test]
fn corrupt_or_future_extension_headers_never_allow_receipt_or_journal_writes() {
    for sql in [
        "UPDATE wimm_native_schema SET version=99",
        "UPDATE wimm_native_schema SET backups='[]'",
        "UPDATE wimm_native_schema SET original_version=99",
        "UPDATE storage_meta SET value='1' WHERE key='storageSchemaVersion'",
    ] {
        let file = path("native-header");
        let mut raw = fixture(&file);
        let mut db = LegacySqliteWriter::open(&file, id(1), CoreValidator).unwrap();
        migrate_commit(&mut db);
        raw.batch_execute(sql).unwrap();
        assert!(db.save_recovery_if_absent(b"opaque").is_err());
        assert!(db.lookup_result(&request(31, 2).identity).is_err());
        assert!(LegacySqliteStore::open(&file, id(1)).is_err());
    }
}

use wimm_local_contracts::checkpoint_v2::LocalCheckpointV2;
impl SnapshotProtectionPort<LocalCheckpointV2> for NativeProtection {
    type Error = wimm_local_contracts::persistence_errors::StorageFailure;
    fn seal(&self, value: LocalCheckpointV2) -> Result<Vec<u8>, Self::Error> {
        wimm_client_crypto::vault::seal_snapshot(&self.0, &serde_json::to_vec(&value).unwrap())
            .map_err(|_| Self::Error::not_committed(StorageFailureCode::WriteFailed))
    }
    fn unseal(&self, bytes: &[u8]) -> Result<LocalCheckpointV2, Self::Error> {
        let clear = wimm_client_crypto::vault::open_snapshot(&self.0, bytes)
            .map_err(|_| Self::Error::not_committed(StorageFailureCode::InvalidResponse))?;
        serde_json::from_slice(&clear)
            .map_err(|_| Self::Error::not_committed(StorageFailureCode::InvalidResponse))
    }
}
#[test]
fn complete_checkpoint_preserves_confirmations_cursor_receipts_and_private_recovery() {
    use wimm_persistence_contracts::CommitOutcome;
    let file = path("native-complete-checkpoint");
    drop(fixture(&file));
    let mut db = LegacySqliteWriter::open(&file, id(1), CoreValidator).unwrap();
    migrate_commit(&mut db);
    let r = request(31, 2);
    assert!(matches!(
        db.commit(r.clone()),
        CommitOutcome::Committed { .. }
    ));
    db.save_sync_page(sync_page(2)).unwrap();
    let p = NativeProtection(wimm_client_crypto::SecretKey::from_bytes(&[42; 32]).unwrap());
    let key = wimm_client_crypto::SecretKey::from_bytes(&[42; 32]).unwrap();
    let encrypted = wimm_client_crypto::encrypt(
        &key,
        b"wimm/local/application-recovery/v1",
        &serde_json::to_vec(&r).unwrap(),
    )
    .unwrap();
    let recovery = serde_json::to_vec(
        &serde_json::json!({"nonce":encrypted.nonce,"ciphertext":encrypted.ciphertext}),
    )
    .unwrap();
    db.save_recovery_if_absent(&recovery).unwrap();
    let checkpoint = db.checkpoint_v2(&id(2)).unwrap();
    assert_eq!(checkpoint.checkpoint_version, 2);
    assert_eq!(checkpoint.physical_schema_version, 4);
    assert_eq!(checkpoint.snapshot.confirmed.len(), 1);
    assert_eq!(checkpoint.operations.len(), 1);
    assert_eq!(checkpoint.recovery.as_ref().unwrap(), &recovery);
    assert_eq!(
        checkpoint.snapshot.sync_state.as_ref().unwrap().cursor,
        "9007199254740993"
    );
    let b = NativeBackup::new();
    let receipt = db.backup_checkpoint_v2(&id(2), &p, &b).unwrap();
    let saved: LocalCheckpointV2 = p.unseal(&b.read(&receipt).unwrap()).unwrap();
    assert_eq!(
        serde_json::to_value(&saved).unwrap(),
        serde_json::to_value(&checkpoint).unwrap()
    );
    drop(db);
    let reopened = LegacySqliteWriter::open(&file, id(1), CoreValidator).unwrap();
    assert_eq!(
        serde_json::to_value(reopened.checkpoint_v2(&id(2)).unwrap()).unwrap(),
        serde_json::to_value(&checkpoint).unwrap()
    );
    // V1 ist weiterhin seine alte eingeschränkte Form und wird nicht still erweitert.
    assert!(
        serde_json::from_value::<wimm_local_contracts::checkpoint::LocalCommitCheckpoint>(
            serde_json::to_value(&checkpoint).unwrap()
        )
        .is_err()
    );
}
#[test]
fn complete_checkpoint_structural_negatives_and_corrupt_receipts_are_rejected() {
    use wimm_local_contracts::Validate;
    let file = path("native-checkpoint-negative");
    let mut raw = fixture(&file);
    let mut db = LegacySqliteWriter::open(&file, id(1), CoreValidator).unwrap();
    migrate_commit(&mut db);
    db.commit(request(31, 2));
    let original = db.checkpoint_v2(&id(2)).unwrap();
    for field in ["checkpointVersion", "physicalSchemaVersion"] {
        let mut bad = serde_json::to_value(&original).unwrap();
        bad[field] = 99.into();
        assert!(serde_json::from_value::<LocalCheckpointV2>(bad).is_err());
    }
    for field in ["recovery", "extra"] {
        let mut bad = serde_json::to_value(&original).unwrap();
        bad[field] = serde_json::Value::Null;
        assert!(serde_json::from_value::<LocalCheckpointV2>(bad).is_err());
    }
    let mut v = original.clone();
    v.operations.push(v.operations[0].clone());
    assert!(v.validate().is_err());
    let mut v = original.clone();
    v.snapshot.confirmed[0].epoch = id(99);
    assert!(v.validate().is_err());
    raw.batch_execute("UPDATE wimm_native_receipts SET receipt=json_set(receipt,'$.contentHash','0000000000000000000000000000000000000000000000000000000000000000')").unwrap();
    assert_eq!(
        db.checkpoint_v2(&id(2)).unwrap_err().code,
        StorageFailureCode::InvalidResponse
    );
}
struct AlteredBackup(NativeBackup);
impl BackupPort for AlteredBackup {
    type Error = wimm_local_contracts::persistence_errors::StorageFailure;
    fn persist(&self, r: EncryptedBackupRequest) -> Result<EncryptedBackupReceipt, Self::Error> {
        self.0.persist(r)
    }
}
impl BackupReadPort for AlteredBackup {
    fn read(&self, r: &EncryptedBackupReceipt) -> Result<Vec<u8>, Self::Error> {
        let mut bytes = self.0.read(r)?;
        bytes.push(0);
        Ok(bytes)
    }
}
#[test]
fn full_checkpoint_backup_requires_actual_byte_identical_readback_without_mutation() {
    let file = path("native-checkpoint-readback");
    drop(fixture(&file));
    let mut db = LegacySqliteWriter::open(&file, id(1), CoreValidator).unwrap();
    migrate_commit(&mut db);
    let before = serde_json::to_value(db.checkpoint_v2(&id(2)).unwrap()).unwrap();
    let p = NativeProtection(wimm_client_crypto::SecretKey::from_bytes(&[42; 32]).unwrap());
    let bad = AlteredBackup(NativeBackup::new());
    assert_eq!(
        db.backup_checkpoint_v2(&id(2), &p, &bad).unwrap_err().code,
        StorageFailureCode::InvalidResponse
    );
    assert_eq!(
        serde_json::to_value(db.checkpoint_v2(&id(2)).unwrap()).unwrap(),
        before
    );
}

use wimm_local_contracts::checkpoint_v2::LocalCheckpointRestoreV2;
fn checkpoint_value(db: &LegacySqliteWriter<CoreValidator>) -> serde_json::Value {
    serde_json::to_value(db.checkpoint_v2(&id(2)).unwrap()).unwrap()
}
#[test]
fn connected_restore_rotates_only_local_write_epoch_and_retains_all_historical_receipts() {
    use wimm_persistence_contracts::CommitOutcome;
    let file = path("native-connected-restore");
    drop(fixture(&file));
    let mut db = LegacySqliteWriter::open(&file, id(1), CoreValidator).unwrap();
    migrate_commit(&mut db);
    assert!(matches!(
        db.commit(request(31, 2)),
        CommitOutcome::Committed { .. }
    ));
    db.save_sync_page(sync_page(2)).unwrap();
    let target = db.checkpoint_v2(&id(2)).unwrap();
    assert!(matches!(
        db.commit(request(32, 3)),
        CommitOutcome::Committed { .. }
    ));
    let expected = db.checkpoint_v2(&id(2)).unwrap();
    let p = NativeProtection(wimm_client_crypto::SecretKey::from_bytes(&[42; 32]).unwrap());
    let b = NativeBackup::new();
    let proof = db.backup_checkpoint_v2(&id(2), &p, &b).unwrap();
    db.restore_checkpoint_v2(
        LocalCheckpointRestoreV2 {
            expected,
            original_backup: proof,
            ciphertext: p.seal(target.clone()).unwrap(),
            restored_local_epoch: id(99),
        },
        &p,
        &b,
        &NeverCancel,
    )
    .unwrap();
    let restored = db.checkpoint_v2(&id(2)).unwrap();
    assert_eq!(restored.local_write_epoch, id(99));
    assert_eq!(restored.snapshot.epoch, id(3));
    assert_eq!(
        serde_json::to_value(&restored.snapshot.confirmed).unwrap(),
        serde_json::to_value(&target.snapshot.confirmed).unwrap()
    );
    assert_eq!(
        serde_json::to_value(&restored.snapshot.sync_state).unwrap(),
        serde_json::to_value(&target.snapshot.sync_state).unwrap()
    );
    assert_eq!(restored.operations.len(), 2);
    assert_eq!(db.initialize_area(&id(2), &id(80)).unwrap(), id(99));
    assert!(
        db.lookup_result(&request(32, 3).identity)
            .unwrap()
            .is_some()
    );
    assert!(
        matches!(db.commit(request(33,3)),CommitOutcome::NotCommitted{error} if error.code==StorageFailureCode::EpochMismatch)
    );
    let mut next = request(33, 3);
    next.identity.epoch = id(99);
    assert!(matches!(db.commit(next), CommitOutcome::Committed { .. }));
    drop(db);
    let mut reopened = LegacySqliteWriter::open(&file, id(1), CoreValidator).unwrap();
    assert_eq!(reopened.initialize_area(&id(2), &id(80)).unwrap(), id(99));
    assert_eq!(
        reopened
            .export_snapshot(&id(2))
            .unwrap()
            .sync_state
            .unwrap()
            .epoch,
        id(3)
    );
}
#[test]
fn full_restore_cas_covers_receipts_and_profile_wide_private_recovery() {
    for change in ["commit", "journal"] {
        let file = path("native-restore-cas");
        drop(fixture(&file));
        let mut db = LegacySqliteWriter::open(&file, id(1), CoreValidator).unwrap();
        migrate_commit(&mut db);
        let expected = db.checkpoint_v2(&id(2)).unwrap();
        let p = NativeProtection(wimm_client_crypto::SecretKey::from_bytes(&[42; 32]).unwrap());
        let b = NativeBackup::new();
        let proof = db.backup_checkpoint_v2(&id(2), &p, &b).unwrap();
        if change == "commit" {
            db.commit(request(31, 2));
        } else {
            db.save_recovery_if_absent(b"synthetic-opaque-pending")
                .unwrap();
        }
        let before = checkpoint_value(&db);
        let cipher = p.seal(expected.clone()).unwrap();
        assert_eq!(
            db.restore_checkpoint_v2(
                LocalCheckpointRestoreV2 {
                    expected,
                    original_backup: proof,
                    ciphertext: cipher,
                    restored_local_epoch: id(99)
                },
                &p,
                &b,
                &NeverCancel
            )
            .unwrap_err()
            .code,
            StorageFailureCode::RevisionConflict
        );
        assert_eq!(checkpoint_value(&db), before);
    }
}
#[test]
fn full_restore_preserves_unresolved_original_and_rejects_conflicting_recovery() {
    let file = path("native-restore-journal");
    drop(fixture(&file));
    let mut db = LegacySqliteWriter::open(&file, id(1), CoreValidator).unwrap();
    migrate_commit(&mut db);
    let old = db.checkpoint_v2(&id(2)).unwrap();
    db.save_recovery_if_absent(b"synthetic-opaque-current")
        .unwrap();
    let expected = db.checkpoint_v2(&id(2)).unwrap();
    let p = NativeProtection(wimm_client_crypto::SecretKey::from_bytes(&[42; 32]).unwrap());
    let b = NativeBackup::new();
    let proof = db.backup_checkpoint_v2(&id(2), &p, &b).unwrap();
    let mut conflicting = old.clone();
    conflicting.recovery = Some(b"synthetic-different".to_vec());
    let before = checkpoint_value(&db);
    assert_eq!(
        db.restore_checkpoint_v2(
            LocalCheckpointRestoreV2 {
                expected: expected.clone(),
                original_backup: proof.clone(),
                ciphertext: p.seal(conflicting).unwrap(),
                restored_local_epoch: id(99)
            },
            &p,
            &b,
            &NeverCancel
        )
        .unwrap_err()
        .code,
        StorageFailureCode::RevisionConflict
    );
    assert_eq!(checkpoint_value(&db), before);
    db.restore_checkpoint_v2(
        LocalCheckpointRestoreV2 {
            expected,
            original_backup: proof,
            ciphertext: p.seal(old).unwrap(),
            restored_local_epoch: id(99),
        },
        &p,
        &b,
        &NeverCancel,
    )
    .unwrap();
    assert_eq!(
        db.load_recovery().unwrap().unwrap(),
        b"synthetic-opaque-current"
    );
}
#[test]
fn full_restore_abort_after_deletion_rolls_back_local_epoch_server_state_and_receipts() {
    for injected in [false, true] {
        let file = path("native-full-restore-rollback");
        let mut raw = fixture(&file);
        let mut db = LegacySqliteWriter::open(&file, id(1), CoreValidator).unwrap();
        migrate_commit(&mut db);
        db.commit(request(31, 2));
        let original = db.checkpoint_v2(&id(2)).unwrap();
        let p = NativeProtection(wimm_client_crypto::SecretKey::from_bytes(&[42; 32]).unwrap());
        let b = NativeBackup::new();
        let proof = db.backup_checkpoint_v2(&id(2), &p, &b).unwrap();
        let before = checkpoint_value(&db);
        if injected {
            raw.batch_execute("CREATE TRIGGER synthetic_restore_failure BEFORE INSERT ON confirmed BEGIN SELECT RAISE(ABORT,'synthetic-private-error'); END;").unwrap();
        }
        let cancel = CancelAt {
            at: if injected { 99 } else { 3 },
            calls: std::cell::Cell::new(0),
        };
        let error = db
            .restore_checkpoint_v2(
                LocalCheckpointRestoreV2 {
                    expected: original.clone(),
                    original_backup: proof,
                    ciphertext: p.seal(original).unwrap(),
                    restored_local_epoch: id(99),
                },
                &p,
                &b,
                &cancel,
            )
            .unwrap_err();
        if !injected {
            assert_eq!(error.code, StorageFailureCode::Cancelled);
        }
        assert_eq!(checkpoint_value(&db), before);
        assert_eq!(db.initialize_area(&id(2), &id(80)).unwrap(), id(3));
    }
}
#[test]
fn standalone_restore_rotates_local_snapshot_epoch_without_fabricated_sync_cursor() {
    let file = path("native-standalone-restore");
    let mut raw = fixture(&file);
    raw.batch_execute("DELETE FROM confirmed").unwrap();
    let mut db = LegacySqliteWriter::open(&file, id(1), CoreValidator).unwrap();
    migrate_commit(&mut db);
    let original = db.checkpoint_v2(&id(2)).unwrap();
    let p = NativeProtection(wimm_client_crypto::SecretKey::from_bytes(&[42; 32]).unwrap());
    let b = NativeBackup::new();
    let proof = db.backup_checkpoint_v2(&id(2), &p, &b).unwrap();
    db.restore_checkpoint_v2(
        LocalCheckpointRestoreV2 {
            expected: original.clone(),
            original_backup: proof,
            ciphertext: p.seal(original).unwrap(),
            restored_local_epoch: id(99),
        },
        &p,
        &b,
        &NeverCancel,
    )
    .unwrap();
    let result = db.checkpoint_v2(&id(2)).unwrap();
    assert_eq!(result.local_write_epoch, id(99));
    assert_eq!(result.snapshot.epoch, id(99));
    assert!(result.snapshot.sync_state.is_none());
    assert!(result.snapshot.confirmed.is_empty());
}
#[test]
fn physical_three_upgrade_preserves_receipts_recovery_and_requires_full_original_backup() {
    let file = path("native-three-upgrade");
    let mut raw = fixture(&file);
    let mut db = LegacySqliteWriter::open(&file, id(1), CoreValidator).unwrap();
    migrate_commit(&mut db);
    db.commit(request(31, 2));
    db.save_recovery_if_absent(b"synthetic-opaque-original")
        .unwrap();
    // Tatsächlich früherer registrierter physischer Stand drei, ohne getrennten lokalen Marker.
    raw.batch_execute("UPDATE storage_meta SET value='3' WHERE key='storageSchemaVersion'; DELETE FROM storage_meta WHERE key LIKE 'localWriteEpoch:%'; UPDATE wimm_native_schema SET version=1;").unwrap();
    let original = db.checkpoint_v2(&id(2)).unwrap();
    assert_eq!(original.physical_schema_version, 3);
    assert!(db.apply_atomic_batch(request(32, 3).batch).is_err());
    let p = NativeProtection(wimm_client_crypto::SecretKey::from_bytes(&[42; 32]).unwrap());
    let b = NativeBackup::new();
    let proof = db.backup_checkpoint_v2(&id(2), &p, &b).unwrap();
    let cancel = CancelAt {
        at: 2,
        calls: std::cell::Cell::new(0),
    };
    assert_eq!(
        db.upgrade_local_epoch_schema(
            vec![original.clone()],
            std::slice::from_ref(&proof),
            &p,
            &b,
            &cancel
        )
        .unwrap_err()
        .code,
        StorageFailureCode::Cancelled
    );
    assert_eq!(
        checkpoint_value(&db),
        serde_json::to_value(&original).unwrap()
    );
    db.upgrade_local_epoch_schema(vec![original.clone()], &[proof], &p, &b, &NeverCancel)
        .unwrap();
    let mut expected = original;
    expected.physical_schema_version = 4;
    assert_eq!(
        checkpoint_value(&db),
        serde_json::to_value(expected).unwrap()
    );
}

#[test]
fn full_restore_missing_backup_wrong_key_bad_scope_hash_and_version_preserve_original() {
    for fault in ["missing", "key", "hash", "scope", "version", "sameEpoch"] {
        let file = path("native-restore-input-negative");
        drop(fixture(&file));
        let mut db = LegacySqliteWriter::open(&file, id(1), CoreValidator).unwrap();
        migrate_commit(&mut db);
        db.commit(request(31, 2));
        let expected = db.checkpoint_v2(&id(2)).unwrap();
        let p = NativeProtection(wimm_client_crypto::SecretKey::from_bytes(&[42; 32]).unwrap());
        let b = NativeBackup::new();
        let mut proof = db.backup_checkpoint_v2(&id(2), &p, &b).unwrap();
        let before = checkpoint_value(&db);
        let mut target = expected.clone();
        if fault == "missing" {
            std::fs::remove_file(b.directory.join(proof.backup_id.as_str())).unwrap();
        }
        if fault == "hash" {
            proof.snapshot_hash = LocalHash::new("ab".repeat(32)).unwrap();
        }
        if fault == "scope" {
            target.snapshot.profile_id = id(90);
        }
        if fault == "version" {
            target.physical_schema_version = 99;
        }
        let cipher = p.seal(target).unwrap();
        let wrong = NativeProtection(wimm_client_crypto::SecretKey::from_bytes(&[99; 32]).unwrap());
        let selected = if fault == "key" { &wrong } else { &p };
        let epoch = if fault == "sameEpoch" {
            expected.local_write_epoch.clone()
        } else {
            id(99)
        };
        assert!(
            db.restore_checkpoint_v2(
                LocalCheckpointRestoreV2 {
                    expected,
                    original_backup: proof,
                    ciphertext: cipher,
                    restored_local_epoch: epoch
                },
                selected,
                &b,
                &NeverCancel
            )
            .is_err()
        );
        assert_eq!(checkpoint_value(&db), before);
    }
}
