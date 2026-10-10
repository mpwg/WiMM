// SPDX-License-Identifier: AGPL-3.0-or-later
//! Gemeinsame Sitzung koordiniert vollständigen Bestand, Kern, Commit und Historie.
use crate::{dispatch::*, history::*, recovery::*, *};
use wimm_finance_types::{
    command_contracts::{Context, Expectation, Request},
    models::{Aggregate, Command},
    state_contracts::ValidationRequest,
};
use wimm_local_contracts::{
    commit::*,
    persistence_errors::*,
    storage_port::{CancellationPort, SnapshotProtectionPort},
};
/// Adapter liefert einen vollständigen konsistenten entschlüsselten Mutationsbestand.
pub struct MutationSnapshot {
    pub context: CommitContext,
    pub aggregates: Vec<Aggregate>,
}
pub trait MutationReadPort {
    fn load(&self, context: &CommitContext) -> Result<MutationSnapshot, StorageFailure>;
}
pub struct RuntimePorts<'a> {
    pub reader: &'a dyn MutationReadPort,
    pub storage: &'a mut dyn CancellableLocalCommitPort,
    pub journal: &'a mut dyn RecoveryJournalPort,
    pub protection: &'a dyn SnapshotProtectionPort<LocalCommitRequest, Error = StorageFailure>,
    pub scope: &'a dyn CommitContextPort,
    pub cancellation: &'a dyn CancellationPort,
}
pub enum RuntimeOutcome {
    Dispatch(DispatchResult),
    PreparationRejected(PreparationFailure),
    ReadFailed(StorageFailure),
    Unchanged,
}
enum PendingAction {
    Command(Box<PreparedCommit>),
    History(Box<HistoryMove>),
}
impl PendingAction {
    fn prepared(&self) -> &PreparedCommit {
        match self {
            Self::Command(p) => p,
            Self::History(m) => m.prepared(),
        }
    }
}
/// Keine Finanzdaten in Debug-/Fehlermeldungen, kein Speicherbackend im Dienst.
pub struct ClientRuntime {
    context: CommitContext,
    mode: AreaMode,
    locally_committed: Vec<Aggregate>,
    history: FinanceHistory,
    pending: Option<PendingAction>,
    pipeline: DurableCommitPipeline,
}
impl ClientRuntime {
    pub fn new(context: CommitContext, mode: AreaMode) -> Self {
        Self {
            history: FinanceHistory::new(context.clone()),
            context,
            mode,
            locally_committed: vec![],
            pending: None,
            pipeline: DurableCommitPipeline,
        }
    }
    pub fn history_available(&self) -> (bool, bool) {
        (self.history.can_undo(), self.history.can_redo())
    }
    /// Begrenzte lokal per Receipt gespeicherte Seite; keine Serverbestätigung. Index-/Queryoptimierung bleibt #121.
    pub fn page(
        &self,
        scope: &dyn CommitContextPort,
        offset: usize,
        limit: usize,
    ) -> Result<Vec<Aggregate>, PreparationFailure> {
        if !self.context.is_current(&scope.current()) {
            return Err(PreparationFailure::ScopeChanged);
        }
        if limit > 100 {
            return Err(PreparationFailure::InvalidState);
        }
        Ok(self
            .locally_committed
            .iter()
            .skip(offset)
            .take(limit)
            .cloned()
            .collect())
    }
    pub fn load(&mut self, ports: &RuntimePorts<'_>) -> RuntimeOutcome {
        match self.read(ports) {
            Ok(state) => {
                self.locally_committed = state;
                RuntimeOutcome::Unchanged
            }
            Err(outcome) => outcome,
        }
    }
    fn read(&self, ports: &RuntimePorts<'_>) -> Result<Vec<Aggregate>, RuntimeOutcome> {
        if self.pending.is_some() {
            return Err(RuntimeOutcome::Dispatch(DispatchResult::Busy));
        }
        if !self.context.is_current(&ports.scope.current()) {
            return Err(RuntimeOutcome::Dispatch(DispatchResult::ScopeChanged));
        }
        match ports.journal.load() {
            Ok(None) => {}
            Ok(Some(_)) => return Err(RuntimeOutcome::Dispatch(DispatchResult::Busy)),
            Err(error) => return Err(RuntimeOutcome::ReadFailed(error)),
        }
        let state = ports
            .reader
            .load(&self.context)
            .map_err(RuntimeOutcome::ReadFailed)?;
        if !state.context.is_current(&self.context)
            || !self.context.is_current(&ports.scope.current())
        {
            return Err(RuntimeOutcome::Dispatch(DispatchResult::ScopeChanged));
        }
        wimm_finance_core::validate(ValidationRequest::Historical {
            contract_version: 1.into(),
            domain_schema_version: 1.into(),
            space_id: self.context.space_id.clone(),
            aggregates: state.aggregates.clone(),
        })
        .map_err(|(code, _)| {
            RuntimeOutcome::PreparationRejected(PreparationFailure::FinanceRejected(code))
        })?;
        Ok(state.aggregates)
    }
    pub fn execute(
        &mut self,
        command: Command,
        expected_revisions: Vec<Expectation>,
        operation: Context,
        ports: &mut RuntimePorts<'_>,
    ) -> RuntimeOutcome {
        let state = match self.read(ports) {
            Ok(state) => state,
            Err(outcome) => return outcome,
        };
        self.locally_committed = state.clone();
        let request = Request {
            contract_version: 1.into(),
            domain_schema_version: 1.into(),
            space_id: self.context.space_id.clone(),
            aggregates: state,
            command,
            expected_revisions,
            context: operation,
        };
        let prepared =
            match prepare_command(request, &self.context, &ports.scope.current(), self.mode) {
                Ok(Some(p)) => p,
                Ok(None) => return RuntimeOutcome::Unchanged,
                Err(error) => return RuntimeOutcome::PreparationRejected(error),
            };
        self.dispatch(PendingAction::Command(Box::new(prepared)), ports)
    }
    pub fn move_history(
        &mut self,
        direction: Direction,
        operation: Context,
        ports: &mut RuntimePorts<'_>,
    ) -> RuntimeOutcome {
        let state = match self.read(ports) {
            Ok(state) => state,
            Err(outcome) => return outcome,
        };
        self.locally_committed = state.clone();
        let movement = match self.history.prepare_move(
            direction,
            state,
            operation,
            &ports.scope.current(),
            self.mode,
        ) {
            Ok(Some(m)) => m,
            Ok(None) => return RuntimeOutcome::Unchanged,
            Err(HistoryFailure::Preparation(error)) => {
                return RuntimeOutcome::PreparationRejected(error);
            }
            Err(_) => return RuntimeOutcome::Dispatch(DispatchResult::ScopeChanged),
        };
        self.dispatch(PendingAction::History(Box::new(movement)), ports)
    }
    fn dispatch(&mut self, action: PendingAction, ports: &mut RuntimePorts<'_>) -> RuntimeOutcome {
        let result = self.pipeline.dispatch(
            action.prepared().clone(),
            ports.storage,
            ports.journal,
            ports.protection,
            ports.scope,
            ports.cancellation,
        );
        self.finish(action, result, ports.scope)
    }
    pub fn resolve(&mut self, ports: &mut RuntimePorts<'_>) -> RuntimeOutcome {
        let result =
            self.pipeline
                .resume(ports.storage, ports.journal, ports.protection, ports.scope);
        if let Some(action) = self.pending.take() {
            self.finish(action, result, ports.scope)
        } else {
            RuntimeOutcome::Dispatch(result)
        }
    }
    fn finish(
        &mut self,
        action: PendingAction,
        mut result: DispatchResult,
        scope: &dyn CommitContextPort,
    ) -> RuntimeOutcome {
        if let DispatchResult::Committed { current, .. } = &mut result {
            let now = scope.current();
            *current &= self.context.is_current(&now);
            if *current {
                // Receipt ist bereits inhaltsgebunden geprüft; keine zweite Abfrage/Write nach Commit.
                let prepared = action.prepared();
                let mut state = prepared
                    .before
                    .iter()
                    .map(|a| (a.id().clone(), a.clone()))
                    .collect::<std::collections::BTreeMap<_, _>>();
                for a in &prepared.change.aggregates {
                    state.insert(a.id().clone(), a.clone());
                }
                let history = match &action {
                    PendingAction::Command(p) => self.history.record(p, &result, &now),
                    PendingAction::History(m) => self.history.accept_move(m, &result, &now),
                };
                if history.is_err() {
                    self.history = FinanceHistory::new(self.context.clone());
                }
                self.locally_committed = state.into_values().collect();
            }
        }
        if matches!(result, DispatchResult::Unknown | DispatchResult::Busy) {
            self.pending = Some(action);
        }
        RuntimeOutcome::Dispatch(result)
    }
}
