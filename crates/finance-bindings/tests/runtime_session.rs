// SPDX-License-Identifier: AGPL-3.0-or-later
#![forbid(unsafe_code)]
#![cfg(feature = "native")]
use std::sync::{
    Mutex,
    atomic::{AtomicUsize, Ordering},
};
use wimm_client_application::{runtime_contracts::*, *};
use wimm_core_bindings::{NativeRuntimeHost, RuntimePortError, RuntimeSessionV2};
use wimm_finance_types::{command_contracts::Request, scalars::*};
use wimm_local_contracts::{
    checkpoint::LocalCheckpointPort, commit::*, persistence_errors::*, storage::*,
};
use wimm_local_dal::sqlite_commit::SqliteCommitStore;
type Job = Box<dyn FnOnce(&mut SqliteCommitStore) + Send>;
struct Worker(std::sync::mpsc::Sender<Job>);
impl Worker {
    fn new(init: impl FnOnce() -> SqliteCommitStore + Send + 'static) -> Self {
        let (sender, receiver) = std::sync::mpsc::channel::<Job>();
        std::thread::spawn(move || {
            let mut db = init();
            for job in receiver {
                job(&mut db);
            }
        });
        Self(sender)
    }
    fn call<T: Send + 'static>(
        &self,
        work: impl FnOnce(&mut SqliteCommitStore) -> T + Send + 'static,
    ) -> T {
        let (sender, receiver) = std::sync::mpsc::channel();
        self.0
            .send(Box::new(move |db| {
                sender.send(work(db)).ok();
            }))
            .unwrap();
        receiver.recv().unwrap()
    }
}
struct Host {
    db: Worker,
    context: CommitContext,
    journal: Mutex<Vec<u8>>,
    writes: AtomicUsize,
}
fn invalid() -> RuntimePortError {
    RuntimePortError::Failed
}
impl NativeRuntimeHost for Host {
    fn load(&self, context: CommitContext) -> Result<RuntimeSnapshotV2, RuntimePortError> {
        let space = context.space_id.clone();
        let s = self
            .db
            .call(move |db| db.checkpoint(&space))
            .map_err(|_| invalid())?
            .snapshot;
        let mut context = context;
        context.profile_id = s.profile_id;
        context.epoch = s.epoch;
        Ok(RuntimeSnapshotV2 {
            contract_version: 2,
            context,
            aggregates: s.aggregates.into_iter().map(|a| a.aggregate).collect(),
        })
    }
    fn commit(
        &self,
        r: LocalCommitRequest,
        context: CommitContext,
        cancelled: bool,
    ) -> Result<RuntimeCommitResultV2, RuntimePortError> {
        self.writes.fetch_add(1, Ordering::SeqCst);
        if cancelled || !context.is_current(&self.context) {
            return Ok(RuntimeCommitResultV2::NotCommitted {
                error: StorageFailure::not_committed(StorageFailureCode::Cancelled),
            });
        }
        Ok(match self.db.call(move |db| db.commit(r)) {
            LocalCommitOutcome::Committed { value } => {
                RuntimeCommitResultV2::Committed { receipt: value }
            }
            LocalCommitOutcome::NotCommitted { error } => {
                RuntimeCommitResultV2::NotCommitted { error }
            }
            LocalCommitOutcome::Unknown { identity } => RuntimeCommitResultV2::Unknown { identity },
        })
    }
    fn lookup(
        &self,
        i: LocalOperationIdentity,
    ) -> Result<Option<LocalCommitReceipt>, RuntimePortError> {
        self.db
            .call(move |db| db.lookup_result(&i))
            .map_err(|_| invalid())
    }
    fn journal_load(&self) -> Result<Vec<u8>, RuntimePortError> {
        Ok(self.journal.lock().unwrap().clone())
    }
    fn journal_save(&self, b: Vec<u8>) -> Result<bool, RuntimePortError> {
        let mut j = self.journal.lock().unwrap();
        if !j.is_empty() {
            return Ok(false);
        }
        *j = b;
        Ok(true)
    }
    fn journal_clear(&self, b: Vec<u8>) -> Result<bool, RuntimePortError> {
        let mut j = self.journal.lock().unwrap();
        if *j != b {
            return Ok(false);
        }
        j.clear();
        Ok(true)
    }
    fn seal(&self, r: LocalCommitRequest) -> Result<Vec<u8>, RuntimePortError> {
        let key = wimm_client_crypto::SecretKey::from_bytes(&[42; 32]).unwrap();
        let boxed = wimm_client_crypto::encrypt(
            &key,
            b"wimm/local/application-recovery/v1",
            &serde_json::to_vec(&r).unwrap(),
        )
        .map_err(|_| invalid())?;
        let mut out = boxed.nonce;
        out.extend(boxed.ciphertext);
        Ok(out)
    }
    fn unseal(&self, b: Vec<u8>) -> Result<LocalCommitRequest, RuntimePortError> {
        if b.len() < 40 {
            return Err(invalid());
        }
        let key = wimm_client_crypto::SecretKey::from_bytes(&[42; 32]).unwrap();
        let opened = wimm_client_crypto::decrypt(
            &key,
            &b[..24],
            b"wimm/local/application-recovery/v1",
            &b[24..],
        )
        .map_err(|_| invalid())?;
        serde_json::from_slice(&opened).map_err(|_| invalid())
    }
    fn current(&self) -> Result<CommitContext, RuntimePortError> {
        Ok(self.context.clone())
    }
    fn cancelled(&self) -> Result<bool, RuntimePortError> {
        Ok(false)
    }
}
fn fixture(lost: bool) -> (std::sync::Arc<RuntimeSessionV2>, Request) {
    wimm_client_crypto::initialize().unwrap();
    let cases: Vec<serde_json::Value> = serde_json::from_str(include_str!(
        "../../finance-core/tests/fixtures/contract-catalog.json"
    ))
    .unwrap();
    let r = wimm_finance_core::decode_command_request_v1(
        &cases
            .iter()
            .find(|c| c["name"] == "Buchungs-CAS F01 neue Ausgabe")
            .unwrap()["request"]
            .to_string(),
    )
    .unwrap();
    let id = |n: u32| EntityId::new(format!("50000000-0000-4000-8000-{n:012}")).unwrap();
    let ctx = CommitContext {
        profile_id: id(1),
        space_id: r.space_id.clone(),
        epoch: id(3),
        profile_revision: Revision::new(1).unwrap(),
        session_generation: Revision::new(1).unwrap(),
        generation: Revision::new(1).unwrap(),
    };
    let root = std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("../../test-results/stateful-runtime/native");
    std::fs::create_dir_all(&root).unwrap();
    let path = root.join(format!(
        "{}-{}.sqlite3",
        std::process::id(),
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_nanos()
    ));
    let seed = LocalCommitRequest {
        identity: LocalOperationIdentity {
            operation_contract_version: 1,
            profile_id: ctx.profile_id.clone(),
            space_id: ctx.space_id.clone(),
            epoch: ctx.epoch.clone(),
            operation_id: id(99),
        },
        batch: AtomicBatch {
            expected_revisions: vec![],
            aggregates: r
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
    let init_context = ctx.clone();
    let db = Worker::new(move || {
        let mut db = SqliteCommitStore::open(&path, init_context.profile_id.clone()).unwrap();
        db.initialize_area(&init_context.space_id, &init_context.epoch)
            .unwrap();
        assert!(matches!(
            db.commit(seed),
            LocalCommitOutcome::Committed { .. }
        ));
        if lost {
            db.inject_after_commit_response_loss();
        }
        db
    });
    (
        RuntimeSessionV2::new(
            ctx.clone(),
            AreaMode::Standalone,
            Box::new(Host {
                db,
                context: ctx,
                journal: Mutex::new(vec![]),
                writes: AtomicUsize::new(0),
            }),
        ),
        r,
    )
}
fn action(action: RuntimeActionV2) -> RuntimeRequestV2 {
    RuntimeRequestV2 {
        contract_version: 2,
        domain_schema_version: 1,
        action,
    }
}
#[test]
fn native_session_owns_runtime_commits_and_releases_closed_instance() {
    let (session, r) = fixture(false);
    let event = session
        .invoke(action(RuntimeActionV2::Execute {
            command: r.command,
            expected_revisions: r.expected_revisions,
            operation: r.context,
        }))
        .unwrap();
    assert!(matches!(
        event.result,
        RuntimeResultV2::Committed { current: true, .. }
    ));
    assert!(event.can_undo);
    assert_eq!(session.page(0, 100).unwrap().aggregates.len(), 6);
    assert!(session.page(0, 101).is_err());
    assert!(matches!(
        session.shutdown().unwrap().result,
        RuntimeResultV2::Closed
    ));
    assert!(matches!(
        session
            .invoke(action(RuntimeActionV2::Load))
            .unwrap()
            .result,
        RuntimeResultV2::Closed
    ));
    assert!(session.page(0, 1).is_err());
}
#[test]
fn native_session_resolves_real_sqlite_receipt_after_lost_reply() {
    let (session, r) = fixture(true);
    let event = session
        .invoke(action(RuntimeActionV2::Execute {
            command: r.command,
            expected_revisions: r.expected_revisions,
            operation: r.context,
        }))
        .unwrap();
    assert!(matches!(event.result, RuntimeResultV2::Unknown));
    assert!(!event.can_undo);
    let resolved = session.invoke(action(RuntimeActionV2::Resolve)).unwrap();
    assert!(matches!(
        resolved.result,
        RuntimeResultV2::Committed { current: true, .. }
    ));
    assert!(resolved.can_undo);
    assert!(matches!(
        session
            .invoke(action(RuntimeActionV2::Resolve))
            .unwrap()
            .result,
        RuntimeResultV2::Idle
    ));
}
