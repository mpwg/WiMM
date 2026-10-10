// SPDX-License-Identifier: AGPL-3.0-or-later
#![forbid(unsafe_code)]
use std::{
    cell::{Cell, RefCell},
    rc::Rc,
};
use wimm_client_application::{dispatch::*, history::Direction, recovery::*, runtime::*, *};
use wimm_finance_types::{
    command_contracts::{Context, Request},
    scalars::*,
};
use wimm_local_contracts::{
    commit::*, persistence_errors::*, storage::*, storage_port::CancellationPort,
};
#[path = "support/current_sqlite.rs"]
mod current_sqlite;
use current_sqlite::{CommitBoundary, CurrentSqlite};
#[path = "support/protection.rs"]
mod protection;
use protection::{Protect, failure};
#[derive(Default)]
struct Journal(Option<RecoveryTicket>);
impl RecoveryJournalPort for Journal {
    fn load(&self) -> Result<Option<RecoveryTicket>, StorageFailure> {
        Ok(self.0.clone())
    }
    fn save_if_absent(&mut self, t: &RecoveryTicket) -> Result<(), StorageFailure> {
        if self.0.is_some() {
            return Err(failure());
        }
        self.0 = Some(t.clone());
        Ok(())
    }
    fn clear(&mut self, t: &RecoveryTicket) -> Result<(), StorageFailure> {
        if serde_json::to_value(&self.0).unwrap() != serde_json::to_value(Some(t)).unwrap() {
            return Err(failure());
        }
        self.0 = None;
        Ok(())
    }
}
struct Reader {
    db: Rc<RefCell<CurrentSqlite>>,
    calls: Cell<usize>,
    wrong_epoch: Cell<bool>,
    failed: Cell<bool>,
}
impl MutationReadPort for Reader {
    fn load(&self, context: &CommitContext) -> Result<MutationSnapshot, StorageFailure> {
        self.calls.set(self.calls.get() + 1);
        if self.failed.get() {
            return Err(failure());
        }
        let state = self.db.borrow().snapshot(&context.space_id)?;
        let mut ctx = context.clone();
        ctx.profile_id = state.profile_id;
        ctx.space_id = state.space_id;
        ctx.epoch = if self.wrong_epoch.get() {
            id(99)
        } else {
            state.epoch
        };
        Ok(MutationSnapshot {
            context: ctx,
            aggregates: state.aggregates.into_iter().map(|a| a.aggregate).collect(),
        })
    }
}
struct Writer {
    db: Rc<RefCell<CurrentSqlite>>,
    calls: usize,
}
impl LocalCommitPort for Writer {
    fn commit(&mut self, r: LocalCommitRequest) -> LocalCommitOutcome {
        self.calls += 1;
        self.db.borrow_mut().commit(r)
    }
    fn lookup_result(
        &self,
        id: &LocalOperationIdentity,
    ) -> Result<Option<LocalCommitReceipt>, StorageFailure> {
        self.db.borrow().lookup_result(id)
    }
}
impl CancellableLocalCommitPort for Writer {
    fn commit_cancellable(
        &mut self,
        r: LocalCommitRequest,
        c: &dyn CancellationPort,
    ) -> LocalCommitOutcome {
        self.calls += 1;
        self.db.borrow_mut().commit_cancellable(r, c)
    }
}
struct Scope(Rc<RefCell<CommitContext>>);
impl CommitContextPort for Scope {
    fn current(&self) -> CommitContext {
        self.0.borrow().clone()
    }
}
struct Cancel(Cell<bool>);
impl CancellationPort for Cancel {
    fn is_cancelled(&self) -> bool {
        self.0.get()
    }
}
fn id(n: u32) -> EntityId {
    EntityId::new(format!("50000000-0000-4000-8000-{n:012}")).unwrap()
}
fn operation(n: u32) -> Context {
    Context {
        operation_id: id(n),
        occurred_at: UtcTimestamp::new("2026-10-10T12:00:00Z".into()).unwrap(),
        generated_ids: vec![],
    }
}
struct Rig {
    ctx: CommitContext,
    initial: Request,
    reader: Reader,
    writer: Writer,
    journal: Journal,
    protect: Protect,
    scope: Scope,
    cancel: Cancel,
}
impl Rig {
    fn new() -> Self {
        let catalog: Vec<serde_json::Value> = serde_json::from_str(include_str!(
            "../../finance-core/tests/fixtures/contract-catalog.json"
        ))
        .unwrap();
        let initial = wimm_finance_core::decode_command_request_v1(
            &catalog
                .iter()
                .find(|c| c["name"] == "Buchungs-CAS F01 neue Ausgabe")
                .unwrap()["request"]
                .to_string(),
        )
        .unwrap();
        let ctx = CommitContext {
            profile_id: id(1),
            space_id: initial.space_id.clone(),
            epoch: id(3),
            profile_revision: Revision::new(1).unwrap(),
            session_generation: Revision::new(1).unwrap(),
            generation: Revision::new(1).unwrap(),
        };
        let root = std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
            .join("../../test-results/ar05/runtime");
        std::fs::create_dir_all(&root).unwrap();
        let path = root.join(format!(
            "{}-{}.sqlite3",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        let mut db = CurrentSqlite::create(&path, ctx.profile_id.clone()).unwrap();
        db.initialize_area(&ctx.space_id, &ctx.epoch).unwrap();
        let seed = LocalCommitRequest {
            identity: LocalOperationIdentity {
                operation_contract_version: 1,
                profile_id: ctx.profile_id.clone(),
                space_id: ctx.space_id.clone(),
                epoch: ctx.epoch.clone(),
                operation_id: id(99),
            },
            batch: AtomicBatch {
                expected_revisions: initial
                    .aggregates
                    .iter()
                    .map(|a| RevisionExpectation {
                        handle: a.id().clone(),
                        expected_revision: Revision::new(0).unwrap(),
                    })
                    .collect(),
                aggregates: initial
                    .aggregates
                    .iter()
                    .map(|a| StoredAggregate {
                        handle: a.id().clone(),
                        aggregate: a.clone(),
                    })
                    .collect(),
                outbox: vec![],
                projections: vec![],
            },
        };
        assert!(matches!(
            db.commit(seed),
            LocalCommitOutcome::Committed { .. }
        ));
        let db = Rc::new(RefCell::new(db));
        Self {
            ctx: ctx.clone(),
            initial,
            reader: Reader {
                db: db.clone(),
                calls: Cell::new(0),
                wrong_epoch: Cell::new(false),
                failed: Cell::new(false),
            },
            writer: Writer { db, calls: 0 },
            journal: Journal::default(),
            protect: Protect::new(),
            scope: Scope(Rc::new(RefCell::new(ctx))),
            cancel: Cancel(Cell::new(false)),
        }
    }
    fn ports(&mut self) -> RuntimePorts<'_> {
        RuntimePorts {
            reader: &self.reader,
            storage: &mut self.writer,
            journal: &mut self.journal,
            protection: &self.protect,
            scope: &self.scope,
            cancellation: &self.cancel,
        }
    }
    fn save(&mut self, runtime: &mut ClientRuntime) -> RuntimeOutcome {
        let r = self.initial.clone();
        runtime.execute(
            r.command,
            r.expected_revisions,
            r.context,
            &mut self.ports(),
        )
    }
}
fn committed(result: RuntimeOutcome, current: bool) {
    assert!(
        matches!(result,RuntimeOutcome::Dispatch(DispatchResult::Committed{current:c,..}) if c==current)
    );
}
#[test]
fn same_runtime_reads_commits_and_moves_history_without_postcommit_read_or_second_write() {
    let mut rig = Rig::new();
    let mut app = ClientRuntime::new(rig.ctx.clone(), AreaMode::Connected);
    committed(rig.save(&mut app), true);
    assert_eq!(rig.reader.calls.get(), 1);
    assert_eq!(rig.writer.calls, 1);
    assert_eq!(app.history_available(), (true, false));
    let pending = rig
        .writer
        .db
        .borrow()
        .read_pending(&rig.ctx.space_id)
        .unwrap();
    assert_eq!(pending.len(), 1);
    assert_eq!(app.page(&rig.scope, 0, 100).unwrap().len(), 6);
    committed(
        app.move_history(Direction::Undo, operation(201), &mut rig.ports()),
        true,
    );
    assert_eq!(app.history_available(), (false, true));
    assert!(
        app.page(&rig.scope, 0, 100)
            .unwrap()
            .iter()
            .any(
                |a| a.kind() == wimm_finance_types::models::AggregateKind::Transaction
                    && !a.is_live()
            )
    );
    committed(
        app.move_history(Direction::Redo, operation(202), &mut rig.ports()),
        true,
    );
    assert_eq!(app.history_available(), (true, false));
    assert_eq!(rig.writer.calls, 3);
    assert_eq!(rig.reader.calls.get(), 3);
}
#[test]
fn unknown_preserves_old_confirmed_view_and_history_until_same_receipt_resolves() {
    let mut rig = Rig::new();
    let mut app = ClientRuntime::new(rig.ctx.clone(), AreaMode::Standalone);
    assert!(matches!(app.load(&rig.ports()), RuntimeOutcome::Unchanged));
    let before = app.page(&rig.scope, 0, 100).unwrap();
    rig.writer.db.borrow_mut().lose_next_response();
    assert!(matches!(
        rig.save(&mut app),
        RuntimeOutcome::Dispatch(DispatchResult::Unknown)
    ));
    assert_eq!(app.page(&rig.scope, 0, 100).unwrap(), before);
    assert_eq!(app.history_available(), (false, false));
    assert!(matches!(
        rig.save(&mut app),
        RuntimeOutcome::Dispatch(DispatchResult::Busy)
    ));
    assert_eq!(rig.writer.calls, 1);
    committed(app.resolve(&mut rig.ports()), true);
    assert_eq!(app.history_available(), (true, false));
    assert_eq!(app.page(&rig.scope, 0, 100).unwrap().len(), 6);
    assert_eq!(rig.writer.calls, 1);
    assert!(rig.journal.0.is_none());
    assert!(matches!(
        app.resolve(&mut rig.ports()),
        RuntimeOutcome::Dispatch(DispatchResult::Idle)
    ));
}
#[test]
fn reader_failure_or_wrong_snapshot_epoch_cannot_write_or_publish_foreign_view() {
    for wrong_epoch in [false, true] {
        let mut rig = Rig::new();
        let mut app = ClientRuntime::new(rig.ctx.clone(), AreaMode::Standalone);
        rig.reader.wrong_epoch.set(wrong_epoch);
        rig.reader.failed.set(!wrong_epoch);
        assert!(matches!(
            rig.save(&mut app),
            RuntimeOutcome::ReadFailed(_) | RuntimeOutcome::Dispatch(DispatchResult::ScopeChanged)
        ));
        assert_eq!(rig.writer.calls, 0);
        assert!(app.page(&rig.scope, 0, 100).unwrap().is_empty());
    }
}
#[test]
fn cancellation_and_rollback_keep_confirmed_state_and_no_history() {
    for cancel in [false, true] {
        let mut rig = Rig::new();
        let mut app = ClientRuntime::new(rig.ctx.clone(), AreaMode::Standalone);
        app.load(&rig.ports());
        let before = app.page(&rig.scope, 0, 100).unwrap();
        rig.cancel.0.set(cancel);
        if !cancel {
            rig.writer.db.borrow_mut().inject_write_failure();
        }
        assert!(matches!(
            rig.save(&mut app),
            RuntimeOutcome::Dispatch(DispatchResult::NotCommitted { .. })
        ));
        assert_eq!(app.page(&rig.scope, 0, 100).unwrap(), before);
        assert_eq!(app.history_available(), (false, false));
        assert!(rig.journal.0.is_none());
    }
}
#[test]
fn late_scope_change_retains_commit_certainty_but_does_not_update_view_or_history() {
    let mut rig = Rig::new();
    let mut app = ClientRuntime::new(rig.ctx.clone(), AreaMode::Standalone);
    app.load(&rig.ports());
    let scope = rig.scope.0.clone();
    rig.writer.db.borrow_mut().observe_commit(move |boundary| {
        if boundary == CommitBoundary::AfterCommit {
            scope.borrow_mut().session_generation = Revision::new(2).unwrap();
        }
    });
    committed(rig.save(&mut app), false);
    assert!(matches!(
        app.page(&rig.scope, 0, 100),
        Err(PreparationFailure::ScopeChanged)
    ));
    assert_eq!(app.history_available(), (false, false));
    assert!(matches!(
        app.page(&rig.scope, 0, 100),
        Err(PreparationFailure::ScopeChanged)
    ));
    assert!(matches!(
        rig.save(&mut app),
        RuntimeOutcome::Dispatch(DispatchResult::ScopeChanged)
    ));
    assert_eq!(rig.writer.calls, 1);
}
#[test]
fn runtime_restart_resolves_original_without_reconstructing_old_session_history() {
    let mut rig = Rig::new();
    let mut app = ClientRuntime::new(rig.ctx.clone(), AreaMode::Standalone);
    rig.writer.db.borrow_mut().lose_next_response();
    assert!(matches!(
        rig.save(&mut app),
        RuntimeOutcome::Dispatch(DispatchResult::Unknown)
    ));
    drop(app);
    rig.ctx.session_generation = Revision::new(2).unwrap();
    *rig.scope.0.borrow_mut() = rig.ctx.clone();
    let mut restarted = ClientRuntime::new(rig.ctx.clone(), AreaMode::Standalone);
    assert!(matches!(
        restarted.load(&rig.ports()),
        RuntimeOutcome::Dispatch(DispatchResult::Busy)
    ));
    committed(restarted.resolve(&mut rig.ports()), false);
    assert_eq!(restarted.history_available(), (false, false));
    assert!(matches!(
        restarted.load(&rig.ports()),
        RuntimeOutcome::Unchanged
    ));
    assert_eq!(restarted.page(&rig.scope, 0, 100).unwrap().len(), 6);
    assert_eq!(rig.writer.calls, 1);
}
#[test]
fn view_ports_bound_payload_and_reject_stale_scope() {
    let mut rig = Rig::new();
    let mut app = ClientRuntime::new(rig.ctx.clone(), AreaMode::Standalone);
    app.load(&rig.ports());
    assert_eq!(app.page(&rig.scope, 1, 2).unwrap().len(), 2);
    assert!(matches!(
        app.page(&rig.scope, 0, 101),
        Err(PreparationFailure::InvalidState)
    ));
}

#[test]
fn stale_cas_rejection_never_writes_again_or_adds_history() {
    let mut rig = Rig::new();
    let mut app = ClientRuntime::new(rig.ctx.clone(), AreaMode::Standalone);
    committed(rig.save(&mut app), true);
    let before = app.page(&rig.scope, 0, 100).unwrap();
    assert!(matches!(
        rig.save(&mut app),
        RuntimeOutcome::PreparationRejected(PreparationFailure::FinanceRejected(
            "REVISION_CONFLICT"
        ))
    ));
    assert_eq!(rig.writer.calls, 1);
    assert_eq!(app.page(&rig.scope, 0, 100).unwrap(), before);
    assert_eq!(app.history_available(), (true, false));
    committed(
        app.move_history(Direction::Undo, operation(211), &mut rig.ports()),
        true,
    );
    assert_eq!(app.history_available(), (false, true));
}
#[test]
fn unknown_history_move_resolves_once_and_keeps_stacks_unconfirmed_until_receipt() {
    let mut rig = Rig::new();
    let mut app = ClientRuntime::new(rig.ctx.clone(), AreaMode::Connected);
    committed(rig.save(&mut app), true);
    let before = app.page(&rig.scope, 0, 100).unwrap();
    rig.writer.db.borrow_mut().lose_next_response();
    assert!(matches!(
        app.move_history(Direction::Undo, operation(221), &mut rig.ports()),
        RuntimeOutcome::Dispatch(DispatchResult::Unknown)
    ));
    assert_eq!(app.page(&rig.scope, 0, 100).unwrap(), before);
    assert_eq!(app.history_available(), (true, false));
    committed(app.resolve(&mut rig.ports()), true);
    assert_eq!(app.history_available(), (false, true));
    assert_eq!(rig.writer.calls, 2);
    assert!(matches!(
        app.resolve(&mut rig.ports()),
        RuntimeOutcome::Dispatch(DispatchResult::Idle)
    ));
    assert_eq!(rig.writer.calls, 2);
}
