// SPDX-License-Identifier: AGPL-3.0-or-later
use rusqlite::{Connection, OptionalExtension, Transaction, TransactionBehavior, params};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::sync::Mutex;

pub struct StorageState(pub Mutex<Connection>);

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExpectedRevision {
    handle: String,
    expected_revision: i64,
}

#[derive(Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StoredAggregate {
    handle: String,
    space_id: String,
    revision: i64,
    #[serde(flatten)]
    payload: Value,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StorageBatch {
    profile_id: String,
    expected_revisions: Vec<ExpectedRevision>,
    aggregates: Vec<StoredAggregate>,
    outbox: Vec<Value>,
    projections: Vec<Value>,
}

#[derive(Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ConfirmedAggregate {
    space_id: String,
    epoch: String,
    aggregate: StoredAggregate,
}

#[derive(Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncState {
    profile_id: String,
    space_id: String,
    epoch: String,
    cursor: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncPage {
    state: SyncState,
    confirmed: Vec<ConfirmedAggregate>,
    remove_operation_ids: Vec<String>,
    projections: Vec<Value>,
}

#[derive(Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LocalSnapshot {
    storage_schema_version: u32,
    domain_schema_version: u32,
    profile_id: String,
    space_id: String,
    epoch: String,
    aggregates: Vec<StoredAggregate>,
    confirmed: Vec<ConfirmedAggregate>,
    pending: Vec<Value>,
    projections: Vec<Value>,
    sync_state: Option<SyncState>,
}

fn storage_error(error: impl std::fmt::Display) -> String {
    format!("Speicherfehler: {error}")
}

pub fn initialize_storage(connection: &Connection) -> rusqlite::Result<()> {
    connection.execute_batch(
        "PRAGMA foreign_keys = ON;
         CREATE TABLE IF NOT EXISTS storage_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
         CREATE TABLE IF NOT EXISTS aggregates (
           profile_id TEXT NOT NULL, handle TEXT NOT NULL, space_id TEXT NOT NULL,
           revision INTEGER NOT NULL CHECK(revision >= 1), payload TEXT NOT NULL,
           PRIMARY KEY(profile_id, handle)
         );
         CREATE INDEX IF NOT EXISTS aggregates_by_space ON aggregates(profile_id, space_id);
         CREATE TABLE IF NOT EXISTS confirmed (
           profile_id TEXT NOT NULL, handle TEXT NOT NULL, space_id TEXT NOT NULL,
           epoch TEXT NOT NULL, revision INTEGER NOT NULL CHECK(revision >= 1), payload TEXT NOT NULL,
           PRIMARY KEY(profile_id, handle)
         );
         CREATE INDEX IF NOT EXISTS confirmed_by_space ON confirmed(profile_id, space_id);
         CREATE TABLE IF NOT EXISTS outbox (
           profile_id TEXT NOT NULL, operation_id TEXT NOT NULL, space_id TEXT NOT NULL,
           state TEXT NOT NULL, payload TEXT NOT NULL,
           PRIMARY KEY(profile_id, operation_id)
         );
         CREATE INDEX IF NOT EXISTS outbox_by_space_state ON outbox(profile_id, space_id, state);
         CREATE TABLE IF NOT EXISTS projections (
           profile_id TEXT NOT NULL, space_id TEXT NOT NULL, projection_kind TEXT NOT NULL,
           projection_key TEXT NOT NULL, payload TEXT NOT NULL,
           PRIMARY KEY(profile_id, space_id, projection_kind, projection_key)
         );
         CREATE TABLE IF NOT EXISTS sync_state (
           profile_id TEXT NOT NULL, space_id TEXT NOT NULL, epoch TEXT NOT NULL, cursor TEXT NOT NULL,
           PRIMARY KEY(profile_id, space_id)
         );",
    )?;
    connection.execute(
        "INSERT OR IGNORE INTO storage_meta(key, value) VALUES ('storageSchemaVersion', '1')",
        [],
    )?;
    Ok(())
}

fn assert_expected_revisions(
    transaction: &Transaction<'_>,
    batch: &StorageBatch,
) -> Result<(), String> {
    for expected in &batch.expected_revisions {
        let current: Option<i64> = transaction
            .query_row(
                "SELECT revision FROM aggregates WHERE profile_id = ?1 AND handle = ?2",
                params![batch.profile_id, expected.handle],
                |row| row.get(0),
            )
            .optional()
            .map_err(storage_error)?;
        if current.unwrap_or(0) != expected.expected_revision {
            return Err("Die lokale Revision ist nicht mehr aktuell.".into());
        }
    }
    Ok(())
}

#[tauri::command]
pub fn storage_apply_batch(
    state: tauri::State<'_, StorageState>,
    batch: StorageBatch,
) -> Result<(), String> {
    let mut connection = state
        .0
        .lock()
        .map_err(|_| "Der Speicher ist gesperrt.".to_string())?;
    apply_batch(&mut connection, batch)
}

fn apply_batch(connection: &mut Connection, batch: StorageBatch) -> Result<(), String> {
    let transaction = connection.transaction().map_err(storage_error)?;
    write_batch(&transaction, &batch)?;
    transaction.commit().map_err(storage_error)
}

fn write_batch(transaction: &Transaction<'_>, batch: &StorageBatch) -> Result<(), String> {
    assert_expected_revisions(transaction, batch)?;
    for aggregate in &batch.aggregates {
        let payload = serde_json::to_string(aggregate).map_err(storage_error)?;
        transaction.execute(
            "INSERT INTO aggregates(profile_id, handle, space_id, revision, payload) VALUES (?1, ?2, ?3, ?4, ?5)
             ON CONFLICT(profile_id, handle) DO UPDATE SET space_id = excluded.space_id, revision = excluded.revision, payload = excluded.payload",
            params![batch.profile_id, aggregate.handle, aggregate.space_id, aggregate.revision, payload],
        ).map_err(storage_error)?;
    }
    for operation in &batch.outbox {
        let operation_id = operation
            .get("operationId")
            .and_then(Value::as_str)
            .ok_or("Die Operations-ID fehlt.")?;
        let space_id = operation
            .get("spaceId")
            .and_then(Value::as_str)
            .ok_or("Die Bereichs-ID fehlt.")?;
        let operation_state = operation
            .get("state")
            .and_then(Value::as_str)
            .ok_or("Der Operationsstatus fehlt.")?;
        transaction.execute(
            "INSERT INTO outbox(profile_id, operation_id, space_id, state, payload) VALUES (?1, ?2, ?3, ?4, ?5)
             ON CONFLICT(profile_id, operation_id) DO UPDATE SET state = excluded.state, payload = excluded.payload",
            params![batch.profile_id, operation_id, space_id, operation_state, serde_json::to_string(operation).map_err(storage_error)?],
        ).map_err(storage_error)?;
    }
    for projection in &batch.projections {
        let space_id = projection
            .get("spaceId")
            .and_then(Value::as_str)
            .ok_or("Die Projektionsbereichs-ID fehlt.")?;
        let kind = projection
            .get("kind")
            .and_then(Value::as_str)
            .ok_or("Die Projektionsart fehlt.")?;
        let key = projection
            .get("key")
            .and_then(Value::as_str)
            .ok_or("Der Projektionsschlüssel fehlt.")?;
        transaction.execute(
            "INSERT INTO projections(profile_id, space_id, projection_kind, projection_key, payload) VALUES (?1, ?2, ?3, ?4, ?5)
             ON CONFLICT(profile_id, space_id, projection_kind, projection_key) DO UPDATE SET payload = excluded.payload",
            params![batch.profile_id, space_id, kind, key, serde_json::to_string(projection).map_err(storage_error)?],
        ).map_err(storage_error)?;
    }
    Ok(())
}

#[tauri::command]
pub fn storage_read_aggregate(
    state: tauri::State<'_, StorageState>,
    profile_id: String,
    handle: String,
) -> Result<Option<Value>, String> {
    let connection = state
        .0
        .lock()
        .map_err(|_| "Der Speicher ist gesperrt.".to_string())?;
    connection
        .query_row(
            "SELECT json_set(payload, '$.handle', handle, '$.spaceId', space_id, '$.revision', revision) FROM aggregates WHERE profile_id = ?1 AND handle = ?2",
            params![profile_id, handle],
            |row| row.get::<_, String>(0),
        )
        .optional()
        .map_err(storage_error)?
        .map(|payload| serde_json::from_str(&payload).map_err(storage_error))
        .transpose()
}

#[tauri::command]
pub fn storage_query_aggregates(
    state: tauri::State<'_, StorageState>,
    profile_id: String,
    space_id: String,
) -> Result<Vec<Value>, String> {
    let connection = state
        .0
        .lock()
        .map_err(|_| "Der Speicher ist gesperrt.".to_string())?;
    let mut statement = connection
        .prepare("SELECT json_set(payload, '$.handle', handle, '$.spaceId', space_id, '$.revision', revision) FROM aggregates WHERE profile_id = ?1 AND space_id = ?2")
        .map_err(storage_error)?;
    let rows = statement
        .query_map(params![profile_id, space_id], |row| row.get::<_, String>(0))
        .map_err(storage_error)?;
    rows.map(|row| {
        row.map_err(storage_error)
            .and_then(|payload| serde_json::from_str(&payload).map_err(storage_error))
    })
    .collect()
}

fn read_rows(
    connection: &Connection,
    sql: &str,
    profile_id: &str,
    space_id: &str,
) -> Result<Vec<Value>, String> {
    let mut statement = connection.prepare(sql).map_err(storage_error)?;
    let rows = statement
        .query_map(params![profile_id, space_id], |row| row.get::<_, String>(0))
        .map_err(storage_error)?;
    rows.map(|row| {
        row.map_err(storage_error)
            .and_then(|payload| serde_json::from_str(&payload).map_err(storage_error))
    })
    .collect()
}

fn get_sync_state(
    connection: &Connection,
    profile_id: &str,
    space_id: &str,
) -> Result<Option<SyncState>, String> {
    connection
        .query_row(
            "SELECT epoch, cursor FROM sync_state WHERE profile_id = ?1 AND space_id = ?2",
            params![profile_id, space_id],
            |row| {
                Ok(SyncState {
                    profile_id: profile_id.into(),
                    space_id: space_id.into(),
                    epoch: row.get(0)?,
                    cursor: row.get(1)?,
                })
            },
        )
        .optional()
        .map_err(storage_error)
}

fn local_epoch_key(profile_id: &str, space_id: &str) -> String {
    format!("localEpoch:{}", serde_json::json!([profile_id, space_id]))
}

fn get_local_epoch(
    connection: &Connection,
    profile_id: &str,
    space_id: &str,
) -> Result<Option<String>, String> {
    connection
        .query_row(
            "SELECT value FROM storage_meta WHERE key = ?1",
            [local_epoch_key(profile_id, space_id)],
            |row| row.get(0),
        )
        .optional()
        .map_err(storage_error)
}

fn write_local_epoch(
    transaction: &Transaction<'_>,
    profile_id: &str,
    space_id: &str,
    epoch: &str,
) -> Result<(), String> {
    transaction.execute("INSERT INTO storage_meta(key, value) VALUES (?1, ?2) ON CONFLICT(key) DO UPDATE SET value = excluded.value", params![local_epoch_key(profile_id, space_id), epoch]).map_err(storage_error)?;
    Ok(())
}

fn initialize_area(
    connection: &mut Connection,
    profile_id: &str,
    space_id: &str,
    proposed_epoch: &str,
) -> Result<String, String> {
    let transaction = connection
        .transaction_with_behavior(TransactionBehavior::Immediate)
        .map_err(storage_error)?;
    let local = get_local_epoch(&transaction, profile_id, space_id)?;
    let state = get_sync_state(&transaction, profile_id, space_id)?;
    let confirmed: Option<String> = transaction.query_row("SELECT epoch FROM confirmed WHERE profile_id = ?1 AND space_id = ?2 ORDER BY handle LIMIT 1", params![profile_id, space_id], |row| row.get(0)).optional().map_err(storage_error)?;
    let epoch = local
        .or_else(|| state.map(|state| state.epoch))
        .or(confirmed)
        .unwrap_or_else(|| proposed_epoch.into());
    write_local_epoch(&transaction, profile_id, space_id, &epoch)?;
    transaction.commit().map_err(storage_error)?;
    Ok(epoch)
}

fn write_sync_state(transaction: &Transaction<'_>, state: &SyncState) -> Result<(), String> {
    transaction.execute("INSERT INTO sync_state(profile_id, space_id, epoch, cursor) VALUES (?1, ?2, ?3, ?4) ON CONFLICT(profile_id, space_id) DO UPDATE SET epoch = excluded.epoch, cursor = excluded.cursor", params![state.profile_id, state.space_id, state.epoch, state.cursor]).map_err(storage_error)?;
    Ok(())
}

fn write_confirmed(
    transaction: &Transaction<'_>,
    profile_id: &str,
    space_id: &str,
    confirmed: &[ConfirmedAggregate],
) -> Result<(), String> {
    for entry in confirmed {
        if entry.space_id != space_id || entry.aggregate.space_id != space_id {
            return Err("Bestätigte Daten gehören zu einem anderen Bereich.".into());
        }
        transaction.execute("INSERT INTO confirmed(profile_id, handle, space_id, epoch, revision, payload) VALUES (?1, ?2, ?3, ?4, ?5, ?6) ON CONFLICT(profile_id, handle) DO UPDATE SET space_id = excluded.space_id, epoch = excluded.epoch, revision = excluded.revision, payload = excluded.payload", params![profile_id, entry.aggregate.handle, entry.space_id, entry.epoch, entry.aggregate.revision, serde_json::to_string(entry).map_err(storage_error)?]).map_err(storage_error)?;
    }
    Ok(())
}

fn assert_area_rows(rows: &[Value], space_id: &str) -> Result<(), String> {
    if rows
        .iter()
        .any(|row| row.get("spaceId").and_then(Value::as_str) != Some(space_id))
    {
        return Err("Die gespeicherten Daten gehören zu einem anderen Bereich.".into());
    }
    Ok(())
}

fn save_sync_page(
    connection: &mut Connection,
    profile_id: &str,
    page: SyncPage,
) -> Result<(), String> {
    if page.state.profile_id != profile_id {
        return Err("Die Syncseite gehört zu einem anderen Profil.".into());
    }
    assert_area_rows(&page.projections, &page.state.space_id)?;
    if page
        .confirmed
        .iter()
        .any(|entry| entry.epoch != page.state.epoch)
    {
        return Err("Die Bestätigungsepoche passt nicht zur Syncseite.".into());
    }
    let transaction = connection.transaction().map_err(storage_error)?;
    write_confirmed(
        &transaction,
        profile_id,
        &page.state.space_id,
        &page.confirmed,
    )?;
    for operation_id in page.remove_operation_ids {
        transaction
            .execute(
                "DELETE FROM outbox WHERE profile_id = ?1 AND space_id = ?2 AND operation_id = ?3",
                params![profile_id, page.state.space_id, operation_id],
            )
            .map_err(storage_error)?;
    }
    write_batch(
        &transaction,
        &StorageBatch {
            profile_id: profile_id.into(),
            expected_revisions: vec![],
            aggregates: vec![],
            outbox: vec![],
            projections: page.projections,
        },
    )?;
    write_sync_state(&transaction, &page.state)?;
    write_local_epoch(
        &transaction,
        profile_id,
        &page.state.space_id,
        &page.state.epoch,
    )?;
    transaction.commit().map_err(storage_error)
}

fn export_snapshot(
    connection: &mut Connection,
    profile_id: &str,
    space_id: &str,
) -> Result<LocalSnapshot, String> {
    let transaction = connection.transaction().map_err(storage_error)?;
    let sync_state = get_sync_state(&transaction, profile_id, space_id)?;
    let confirmed: Vec<ConfirmedAggregate> = read_rows(
        &transaction,
        "SELECT payload FROM confirmed WHERE profile_id = ?1 AND space_id = ?2 ORDER BY handle",
        profile_id,
        space_id,
    )?
    .into_iter()
    .map(serde_json::from_value)
    .collect::<Result<_, _>>()
    .map_err(storage_error)?;
    let local_epoch = get_local_epoch(&transaction, profile_id, space_id)?;
    let epoch = sync_state
        .as_ref()
        .map(|state| state.epoch.clone())
        .or(local_epoch)
        .or_else(|| confirmed.first().map(|entry| entry.epoch.clone()))
        .ok_or("Für den Bereich fehlt eine Epoche.")?;
    let aggregates = read_rows(&transaction, "SELECT json_set(payload, '$.handle', handle, '$.spaceId', space_id, '$.revision', revision) FROM aggregates WHERE profile_id = ?1 AND space_id = ?2 ORDER BY handle", profile_id, space_id)?.into_iter().map(serde_json::from_value).collect::<Result<_, _>>().map_err(storage_error)?;
    let snapshot = LocalSnapshot {
        storage_schema_version: 1,
        domain_schema_version: 1,
        profile_id: profile_id.into(),
        space_id: space_id.into(),
        epoch,
        aggregates,
        confirmed,
        pending: read_rows(
            &transaction,
            "SELECT payload FROM outbox WHERE profile_id = ?1 AND space_id = ?2 ORDER BY operation_id",
            profile_id,
            space_id,
        )?,
        projections: read_rows(
            &transaction,
            "SELECT payload FROM projections WHERE profile_id = ?1 AND space_id = ?2 ORDER BY projection_kind, projection_key",
            profile_id,
            space_id,
        )?,
        sync_state,
    };
    transaction.commit().map_err(storage_error)?;
    Ok(snapshot)
}

fn replace_snapshot(
    connection: &mut Connection,
    profile_id: &str,
    snapshot: LocalSnapshot,
) -> Result<(), String> {
    if snapshot.profile_id != profile_id {
        return Err("Der Snapshot gehört zu einem anderen Profil.".into());
    }
    if snapshot.storage_schema_version != 1 || snapshot.domain_schema_version != 1 {
        return Err("Die Snapshotversion wird nicht unterstützt.".into());
    }
    if snapshot
        .aggregates
        .iter()
        .any(|aggregate| aggregate.space_id != snapshot.space_id)
        || snapshot.sync_state.as_ref().is_some_and(|state| {
            state.profile_id != profile_id
                || state.space_id != snapshot.space_id
                || state.epoch != snapshot.epoch
        })
    {
        return Err("Der Snapshot enthält fremde Bereichsdaten.".into());
    }
    assert_area_rows(&snapshot.pending, &snapshot.space_id)?;
    assert_area_rows(&snapshot.projections, &snapshot.space_id)?;
    if snapshot
        .confirmed
        .iter()
        .any(|entry| entry.epoch != snapshot.epoch)
    {
        return Err("Die Bestätigungsepoche passt nicht zum Snapshot.".into());
    }
    let transaction = connection.transaction().map_err(storage_error)?;
    for (table, key, handles) in [
        (
            "aggregates",
            "handle",
            snapshot
                .aggregates
                .iter()
                .map(|entry| entry.handle.as_str())
                .collect::<Vec<_>>(),
        ),
        (
            "confirmed",
            "handle",
            snapshot
                .confirmed
                .iter()
                .map(|entry| entry.aggregate.handle.as_str())
                .collect(),
        ),
        (
            "outbox",
            "operation_id",
            snapshot
                .pending
                .iter()
                .filter_map(|entry| entry.get("operationId").and_then(Value::as_str))
                .collect(),
        ),
    ] {
        for handle in handles {
            let current: Option<String> = transaction
                .query_row(
                    &format!("SELECT space_id FROM {table} WHERE profile_id = ?1 AND {key} = ?2"),
                    params![profile_id, handle],
                    |row| row.get(0),
                )
                .optional()
                .map_err(storage_error)?;
            if current.is_some_and(|space_id| space_id != snapshot.space_id) {
                return Err("Ein Snapshothandle gehört zu einem anderen Bereich.".into());
            }
        }
    }
    for table in [
        "aggregates",
        "confirmed",
        "outbox",
        "projections",
        "sync_state",
    ] {
        transaction
            .execute(
                &format!("DELETE FROM {table} WHERE profile_id = ?1 AND space_id = ?2"),
                params![profile_id, snapshot.space_id],
            )
            .map_err(storage_error)?;
    }
    write_confirmed(
        &transaction,
        profile_id,
        &snapshot.space_id,
        &snapshot.confirmed,
    )?;
    write_batch(
        &transaction,
        &StorageBatch {
            profile_id: profile_id.into(),
            expected_revisions: vec![],
            aggregates: snapshot.aggregates,
            outbox: snapshot.pending,
            projections: snapshot.projections,
        },
    )?;
    write_local_epoch(
        &transaction,
        profile_id,
        &snapshot.space_id,
        &snapshot.epoch,
    )?;
    if let Some(state) = snapshot.sync_state {
        write_sync_state(&transaction, &state)?;
    }
    transaction.commit().map_err(storage_error)
}

#[tauri::command]
pub fn storage_initialize_area(
    state: tauri::State<'_, StorageState>,
    profile_id: String,
    space_id: String,
    proposed_epoch: String,
) -> Result<String, String> {
    let mut connection = state.0.lock().map_err(|_| "Der Speicher ist gesperrt.")?;
    initialize_area(&mut connection, &profile_id, &space_id, &proposed_epoch)
}

#[tauri::command]
pub fn storage_load_confirmed(
    state: tauri::State<'_, StorageState>,
    profile_id: String,
    space_id: String,
) -> Result<Vec<Value>, String> {
    let connection = state.0.lock().map_err(|_| "Der Speicher ist gesperrt.")?;
    read_rows(
        &connection,
        "SELECT payload FROM confirmed WHERE profile_id = ?1 AND space_id = ?2 ORDER BY handle",
        &profile_id,
        &space_id,
    )
}

#[tauri::command]
pub fn storage_load_pending(
    state: tauri::State<'_, StorageState>,
    profile_id: String,
    space_id: String,
) -> Result<Vec<Value>, String> {
    let connection = state.0.lock().map_err(|_| "Der Speicher ist gesperrt.")?;
    read_rows(
        &connection,
        "SELECT payload FROM outbox WHERE profile_id = ?1 AND space_id = ?2 ORDER BY operation_id",
        &profile_id,
        &space_id,
    )
}

#[tauri::command]
pub fn storage_get_sync_state(
    state: tauri::State<'_, StorageState>,
    profile_id: String,
    space_id: String,
) -> Result<Option<SyncState>, String> {
    let connection = state.0.lock().map_err(|_| "Der Speicher ist gesperrt.")?;
    get_sync_state(&connection, &profile_id, &space_id)
}

#[tauri::command]
pub fn storage_save_sync_page(
    state: tauri::State<'_, StorageState>,
    profile_id: String,
    page: SyncPage,
) -> Result<(), String> {
    let mut connection = state.0.lock().map_err(|_| "Der Speicher ist gesperrt.")?;
    save_sync_page(&mut connection, &profile_id, page)
}

#[tauri::command]
pub fn storage_export_snapshot(
    state: tauri::State<'_, StorageState>,
    profile_id: String,
    space_id: String,
) -> Result<LocalSnapshot, String> {
    let mut connection = state.0.lock().map_err(|_| "Der Speicher ist gesperrt.")?;
    export_snapshot(&mut connection, &profile_id, &space_id)
}

#[tauri::command]
pub fn storage_replace_snapshot(
    state: tauri::State<'_, StorageState>,
    profile_id: String,
    snapshot: LocalSnapshot,
) -> Result<(), String> {
    let mut connection = state.0.lock().map_err(|_| "Der Speicher ist gesperrt.")?;
    replace_snapshot(&mut connection, &profile_id, snapshot)
}

#[tauri::command]
pub fn storage_rebuild_projections(
    state: tauri::State<'_, StorageState>,
    profile_id: String,
    space_id: String,
) -> Result<(), String> {
    let connection = state.0.lock().map_err(|_| "Der Speicher ist gesperrt.")?;
    connection
        .execute(
            "DELETE FROM projections WHERE profile_id = ?1 AND space_id = ?2",
            params![profile_id, space_id],
        )
        .map_err(storage_error)?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Nur im Testbinary: echter SQLite-Port für denselben TypeScript-Contract-Katalog.
    /// Kein Produktkommando, keine zusätzliche Tauri-Capability, kein SQL aus dem Client.
    #[test]
    #[ignore = "wird ausschließlich vom gemeinsamen TypeScript-Speichervertrag gestartet"]
    fn contract_driver() {
        use std::io::{BufRead, Write};
        let path = std::env::var("WIMM_CONTRACT_DATABASE").unwrap();
        let mut connection = Connection::open(path).unwrap();
        initialize_storage(&connection).unwrap();
        for line in std::io::stdin().lock().lines() {
            let request: Value = serde_json::from_str(&line.unwrap()).unwrap();
            let args = &request["arguments"];
            let profile = args["profileId"].as_str().unwrap_or_default();
            let space = args["spaceId"].as_str().unwrap_or_default();
            let result: Result<Value, String> = (|| {
                match request["command"].as_str().unwrap() {
                    "storage_initialize_area" => initialize_area(&mut connection, profile, space, args["proposedEpoch"].as_str().unwrap()).map(Value::String),
                    "storage_apply_batch" => apply_batch(&mut connection, serde_json::from_value(args["batch"].clone()).map_err(storage_error)?).map(|()| Value::Null),
                    "storage_save_sync_page" => save_sync_page(&mut connection, profile, serde_json::from_value(args["page"].clone()).map_err(storage_error)?).map(|()| Value::Null),
                    "storage_export_snapshot" => serde_json::to_value(export_snapshot(&mut connection, profile, space)?).map_err(storage_error),
                    "storage_replace_snapshot" => replace_snapshot(&mut connection, profile, serde_json::from_value(args["snapshot"].clone()).map_err(storage_error)?).map(|()| Value::Null),
                    "storage_get_sync_state" => serde_json::to_value(get_sync_state(&connection, profile, space)?).map_err(storage_error),
                    "storage_load_confirmed" => read_rows(&connection, "SELECT payload FROM confirmed WHERE profile_id = ?1 AND space_id = ?2 ORDER BY handle", profile, space).map(Value::Array),
                    "storage_load_pending" => read_rows(&connection, "SELECT payload FROM outbox WHERE profile_id = ?1 AND space_id = ?2 ORDER BY operation_id", profile, space).map(Value::Array),
                    _ => Err("Unbekanntes Testkommando.".into()),
                }
            })();
            let response = match result {
                Ok(value) => serde_json::json!({"id":request["id"],"value":value}),
                Err(error) => serde_json::json!({"id":request["id"],"error":error}),
            };
            println!("WIMM_CONTRACT:{response}");
            std::io::stdout().flush().unwrap();
        }
    }

    fn seed(connection: &mut Connection, profile_id: &str) {
        initialize_storage(connection).unwrap();
        let batch = serde_json::from_value(serde_json::json!({
            "profileId": profile_id, "expectedRevisions": [{"handle":"h","expectedRevision":0}],
            "aggregates": [{"handle":"h","id":"h","spaceId":"s","revision":1,"aggregateType":"account","name":"Synthetisches Konto"}],
            "outbox": [{"operationId":"o","spaceId":"s","state":"queued","draft":{"original":true}}],
            "projections": [{"spaceId":"s","kind":"accountBalance","key":"h","payload":{"balance":100}}]
        })).unwrap();
        apply_batch(connection, batch).unwrap();
        let page = serde_json::from_value(serde_json::json!({"state":{"profileId":profile_id,"spaceId":"s","epoch":"e","cursor":"0"},"confirmed":[],"removeOperationIds":[],"projections":[]})).unwrap();
        save_sync_page(connection, profile_id, page).unwrap();
    }

    fn snapshot_value(connection: &mut Connection, profile_id: &str) -> Value {
        serde_json::to_value(export_snapshot(connection, profile_id, "s").unwrap()).unwrap()
    }

    #[test]
    fn sqlite_lokale_epoche_benoetigt_keinen_cursor_und_bleibt_nach_neustart_erhalten() {
        let directory = tempfile::tempdir_in(".").unwrap();
        let path = directory.path().join("lokale-epoche.sqlite3");
        {
            let mut connection = Connection::open(&path).unwrap();
            initialize_storage(&connection).unwrap();
            assert_eq!(
                initialize_area(&mut connection, "p", "s", "local").unwrap(),
                "local"
            );
            let snapshot = snapshot_value(&mut connection, "p");
            assert_eq!(snapshot["epoch"], "local");
            assert_eq!(snapshot["syncState"], Value::Null);
            assert_eq!(snapshot["pending"], serde_json::json!([]));
            assert_eq!(snapshot["aggregates"], serde_json::json!([]));
        }
        let mut connection = Connection::open(&path).unwrap();
        initialize_storage(&connection).unwrap();
        assert_eq!(
            initialize_area(&mut connection, "p", "s", "other").unwrap(),
            "local"
        );
        assert_eq!(snapshot_value(&mut connection, "p")["epoch"], "local");
    }

    #[test]
    fn sqlite_parallele_commits_exportieren_nur_vollstaendige_lesestaende() {
        use std::sync::{Arc, Barrier};
        let directory = tempfile::tempdir_in(".").unwrap();
        let path = directory.path().join("snapshot-parallel.sqlite3");
        let mut connection = Connection::open(&path).unwrap();
        connection
            .execute_batch("PRAGMA journal_mode = WAL;")
            .unwrap();
        connection
            .busy_timeout(std::time::Duration::from_secs(5))
            .unwrap();
        seed(&mut connection, "p");
        let mut original = snapshot_value(&mut connection, "p");
        original["aggregates"][0]["marker"] = Value::from(0);
        original["confirmed"] = serde_json::json!([{"spaceId":"s","epoch":"e","aggregate":original["aggregates"][0].clone()}]);
        original["pending"][0]["draft"]["marker"] = Value::from(0);
        original["projections"][0]["payload"]["marker"] = Value::from(0);
        replace_snapshot(
            &mut connection,
            "p",
            serde_json::from_value(original.clone()).unwrap(),
        )
        .unwrap();
        let barrier = Arc::new(Barrier::new(2));
        let writer_barrier = Arc::clone(&barrier);
        let writer = std::thread::spawn(move || {
            let mut writer = Connection::open(path).unwrap();
            writer
                .busy_timeout(std::time::Duration::from_secs(5))
                .unwrap();
            for cursor in 1..=30 {
                let mut next = original.clone();
                next["syncState"]["cursor"] = Value::from(cursor.to_string());
                next["aggregates"][0]["marker"] = Value::from(cursor);
                next["confirmed"][0]["aggregate"]["marker"] = Value::from(cursor);
                next["pending"][0]["draft"]["marker"] = Value::from(cursor);
                next["projections"][0]["payload"]["marker"] = Value::from(cursor);
                writer_barrier.wait();
                replace_snapshot(&mut writer, "p", serde_json::from_value(next).unwrap()).unwrap();
                writer_barrier.wait();
            }
        });
        for expected in 1..=30 {
            barrier.wait();
            let snapshot = snapshot_value(&mut connection, "p");
            barrier.wait();
            let cursor: i64 = snapshot["syncState"]["cursor"]
                .as_str()
                .unwrap()
                .parse()
                .unwrap();
            assert!([expected - 1, expected].contains(&cursor));
            for actual in [
                &snapshot["aggregates"][0]["marker"],
                &snapshot["confirmed"][0]["aggregate"]["marker"],
                &snapshot["pending"][0]["draft"]["marker"],
                &snapshot["projections"][0]["payload"]["marker"],
            ] {
                assert_eq!(actual, &Value::from(cursor));
            }
        }
        writer.join().unwrap();
    }

    #[test]
    fn sqlite_syncseite_ist_atomar_und_bestaetigung_vom_lokalstand_getrennt() {
        let mut connection = Connection::open_in_memory().unwrap();
        seed(&mut connection, "p");
        let before = snapshot_value(&mut connection, "p");
        let mut page = serde_json::json!({
            "state":{"profileId":"p","spaceId":"s","epoch":"e","cursor":"1"},
            "confirmed":[{"spaceId":"s","epoch":"e","aggregate":{"handle":"h","id":"h","spaceId":"s","revision":2,"aggregateType":"account"}}],
            "removeOperationIds":["o"], "projections":[{"spaceId":"s","kind":"accountBalance"}]
        });
        assert!(
            save_sync_page(
                &mut connection,
                "p",
                serde_json::from_value(page.clone()).unwrap()
            )
            .is_err()
        );
        assert_eq!(snapshot_value(&mut connection, "p"), before);
        page["projections"][0]["key"] = Value::from("h");
        page["projections"][0]["payload"] = serde_json::json!({"balance":200});
        save_sync_page(&mut connection, "p", serde_json::from_value(page).unwrap()).unwrap();
        let after = snapshot_value(&mut connection, "p");
        assert_eq!(after["aggregates"][0]["revision"], 1);
        assert_eq!(after["confirmed"][0]["aggregate"]["revision"], 2);
        assert_eq!(after["pending"], serde_json::json!([]));
        assert_eq!(after["syncState"]["cursor"], "1");
    }

    #[test]
    fn sqlite_snapshotersatz_rollt_loeschung_zurueck_und_bewahrt_andere_profile() {
        let mut connection = Connection::open_in_memory().unwrap();
        seed(&mut connection, "p");
        seed(&mut connection, "other");
        let before = snapshot_value(&mut connection, "p");
        let other = snapshot_value(&mut connection, "other");
        let mut invalid = before.clone();
        invalid["projections"] = serde_json::json!([{"spaceId":"s","kind":"accountBalance"}]);
        assert!(
            replace_snapshot(
                &mut connection,
                "p",
                serde_json::from_value(invalid).unwrap()
            )
            .is_err()
        );
        assert_eq!(snapshot_value(&mut connection, "p"), before);
        assert!(
            replace_snapshot(
                &mut connection,
                "other",
                serde_json::from_value(before.clone()).unwrap()
            )
            .is_err()
        );
        replace_snapshot(
            &mut connection,
            "p",
            serde_json::from_value(before.clone()).unwrap(),
        )
        .unwrap();
        assert_eq!(snapshot_value(&mut connection, "p"), before);
        assert_eq!(snapshot_value(&mut connection, "other"), other);
    }

    #[test]
    fn sqlite_snapshotersatz_uebernimmt_keine_fremden_bereichshandles() {
        let mut connection = Connection::open_in_memory().unwrap();
        seed(&mut connection, "p");
        initialize_area(&mut connection, "p", "other", "e2").unwrap();
        let before = snapshot_value(&mut connection, "p");
        let other =
            serde_json::to_value(export_snapshot(&mut connection, "p", "other").unwrap()).unwrap();
        let mut incoming = before.clone();
        incoming["spaceId"] = Value::from("other");
        incoming["syncState"]["spaceId"] = Value::from("other");
        for field in ["aggregates", "pending", "projections"] {
            for entry in incoming[field].as_array_mut().unwrap() {
                entry["spaceId"] = Value::from("other");
            }
        }
        assert!(
            replace_snapshot(
                &mut connection,
                "p",
                serde_json::from_value(incoming).unwrap()
            )
            .is_err()
        );
        assert_eq!(snapshot_value(&mut connection, "p"), before);
        assert_eq!(
            serde_json::to_value(export_snapshot(&mut connection, "p", "other").unwrap()).unwrap(),
            other
        );
    }

    #[test]
    fn sqlite_dateineustart_und_stale_batch_erhalten_den_vollstaendigen_stand() {
        let directory = tempfile::tempdir_in(".").unwrap();
        let path = directory.path().join("synthetisch.sqlite3");
        let before = {
            let mut connection = Connection::open(&path).unwrap();
            seed(&mut connection, "p");
            snapshot_value(&mut connection, "p")
        };
        let mut connection = Connection::open(&path).unwrap();
        initialize_storage(&connection).unwrap();
        assert_eq!(snapshot_value(&mut connection, "p"), before);
        let batch = serde_json::from_value(serde_json::json!({"profileId":"p","expectedRevisions":[{"handle":"h","expectedRevision":0}],"aggregates":[],"outbox":[],"projections":[]})).unwrap();
        assert!(apply_batch(&mut connection, batch).is_err());
        assert_eq!(snapshot_value(&mut connection, "p"), before);
    }

    #[test]
    fn sqlite_read_preserves_heads_including_legacy_payloads() {
        let connection = Connection::open_in_memory().unwrap();
        initialize_storage(&connection).unwrap();
        let aggregate: StoredAggregate = serde_json::from_value(serde_json::json!({"handle":"h", "spaceId":"s", "revision":3, "id":"h", "aggregateType":"account"})).unwrap();
        let complete = serde_json::to_value(&aggregate).unwrap();
        assert_eq!(complete["revision"], 3);
        assert_eq!(complete["spaceId"], "s");
        // Historische gespeicherte Payloads besaßen die Kopfwerte nur in SQL-Spalten.
        connection.execute("INSERT INTO aggregates(profile_id, handle, space_id, revision, payload) VALUES ('p','h','s',3,?1)", [r#"{"id":"h","aggregateType":"account"}"#]).unwrap();
        let raw: String = connection.query_row("SELECT json_set(payload, '$.handle', handle, '$.spaceId', space_id, '$.revision', revision) FROM aggregates WHERE profile_id = ?1 AND handle = ?2", params!["p", "h"], |row| row.get(0)).unwrap();
        let loaded: Value = serde_json::from_str(&raw).unwrap();
        assert_eq!(loaded, complete);
    }
    #[test]
    fn sqlite_aktiviert_fremdschluessel_und_rollt_abbruch_zurueck() {
        let mut connection = Connection::open_in_memory().expect("In-Memory-SQLite verfügbar");
        initialize_storage(&connection).expect("Schema wird angelegt");
        let foreign_keys: i64 = connection
            .query_row("PRAGMA foreign_keys", [], |row| row.get(0))
            .expect("Pragma lesbar");
        assert_eq!(foreign_keys, 1);
        let transaction = connection.transaction().expect("Transaktion beginnt");
        transaction.execute(
            "INSERT INTO aggregates(profile_id, handle, space_id, revision, payload) VALUES ('p', 'h', 's', 1, '{}')",
            [],
        ).expect("Testdatensatz einfügbar");
        transaction.rollback().expect("Rollback gelingt");
        let count: i64 = connection
            .query_row("SELECT count(*) FROM aggregates", [], |row| row.get(0))
            .expect("Anzahl lesbar");
        assert_eq!(count, 0);
    }
}
