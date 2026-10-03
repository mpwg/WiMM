// SPDX-License-Identifier: AGPL-3.0-or-later
fn main() {
    tauri::Builder::default()
        .run(tauri::generate_context!())
        .expect("Die Desktop-Anwendung konnte nicht gestartet werden.");
}
