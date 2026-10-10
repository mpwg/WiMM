// SPDX-License-Identifier: AGPL-3.0-or-later
//! IPC-Fehler enthalten ausschließlich die gemeinsame strukturierte Fehlerhülle.
pub use wimm_local_contracts::persistence_errors::{StorageFailure, StorageFailureCode};
pub fn failure(code: StorageFailureCode) -> StorageFailure {
    StorageFailure::not_committed(code)
}
#[cfg(test)]
mod ipc_tests {
    use super::*;
    #[test]
    fn actual_tauri_ipc_response_preserves_codes_and_commit_state() {
        let failure = StorageFailure::unknown(StorageFailureCode::CommitUnknown);
        let response: tauri::ipc::InvokeResponse =
            Result::<(), StorageFailure>::Err(failure).into();
        match response {
            tauri::ipc::InvokeResponse::Err(error) => assert_eq!(
                error.0,
                serde_json::json!({"contractVersion":2,"code":"COMMIT_UNKNOWN","commitState":"unknown"})
            ),
            _ => panic!("Fehler wurde in eine Erfolgsmeldung umgedeutet."),
        }
    }
}
