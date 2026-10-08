// SPDX-License-Identifier: AGPL-3.0-or-later
#![forbid(unsafe_code)]
fn main() {
    tauri_build::try_build(tauri_build::Attributes::new().app_manifest(
        tauri_build::AppManifest::new().commands(&[
            "storage_apply_batch",
            "storage_initialize_area",
            "storage_read_aggregate",
            "storage_query_aggregates",
            "storage_load_confirmed",
            "storage_load_pending",
            "storage_get_sync_state",
            "storage_save_sync_page",
            "storage_export_snapshot",
            "storage_replace_snapshot",
            "storage_rebuild_projections",
            "platform_choose_files",
            "platform_write_file",
            "platform_open_url",
            "platform_set_menu",
        ]),
    ))
    .expect("Die Tauri-Rechte konnten nicht erzeugt werden.");
}
