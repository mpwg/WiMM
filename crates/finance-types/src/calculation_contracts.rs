// SPDX-License-Identifier: AGPL-3.0-or-later
//! Gemeinsame private Berechnungsrequests und vollständige Ergebnisformen.
use crate::{
    models::{Aggregate, ImportCandidate},
    scalars::{EntityId, FinanceDate, MoneyCents, PositiveOrdinal},
    versions::{DomainSchemaVersion, EngineBindingVersion},
};
use serde::{Deserialize, Serialize};
#[cfg_attr(feature = "contract-schema", derive(schemars::JsonSchema))]
#[cfg_attr(feature = "native-bindings", derive(uniffi::Enum))]
#[cfg_attr(feature = "wasm-bindings", derive(tsify::Tsify))]
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "calculationType", deny_unknown_fields)]
pub enum CalculationRequest {
    #[serde(rename = "money.parse")]
    MoneyParse(MoneyParseRequest),
    #[serde(rename = "rule.apply")]
    RuleApply(RuleRequest),
    #[serde(rename = "import.classify")]
    ImportClassify(ImportRequest),
    #[serde(rename = "schedule.dueDates")]
    DueDates(ScheduleRequest),
}
impl CalculationRequest {
    pub fn versions(&self) -> (EngineBindingVersion, DomainSchemaVersion) {
        match self {
            Self::MoneyParse(r) => (r.contract_version, r.domain_schema_version),
            Self::RuleApply(r) => (r.contract_version, r.domain_schema_version),
            Self::ImportClassify(r) => (r.contract_version, r.domain_schema_version),
            Self::DueDates(r) => (r.contract_version, r.domain_schema_version),
        }
    }
    pub fn set_binding_version(&mut self, version: u32) {
        match self {
            Self::MoneyParse(r) => r.contract_version = version.into(),
            Self::RuleApply(r) => r.contract_version = version.into(),
            Self::ImportClassify(r) => r.contract_version = version.into(),
            Self::DueDates(r) => r.contract_version = version.into(),
        }
    }
}

#[cfg_attr(feature = "contract-schema", derive(schemars::JsonSchema))]
#[cfg_attr(feature = "native-bindings", derive(uniffi::Enum))]
#[cfg_attr(feature = "wasm-bindings", derive(tsify::Tsify))]
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(
    tag = "status",
    rename_all = "camelCase",
    rename_all_fields = "camelCase",
    deny_unknown_fields
)]
pub enum CalculationOutcome {
    Money {
        contract_version: u32,
        value: MoneyCents,
    },
    RuleApplied {
        contract_version: u32,
        candidate: ImportCandidate,
        applied_rule_ids: Vec<EntityId>,
    },
    Classified {
        contract_version: u32,
        rows: Vec<ClassificationRow>,
    },
    DueDates {
        contract_version: u32,
        dates: Vec<FinanceDate>,
    },
}
impl CalculationOutcome {
    pub fn binding_version(&self) -> u32 {
        match self {
            Self::Money {
                contract_version, ..
            }
            | Self::RuleApplied {
                contract_version, ..
            }
            | Self::Classified {
                contract_version, ..
            }
            | Self::DueDates {
                contract_version, ..
            } => *contract_version,
        }
    }
    pub fn set_binding_version(&mut self, version: u32) {
        match self {
            Self::Money {
                contract_version, ..
            }
            | Self::RuleApplied {
                contract_version, ..
            }
            | Self::Classified {
                contract_version, ..
            }
            | Self::DueDates {
                contract_version, ..
            } => *contract_version = version,
        }
    }
}
#[cfg_attr(feature = "contract-schema", derive(schemars::JsonSchema))]
#[cfg_attr(feature = "native-bindings", derive(uniffi::Record))]
#[cfg_attr(feature = "wasm-bindings", derive(tsify::Tsify))]
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct RuleRequest {
    #[cfg_attr(feature = "contract-schema", schemars(with = "u32"))]
    pub contract_version: EngineBindingVersion,
    #[cfg_attr(feature = "contract-schema", schemars(with = "u32"))]
    pub domain_schema_version: DomainSchemaVersion,
    pub space_id: EntityId,
    pub aggregates: Vec<Aggregate>,
    pub candidate: ImportCandidate,
}
#[cfg_attr(feature = "contract-schema", derive(schemars::JsonSchema))]
#[cfg_attr(feature = "native-bindings", derive(uniffi::Record))]
#[cfg_attr(feature = "wasm-bindings", derive(tsify::Tsify))]
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ImportRequest {
    #[cfg_attr(feature = "contract-schema", schemars(with = "u32"))]
    pub contract_version: EngineBindingVersion,
    #[cfg_attr(feature = "contract-schema", schemars(with = "u32"))]
    pub domain_schema_version: DomainSchemaVersion,
    pub space_id: EntityId,
    pub aggregates: Vec<Aggregate>,
    pub account_id: EntityId,
    pub candidates: Vec<ImportCandidate>,
}
#[cfg_attr(feature = "contract-schema", derive(schemars::JsonSchema))]
#[cfg_attr(feature = "native-bindings", derive(uniffi::Record))]
#[cfg_attr(feature = "wasm-bindings", derive(tsify::Tsify))]
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ScheduleRequest {
    #[cfg_attr(feature = "contract-schema", schemars(with = "u32"))]
    pub contract_version: EngineBindingVersion,
    #[cfg_attr(feature = "contract-schema", schemars(with = "u32"))]
    pub domain_schema_version: DomainSchemaVersion,
    pub space_id: EntityId,
    pub schedule_id: EntityId,
    pub aggregates: Vec<Aggregate>,
    pub through: FinanceDate,
}
#[cfg_attr(feature = "contract-schema", derive(schemars::JsonSchema))]
#[cfg_attr(feature = "native-bindings", derive(uniffi::Enum))]
#[cfg_attr(feature = "wasm-bindings", derive(tsify::Tsify))]
#[derive(Debug, Clone, Copy, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum Classification {
    New,
    Duplicate,
    Conflict,
}
#[cfg_attr(feature = "contract-schema", derive(schemars::JsonSchema))]
#[cfg_attr(feature = "native-bindings", derive(uniffi::Record))]
#[cfg_attr(feature = "wasm-bindings", derive(tsify::Tsify))]
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ClassificationRow {
    pub source_row: PositiveOrdinal,
    pub classification: Classification,
}
#[cfg_attr(feature = "contract-schema", derive(schemars::JsonSchema))]
#[cfg_attr(feature = "native-bindings", derive(uniffi::Record))]
#[cfg_attr(feature = "wasm-bindings", derive(tsify::Tsify))]
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct MoneyParseRequest {
    #[cfg_attr(feature = "contract-schema", schemars(with = "u32"))]
    pub contract_version: EngineBindingVersion,
    #[cfg_attr(feature = "contract-schema", schemars(with = "u32"))]
    pub domain_schema_version: DomainSchemaVersion,
    pub space_id: EntityId,
    pub text: String,
}
