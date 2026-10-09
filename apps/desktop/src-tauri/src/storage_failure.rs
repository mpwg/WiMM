// SPDX-License-Identifier: AGPL-3.0-or-later
//! Adapterfehler werden nach Typ/SQLite-Code klassifiziert, niemals nach Text.
use std::any::Any;
pub use wimm_local_contracts::persistence_errors::{
    FailureCommitState, StorageFailure, StorageFailureCode,
};
pub fn failure(code: StorageFailureCode) -> StorageFailure {
    StorageFailure::not_committed(code)
}
pub fn storage_error<E: std::fmt::Display + 'static>(error: E) -> StorageFailure {
    let value = &error as &dyn Any;
    if matches!(
        value.downcast_ref::<rusqlite::Error>(),
        Some(rusqlite::Error::InvalidParameterName(_))
    ) {
        return failure(StorageFailureCode::UpdateRequired);
    }
    if let Some(rusqlite::Error::SqliteFailure(code, _)) = value.downcast_ref::<rusqlite::Error>() {
        return failure(match code.code {
            rusqlite::ErrorCode::DiskFull => StorageFailureCode::Quota,
            rusqlite::ErrorCode::DatabaseBusy
            | rusqlite::ErrorCode::DatabaseLocked
            | rusqlite::ErrorCode::OutOfMemory
            | rusqlite::ErrorCode::CannotOpen => StorageFailureCode::ResourceUnavailable,
            rusqlite::ErrorCode::OperationInterrupted => StorageFailureCode::Cancelled,
            _ => StorageFailureCode::WriteFailed,
        });
    }
    failure(StorageFailureCode::WriteFailed)
}
/// Ein fehlgeschlagener Commit ohne bestätigtes Resultat erlaubt keine Wiederholung.
pub fn commit_error(error: rusqlite::Error) -> StorageFailure {
    let mut result = storage_error(error);
    result.commit_state = FailureCommitState::Unknown;
    result
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn sqlite_full_is_real_and_never_exposes_payloads() {
        let db = rusqlite::Connection::open_in_memory().unwrap();
        db.execute_batch(
            "PRAGMA page_size=512; PRAGMA max_page_count=2; CREATE TABLE data(value BLOB);",
        )
        .unwrap();
        let error = db
            .execute("INSERT INTO data VALUES(zeroblob(10000))", [])
            .unwrap_err();
        let result = storage_error(error);
        assert_eq!(result.code, StorageFailureCode::Quota);
        assert_eq!(result.commit_state, FailureCommitState::NotCommitted);
        assert_eq!(
            db.query_row("SELECT count(*) FROM data", [], |row| row.get::<_, i64>(0))
                .unwrap(),
            0
        );
        assert!(!serde_json::to_string(&result).unwrap().contains("data"));
    }
    #[test]
    fn sqlite_diagnostics_are_not_transported_and_commit_failure_is_uncertain() {
        let error = rusqlite::Error::SqliteFailure(
            rusqlite::ffi::Error::new(5),
            Some("secret private financial payload /home/user/vault".into()),
        );
        let result = commit_error(error);
        assert_eq!(result.code, StorageFailureCode::ResourceUnavailable);
        assert_eq!(result.commit_state, FailureCommitState::Unknown);
        assert!(
            !format!("{result:?} {}", serde_json::to_string(&result).unwrap()).contains("secret")
        );
    }
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
