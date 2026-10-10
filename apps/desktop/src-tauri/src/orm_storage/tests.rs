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
    for line in std::io::stdin().lock().lines() {
        let request: Value = serde_json::from_str(&line.unwrap()).unwrap();
        let args = &request["arguments"];
        let profile = args["profileId"].as_str().unwrap_or_default();
        let result: Result<Value, StorageFailure> = (|| match request["command"].as_str().unwrap() {
            "storage_apply_batch" => {
                let b: StorageBatch = decode(&args["batch"])?;
                state.with_profile(b.profile_id.as_str(), |p| {
                    let mut projections = Vec::new();
                    let mut legacy = Vec::new();
                    for value in b.projections {
                        match value {
                            ProjectionInput::Known(v) => projections.push(v),
                            ProjectionInput::Legacy(v) => legacy.push(v),
                        }
                    }
                    p.apply_legacy_projection_batch(
                        AtomicBatch {
                            expected_revisions: b.expected_revisions,
                            aggregates: b.aggregates,
                            outbox: b.outbox,
                            projections,
                        },
                        legacy,
                    )
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
                serde_json::to_value(p.export_legacy_snapshot(&decode(&args["spaceId"])?)?)
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
