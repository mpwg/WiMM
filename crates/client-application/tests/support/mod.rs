// SPDX-License-Identifier: AGPL-3.0-or-later
#![forbid(unsafe_code)]
use wimm_client_application::dispatch::*;
use wimm_client_application::*;
use wimm_finance_types::scalars::*;
use wimm_local_contracts::{commit::*, storage::*, storage_port::CancellationPort};
use wimm_local_dal::sqlite_commit::SqliteCommitStore;
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
pub fn persist(prepared: PreparedCommit, before: &[wimm_finance_types::models::Aggregate]) {
    let ctx = prepared.context().clone();
    let root =
        std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("../../test-results/ar05/native");
    std::fs::create_dir_all(&root).unwrap();
    let path = root.join(format!(
        "command-{}-{}.sqlite3",
        std::process::id(),
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_nanos()
    ));
    let mut db = SqliteCommitStore::open(&path, ctx.profile_id.clone()).unwrap();
    db.initialize_area(&ctx.space_id, &ctx.epoch).unwrap();
    // Explizites synthetisches Testsetup: historischer Ausgangsbestand, keine produktive Importfunktion.
    let mut identity = prepared.request().identity.clone();
    identity.operation_id = EntityId::new("50000000-0000-4000-8000-000000000098".into()).unwrap();
    let seed = LocalCommitRequest {
        identity,
        batch: AtomicBatch {
            expected_revisions: before
                .iter()
                .map(|a| RevisionExpectation {
                    handle: a.id().clone(),
                    expected_revision: Revision::new(0).unwrap(),
                })
                .collect(),
            aggregates: before
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
    let scope = Scope(ctx.clone());
    let mut pipeline = CommitPipeline::default();
    assert!(matches!(
        pipeline.dispatch(prepared.clone(), &mut db, &scope, &Continue),
        DispatchResult::Committed { current: true, .. }
    ));
    drop(db);
    let reopened = SqliteCommitStore::open(&path, ctx.profile_id).unwrap();
    assert!(
        reopened
            .lookup_result(&prepared.request().identity)
            .unwrap()
            .is_some()
    );
    for a in &prepared.request().batch.aggregates {
        assert_eq!(
            serde_json::to_value(reopened.read_aggregate(&a.handle).unwrap().unwrap()).unwrap(),
            serde_json::to_value(a).unwrap()
        );
    }
    assert_eq!(
        serde_json::to_value(reopened.read_pending(&ctx.space_id).unwrap()).unwrap(),
        serde_json::to_value(&prepared.request().batch.outbox).unwrap()
    );
    assert_eq!(
        serde_json::to_value(reopened.read_projections(&ctx.space_id).unwrap()).unwrap(),
        serde_json::to_value(&prepared.request().batch.projections).unwrap()
    );
}
