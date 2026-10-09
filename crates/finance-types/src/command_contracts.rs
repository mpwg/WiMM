// SPDX-License-Identifier: AGPL-3.0-or-later
//! Private Request-/Ergebnisformen und reine Versions-/Formhilfen.
use crate::{
    ContractError, CoreResult,
    aggregate_schema::INVALID,
    models::{Aggregate, Command},
    scalars::{EntityId, Revision, UtcTimestamp},
};
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
pub const COMMAND_ERROR: (&str, &str) = ("INVALID_COMMAND", "Der Fachbefehl ist ungültig.");
#[cfg_attr(feature = "contract-schema", derive(schemars::JsonSchema))]
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
#[cfg_attr(feature = "native-bindings", derive(uniffi::Record))]
#[cfg_attr(feature = "wasm-bindings", derive(tsify::Tsify))]
pub struct Expectation {
    pub id: EntityId,
    pub expected_revision: Revision,
}
#[cfg_attr(feature = "contract-schema", derive(schemars::JsonSchema))]
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
#[cfg_attr(feature = "native-bindings", derive(uniffi::Record))]
#[cfg_attr(feature = "wasm-bindings", derive(tsify::Tsify))]
pub struct Context {
    pub operation_id: EntityId,
    pub occurred_at: UtcTimestamp,
    pub generated_ids: Vec<EntityId>,
}
#[cfg_attr(feature = "contract-schema", derive(schemars::JsonSchema))]
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
#[cfg_attr(feature = "native-bindings", derive(uniffi::Record))]
#[cfg_attr(feature = "wasm-bindings", derive(tsify::Tsify))]
pub struct Request {
    #[cfg_attr(feature = "contract-schema", schemars(with = "u32"))]
    pub contract_version: crate::versions::EngineBindingVersion,
    #[cfg_attr(feature = "contract-schema", schemars(with = "u32"))]
    pub domain_schema_version: crate::versions::DomainSchemaVersion,
    pub space_id: EntityId,
    pub aggregates: Vec<Aggregate>,
    pub command: Command,
    pub expected_revisions: Vec<Expectation>,
    pub context: Context,
}
#[cfg_attr(feature = "contract-schema", derive(schemars::JsonSchema))]
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
#[cfg_attr(feature = "native-bindings", derive(uniffi::Record))]
#[cfg_attr(feature = "wasm-bindings", derive(tsify::Tsify))]
pub struct ChangeSet {
    pub space_id: EntityId,
    pub command_type: String,
    pub operation_id: EntityId,
    pub occurred_at: UtcTimestamp,
    pub expected_revisions: Vec<Expectation>,
    pub aggregates: Vec<Aggregate>,
}
pub struct Scope<'a> {
    pub space_id: &'a EntityId,
    pub aggregates: &'a [Aggregate],
    pub context: &'a Context,
}
impl Scope<'_> {
    pub fn current(&self) -> BTreeMap<&EntityId, &Aggregate> {
        self.aggregates.iter().map(|a| (a.id(), a)).collect()
    }
}
impl Request {
    pub fn check_versions(&self) -> CoreResult<()> {
        if self.contract_version != 1 || self.domain_schema_version != 1 {
            Err(COMMAND_ERROR)
        } else {
            Ok(())
        }
    }
    pub fn scope(&self) -> Scope<'_> {
        Scope {
            space_id: &self.space_id,
            aggregates: &self.aggregates,
            context: &self.context,
        }
    }
    pub fn current(&self) -> BTreeMap<&EntityId, &Aggregate> {
        self.aggregates.iter().map(|a| (a.id(), a)).collect()
    }
    pub fn changed(
        &self,
        command: &str,
        aggregates: Vec<Aggregate>,
        expected_revisions: Vec<Expectation>,
    ) -> ChangeSet {
        ChangeSet {
            space_id: self.space_id.clone(),
            command_type: command.to_owned(),
            operation_id: self.context.operation_id.clone(),
            occurred_at: self.context.occurred_at.clone(),
            expected_revisions,
            aggregates,
        }
    }
}
pub fn to_wire(changes: ChangeSet) -> CoreResult<serde_json::Value> {
    serde_json::to_value(
        serde_json::json!({"contractVersion":1,"status":"changed","changeSet":changes}),
    )
    .map_err(|_| INVALID)
}

#[cfg_attr(feature = "contract-schema", derive(schemars::JsonSchema))]
#[derive(Debug, Clone)]
#[cfg_attr(feature = "native-bindings", derive(uniffi::Enum))]
pub enum CommandResult {
    Changed(ChangeSet),
    Unchanged,
}
impl CommandResult {
    pub fn to_wire(self) -> CoreResult<serde_json::Value> {
        match self {
            Self::Changed(change) => to_wire(change),
            Self::Unchanged => Ok(serde_json::json!({"contractVersion":1,"status":"unchanged"})),
        }
    }
}

#[cfg_attr(feature = "contract-schema", derive(schemars::JsonSchema))]
#[cfg_attr(feature = "native-bindings", derive(uniffi::Enum))]
#[cfg_attr(feature = "wasm-bindings", derive(tsify::Tsify))]
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(
    tag = "status",
    rename_all = "camelCase",
    rename_all_fields = "camelCase",
    deny_unknown_fields
)]
pub enum CommandOutcomeV2 {
    Changed {
        contract_version: u32,
        change_set: ChangeSet,
    },
    Unchanged {
        contract_version: u32,
    },
}

impl CommandOutcomeV2 {
    pub fn to_v1_json(self) -> Result<String, ContractError> {
        let wire = match self {
            Self::Changed {
                contract_version: 2,
                change_set,
            } => CommandResult::Changed(change_set).to_wire(),
            Self::Unchanged {
                contract_version: 2,
            } => CommandResult::Unchanged.to_wire(),
            _ => {
                return Err((
                    "UPDATE_REQUIRED",
                    "Der Enginevertrag wird nicht unterstützt.",
                )
                    .into());
            }
        };
        wire.map(|value| value.to_string())
            .map_err(ContractError::from)
    }
}
