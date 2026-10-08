// SPDX-License-Identifier: AGPL-3.0-or-later
//! Neue Referenzen benötigen lebende Ziele; unveränderte historische bleiben erhalten.
use crate::{
    CoreResult,
    aggregate_schema::{array, kind, live, string},
};
use serde_json::Value;
use std::collections::BTreeMap;
const INVALID: (&str, &str) = (
    "INVALID_AGGREGATE",
    "Neue Finanzreferenzen benötigen ein vorhandenes, nicht gelöschtes Ziel im selben Bereich.",
);
pub fn validate(changes: &[Value], current: &[Value]) -> CoreResult<()> {
    let before: BTreeMap<&str, &Value> = current
        .iter()
        .map(|a| Ok((string(&a["id"])?, a)))
        .collect::<CoreResult<_>>()?;
    let mut after = before.clone();
    for a in changes {
        after.insert(string(&a["id"])?, a);
    }
    let target = |id: &Value, ty: &str, space: &Value| -> CoreResult<&Value> {
        after
            .get(string(id)?)
            .copied()
            .filter(|a| kind(a) == ty && a["spaceId"] == *space && live(a))
            .ok_or(INVALID)
    };
    let category = |id: &Value, space: &Value| -> CoreResult<()> {
        let a = target(id, "category", space)?;
        target(&a["groupId"], "categoryGroup", space)?;
        Ok(())
    };
    for a in changes {
        if !live(a) {
            continue;
        }
        let previous = before.get(string(&a["id"])?).copied().filter(|a| live(a));
        let old = |field: &str| previous.and_then(|p| p.get(field));
        let space = &a["spaceId"];
        match kind(a) {
            "category" => {
                if old("groupId") != a.get("groupId") {
                    target(&a["groupId"], "categoryGroup", space)?;
                }
            }
            "transaction" => {
                for (field, ty) in [
                    ("accountId", "account"),
                    ("payeeId", "payee"),
                    ("transferId", "transfer"),
                ] {
                    if let Some(id) = a.get(field)
                        && old(field) != Some(id)
                    {
                        target(id, ty, space)?;
                    }
                }
                let old_splits: BTreeMap<&str, &Value> = previous
                    .map(|p| array(&p["splits"]))
                    .transpose()?
                    .unwrap_or(&[])
                    .iter()
                    .map(|s| Ok((string(&s["id"])?, &s["categoryId"])))
                    .collect::<CoreResult<_>>()?;
                for split in array(&a["splits"])? {
                    if old_splits.get(string(&split["id"])?).copied() != split.get("categoryId") {
                        category(&split["categoryId"], space)?;
                    }
                }
            }
            "transfer" => {
                for (field, ty) in [
                    ("sourceAccountId", "account"),
                    ("targetAccountId", "account"),
                    ("sourceTransactionId", "transaction"),
                    ("targetTransactionId", "transaction"),
                ] {
                    if old(field) != a.get(field) {
                        target(&a[field], ty, space)?;
                    }
                }
                if let Some(id) = a.get("budgetCategoryId")
                    && old("budgetCategoryId") != Some(id)
                {
                    category(id, space)?;
                }
            }
            _ => {}
        }
    }
    Ok(())
}
