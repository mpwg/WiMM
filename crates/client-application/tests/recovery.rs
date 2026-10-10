// SPDX-License-Identifier: AGPL-3.0-or-later
#![forbid(unsafe_code)]
use std::{
    io::Write,
    path::{Path, PathBuf},
};
use wimm_client_application::{dispatch::*, recovery::*, *};
use wimm_finance_types::scalars::*;
use wimm_local_contracts::{
    commit::LocalCommitRequest,
    persistence_errors::*,
    storage_port::{CancellationPort, SnapshotProtectionPort},
};
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

// Ausschließlich synthetischer Testschlüssel. Echte AR08-libsodium-Primitive mit Zufallsnonce.
struct Protect(wimm_client_crypto::SecretKey);
impl Protect {
    fn new() -> Self {
        wimm_client_crypto::initialize().unwrap();
        Self(wimm_client_crypto::SecretKey::from_bytes(&[42; 32]).unwrap())
    }
}
impl SnapshotProtectionPort<LocalCommitRequest> for Protect {
    type Error = StorageFailure;
    fn seal(&self, request: LocalCommitRequest) -> Result<Vec<u8>, StorageFailure> {
        let bytes = serde_json::to_vec(&request).map_err(|_| failure())?;
        let sealed =
            wimm_client_crypto::encrypt(&self.0, b"wimm/local/application-recovery/v1", &bytes)
                .map_err(|_| failure())?;
        serde_json::to_vec(
            &serde_json::json!({"nonce":sealed.nonce,"ciphertext":sealed.ciphertext}),
        )
        .map_err(|_| failure())
    }
    fn unseal(&self, bytes: &[u8]) -> Result<LocalCommitRequest, StorageFailure> {
        #[derive(serde::Deserialize)]
        #[serde(deny_unknown_fields)]
        struct Boxed {
            nonce: Vec<u8>,
            ciphertext: Vec<u8>,
        }
        let boxed: Boxed = serde_json::from_slice(bytes).map_err(|_| failure())?;
        let opened = wimm_client_crypto::decrypt(
            &self.0,
            &boxed.nonce,
            b"wimm/local/application-recovery/v1",
            &boxed.ciphertext,
        )
        .map_err(|_| failure())?;
        serde_json::from_slice(&opened).map_err(|_| failure())
    }
}
fn failure() -> StorageFailure {
    StorageFailure::not_committed(StorageFailureCode::WriteFailed)
}
/// Tatsächlicher privater Datei-Testadapter, kein produktiver nativer/Browser-DAL.
struct Journal {
    root: PathBuf,
    fail_save: bool,
    fail_clear: bool,
    fail_after_save: bool,
    read_failed: bool,
}
impl Journal {
    fn path(&self) -> PathBuf {
        self.root.join("recovery.json")
    }
}
impl RecoveryJournalPort for Journal {
    fn load(&self) -> Result<Option<RecoveryTicket>, StorageFailure> {
        if self.read_failed {
            return Err(failure());
        }
        match std::fs::read(self.path()) {
            Ok(bytes) => serde_json::from_slice(&bytes)
                .map(Some)
                .map_err(|_| failure()),
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(None),
            Err(_) => Err(failure()),
        }
    }
    fn save_if_absent(&mut self, ticket: &RecoveryTicket) -> Result<(), StorageFailure> {
        if self.fail_save {
            return Err(failure());
        }
        let mut file = std::fs::OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(self.path())
            .map_err(|_| failure())?;
        file.write_all(&serde_json::to_vec(ticket).map_err(|_| failure())?)
            .map_err(|_| failure())?;
        file.sync_all().map_err(|_| failure())?;
        std::fs::File::open(&self.root)
            .and_then(|d| d.sync_all())
            .map_err(|_| failure())?;
        self.read_failed = self.fail_after_save;
        Ok(())
    }
    fn clear(&mut self, expected: &RecoveryTicket) -> Result<(), StorageFailure> {
        if self.fail_clear {
            return Err(failure());
        }
        let current = self.load()?.ok_or_else(failure)?;
        if serde_json::to_value(current).map_err(|_| failure())?
            != serde_json::to_value(expected).map_err(|_| failure())?
        {
            return Err(failure());
        }
        std::fs::remove_file(self.path()).map_err(|_| failure())?;
        std::fs::File::open(&self.root)
            .and_then(|d| d.sync_all())
            .map_err(|_| failure())
    }
}
fn root() -> PathBuf {
    let root = Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("../../test-results/ar05/recovery")
        .join(format!(
            "{}-{}",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
    std::fs::create_dir_all(&root).unwrap();
    root
}
fn fixture(root: &Path) -> (PreparedCommit, Scope, SqliteCommitStore, Journal) {
    let cases: Vec<serde_json::Value> = serde_json::from_str(include_str!(
        "../../finance-core/tests/fixtures/contract-catalog.json"
    ))
    .unwrap();
    let r = wimm_finance_core::decode_command_request_v1(
        &cases
            .iter()
            .find(|c| c["name"] == "Stammdaten account.save neu")
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
    let p = prepare_command(r, &ctx, &ctx, AreaMode::Standalone)
        .unwrap()
        .unwrap();
    let mut db =
        SqliteCommitStore::open(&root.join("finance.sqlite3"), ctx.profile_id.clone()).unwrap();
    db.initialize_area(&ctx.space_id, &ctx.epoch).unwrap();
    (
        p,
        Scope(ctx),
        db,
        Journal {
            root: root.to_owned(),
            fail_save: false,
            fail_clear: false,
            fail_after_save: false,
            read_failed: false,
        },
    )
}
#[test]
fn restart_across_distinct_processes() {
    if let Ok(phase) = std::env::var("WIMM_RECOVERY_TEST_PHASE") {
        let root = PathBuf::from(std::env::var("WIMM_RECOVERY_TEST_ROOT").unwrap());
        let (p, mut scope, mut db, mut journal) = fixture(&root);
        if phase == "write" {
            db.inject_after_commit_response_loss();
            assert!(matches!(
                DurableCommitPipeline.dispatch(
                    p.clone(),
                    &mut db,
                    &mut journal,
                    &Protect::new(),
                    &scope,
                    &Continue
                ),
                DispatchResult::Unknown
            ));
            assert!(journal.load().unwrap().is_some());
            let ticket = std::fs::read_to_string(journal.path()).unwrap();
            for forbidden in [
                "amount",
                "note",
                "name",
                "privateKey",
                "aggregates",
                "draft",
            ] {
                assert!(!ticket.contains(forbidden));
            }
        } else {
            scope.0.session_generation = Revision::new(2).unwrap();
            let original = journal
                .load()
                .unwrap()
                .unwrap()
                .open_original(&Protect::new())
                .unwrap();
            assert_eq!(
                serde_json::to_value(original).unwrap(),
                serde_json::to_value(p.request()).unwrap()
            );
            let mut pipeline = DurableCommitPipeline;
            assert!(matches!(
                pipeline.dispatch(
                    p.clone(),
                    &mut db,
                    &mut journal,
                    &Protect::new(),
                    &scope,
                    &Continue
                ),
                DispatchResult::ScopeChanged
            ));
            let result = pipeline.resume(&db, &mut journal, &Protect::new(), &scope);
            match result {
                DispatchResult::Committed {
                    context,
                    receipt,
                    current: false,
                } => {
                    assert_eq!(context.session_generation.value(), 1);
                    assert_eq!(
                        receipt.identity.operation_id,
                        p.request().identity.operation_id
                    );
                }
                _ => panic!("Ursprüngliches Receipt fehlt nach Prozessneustart"),
            }
            assert!(journal.load().unwrap().is_none());
            for a in &p.request().batch.aggregates {
                assert_eq!(
                    serde_json::to_value(db.read_aggregate(&a.handle).unwrap().unwrap()).unwrap(),
                    serde_json::to_value(a).unwrap()
                );
            }
            assert!(db.read_pending(&p.context().space_id).unwrap().is_empty());
            assert!(matches!(
                pipeline.resume(&db, &mut journal, &Protect::new(), &scope),
                DispatchResult::Idle
            ));
        }
        return;
    }
    let root = root();
    for phase in ["write", "read"] {
        let output = std::process::Command::new(std::env::current_exe().unwrap())
            .args([
                "--exact",
                "restart_across_distinct_processes",
                "--nocapture",
            ])
            .env("WIMM_RECOVERY_TEST_PHASE", phase)
            .env("WIMM_RECOVERY_TEST_ROOT", &root)
            .output()
            .unwrap();
        assert!(
            output.status.success(),
            "{}",
            String::from_utf8_lossy(&output.stderr)
        );
        std::fs::write(root.join(format!("{phase}.log")), output.stdout).unwrap();
    }
}
#[test]
fn journal_failure_or_corruption_never_starts_financial_write() {
    for corrupt in [false, true] {
        let (p, scope, mut db, mut journal) = fixture(&root());
        if corrupt {
            std::fs::write(journal.path(), b"invalid ticket").unwrap();
        } else {
            journal.fail_save = true;
        }
        assert!(matches!(
            DurableCommitPipeline.dispatch(
                p.clone(),
                &mut db,
                &mut journal,
                &Protect::new(),
                &scope,
                &Continue
            ),
            DispatchResult::NotCommitted { .. }
        ));
        for a in &p.request().batch.aggregates {
            assert!(db.read_aggregate(&a.handle).unwrap().is_none());
        }
        if corrupt {
            assert!(matches!(
                DurableCommitPipeline.resume(&db, &mut journal, &Protect::new(), &scope),
                DispatchResult::Unknown
            ));
        }
    }
}
#[test]
fn cleanup_failure_preserves_known_commit_and_blocks_until_original_receipt_resolution() {
    let (p, scope, mut db, mut journal) = fixture(&root());
    journal.fail_clear = true;
    let mut pipeline = DurableCommitPipeline;
    assert!(matches!(
        pipeline.dispatch(
            p.clone(),
            &mut db,
            &mut journal,
            &Protect::new(),
            &scope,
            &Continue
        ),
        DispatchResult::Committed { current: true, .. }
    ));
    assert!(matches!(
        pipeline.dispatch(
            p.clone(),
            &mut db,
            &mut journal,
            &Protect::new(),
            &scope,
            &Continue
        ),
        DispatchResult::Busy
    ));
    assert!(journal.load().unwrap().is_some());
    journal.fail_clear = false;
    assert!(matches!(
        pipeline.resume(&db, &mut journal, &Protect::new(), &scope),
        DispatchResult::Committed { current: true, .. }
    ));
    assert!(journal.load().unwrap().is_none());
}
#[test]
fn ticket_is_versioned_scope_bound_and_strict() {
    let (p, scope, mut db, mut journal) = fixture(&root());
    db.inject_after_commit_response_loss();
    assert!(matches!(
        DurableCommitPipeline.dispatch(
            p,
            &mut db,
            &mut journal,
            &Protect::new(),
            &scope,
            &Continue
        ),
        DispatchResult::Unknown
    ));
    let value = serde_json::to_value(journal.load().unwrap().unwrap()).unwrap();
    assert!(serde_json::from_value::<RecoveryTicket>(value.clone()).is_ok());
    for path in ["version", "scope", "hash", "revisions", "extra"] {
        let mut v = value.clone();
        match path {
            "version" => v["recoveryVersion"] = 2.into(),
            "scope" => {
                v["expected"]["identity"]["epoch"] = "50000000-0000-4000-8000-000000000099".into()
            }
            "hash" => v["expected"]["contentHash"] = "invalid".into(),
            "revisions" => v["expected"]["committedRevisions"] = serde_json::json!([]),
            _ => v["secret"] = "forbidden".into(),
        }
        assert!(serde_json::from_value::<RecoveryTicket>(v).is_err());
    }
}

#[test]
fn interrupted_before_financial_write_preserves_reference_and_remains_blocked_after_restart() {
    let root = root();
    let (p, scope, mut db, mut journal) = fixture(&root);
    journal.fail_after_save = true;
    assert!(matches!(
        DurableCommitPipeline.dispatch(
            p.clone(),
            &mut db,
            &mut journal,
            &Protect::new(),
            &scope,
            &Continue
        ),
        DispatchResult::NotCommitted { .. }
    ));
    assert!(journal.path().is_file());
    for a in &p.request().batch.aggregates {
        assert!(db.read_aggregate(&a.handle).unwrap().is_none());
    }
    drop(db);
    drop(journal);
    let (p, scope, mut db, mut journal) = fixture(&root);
    assert!(matches!(
        DurableCommitPipeline.resume(&db, &mut journal, &Protect::new(), &scope),
        DispatchResult::Unknown
    ));
    assert!(matches!(
        DurableCommitPipeline.dispatch(
            p.clone(),
            &mut db,
            &mut journal,
            &Protect::new(),
            &scope,
            &Continue
        ),
        DispatchResult::Busy
    ));
    for a in &p.request().batch.aggregates {
        assert!(db.read_aggregate(&a.handle).unwrap().is_none());
    }
}

#[test]
fn wrong_key_or_modified_ciphertext_preserves_original_and_never_confirms_receipt() {
    for corrupt in [false, true] {
        let (p, scope, mut db, mut journal) = fixture(&root());
        db.inject_after_commit_response_loss();
        assert!(matches!(
            DurableCommitPipeline.dispatch(
                p,
                &mut db,
                &mut journal,
                &Protect::new(),
                &scope,
                &Continue
            ),
            DispatchResult::Unknown
        ));
        let protection = if corrupt {
            let mut value = serde_json::to_value(journal.load().unwrap().unwrap()).unwrap();
            value["original"][0] = 0.into();
            std::fs::write(journal.path(), serde_json::to_vec(&value).unwrap()).unwrap();
            Protect::new()
        } else {
            Protect(wimm_client_crypto::SecretKey::from_bytes(&[43; 32]).unwrap())
        };
        assert!(
            journal
                .load()
                .unwrap()
                .unwrap()
                .open_original(&protection)
                .is_err()
        );
        assert!(matches!(
            DurableCommitPipeline.resume(&db, &mut journal, &protection, &scope),
            DispatchResult::Unknown
        ));
        assert!(journal.path().is_file());
    }
}
