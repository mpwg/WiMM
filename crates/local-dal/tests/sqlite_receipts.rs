// SPDX-License-Identifier: AGPL-3.0-or-later
#![forbid(unsafe_code)]
#![cfg(feature = "sqlite")]
use wimm_local_contracts::{commit::*, persistence_errors::*};
use wimm_local_dal::sqlite_commit::SqliteCommitStore;
use wimm_persistence_contracts::CommitOutcome;
mod support;
use support::*;

#[test]
fn persisted_receipt_resolves_lost_answer_without_repeating_write_after_reopen() {
    let file = path("lost-answer");
    let original = request(30, 1);
    let mut db = SqliteCommitStore::open(&file, id(1)).unwrap();
    db.initialize_area(&id(2), &id(3)).unwrap();
    db.inject_after_commit_response_loss();
    assert!(matches!(
        db.commit(original.clone()),
        CommitOutcome::Unknown { .. }
    ));
    drop(db);
    let mut db = SqliteCommitStore::open(&file, id(1)).unwrap();
    let receipt = db.lookup_result(&original.identity).unwrap().unwrap();
    assert_eq!(receipt.committed_revisions[0].revision.value(), 1);
    assert!(matches!(
        db.commit(original.clone()),
        CommitOutcome::Committed { .. }
    ));
    assert_eq!(
        db.read_aggregate(&id(4))
            .unwrap()
            .unwrap()
            .aggregate
            .revision()
            .value(),
        1
    );
    assert_eq!(db.read_pending(&id(2)).unwrap().len(), 1);
    assert_eq!(
        serde_json::to_value(&db.read_pending(&id(2)).unwrap()[0].draft).unwrap(),
        serde_json::to_value(&original.batch.outbox[0].draft).unwrap()
    );
    assert_eq!(db.read_projections(&id(2)).unwrap().len(), 1);
    let mut changed = original;
    changed.batch.aggregates[0] = request(30, 2).batch.aggregates.remove(0);
    assert!(matches!(
        db.commit(changed),
        CommitOutcome::NotCommitted {
            error: StorageFailure {
                code: StorageFailureCode::OperationIdReused,
                ..
            }
        }
    ));
    drop(db);
    std::fs::remove_file(file).unwrap();
}
#[test]
fn actual_sqlite_transaction_rolls_back_aggregate_outbox_projection_and_receipt() {
    let file = path("rollback");
    let mut db = SqliteCommitStore::open(&file, id(1)).unwrap();
    db.initialize_area(&id(2), &id(3)).unwrap();
    let original = request(31, 1);
    db.inject_before_receipt_failure();
    assert!(matches!(
        db.commit(original.clone()),
        CommitOutcome::NotCommitted {
            error: StorageFailure {
                code: StorageFailureCode::WriteFailed,
                ..
            }
        }
    ));
    drop(db);
    let mut db = SqliteCommitStore::open(&file, id(1)).unwrap();
    assert!(db.lookup_result(&original.identity).unwrap().is_none());
    assert!(db.read_aggregate(&id(4)).unwrap().is_none());
    assert!(db.read_pending(&id(2)).unwrap().is_empty());
    assert!(db.read_projections(&id(2)).unwrap().is_empty());
    assert!(matches!(
        db.commit(original),
        CommitOutcome::Committed { .. }
    ));
    drop(db);
    std::fs::remove_file(file).unwrap();
}
#[test]
fn scope_versions_stale_cas_and_open_without_implicit_migration_are_guarded() {
    let file = path("scope");
    let mut db = SqliteCommitStore::open(&file, id(1)).unwrap();
    assert!(db.read_aggregate(&id(4)).is_err());
    db.initialize_area(&id(2), &id(3)).unwrap();
    assert_eq!(db.initialize_area(&id(2), &id(99)).unwrap(), id(3));
    assert!(matches!(
        db.commit(request(32, 1)),
        CommitOutcome::Committed { .. }
    ));
    assert!(matches!(
        db.commit(request(33, 1)),
        CommitOutcome::NotCommitted {
            error: StorageFailure {
                code: StorageFailureCode::RevisionConflict,
                ..
            }
        }
    ));
    for (profile, space, epoch) in [
        (id(91), id(2), id(3)),
        (id(1), id(92), id(3)),
        (id(1), id(2), id(93)),
    ] {
        let mut wrong = request(34, 2);
        wrong.identity.profile_id = profile;
        wrong.identity.space_id = space;
        wrong.identity.epoch = epoch;
        assert!(!matches!(db.commit(wrong), CommitOutcome::Committed { .. }));
    }
    let mut future = request(35, 2);
    future.identity.operation_contract_version = 2;
    assert!(matches!(
        db.commit(future),
        CommitOutcome::NotCommitted {
            error: StorageFailure {
                code: StorageFailureCode::UpdateRequired,
                ..
            }
        }
    ));
    drop(db);
    let mut wrong_profile = SqliteCommitStore::open(&file, id(91)).unwrap();
    assert!(wrong_profile.initialize_area(&id(2), &id(3)).is_err());
    drop(wrong_profile);
    std::fs::remove_file(file).unwrap();
}
#[cfg(feature = "receipt-probe")]
#[test]
fn actual_process_restart_recovers_receipt_and_idempotent_result() {
    use std::io::Write;
    use std::process::{Command, Stdio};
    let file = path("actual-process");
    let original = request(50, 1);
    let invoke = |requests: Vec<serde_json::Value>| {
        let mut child = Command::new(env!("CARGO_BIN_EXE_wimm-local-receipt-probe"))
            .arg(&file)
            .arg(id(1).as_str())
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .spawn()
            .unwrap();
        let mut input = child.stdin.take().unwrap();
        for request in requests {
            writeln!(input, "{request}").unwrap();
        }
        drop(input);
        let output = child.wait_with_output().unwrap();
        assert!(output.status.success());
        String::from_utf8(output.stdout)
            .unwrap()
            .lines()
            .map(|line| serde_json::from_str::<serde_json::Value>(line).unwrap())
            .collect::<Vec<_>>()
    };
    let first = invoke(vec![
        serde_json::json!({"method":"initialize","spaceId":id(2),"proposedEpoch":id(3)}),
        serde_json::json!({"method":"commit","request":original,"loseResponse":true}),
    ]);
    assert_eq!(first[1]["status"], "unknown");
    let second = invoke(vec![
        serde_json::json!({"method":"lookup","identity":original.identity}),
        serde_json::json!({"method":"commit","request":original}),
        serde_json::json!({"method":"inspect","handle":id(4),"spaceId":id(2)}),
    ]);
    assert_eq!(second[1]["status"], "committed");
    assert_eq!(second[1]["value"], second[0]);
    assert_eq!(second[2]["aggregate"]["revision"], 1);
    assert_eq!(second[2]["pending"].as_array().unwrap().len(), 1);
    assert_eq!(second[2]["projections"].as_array().unwrap().len(), 1);
    std::fs::remove_file(file).unwrap();
}
#[test]
fn known_receipt_survives_epoch_checkpoint_change_but_new_stale_writes_are_rejected() {
    use diesel::prelude::*;
    diesel::table! { wimm_local_areas (space) { space -> Text, epoch -> Text, } }
    let file = path("epoch");
    let mut db = SqliteCommitStore::open(&file, id(1)).unwrap();
    db.initialize_area(&id(2), &id(3)).unwrap();
    let original = request(60, 1);
    assert!(matches!(
        db.commit(original.clone()),
        CommitOutcome::Committed { .. }
    ));
    let receipt = db.lookup_result(&original.identity).unwrap().unwrap();
    drop(db);
    // Simuliert den autorisierten Checkpoint einer späteren Migration; kein behaupteter Restore.
    let mut conn = SqliteConnection::establish(file.to_str().unwrap()).unwrap();
    diesel::update(wimm_local_areas::table.find(id(2).as_str()))
        .set(wimm_local_areas::epoch.eq(id(61).as_str()))
        .execute(&mut conn)
        .unwrap();
    drop(conn);
    let mut db = SqliteCommitStore::open(&file, id(1)).unwrap();
    match db.commit(original) {
        CommitOutcome::Committed { value } => assert_eq!(
            serde_json::to_value(value).unwrap(),
            serde_json::to_value(receipt).unwrap()
        ),
        _ => panic!("Altes Receipt bleibt bestätigt"),
    }
    assert!(matches!(
        db.commit(request(62, 2)),
        CommitOutcome::NotCommitted {
            error: StorageFailure {
                code: StorageFailureCode::EpochMismatch,
                ..
            }
        }
    ));
    drop(db);
    std::fs::remove_file(file).unwrap();
}
#[test]
fn corrupt_known_receipt_never_claims_not_committed_or_performs_a_repeat_write() {
    use diesel::prelude::*;
    diesel::table! { wimm_local_receipts (identity) { identity -> Text, request -> Text, receipt -> Text, } }
    let file = path("corrupt-receipt");
    let mut db = SqliteCommitStore::open(&file, id(1)).unwrap();
    db.initialize_area(&id(2), &id(3)).unwrap();
    let original = request(70, 1);
    assert!(matches!(
        db.commit(original.clone()),
        CommitOutcome::Committed { .. }
    ));
    drop(db);
    let mut conn = SqliteConnection::establish(file.to_str().unwrap()).unwrap();
    diesel::update(wimm_local_receipts::table)
        .set(wimm_local_receipts::receipt.eq("{}"))
        .execute(&mut conn)
        .unwrap();
    drop(conn);
    let mut db = SqliteCommitStore::open(&file, id(1)).unwrap();
    assert_eq!(
        db.lookup_result(&original.identity)
            .unwrap_err()
            .commit_state,
        FailureCommitState::Unknown
    );
    assert!(matches!(db.commit(original), CommitOutcome::Unknown { .. }));
    assert_eq!(
        db.read_aggregate(&id(4))
            .unwrap()
            .unwrap()
            .aggregate
            .revision()
            .value(),
        1
    );
    assert_eq!(db.read_pending(&id(2)).unwrap().len(), 1);
    drop(db);
    std::fs::remove_file(file).unwrap();
}
