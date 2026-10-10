// SPDX-License-Identifier: AGPL-3.0-or-later
//! Registrierte Vorwärtsschritte; Sicherung und vollständiger Ausgangsstand vor DDL.
use crate::storage_failure::{
    StorageFailure, StorageFailureCode, commit_error, failure, storage_error,
};
use crate::{
    backups::{BackupReceipt, BackupState, EncryptedBackupReader},
    storage::{StorageState, assert_supported_schema, snapshot_in_transaction},
};
use base64::{Engine, engine::general_purpose::URL_SAFE_NO_PAD};
use rusqlite::{Connection, OptionalExtension, TransactionBehavior, params};
use serde::Deserialize;
use serde_json::Value;
use sha2::{Digest, Sha256};
use std::{
    collections::HashMap,
    sync::{
        Arc, Mutex,
        atomic::{AtomicBool, Ordering},
    },
};
use tauri::Manager;
#[derive(Default)]
pub struct MigrationCancellationState(pub Mutex<HashMap<String, Arc<AtomicBool>>>);

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Versions {
    storage_schema_version: u32,
    domain_schema_version: u32,
}
#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Step {
    number: u32,
    from: Versions,
    to: Versions,
    destructive: bool,
}
#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Plan {
    expected_migration_number: u32,
    from: Versions,
    steps: Vec<Step>,
}
#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct MigrationInput {
    plan: Plan,
    expected_snapshot: Value,
    snapshot_bytes: Vec<u8>,
    backup: BackupReceipt,
}

// Nur abgeleitete lokale Indizes; keine Finanzpayloads, Entwürfe oder Epochen ändern.
const INDEX_DDL: &str = "
CREATE INDEX transactions_by_account_date ON aggregates(profile_id,space_id,json_extract(payload,'$.accountId'),json_extract(payload,'$.date'),handle)
 WHERE json_extract(payload,'$.aggregateType')='transaction' AND json_extract(payload,'$.deletedAt') IS NULL;
CREATE INDEX transactions_by_import_reference ON aggregates(profile_id,space_id,json_extract(payload,'$.importReference'),json_extract(payload,'$.date'),handle)
 WHERE json_extract(payload,'$.aggregateType')='transaction' AND json_extract(payload,'$.deletedAt') IS NULL;
CREATE INDEX import_sources_by_external ON aggregates(profile_id,space_id,json_extract(payload,'$.accountId'),json_extract(payload,'$.parserSource'),json_extract(payload,'$.externalId'),handle)
 WHERE json_extract(payload,'$.aggregateType')='importFingerprint' AND json_extract(payload,'$.deletedAt') IS NULL;
CREATE INDEX rules_by_order ON aggregates(profile_id,space_id,json_extract(payload,'$.order'),handle)
 WHERE json_extract(payload,'$.aggregateType')='rule' AND json_extract(payload,'$.deletedAt') IS NULL;
CREATE INDEX occurrences_by_schedule_date ON aggregates(profile_id,space_id,json_extract(payload,'$.scheduleId'),json_extract(payload,'$.dueDate'),handle)
 WHERE json_extract(payload,'$.aggregateType')='scheduleOccurrence' AND json_extract(payload,'$.deletedAt') IS NULL;
CREATE INDEX outbox_by_state_created ON outbox(profile_id,space_id,state,CASE WHEN json_type(payload,'$.createdAt')='text' THEN json_extract(payload,'$.createdAt') WHEN json_type(payload,'$.draft.occurredAt')='text' THEN json_extract(payload,'$.draft.occurredAt') ELSE '' END,operation_id);
CREATE TABLE transaction_categories (
 profile_id TEXT NOT NULL, handle TEXT NOT NULL, space_id TEXT NOT NULL, category_id TEXT NOT NULL, date TEXT NOT NULL,
 PRIMARY KEY(profile_id,handle,category_id), FOREIGN KEY(profile_id,handle) REFERENCES aggregates(profile_id,handle) ON DELETE CASCADE
);
CREATE INDEX transactions_by_category_date ON transaction_categories(profile_id,space_id,category_id,date,handle);
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
CREATE TABLE storage_migrations(number INTEGER PRIMARY KEY,from_storage INTEGER NOT NULL,to_storage INTEGER NOT NULL,domain_version INTEGER NOT NULL,backup_id TEXT NOT NULL,snapshot_hash TEXT NOT NULL,profile_id TEXT NOT NULL,space_id TEXT NOT NULL,epoch TEXT NOT NULL);
";

pub fn migrate(
    connection: &mut Connection,
    backups: &dyn EncryptedBackupReader,
    input: MigrationInput,
    cancelled: impl Fn() -> bool,
) -> Result<(), StorageFailure> {
    let plan = &input.plan;
    if plan.expected_migration_number != 0
        || plan.from.storage_schema_version != 1
        || plan.from.domain_schema_version != 1
        || plan.steps.len() != 1
    {
        return Err(failure(StorageFailureCode::WriteFailed));
    }
    let step = &plan.steps[0];
    if step.number != 1
        || step.from.storage_schema_version != 1
        || step.from.domain_schema_version != 1
        || step.to.storage_schema_version != 2
        || step.to.domain_schema_version != 1
        || step.destructive
    {
        return Err(failure(StorageFailureCode::WriteFailed));
    }
    if cancelled() {
        return Err(failure(StorageFailureCode::Cancelled));
    }
    let mut expected = input.expected_snapshot;
    if expected.get("syncState") == Some(&Value::Null) {
        expected
            .as_object_mut()
            .ok_or_else(|| failure(StorageFailureCode::WriteFailed))?
            .remove("syncState");
    }
    let encoded: Value = serde_json::from_slice(&input.snapshot_bytes).map_err(storage_error)?;
    if encoded != expected
        || URL_SAFE_NO_PAD.encode(Sha256::digest(&input.snapshot_bytes))
            != input.backup.snapshot_hash
    {
        return Err(failure(StorageFailureCode::WriteFailed));
    }
    for (field, value) in [
        ("profileId", &input.backup.profile_id),
        ("spaceId", &input.backup.space_id),
        ("epoch", &input.backup.epoch),
    ] {
        if expected.get(field).and_then(Value::as_str) != Some(value) {
            return Err(failure(StorageFailureCode::WriteFailed));
        }
    }
    backups.read_ciphertext(&input.backup)?;
    assert_supported_schema(connection).map_err(storage_error)?;
    let tx = connection
        .transaction_with_behavior(TransactionBehavior::Immediate)
        .map_err(storage_error)?;
    let version: String = tx
        .query_row(
            "SELECT value FROM storage_meta WHERE key='storageSchemaVersion'",
            [],
            |row| row.get(0),
        )
        .map_err(storage_error)?;
    let journal_exists: bool = tx.query_row("SELECT EXISTS(SELECT 1 FROM sqlite_master WHERE type='table' AND name='storage_migrations')", [], |row| row.get(0)).map_err(storage_error)?;
    let last: Option<u32> = if journal_exists {
        tx.query_row("SELECT max(number) FROM storage_migrations", [], |row| {
            row.get(0)
        })
        .optional()
        .map_err(storage_error)?
        .flatten()
    } else {
        None
    };
    if version != "1" || last.unwrap_or(0) != plan.expected_migration_number {
        return Err(failure(StorageFailureCode::RevisionConflict));
    }
    let actual = serde_json::to_value(snapshot_in_transaction(
        &tx,
        &input.backup.profile_id,
        &input.backup.space_id,
    )?)
    .map_err(storage_error)?;
    if actual != expected {
        return Err(failure(StorageFailureCode::RevisionConflict));
    }
    if cancelled() {
        return Err(failure(StorageFailureCode::Cancelled));
    }
    tx.execute_batch(INDEX_DDL).map_err(storage_error)?;
    tx.execute(
        "INSERT INTO storage_migrations VALUES(1,1,2,1,?1,?2,?3,?4,?5)",
        params![
            input.backup.backup_id,
            input.backup.snapshot_hash,
            input.backup.profile_id,
            input.backup.space_id,
            input.backup.epoch
        ],
    )
    .map_err(storage_error)?;
    tx.execute(
        "UPDATE storage_meta SET value='2' WHERE key='storageSchemaVersion'",
        [],
    )
    .map_err(storage_error)?;
    if cancelled() {
        return Err(failure(StorageFailureCode::Cancelled));
    }
    tx.commit().map_err(commit_error)
}

#[tauri::command]
pub async fn storage_migrate(
    app: tauri::AppHandle,
    migration_id: String,
    input: MigrationInput,
) -> Result<(), StorageFailure> {
    if !crate::backups::valid_uuid(&migration_id) {
        return Err(failure(StorageFailureCode::WriteFailed));
    }
    let flag = Arc::new(AtomicBool::new(false));
    {
        let registry = app.state::<MigrationCancellationState>();
        let mut entries = registry
            .0
            .lock()
            .map_err(|_| failure(StorageFailureCode::ResourceUnavailable))?;
        if entries.contains_key(&migration_id) {
            return Err(failure(StorageFailureCode::OperationIdReused));
        }
        entries.insert(migration_id.clone(), flag.clone());
    }
    let worker_app = app.clone();
    let result = tauri::async_runtime::spawn_blocking(move || {
        let backup_state = worker_app.state::<BackupState>();
        let backup_connection = backup_state
            .0
            .lock()
            .map_err(|_| failure(StorageFailureCode::ResourceUnavailable))?;
        let storage_state = worker_app.state::<StorageState>();
        let mut connection = storage_state
            .0
            .lock()
            .map_err(|_| failure(StorageFailureCode::ResourceUnavailable))?;
        migrate(&mut connection, &*backup_connection, input, || {
            flag.load(Ordering::Acquire)
        })
    })
    .await;
    app.state::<MigrationCancellationState>()
        .0
        .lock()
        .map_err(|_| StorageFailure::unknown(StorageFailureCode::ResourceUnavailable))?
        .remove(&migration_id);
    result.map_err(|_| StorageFailure::unknown(StorageFailureCode::CommitUnknown))?
}
#[tauri::command]
pub fn storage_cancel_migration(
    state: tauri::State<'_, MigrationCancellationState>,
    migration_id: String,
) -> Result<(), StorageFailure> {
    if !crate::backups::valid_uuid(&migration_id) {
        return Err(failure(StorageFailureCode::WriteFailed));
    }
    if let Some(flag) = state
        .0
        .lock()
        .map_err(|_| failure(StorageFailureCode::ResourceUnavailable))?
        .get(&migration_id)
    {
        flag.store(true, Ordering::Release);
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::backups::{BackupInput, initialize_backups, persist_backup};
    use crate::storage::{export_snapshot, initialize_area, initialize_storage};
    use serde_json::json;
    const PROFILE: &str = "00000000-0000-4000-8000-000000000001";
    const SPACE: &str = "00000000-0000-4000-8000-000000000002";
    const EPOCH: &str = "00000000-0000-4000-8000-000000000003";
    fn basis(db: &mut Connection, backups: &mut Connection) -> MigrationInput {
        initialize_storage(db).unwrap();
        initialize_area(db, PROFILE, SPACE, EPOCH).unwrap();
        initialize_backups(backups).unwrap();
        let expected = serde_json::to_value(export_snapshot(db, PROFILE, SPACE).unwrap()).unwrap();
        let bytes = serde_json::to_vec(&expected).unwrap();
        let receipt = BackupReceipt {
            backup_id: "00000000-0000-4000-8000-000000000004".into(),
            profile_id: PROFILE.into(),
            space_id: SPACE.into(),
            epoch: EPOCH.into(),
            snapshot_hash: URL_SAFE_NO_PAD.encode(Sha256::digest(&bytes)),
        };
        persist_backup(
            backups,
            BackupInput {
                receipt: receipt.clone(),
                ciphertext: vec![0, 255, 1],
            },
        )
        .unwrap();
        serde_json::from_value(json!({"plan":{"expectedMigrationNumber":0,"from":{"storageSchemaVersion":1,"domainSchemaVersion":1},"steps":[{"number":1,"from":{"storageSchemaVersion":1,"domainSchemaVersion":1},"to":{"storageSchemaVersion":2,"domainSchemaVersion":1},"destructive":false}]},"expectedSnapshot":expected,"snapshotBytes":bytes,"backup":receipt})).unwrap()
    }
    #[test]
    fn successful_migration_journals_indices_and_reopens_without_changing_original_data() {
        let dir = tempfile::tempdir_in(".").unwrap();
        let path = dir.path().join("migration.sqlite3");
        let mut db = Connection::open(&path).unwrap();
        let mut backups = Connection::open_in_memory().unwrap();
        let input = basis(&mut db, &mut backups);
        let before = input.expected_snapshot.clone();
        migrate(&mut db, &backups, input, || false).unwrap();
        drop(db);
        let mut db = Connection::open(&path).unwrap();
        initialize_storage(&db).unwrap();
        let mut after =
            serde_json::to_value(export_snapshot(&mut db, PROFILE, SPACE).unwrap()).unwrap();
        assert_eq!(after["storageSchemaVersion"], 2);
        after["storageSchemaVersion"] = json!(1);
        assert_eq!(after, before);
        assert_eq!(
            db.query_row("SELECT number FROM storage_migrations", [], |row| row
                .get::<_, u32>(0))
                .unwrap(),
            1
        );
        assert_eq!(db.query_row("SELECT count(*) FROM sqlite_master WHERE type='index' AND name IN ('transactions_by_account_date','transactions_by_category_date','transactions_by_import_reference','outbox_by_state_created')",[],|row|row.get::<_,u32>(0)).unwrap(),4);
    }
    #[test]
    fn cancellation_after_ddl_rolls_back_schema_journal_and_version() {
        for threshold in [1, 2, 3] {
            let mut db = Connection::open_in_memory().unwrap();
            let mut backups = Connection::open_in_memory().unwrap();
            let input = basis(&mut db, &mut backups);
            let before = input.expected_snapshot.clone();
            let calls = std::cell::Cell::new(0);
            assert!(
                migrate(&mut db, &backups, input, || {
                    calls.set(calls.get() + 1);
                    calls.get() >= threshold
                })
                .is_err()
            );
            assert_eq!(
                serde_json::to_value(export_snapshot(&mut db, PROFILE, SPACE).unwrap()).unwrap(),
                before
            );
            assert_eq!(db.query_row("SELECT count(*) FROM sqlite_master WHERE name='transaction_categories' OR name='storage_migrations'",[],|row|row.get::<_,u32>(0)).unwrap(),0);
        }
    }
    #[test]
    fn stale_data_same_revision_and_missing_or_wrong_backup_prevent_ddl() {
        for mode in ["data", "hash", "backup", "plan"] {
            let mut db = Connection::open_in_memory().unwrap();
            let mut backups = Connection::open_in_memory().unwrap();
            let mut input = basis(&mut db, &mut backups);
            match mode {
                "data" => {
                    db.execute("INSERT INTO outbox VALUES(?1,?2,?3,'blocked',?4)",params![PROFILE,EPOCH,SPACE,json!({"operationId":EPOCH,"spaceId":SPACE,"state":"blocked","draft":"Konkurrierender Originalentwurf","expectedRevisions":[],"dependsOn":[],"retryCount":0}).to_string()]).unwrap();
                }
                "hash" => input.backup.snapshot_hash = "fremd".into(),
                "backup" => {
                    backups
                        .execute("DELETE FROM encrypted_backups", [])
                        .unwrap();
                }
                _ => input.plan.steps[0].number = 2,
            }
            let before =
                serde_json::to_value(export_snapshot(&mut db, PROFILE, SPACE).unwrap()).unwrap();
            assert!(migrate(&mut db, &backups, input, || false).is_err());
            assert_eq!(
                serde_json::to_value(export_snapshot(&mut db, PROFILE, SPACE).unwrap()).unwrap(),
                before
            );
            assert_eq!(
                db.query_row(
                    "SELECT count(*) FROM sqlite_master WHERE name='transaction_categories'",
                    [],
                    |row| row.get::<_, u32>(0)
                )
                .unwrap(),
                0
            );
        }
    }
    #[test]
    fn rust_index_queries_follow_atomic_reference_and_outbox_changes() {
        let mut db = Connection::open_in_memory().unwrap();
        let mut backups = Connection::open_in_memory().unwrap();
        let input = basis(&mut db, &mut backups);
        migrate(&mut db, &backups, input, || false).unwrap();
        let handle = "00000000-0000-4000-8000-000000000020";
        let account = "00000000-0000-4000-8000-000000000010";
        let category = "00000000-0000-4000-8000-000000000013";
        let payload = json!({"aggregateType":"transaction","id":handle,"spaceId":SPACE,"handle":handle,"revision":1,"accountId":account,"date":"2026-10-09","amount":-100,"splits":[{"id":EPOCH,"categoryId":category,"amount":-100}],"importReference":"synthetische-Quelle"});
        db.execute(
            "INSERT INTO aggregates VALUES(?1,?2,?3,1,?4)",
            params![PROFILE, handle, SPACE, payload.to_string()],
        )
        .unwrap();
        for (kind, reference) in [
            ("account", account),
            ("category", category),
            ("import", "synthetische-Quelle"),
        ] {
            let query = serde_json::from_value(
                json!({"spaceId":SPACE,"kind":kind,"reference":reference,"limit":100}),
            )
            .unwrap();
            assert_eq!(
                query_transactions(&db, PROFILE, query).unwrap()[0]["id"],
                handle
            );
        }
        let fingerprint = "00000000-0000-4000-8000-000000000021";
        let source = json!({"aggregateType":"importFingerprint","id":fingerprint,"accountId":account,"parserSource":"csv","externalId":"synthetische-externe-id","transactionId":handle});
        db.execute(
            "INSERT INTO aggregates VALUES(?1,?2,?3,1,?4)",
            params![PROFILE, fingerprint, SPACE, source.to_string()],
        )
        .unwrap();
        let query=serde_json::from_value(json!({"spaceId":SPACE,"accountId":account,"parserSource":"csv","externalId":"synthetische-externe-id","limit":100})).unwrap();
        assert_eq!(
            query_imported(&db, PROFILE, query).unwrap()[0]["id"],
            handle
        );
        db.execute("UPDATE aggregates SET payload=json_set(payload,'$.deletedAt','2026-10-09T12:00:00Z') WHERE handle=?1",[handle]).unwrap();
        let query = serde_json::from_value(
            json!({"spaceId":SPACE,"kind":"category","reference":category,"limit":100}),
        )
        .unwrap();
        assert!(query_transactions(&db, PROFILE, query).unwrap().is_empty());
        for (operation_id, created_at) in [
            (
                "00000000-0000-4000-8000-000000000101",
                "2026-10-09T12:00:00Z",
            ),
            (
                "00000000-0000-4000-8000-000000000100",
                "2026-10-09T11:00:00Z",
            ),
        ] {
            let operation = json!({"operationId":operation_id,"spaceId":SPACE,"state":"queued","createdAt":created_at});
            db.execute(
                "INSERT INTO outbox VALUES(?1,?2,?3,'queued',?4)",
                params![PROFILE, operation_id, SPACE, operation.to_string()],
            )
            .unwrap();
        }
        let query =
            serde_json::from_value(json!({"spaceId":SPACE,"state":"queued","limit":100})).unwrap();
        assert_eq!(
            query_pending(&db, PROFILE, query).unwrap()[0]["operationId"],
            "00000000-0000-4000-8000-000000000100"
        );
        let invalid=serde_json::from_value(json!({"spaceId":SPACE,"kind":"account","reference":account,"fromDate":"2026-02-30","limit":100})).unwrap();
        assert!(query_transactions(&db, PROFILE, invalid).is_err());
    }

    #[test]
    fn actual_thread_cancellation_before_commit_preserves_the_original_schema() {
        let mut db = Connection::open_in_memory().unwrap();
        let mut backups = Connection::open_in_memory().unwrap();
        let input = basis(&mut db, &mut backups);
        let before = input.expected_snapshot.clone();
        let flag = Arc::new(AtomicBool::new(false));
        let worker_flag = flag.clone();
        let (checkpoint_tx, checkpoint_rx) = std::sync::mpsc::channel();
        let (resume_tx, resume_rx) = std::sync::mpsc::channel();
        let worker = std::thread::spawn(move || {
            let checks = std::cell::Cell::new(0);
            let result = migrate(&mut db, &backups, input, || {
                checks.set(checks.get() + 1);
                if checks.get() == 3 {
                    checkpoint_tx.send(()).unwrap();
                    resume_rx.recv().unwrap();
                }
                worker_flag.load(Ordering::Acquire)
            });
            assert!(result.is_err());
            db
        });
        checkpoint_rx.recv().unwrap();
        flag.store(true, Ordering::Release);
        resume_tx.send(()).unwrap();
        let mut db = worker.join().unwrap();
        assert_eq!(
            serde_json::to_value(export_snapshot(&mut db, PROFILE, SPACE).unwrap()).unwrap(),
            before
        );
        assert_eq!(db.query_row("SELECT count(*) FROM sqlite_master WHERE name='storage_migrations' OR name='transaction_categories'",[],|row|row.get::<_,u32>(0)).unwrap(),0);
    }

    #[test]
    fn partial_ddl_error_rolls_back_every_created_index() {
        let mut db = Connection::open_in_memory().unwrap();
        let mut backups = Connection::open_in_memory().unwrap();
        let input = basis(&mut db, &mut backups);
        db.execute_batch("CREATE INDEX transactions_by_category_date ON outbox(profile_id);")
            .unwrap();
        assert!(migrate(&mut db, &backups, input, || false).is_err());
        assert_eq!(db.query_row("SELECT count(*) FROM sqlite_master WHERE name='transactions_by_account_date' OR name='transaction_categories'",[],|row|row.get::<_,u32>(0)).unwrap(),0);
        assert_eq!(
            db.query_row(
                "SELECT value FROM storage_meta WHERE key='storageSchemaVersion'",
                [],
                |row| row.get::<_, String>(0)
            )
            .unwrap(),
            "1"
        );
    }
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
#[cfg(test)]
pub struct IndexCursor {
    date: String,
    handle: String,
}
#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
#[cfg(test)]
pub struct TransactionQuery {
    space_id: String,
    kind: String,
    reference: String,
    from_date: Option<String>,
    through_date: Option<String>,
    after: Option<IndexCursor>,
    limit: u32,
}
#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
#[cfg(test)]
pub struct PendingQuery {
    space_id: String,
    state: String,
    limit: u32,
}
#[cfg(test)]
fn require_indexes(db: &Connection) -> Result<(), StorageFailure> {
    assert_supported_schema(db).map_err(storage_error)?;
    let version: String = db
        .query_row(
            "SELECT value FROM storage_meta WHERE key='storageSchemaVersion'",
            [],
            |row| row.get(0),
        )
        .map_err(storage_error)?;
    if version != "2" {
        return Err(failure(StorageFailureCode::WriteFailed));
    }
    Ok(())
}
#[cfg(test)]
pub fn query_transactions(
    db: &Connection,
    profile: &str,
    query: TransactionQuery,
) -> Result<Vec<Value>, StorageFailure> {
    require_indexes(db)?;
    if query.limit == 0
        || query.limit > 1000
        || query.reference.is_empty()
        || !crate::backups::valid_uuid(profile)
        || !crate::backups::valid_uuid(&query.space_id)
        || query.kind != "import" && !crate::backups::valid_uuid(&query.reference)
        || [
            query.from_date.as_deref(),
            query.through_date.as_deref(),
            query.after.as_ref().map(|cursor| cursor.date.as_str()),
        ]
        .into_iter()
        .flatten()
        .any(|date| wimm_finance_core::calendar::parse_finance_date(date).is_err())
        || query
            .after
            .as_ref()
            .is_some_and(|cursor| !crate::backups::valid_uuid(&cursor.handle))
        || query
            .from_date
            .as_ref()
            .zip(query.through_date.as_ref())
            .is_some_and(|(from, through)| from > through)
    {
        return Err(failure(StorageFailureCode::WriteFailed));
    }
    let from = query.from_date.as_deref().unwrap_or("");
    let through = query.through_date.as_deref().unwrap_or("9999-12-31");
    let (after_date, after_handle) = query
        .after
        .as_ref()
        .map(|cursor| (cursor.date.as_str(), cursor.handle.as_str()))
        .unwrap_or(("", ""));
    let sql = match query.kind.as_str() {
        "account" => {
            "SELECT json_set(a.payload,'$.handle',a.handle,'$.spaceId',a.space_id,'$.revision',a.revision) FROM aggregates a WHERE a.profile_id=?1 AND a.space_id=?2 AND json_extract(a.payload,'$.aggregateType')='transaction' AND json_extract(a.payload,'$.deletedAt') IS NULL AND json_extract(a.payload,'$.accountId')=?3 AND json_extract(a.payload,'$.date') BETWEEN ?4 AND ?5 AND (json_extract(a.payload,'$.date'),a.handle)>(?6,?7) ORDER BY json_extract(a.payload,'$.date'),a.handle LIMIT ?8"
        }
        "import" => {
            "SELECT json_set(a.payload,'$.handle',a.handle,'$.spaceId',a.space_id,'$.revision',a.revision) FROM aggregates a WHERE a.profile_id=?1 AND a.space_id=?2 AND json_extract(a.payload,'$.aggregateType')='transaction' AND json_extract(a.payload,'$.deletedAt') IS NULL AND json_extract(a.payload,'$.importReference')=?3 AND json_extract(a.payload,'$.date') BETWEEN ?4 AND ?5 AND (json_extract(a.payload,'$.date'),a.handle)>(?6,?7) ORDER BY json_extract(a.payload,'$.date'),a.handle LIMIT ?8"
        }
        "category" => {
            "SELECT json_set(a.payload,'$.handle',a.handle,'$.spaceId',a.space_id,'$.revision',a.revision) FROM transaction_categories i JOIN aggregates a ON a.profile_id=i.profile_id AND a.handle=i.handle WHERE i.profile_id=?1 AND i.space_id=?2 AND i.category_id=?3 AND i.date BETWEEN ?4 AND ?5 AND (i.date,i.handle)>(?6,?7) ORDER BY i.date,i.handle LIMIT ?8"
        }
        _ => return Err(failure(StorageFailureCode::WriteFailed)),
    };
    let mut statement = db.prepare(sql).map_err(storage_error)?;
    statement
        .query_map(
            params![
                profile,
                query.space_id,
                query.reference,
                from,
                through,
                after_date,
                after_handle,
                query.limit
            ],
            |row| row.get::<_, String>(0),
        )
        .map_err(storage_error)?
        .map(|row| serde_json::from_str(&row.map_err(storage_error)?).map_err(storage_error))
        .collect()
}
#[cfg(test)]
pub fn query_pending(
    db: &Connection,
    profile: &str,
    query: PendingQuery,
) -> Result<Vec<Value>, StorageFailure> {
    require_indexes(db)?;
    if query.limit == 0
        || query.limit > 1000
        || !crate::backups::valid_uuid(profile)
        || !crate::backups::valid_uuid(&query.space_id)
        || !matches!(
            query.state.as_str(),
            "queued" | "sending" | "accepted" | "conflict" | "blocked" | "forbidden" | "invalid"
        )
    {
        return Err(failure(StorageFailureCode::WriteFailed));
    }
    let mut statement=db.prepare("SELECT payload FROM outbox WHERE profile_id=?1 AND space_id=?2 AND state=?3 ORDER BY CASE WHEN json_type(payload,'$.createdAt')='text' THEN json_extract(payload,'$.createdAt') WHEN json_type(payload,'$.draft.occurredAt')='text' THEN json_extract(payload,'$.draft.occurredAt') ELSE '' END,operation_id LIMIT ?4").map_err(storage_error)?;
    statement
        .query_map(
            params![profile, query.space_id, query.state, query.limit],
            |row| row.get::<_, String>(0),
        )
        .map_err(storage_error)?
        .map(|row| serde_json::from_str(&row.map_err(storage_error)?).map_err(storage_error))
        .collect()
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
#[cfg(test)]
pub struct ImportQuery {
    space_id: String,
    account_id: String,
    parser_source: String,
    external_id: String,
    limit: u32,
}
#[cfg(test)]
pub fn query_imported(
    db: &Connection,
    profile: &str,
    query: ImportQuery,
) -> Result<Vec<Value>, StorageFailure> {
    require_indexes(db)?;
    if !crate::backups::valid_uuid(profile)
        || !crate::backups::valid_uuid(&query.space_id)
        || !crate::backups::valid_uuid(&query.account_id)
        || query.external_id.is_empty()
        || query.parser_source.is_empty()
        || query.limit == 0
        || query.limit > 1000
    {
        return Err(failure(StorageFailureCode::WriteFailed));
    }
    let mut statement=db.prepare("SELECT DISTINCT json_set(t.payload,'$.handle',t.handle,'$.spaceId',t.space_id,'$.revision',t.revision) FROM aggregates f JOIN aggregates t ON t.profile_id=f.profile_id AND t.handle=json_extract(f.payload,'$.transactionId') AND t.space_id=f.space_id WHERE f.profile_id=?1 AND f.space_id=?2 AND json_extract(f.payload,'$.aggregateType')='importFingerprint' AND json_extract(f.payload,'$.deletedAt') IS NULL AND json_extract(f.payload,'$.accountId')=?3 AND json_extract(f.payload,'$.parserSource')=?4 AND json_extract(f.payload,'$.externalId')=?5 AND json_extract(t.payload,'$.aggregateType')='transaction' AND json_extract(t.payload,'$.deletedAt') IS NULL ORDER BY json_extract(t.payload,'$.date'),t.handle LIMIT ?6").map_err(storage_error)?;
    statement
        .query_map(
            params![
                profile,
                query.space_id,
                query.account_id,
                query.parser_source,
                query.external_id,
                query.limit
            ],
            |row| row.get::<_, String>(0),
        )
        .map_err(storage_error)?
        .map(|row| serde_json::from_str(&row.map_err(storage_error)?).map_err(storage_error))
        .collect()
}
