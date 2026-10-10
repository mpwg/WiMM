// SPDX-License-Identifier: AGPL-3.0-or-later
//! Bindingadapter koordinieren keine Finanzregeln; sämtliche Aktionen gehen durch ClientRuntime.
use wimm_client_application::{dispatch::*, recovery::*, runtime::*, runtime_contracts::*, *};
use wimm_finance_types::{ContractError, scalars::EntityId};
use wimm_local_contracts::{
    commit::*,
    persistence_errors::*,
    storage_port::{CancellationPort, SnapshotProtectionPort},
};
pub(crate) trait RuntimeHost {
    fn load(&self, context: CommitContext) -> Result<RuntimeSnapshotV2, ContractError>;
    fn commit(
        &self,
        request: LocalCommitRequest,
        context: CommitContext,
        cancelled: bool,
    ) -> Result<RuntimeCommitResultV2, ContractError>;
    fn lookup(
        &self,
        identity: LocalOperationIdentity,
    ) -> Result<Option<LocalCommitReceipt>, ContractError>;
    fn journal_load(&self) -> Result<Vec<u8>, ContractError>;
    fn journal_save(&self, bytes: Vec<u8>) -> Result<bool, ContractError>;
    fn journal_clear(&self, bytes: Vec<u8>) -> Result<bool, ContractError>;
    fn seal(&self, request: LocalCommitRequest) -> Result<Vec<u8>, ContractError>;
    fn unseal(&self, bytes: Vec<u8>) -> Result<LocalCommitRequest, ContractError>;
    fn current(&self) -> Result<CommitContext, ContractError>;
    fn cancelled(&self) -> Result<bool, ContractError>;
}
fn failure() -> StorageFailure {
    StorageFailure::unknown(StorageFailureCode::InvalidResponse)
}
struct Adapter<'a>(&'a dyn RuntimeHost, &'a CommitContext);
impl MutationReadPort for Adapter<'_> {
    fn load(&self, ctx: &CommitContext) -> Result<MutationSnapshot, StorageFailure> {
        let s = self.0.load(ctx.clone()).map_err(|_| failure())?;
        if s.contract_version != 2 {
            return Err(failure());
        }
        Ok(MutationSnapshot {
            context: s.context,
            aggregates: s.aggregates,
        })
    }
}
impl LocalCommitPort for Adapter<'_> {
    fn commit(&mut self, r: LocalCommitRequest) -> LocalCommitOutcome {
        self.commit_cancellable(r, &Adapter(self.0, self.1))
    }
    fn lookup_result(
        &self,
        id: &LocalOperationIdentity,
    ) -> Result<Option<LocalCommitReceipt>, StorageFailure> {
        self.0.lookup(id.clone()).map_err(|_| failure())
    }
}
impl CancellableLocalCommitPort for Adapter<'_> {
    fn commit_cancellable(
        &mut self,
        r: LocalCommitRequest,
        c: &dyn CancellationPort,
    ) -> LocalCommitOutcome {
        let identity = r.identity.clone();
        match self.0.commit(r, self.1.clone(), c.is_cancelled()) {
            Ok(RuntimeCommitResultV2::Committed { receipt }) => {
                LocalCommitOutcome::Committed { value: receipt }
            }
            Ok(RuntimeCommitResultV2::NotCommitted { error }) => {
                LocalCommitOutcome::NotCommitted { error }
            }
            Ok(RuntimeCommitResultV2::Unknown { identity }) => {
                LocalCommitOutcome::Unknown { identity }
            }
            Err(_) => LocalCommitOutcome::Unknown { identity },
        }
    }
}
impl RecoveryJournalPort for Adapter<'_> {
    fn load(&self) -> Result<Option<RecoveryTicket>, StorageFailure> {
        let bytes = self.0.journal_load().map_err(|_| failure())?;
        if bytes.is_empty() {
            Ok(None)
        } else {
            serde_json::from_slice(&bytes)
                .map(Some)
                .map_err(|_| failure())
        }
    }
    fn save_if_absent(&mut self, t: &RecoveryTicket) -> Result<(), StorageFailure> {
        let bytes = serde_json::to_vec(t).map_err(|_| failure())?;
        if self.0.journal_save(bytes).map_err(|_| failure())? {
            Ok(())
        } else {
            Err(failure())
        }
    }
    fn clear(&mut self, t: &RecoveryTicket) -> Result<(), StorageFailure> {
        let bytes = serde_json::to_vec(t).map_err(|_| failure())?;
        if self.0.journal_clear(bytes).map_err(|_| failure())? {
            Ok(())
        } else {
            Err(failure())
        }
    }
}
impl SnapshotProtectionPort<LocalCommitRequest> for Adapter<'_> {
    type Error = StorageFailure;
    fn seal(&self, r: LocalCommitRequest) -> Result<Vec<u8>, StorageFailure> {
        self.0.seal(r).map_err(|_| failure())
    }
    fn unseal(&self, b: &[u8]) -> Result<LocalCommitRequest, StorageFailure> {
        self.0.unseal(b.to_vec()).map_err(|_| failure())
    }
}
impl CommitContextPort for Adapter<'_> {
    fn current(&self) -> CommitContext {
        self.0.current().unwrap_or_else(|_| {
            let mut ctx = self.1.clone();
            let other = EntityId::new("50000000-0000-4000-8000-000000000099".into())
                .expect("Statische UUID");
            ctx.epoch = if ctx.epoch == other {
                EntityId::new("50000000-0000-4000-8000-000000000098".into())
                    .expect("Statische UUID")
            } else {
                other
            };
            ctx
        })
    }
}
impl CancellationPort for Adapter<'_> {
    fn is_cancelled(&self) -> bool {
        self.0.cancelled().unwrap_or(true)
    }
}
pub(crate) struct Session {
    pub context: CommitContext,
    pub runtime: Option<ClientRuntime>,
}
impl Session {
    pub fn new(context: CommitContext, mode: AreaMode) -> Self {
        Self {
            runtime: Some(ClientRuntime::new(context.clone(), mode)),
            context,
        }
    }
    fn event(&self, result: RuntimeResultV2) -> RuntimeEventV2 {
        let (can_undo, can_redo) = self
            .runtime
            .as_ref()
            .map(ClientRuntime::history_available)
            .unwrap_or_default();
        RuntimeEventV2 {
            contract_version: 2,
            context: self.context.clone(),
            can_undo,
            can_redo,
            result,
        }
    }
    pub fn invoke(&mut self, input: RuntimeRequestV2, host: &dyn RuntimeHost) -> RuntimeEventV2 {
        if self.runtime.is_none() {
            return self.event(RuntimeResultV2::Closed);
        }
        if input.contract_version != 2 || input.domain_schema_version != 1 {
            return self.event(RuntimeResultV2::Rejected {
                code: api::ApplicationFailureCode::UpdateRequired,
                finance_code: None,
            });
        }
        let reader = Adapter(host, &self.context);
        let mut storage = Adapter(host, &self.context);
        let mut journal = Adapter(host, &self.context);
        let protection = Adapter(host, &self.context);
        let scope = Adapter(host, &self.context);
        let cancel = Adapter(host, &self.context);
        let mut ports = RuntimePorts {
            reader: &reader,
            storage: &mut storage,
            journal: &mut journal,
            protection: &protection,
            scope: &scope,
            cancellation: &cancel,
        };
        let runtime = self.runtime.as_mut().expect("Geöffnete Runtime");
        let result = match input.action {
            RuntimeActionV2::Load => runtime.load(&ports),
            RuntimeActionV2::Execute {
                command,
                expected_revisions,
                operation,
            } => runtime.execute(command, expected_revisions, operation, &mut ports),
            RuntimeActionV2::History {
                direction,
                operation,
            } => runtime.move_history(direction, operation, &mut ports),
            RuntimeActionV2::Resolve => runtime.resolve(&mut ports),
        };
        self.event(result.into())
    }
    pub fn page(
        &self,
        offset: u32,
        limit: u32,
        host: &dyn RuntimeHost,
    ) -> Result<RuntimePageV2, ContractError> {
        let runtime = self
            .runtime
            .as_ref()
            .ok_or_else(ContractError::invalid_command)?;
        let scope = Adapter(host, &self.context);
        let aggregates = runtime
            .page(&scope, offset as usize, limit as usize)
            .map_err(|_| ContractError::invalid_command())?;
        Ok(RuntimePageV2 {
            contract_version: 2,
            context: self.context.clone(),
            offset,
            aggregates,
        })
    }
    pub fn close(&mut self) -> RuntimeEventV2 {
        self.runtime = None;
        self.event(RuntimeResultV2::Closed)
    }
}
