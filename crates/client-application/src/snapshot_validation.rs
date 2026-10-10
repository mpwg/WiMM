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

/// Bildet nur lokale Cacheadressen; sämtliche Centwerte berechnet der Fachkern.
pub fn rebuild_projection_cache(
    snapshot: &LocalSnapshot,
) -> Result<Vec<wimm_local_contracts::storage::StoredProjection>, StorageFailure> {
    use std::collections::{BTreeMap, BTreeSet};
    use wimm_finance_types::{
        models::Aggregate,
        scalars::{MoneyCents, NonEmptyText},
    };
    use wimm_local_contracts::storage::{BalancePayload, StoredProjection};
    let invalid = || StorageFailure::not_committed(StorageFailureCode::WriteFailed);
    let all = snapshot
        .aggregates
        .iter()
        .map(|entry| entry.aggregate.clone())
        .collect::<Vec<_>>();
    validate(
        wimm_finance_types::state_contracts::ValidationRequest::Historical {
            contract_version: 1.into(),
            domain_schema_version: 1.into(),
            space_id: snapshot.space_id.clone(),
            aggregates: all.clone(),
        },
    )
    .map_err(|_| invalid())?;
    let projection =
        wimm_finance_core::project(wimm_finance_types::state_contracts::ProjectionRequest {
            contract_version: 1.into(),
            domain_schema_version: 1.into(),
            space_id: snapshot.space_id.clone(),
            aggregates: all.clone(),
        })
        .map_err(|_| invalid())?;
    let balances = projection
        .account_balances
        .into_iter()
        .map(|entry| (entry.account_id, entry.balance))
        .collect::<BTreeMap<_, _>>();
    let mut accounts = all
        .iter()
        .filter_map(|entry| {
            if let Aggregate::Account(account) = entry {
                Some(account)
            } else {
                None
            }
        })
        .collect::<Vec<_>>();
    accounts.sort_by(|a, b| a.id.as_str().cmp(b.id.as_str()));
    let zero = MoneyCents::new(0).map_err(|_| invalid())?;
    let mut result = accounts
        .into_iter()
        .map(|account| StoredProjection::AccountBalance {
            space_id: snapshot.space_id.clone(),
            key: account.id.clone(),
            payload: BalancePayload {
                account_id: None,
                balance: balances.get(&account.id).copied().unwrap_or(zero),
            },
        })
        .collect::<Vec<_>>();
    result.push(StoredProjection::Consumption {
        space_id: snapshot.space_id.clone(),
        key: NonEmptyText::new("all".into()).map_err(|_| invalid())?,
        payload: projection.consumption,
    });
    let mut months = all
        .iter()
        .filter_map(|entry| match entry {
            Aggregate::Transaction(tx) if tx.deleted_at.is_none() => {
                Some(tx.date.as_str()[..7].to_string())
            }
            _ => None,
        })
        .collect::<BTreeSet<_>>();
    for cached in &snapshot.projections {
        if let StoredProjection::Consumption { key, .. } = cached
            && key.as_str() != "all"
        {
            wimm_finance_core::calendar::parse_year_month(key.as_str()).map_err(|_| invalid())?;
            months.insert(key.as_str().to_owned());
        }
    }
    for month in months {
        let selected = all
            .iter()
            .filter(|entry| match entry {
                Aggregate::Transaction(tx) => tx.date.as_str().starts_with(&month),
                _ => true,
            })
            .cloned()
            .collect::<Vec<_>>();
        result.push(StoredProjection::Consumption {
            space_id: snapshot.space_id.clone(),
            key: NonEmptyText::new(month).map_err(|_| invalid())?,
            payload: wimm_finance_core::project(
                wimm_finance_types::state_contracts::ProjectionRequest {
                    contract_version: 1.into(),
                    domain_schema_version: 1.into(),
                    space_id: snapshot.space_id.clone(),
                    aggregates: selected,
                },
            )
            .map_err(|_| invalid())?
            .consumption,
        });
    }
    Ok(result)
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn rebuilt_current_cache_uses_locked_projection_oracle_without_changing_originals() {
        use wimm_finance_types::{models::Aggregate, scalars::EntityId};
        use wimm_local_contracts::storage::{StoredAggregate, StoredProjection};
        let catalog: Vec<serde_json::Value> = serde_json::from_str(include_str!(
            "../../finance-core/tests/fixtures/contract-catalog.json"
        ))
        .unwrap();
        let case = catalog
            .iter()
            .find(|case| {
                case["method"] == "project"
                    && case["expected"]["status"] == "projected"
                    && !case["expected"]["projections"]["accountBalances"]
                        .as_array()
                        .unwrap()
                        .is_empty()
            })
            .unwrap();
        let all: Vec<Aggregate> =
            serde_json::from_value(case["request"]["aggregates"].clone()).unwrap();
        let snapshot = LocalSnapshot {
            storage_schema_version: wimm_local_contracts::storage::SnapshotStorageVersion::new(2)
                .unwrap(),
            domain_schema_version: wimm_local_contracts::storage::SnapshotDomainVersion::new(1)
                .unwrap(),
            profile_id: EntityId::new("10000000-0000-4000-8000-000000000001".into()).unwrap(),
            space_id: serde_json::from_value(case["request"]["spaceId"].clone()).unwrap(),
            epoch: EntityId::new("10000000-0000-4000-8000-000000000003".into()).unwrap(),
            aggregates: all
                .into_iter()
                .map(|aggregate| StoredAggregate {
                    handle: aggregate.id().clone(),
                    aggregate,
                })
                .collect(),
            confirmed: vec![],
            pending: vec![],
            projections: vec![],
            sync_state: None,
        };
        let before = serde_json::to_value(&snapshot).unwrap();
        let caches = rebuild_projection_cache(&snapshot).unwrap();
        assert_eq!(serde_json::to_value(&snapshot).unwrap(), before);
        let actual = serde_json::to_value(&caches).unwrap();
        for expected in case["expected"]["projections"]["accountBalances"]
            .as_array()
            .unwrap()
        {
            assert!(
                actual
                    .as_array()
                    .unwrap()
                    .iter()
                    .any(|row| row["kind"] == "accountBalance"
                        && row["key"] == expected["accountId"]
                        && row["payload"]["balance"] == expected["balance"])
            );
        }
        assert!(
            actual
                .as_array()
                .unwrap()
                .iter()
                .any(|row| row["kind"] == "consumption"
                    && row["key"] == "all"
                    && row["payload"] == case["expected"]["projections"]["consumption"])
        );
        assert!(
            !caches
                .iter()
                .any(|row| matches!(row, StoredProjection::Balance { .. }))
        );
    }
}
