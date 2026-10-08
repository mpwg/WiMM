// SPDX-License-Identifier: AGPL-3.0-or-later
//! Abgleich ohne Geldmutation; verbundene Transfers werden gemeinsam entsperrt.
use crate::{
    CoreResult,
    aggregate_schema::{self, array, integer, kind, live, string},
    financial_commands as financial,
    master_commands::{Expectation, Request},
    projections,
};
use serde_json::{Value, json};
use std::collections::{BTreeMap, BTreeSet};
const COMMAND: (&str, &str) = ("INVALID_COMMAND", "Der Fachbefehl ist ungültig.");
fn read<'a>(current: &BTreeMap<&str, &'a Value>, id: &Value, ty: &str) -> CoreResult<&'a Value> {
    current
        .get(string(id)?)
        .copied()
        .filter(|a| kind(a) == ty)
        .ok_or(("INVALID_AGGREGATE", "Eine Abgleichbuchung fehlt."))
}
fn add_expected(expected: &mut Vec<Expectation>, a: &Value) -> CoreResult<()> {
    let id = string(&a["id"])?;
    if !expected.iter().any(|e| e.id == id) {
        expected.push(Expectation {
            id: id.to_string(),
            expected_revision: integer(&a["revision"])?,
        });
    }
    Ok(())
}
pub fn execute(decoded: Value) -> CoreResult<Value> {
    execute_with_record(decoded, None)
}
pub(crate) fn execute_with_record(
    decoded: Value,
    override_record: Option<Value>,
) -> CoreResult<Value> {
    let request: Request = serde_json::from_value(decoded).map_err(|_| COMMAND)?;
    if request.contract_version != 1
        || request.domain_schema_version != 1
        || !crate::valid_id(&request.space_id)
        || !crate::valid_id(&request.context.operation_id)
        || !aggregate_schema::timestamp(&request.context.occurred_at)
        || request
            .context
            .generated_ids
            .iter()
            .any(|id| !crate::valid_id(id))
    {
        return Err(COMMAND);
    }
    for a in &request.aggregates {
        aggregate_schema::aggregate(a).map_err(|_| COMMAND)?;
    }
    let current: BTreeMap<&str, &Value> = request
        .aggregates
        .iter()
        .map(|a| Ok((string(&a["id"])?, a)))
        .collect::<CoreResult<_>>()?;
    let command = string(&request.command["commandType"])?;
    let time = &request.context.occurred_at;
    let space = &request.space_id;
    let mut expected = request.expected_revisions.clone();
    let mut changes = vec![];
    if command == "reconciliation.confirm" {
        if request.command.as_object().is_none_or(|o| o.len() != 5)
            || !request.command["accountId"]
                .as_str()
                .is_some_and(crate::valid_id)
            || crate::calendar::parse_finance_date(
                request.command["statementDate"].as_str().unwrap_or(""),
            )
            .is_err()
            || integer(&request.command["statementBalance"]).is_err()
        {
            return Err(COMMAND);
        }
        let ids = array(&request.command["selectedTransactionIds"]).map_err(|_| COMMAND)?;
        if ids.is_empty()
            || ids
                .iter()
                .any(|id| !id.as_str().is_some_and(crate::valid_id))
        {
            return Err(COMMAND);
        }
        let mut unique = BTreeSet::new();
        for id in ids {
            if !unique.insert(string(id)?) {
                return Err((
                    "DUPLICATE_REFERENCE",
                    "Eine Abgleichbuchung darf nur einmal vorkommen.",
                ));
            }
        }
        let account = read(&current, &request.command["accountId"], "account")?;
        let rec = if let Some(record) = override_record.as_ref() {
            record.clone()
        } else {
            let id = request.context.generated_ids.first().ok_or((
                "INVALID_GENERATOR",
                "Die erzeugte Aggregat-ID ist ungültig.",
            ))?;
            let rec = json!({"id":id,"spaceId":space,"revision":1,"createdAt":time,"updatedAt":time,"aggregateType":"reconciliation","accountId":account["id"],"statementDate":request.command["statementDate"],"statementBalance":request.command["statementBalance"],"transactionIds":ids});
            rec
        };
        let selected = ids
            .iter()
            .map(|id| read(&current, id, "transaction"))
            .collect::<CoreResult<Vec<_>>>()?;
        for tx in &selected {
            financial::normalize((*tx).clone())?;
            if tx["spaceId"] != *space || tx["accountId"] != account["id"] || !live(tx) {
                return Err((
                    "INVALID_AGGREGATE",
                    "Eine Abgleichbuchung passt nicht zum Kontoauszug.",
                ));
            }
        }
        let previous: Vec<_> = request
            .aggregates
            .iter()
            .filter(|a| {
                kind(a) == "transaction"
                    && live(a)
                    && a["accountId"] == account["id"]
                    && a["clearance"] == "reconciled"
                    && a["date"].as_str() <= request.command["statementDate"].as_str()
                    && !ids.contains(&a["id"])
            })
            .collect();
        let mut sum = 0;
        for tx in previous.iter().chain(&selected) {
            financial::normalize((*tx).clone())?;
            if tx["spaceId"] != *space
                || tx["date"].as_str() > request.command["statementDate"].as_str()
            {
                return Err((
                    "INVALID_AGGREGATE",
                    "Die Auszugsauswahl enthält unpassende oder doppelte Buchungen.",
                ));
            }
            sum = projections::add(
                sum,
                integer(&tx["amount"])?,
                "Die Geldsumme überschreitet den sicheren Centbereich.",
            )?;
        }
        let difference = projections::add(
            integer(&rec["statementBalance"])?,
            -sum,
            "Die Auszugsdifferenz überschreitet den sicheren Centbereich.",
        )?;
        if difference != 0 {
            return Err((
                "INVALID_COMMAND",
                "Die Auszugsdifferenz muss vor der Bestätigung null sein.",
            ));
        }
        if selected.iter().any(|tx| tx["clearance"] == "reconciled") {
            return Err((
                "INVALID_COMMAND",
                "Bereits abgeglichene Buchungen gehören zum bestätigten Ausgangssaldo.",
            ));
        }
        changes.push(rec);
        for tx in &selected {
            let mut a = (*tx).clone();
            a["clearance"] = json!("reconciled");
            changes.push(financial::revise(a, time)?);
            add_expected(&mut expected, tx)?;
        }
        for tx in &previous {
            add_expected(&mut expected, tx)?;
        }
        add_expected(&mut expected, account)?;
    } else {
        if request.command.as_object().is_none_or(|o| o.len() != 2)
            || !request.command["reconciliationId"]
                .as_str()
                .is_some_and(crate::valid_id)
        {
            return Err(COMMAND);
        }
        let rec = read(
            &current,
            &request.command["reconciliationId"],
            "reconciliation",
        )?;
        if !live(rec) {
            return Err((
                "INVALID_COMMAND",
                "Der zugehörige vollständige Abgleich fehlt.",
            ));
        }
        let initial = array(&rec["transactionIds"])?;
        let seed = initial.first().ok_or(aggregate_schema::INVALID)?;
        let txs: Vec<_> = request
            .aggregates
            .iter()
            .filter(|a| kind(a) == "transaction" && live(a))
            .collect();
        let recs: Vec<_> = request
            .aggregates
            .iter()
            .filter(|a| kind(a) == "reconciliation" && live(a))
            .collect();
        let mut ids = if override_record.is_some() {
            initial
                .iter()
                .map(|id| Ok(string(id)?.to_string()))
                .collect::<CoreResult<BTreeSet<_>>>()?
        } else {
            BTreeSet::from([string(seed)?.to_string()])
        };
        let mut groups = if override_record.is_some() {
            BTreeSet::from([string(&rec["id"])?.to_string()])
        } else {
            BTreeSet::new()
        };
        let mut expanded = override_record.is_none();
        while expanded {
            expanded = false;
            for tx in txs
                .iter()
                .filter(|a| ids.contains(a["id"].as_str().unwrap_or("")))
                .copied()
                .collect::<Vec<_>>()
            {
                if let Some(id) = tx.get("transferId") {
                    let transfer = current
                        .get(string(id)?)
                        .copied()
                        .filter(|a| kind(a) == "transfer" && live(a))
                        .ok_or(("INVALID_AGGREGATE", "Die vollständige Umbuchung fehlt."))?;
                    let source = txs
                        .iter()
                        .find(|a| a["id"] == transfer["sourceTransactionId"]);
                    let target = txs
                        .iter()
                        .find(|a| a["id"] == transfer["targetTransactionId"]);
                    let valid = if let (Some(source), Some(target)) = (source, target) {
                        source["kind"] == "transfer"
                            && target["kind"] == "transfer"
                            && source["transferId"] == transfer["id"]
                            && target["transferId"] == transfer["id"]
                            && source["accountId"] == transfer["sourceAccountId"]
                            && target["accountId"] == transfer["targetAccountId"]
                            && source["date"] == transfer["date"]
                            && target["date"] == transfer["date"]
                            && integer(&source["amount"])? == -integer(&transfer["amount"])?
                            && target["amount"] == transfer["amount"]
                    } else {
                        false
                    };
                    if !valid {
                        return Err((
                            "INVALID_AGGREGATE",
                            "Die vollständigen Umbuchungsseiten passen nicht zum Abgleich.",
                        ));
                    }
                    for field in ["sourceTransactionId", "targetTransactionId"] {
                        if ids.insert(string(&transfer[field])?.to_string()) {
                            expanded = true;
                        }
                    }
                }
            }
            for rec in &recs {
                let id = string(&rec["id"])?;
                if !groups.contains(id)
                    && array(&rec["transactionIds"])?
                        .iter()
                        .any(|id| ids.contains(id.as_str().unwrap_or("")))
                {
                    groups.insert(id.to_string());
                    for id in array(&rec["transactionIds"])? {
                        ids.insert(string(id)?.to_string());
                    }
                    expanded = true;
                }
            }
        }
        if groups.is_empty() {
            return Err((
                "INVALID_COMMAND",
                "Der zugehörige vollständige Abgleich fehlt.",
            ));
        }
        let mut changed_index = BTreeMap::<String, usize>::new();
        for rec in recs
            .iter()
            .filter(|a| groups.contains(a["id"].as_str().unwrap_or("")))
        {
            let ids = array(&rec["transactionIds"])?;
            if ids
                .iter()
                .map(|id| id.as_str().unwrap_or(""))
                .collect::<BTreeSet<_>>()
                .len()
                != ids.len()
            {
                return Err((
                    "DUPLICATE_REFERENCE",
                    "Eine Abgleichbuchung darf nur einmal vorkommen.",
                ));
            }
            let account = read(&current, &rec["accountId"], "account")?;
            let mut tomb = (*rec).clone();
            tomb["deletedAt"] = tomb["updatedAt"].clone();
            changes.push(financial::revise(tomb, time)?);
            add_expected(&mut expected, rec)?;
            for id in array(&rec["transactionIds"])? {
                let tx = read(&current, id, "transaction")?;
                financial::normalize(tx.clone())?;
                if tx["spaceId"] != *space || tx["accountId"] != rec["accountId"] || !live(tx) {
                    return Err((
                        "INVALID_AGGREGATE",
                        "Eine Abgleichbuchung passt nicht zum Kontoauszug.",
                    ));
                }
                if tx["clearance"] != "reconciled" {
                    return Err((
                        "INVALID_COMMAND",
                        "Nur abgeglichene Buchungen können gemeinsam entsperrt werden.",
                    ));
                }
                let mut a = tx.clone();
                a["clearance"] = json!("cleared");
                let a = financial::revise(a, time)?;
                let id = string(id)?.to_string();
                if let Some(n) = changed_index.get(&id) {
                    changes[*n] = a;
                } else {
                    changed_index.insert(id, changes.len());
                    changes.push(a);
                }
                add_expected(&mut expected, tx)?;
            }
            add_expected(&mut expected, account)?;
        }
        for tx in txs
            .iter()
            .filter(|a| override_record.is_none() && ids.contains(a["id"].as_str().unwrap_or("")))
        {
            let id = string(&tx["id"])?;
            if !changed_index.contains_key(id) {
                if tx["clearance"] == "reconciled" {
                    return Err((
                        "INVALID_COMMAND",
                        "Der zugehörige vollständige Abgleich fehlt.",
                    ));
                }
                changes.push(financial::revise((*tx).clone(), time)?);
            }
            add_expected(&mut expected, tx)?;
            if let Some(id) = tx.get("transferId") {
                add_expected(&mut expected, read(&current, id, "transfer")?)?;
            }
        }
    }
    financial::inspect_changes(&changes, space, &expected, &current, &request)?;
    Ok(
        json!({"contractVersion":1,"status":"changed","changeSet":{"spaceId":space,"commandType":command,"operationId":request.context.operation_id,"occurredAt":time,"expectedRevisions":expected.iter().map(|e|json!({"id":e.id,"expectedRevision":e.expected_revision})).collect::<Vec<_>>(),"aggregates":changes}}),
    )
}
