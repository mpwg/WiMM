// SPDX-License-Identifier: AGPL-3.0-or-later
#![forbid(unsafe_code)]
use std::fs;
use std::sync::Mutex;

use rusqlite::Connection;
mod backups;
#[cfg(test)]
mod core_contract;
mod storage;
use storage::{StorageState, initialize_storage};
use tauri::{Emitter, Manager};
mod platform;
use platform::*;
use tauri::menu::{Menu, MenuItem, PredefinedMenuItem, Submenu};

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
            let import_file = MenuItem::with_id(
                handle,
                "import",
                "Datei importieren …",
                false,
                Some("CmdOrCtrl+I"),
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
                    &import_file,
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
            let backup_connection = Connection::open(directory.join("wimm-backups.sqlite3"))?;
            backups::initialize_backups(&backup_connection)?;
            app.manage(backups::BackupState(Mutex::new(backup_connection)));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            platform_choose_files,
            platform_write_file,
            platform_open_url,
            platform_set_menu,
            storage::storage_apply_batch,
            storage::storage_initialize_area,
            storage::storage_read_aggregate,
            storage::storage_query_aggregates,
            storage::storage_load_confirmed,
            storage::storage_load_pending,
            storage::storage_get_sync_state,
            storage::storage_save_sync_page,
            storage::storage_export_snapshot,
            storage::storage_replace_snapshot,
            storage::storage_rebuild_projections,
            backups::storage_persist_encrypted_backup,
            backups::storage_read_encrypted_backup
        ])
        .run(tauri::generate_context!())
        .expect("Die Desktop-Anwendung konnte nicht gestartet werden.");
}
