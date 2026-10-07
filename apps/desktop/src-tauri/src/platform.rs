// SPDX-License-Identifier: AGPL-3.0-or-later
use serde::{Deserialize, Serialize};
use std::{fs, io::Read};
use tauri_plugin_dialog::DialogExt;
use tauri_plugin_opener::OpenerExt;

const MAX_IMPORT_BYTES: u64 = 25 * 1024 * 1024;
const MAX_IMPORT_FILES: usize = 10;
const MAX_IMPORT_TOTAL_BYTES: u64 = 50 * 1024 * 1024;
fn default_import_bytes() -> u64 {
    MAX_IMPORT_BYTES
}
fn default_import_files() -> usize {
    MAX_IMPORT_FILES
}
fn default_import_total() -> u64 {
    MAX_IMPORT_TOTAL_BYTES
}

const MAX_FILE_BYTES: u64 = 32 * 1024 * 1024;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ImportRequest {
    accepted_extensions: Vec<String>,
    accepted_media_types: Vec<String>,
    multiple: bool,
    #[serde(default = "default_import_bytes")]
    max_bytes: u64,
    #[serde(default = "default_import_files")]
    max_files: usize,
    #[serde(default = "default_import_total")]
    max_total_bytes: u64,
}
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportedFile {
    name: String,
    media_type: Option<String>,
    bytes: Vec<u8>,
}
#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ExportRequest {
    suggested_name: String,
    media_type: String,
    bytes: Vec<u8>,
}
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub struct MenuCommand {
    id: String,
    title: String,
    enabled: bool,
}

fn read_selected_file(path: &std::path::Path, max_bytes: u64) -> Result<ImportedFile, String> {
    let file =
        fs::File::open(path).map_err(|_| "Die ausgewählte Datei konnte nicht gelesen werden.")?;
    let metadata = file
        .metadata()
        .map_err(|_| "Die Datei konnte nicht geprüft werden.")?;
    if !metadata.is_file() {
        return Err("Bitte wählen Sie eine gewöhnliche Datei.".into());
    }
    if metadata.len() > max_bytes {
        return Err("Die Datei überschreitet die Importgrenze von höchstens 25 MiB.".into());
    }
    let mut bytes = Vec::new();
    file.take(max_bytes + 1)
        .read_to_end(&mut bytes)
        .map_err(|_| "Die Datei konnte nicht gelesen werden.")?;
    if bytes.len() as u64 > max_bytes {
        return Err("Die Datei überschreitet die Importgrenze von höchstens 25 MiB.".into());
    }
    Ok(ImportedFile {
        name: path
            .file_name()
            .ok_or("Der Dateiname fehlt.")?
            .to_string_lossy()
            .into(),
        media_type: None,
        bytes,
    })
}

#[tauri::command]
pub async fn platform_choose_files(
    app: tauri::AppHandle,
    request: ImportRequest,
) -> Result<Vec<ImportedFile>, String> {
    if request.max_bytes == 0
        || request.max_bytes > MAX_IMPORT_BYTES
        || request.max_files == 0
        || request.max_files > MAX_IMPORT_FILES
        || request.max_total_bytes == 0
        || request.max_total_bytes > MAX_IMPORT_TOTAL_BYTES
    {
        return Err("Die Importlimits sind ungültig.".into());
    }
    if request.accepted_extensions.iter().any(|extension| {
        extension.is_empty() || !extension.chars().all(|ch| ch.is_ascii_alphanumeric())
    }) {
        return Err("Die Dateitypen sind ungültig.".into());
    }
    if request.accepted_media_types.len() > 32 || request.accepted_extensions.len() > 32 {
        return Err("Zu viele Dateitypen.".into());
    }
    tauri::async_runtime::spawn_blocking(move || {
        let mut dialog = app.dialog().file().set_title("Datei auswählen");
        if !request.accepted_extensions.is_empty() {
            dialog = dialog.add_filter(
                "Ausgewählte Dateitypen",
                &request
                    .accepted_extensions
                    .iter()
                    .map(String::as_str)
                    .collect::<Vec<_>>(),
            );
        }
        let selected = if request.multiple {
            dialog.blocking_pick_files()
        } else {
            dialog.blocking_pick_file().map(|path| vec![path])
        };
        let paths = selected
            .unwrap_or_default()
            .into_iter()
            .map(|path| {
                path.into_path()
                    .map_err(|_| "Ungültige Dateiauswahl.".to_string())
            })
            .collect::<Result<Vec<_>, _>>()?;
        read_selected_files(&paths, &request)
    })
    .await
    .map_err(|_| "Die Dateiauswahl konnte nicht abgeschlossen werden.".to_string())?
}

fn read_selected_files(
    paths: &[std::path::PathBuf],
    request: &ImportRequest,
) -> Result<Vec<ImportedFile>, String> {
    let limit = if request.multiple {
        request.max_files
    } else {
        1
    };
    if paths.len() > limit {
        return Err("Die Dateiauswahl überschreitet die Anzahlgrenze.".into());
    }
    let mut total = 0u64;
    // Alle Metadaten prüfen, bevor die erste Datei gelesen wird.
    for path in paths {
        let metadata = fs::metadata(path).map_err(|_| "Die Datei konnte nicht geprüft werden.")?;
        if !metadata.is_file() || metadata.len() > request.max_bytes {
            return Err(
                "Die Datei überschreitet die Importgrenze oder ist keine gewöhnliche Datei.".into(),
            );
        }
        total = total
            .checked_add(metadata.len())
            .ok_or("Die Dateiauswahl überschreitet die Gesamtgrenze.")?;
        if total > request.max_total_bytes {
            return Err("Die Dateiauswahl überschreitet die Gesamtgrenze.".into());
        }
    }
    let mut files = Vec::new();
    total = 0;
    for path in paths {
        let file = read_selected_file(path, request.max_bytes)?;
        total = total
            .checked_add(file.bytes.len() as u64)
            .ok_or("Die Dateiauswahl überschreitet die Gesamtgrenze.")?;
        if total > request.max_total_bytes {
            return Err("Die Dateiauswahl überschreitet die Gesamtgrenze.".into());
        }
        files.push(file);
    }
    Ok(files)
}

#[tauri::command]
pub async fn platform_write_file(
    app: tauri::AppHandle,
    request: ExportRequest,
) -> Result<(), String> {
    if request.bytes.len() as u64 > MAX_FILE_BYTES {
        return Err("Der Inhalt überschreitet die Grenze von 32 MiB.".into());
    }
    if request.suggested_name.is_empty()
        || request.suggested_name.contains(['/', '\\'])
        || request.suggested_name == "."
        || request.suggested_name == ".."
        || request.media_type.len() > 256
    {
        return Err("Der vorgeschlagene Dateiname ist ungültig.".into());
    }
    tauri::async_runtime::spawn_blocking(move || {
        let path = app
            .dialog()
            .file()
            .set_title("Datei speichern")
            .set_file_name(&request.suggested_name)
            .blocking_save_file();
        if let Some(path) = path {
            let path = path.into_path().map_err(|_| "Ungültiger Speicherort.")?;
            write_selected_file(&path, &request.bytes)?;
        }
        Ok(())
    })
    .await
    .map_err(|_| "Der Speicherdialog konnte nicht abgeschlossen werden.".to_string())?
}

fn write_selected_file(path: &std::path::Path, bytes: &[u8]) -> Result<(), String> {
    use std::io::Write;
    let parent = path.parent().ok_or("Der Speicherort ist ungültig.")?;
    let mut temporary = tempfile::NamedTempFile::new_in(parent).map_err(|_| "Die Datei konnte nicht gespeichert werden. Bitte prüfen Sie Schreibrechte und freien Speicher.")?;
    temporary.write_all(bytes).and_then(|()| temporary.as_file().sync_all()).map_err(|_| "Die Datei konnte nicht vollständig gespeichert werden. Bitte prüfen Sie Schreibrechte und freien Speicher.")?;
    temporary.persist(path).map_err(|_| "Die Datei konnte nicht ersetzt werden. Bitte prüfen Sie Schreibrechte und freien Speicher.")?;
    Ok(())
}

pub fn validate_external_url(value: &str) -> Result<(), String> {
    let url = url::Url::parse(value).map_err(|_| "Dieser Link ist ungültig.")?;
    if !matches!(url.scheme(), "http" | "https")
        || url.host_str().is_none()
        || !url.username().is_empty()
        || url.password().is_some()
    {
        return Err("Dieser Link ist nicht erlaubt.".into());
    }
    Ok(())
}
#[tauri::command]
pub fn platform_open_url(app: tauri::AppHandle, url: String) -> Result<(), String> {
    validate_external_url(&url)?;
    app.opener()
        .open_url(url, None::<&str>)
        .map_err(|_| "Der Systembrowser konnte nicht geöffnet werden.".into())
}
#[tauri::command]
pub fn platform_set_menu(app: tauri::AppHandle, commands: Vec<MenuCommand>) -> Result<(), String> {
    if let Some(menu) = app.menu() {
        for command in commands {
            if !matches!(
                command.id.as_str(),
                "new-transaction" | "search" | "overview" | "settings" | "import"
            ) {
                return Err("Unbekannter Menübefehl.".into());
            }
            if command.title.len() > 256 {
                return Err("Ungültiger Menütext.".into());
            }
            let item = menu
                .items()
                .map_err(|_| "Die Menügruppen konnten nicht gelesen werden.")?
                .into_iter()
                .find_map(|group| {
                    group
                        .as_submenu()
                        .and_then(|submenu| submenu.get(&command.id))
                });
            if let Some(item) = item.and_then(|item| item.as_menuitem().cloned()) {
                item.set_enabled(command.enabled)
                    .map_err(|_| "Das Menü konnte nicht aktualisiert werden.")?;
            }
        }
    }
    Ok(())
}

pub fn bundled_navigation(url: &url::Url) -> bool {
    (url.scheme() == "tauri" && url.host_str() == Some("localhost"))
        || (matches!(url.scheme(), "http" | "https")
            && url.host_str() == Some("tauri.localhost")
            && url.port().is_none()
            && url.username().is_empty())
        || (cfg!(debug_assertions) && url.origin().ascii_serialization() == "http://127.0.0.1:1420")
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn rejects_external_navigation_and_unsafe_links() {
        for value in [
            "file:///etc/passwd",
            "javascript:alert(1)",
            "data:text/html,test",
            "https://user:secret@example.org",
        ] {
            assert!(validate_external_url(value).is_err());
        }
        assert!(validate_external_url("https://github.com/mpwg/WiMM").is_ok());
        for value in [
            "https://github.com/mpwg/WiMM",
            "tauri://evil",
            "http://tauri.localhost.evil",
            "http://tauri.localhost:8443",
            "file:///tmp/test.html",
        ] {
            assert!(!bundled_navigation(&url::Url::parse(value).unwrap()));
        }
        assert!(bundled_navigation(
            &url::Url::parse("tauri://localhost/index.html").unwrap()
        ));
    }
    #[test]
    fn failed_save_preserves_existing_contents() {
        let directory = tempfile::tempdir().unwrap();
        let path = directory.path().join("synthetic.txt");
        fs::write(&path, b"Vorher").unwrap();
        write_selected_file(&path, b"Nachher").unwrap();
        assert_eq!(fs::read(&path).unwrap(), b"Nachher");
        let invalid = directory.path().join("missing/file.txt");
        assert!(write_selected_file(&invalid, b"Fehlversuch").is_err());
        assert_eq!(fs::read(&path).unwrap(), b"Nachher");
        assert!(write_selected_file(directory.path(), b"Fehlversuch").is_err());
    }
    #[test]
    fn import_selection_budgets_and_exact_boundary() {
        let directory = tempfile::tempdir().unwrap();
        let first = directory.path().join("first.csv");
        let second = directory.path().join("second.csv");
        fs::File::create(&first)
            .unwrap()
            .set_len(MAX_IMPORT_BYTES)
            .unwrap();
        fs::write(&second, b"x").unwrap();
        let request = ImportRequest {
            accepted_extensions: vec![],
            accepted_media_types: vec![],
            multiple: true,
            max_bytes: MAX_IMPORT_BYTES,
            max_files: 2,
            max_total_bytes: MAX_IMPORT_BYTES,
        };
        assert_eq!(
            read_selected_files(std::slice::from_ref(&first), &request).unwrap()[0]
                .bytes
                .len() as u64,
            MAX_IMPORT_BYTES
        );
        assert!(read_selected_files(&[first.clone(), second.clone()], &request).is_err());
        assert!(
            read_selected_files(&[second.clone(), second.clone(), second.clone()], &request)
                .is_err()
        );
        fs::File::create(&first)
            .unwrap()
            .set_len(MAX_IMPORT_BYTES + 1)
            .unwrap();
        assert!(read_selected_files(&[second, first], &request).is_err());
    }
    #[test]
    fn selected_file_read_is_bounded_and_has_no_path_in_response() {
        let directory = std::env::temp_dir().join(format!("wimm-port-test-{}", std::process::id()));
        fs::create_dir_all(&directory).unwrap();
        let path = directory.join("synthetic.txt");
        fs::write(&path, b"Synthetische Portpruefung").unwrap();
        assert_eq!(
            read_selected_file(&path, MAX_IMPORT_BYTES).unwrap().bytes,
            b"Synthetische Portpruefung"
        );
        fs::File::create(&path)
            .unwrap()
            .set_len(MAX_IMPORT_BYTES + 1)
            .unwrap();
        assert!(read_selected_file(&path, MAX_IMPORT_BYTES).is_err());
        fs::remove_dir_all(directory).unwrap();
    }
}
