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
