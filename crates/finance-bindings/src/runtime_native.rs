// SPDX-License-Identifier: AGPL-3.0-or-later
use crate::runtime_bridge::{RuntimeHost, Session};
use std::sync::{Arc, Mutex};
use wimm_client_application::{AreaMode, CommitContext, runtime_contracts::*};
use wimm_finance_types::ContractError;
use wimm_local_contracts::commit::*;
#[derive(Debug, uniffi::Error)]
pub enum RuntimePortError {
    Failed,
}
impl std::fmt::Display for RuntimePortError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str("Die Plattformantwort ist ungültig.")
    }
}
impl std::error::Error for RuntimePortError {}
impl From<uniffi::UnexpectedUniFFICallbackError> for RuntimePortError {
    fn from(_: uniffi::UnexpectedUniFFICallbackError) -> Self {
        Self::Failed
    }
}
#[uniffi::export(callback_interface)]
pub trait NativeRuntimeHost: Send + Sync {
    fn load(&self, context: CommitContext) -> Result<RuntimeSnapshotV2, RuntimePortError>;
    fn commit(
        &self,
        request: LocalCommitRequest,
        context: CommitContext,
        cancelled: bool,
    ) -> Result<RuntimeCommitResultV2, RuntimePortError>;
    fn lookup(
        &self,
        identity: LocalOperationIdentity,
    ) -> Result<Option<LocalCommitReceipt>, RuntimePortError>;
    fn journal_load(&self) -> Result<Vec<u8>, RuntimePortError>;
    fn journal_save(&self, bytes: Vec<u8>) -> Result<bool, RuntimePortError>;
    fn journal_clear(&self, bytes: Vec<u8>) -> Result<bool, RuntimePortError>;
    fn seal(&self, request: LocalCommitRequest) -> Result<Vec<u8>, RuntimePortError>;
    fn unseal(&self, bytes: Vec<u8>) -> Result<LocalCommitRequest, RuntimePortError>;
    fn current(&self) -> Result<CommitContext, RuntimePortError>;
    fn cancelled(&self) -> Result<bool, RuntimePortError>;
}
struct Host(Arc<dyn NativeRuntimeHost>);
impl RuntimeHost for Host {
    fn load(&self, c: CommitContext) -> Result<RuntimeSnapshotV2, ContractError> {
        self.0.load(c).map_err(|_| ContractError::invalid_command())
    }
    fn commit(
        &self,
        r: LocalCommitRequest,
        context: CommitContext,
        c: bool,
    ) -> Result<RuntimeCommitResultV2, ContractError> {
        self.0
            .commit(r, context, c)
            .map_err(|_| ContractError::invalid_command())
    }
    fn lookup(
        &self,
        i: LocalOperationIdentity,
    ) -> Result<Option<LocalCommitReceipt>, ContractError> {
        self.0
            .lookup(i)
            .map_err(|_| ContractError::invalid_command())
    }
    fn journal_load(&self) -> Result<Vec<u8>, ContractError> {
        self.0
            .journal_load()
            .map_err(|_| ContractError::invalid_command())
    }
    fn journal_save(&self, b: Vec<u8>) -> Result<bool, ContractError> {
        self.0
            .journal_save(b)
            .map_err(|_| ContractError::invalid_command())
    }
    fn journal_clear(&self, b: Vec<u8>) -> Result<bool, ContractError> {
        self.0
            .journal_clear(b)
            .map_err(|_| ContractError::invalid_command())
    }
    fn seal(&self, r: LocalCommitRequest) -> Result<Vec<u8>, ContractError> {
        self.0.seal(r).map_err(|_| ContractError::invalid_command())
    }
    fn unseal(&self, b: Vec<u8>) -> Result<LocalCommitRequest, ContractError> {
        self.0
            .unseal(b)
            .map_err(|_| ContractError::invalid_command())
    }
    fn current(&self) -> Result<CommitContext, ContractError> {
        self.0
            .current()
            .map_err(|_| ContractError::invalid_command())
    }
    fn cancelled(&self) -> Result<bool, ContractError> {
        self.0
            .cancelled()
            .map_err(|_| ContractError::invalid_command())
    }
}
struct State {
    session: Session,
    host: Option<Host>,
}
#[derive(uniffi::Object)]
pub struct RuntimeSessionV2 {
    state: Mutex<State>,
}
#[uniffi::export]
impl RuntimeSessionV2 {
    #[uniffi::constructor]
    pub fn new(
        context: CommitContext,
        mode: AreaMode,
        host: Box<dyn NativeRuntimeHost>,
    ) -> Arc<Self> {
        Arc::new(Self {
            state: Mutex::new(State {
                session: Session::new(context, mode),
                host: Some(Host(Arc::from(host))),
            }),
        })
    }
    pub fn invoke(&self, input: RuntimeRequestV2) -> Result<RuntimeEventV2, ContractError> {
        let mut state = self.state.try_lock().map_err(|_| {
            ContractError::from(("BUSY", "Die Runtime verarbeitet bereits einen Aufruf."))
        })?;
        let State { session, host } = &mut *state;
        match host {
            Some(host) => Ok(session.invoke(input, host)),
            None => Ok(session.close()),
        }
    }
    pub fn page(&self, offset: u32, limit: u32) -> Result<RuntimePageV2, ContractError> {
        let state = self
            .state
            .try_lock()
            .map_err(|_| ContractError::invalid_command())?;
        state.session.page(
            offset,
            limit,
            state
                .host
                .as_ref()
                .ok_or_else(ContractError::invalid_command)?,
        )
    }
    pub fn shutdown(&self) -> Result<RuntimeEventV2, ContractError> {
        let mut state = self
            .state
            .try_lock()
            .map_err(|_| ContractError::invalid_command())?;
        state.host = None;
        Ok(state.session.close())
    }
}
