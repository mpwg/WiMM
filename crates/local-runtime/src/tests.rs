// SPDX-License-Identifier: AGPL-3.0-or-later
use super::*;
use std::{cell::Cell, io::Write};
use wimm_client_application::{
    AreaMode,
    dispatch::{CommitContextPort, DispatchResult},
    history::Direction,
    runtime::{ClientRuntime, RuntimeOutcome, RuntimePorts},
};
use wimm_finance_types::{
    command_contracts::{Context, Request},
    scalars::*,
};
use wimm_local_contracts::{
    checkpoint_v2::LocalCheckpointRestoreV2, models::EncryptedBackupReceipt,
    ports::EncryptedBackupRequest, scalars::LocalId,
};
fn id(n: u32) -> EntityId {
    EntityId::new(format!("50000000-0000-4000-8000-{n:012}")).unwrap()
}
struct Backup {
    folder: std::path::PathBuf,
    next: Cell<u32>,
}
impl BackupPort for Backup {
    type Error = StorageFailure;
    fn persist(&self, r: EncryptedBackupRequest) -> Result<EncryptedBackupReceipt, StorageFailure> {
        let n = self.next.get();
        self.next.set(n + 1);
        let receipt = EncryptedBackupReceipt {
            backup_id: LocalId::new(id(n).as_str().into()).unwrap(),
            profile_id: r.profile_id,
            space_id: r.space_id,
            epoch: r.epoch,
            snapshot_hash: r.snapshot_hash,
        };
        let mut file = std::fs::File::create(self.folder.join(receipt.backup_id.as_str())).unwrap();
        file.write_all(&r.ciphertext).unwrap();
        file.sync_all().unwrap();
        std::fs::File::open(&self.folder)
            .unwrap()
            .sync_all()
            .unwrap();
        Ok(receipt)
    }
}
impl BackupReadPort for Backup {
    fn read(&self, r: &EncryptedBackupReceipt) -> Result<Vec<u8>, StorageFailure> {
        std::fs::read(self.folder.join(r.backup_id.as_str()))
            .map_err(|_| error(StorageFailureCode::ResourceUnavailable))
    }
}
struct Scope(CommitContext);
impl CommitContextPort for Scope {
    fn current(&self) -> CommitContext {
        self.0.clone()
    }
}
struct LostAnswer {
    port: RuntimeStorage,
    lose: bool,
}
impl LocalCommitPort for LostAnswer {
    fn commit(&mut self, r: LocalCommitRequest) -> LocalCommitOutcome {
        self.commit_cancellable(r, &NeverCancel)
    }
    fn lookup_result(
        &self,
        id: &LocalOperationIdentity,
    ) -> Result<Option<LocalCommitReceipt>, StorageFailure> {
        self.port.lookup_result(id)
    }
}
impl CancellableLocalCommitPort for LostAnswer {
    fn commit_cancellable(
        &mut self,
        r: LocalCommitRequest,
        c: &dyn CancellationPort,
    ) -> LocalCommitOutcome {
        let identity = r.identity.clone();
        let result = self.port.commit_cancellable(r, c);
        if self.lose && matches!(result, LocalCommitOutcome::Committed { .. }) {
            self.lose = false;
            LocalCommitOutcome::Unknown { identity }
        } else {
            result
        }
    }
}
struct Rig {
    path: std::path::PathBuf,
    context: CommitContext,
    request: Request,
    port: RuntimeStorage,
    protection: RuntimeProtection,
    backup: Backup,
}
impl Rig {
    fn new() -> Self {
        let rows: Vec<serde_json::Value> = serde_json::from_str(include_str!(
            "../../finance-core/tests/fixtures/contract-catalog.json"
        ))
        .unwrap();
        let request = wimm_finance_core::decode_command_request_v1(
            &rows
                .iter()
                .find(|r| r["name"] == "Buchungs-CAS F01 neue Ausgabe")
                .unwrap()["request"]
                .to_string(),
        )
        .unwrap();
        let context = CommitContext {
            profile_id: id(1),
            space_id: request.space_id.clone(),
            epoch: id(3),
            profile_revision: Revision::new(1).unwrap(),
            session_generation: Revision::new(1).unwrap(),
            generation: Revision::new(1).unwrap(),
        };
        let root = std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
            .join("../../test-results/dal03/runtime");
        std::fs::create_dir_all(&root).unwrap();
        let folder = root.join(format!(
            "{}-{}",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        std::fs::create_dir_all(&folder).unwrap();
        let path = folder.join("state.sqlite3");
        // Tatsächlicher ORM-Schemaaufbau, ausschließlich synthetischer Testbestand.
        wimm_local_dal::sqlite::SqliteStore::initialize_empty_file(&path).unwrap();
        let mut dal =
            SqliteWriter::open(&path, context.profile_id.clone(), CoreSnapshotValidator).unwrap();
        dal.initialize_area(&context.space_id, &context.epoch)
            .unwrap();
        dal.apply_atomic_batch(AtomicBatch {
            expected_revisions: request
                .aggregates
                .iter()
                .map(|a| RevisionExpectation {
                    handle: a.id().clone(),
                    expected_revision: Revision::new(0).unwrap(),
                })
                .collect(),
            aggregates: request
                .aggregates
                .iter()
                .map(|a| StoredAggregate {
                    handle: a.id().clone(),
                    aggregate: a.clone(),
                })
                .collect(),
            outbox: vec![],
            projections: vec![],
        })
        .unwrap();
        let protection =
            RuntimeProtection::new(wimm_client_crypto::SecretKey::from_bytes(&[42; 32]).unwrap());
        let backup = Backup {
            folder,
            next: Cell::new(700),
        };
        drop(dal);
        let port = RuntimeStorage::open(&path, context.profile_id.clone()).unwrap();
        Self {
            path,
            context,
            request,
            port,
            protection,
            backup,
        }
    }
    fn run(
        &self,
        app: &mut ClientRuntime,
        writer: &mut impl CancellableLocalCommitPort,
        journal: &mut RuntimeStorage,
        scope: &Scope,
    ) -> RuntimeOutcome {
        let r = self.request.clone();
        app.execute(
            r.command,
            r.expected_revisions,
            r.context,
            &mut RuntimePorts {
                reader: &self.port,
                storage: writer,
                journal,
                protection: &self.protection,
                scope,
                cancellation: &NeverCancel,
            },
        )
    }
}
fn committed(outcome: RuntimeOutcome) {
    assert!(matches!(
        outcome,
        RuntimeOutcome::Dispatch(DispatchResult::Committed { current: true, .. })
    ))
}
#[test]
fn real_native_runtime_uses_dal_receipts_private_journal_and_undo_redo() {
    let rig = Rig::new();
    let scope = Scope(rig.context.clone());
    let mut app = ClientRuntime::new(rig.context.clone(), AreaMode::Connected);
    let mut writer = rig.port.clone();
    let mut journal = rig.port.clone();
    committed(rig.run(&mut app, &mut writer, &mut journal, &scope));
    assert!(RecoveryJournalPort::load(&journal).unwrap().is_none());
    assert_eq!(app.history_available(), (true, false));
    let operation = |n| Context {
        operation_id: id(n),
        occurred_at: UtcTimestamp::new("2026-10-10T12:00:00Z".into()).unwrap(),
        generated_ids: vec![],
    };
    let mut ports = RuntimePorts {
        reader: &rig.port,
        storage: &mut writer,
        journal: &mut journal,
        protection: &rig.protection,
        scope: &scope,
        cancellation: &NeverCancel,
    };
    committed(app.move_history(Direction::Undo, operation(201), &mut ports));
    committed(app.move_history(Direction::Redo, operation(202), &mut ports));
    assert_eq!(app.history_available(), (true, false));
    let reopened = RuntimeStorage::open(&rig.path, rig.context.profile_id.clone()).unwrap();
    assert_eq!(
        MutationReadPort::load(&reopened, &rig.context)
            .unwrap()
            .aggregates
            .len(),
        app.page(&scope, 0, 100).unwrap().len()
    );
    assert!(RecoveryJournalPort::load(&reopened).unwrap().is_none());
}
#[test]
fn lost_answer_and_new_runtime_resolve_only_actual_original_sqlite_receipt() {
    let rig = Rig::new();
    let scope = Scope(rig.context.clone());
    let mut app = ClientRuntime::new(rig.context.clone(), AreaMode::Connected);
    let mut writer = LostAnswer {
        port: rig.port.clone(),
        lose: true,
    };
    let mut journal = rig.port.clone();
    assert!(matches!(
        rig.run(&mut app, &mut writer, &mut journal, &scope),
        RuntimeOutcome::Dispatch(DispatchResult::Unknown)
    ));
    let ticket = RecoveryJournalPort::load(&journal).unwrap().unwrap();
    let original = ticket.open_original(&rig.protection).unwrap();
    assert_eq!(
        original.identity.operation_id,
        rig.request.context.operation_id
    );
    let raw = rusqlite::Connection::open(&rig.path).unwrap();
    let stored: Vec<u8> = raw
        .query_row("SELECT ticket FROM wimm_native_recovery", [], |r| r.get(0))
        .unwrap();
    let text = String::from_utf8(stored).unwrap();
    assert!(!text.contains("aggregateType"));
    assert!(!text.contains("amount"));
    drop(raw);
    let before = serde_json::to_value(
        rig.port
            .store
            .lock()
            .unwrap()
            .checkpoint_v2(&rig.context.space_id)
            .unwrap(),
    )
    .unwrap();
    drop(app);
    drop(writer);
    drop(journal);
    let reopened = RuntimeStorage::open(&rig.path, rig.context.profile_id.clone()).unwrap();
    let mut writer = reopened.clone();
    let mut journal = reopened.clone();
    let mut app = ClientRuntime::new(rig.context.clone(), AreaMode::Connected);
    let mut ports = RuntimePorts {
        reader: &reopened,
        storage: &mut writer,
        journal: &mut journal,
        protection: &rig.protection,
        scope: &scope,
        cancellation: &NeverCancel,
    };
    committed(app.resolve(&mut ports));
    assert!(RecoveryJournalPort::load(&journal).unwrap().is_none());
    assert_eq!(app.history_available(), (false, false));
    let after = serde_json::to_value(
        reopened
            .store
            .lock()
            .unwrap()
            .checkpoint_v2(&rig.context.space_id)
            .unwrap(),
    )
    .unwrap();
    assert_eq!(after["snapshot"], before["snapshot"]);
    assert_eq!(after["operations"], before["operations"]);
}
#[test]
fn runtime_reader_uses_restored_local_epoch_without_changing_server_scope() {
    let mut rig = Rig::new();
    {
        let mut dal = rig.port.store.lock().unwrap();
        let snapshot = dal.export_snapshot(&rig.context.space_id).unwrap();
        dal.save_sync_page(SyncPage {
            state: SyncState {
                profile_id: rig.context.profile_id.clone(),
                space_id: rig.context.space_id.clone(),
                epoch: rig.context.epoch.clone(),
                cursor: "9".into(),
            },
            confirmed: snapshot
                .aggregates
                .into_iter()
                .map(|aggregate| ConfirmedAggregate {
                    space_id: rig.context.space_id.clone(),
                    epoch: rig.context.epoch.clone(),
                    aggregate,
                })
                .collect(),
            remove_operation_ids: vec![],
            projections: vec![],
        })
        .unwrap();
    }
    let expected = rig
        .port
        .store
        .lock()
        .unwrap()
        .checkpoint_v2(&rig.context.space_id)
        .unwrap();
    let proof = rig
        .port
        .store
        .lock()
        .unwrap()
        .backup_checkpoint_v2(&rig.context.space_id, &rig.protection, &rig.backup)
        .unwrap();
    let target = expected.clone();
    rig.port
        .store
        .lock()
        .unwrap()
        .restore_checkpoint_v2(
            LocalCheckpointRestoreV2 {
                expected,
                original_backup: proof,
                ciphertext: rig.protection.seal(target).unwrap(),
                restored_local_epoch: id(99),
            },
            &rig.protection,
            &rig.backup,
            &NeverCancel,
        )
        .unwrap();
    let actual = MutationReadPort::load(&rig.port, &rig.context).unwrap();
    assert_eq!(actual.context.epoch, id(99));
    let server = rig
        .port
        .store
        .lock()
        .unwrap()
        .export_snapshot(&rig.context.space_id)
        .unwrap();
    assert_eq!(server.epoch, id(3));
    assert_eq!(server.sync_state.unwrap().cursor, "9");
    assert!(server.confirmed.iter().all(|a| a.epoch == id(3)));
    let stale = rig.context.clone();
    rig.context.epoch = id(99);
    let scope = Scope(rig.context.clone());
    let mut writer = rig.port.clone();
    let mut journal = rig.port.clone();
    let mut app = ClientRuntime::new(stale, AreaMode::Connected);
    assert!(matches!(
        rig.run(&mut app, &mut writer, &mut journal, &scope),
        RuntimeOutcome::Dispatch(DispatchResult::ScopeChanged)
    ));
    let old_scope = Scope(app_context_for_stale(&rig.context));
    let mut stale_app = ClientRuntime::new(old_scope.0.clone(), AreaMode::Connected);
    assert!(matches!(
        rig.run(&mut stale_app, &mut writer, &mut journal, &old_scope),
        RuntimeOutcome::Dispatch(DispatchResult::ScopeChanged)
    ));
    let mut app = ClientRuntime::new(rig.context.clone(), AreaMode::Connected);
    committed(rig.run(&mut app, &mut writer, &mut journal, &scope));
}
#[test]
fn native_runtime_wrong_key_retains_real_original_journal_and_blocks_followup() {
    let rig = Rig::new();
    let scope = Scope(rig.context.clone());
    let mut app = ClientRuntime::new(rig.context.clone(), AreaMode::Connected);
    let mut writer = LostAnswer {
        port: rig.port.clone(),
        lose: true,
    };
    let mut journal = rig.port.clone();
    assert!(matches!(
        rig.run(&mut app, &mut writer, &mut journal, &scope),
        RuntimeOutcome::Dispatch(DispatchResult::Unknown)
    ));
    let original = rig
        .port
        .store
        .lock()
        .unwrap()
        .load_recovery()
        .unwrap()
        .unwrap();
    let wrong =
        RuntimeProtection::new(wimm_client_crypto::SecretKey::from_bytes(&[99; 32]).unwrap());
    let mut app = ClientRuntime::new(rig.context.clone(), AreaMode::Connected);
    let mut writer = rig.port.clone();
    let mut ports = RuntimePorts {
        reader: &rig.port,
        storage: &mut writer,
        journal: &mut journal,
        protection: &wrong,
        scope: &scope,
        cancellation: &NeverCancel,
    };
    assert!(matches!(
        app.resolve(&mut ports),
        RuntimeOutcome::Dispatch(DispatchResult::Unknown)
    ));
    assert_eq!(
        rig.port
            .store
            .lock()
            .unwrap()
            .load_recovery()
            .unwrap()
            .unwrap(),
        original
    );
    let r = rig.request.clone();
    assert!(matches!(
        app.execute(r.command, r.expected_revisions, r.context, &mut ports),
        RuntimeOutcome::Dispatch(DispatchResult::Busy)
    ));
}
#[test]
fn native_runtime_cross_profile_and_malformed_ticket_never_leak_or_clear_original() {
    let rig = Rig::new();
    let mut wrong = rig.context.clone();
    wrong.profile_id = id(90);
    assert_eq!(
        MutationReadPort::load(&rig.port, &wrong)
            .err()
            .unwrap()
            .code,
        StorageFailureCode::EpochMismatch
    );
    rig.port
        .store
        .lock()
        .unwrap()
        .save_recovery_if_absent(b"synthetic-not-a-ticket")
        .unwrap();
    assert_eq!(
        RecoveryJournalPort::load(&rig.port).err().unwrap().code,
        StorageFailureCode::InvalidResponse
    );
    assert_eq!(
        rig.port
            .store
            .lock()
            .unwrap()
            .load_recovery()
            .unwrap()
            .unwrap(),
        b"synthetic-not-a-ticket"
    );
}

fn app_context_for_stale(context: &CommitContext) -> CommitContext {
    let mut stale = context.clone();
    stale.epoch = id(3);
    stale
}
#[test]
fn child_native_runtime_resolves_real_recovery_ticket_without_financial_replay() {
    let Some(path) = std::env::var_os("WIMM_NATIVE_RUNTIME_RECOVERY") else {
        return;
    };
    let port = RuntimeStorage::open(std::path::Path::new(&path), id(1)).unwrap();
    let ticket = RecoveryJournalPort::load(&port).unwrap().unwrap();
    let context = ticket.context().clone();
    let scope = Scope(context.clone());
    let protection =
        RuntimeProtection::new(wimm_client_crypto::SecretKey::from_bytes(&[42; 32]).unwrap());
    let before = port
        .store
        .lock()
        .unwrap()
        .checkpoint_v2(&context.space_id)
        .unwrap();
    let mut app = ClientRuntime::new(context.clone(), AreaMode::Connected);
    let mut writer = port.clone();
    let mut journal = port.clone();
    let mut ports = RuntimePorts {
        reader: &port,
        storage: &mut writer,
        journal: &mut journal,
        protection: &protection,
        scope: &scope,
        cancellation: &NeverCancel,
    };
    committed(app.resolve(&mut ports));
    let after = port
        .store
        .lock()
        .unwrap()
        .checkpoint_v2(&context.space_id)
        .unwrap();
    assert_eq!(
        serde_json::to_value(before.snapshot).unwrap(),
        serde_json::to_value(after.snapshot).unwrap()
    );
    assert_eq!(
        serde_json::to_value(before.operations).unwrap(),
        serde_json::to_value(after.operations).unwrap()
    );
    assert!(RecoveryJournalPort::load(&journal).unwrap().is_none());
    assert_eq!(app.history_available(), (false, false));
}
#[test]
fn full_native_runtime_process_restart_recovers_sqlite_ticket_and_exact_receipt() {
    let rig = Rig::new();
    let scope = Scope(rig.context.clone());
    let mut app = ClientRuntime::new(rig.context.clone(), AreaMode::Connected);
    let mut writer = LostAnswer {
        port: rig.port.clone(),
        lose: true,
    };
    let mut journal = rig.port.clone();
    assert!(matches!(
        rig.run(&mut app, &mut writer, &mut journal, &scope),
        RuntimeOutcome::Dispatch(DispatchResult::Unknown)
    ));
    drop(app);
    drop(writer);
    drop(journal);
    let result = std::process::Command::new(std::env::current_exe().unwrap())
        .args([
            "--exact",
            "tests::child_native_runtime_resolves_real_recovery_ticket_without_financial_replay",
            "--nocapture",
        ])
        .env("WIMM_NATIVE_RUNTIME_RECOVERY", &rig.path)
        .output()
        .unwrap();
    assert!(
        result.status.success(),
        "{}",
        String::from_utf8_lossy(&result.stderr)
    );
    assert!(String::from_utf8_lossy(&result.stdout).contains("1 passed"));
    assert!(RecoveryJournalPort::load(&rig.port).unwrap().is_none());
}

#[test]
fn shared_session_versions_execute_and_bounded_page_use_real_sqlite_receipt() {
    use wimm_client_application::runtime_contracts::*;
    let rig = Rig::new();
    let protection =
        RuntimeProtection::new(wimm_client_crypto::SecretKey::from_bytes(&[42; 32]).unwrap());
    let mut session = RuntimeSession::new(
        rig.context.clone(),
        AreaMode::Connected,
        rig.port.clone(),
        protection,
    )
    .unwrap();
    let action = RuntimeActionV2::Execute {
        command: rig.request.command.clone(),
        expected_revisions: rig.request.expected_revisions.clone(),
        operation: rig.request.context.clone(),
    };
    assert!(matches!(
        session
            .invoke(RuntimeRequestV2 {
                contract_version: 1,
                domain_schema_version: 1,
                action: action.clone()
            })
            .result,
        RuntimeResultV2::Rejected { .. }
    ));
    assert!(RecoveryJournalPort::load(&rig.port).unwrap().is_none());
    let event = session.invoke(RuntimeRequestV2 {
        contract_version: 2,
        domain_schema_version: 1,
        action,
    });
    let RuntimeResultV2::Committed {
        receipt,
        current: true,
        ..
    } = event.result
    else {
        panic!("Echtes Receipt fehlt")
    };
    assert!(event.can_undo);
    assert_eq!(
        rig.port
            .lookup_result(&receipt.identity)
            .unwrap()
            .unwrap()
            .content_hash,
        receipt.content_hash
    );
    assert!(RecoveryJournalPort::load(&rig.port).unwrap().is_none());
    assert!(!session.page(0, 100).unwrap().aggregates.is_empty());
    assert!(session.page(0, 101).is_err());
}
#[test]
fn bounded_client_sessions_keep_independent_history_and_reject_duplicate_or_seventeenth_owner() {
    let rig = Rig::new();
    let mut sessions = RuntimeSessions::default();
    let create = || {
        RuntimeSession::new(
            rig.context.clone(),
            AreaMode::Connected,
            rig.port.clone(),
            RuntimeProtection::new(wimm_client_crypto::SecretKey::from_bytes(&[42; 32]).unwrap()),
        )
        .unwrap()
    };
    for n in 1..=16 {
        sessions.insert(id(n), create()).unwrap();
    }
    assert!(sessions.is_full());
    assert!(sessions.insert(id(17), create()).is_err());
    assert!(sessions.insert(id(1), create()).is_err());
    let action = wimm_client_application::runtime_contracts::RuntimeActionV2::Execute {
        command: rig.request.command.clone(),
        expected_revisions: rig.request.expected_revisions.clone(),
        operation: rig.request.context.clone(),
    };
    let event = sessions.get_mut(&id(1)).unwrap().invoke(
        wimm_client_application::runtime_contracts::RuntimeRequestV2 {
            contract_version: 2,
            domain_schema_version: 1,
            action,
        },
    );
    assert!(event.can_undo);
    let other = sessions.get_mut(&id(2)).unwrap().invoke(
        wimm_client_application::runtime_contracts::RuntimeRequestV2 {
            contract_version: 2,
            domain_schema_version: 1,
            action: wimm_client_application::runtime_contracts::RuntimeActionV2::Load,
        },
    );
    assert!(!other.can_undo && !other.can_redo);
    sessions.remove(&id(1));
    assert!(sessions.get(&id(1)).is_none());
    assert!(sessions.get(&id(2)).is_some());
    sessions.insert(id(17), create()).unwrap();
    sessions.clear();
    assert!(!sessions.is_full());
    assert!(sessions.get(&id(2)).is_none());
}
