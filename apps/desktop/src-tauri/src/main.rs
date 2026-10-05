// SPDX-License-Identifier: AGPL-3.0-or-later
use std::fs;
use std::sync::Mutex;

use rusqlite::{Connection, OptionalExtension, Transaction, params};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use tauri::{Emitter, Manager};
mod platform;
use platform::*;
use tauri::menu::{Menu, MenuItem, PredefinedMenuItem, Submenu};

struct StorageState(Mutex<Connection>);

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct ExpectedRevision {
    handle: String,
    expected_revision: i64,
}

#[derive(Deserialize, Serialize)]
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
fn storage_apply_batch(
    state: tauri::State<'_, StorageState>,
    batch: StorageBatch,
) -> Result<(), String> {
    let mut connection = state
        .0
        .lock()
        .map_err(|_| "Der Speicher ist gesperrt.".to_string())?;
    let transaction = connection.transaction().map_err(storage_error)?;
    assert_expected_revisions(&transaction, &batch)?;
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
    transaction.commit().map_err(storage_error)
}

#[tauri::command]
fn storage_read_aggregate(
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
fn storage_query_aggregates(
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

fn main() {
    tauri::Builder::default()
        .menu(|handle| {
            let new_transaction = MenuItem::with_id(
                handle,
                "new-transaction",
                "Neue Buchung",
                true,
                Some("CmdOrCtrl+N"),
            )?;
            let settings =
                MenuItem::with_id(handle, "settings", "Einstellungen", false, None::<&str>)?;
            new_transaction.set_enabled(false)?;
            let file = Submenu::with_items(
                handle,
                "Datei",
                true,
                &[
                    &new_transaction,
                    &PredefinedMenuItem::close_window(handle, Some("Fenster schließen"))?,
                ],
            )?;
            let undo = MenuItem::with_id(handle, "undo", "Rückgängig", true, Some("CmdOrCtrl+Z"))?;
            let redo = MenuItem::with_id(
                handle,
                "redo",
                "Wiederholen",
                true,
                Some("CmdOrCtrl+Shift+Z"),
            )?;
            let search = MenuItem::with_id(handle, "search", "Suchen", false, Some("CmdOrCtrl+F"))?;
            let edit = Submenu::with_items(
                handle,
                "Bearbeiten",
                true,
                &[
                    &undo,
                    &redo,
                    &PredefinedMenuItem::separator(handle)?,
                    &PredefinedMenuItem::cut(handle, Some("Ausschneiden"))?,
                    &PredefinedMenuItem::copy(handle, Some("Kopieren"))?,
                    &PredefinedMenuItem::paste(handle, Some("Einfügen"))?,
                    &PredefinedMenuItem::select_all(handle, Some("Alles auswählen"))?,
                    &search,
                ],
            )?;
            let overview = MenuItem::with_id(handle, "overview", "Übersicht", false, None::<&str>)?;
            let view = Submenu::with_items(
                handle,
                "Ansicht",
                true,
                &[
                    &overview,
                    &PredefinedMenuItem::fullscreen(handle, Some("Vollbild"))?,
                    &PredefinedMenuItem::minimize(handle, Some("Minimieren"))?,
                ],
            )?;
            let help_link =
                MenuItem::with_id(handle, "help", "Hilfe und Quellcode", true, None::<&str>)?;
            let license = MenuItem::with_id(
                handle,
                "license",
                "Lizenz AGPL-3.0-or-later",
                true,
                None::<&str>,
            )?;
            let about = PredefinedMenuItem::about(
                handle,
                Some("Über WhereIsMyMoney"),
                Some(tauri::menu::AboutMetadata {
                    name: Some("WhereIsMyMoney".into()),
                    version: Some(env!("CARGO_PKG_VERSION").into()),
                    copyright: Some("AGPL-3.0-or-later".into()),
                    ..Default::default()
                }),
            )?;
            let help = Submenu::with_items(handle, "Hilfe", true, &[&about, &help_link, &license])?;
            let app_menu = Submenu::with_items(
                handle,
                "WhereIsMyMoney",
                true,
                &[
                    &settings,
                    &PredefinedMenuItem::separator(handle)?,
                    &PredefinedMenuItem::hide(handle, Some("WhereIsMyMoney ausblenden"))?,
                    &PredefinedMenuItem::hide_others(handle, Some("Andere ausblenden"))?,
                    &PredefinedMenuItem::show_all(handle, Some("Alle einblenden"))?,
                    &PredefinedMenuItem::quit(handle, Some("WhereIsMyMoney beenden"))?,
                ],
            )?;
            #[cfg(target_os = "macos")]
            return Menu::with_items(handle, &[&app_menu, &file, &edit, &view, &help]);
            #[cfg(not(target_os = "macos"))]
            Menu::with_items(handle, &[&file, &edit, &view, &app_menu, &help])
        })
        .plugin(tauri_plugin_dialog::init())
        .plugin(
            tauri_plugin_opener::Builder::new()
                .open_js_links_on_click(false)
                .build(),
        )
        .on_menu_event(|app, event| {
            let id = event.id().as_ref();
            if matches!(id, "help" | "license") {
                let url = if id == "help" {
                    "https://github.com/mpwg/WiMM"
                } else {
                    "https://www.gnu.org/licenses/agpl-3.0.html"
                };
                if let Err(error) = platform_open_url(app.clone(), url.into()) {
                    let _ = app.emit_to("main", "platform-error", error);
                }
            } else {
                let _ = app.emit_to("main", "platform-menu", id);
            }
        })
        .setup(|app| {
            tauri::WebviewWindowBuilder::new(
                app,
                "main",
                tauri::WebviewUrl::App("index.html".into()),
            )
            .title("WhereIsMyMoney")
            .inner_size(960.0, 720.0)
            .min_inner_size(900.0, 600.0)
            .on_navigation(bundled_navigation)
            .on_new_window(|_, _| tauri::webview::NewWindowResponse::Deny)
            .build()?;
            let directory = app.path().app_local_data_dir()?;
            fs::create_dir_all(&directory)?;
            let connection = Connection::open(directory.join("wimm.sqlite3"))?;
            initialize_storage(&connection)?;
            app.manage(StorageState(Mutex::new(connection)));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            platform_choose_files,
            platform_write_file,
            platform_open_url,
            platform_set_menu,
            storage_apply_batch,
            storage_read_aggregate,
            storage_query_aggregates
        ])
        .run(tauri::generate_context!())
        .expect("Die Desktop-Anwendung konnte nicht gestartet werden.");
}

#[cfg(test)]
mod tests {
    use super::*;

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
