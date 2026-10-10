// SPDX-License-Identifier: AGPL-3.0-or-later
use crate::runtime_bridge::{RuntimeHost, Session};
use std::cell::RefCell;
use wasm_bindgen::prelude::*;
use wimm_client_application::{AreaMode, CommitContext, runtime_contracts::*};
use wimm_finance_types::ContractError;
use wimm_local_contracts::commit::*;
fn invalid() -> ContractError {
    ContractError::invalid_command()
}
fn error(e: ContractError) -> JsValue {
    crate::wasm_boundary::wasm_error(e)
}
fn decode<T: serde::de::DeserializeOwned>(raw: JsValue) -> Result<T, ContractError> {
    if !wimm_contract_primitives::wasm_data::check(&raw) {
        return Err(invalid());
    }
    let text = js_sys::JSON::stringify(&raw)
        .map_err(|_| invalid())?
        .as_string()
        .ok_or_else(invalid)?;
    serde_json::from_str(&text).map_err(|_| invalid())
}
fn encode<T: serde::Serialize>(v: &T) -> Result<JsValue, ContractError> {
    js_sys::JSON::parse(&serde_json::to_string(v).map_err(|_| invalid())?).map_err(|_| invalid())
}
struct Host(JsValue);
impl Host {
    fn call<T: serde::de::DeserializeOwned>(
        &self,
        name: &str,
        args: &[JsValue],
    ) -> Result<T, ContractError> {
        let function = js_sys::Reflect::get(&self.0, &JsValue::from_str(name))
            .map_err(|_| invalid())?
            .dyn_into::<js_sys::Function>()
            .map_err(|_| invalid())?;
        let array = js_sys::Array::new();
        for arg in args {
            array.push(arg);
        }
        let value = function.apply(&self.0, &array).map_err(|_| invalid())?;
        decode(value)
    }
}
impl RuntimeHost for Host {
    fn load(&self, c: CommitContext) -> Result<RuntimeSnapshotV2, ContractError> {
        self.call("load", &[encode(&c)?])
    }
    fn commit(
        &self,
        r: LocalCommitRequest,
        context: CommitContext,
        c: bool,
    ) -> Result<RuntimeCommitResultV2, ContractError> {
        self.call(
            "commit",
            &[encode(&r)?, encode(&context)?, JsValue::from_bool(c)],
        )
    }
    fn lookup(
        &self,
        i: LocalOperationIdentity,
    ) -> Result<Option<LocalCommitReceipt>, ContractError> {
        self.call("lookup", &[encode(&i)?])
    }
    fn journal_load(&self) -> Result<Vec<u8>, ContractError> {
        self.call("journalLoad", &[])
    }
    fn journal_save(&self, b: Vec<u8>) -> Result<bool, ContractError> {
        self.call("journalSave", &[encode(&b)?])
    }
    fn journal_clear(&self, b: Vec<u8>) -> Result<bool, ContractError> {
        self.call("journalClear", &[encode(&b)?])
    }
    fn seal(&self, r: LocalCommitRequest) -> Result<Vec<u8>, ContractError> {
        self.call("seal", &[encode(&r)?])
    }
    fn unseal(&self, b: Vec<u8>) -> Result<LocalCommitRequest, ContractError> {
        self.call("unseal", &[encode(&b)?])
    }
    fn current(&self) -> Result<CommitContext, ContractError> {
        self.call("current", &[])
    }
    fn cancelled(&self) -> Result<bool, ContractError> {
        self.call("cancelled", &[])
    }
}
struct State {
    session: Session,
    host: Option<Host>,
}
#[wasm_bindgen]
pub struct RuntimeSessionV2 {
    state: RefCell<State>,
}
#[wasm_bindgen]
impl RuntimeSessionV2 {
    #[wasm_bindgen(constructor)]
    pub fn new(
        context: tsify::Ts<CommitContext>,
        mode: tsify::Ts<AreaMode>,
        #[wasm_bindgen(unchecked_param_type = "RuntimeHostV2")] host: JsValue,
    ) -> Result<Self, JsValue> {
        let context = decode(context.js_value()).map_err(error)?;
        let mode = decode(mode.js_value()).map_err(error)?;
        if !host.is_object() || host.is_null() {
            return Err(error(invalid()));
        }
        Ok(Self {
            state: RefCell::new(State {
                session: Session::new(context, mode),
                host: Some(Host(host)),
            }),
        })
    }
    pub fn invoke(
        &self,
        input: tsify::Ts<RuntimeRequestV2>,
    ) -> Result<tsify::Ts<RuntimeEventV2>, JsValue> {
        let input = decode(input.js_value()).map_err(error)?;
        let mut state = self.state.try_borrow_mut().map_err(|_| error(invalid()))?;
        let State { session, host } = &mut *state;
        let event = match host {
            Some(host) => session.invoke(input, host),
            None => session.close(),
        };
        tsify::Ts::from_rust(&event).map_err(|_| error(invalid()))
    }
    pub fn page(&self, offset: u32, limit: u32) -> Result<tsify::Ts<RuntimePageV2>, JsValue> {
        let state = self.state.try_borrow().map_err(|_| error(invalid()))?;
        let page = state
            .session
            .page(
                offset,
                limit,
                state.host.as_ref().ok_or_else(|| error(invalid()))?,
            )
            .map_err(error)?;
        tsify::Ts::from_rust(&page).map_err(|_| error(invalid()))
    }
    pub fn shutdown(&self) -> Result<tsify::Ts<RuntimeEventV2>, JsValue> {
        let mut state = self.state.try_borrow_mut().map_err(|_| error(invalid()))?;
        state.host = None;
        tsify::Ts::from_rust(&state.session.close()).map_err(|_| error(invalid()))
    }
}

#[wasm_bindgen(typescript_custom_section)]
const RUNTIME_HOST_TYPES: &str = r#"
export interface RuntimeHostV2 {
 load(context: CommitContext): RuntimeSnapshotV2;
 commit(request: LocalCommitRequest, context: CommitContext, cancelled: boolean): RuntimeCommitResultV2;
 lookup(identity: LocalOperationIdentity): LocalCommitReceipt | null;
 journalLoad(): number[];
 journalSave(bytes: number[]): boolean;
 journalClear(bytes: number[]): boolean;
 seal(request: LocalCommitRequest): number[];
 unseal(bytes: number[]): LocalCommitRequest;
 current(): CommitContext;
 cancelled(): boolean;
}
"#;
