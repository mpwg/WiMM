// SPDX-License-Identifier: AGPL-3.0-or-later
//! Gemeinsamer injizierter Snapshotvalidator; sämtliche Fach-/Cachearbeit bleibt im Kern.
use wimm_finance_core::{projection_cache, validate};
use wimm_local_contracts::{
    commit::SnapshotValidationPort, persistence_errors::*, storage::LocalSnapshot,
};
pub struct CoreSnapshotValidator;
impl SnapshotValidationPort for CoreSnapshotValidator {
    fn validate(&self, s: &LocalSnapshot) -> Result<(), StorageFailure> {
        // Die Fach-/Cacheengine bleibt ausschließlich im Rust-Fachkern.
        let invalid = || StorageFailure::not_committed(StorageFailureCode::WriteFailed);
        for aggregates in [
            s.aggregates.iter().map(|a| a.aggregate.clone()).collect(),
            s.confirmed
                .iter()
                .map(|a| a.aggregate.aggregate.clone())
                .collect(),
        ] {
            validate(
                wimm_finance_types::state_contracts::ValidationRequest::Historical {
                    contract_version: 1.into(),
                    domain_schema_version: 1.into(),
                    space_id: s.space_id.clone(),
                    aggregates,
                },
            )
            .map_err(|_| invalid())?;
        }
        let aggregates = s
            .aggregates
            .iter()
            .map(|a| serde_json::to_value(&a.aggregate))
            .collect::<Result<Vec<_>, _>>()
            .map_err(|_| invalid())?;
        let projections = s
            .projections
            .iter()
            .map(serde_json::to_value)
            .collect::<Result<Vec<_>, _>>()
            .map_err(|_| invalid())?;
        projection_cache::validate(&aggregates, &projections).map_err(|_| invalid())
    }
}
