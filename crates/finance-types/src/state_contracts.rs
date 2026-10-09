// SPDX-License-Identifier: AGPL-3.0-or-later
//! Gemeinsame private Bestands- und Projektionsverträge.
use crate::{
    models::{Aggregate, GroupKind},
    scalars::{EntityId, MoneyCents},
    versions::{DomainSchemaVersion, EngineBindingVersion},
};
use serde::{Deserialize, Serialize};
#[cfg_attr(feature = "contract-schema", derive(schemars::JsonSchema))]
#[cfg_attr(feature = "native-bindings", derive(uniffi::Record))]
#[cfg_attr(feature = "wasm-bindings", derive(tsify::Tsify))]
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ProjectionRequest {
    #[cfg_attr(feature = "contract-schema", schemars(with = "u32"))]
    pub contract_version: EngineBindingVersion,
    #[cfg_attr(feature = "contract-schema", schemars(with = "u32"))]
    pub domain_schema_version: DomainSchemaVersion,
    pub space_id: EntityId,
    pub aggregates: Vec<Aggregate>,
}

#[cfg_attr(feature = "contract-schema", derive(schemars::JsonSchema))]
#[cfg_attr(feature = "native-bindings", derive(uniffi::Enum))]
#[cfg_attr(feature = "wasm-bindings", derive(tsify::Tsify))]
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(
    tag = "mode",
    rename_all = "camelCase",
    rename_all_fields = "camelCase",
    deny_unknown_fields
)]
pub enum ValidationRequest {
    Historical {
        #[cfg_attr(feature = "contract-schema", schemars(with = "u32"))]
        contract_version: EngineBindingVersion,
        #[cfg_attr(feature = "contract-schema", schemars(with = "u32"))]
        domain_schema_version: DomainSchemaVersion,
        space_id: EntityId,
        aggregates: Vec<Aggregate>,
    },
    Mutation {
        #[cfg_attr(feature = "contract-schema", schemars(with = "u32"))]
        contract_version: EngineBindingVersion,
        #[cfg_attr(feature = "contract-schema", schemars(with = "u32"))]
        domain_schema_version: DomainSchemaVersion,
        space_id: EntityId,
        before: Vec<Aggregate>,
        after: Vec<Aggregate>,
    },
}

impl ValidationRequest {
    pub fn set_binding_version(&mut self, version: u32) {
        match self {
            Self::Historical {
                contract_version, ..
            }
            | Self::Mutation {
                contract_version, ..
            } => *contract_version = version.into(),
        }
    }
    pub fn versions(&self) -> (EngineBindingVersion, DomainSchemaVersion) {
        match self {
            Self::Historical {
                contract_version,
                domain_schema_version,
                ..
            }
            | Self::Mutation {
                contract_version,
                domain_schema_version,
                ..
            } => (*contract_version, *domain_schema_version),
        }
    }
}

#[cfg_attr(feature = "contract-schema", derive(schemars::JsonSchema))]
#[cfg_attr(feature = "native-bindings", derive(uniffi::Record))]
#[cfg_attr(feature = "wasm-bindings", derive(tsify::Tsify))]
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ProjectionOutcome {
    pub contract_version: u32,
    pub status: ProjectionStatus,
    pub projections: ProjectionSet,
}

#[cfg_attr(feature = "contract-schema", derive(schemars::JsonSchema))]
#[cfg_attr(feature = "native-bindings", derive(uniffi::Record))]
#[cfg_attr(feature = "wasm-bindings", derive(tsify::Tsify))]
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ValidationOutcome {
    pub contract_version: u32,
    pub status: ValidationStatus,
}
#[cfg_attr(feature = "contract-schema", derive(schemars::JsonSchema))]
#[cfg_attr(feature = "native-bindings", derive(uniffi::Record))]
#[cfg_attr(feature = "wasm-bindings", derive(tsify::Tsify))]
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct AccountBalance {
    pub account_id: EntityId,
    pub balance: MoneyCents,
}
#[cfg_attr(feature = "contract-schema", derive(schemars::JsonSchema))]
#[cfg_attr(feature = "native-bindings", derive(uniffi::Record))]
#[cfg_attr(feature = "wasm-bindings", derive(tsify::Tsify))]
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct CategoryConsumption {
    pub category_id: EntityId,
    pub group_kind: GroupKind,
    pub amount: MoneyCents,
}
#[cfg_attr(feature = "contract-schema", derive(schemars::JsonSchema))]
#[cfg_attr(feature = "native-bindings", derive(uniffi::Record))]
#[cfg_attr(feature = "wasm-bindings", derive(tsify::Tsify))]
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Consumption {
    pub income: MoneyCents,
    pub expense: MoneyCents,
    pub net: MoneyCents,
    pub categories: Vec<CategoryConsumption>,
}
#[cfg_attr(feature = "contract-schema", derive(schemars::JsonSchema))]
#[cfg_attr(feature = "native-bindings", derive(uniffi::Record))]
#[cfg_attr(feature = "wasm-bindings", derive(tsify::Tsify))]
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ProjectionSet {
    pub account_balances: Vec<AccountBalance>,
    pub consumption: Consumption,
}

#[cfg_attr(feature = "contract-schema", derive(schemars::JsonSchema))]
#[cfg_attr(feature = "native-bindings", derive(uniffi::Enum))]
#[cfg_attr(feature = "wasm-bindings", derive(tsify::Tsify))]
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum ProjectionStatus {
    Projected,
}
#[cfg_attr(feature = "contract-schema", derive(schemars::JsonSchema))]
#[cfg_attr(feature = "native-bindings", derive(uniffi::Enum))]
#[cfg_attr(feature = "wasm-bindings", derive(tsify::Tsify))]
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum ValidationStatus {
    Valid,
}
