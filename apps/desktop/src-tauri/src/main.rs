// SPDX-License-Identifier: AGPL-3.0-or-later
use std::fs;
use std::sync::Mutex;

use rusqlite::{params, Connection, OptionalExtension, Transaction};
use serde::Deserialize;
use serde_json::Value;
use tauri::menu::{Menu, MenuItem, PredefinedMenuItem, Submenu};
use tauri::Manager;

struct StorageState(Mutex<Connection>);

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct ExpectedRevision {
    handle: String,
    expected_revision: i64,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct StoredAggregate {
    handle: String,
    space_id: String,
    revision: i64,
    #[serde(flatten)]
    payload: Value,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct StorageBatch {
    profile_id: String,
    expected_revisions: Vec<ExpectedRevision>,
    aggregates: Vec<StoredAggregate>,
    outbox: Vec<Value>,
    projections: Vec<Value>,
}

fn storage_error(error: impl std::fmt::Display) -> String {
    format!("Speicherfehler: {error}")
}

fn initialize_storage(connection: &Connection) -> rusqlite::Result<()> {
    connection.execute_batch(
        "PRAGMA foreign_keys = ON;
         CREATE TABLE IF NOT EXISTS storage_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
         CREATE TABLE IF NOT EXISTS aggregates (
           profile_id TEXT NOT NULL, handle TEXT NOT NULL, space_id TEXT NOT NULL,
           revision INTEGER NOT NULL CHECK(revision >= 1), payload TEXT NOT NULL,
           PRIMARY KEY(profile_id, handle)
         );
         CREATE INDEX IF NOT EXISTS aggregates_by_space ON aggregates(profile_id, space_id);
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

fn assert_expected_revisions(transaction: &Transaction<'_>, batch: &StorageBatch) -> Result<(), String> {
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
fn storage_apply_batch(state: tauri::State<'_, StorageState>, batch: StorageBatch) -> Result<(), String> {
    let mut connection = state.0.lock().map_err(|_| "Der Speicher ist gesperrt.".to_string())?;
    let transaction = connection.transaction().map_err(storage_error)?;
    assert_expected_revisions(&transaction, &batch)?;
    for aggregate in &batch.aggregates {
        let payload = serde_json::to_string(&aggregate.payload).map_err(storage_error)?;
        transaction.execute(
            "INSERT INTO aggregates(profile_id, handle, space_id, revision, payload) VALUES (?1, ?2, ?3, ?4, ?5)
             ON CONFLICT(profile_id, handle) DO UPDATE SET space_id = excluded.space_id, revision = excluded.revision, payload = excluded.payload",
            params![batch.profile_id, aggregate.handle, aggregate.space_id, aggregate.revision, payload],
        ).map_err(storage_error)?;
    }
    for operation in &batch.outbox {
        let operation_id = operation.get("operationId").and_then(Value::as_str).ok_or("Die Operations-ID fehlt.")?;
        let space_id = operation.get("spaceId").and_then(Value::as_str).ok_or("Die Bereichs-ID fehlt.")?;
        let operation_state = operation.get("state").and_then(Value::as_str).ok_or("Der Operationsstatus fehlt.")?;
        transaction.execute(
            "INSERT INTO outbox(profile_id, operation_id, space_id, state, payload) VALUES (?1, ?2, ?3, ?4, ?5)
             ON CONFLICT(profile_id, operation_id) DO UPDATE SET state = excluded.state, payload = excluded.payload",
            params![batch.profile_id, operation_id, space_id, operation_state, serde_json::to_string(operation).map_err(storage_error)?],
        ).map_err(storage_error)?;
    }
    for projection in &batch.projections {
        let space_id = projection.get("spaceId").and_then(Value::as_str).ok_or("Die Projektionsbereichs-ID fehlt.")?;
        let kind = projection.get("kind").and_then(Value::as_str).ok_or("Die Projektionsart fehlt.")?;
        let key = projection.get("key").and_then(Value::as_str).ok_or("Der Projektionsschlüssel fehlt.")?;
        transaction.execute(
            "INSERT INTO projections(profile_id, space_id, projection_kind, projection_key, payload) VALUES (?1, ?2, ?3, ?4, ?5)
             ON CONFLICT(profile_id, space_id, projection_kind, projection_key) DO UPDATE SET payload = excluded.payload",
            params![batch.profile_id, space_id, kind, key, serde_json::to_string(projection).map_err(storage_error)?],
        ).map_err(storage_error)?;
    }
    transaction.commit().map_err(storage_error)
}

#[tauri::command]
fn storage_read_aggregate(state: tauri::State<'_, StorageState>, profile_id: String, handle: String) -> Result<Option<Value>, String> {
    let connection = state.0.lock().map_err(|_| "Der Speicher ist gesperrt.".to_string())?;
    connection
        .query_row(
            "SELECT payload FROM aggregates WHERE profile_id = ?1 AND handle = ?2",
            params![profile_id, handle],
            |row| row.get::<_, String>(0),
        )
        .optional()
        .map_err(storage_error)?
        .map(|payload| serde_json::from_str(&payload).map_err(storage_error))
        .transpose()
}

fn main() {
    tauri::Builder::default()
        .menu(|handle| {
            let new_transaction = MenuItem::with_id(handle, "new-transaction", "Neue Buchung", true, Some("CmdOrCtrl+N"))?;
            let settings = MenuItem::with_id(handle, "settings", "Einstellungen", true, None::<&str>)?;
            let file = Submenu::with_items(handle, "Datei", true, &[&new_transaction, &settings, &PredefinedMenuItem::close_window(handle, None)?])?;
            let edit = Submenu::with_items(handle, "Bearbeiten", true, &[&PredefinedMenuItem::undo(handle, None)?, &PredefinedMenuItem::redo(handle, None)?, &PredefinedMenuItem::separator(handle)?, &PredefinedMenuItem::cut(handle, None)?, &PredefinedMenuItem::copy(handle, None)?, &PredefinedMenuItem::paste(handle, None)?, &PredefinedMenuItem::select_all(handle, None)?])?;
            Menu::with_items(handle, &[&file, &edit])
        })
        .setup(|app| {
            let directory = app.path().app_local_data_dir()?;
            fs::create_dir_all(&directory)?;
            let connection = Connection::open(directory.join("wimm.sqlite3"))?;
            initialize_storage(&connection)?;
            app.manage(StorageState(Mutex::new(connection)));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![storage_apply_batch, storage_read_aggregate])
        .run(tauri::generate_context!())
        .expect("Die Desktop-Anwendung konnte nicht gestartet werden.");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn sqlite_aktiviert_fremdschluessel_und_rollt_abbruch_zurueck() {
        let mut connection = Connection::open_in_memory().expect("In-Memory-SQLite verfügbar");
        initialize_storage(&connection).expect("Schema wird angelegt");
        let foreign_keys: i64 = connection.query_row("PRAGMA foreign_keys", [], |row| row.get(0)).expect("Pragma lesbar");
        assert_eq!(foreign_keys, 1);
        let transaction = connection.transaction().expect("Transaktion beginnt");
        transaction.execute(
            "INSERT INTO aggregates(profile_id, handle, space_id, revision, payload) VALUES ('p', 'h', 's', 1, '{}')",
            [],
        ).expect("Testdatensatz einfügbar");
        transaction.rollback().expect("Rollback gelingt");
        let count: i64 = connection.query_row("SELECT count(*) FROM aggregates", [], |row| row.get(0)).expect("Anzahl lesbar");
        assert_eq!(count, 0);
    }
}
