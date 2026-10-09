// SPDX-License-Identifier: AGPL-3.0-or-later
//! Lokale Formbrücke; führt keine Migration oder Speicherung aus.
use wimm_local_contracts::{
    errors::{LocalContractError, LocalFormOutcome},
    models::StorageMigrationPlan,
};
#[uniffi::export]
pub fn validate_local_migration_form_v2(
    plan: StorageMigrationPlan,
) -> Result<LocalFormOutcome, LocalContractError> {
    wimm_local_contracts::api::validate_local_migration_form_v2(plan)
}
#[cfg(feature = "contract-probe")]
#[uniffi::export]
pub fn local_migration_from_json(
    input: String,
) -> Result<StorageMigrationPlan, LocalContractError> {
    serde_json::from_str(&input).map_err(|_| LocalContractError::invalid())
}

#[uniffi::export]
pub fn roundtrip_local_snapshot_v2(
    snapshot: wimm_local_contracts::storage::LocalSnapshot,
) -> Result<wimm_local_contracts::storage_api::SnapshotOutcomeV2, wimm_finance_types::ContractError>
{
    wimm_local_contracts::storage_api::roundtrip_local_snapshot_v2(snapshot)
}
#[cfg(feature = "contract-probe")]
#[uniffi::export]
pub fn local_snapshot_from_v1_json(
    input: String,
) -> Result<wimm_local_contracts::storage::LocalSnapshot, wimm_finance_types::ContractError> {
    wimm_local_contracts::storage_api::snapshot_from_v1_json(&input)
}
#[cfg(feature = "contract-probe")]
#[uniffi::export]
pub fn local_snapshot_to_v1_json(
    snapshot: wimm_local_contracts::storage::LocalSnapshot,
) -> Result<String, wimm_finance_types::ContractError> {
    wimm_local_contracts::storage_api::snapshot_to_v1_json(snapshot)
}
#[uniffi::export]
pub fn validate_local_port_form_v2(
    request: wimm_local_contracts::storage::LocalPortRequestV2,
) -> Result<wimm_local_contracts::errors::LocalFormOutcome, wimm_finance_types::ContractError> {
    wimm_local_contracts::storage_api::validate_local_port_form_v2(request)
}
#[cfg(feature = "contract-probe")]
#[uniffi::export]
pub fn local_port_from_json(
    input: String,
) -> Result<wimm_local_contracts::storage::LocalPortRequestV2, wimm_finance_types::ContractError> {
    serde_json::from_str(&input).map_err(|_| wimm_finance_types::ContractError::invalid_command())
}
