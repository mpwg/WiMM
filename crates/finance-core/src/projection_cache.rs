// SPDX-License-Identifier: AGPL-3.0-or-later
//! Cachewerte werden ausschließlich gegen dieselben Fachprojektionen verglichen.
use crate::{
    CoreResult,
    aggregate_schema::{INVALID, array, integer, kind, string},
    projections,
};
use serde_json::Value;
use std::collections::{BTreeMap, BTreeSet};
pub fn validate(all: &[Value], cached: &[Value]) -> CoreResult<()> {
    let expected = projections::rebuild(all)?;
    let balances: BTreeMap<&str, i64> = array(&expected["accountBalances"])?
        .iter()
        .map(|a| Ok((string(&a["accountId"])?, integer(&a["balance"])?)))
        .collect::<CoreResult<_>>()?;
    let accounts: BTreeSet<&str> = all
        .iter()
        .filter(|a| kind(a) == "account")
        .map(|a| string(&a["id"]))
        .collect::<CoreResult<_>>()?;
    for cache in cached {
        let key = string(&cache["key"])?;
        let payload = &cache["payload"];
        match cache["kind"].as_str().unwrap_or("") {
            "balance" => {
                if !accounts.contains(key)
                    || integer(payload)? != balances.get(key).copied().unwrap_or(0)
                {
                    return Err(INVALID);
                }
            }
            "accountBalance" => {
                if !accounts.contains(key)
                    || payload.as_object().is_none_or(|o| {
                        o.keys()
                            .any(|k| !["accountId", "balance"].contains(&k.as_str()))
                    })
                    || integer(&payload["balance"])? != balances.get(key).copied().unwrap_or(0)
                    || payload
                        .get("accountId")
                        .is_some_and(|id| id.as_str() != Some(key))
                {
                    return Err(INVALID);
                }
            }
            "consumption" => {
                if payload.as_object().is_none_or(|o| {
                    o.len() != 4
                        || o.keys().any(|k| {
                            !["income", "expense", "net", "categories"].contains(&k.as_str())
                        })
                }) {
                    return Err(INVALID);
                }
                let current = if key == "all" {
                    expected["consumption"].clone()
                } else {
                    crate::calendar::parse_year_month(key).map_err(|_| INVALID)?;
                    let month = all
                        .iter()
                        .filter(|a| {
                            kind(a) != "transaction"
                                || a["date"].as_str().is_some_and(|d| d.starts_with(key))
                        })
                        .cloned()
                        .collect::<Vec<_>>();
                    projections::consumption(&month)?
                };
                for field in ["income", "expense", "net"] {
                    if integer(&payload[field])? != integer(&current[field])? {
                        return Err(INVALID);
                    }
                }
                let actual = array(&payload["categories"])?;
                let expected = array(&current["categories"])?;
                if actual.len() != expected.len() {
                    return Err(INVALID);
                }
                let mut seen = BTreeSet::new();
                for row in actual {
                    if row.as_object().is_none_or(|o| {
                        o.len() != 3
                            || o.keys().any(|k| {
                                !["categoryId", "groupKind", "amount"].contains(&k.as_str())
                            })
                    }) {
                        return Err(INVALID);
                    }
                    let id = string(&row["categoryId"])?;
                    if !seen.insert(id) {
                        return Err(INVALID);
                    }
                    let target = expected
                        .iter()
                        .find(|a| a["categoryId"] == id)
                        .ok_or(INVALID)?;
                    if row["groupKind"] != target["groupKind"]
                        || integer(&row["amount"])? != integer(&target["amount"])?
                    {
                        return Err(INVALID);
                    }
                }
            }
            _ => return Err(INVALID),
        }
    }
    Ok(())
}
#[cfg(feature = "contract-probe")]
pub fn cache_json(input: &str) -> String {
    crate::output((|| {
        let v = crate::decode(input)?;
        let all = array(&v["aggregates"])?;
        crate::state_validation::validate(all, string(&v["spaceId"])?)?;
        validate(all, array(&v["projections"])?)?;
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
