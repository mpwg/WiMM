// SPDX-License-Identifier: AGPL-3.0-or-later
#![forbid(unsafe_code)]
// Gemeinsamer Testconsumer wird von mehreren getrennten Integrationsbinaries verwendet.
#![allow(dead_code)]
use std::{
    cell::Cell,
    path::{Path, PathBuf},
};
use wimm_client_application::CoreSnapshotValidator;
use wimm_finance_types::scalars::EntityId;
use wimm_local_contracts::{commit::*, persistence_errors::*, storage::*, storage_port::*};
use wimm_local_dal::sqlite::{SqliteStore, SqliteWriter};
#[derive(Clone, Copy, PartialEq, Eq)]
pub enum CommitBoundary {
    AfterWrites,
    AfterCommit,
}
pub struct CurrentSqlite {
    writer: SqliteWriter<CoreSnapshotValidator>,
    path: PathBuf,
    fail_write: bool,
    lose_response: bool,
    observer: Option<Box<dyn Fn(CommitBoundary)>>,
}
impl CurrentSqlite {
    pub fn create(path: &Path, profile: EntityId) -> Result<Self, StorageFailure> {
        SqliteStore::initialize_empty_file(path)?;
        Self::open(path, profile)
    }
    pub fn open(path: &Path, profile: EntityId) -> Result<Self, StorageFailure> {
        Ok(Self {
            writer: SqliteWriter::open(path, profile, CoreSnapshotValidator)?,
            path: path.to_owned(),
            fail_write: false,
            lose_response: false,
            observer: None,
        })
    }
    pub fn initialize_area(
        &mut self,
        space: &EntityId,
        epoch: &EntityId,
    ) -> Result<EntityId, StorageFailure> {
        self.writer.initialize_area(space, epoch)
    }
    pub fn read_aggregate(&self, id: &EntityId) -> Result<Option<StoredAggregate>, StorageFailure> {
        self.writer.read_aggregate(id)
    }
    pub fn read_pending(&self, space: &EntityId) -> Result<Vec<PendingOperation>, StorageFailure> {
        self.writer.load_pending(space)
    }
    pub fn read_projections(
        &self,
        space: &EntityId,
    ) -> Result<Vec<StoredProjection>, StorageFailure> {
        Ok(self.writer.export_snapshot(space)?.projections)
    }
    pub fn snapshot(&self, space: &EntityId) -> Result<LocalSnapshot, StorageFailure> {
        self.writer.export_snapshot(space)
    }
    pub fn observe_commit(&mut self, observer: impl Fn(CommitBoundary) + 'static) {
        self.observer = Some(Box::new(observer));
    }
    pub fn inject_write_failure(&mut self) {
        self.fail_write = true;
    }
    pub fn lose_next_response(&mut self) {
        self.lose_response = true;
    }
}
struct ObserveCancellation<'a> {
    original: &'a dyn CancellationPort,
    observer: Option<&'a dyn Fn(CommitBoundary)>,
    calls: Cell<usize>,
    path: &'a Path,
}
impl CancellationPort for ObserveCancellation<'_> {
    fn is_cancelled(&self) -> bool {
        let calls = self.calls.get() + 1;
        self.calls.set(calls);
        // Zweite Abbruchgrenze des aktuellen Writers liegt nach tatsächlichen Batchwrites vor Receipt/COMMIT.
        if calls == 2
            && let Some(observer) = self.observer
        {
            let journal = std::path::PathBuf::from(format!("{}-journal", self.path.display()));
            assert!(
                std::fs::metadata(journal).unwrap().len() > 0,
                "Reale SQL-Writes benötigen tatsächliches Rollbackjournal vor dem Scopewechsel"
            );
            observer(CommitBoundary::AfterWrites);
        }
        self.original.is_cancelled()
    }
}
impl LocalCommitPort for CurrentSqlite {
    fn commit(&mut self, request: LocalCommitRequest) -> LocalCommitOutcome {
        self.commit_cancellable(request, &NeverCancel)
    }
    fn lookup_result(
        &self,
        id: &LocalOperationIdentity,
    ) -> Result<Option<LocalCommitReceipt>, StorageFailure> {
        self.writer.lookup_result(id)
    }
}
impl CancellableLocalCommitPort for CurrentSqlite {
    fn commit_cancellable(
        &mut self,
        mut request: LocalCommitRequest,
        cancel: &dyn CancellationPort,
    ) -> LocalCommitOutcome {
        let identity = request.identity.clone();
        if std::mem::take(&mut self.fail_write) {
            // Gezielt ungültiger letzter Handle: reale vorangehende SQL-Writes müssen durch denselben ORM-Writer zurückrollen.
            let mut bad = request
                .batch
                .aggregates
                .first()
                .expect("Synthetischer Schreibfall benötigt Aggregate")
                .clone();
            bad.handle = EntityId::new("70000000-0000-4000-8000-000000099999".into()).unwrap();
            assert!(
                !request
                    .batch
                    .aggregates
                    .iter()
                    .any(|entry| entry.handle == bad.handle)
            );
            request.batch.aggregates.push(bad);
        }
        let guard = ObserveCancellation {
            original: cancel,
            observer: self.observer.as_deref(),
            calls: Cell::new(0),
            path: &self.path,
        };
        let result = self.writer.commit_cancellable(request, &guard);
        if matches!(result, LocalCommitOutcome::Committed { .. }) {
            if let Some(observer) = &self.observer {
                observer(CommitBoundary::AfterCommit);
            }
            if std::mem::take(&mut self.lose_response) {
                return LocalCommitOutcome::Unknown { identity };
            }
        }
        result
    }
}
