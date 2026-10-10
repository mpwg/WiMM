// SPDX-License-Identifier: AGPL-3.0-or-later
#![forbid(unsafe_code)]
use wimm_client_application::{dispatch::*, history::*, *};
use wimm_finance_types::{
    command_contracts::{Context, Expectation, Request},
    models::{Aggregate, Command, SaveCommand},
    scalars::*,
};
use wimm_local_contracts::{commit::*, storage::*, storage_port::CancellationPort};
#[path = "support/current_sqlite.rs"]
mod current_sqlite;
use current_sqlite::CurrentSqlite;
struct Scope(CommitContext);
impl CommitContextPort for Scope {
    fn current(&self) -> CommitContext {
        self.0.clone()
    }
}
struct Continue;
impl CancellationPort for Continue {
    fn is_cancelled(&self) -> bool {
        false
    }
}
struct Rig {
    scope: Scope,
    db: CurrentSqlite,
    state: Vec<Aggregate>,
    pipeline: CommitPipeline,
    initial: Request,
}
fn id(n: u32) -> EntityId {
    EntityId::new(format!("50000000-0000-4000-8000-{n:012}")).unwrap()
}
fn context(n: u32) -> Context {
    Context {
        operation_id: id(n),
        occurred_at: UtcTimestamp::new("2026-10-10T09:00:00Z".into()).unwrap(),
        generated_ids: vec![],
    }
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
            .join("../../test-results/ar05/history");
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
        Self {
            scope: Scope(ctx),
            db,
            state: initial.aggregates.clone(),
            pipeline: CommitPipeline::default(),
            initial,
        }
    }
    fn save(&mut self) -> PreparedCommit {
        prepare_command(
            self.initial.clone(),
            &self.scope.0,
            &self.scope.0,
            AreaMode::Standalone,
        )
        .unwrap()
        .unwrap()
    }
    fn dispatch(&mut self, p: &PreparedCommit) -> DispatchResult {
        let result = self
            .pipeline
            .dispatch(p.clone(), &mut self.db, &self.scope, &Continue);
        if matches!(result, DispatchResult::Committed { .. }) {
            self.reload(p);
        }
        result
    }
    fn reload(&mut self, p: &PreparedCommit) {
        for a in &p.request().batch.aggregates {
            self.state.retain(|old| old.id() != a.aggregate.id());
            self.state.push(
                self.db
                    .read_aggregate(&a.handle)
                    .unwrap()
                    .unwrap()
                    .aggregate,
            );
        }
    }
    fn edit(&self, n: u32) -> PreparedCommit {
        let mut desired = self
            .state
            .iter()
            .find(|a| matches!(a, Aggregate::Transaction(_)))
            .unwrap()
            .clone();
        let revision = desired.revision().value();
        *desired.revision_mut() = StoredRevision::new(revision + 1).unwrap();
        if let Aggregate::Transaction(t) = &mut desired {
            t.note = Some(format!("Notiz {n}"));
        }
        let expected = self
            .state
            .iter()
            .map(|a| Expectation {
                id: a.id().clone(),
                expected_revision: Revision::new(a.revision().value()).unwrap(),
            })
            .collect();
        prepare_command(
            Request {
                contract_version: 1.into(),
                domain_schema_version: 1.into(),
                space_id: self.scope.0.space_id.clone(),
                aggregates: self.state.clone(),
                command: Command::TransactionSave(SaveCommand {
                    aggregates: NonEmptyVec::new(vec![desired]).unwrap(),
                }),
                expected_revisions: expected,
                context: context(n),
            },
            &self.scope.0,
            &self.scope.0,
            AreaMode::Standalone,
        )
        .unwrap()
        .unwrap()
    }
    fn move_history(&mut self, h: &mut FinanceHistory, direction: Direction, n: u32) {
        let movement = h
            .prepare_move(
                direction,
                self.state.clone(),
                context(n),
                &self.scope.0,
                AreaMode::Standalone,
            )
            .unwrap()
            .unwrap();
        let result = self.dispatch(movement.prepared());
        h.accept_move(&movement, &result, &self.scope.0).unwrap();
    }
}
#[test]
fn sequential_undo_redo_rebases_only_own_transitions_and_preserves_tombstones() {
    let mut rig = Rig::new();
    let mut h = FinanceHistory::new(rig.scope.0.clone());
    let initial = rig.save();
    let result = rig.dispatch(&initial);
    h.record(&initial, &result, &rig.scope.0).unwrap();
    let edited = rig.edit(101);
    let result = rig.dispatch(&edited);
    h.record(&edited, &result, &rig.scope.0).unwrap();
    rig.move_history(&mut h, Direction::Undo, 102);
    assert!(
        matches!(rig.state.iter().find(|a|matches!(a,Aggregate::Transaction(_))).unwrap(),Aggregate::Transaction(t) if t.note.is_none() && t.revision.value()==3)
    );
    rig.move_history(&mut h, Direction::Undo, 103);
    assert!(!h.can_undo());
    assert!(h.can_redo());
    assert!(rig.state.iter().any(
        |a| matches!(a,Aggregate::Transaction(t) if t.deleted_at.is_some() && t.revision.value()==4)
    ));
    rig.move_history(&mut h, Direction::Redo, 104);
    rig.move_history(&mut h, Direction::Redo, 105);
    assert!(!h.can_redo());
    assert!(h.can_undo());
    assert!(rig.state.iter().any(|a|matches!(a,Aggregate::Transaction(t) if t.deleted_at.is_none() && t.note.as_ref().unwrap().as_str()=="Notiz 101" && t.revision.value()==6)));
}
#[test]
fn foreign_write_conflicts_without_moving_history() {
    let mut rig = Rig::new();
    let mut h = FinanceHistory::new(rig.scope.0.clone());
    let p = rig.save();
    let result = rig.dispatch(&p);
    h.record(&p, &result, &rig.scope.0).unwrap();
    let foreign = rig.edit(110);
    assert!(matches!(
        rig.dispatch(&foreign),
        DispatchResult::Committed { .. }
    ));
    assert!(matches!(
        h.prepare_move(
            Direction::Undo,
            rig.state.clone(),
            context(111),
            &rig.scope.0,
            AreaMode::Standalone
        ),
        Err(HistoryFailure::Preparation(
            PreparationFailure::FinanceRejected("REVISION_CONFLICT")
        ))
    ));
    assert!(h.can_undo());
    assert!(!h.can_redo());
}
#[test]
fn unknown_and_cancelled_commits_never_record_or_move_history() {
    let mut rig = Rig::new();
    let mut h = FinanceHistory::new(rig.scope.0.clone());
    let p = rig.save();
    rig.db.lose_next_response();
    let result = rig.dispatch(&p);
    assert_eq!(
        h.record(&p, &result, &rig.scope.0),
        Err(HistoryFailure::NotConfirmed)
    );
    assert!(!h.can_undo());
    let resolved = rig.pipeline.resolve(&rig.db, &rig.scope);
    h.record(&p, &resolved, &rig.scope.0).unwrap();
    rig.reload(&p);
    let movement = h
        .prepare_move(
            Direction::Undo,
            rig.state.clone(),
            context(120),
            &rig.scope.0,
            AreaMode::Standalone,
        )
        .unwrap()
        .unwrap();
    rig.db.inject_write_failure();
    let result = rig.dispatch(movement.prepared());
    assert_eq!(
        h.accept_move(&movement, &result, &rig.scope.0),
        Err(HistoryFailure::NotConfirmed)
    );
    assert!(h.can_undo());
    assert!(!h.can_redo());
}
#[test]
fn late_scope_or_wrong_receipt_cannot_confirm_another_history_action() {
    let mut rig = Rig::new();
    let mut h = FinanceHistory::new(rig.scope.0.clone());
    let p = rig.save();
    let result = rig.dispatch(&p);
    h.record(&p, &result, &rig.scope.0).unwrap();
    let movement = h
        .prepare_move(
            Direction::Undo,
            rig.state.clone(),
            context(130),
            &rig.scope.0,
            AreaMode::Standalone,
        )
        .unwrap()
        .unwrap();
    assert_eq!(
        h.accept_move(&movement, &result, &rig.scope.0),
        Err(HistoryFailure::NotConfirmed)
    );
    rig.scope.0.session_generation = Revision::new(2).unwrap();
    assert_eq!(
        h.record(&p, &result, &rig.scope.0),
        Err(HistoryFailure::ScopeChanged)
    );
    assert!(matches!(
        h.prepare_move(
            Direction::Undo,
            rig.state.clone(),
            context(131),
            &rig.scope.0,
            AreaMode::Standalone
        ),
        Err(HistoryFailure::ScopeChanged)
    ));
}

#[test]
fn repeated_receipt_and_stale_movement_cannot_change_stacks() {
    let mut rig = Rig::new();
    let mut h = FinanceHistory::new(rig.scope.0.clone());
    let p = rig.save();
    let result = rig.dispatch(&p);
    h.record(&p, &result, &rig.scope.0).unwrap();
    assert_eq!(
        h.record(&p, &result, &rig.scope.0),
        Err(HistoryFailure::NotConfirmed)
    );
    let movement = h
        .prepare_move(
            Direction::Undo,
            rig.state.clone(),
            context(140),
            &rig.scope.0,
            AreaMode::Standalone,
        )
        .unwrap()
        .unwrap();
    let edit = rig.edit(141);
    let result = rig.dispatch(&edit);
    h.record(&edit, &result, &rig.scope.0).unwrap();
    assert_eq!(
        h.accept_move(&movement, &result, &rig.scope.0),
        Err(HistoryFailure::StaleHistory)
    );
    rig.move_history(&mut h, Direction::Undo, 142);
    rig.move_history(&mut h, Direction::Undo, 143);
    assert!(!h.can_undo());
    assert!(h.can_redo());
}
#[test]
fn unknown_move_resolves_same_receipt_without_changing_history_early() {
    let mut rig = Rig::new();
    let mut h = FinanceHistory::new(rig.scope.0.clone());
    let p = rig.save();
    let result = rig.dispatch(&p);
    h.record(&p, &result, &rig.scope.0).unwrap();
    let movement = h
        .prepare_move(
            Direction::Undo,
            rig.state.clone(),
            context(150),
            &rig.scope.0,
            AreaMode::Standalone,
        )
        .unwrap()
        .unwrap();
    rig.db.lose_next_response();
    let result = rig.dispatch(movement.prepared());
    assert_eq!(
        h.accept_move(&movement, &result, &rig.scope.0),
        Err(HistoryFailure::NotConfirmed)
    );
    assert!(h.can_undo());
    assert!(!h.can_redo());
    let resolved = rig.pipeline.resolve(&rig.db, &rig.scope);
    h.accept_move(&movement, &resolved, &rig.scope.0).unwrap();
    rig.reload(movement.prepared());
    assert!(!h.can_undo());
    assert!(h.can_redo());
    assert_eq!(
        h.accept_move(&movement, &resolved, &rig.scope.0),
        Err(HistoryFailure::StaleHistory)
    );
    rig.move_history(&mut h, Direction::Redo, 151);
}

#[test]
fn new_action_discards_redo_and_nonfinancial_commit_clears_session_history() {
    let mut rig = Rig::new();
    let mut h = FinanceHistory::new(rig.scope.0.clone());
    let p = rig.save();
    let result = rig.dispatch(&p);
    h.record(&p, &result, &rig.scope.0).unwrap();
    let edit = rig.edit(160);
    let result = rig.dispatch(&edit);
    h.record(&edit, &result, &rig.scope.0).unwrap();
    rig.move_history(&mut h, Direction::Undo, 161);
    assert!(h.can_redo());
    let fresh = rig.edit(162);
    let result = rig.dispatch(&fresh);
    h.record(&fresh, &result, &rig.scope.0).unwrap();
    assert!(!h.can_redo());
    let mut account = rig
        .state
        .iter()
        .find(|a| matches!(a, Aggregate::Account(_)))
        .unwrap()
        .clone();
    *account.revision_mut() = StoredRevision::new(account.revision().value() + 1).unwrap();
    if let Aggregate::Account(a) = &mut account {
        a.name = NonEmptyText::new("Umbenannt".into()).unwrap();
    }
    let expected = rig
        .state
        .iter()
        .map(|a| Expectation {
            id: a.id().clone(),
            expected_revision: Revision::new(a.revision().value()).unwrap(),
        })
        .collect();
    let p = prepare_command(
        Request {
            contract_version: 1.into(),
            domain_schema_version: 1.into(),
            space_id: rig.scope.0.space_id.clone(),
            aggregates: rig.state.clone(),
            command: Command::AccountSave(SaveCommand {
                aggregates: NonEmptyVec::new(vec![account]).unwrap(),
            }),
            expected_revisions: expected,
            context: context(163),
        },
        &rig.scope.0,
        &rig.scope.0,
        AreaMode::Standalone,
    )
    .unwrap()
    .unwrap();
    let result = rig.dispatch(&p);
    h.record(&p, &result, &rig.scope.0).unwrap();
    assert!(!h.can_undo());
    assert!(!h.can_redo());
}
