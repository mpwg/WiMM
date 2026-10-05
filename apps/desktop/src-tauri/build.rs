// SPDX-License-Identifier: AGPL-3.0-or-later
fn main() {
    tauri_build::try_build(tauri_build::Attributes::new().app_manifest(
        tauri_build::AppManifest::new().commands(&[
            "storage_apply_batch",
            "storage_read_aggregate",
            "storage_query_aggregates",
            "platform_choose_files",
            "platform_write_file",
            "platform_open_url",
            "platform_set_menu",
        ]),
    ))
    .expect("Die Tauri-Rechte konnten nicht erzeugt werden.");
}
