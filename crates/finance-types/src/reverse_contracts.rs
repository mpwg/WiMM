// SPDX-License-Identifier: AGPL-3.0-or-later
//! Gemeinsame private Gegenbefehlsformen ohne Finanzhandler.
use crate::{
    command_contracts::{Context, Expectation, Request, Scope},
    models::{Aggregate, Command},
    scalars::{EntityId, NonEmptyVec, present},
};
use serde::{Deserialize, Serialize};
#[cfg_attr(feature = "contract-schema", derive(schemars::JsonSchema))]
#[cfg_attr(feature = "native-bindings", derive(uniffi::Record))]
#[cfg_attr(feature = "wasm-bindings", derive(tsify::Tsify))]
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ReverseTarget {
    pub id: EntityId,
    #[serde(
        default,
        deserialize_with = "present",
        skip_serializing_if = "Option::is_none"
    )]
    #[cfg_attr(feature = "contract-schema", schemars(with = "Aggregate"))]
    pub previous: Option<Aggregate>,
}
#[cfg_attr(feature = "contract-schema", derive(schemars::JsonSchema))]
#[cfg_attr(feature = "native-bindings", derive(uniffi::Record))]
#[cfg_attr(feature = "wasm-bindings", derive(tsify::Tsify))]
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ReverseRequest {
    #[cfg_attr(feature = "contract-schema", schemars(with = "u32"))]
    pub contract_version: crate::versions::EngineBindingVersion,
    #[cfg_attr(feature = "contract-schema", schemars(with = "u32"))]
    pub domain_schema_version: crate::versions::DomainSchemaVersion,
    pub space_id: EntityId,
    pub aggregates: Vec<Aggregate>,
    pub expected_revisions: Vec<Expectation>,
    pub context: Context,
    pub targets: NonEmptyVec<ReverseTarget>,
}
impl ReverseRequest {
    pub fn scope(&self) -> Scope<'_> {
        Scope {
            space_id: &self.space_id,
            aggregates: &self.aggregates,
            context: &self.context,
        }
    }
    pub fn child(&self, command: Command, expected_revisions: Vec<Expectation>) -> Request {
        Request {
            contract_version: 1.into(),
            domain_schema_version: 1.into(),
            space_id: self.space_id.clone(),
            aggregates: self.aggregates.clone(),
            command,
            expected_revisions,
            context: self.context.clone(),
        }
    }
}
