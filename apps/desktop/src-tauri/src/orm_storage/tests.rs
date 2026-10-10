// SPDX-License-Identifier: AGPL-3.0-or-later
use super::*;
use serde_json::Value;
fn decode<T: serde::de::DeserializeOwned>(value: &Value) -> Result<T, StorageFailure> {
    serde_json::from_value(value.clone()).map_err(|_| invalid())
}
#[test]
#[ignore = "ausschließlich vom gemeinsamen ORM-Speichervertrag gestartet"]
fn contract_driver() {
    use std::io::{BufRead, Write};
    let path = std::path::PathBuf::from(std::env::var("WIMM_CONTRACT_DATABASE").unwrap());
    let state = if path.exists() {
        OrmStorageState::open_existing(&path).unwrap()
    } else {
        OrmStorageState::initialize_new(&path).unwrap()
    };
    let backup_path = path.with_extension("backups.sqlite3");
    let mut backups = if backup_path.exists() {
        wimm_local_dal::sqlite_backup::SqliteBackupStore::open_existing(&backup_path)
    } else {
        wimm_local_dal::sqlite_backup::SqliteBackupStore::initialize_new(&backup_path)
    }
    .unwrap();
    for line in std::io::stdin().lock().lines() {
        let request: Value = serde_json::from_str(&line.unwrap()).unwrap();
        let args = &request["arguments"];
        let profile = args["profileId"].as_str().unwrap_or_default();
        let result: Result<Value, StorageFailure> = (|| match request["command"].as_str().unwrap() {
            "storage_persist_encrypted_backup" => {
                let input: crate::backups::BackupInput = decode(&args["input"])?;
                backups.persist(input.receipt.clone(), &input.ciphertext)?;
                serde_json::to_value(input.receipt).map_err(|_| invalid())
            }
            "storage_read_encrypted_backup" => {
                let receipt: crate::backups::BackupReceipt = decode(&args["receipt"])?;
                serde_json::to_value(backups.read(&receipt)?).map_err(|_| invalid())
            }
            "storage_migrate" => {
                let input: crate::migration::MigrationInput = decode(&args["input"])?;
                crate::migration::migrate_orm(&state, &backups, input, || false)?;
                Ok(Value::Null)
            }
            "storage_query_indexed_transactions" => {
                use wimm_local_contracts::index_ports::LocalIndexQueryPort;
                state.with_profile(profile, |p| {
                    serde_json::to_value(p.query_transactions(decode(&args["query"])?)?)
                        .map_err(|_| invalid())
                })
            }
            "storage_query_indexed_pending" => {
                use wimm_local_contracts::index_ports::LocalIndexQueryPort;
                state.with_profile(profile, |p| {
                    serde_json::to_value(p.query_pending(decode(&args["query"])?)?)
                        .map_err(|_| invalid())
                })
            }
            "storage_query_imported_transactions" => {
                use wimm_local_contracts::index_ports::LocalIndexQueryPort;
                state.with_profile(profile, |p| {
                    serde_json::to_value(p.query_imported(decode(&args["query"])?)?)
                        .map_err(|_| invalid())
                })
            }
            "storage_apply_batch" => {
                let b: StorageBatch = decode(&args["batch"])?;
                state.with_profile(b.profile_id.as_str(), |p| {
                    p.apply_atomic_batch(AtomicBatch {
                        expected_revisions: b.expected_revisions,
                        aggregates: b.aggregates,
                        outbox: b.outbox,
                        projections: b.projections,
                    })
                })?;
                Ok(Value::Null)
            }
            "storage_initialize_area" => {
                let space: EntityId = decode(&args["spaceId"])?;
                let epoch = decode(&args["proposedEpoch"])?;
                Ok(Value::String(
                    state
                        .with_profile(profile, |p| p.initialize_area(&space, &epoch))?
                        .as_str()
                        .into(),
                ))
            }
            "storage_read_aggregate" => state.with_profile(profile, |p| {
                serde_json::to_value(p.read_aggregate(&decode(&args["handle"])?)?)
                    .map_err(|_| invalid())
            }),
            "storage_query_aggregates" => state.with_profile(profile, |p| {
                serde_json::to_value(p.query(AggregateQuery {
                    space_id: decode(&args["spaceId"])?,
                })?)
                .map_err(|_| invalid())
            }),
            "storage_load_confirmed" => state.with_profile(profile, |p| {
                serde_json::to_value(p.load_confirmed(&decode(&args["spaceId"])?)?)
                    .map_err(|_| invalid())
            }),
            "storage_load_pending" => state.with_profile(profile, |p| {
                serde_json::to_value(p.load_pending(&decode(&args["spaceId"])?)?)
                    .map_err(|_| invalid())
            }),
            "storage_get_sync_state" => state.with_profile(profile, |p| {
                serde_json::to_value(p.get_sync_state(&decode(&args["spaceId"])?)?)
                    .map_err(|_| invalid())
            }),
            "storage_export_snapshot" => state.with_profile(profile, |p| {
                serde_json::to_value(p.export_snapshot(&decode(&args["spaceId"])?)?)
                    .map_err(|_| invalid())
            }),
            "storage_replace_snapshot" => {
                state.with_profile(profile, |p| p.replace_snapshot(decode(&args["snapshot"])?))?;
                Ok(Value::Null)
            }
            "storage_save_sync_page" => {
                state.with_profile(profile, |p| p.save_sync_page(decode(&args["page"])?))?;
                Ok(Value::Null)
            }
            "storage_rebuild_projections" => {
                state.with_profile(profile, |p| {
                    p.rebuild_projections(decode(&args["rebuild"])?)
                })?;
                Ok(Value::Null)
            }
            "test_schema_version" => {
                let raw = rusqlite::Connection::open(&path).unwrap();
                let key = if args["kind"] == "domain" {
                    "domainSchemaVersion"
                } else {
                    "storageSchemaVersion"
                };
                raw.execute(
                    "UPDATE storage_meta SET value=?1 WHERE key=?2",
                    rusqlite::params![args["version"].as_str().unwrap(), key],
                )
                .unwrap();
                Ok(Value::Null)
            }
            "test_projection_fault" => {
                let raw = rusqlite::Connection::open(&path).unwrap();
                raw.execute_batch("DROP TRIGGER IF EXISTS contract_projection_fault; DROP TABLE IF EXISTS contract_projection_writes;").unwrap();
                if args["enabled"] == true {
                    raw.execute_batch("CREATE TABLE contract_projection_writes(count INTEGER); INSERT INTO contract_projection_writes VALUES(0); CREATE TRIGGER contract_projection_fault BEFORE INSERT ON projections BEGIN UPDATE contract_projection_writes SET count=count+1; SELECT CASE WHEN (SELECT count FROM contract_projection_writes)>=2 THEN RAISE(ABORT,'synthetic') END; END;").unwrap();
                }
                Ok(Value::Null)
            }
            _ => Err(invalid()),
        })();
        let response = match result {
            Ok(value) => serde_json::json!({"id":request["id"],"value":value}),
            Err(error) => serde_json::json!({"id":request["id"],"error":error}),
        };
        println!("WIMM_CONTRACT:{response}");
        std::io::stdout().flush().unwrap();
    }
}
#[test]
fn direct_native_orm_migration_asserts_backup_cas_cancellation_and_index_journal() {
    use crate::{
        backups::{BackupReceipt, EncryptedBackupReader},
        migration::MigrationInput,
    };
    use base64::{Engine, engine::general_purpose::URL_SAFE_NO_PAD};
    use sha2::{Digest, Sha256};
    use wimm_local_contracts::index_ports::{LocalIndexQueryPort, PendingIndexQuery};
    struct Reader(BackupReceipt);
    impl EncryptedBackupReader for Reader {
        fn read_ciphertext(&self, r: &BackupReceipt) -> Result<Vec<u8>, StorageFailure> {
            if serde_json::to_value(&self.0).unwrap() == serde_json::to_value(r).unwrap() {
                Ok(vec![0, 255, 1])
            } else {
                Err(invalid())
            }
        }
    }
    // Opake synthetische Cipherbytes prüfen hier nur den DAL-Rücklesebeleg;
    // tatsächliche Verschlüsselung/Entschlüsselung läuft im gemeinsamen Katalog.
    let root = std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("../../../test-results/dal03/migrations");
    std::fs::create_dir_all(&root).unwrap();
    let path = root.join(format!(
        "native-{}-{}.sqlite3",
        std::process::id(),
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_nanos()
    ));
    let state = OrmStorageState::initialize_new(&path).unwrap();
    let profile = "10000000-0000-4000-8000-000000000001";
    let space = EntityId::new("10000000-0000-4000-8000-000000000002".into()).unwrap();
    let epoch = EntityId::new("10000000-0000-4000-8000-000000000003".into()).unwrap();
    state
        .with_profile(profile, |p| p.initialize_area(&space, &epoch))
        .unwrap();
    let source = state
        .with_profile(profile, |p| p.export_snapshot(&space))
        .unwrap();
    let bytes = serde_json::to_vec(&source).unwrap();
    let receipt: BackupReceipt = serde_json::from_value(serde_json::json!({
        "backupId":"10000000-0000-4000-8000-000000000004",
        "profileId":profile,"spaceId":space,"epoch":epoch,
        "snapshotHash":URL_SAFE_NO_PAD.encode(Sha256::digest(&bytes))
    }))
    .unwrap();
    let reader = Reader(receipt.clone());
    let input = || {
        serde_json::from_value::<MigrationInput>(serde_json::json!({"plan":{"expectedMigrationNumber":0,"from":{"storageSchemaVersion":1,"domainSchemaVersion":1},"steps":[{"number":1,"from":{"storageSchemaVersion":1,"domainSchemaVersion":1},"to":{"storageSchemaVersion":2,"domainSchemaVersion":1},"destructive":false}]},"expectedSnapshot":source,"snapshotBytes":bytes,"backup":receipt})).unwrap()
    };
    let calls = std::cell::Cell::new(0);
    assert_eq!(
        crate::migration::migrate_orm(&state, &reader, input(), || {
            let n = calls.get() + 1;
            calls.set(n);
            n >= 3
        })
        .unwrap_err()
        .code,
        StorageFailureCode::Cancelled
    );
    assert_eq!(
        state
            .with_profile(profile, |p| p.export_snapshot(&space))
            .unwrap()
            .storage_schema_version
            .value(),
        1
    );
    crate::migration::migrate_orm(&state, &reader, input(), || false).unwrap();
    assert_eq!(
        state
            .with_profile(profile, |p| p.export_snapshot(&space))
            .unwrap()
            .storage_schema_version
            .value(),
        2
    );
    assert!(crate::migration::migrate_orm(&state, &reader, input(), || false).is_err());
    assert!(
        state
            .with_profile(profile, |p| p.query_pending(PendingIndexQuery {
                space_id: space.clone(),
                state: PendingState::Queued,
                limit: 1
            }))
            .unwrap()
            .is_empty()
    );
}
#[test]
fn generated_tauri_ipc_command_names_and_typed_orm_arguments_roundtrip() {
    use tauri::Manager;
    let root =
        std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("../../../test-results/dal03/ipc");
    std::fs::create_dir_all(&root).unwrap();
    let path = root.join(format!(
        "ipc-{}-{}.sqlite3",
        std::process::id(),
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_nanos()
    ));
    let state = OrmStorageState::initialize_new(&path).unwrap();
    let app = tauri::test::mock_builder()
        .manage(state)
        .invoke_handler(tauri::generate_handler![
            super::orm_storage_initialize_area,
            super::orm_storage_export_snapshot,
            super::orm_storage_apply_batch
        ])
        .build(tauri::generate_context!())
        .unwrap();
    let view =
        tauri::WebviewWindowBuilder::new(&app, "main", tauri::WebviewUrl::App("index.html".into()))
            .build()
            .unwrap();
    let profile = "10000000-0000-4000-8000-000000000001";
    let space = "10000000-0000-4000-8000-000000000002";
    let epoch = "10000000-0000-4000-8000-000000000003";
    let call = |name: &str, body: Value| {
        tauri::test::get_ipc_response(
            &view,
            tauri::webview::InvokeRequest {
                cmd: name.into(),
                callback: tauri::ipc::CallbackFn(0),
                error: tauri::ipc::CallbackFn(1),
                url: "tauri://localhost".parse().unwrap(),
                body: tauri::ipc::InvokeBody::Json(body),
                headers: Default::default(),
                invoke_key: tauri::test::INVOKE_KEY.into(),
            },
        )
    };
    assert_eq!(
        call(
            "storage_initialize_area",
            serde_json::json!({"profileId":profile,"spaceId":space,"proposedEpoch":epoch})
        )
        .unwrap()
        .deserialize::<String>()
        .unwrap(),
        epoch
    );
    let result = call(
        "storage_export_snapshot",
        serde_json::json!({"profileId":profile,"spaceId":space}),
    )
    .unwrap()
    .deserialize::<Value>()
    .unwrap();
    assert_eq!(result["profileId"], profile);
    assert_eq!(result["epoch"], epoch);
    assert!(result["aggregates"].as_array().unwrap().is_empty());
    assert!(result.get("syncState").is_none());
    assert!(
        call(
            "storage_initialize_area",
            serde_json::json!({"profileId":profile,"spaceId":"bad","proposedEpoch":epoch})
        )
        .is_err()
    );
    assert!(
        call(
            "storage_apply_batch",
            serde_json::json!({"batch":{
                "profileId":profile,"expectedRevisions":[],"aggregates":[],"outbox":[],
                "projections":[{"spaceId":space,"kind":"balance","key":space,"payload":12},
                {"spaceId":space,"kind":"obsolete-cache","key":"old","payload":123}]
            }})
        )
        .is_err()
    );
    let unchanged = call(
        "storage_export_snapshot",
        serde_json::json!({"profileId":profile,"spaceId":space}),
    )
    .unwrap()
    .deserialize::<Value>()
    .unwrap();
    assert_eq!(unchanged, result);
    assert!(app.state::<OrmStorageState>().path.is_file());
}
