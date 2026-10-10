// SPDX-License-Identifier: AGPL-3.0-or-later
#![forbid(unsafe_code)]
macro_rules! data_eq {
    ($a:expr, $b:expr $(,)?) => {
        assert_eq!(
            serde_json::to_value(&$a).unwrap(),
            serde_json::to_value(&$b).unwrap()
        )
    };
}
fn eq(a: &impl serde::Serialize, b: &impl serde::Serialize) {
    data_eq!(a, b);
}
use std::{cell::RefCell, rc::Rc};
use wimm_client_application::{dispatch::*, *};
use wimm_finance_types::{command_contracts::Request, scalars::*};
use wimm_local_contracts::{commit::*, persistence_errors::*, storage_port::CancellationPort};
#[path = "support/current_sqlite.rs"]
mod current_sqlite;
use current_sqlite::{CommitBoundary, CurrentSqlite};
#[derive(Clone)]
struct Scope(Rc<RefCell<CommitContext>>);
impl CommitContextPort for Scope {
    fn current(&self) -> CommitContext {
        self.0.borrow().clone()
    }
}
struct Cancel(bool);
impl CancellationPort for Cancel {
    fn is_cancelled(&self) -> bool {
        self.0
    }
}
fn fixture() -> (PreparedCommit, Scope, CurrentSqlite, std::path::PathBuf) {
    let cases: Vec<serde_json::Value> = serde_json::from_str(include_str!(
        "../../finance-core/tests/fixtures/contract-catalog.json"
    ))
    .unwrap();
    let r: Request = wimm_finance_core::decode_command_request_v1(
        &cases
            .iter()
            .find(|c| c["name"] == "Kontoeinstieg F01 Kontoeinstieg")
            .unwrap()["request"]
            .to_string(),
    )
    .unwrap();
    let ctx = CommitContext {
        profile_id: EntityId::new("50000000-0000-4000-8000-000000000001".into()).unwrap(),
        space_id: r.space_id.clone(),
        epoch: EntityId::new("50000000-0000-4000-8000-000000000003".into()).unwrap(),
        profile_revision: Revision::new(1).unwrap(),
        session_generation: Revision::new(1).unwrap(),
        generation: Revision::new(1).unwrap(),
    };
    let prepared = prepare_command(r, &ctx, &ctx, AreaMode::Connected)
        .unwrap()
        .unwrap();
    let root =
        std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("../../test-results/ar05/native");
    std::fs::create_dir_all(&root).unwrap();
    let path = root.join(format!(
        "dispatch-{}-{}.sqlite3",
        std::process::id(),
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_nanos()
    ));
    let mut db = CurrentSqlite::create(&path, ctx.profile_id.clone()).unwrap();
    db.initialize_area(&ctx.space_id, &ctx.epoch).unwrap();
    (prepared, Scope(Rc::new(RefCell::new(ctx))), db, path)
}
fn receipt(result: DispatchResult, expected_current: bool) -> LocalCommitReceipt {
    match result {
        DispatchResult::Committed {
            receipt,
            context,
            current,
        } => {
            data_eq!(current, expected_current);
            data_eq!(receipt.identity.profile_id, context.profile_id);
            data_eq!(receipt.identity.epoch, context.epoch);
            *receipt
        }
        _ => panic!("Erwartetes tatsächliches Receipt fehlt"),
    }
}
fn empty(db: &CurrentSqlite, p: &PreparedCommit) {
    for a in &p.request().batch.aggregates {
        assert!(db.read_aggregate(&a.handle).unwrap().is_none());
    }
    assert!(db.read_pending(&p.context().space_id).unwrap().is_empty());
    assert!(
        db.read_projections(&p.context().space_id)
            .unwrap()
            .is_empty()
    );
    assert!(db.lookup_result(&p.request().identity).unwrap().is_none());
}
#[test]
fn real_sqlite_commit_restart_and_exact_replay_preserve_original() {
    let (p, scope, mut db, path) = fixture();
    let mut pipeline = CommitPipeline::default();
    let first = receipt(
        pipeline.dispatch(p.clone(), &mut db, &scope, &Cancel(false)),
        true,
    );
    drop(db);
    let mut reopened = CurrentSqlite::open(&path, p.context().profile_id.clone()).unwrap();
    data_eq!(
        receipt(
            pipeline.dispatch(p.clone(), &mut reopened, &scope, &Cancel(false)),
            true
        ),
        first
    );
    data_eq!(
        reopened.read_pending(&p.context().space_id).unwrap(),
        p.request().batch.outbox
    );
    data_eq!(
        reopened.read_projections(&p.context().space_id).unwrap(),
        p.request().batch.projections
    );
    for a in &p.request().batch.aggregates {
        data_eq!(reopened.read_aggregate(&a.handle).unwrap().unwrap(), *a);
    }
}
#[test]
fn lost_response_blocks_new_writes_and_resolves_original_after_profile_switch() {
    let (p, scope, mut db, path) = fixture();
    db.lose_next_response();
    let mut pipeline = CommitPipeline::default();
    assert!(matches!(
        pipeline.dispatch(p.clone(), &mut db, &scope, &Cancel(false)),
        DispatchResult::Unknown
    ));
    assert!(matches!(
        pipeline.dispatch(p.clone(), &mut db, &scope, &Cancel(false)),
        DispatchResult::Busy
    ));
    scope.0.borrow_mut().profile_id =
        EntityId::new("50000000-0000-4000-8000-000000000099".into()).unwrap();
    drop(db);
    let reopened = CurrentSqlite::open(&path, p.context().profile_id.clone()).unwrap();
    let actual = receipt(pipeline.resolve(&reopened, &scope), false);
    eq(&actual.identity, &p.request().identity);
    data_eq!(
        reopened.read_pending(&p.context().space_id).unwrap().len(),
        1
    );
    assert!(matches!(
        pipeline.resolve(&reopened, &scope),
        DispatchResult::Idle
    ));
}
#[test]
fn scope_changes_before_dispatch_never_write() {
    for field in 0..6 {
        let (p, scope, mut db, _) = fixture();
        let id = EntityId::new("50000000-0000-4000-8000-000000000099".into()).unwrap();
        let rev = Revision::new(2).unwrap();
        match field {
            0 => scope.0.borrow_mut().profile_id = id,
            1 => scope.0.borrow_mut().space_id = id,
            2 => scope.0.borrow_mut().epoch = id,
            3 => scope.0.borrow_mut().profile_revision = rev,
            4 => scope.0.borrow_mut().session_generation = rev,
            _ => scope.0.borrow_mut().generation = rev,
        }
        assert!(matches!(
            CommitPipeline::default().dispatch(p.clone(), &mut db, &scope, &Cancel(false)),
            DispatchResult::ScopeChanged
        ));
        empty(&db, &p);
    }
}
#[test]
fn scope_change_after_writes_rolls_back_all_parts() {
    let (p, scope, mut db, _) = fixture();
    let observer = scope.clone();
    db.observe_commit(move |boundary| {
        if boundary == CommitBoundary::AfterWrites {
            observer.0.borrow_mut().session_generation = Revision::new(2).unwrap();
        }
    });
    match CommitPipeline::default().dispatch(p.clone(), &mut db, &scope, &Cancel(false)) {
        DispatchResult::NotCommitted { error } => {
            data_eq!(error.code, StorageFailureCode::Cancelled)
        }
        _ => panic!("Scopewechsel vor COMMIT muss abbrechen"),
    }
    empty(&db, &p);
}
#[test]
fn scope_change_after_commit_does_not_claim_rollback_or_confirm_new_view() {
    let (p, scope, mut db, _) = fixture();
    let observer = scope.clone();
    db.observe_commit(move |boundary| {
        if boundary == CommitBoundary::AfterCommit {
            observer.0.borrow_mut().generation = Revision::new(2).unwrap();
        }
    });
    receipt(
        CommitPipeline::default().dispatch(p.clone(), &mut db, &scope, &Cancel(false)),
        false,
    );
    assert!(db.lookup_result(&p.request().identity).unwrap().is_some());
}
#[test]
fn cancellation_and_storage_failure_leave_no_partial_state() {
    for cancelled in [true, false] {
        let (p, scope, mut db, _) = fixture();
        if !cancelled {
            db.inject_write_failure();
        }
        match CommitPipeline::default().dispatch(p.clone(), &mut db, &scope, &Cancel(cancelled)) {
            DispatchResult::NotCommitted { error } => data_eq!(
                error.code,
                if cancelled {
                    StorageFailureCode::Cancelled
                } else {
                    StorageFailureCode::WriteFailed
                }
            ),
            DispatchResult::Unknown => {
                panic!("Abbruch/Fehler muss sicher zurückrollen: unknown, cancelled={cancelled}")
            }
            DispatchResult::Committed { .. } => {
                panic!("Abbruch/Fehler muss sicher zurückrollen: committed, cancelled={cancelled}")
            }
            DispatchResult::ScopeChanged => panic!(
                "Abbruch/Fehler muss sicher zurückrollen: scopeChanged, cancelled={cancelled}"
            ),
            DispatchResult::Busy => {
                panic!("Abbruch/Fehler muss sicher zurückrollen: busy, cancelled={cancelled}")
            }
            DispatchResult::Idle => {
                panic!("Abbruch/Fehler muss sicher zurückrollen: idle, cancelled={cancelled}")
            }
        }
        empty(&db, &p);
    }
}
struct CorruptPort {
    receipt: Option<LocalCommitReceipt>,
    commits: usize,
}
impl LocalCommitPort for CorruptPort {
    fn commit(&mut self, _: LocalCommitRequest) -> LocalCommitOutcome {
        unreachable!()
    }
    fn lookup_result(
        &self,
        _: &LocalOperationIdentity,
    ) -> Result<Option<LocalCommitReceipt>, StorageFailure> {
        Ok(self.receipt.clone())
    }
}
impl CancellableLocalCommitPort for CorruptPort {
    fn commit_cancellable(
        &mut self,
        _: LocalCommitRequest,
        _: &dyn CancellationPort,
    ) -> LocalCommitOutcome {
        self.commits += 1;
        LocalCommitOutcome::Committed {
            value: self.receipt.clone().unwrap(),
        }
    }
}
#[test]
fn invalid_identity_hash_or_revision_never_confirms_and_missing_receipt_stays_locked() {
    let (p, scope, mut db, _) = fixture();
    let valid = receipt(
        CommitPipeline::default().dispatch(p.clone(), &mut db, &scope, &Cancel(false)),
        true,
    );
    for field in 0..4 {
        let mut bad = valid.clone();
        match field {
            0 => {
                bad.identity.epoch =
                    EntityId::new("50000000-0000-4000-8000-000000000099".into()).unwrap()
            }
            1 => bad.content_hash = FileHash::new("0".repeat(64)).unwrap(),
            2 => bad.committed_revisions.clear(),
            _ => bad.committed_revisions[0].revision = StoredRevision::new(2).unwrap(),
        }
        let mut port = CorruptPort {
            receipt: Some(bad),
            commits: 0,
        };
        let mut pipeline = CommitPipeline::default();
        assert!(matches!(
            pipeline.dispatch(p.clone(), &mut port, &scope, &Cancel(false)),
            DispatchResult::Unknown
        ));
        assert!(matches!(
            pipeline.resolve(&port, &scope),
            DispatchResult::Unknown
        ));
        port.receipt = None;
        assert!(matches!(
            pipeline.resolve(&port, &scope),
            DispatchResult::Unknown
        ));
        assert!(matches!(
            pipeline.dispatch(p.clone(), &mut port, &scope, &Cancel(false)),
            DispatchResult::Busy
        ));
        data_eq!(port.commits, 1);
        port.receipt = Some(valid.clone());
        eq(&receipt(pipeline.resolve(&port, &scope), true), &valid);
    }
}

#[test]
fn new_operation_with_stale_cas_cannot_overwrite_committed_original() {
    let (p, scope, mut db, _) = fixture();
    let mut pipeline = CommitPipeline::default();
    let first = receipt(
        pipeline.dispatch(p.clone(), &mut db, &scope, &Cancel(false)),
        true,
    );
    let cases: Vec<serde_json::Value> = serde_json::from_str(include_str!(
        "../../finance-core/tests/fixtures/contract-catalog.json"
    ))
    .unwrap();
    let mut r = wimm_finance_core::decode_command_request_v1(
        &cases
            .iter()
            .find(|c| c["name"] == "Kontoeinstieg F01 Kontoeinstieg")
            .unwrap()["request"]
            .to_string(),
    )
    .unwrap();
    r.context.operation_id = EntityId::new("50000000-0000-4000-8000-000000000099".into()).unwrap();
    let stale = prepare_command(r, p.context(), p.context(), AreaMode::Connected)
        .unwrap()
        .unwrap();
    match pipeline.dispatch(stale.clone(), &mut db, &scope, &Cancel(false)) {
        DispatchResult::NotCommitted { error } => {
            data_eq!(error.code, StorageFailureCode::RevisionConflict)
        }
        _ => panic!("Veraltetes CAS muss abgewiesen werden"),
    }
    assert!(
        db.lookup_result(&stale.request().identity)
            .unwrap()
            .is_none()
    );
    data_eq!(
        db.lookup_result(&p.request().identity).unwrap().unwrap(),
        first
    );
    data_eq!(
        db.read_pending(&p.context().space_id).unwrap(),
        p.request().batch.outbox
    );
}
