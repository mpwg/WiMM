// SPDX-License-Identifier: AGPL-3.0-or-later
//! Cachewerte werden ausschließlich gegen dieselben Fachprojektionen verglichen.
use crate::{
    CoreResult,
    aggregate_schema::INVALID,
    models::{Aggregate, AggregateKind},
    projections::{self, Consumption},
    scalars::{EntityId, MoneyCents, present},
};
use serde::Deserialize;
use serde_json::Value;
use std::collections::{BTreeMap, BTreeSet};
#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct CachedAccountBalance {
    #[serde(default, deserialize_with = "present")]
    account_id: Option<EntityId>,
    balance: MoneyCents,
}
// Äußere Storagefelder bleiben Verantwortung des Speichervertrags. Hier werden
// ausschließlich die vorhandenen Projektionsarten und deren Payloads geprüft.
#[derive(Deserialize)]
#[serde(tag = "kind", rename_all = "camelCase")]
enum Cache {
    Balance {
        key: EntityId,
        payload: MoneyCents,
    },
    AccountBalance {
        key: EntityId,
        payload: CachedAccountBalance,
    },
    Consumption {
        key: String,
        payload: Consumption,
    },
}
pub fn validate(all: &[Value], cached: &[Value]) -> CoreResult<()> {
    let all = all
        .iter()
        .map(Aggregate::from_wire)
        .collect::<CoreResult<Vec<_>>>()?;
    let expected_balances = projections::typed_balances(&all)?;
    let balances = expected_balances
        .iter()
        .map(|a| (&a.account_id, a.balance))
        .collect::<BTreeMap<_, _>>();
    let consumption = projections::typed_consumption(&all)?;
    let accounts = all
        .iter()
        .filter(|a| a.kind() == AggregateKind::Account)
        .map(Aggregate::id)
        .collect::<BTreeSet<_>>();
    let zero = MoneyCents::new(0)?;
    for cache in cached {
        let cache: Cache = serde_json::from_value(cache.clone()).map_err(|_| INVALID)?;
        match cache {
            Cache::Balance { key, payload } => {
                if !accounts.contains(&key)
                    || payload != balances.get(&key).copied().unwrap_or(zero)
                {
                    return Err(INVALID);
                }
            }
            Cache::AccountBalance { key, payload } => {
                if !accounts.contains(&key)
                    || payload.balance != balances.get(&key).copied().unwrap_or(zero)
                    || payload.account_id.as_ref().is_some_and(|id| id != &key)
                {
                    return Err(INVALID);
                }
            }
            Cache::Consumption { key, payload } => {
                let month;
                let current = if key == "all" {
                    &consumption
                } else {
                    crate::calendar::parse_year_month(&key).map_err(|_| INVALID)?;
                    let all = all
                        .iter()
                        .filter(|a| match a {
                            Aggregate::Transaction(tx) => tx.date.as_str().starts_with(&key),
                            _ => true,
                        })
                        .cloned()
                        .collect::<Vec<_>>();
                    month = projections::typed_consumption(&all)?;
                    &month
                };
                if payload.income != current.income
                    || payload.expense != current.expense
                    || payload.net != current.net
                    || payload.categories.len() != current.categories.len()
                {
                    return Err(INVALID);
                }
                let mut seen = BTreeSet::new();
                for row in &payload.categories {
                    if !seen.insert(&row.category_id) {
                        return Err(INVALID);
                    }
                    let target = current
                        .categories
                        .iter()
                        .find(|a| a.category_id == row.category_id)
                        .ok_or(INVALID)?;
                    if row.group_kind != target.group_kind || row.amount != target.amount {
                        return Err(INVALID);
                    }
                }
            }
        }
    }
    Ok(())
}
#[cfg(feature = "contract-probe")]
pub fn cache_json(input: &str) -> String {
    crate::output((|| {
        let v = crate::decode(input)?;
        let all = crate::aggregate_schema::array(&v["aggregates"])?;
        crate::state_validation::validate(all, crate::aggregate_schema::string(&v["spaceId"])?)?;
        validate(all, crate::aggregate_schema::array(&v["projections"])?)?;
        Ok(serde_json::json!({"contractVersion":1,"status":"valid"}))
    })())
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn fremde_cacheadressen_werden_auch_im_leeren_bestand_abgewiesen() {
        assert_eq!(validate(&[],&[serde_json::json!({"kind":"balance","key":"30000000-0000-4000-8000-000000000001","payload":0})]).unwrap_err().0,"INVALID_AGGREGATE");
    }
}
