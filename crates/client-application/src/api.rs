// SPDX-License-Identifier: AGPL-3.0-or-later
//! V2-Anwendungsgrenze: Vorbereitung ist keine Speicherbestätigung.
use crate::*;
use wimm_finance_types::{
    command_contracts::{Context, Expectation, Request},
    models::{Aggregate, Command},
    reverse_contracts::{ReverseRequest, ReverseTarget},
};
use wimm_local_contracts::commit::LocalCommitRequest;
#[derive(Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
#[cfg_attr(feature = "native-bindings", derive(uniffi::Record))]
#[cfg_attr(feature = "wasm-bindings", derive(tsify::Tsify))]
#[cfg_attr(feature = "contract-schema", derive(schemars::JsonSchema))]
pub struct ApplicationCommandV2 {
    pub space_id: EntityId,
    pub aggregates: Vec<Aggregate>,
    pub command: Command,
    pub expected_revisions: Vec<Expectation>,
    pub context: Context,
}
impl From<Request> for ApplicationCommandV2 {
    fn from(r: Request) -> Self {
        Self {
            space_id: r.space_id,
            aggregates: r.aggregates,
            command: r.command,
            expected_revisions: r.expected_revisions,
            context: r.context,
        }
    }
}
impl ApplicationCommandV2 {
    fn into_core(self) -> Request {
        Request {
            contract_version: 1.into(),
            domain_schema_version: 1.into(),
            space_id: self.space_id,
            aggregates: self.aggregates,
            command: self.command,
            expected_revisions: self.expected_revisions,
            context: self.context,
        }
    }
}
#[derive(Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
#[cfg_attr(feature = "native-bindings", derive(uniffi::Record))]
#[cfg_attr(feature = "wasm-bindings", derive(tsify::Tsify))]
#[cfg_attr(feature = "contract-schema", derive(schemars::JsonSchema))]
pub struct ApplicationReverseV2 {
    pub space_id: EntityId,
    pub aggregates: Vec<Aggregate>,
    pub expected_revisions: Vec<Expectation>,
    pub context: Context,
    pub targets: NonEmptyVec<ReverseTarget>,
}
impl ApplicationReverseV2 {
    fn into_core(self) -> ReverseRequest {
        ReverseRequest {
            contract_version: 1.into(),
            domain_schema_version: 1.into(),
            space_id: self.space_id,
            aggregates: self.aggregates,
            expected_revisions: self.expected_revisions,
            context: self.context,
            targets: self.targets,
        }
    }
}
#[derive(Clone, serde::Serialize, serde::Deserialize)]
#[serde(
    tag = "actionType",
    content = "request",
    rename_all = "camelCase",
    deny_unknown_fields
)]
#[cfg_attr(feature = "native-bindings", derive(uniffi::Enum))]
#[cfg_attr(feature = "wasm-bindings", derive(tsify::Tsify))]
#[cfg_attr(feature = "contract-schema", derive(schemars::JsonSchema))]
pub enum ApplicationActionV2 {
    Command(ApplicationCommandV2),
    Reverse(ApplicationReverseV2),
}
#[derive(Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
#[cfg_attr(feature = "native-bindings", derive(uniffi::Record))]
#[cfg_attr(feature = "wasm-bindings", derive(tsify::Tsify))]
#[cfg_attr(feature = "contract-schema", derive(schemars::JsonSchema))]
pub struct ApplicationRequestV2 {
    #[cfg_attr(feature = "contract-schema", schemars(with = "BindingVersionSchema"))]
    #[serde(deserialize_with = "wimm_contract_primitives::unsigned32")]
    pub contract_version: u32,
    #[cfg_attr(feature = "contract-schema", schemars(with = "DomainVersionSchema"))]
    #[serde(deserialize_with = "wimm_contract_primitives::unsigned32")]
    pub domain_schema_version: u32,
    pub started: CommitContext,
    pub current: CommitContext,
    pub mode: AreaMode,
    pub action: ApplicationActionV2,
}
#[derive(Clone, Copy, PartialEq, Eq, Debug, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
#[cfg_attr(feature = "native-bindings", derive(uniffi::Enum))]
#[cfg_attr(feature = "wasm-bindings", derive(tsify::Tsify))]
#[cfg_attr(feature = "contract-schema", derive(schemars::JsonSchema))]
pub enum ApplicationFailureCode {
    UpdateRequired,
    ScopeChanged,
    WrongArea,
    InvalidState,
    FinanceRejected,
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
pub enum ApplicationPreparationV2 {
    Prepared {
        #[cfg_attr(feature = "contract-schema", schemars(with = "BindingVersionSchema"))]
        contract_version: u32,
        context: CommitContext,
        request: Box<LocalCommitRequest>,
    },
    Unchanged {
        #[cfg_attr(feature = "contract-schema", schemars(with = "BindingVersionSchema"))]
        contract_version: u32,
    },
    Rejected {
        #[cfg_attr(feature = "contract-schema", schemars(with = "BindingVersionSchema"))]
        contract_version: u32,
        code: ApplicationFailureCode,
        #[serde(deserialize_with = "wimm_finance_types::scalars::nullable")]
        #[cfg_attr(
            feature = "contract-schema",
            schemars(with = "RequiredNullableFinanceCode")
        )]
        finance_code: Option<String>,
    },
}
fn reject(code: ApplicationFailureCode, finance_code: Option<String>) -> ApplicationPreparationV2 {
    ApplicationPreparationV2::Rejected {
        contract_version: 2,
        code,
        finance_code,
    }
}
pub fn prepare_application_v2(input: ApplicationRequestV2) -> ApplicationPreparationV2 {
    if input.contract_version != 2 || input.domain_schema_version != 1 {
        return reject(ApplicationFailureCode::UpdateRequired, None);
    }
    let prepared = match input.action {
        ApplicationActionV2::Command(request) => prepare_command(
            request.into_core(),
            &input.started,
            &input.current,
            input.mode,
        ),
        ApplicationActionV2::Reverse(request) => prepare_reverse(
            request.into_core(),
            &input.started,
            &input.current,
            input.mode,
        )
        .map(Some),
    };
    match prepared {
        Ok(Some(p)) => ApplicationPreparationV2::Prepared {
            contract_version: 2,
            context: p.context,
            request: Box::new(p.request),
        },
        Ok(None) => ApplicationPreparationV2::Unchanged {
            contract_version: 2,
        },
        Err(e) => {
            let (code, finance) = match e {
                PreparationFailure::ScopeChanged => (ApplicationFailureCode::ScopeChanged, None),
                PreparationFailure::WrongArea => (ApplicationFailureCode::WrongArea, None),
                PreparationFailure::InvalidState => (ApplicationFailureCode::InvalidState, None),
                PreparationFailure::FinanceRejected(code) => {
                    (ApplicationFailureCode::FinanceRejected, Some(code.into()))
                }
            };
            reject(code, finance)
        }
    }
}
#[cfg(feature = "contract-schema")]
pub(crate) struct BindingVersionSchema;
#[cfg(feature = "contract-schema")]
impl schemars::JsonSchema for BindingVersionSchema {
    fn schema_name() -> std::borrow::Cow<'static, str> {
        "ApplicationBindingVersion".into()
    }
    fn json_schema(_: &mut schemars::SchemaGenerator) -> schemars::Schema {
        schemars::json_schema!({"type":"integer","const":2})
    }
}
#[cfg(feature = "contract-schema")]
pub(crate) struct DomainVersionSchema;
#[cfg(feature = "contract-schema")]
impl schemars::JsonSchema for DomainVersionSchema {
    fn schema_name() -> std::borrow::Cow<'static, str> {
        "ApplicationDomainVersion".into()
    }
    fn json_schema(_: &mut schemars::SchemaGenerator) -> schemars::Schema {
        schemars::json_schema!({"type":"integer","const":1})
    }
}

#[cfg(feature = "contract-schema")]
pub(crate) struct RequiredNullableFinanceCode;
#[cfg(feature = "contract-schema")]
impl schemars::JsonSchema for RequiredNullableFinanceCode {
    fn schema_name() -> std::borrow::Cow<'static, str> {
        "RequiredNullableFinanceCode".into()
    }
    fn json_schema(_: &mut schemars::SchemaGenerator) -> schemars::Schema {
        schemars::json_schema!({"type":["string","null"]})
    }
}
