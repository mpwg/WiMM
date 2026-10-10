// SPDX-License-Identifier: AGPL-3.0-or-later
//! Versionierte zustandsbehaftete Anwendungsaktionen, keine Plattform-/SQLtypen.
use crate::{
    CommitContext, PreparationFailure, api::ApplicationFailureCode, dispatch::DispatchResult,
    history::Direction, runtime::RuntimeOutcome,
};
use wimm_finance_types::{
    command_contracts::{Context, Expectation},
    models::{Aggregate, Command},
};
use wimm_local_contracts::{
    commit::{LocalCommitReceipt, LocalOperationIdentity},
    persistence_errors::StorageFailure,
};
macro_rules! dto {($name:ident {contract_version:u32,$($field:ident:$ty:ty),*$(,)?})=>{
 #[derive(Clone,serde::Serialize,serde::Deserialize)] #[serde(rename_all="camelCase",deny_unknown_fields)]
 #[cfg_attr(feature="native-bindings",derive(uniffi::Record))] #[cfg_attr(feature="wasm-bindings",derive(tsify::Tsify))] #[cfg_attr(feature="contract-schema",derive(schemars::JsonSchema))]
 pub struct $name {
 #[serde(deserialize_with="wimm_contract_primitives::unsigned32")]
 #[cfg_attr(feature="contract-schema",schemars(with="crate::api::BindingVersionSchema"))]
 pub contract_version:u32,$(pub $field:$ty),*}
};}
dto!(RuntimeSnapshotV2 { contract_version:u32,context:CommitContext,aggregates:Vec<Aggregate> });
#[derive(Clone, serde::Serialize, serde::Deserialize)]
#[serde(
    tag = "actionType",
    rename_all = "camelCase",
    rename_all_fields = "camelCase",
    deny_unknown_fields
)]
#[cfg_attr(feature = "native-bindings", derive(uniffi::Enum))]
#[cfg_attr(feature = "wasm-bindings", derive(tsify::Tsify))]
#[cfg_attr(feature = "contract-schema", derive(schemars::JsonSchema))]
pub enum RuntimeActionV2 {
    Load,
    Execute {
        command: Command,
        expected_revisions: Vec<Expectation>,
        operation: Context,
    },
    History {
        direction: Direction,
        operation: Context,
    },
    Resolve,
}
#[derive(Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
#[cfg_attr(feature = "native-bindings", derive(uniffi::Record))]
#[cfg_attr(feature = "wasm-bindings", derive(tsify::Tsify))]
#[cfg_attr(feature = "contract-schema", derive(schemars::JsonSchema))]
pub struct RuntimeRequestV2 {
    #[serde(deserialize_with = "wimm_contract_primitives::unsigned32")]
    #[cfg_attr(
        feature = "contract-schema",
        schemars(with = "crate::api::BindingVersionSchema")
    )]
    pub contract_version: u32,
    #[serde(deserialize_with = "wimm_contract_primitives::unsigned32")]
    #[cfg_attr(
        feature = "contract-schema",
        schemars(with = "crate::api::DomainVersionSchema")
    )]
    pub domain_schema_version: u32,
    pub action: RuntimeActionV2,
}
#[derive(Clone, serde::Serialize, serde::Deserialize)]
#[serde(
    tag = "status",
    rename_all = "camelCase",
    rename_all_fields = "camelCase",
    deny_unknown_fields
)]
#[cfg_attr(feature = "native-bindings", derive(uniffi::Enum))]
#[cfg_attr(feature = "wasm-bindings", derive(tsify::Tsify))]
#[cfg_attr(feature = "contract-schema", derive(schemars::JsonSchema))]
pub enum RuntimeResultV2 {
    State,
    Committed {
        context: CommitContext,
        receipt: Box<LocalCommitReceipt>,
        current: bool,
    },
    NotCommitted {
        error: StorageFailure,
    },
    ReadFailed {
        error: StorageFailure,
    },
    Unknown,
    Busy,
    ScopeChanged,
    Idle,
    Closed,
    Rejected {
        code: ApplicationFailureCode,
        #[serde(deserialize_with = "wimm_finance_types::scalars::nullable")]
        #[cfg_attr(
            feature = "contract-schema",
            schemars(with = "crate::api::RequiredNullableFinanceCode")
        )]
        finance_code: Option<String>,
    },
}
dto!(RuntimeEventV2 {
    contract_version: u32,
    context: CommitContext,
    can_undo: bool,
    can_redo: bool,
    result: RuntimeResultV2
});
dto!(RuntimePageV2 { contract_version:u32,context:CommitContext,offset:u32,aggregates:Vec<Aggregate> });
#[derive(Clone, serde::Serialize, serde::Deserialize)]
#[serde(
    tag = "status",
    rename_all = "camelCase",
    rename_all_fields = "camelCase",
    deny_unknown_fields
)]
#[cfg_attr(feature = "native-bindings", derive(uniffi::Enum))]
#[cfg_attr(feature = "wasm-bindings", derive(tsify::Tsify))]
#[cfg_attr(feature = "contract-schema", derive(schemars::JsonSchema))]
pub enum RuntimeCommitResultV2 {
    Committed { receipt: LocalCommitReceipt },
    NotCommitted { error: StorageFailure },
    Unknown { identity: LocalOperationIdentity },
}
impl From<RuntimeOutcome> for RuntimeResultV2 {
    fn from(value: RuntimeOutcome) -> Self {
        match value {
            RuntimeOutcome::Unchanged => Self::State,
            RuntimeOutcome::ReadFailed(error) => Self::ReadFailed { error },
            RuntimeOutcome::PreparationRejected(e) => {
                let (code, finance_code) = match e {
                    PreparationFailure::ScopeChanged => {
                        (ApplicationFailureCode::ScopeChanged, None)
                    }
                    PreparationFailure::WrongArea => (ApplicationFailureCode::WrongArea, None),
                    PreparationFailure::InvalidState => {
                        (ApplicationFailureCode::InvalidState, None)
                    }
                    PreparationFailure::FinanceRejected(code) => {
                        (ApplicationFailureCode::FinanceRejected, Some(code.into()))
                    }
                };
                Self::Rejected { code, finance_code }
            }
            RuntimeOutcome::Dispatch(d) => match d {
                DispatchResult::Committed {
                    context,
                    receipt,
                    current,
                } => Self::Committed {
                    context,
                    receipt,
                    current,
                },
                DispatchResult::NotCommitted { error } => Self::NotCommitted { error },
                DispatchResult::Unknown => Self::Unknown,
                DispatchResult::Busy => Self::Busy,
                DispatchResult::ScopeChanged => Self::ScopeChanged,
                DispatchResult::Idle => Self::Idle,
            },
        }
    }
}
