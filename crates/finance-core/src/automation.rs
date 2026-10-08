// SPDX-License-Identifier: AGPL-3.0-or-later
//! Bestehende Regeln und Importklassifizierung; keine Dateiparser oder Persistenz.
use crate::{
    CoreResult,
    aggregate_schema::{self, array, integer, kind, live, string},
    projections, state_validation,
};
use serde_json::{Value, json};
use std::collections::{BTreeMap, BTreeSet};
use unicode_normalization::UnicodeNormalization;
const INVALID: (&str, &str) = ("INVALID_COMMAND", "Der Fachbefehl ist ungültig.");
pub fn active_reference<'a>(
    all: &'a [Value],
    space: &str,
    id: &Value,
    ty: &str,
) -> CoreResult<&'a Value> {
    all.iter()
        .find(|a| {
            a["id"] == *id
                && kind(a) == ty
                && a["spaceId"] == space
                && live(a)
                && a["archived"] != true
        })
        .ok_or((
            "INVALID_COMMAND",
            "Die Referenz ist nicht im aktiven Bereich verfügbar.",
        ))
}
pub fn fingerprint(row: &Value) -> CoreResult<String> {
    if let Some(s) = row.get("sourceFingerprint") {
        return Ok(string(s)?.to_string());
    }
    let text = |field: &str| {
        state_validation::normal_text(row[field].as_str().unwrap_or("")).to_lowercase()
    };
    Ok(json!([row["date"], row["amount"], text("payee"), text("memo")]).to_string())
}
pub fn validate_rule(rule: &Value, all: &[Value]) -> CoreResult<()> {
    state_validation::rule(rule)?;
    for action in array(&rule["actions"])? {
        if action["field"] != "clearance" {
            active_reference(
                all,
                string(&rule["spaceId"])?,
                &action["value"],
                if action["field"] == "categoryId" {
                    "category"
                } else {
                    "payee"
                },
            )?;
        }
    }
    Ok(())
}
pub fn duplicate(row: &Value, account: &Value, all: &[Value]) -> CoreResult<&'static str> {
    let fp = fingerprint(row)?;
    let source = row["parserSource"].as_str().unwrap_or("csv");
    let external = row["externalId"].as_str().filter(|s| !s.is_empty());
    let same: Vec<_> = all
        .iter()
        .filter(|a| {
            kind(a) == "importFingerprint"
                && a["accountId"] == *account
                && external.is_some_and(|id| a["parserSource"] == source && a["externalId"] == id)
        })
        .collect();
    if same.iter().any(|a| a["fingerprint"] != fp) {
        return Ok("conflict");
    }
    Ok(if external.is_some() {
        if same.is_empty() { "new" } else { "duplicate" }
    } else if all.iter().any(|a| {
        kind(a) == "importFingerprint" && a["accountId"] == *account && a["fingerprint"] == fp
    }) {
        "duplicate"
    } else {
        "new"
    })
}
pub fn calculate(decoded: Value) -> CoreResult<Value> {
    let space = decoded["spaceId"]
        .as_str()
        .filter(|s| crate::valid_id(s))
        .ok_or(INVALID)?;
    let all = array(&decoded["aggregates"]).map_err(|_| INVALID)?;
    for a in all {
        aggregate_schema::aggregate(a).map_err(|_| INVALID)?;
    }
    let ty = decoded["calculationType"].as_str().unwrap_or("");
    if ty == "rule.apply" {
        if decoded.as_object().is_none_or(|o| o.len() != 6) {
            return Err(INVALID);
        }
        aggregate_schema::candidate(&decoded["candidate"]).map_err(|_| INVALID)?;
        let mut result = decoded["candidate"].clone();
        result["sourceFingerprint"] = json!(fingerprint(&result)?);
        let mut rules: Vec<_> = all
            .iter()
            .filter(|a| {
                kind(a) == "rule" && a["enabled"] == true && live(a) && a["spaceId"] == space
            })
            .collect();
        rules.sort_by(|a, b| {
            a["order"].as_i64().cmp(&b["order"].as_i64()).then_with(|| {
                projections::uuid_order(
                    a["id"].as_str().unwrap_or(""),
                    b["id"].as_str().unwrap_or(""),
                )
            })
        });
        let mut applied = vec![];
        for rule in rules {
            validate_rule(rule, all)?;
            let mut matches = true;
            for c in array(&rule["conditions"])? {
                let field = string(&c["field"])?;
                let value = result.get(field).cloned().unwrap_or(json!(""));
                let other = &c["value"];
                let matched = match c["operator"].as_str().unwrap_or("") {
                    "equals" => value == *other,
                    "contains" => value
                        .as_str()
                        .unwrap_or("")
                        .nfc()
                        .collect::<String>()
                        .to_lowercase()
                        .contains(
                            &other
                                .as_str()
                                .unwrap_or("")
                                .nfc()
                                .collect::<String>()
                                .to_lowercase(),
                        ),
                    "gte" => {
                        if field == "amount" {
                            integer(&value)? >= integer(other)?
                        } else {
                            value.as_str() >= other.as_str()
                        }
                    }
                    "lte" => {
                        if field == "amount" {
                            integer(&value)? <= integer(other)?
                        } else {
                            value.as_str() <= other.as_str()
                        }
                    }
                    _ => false,
                };
                if !matched {
                    matches = false;
                    break;
                }
            }
            if !matches {
                continue;
            }
            for action in array(&rule["actions"])? {
                let field = string(&action["field"])?;
                result[field] = action["value"].clone();
                if field == "payeeId" {
                    result["payee"] =
                        active_reference(all, space, &action["value"], "payee")?["name"].clone();
                }
            }
            applied.push(rule["id"].clone());
            if rule["stopProcessing"] == true {
                break;
            }
        }
        return Ok(
            json!({"contractVersion":1,"status":"ruleApplied","candidate":result,"appliedRuleIds":applied}),
        );
    }
    if ty != "import.classify"
        || decoded.as_object().is_none_or(|o| o.len() != 7)
        || !decoded["accountId"].as_str().is_some_and(crate::valid_id)
    {
        return Err(INVALID);
    }
    let candidates = array(&decoded["candidates"]).map_err(|_| INVALID)?;
    for row in candidates {
        aggregate_schema::candidate(row).map_err(|_| INVALID)?;
    }
    let mut identities = BTreeMap::<(String, String), BTreeSet<String>>::new();
    let mut contents = BTreeSet::new();
    for f in all.iter().filter(|a| {
        kind(a) == "importFingerprint" && live(a) && a["accountId"] == decoded["accountId"]
    }) {
        let fp = string(&f["fingerprint"])?.to_string();
        contents.insert(fp.clone());
        if let Some(id) = f["externalId"].as_str().filter(|s| !s.is_empty()) {
            identities
                .entry((string(&f["parserSource"])?.to_string(), id.to_string()))
                .or_default()
                .insert(fp);
        }
    }
    let mut rows = vec![];
    let mut positions = BTreeMap::new();
    for row in candidates {
        let fp = fingerprint(row)?;
        let key = row["externalId"]
            .as_str()
            .filter(|s| !s.is_empty())
            .map(|id| {
                (
                    row["parserSource"].as_str().unwrap_or("csv").to_string(),
                    id.to_string(),
                )
            });
        let same = key.as_ref().and_then(|key| identities.get(key));
        let classification = if same.is_some_and(|values| values.iter().any(|s| s != &fp)) {
            "conflict"
        } else if key.is_some() {
            if same.is_some_and(|s| !s.is_empty()) {
                "duplicate"
            } else {
                "new"
            }
        } else if contents.contains(&fp) {
            "duplicate"
        } else {
            "new"
        };
        let result = json!({"sourceRow":row["sourceRow"],"classification":classification});
        let index = *positions
            .entry(integer(&row["sourceRow"])?)
            .or_insert_with(|| {
                rows.push(result.clone());
                rows.len() - 1
            });
        rows[index] = result;
        contents.insert(fp.clone());
        if let Some(key) = key {
            identities.entry(key).or_default().insert(fp);
        }
    }
    Ok(json!({"contractVersion":1,"status":"classified","rows":rows}))
}
