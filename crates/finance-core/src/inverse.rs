// SPDX-License-Identifier: AGPL-3.0-or-later
//! Fachliche Gegenbefehle verändern nur Aktionsaggregate, niemals Bereichssnapshots.
use crate::{
    CoreResult,
    aggregate_schema::{self, array, kind, string},
    financial_commands as financial,
    master_commands::{Expectation, Request},
};
use serde_json::{Value, json};
use std::collections::{BTreeMap, BTreeSet};
const INVALID: (&str, &str) = ("INVALID_COMMAND", "Der Fachbefehl ist ungültig.");
fn action(request: &Request, command: Value, expected: Vec<Expectation>) -> Value {
    json!({"contractVersion":1,"domainSchemaVersion":1,"spaceId":request.space_id,"aggregates":request.aggregates,"command":command,"expectedRevisions":expected.iter().map(|e|json!({"id":e.id,"expectedRevision":e.expected_revision})).collect::<Vec<_>>(),"context":{"operationId":request.context.operation_id,"occurredAt":request.context.occurred_at,"generatedIds":request.context.generated_ids}})
}
fn expectations(aggs: &[&Value], current: &BTreeMap<&str, &Value>) -> CoreResult<Vec<Expectation>> {
    let mut ids = BTreeSet::new();
    aggs.iter()
        .filter(|a| ids.insert(a["id"].as_str().unwrap_or("")))
        .map(|a| {
            let id = string(&a["id"])?;
            Ok(Expectation {
                id: id.to_string(),
                expected_revision: current
                    .get(id)
                    .map(|a| crate::aggregate_schema::integer(&a["revision"]))
                    .transpose()?
                    .unwrap_or(0),
            })
        })
        .collect()
}
pub fn reverse_json(input: &str) -> String {
    crate::output(reverse(crate::decode(input).and_then(|mut v| {
        let object = v.as_object_mut().ok_or(INVALID)?;
        if object.len() != 7 {
            return Err(INVALID);
        }
        let targets = object.remove("targets").ok_or(INVALID)?;
        object.insert(
            "command".to_string(),
            json!({"commandType":"transaction.save"}),
        );
        Ok((v, targets))
    })))
}
fn reverse(input: CoreResult<(Value, Value)>) -> CoreResult<Value> {
    let (v, targets) = input?;
    let request: Request = serde_json::from_value(v).map_err(|_| INVALID)?;
    if !crate::valid_id(&request.space_id)
        || !crate::valid_id(&request.context.operation_id)
        || !aggregate_schema::timestamp(&request.context.occurred_at)
        || request
            .context
            .generated_ids
            .iter()
            .any(|id| !crate::valid_id(id))
    {
        return Err(INVALID);
    }
    for a in &request.aggregates {
        aggregate_schema::aggregate(a).map_err(|_| INVALID)?;
    }
    let targets = array(&targets).map_err(|_| INVALID)?;
    if targets.is_empty() {
        return Err(INVALID);
    }
    let current: BTreeMap<&str, &Value> = request
        .aggregates
        .iter()
        .map(|a| Ok((string(&a["id"])?, a)))
        .collect::<CoreResult<_>>()?;
    let mut desired = vec![];
    let mut positions = BTreeMap::new();
    for target in targets {
        if target
            .as_object()
            .is_none_or(|o| o.keys().any(|k| !["id", "previous"].contains(&k.as_str())))
            || !target["id"].as_str().is_some_and(crate::valid_id)
        {
            return Err(INVALID);
        }
        if let Some(previous) = target.get("previous") {
            aggregate_schema::aggregate(previous).map_err(|_| INVALID)?;
            if !["transaction", "transfer", "reconciliation"].contains(&kind(previous)) {
                return Err((
                    "INVALID_COMMAND",
                    "Nur Finanzaktionen besitzen Gegenbefehle.",
                ));
            }
        }
        let head = current
            .get(string(&target["id"])?)
            .copied()
            .filter(|a| {
                ["transaction", "transfer", "reconciliation"].contains(&kind(a))
                    && a["spaceId"] == request.space_id
            })
            .ok_or((
                "REVISION_CONFLICT",
                "Die Aktion gehört nicht zum aktuellen Bereich.",
            ))?;
        let previous = target.get("previous");
        let mut value = if previous.is_none_or(|a| a.get("deletedAt").is_some()) {
            let mut a = head.clone();
            a["deletedAt"] = json!(request.context.occurred_at);
            a
        } else {
            let mut a = previous.ok_or(INVALID)?.clone();
            a.as_object_mut().ok_or(INVALID)?.remove("deletedAt");
            a["revision"] = head["revision"].clone();
            a
        };
        value = financial::revise(value, &request.context.occurred_at)?;
        let id = string(&target["id"])?;
        if let Some(n) = positions.get(id) {
            desired[*n] = value;
        } else {
            positions.insert(id.to_string(), desired.len());
            desired.push(value);
        }
    }
    financial::inspect_changes(
        &desired,
        &request.space_id,
        &request.expected_revisions,
        &current,
        &request,
    )?;
    let (checked, expected) = financial::prepare_financial(
        desired.clone(),
        request.expected_revisions.clone(),
        &request,
    )?;
    financial::inspect_changes(&checked, &request.space_id, &expected, &current, &request)?;
    let mut children = vec![];
    let mut owned = BTreeSet::new();
    for entry in desired.iter().filter(|a| kind(a) == "reconciliation") {
        let mut transactions = vec![];
        for id in array(&entry["transactionIds"])? {
            owned.insert(string(id)?.to_string());
            transactions.push(
                current
                    .get(string(id)?)
                    .copied()
                    .ok_or(("INVALID_AGGREGATE", "Die Abgleichbuchung fehlt."))?,
            );
        }
        let account = current
            .get(string(&entry["accountId"])?)
            .copied()
            .ok_or(aggregate_schema::INVALID)?;
        let mut reads = vec![
            current
                .get(string(&entry["id"])?)
                .copied()
                .ok_or(aggregate_schema::INVALID)?,
        ];
        reads.extend(transactions.iter().copied());
        let mut child_request = request.clone();
        let command = if entry.get("deletedAt").is_some() {
            json!({"commandType":"reconciliation.unlock","reconciliationId":entry["id"]})
        } else {
            for a in request.aggregates.iter().filter(|a| {
                kind(a) == "transaction"
                    && a.get("deletedAt").is_none()
                    && a["accountId"] == entry["accountId"]
                    && a["clearance"] == "reconciled"
                    && a["date"].as_str() <= entry["statementDate"].as_str()
                    && !owned.contains(a["id"].as_str().unwrap_or(""))
            }) {
                reads.push(a);
            }
            child_request
                .context
                .generated_ids
                .insert(0, string(&entry["id"])?.to_string());
            json!({"commandType":"reconciliation.confirm","accountId":entry["accountId"],"statementDate":entry["statementDate"],"statementBalance":entry["statementBalance"],"selectedTransactionIds":entry["transactionIds"]})
        };
        reads.push(account);
        let mut result = crate::reconciliation_commands::execute_with_record(
            action(&child_request, command, expectations(&reads, &current)?),
            Some(entry.clone()),
        )?;
        if entry.get("deletedAt").is_some() {
            for a in result["changeSet"]["aggregates"]
                .as_array_mut()
                .ok_or(INVALID)?
            {
                if kind(a) == "transaction"
                    && let Some(target) = desired.iter().find(|v| v["id"] == a["id"])
                {
                    if target["clearance"] != "cleared" && target["clearance"] != "uncleared" {
                        return Err(("INVALID_COMMAND", "Ungültiger Gegenbefehl zum Entsperren."));
                    }
                    a["clearance"] = target["clearance"].clone();
                }
            }
        }
        children.push(result);
    }
    for entry in desired.iter().filter(|a| kind(a) == "transfer") {
        let deleting = entry.get("deletedAt").is_some();
        let values = if deleting {
            &request.aggregates
        } else {
            &desired
        };
        let source = values
            .iter()
            .find(|a| a["id"] == entry["sourceTransactionId"])
            .ok_or((
                "INVALID_AGGREGATE",
                "Der Gegenbefehl benötigt beide Umbuchungsseiten.",
            ))?;
        let target = values
            .iter()
            .find(|a| a["id"] == entry["targetTransactionId"])
            .ok_or((
                "INVALID_AGGREGATE",
                "Der Gegenbefehl benötigt beide Umbuchungsseiten.",
            ))?;
        owned.insert(string(&source["id"])?.to_string());
        owned.insert(string(&target["id"])?.to_string());
        let transfer = if deleting {
            current
                .get(string(&entry["id"])?)
                .copied()
                .ok_or(aggregate_schema::INVALID)?
        } else {
            entry
        };
        let mut reads = vec![transfer, source, target];
        for field in ["sourceAccountId", "targetAccountId"] {
            reads.push(
                current
                    .get(string(&entry[field])?)
                    .copied()
                    .ok_or(aggregate_schema::INVALID)?,
            );
        }
        if let Some(id) = entry.get("budgetCategoryId") {
            let category = current
                .get(string(id)?)
                .copied()
                .ok_or(aggregate_schema::INVALID)?;
            reads.push(category);
            reads.push(
                current
                    .get(string(&category["groupId"])?)
                    .copied()
                    .ok_or(aggregate_schema::INVALID)?,
            );
        }
        let command = if deleting {
            json!({"commandType":"transfer.delete","aggregateId":entry["id"]})
        } else {
            json!({"commandType":"transfer.save","aggregates":[transfer,source,target]})
        };
        children.push(crate::transfer_commands::execute(action(
            &request,
            command,
            expectations(&reads, &current)?,
        ))?);
    }
    for entry in desired
        .iter()
        .filter(|a| kind(a) == "transaction" && !owned.contains(a["id"].as_str().unwrap_or("")))
    {
        let head = current
            .get(string(&entry["id"])?)
            .copied()
            .ok_or(aggregate_schema::INVALID)?;
        if entry["kind"] == "transfer" {
            let mut before = head.clone();
            let mut after = entry.clone();
            for value in [&mut before, &mut after] {
                let o = value.as_object_mut().ok_or(INVALID)?;
                o.remove("revision");
                o.remove("updatedAt");
            }
            if before != after {
                return Err((
                    "INVALID_COMMAND",
                    "Eine einzelne Umbuchungsseite darf nicht geändert werden.",
                ));
            }
            continue;
        }
        let mut reads = vec![head];
        let mut refs = vec![&entry["accountId"]];
        refs.extend(array(&entry["splits"])?.iter().map(|s| &s["categoryId"]));
        if let Some(id) = entry.get("payeeId") {
            refs.push(id);
        }
        for id in refs {
            reads.push(
                current
                    .get(string(id)?)
                    .copied()
                    .ok_or(("INVALID_AGGREGATE", "Eine Referenz fehlt."))?,
            );
        }
        let command = if entry.get("deletedAt").is_some() {
            json!({"commandType":"transaction.delete","aggregateId":entry["id"]})
        } else {
            json!({"commandType":"transaction.save","aggregates":[entry]})
        };
        children.push(financial::execute(action(
            &request,
            command,
            expectations(&reads, &current)?,
        ))?);
    }
    let mut changes = vec![];
    let mut index = BTreeMap::new();
    let mut all_expected = request.expected_revisions.clone();
    let mut command = "reconciliation.unlock".to_string();
    for (n, child) in children.iter().enumerate() {
        let result = &child["changeSet"];
        if n == 0 {
            command = string(&result["commandType"])?.to_string();
        }
        for a in array(&result["aggregates"])? {
            let id = string(&a["id"])?;
            if let Some(n) = index.get(id) {
                changes[*n] = a.clone();
            } else {
                index.insert(id.to_string(), changes.len());
                changes.push(a.clone());
            }
        }
        for e in array(&result["expectedRevisions"])? {
            let id = string(&e["id"])?;
            let revision = crate::aggregate_schema::integer(&e["expectedRevision"])?;
            if let Some(old) = all_expected.iter_mut().find(|e| e.id == id) {
                old.expected_revision = revision;
            } else {
                all_expected.push(Expectation {
                    id: id.to_string(),
                    expected_revision: revision,
                });
            }
        }
    }
    for a in desired {
        let id = string(&a["id"])?;
        if !index.contains_key(id) {
            index.insert(id.to_string(), changes.len());
            changes.push(a);
        }
    }
    financial::inspect_changes(
        &changes,
        &request.space_id,
        &all_expected,
        &current,
        &request,
    )?;
    let (changes, expected) = if [
        "reconciliation.confirm",
        "reconciliation.unlock",
        "payee.merge",
    ]
    .contains(&command.as_str())
    {
        (changes, all_expected)
    } else {
        financial::prepare_financial(changes, all_expected, &request)?
    };
    financial::inspect_changes(&changes, &request.space_id, &expected, &current, &request)?;
    Ok(
        json!({"contractVersion":1,"status":"changed","changeSet":{"spaceId":request.space_id,"commandType":command,"operationId":request.context.operation_id,"occurredAt":request.context.occurred_at,"expectedRevisions":expected.iter().map(|e|json!({"id":e.id,"expectedRevision":e.expected_revision})).collect::<Vec<_>>(),"aggregates":changes}}),
    )
}
