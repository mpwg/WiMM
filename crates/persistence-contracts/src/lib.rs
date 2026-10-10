// SPDX-License-Identifier: AGPL-3.0-or-later
//! Neutrale Transaktionszustände; keine ORM-/Client-/Server-/Finanzdaten.
#![forbid(unsafe_code)]
use serde::{Deserialize, Serialize};
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(
    tag = "status",
    rename_all = "camelCase",
    rename_all_fields = "camelCase",
    deny_unknown_fields
)]
#[cfg_attr(feature = "contract-schema", derive(schemars::JsonSchema))]
pub enum CommitOutcome<T, E, K> {
    Committed { value: T },
    NotCommitted { error: E },
    Unknown { identity: K },
}
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
#[cfg_attr(feature = "contract-schema", derive(schemars::JsonSchema))]
pub enum CommitStatus {
    Committed,
    NotCommitted,
    Unknown,
}
impl<T, E, K> CommitOutcome<T, E, K> {
    pub fn status(&self) -> CommitStatus {
        match self {
            Self::Committed { .. } => CommitStatus::Committed,
            Self::NotCommitted { .. } => CommitStatus::NotCommitted,
            Self::Unknown { .. } => CommitStatus::Unknown,
        }
    }
}
/// Keine SQL-Callbacks oder beliebig ausführbaren Pfade; konkrete Datenports besitzen die Transaktion.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(
    rename_all = "camelCase",
    deny_unknown_fields,
    try_from = "CheckpointWire"
)]
#[cfg_attr(feature = "contract-schema", derive(schemars::JsonSchema))]
pub struct MigrationCheckpoint {
    pub operation_contract_version: u32,
    pub number: u64,
    pub storage_schema_version: u32,
    pub domain_schema_version: u32,
}
impl MigrationCheckpoint {
    pub fn supported(&self) -> bool {
        self.operation_contract_version == 1
            && self.number <= 9_007_199_254_740_991
            && self.storage_schema_version > 0
            && self.domain_schema_version > 0
    }
}
#[derive(Deserialize)]
#[cfg_attr(feature = "contract-schema", derive(schemars::JsonSchema))]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct CheckpointWire {
    operation_contract_version: u32,
    number: u64,
    storage_schema_version: u32,
    domain_schema_version: u32,
}
impl TryFrom<CheckpointWire> for MigrationCheckpoint {
    type Error = &'static str;
    fn try_from(w: CheckpointWire) -> Result<Self, Self::Error> {
        let result = Self {
            operation_contract_version: w.operation_contract_version,
            number: w.number,
            storage_schema_version: w.storage_schema_version,
            domain_schema_version: w.domain_schema_version,
        };
        if result.supported() {
            Ok(result)
        } else {
            Err("Nicht unterstützter Migrationscheckpoint.")
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn committed_rejected_unknown_are_distinct_and_strict() {
        for expected in [
            CommitOutcome::<u32, String, String>::Committed { value: 7 },
            CommitOutcome::NotCommitted {
                error: "REVISION_CONFLICT".into(),
            },
            CommitOutcome::Unknown {
                identity: "opaque".into(),
            },
        ] {
            let text = serde_json::to_string(&expected).unwrap();
            let actual: CommitOutcome<u32, String, String> = serde_json::from_str(&text).unwrap();
            assert_eq!(actual, expected);
        }
        assert!(
            serde_json::from_str::<CommitOutcome<u32, String, String>>(
                r#"{"status":"unknown","identity":"opaque","sql":"SELECT secret"}"#
            )
            .is_err()
        );
    }
    #[test]
    fn migration_versions_are_independent_and_bounded() {
        let valid = serde_json::json!({"operationContractVersion":1,"number":9_007_199_254_740_991_u64,"storageSchemaVersion":2,"domainSchemaVersion":1});
        assert!(serde_json::from_value::<MigrationCheckpoint>(valid.clone()).is_ok());
        for (field, value) in [
            ("operationContractVersion", serde_json::json!(2)),
            ("number", serde_json::json!(9_007_199_254_740_992_u64)),
            ("storageSchemaVersion", serde_json::json!(0)),
            ("domainSchemaVersion", serde_json::json!(0)),
            ("sql", serde_json::json!("SELECT private")),
        ] {
            let mut invalid = valid.clone();
            invalid[field] = value;
            assert!(serde_json::from_value::<MigrationCheckpoint>(invalid).is_err());
        }
        assert!(
            MigrationCheckpoint {
                operation_contract_version: 1,
                number: 0,
                storage_schema_version: 1,
                domain_schema_version: 1
            }
            .supported()
        );
        assert!(
            !MigrationCheckpoint {
                operation_contract_version: 2,
                number: 0,
                storage_schema_version: 1,
                domain_schema_version: 1
            }
            .supported()
        );
    }
}
