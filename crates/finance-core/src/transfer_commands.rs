// SPDX-License-Identifier: AGPL-3.0-or-later
//! Transfer und beide Seiten werden ausschließlich gemeinsam vorbereitet.
use crate::{
    CoreResult,
    aggregate_schema::{self, array, integer, kind, string},
    financial_commands as financial,
    master_commands::{Expectation, Request},
};
use serde_json::{Value, json};
use std::collections::BTreeMap;
const COMMAND: (&str, &str) = ("INVALID_COMMAND", "Der Fachbefehl ist ungültig.");
fn needed<'a>(
    current: &BTreeMap<&str, &'a Value>,
    id: &Value,
    ty: &str,
    space: &str,
) -> CoreResult<&'a Value> {
    current
        .get(string(id)?)
        .copied()
        .filter(|a| kind(a) == ty && a["spaceId"] == space)
        .ok_or((
            "INVALID_AGGREGATE",
            "Eine benötigte Referenz ist nicht im selben Bereich vorhanden.",
        ))
}
pub fn execute(decoded: Value) -> CoreResult<Value> {
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
    let deleting = command == "transfer.delete";
    if request.command.as_object().is_none_or(|o| o.len() != 2) {
        return Err(COMMAND);
    }
    let (transfer, source, target) = if deleting {
        let id = string(&request.command["aggregateId"]).map_err(|_| COMMAND)?;
        if !crate::valid_id(id) {
            return Err(COMMAND);
        }
        let transfer = current
            .get(id)
            .copied()
            .filter(|a| kind(a) == "transfer")
            .ok_or(aggregate_schema::INVALID)?;
        let source = needed(
            &current,
            &transfer["sourceTransactionId"],
            "transaction",
            &request.space_id,
        )?;
        let target = needed(
            &current,
            &transfer["targetTransactionId"],
            "transaction",
            &request.space_id,
        )?;
        (
            transfer.clone(),
            financial::normalize(source.clone())?,
            financial::normalize(target.clone())?,
        )
    } else {
        let entries = array(&request.command["aggregates"]).map_err(|_| COMMAND)?;
        if entries.len() != 3 {
            return Err((
                "INVALID_COMMAND",
                "Eine Umbuchung benötigt Transfer und beide vollständigen Seiten.",
            ));
        }
        for a in entries {
            aggregate_schema::aggregate(a).map_err(|_| COMMAND)?;
        }
        let transfer = entries
            .iter()
            .find(|a| kind(a) == "transfer")
            .ok_or(aggregate_schema::INVALID)?;
        let source = entries
            .iter()
            .find(|a| a["id"] == transfer["sourceTransactionId"])
            .ok_or(aggregate_schema::INVALID)?;
        let target = entries
            .iter()
            .find(|a| a["id"] == transfer["targetTransactionId"])
            .ok_or(aggregate_schema::INVALID)?;
        (
            transfer.clone(),
            financial::normalize(source.clone())?,
            financial::normalize(target.clone())?,
        )
    };
    if transfer["spaceId"] != request.space_id {
        return Err((
            "CROSS_SPACE_REFERENCE",
            "Die Umbuchung gehört zu einem anderen Bereich.",
        ));
    }
    let amount = integer(&transfer["amount"])?;
    if amount <= 0 {
        return Err((
            "INVALID_AGGREGATE",
            "Der Umbuchungsbetrag muss positiv sein.",
        ));
    }
    if transfer["sourceAccountId"] == transfer["targetAccountId"] {
        return Err((
            "INVALID_AGGREGATE",
            "Quell- und Zielkonto müssen verschieden sein.",
        ));
    }
    for (side, message) in [
        (
            &source,
            "Die Quellseite ist keine vollständige Umbuchungsseite.",
        ),
        (
            &target,
            "Die Zielseite ist keine vollständige Umbuchungsseite.",
        ),
    ] {
        if side["spaceId"] != request.space_id {
            return Err((
                "CROSS_SPACE_REFERENCE",
                "Die Umbuchungsbuchung gehört zu einem anderen Bereich.",
            ));
        }
        if side["kind"] != "transfer"
            || side["transferId"] != transfer["id"]
            || !array(&side["splits"])?.is_empty()
        {
            return Err(("INVALID_AGGREGATE", message));
        }
    }
    if source["id"] != transfer["sourceTransactionId"]
        || target["id"] != transfer["targetTransactionId"]
        || source["accountId"] != transfer["sourceAccountId"]
        || target["accountId"] != transfer["targetAccountId"]
        || source["date"] != transfer["date"]
        || target["date"] != transfer["date"]
        || integer(&source["amount"])? != -amount
        || integer(&target["amount"])? != amount
    {
        return Err((
            "INVALID_AGGREGATE",
            "Die Umbuchungsseiten müssen entgegengesetzte Beträge, Konten und dasselbe Datum besitzen.",
        ));
    }
    let source_account = needed(
        &current,
        &transfer["sourceAccountId"],
        "account",
        &request.space_id,
    )?;
    let target_account = needed(
        &current,
        &transfer["targetAccountId"],
        "account",
        &request.space_id,
    )?;
    let leaves = source_account["onBudget"] == true && target_account["onBudget"] == false;
    let enters = source_account["onBudget"] == false && target_account["onBudget"] == true;
    let budget = transfer.get("budgetCategoryId");
    if leaves && budget.is_none() {
        return Err((
            "INVALID_AGGREGATE",
            "Beim Verlassen des Budgets ist eine Ausgabenkategorie erforderlich.",
        ));
    }
    let category = budget
        .and_then(Value::as_str)
        .and_then(|id| current.get(id).copied());
    let group = category
        .and_then(|a| a["groupId"].as_str())
        .and_then(|id| current.get(id).copied());
    if leaves
        && (category.is_none_or(|a| kind(a) != "category" || a["spaceId"] != request.space_id)
            || group.is_none_or(|a| {
                kind(a) != "categoryGroup"
                    || a["spaceId"] != request.space_id
                    || a["kind"] != "expense"
            }))
    {
        return Err((
            "INVALID_AGGREGATE",
            "Der Budgetabgang benötigt eine Ausgabenkategorie im selben Bereich.",
        ));
    }
    if !leaves && budget.is_some() {
        return Err((
            "INVALID_AGGREGATE",
            "Eine Budgetkategorie ist nur beim Verlassen des Budgets zulässig.",
        ));
    }
    if enters != (transfer["budgetRelease"] == true) {
        return Err((
            "INVALID_AGGREGATE",
            "Beim Eintritt ins Budget muss vorhandenes Geld ausdrücklich freigegeben werden.",
        ));
    }
    let blocked = if deleting {
        "Abgeglichene Umbuchungen müssen vor dem Löschen atomar entsperrt werden."
    } else {
        "Abgeglichene Umbuchungen müssen vor Änderungen atomar entsperrt werden."
    };
    for side in [&source, &target] {
        if side["clearance"] == "reconciled"
            || current
                .get(string(&side["id"])?)
                .is_some_and(|a| kind(a) == "transaction" && a["clearance"] == "reconciled")
        {
            return Err(("INVALID_COMMAND", blocked));
        }
    }
    let mut expected = request.expected_revisions.clone();
    // Gelesene Konto-/Budgetreferenzen werden wie im bestehenden Handler aus dem Kopfstand verankert.
    for a in [Some(source_account), Some(target_account), category, group]
        .into_iter()
        .flatten()
    {
        let id = string(&a["id"])?;
        if !expected.iter().any(|e| e.id == id) {
            expected.push(Expectation {
                id: id.to_string(),
                expected_revision: integer(&a["revision"])?,
            });
        }
    }
    let mut changes = vec![transfer, source, target];
    if deleting {
        changes = changes
            .into_iter()
            .map(|mut a| {
                a["deletedAt"] = a["updatedAt"].clone();
                financial::revise(a, &request.context.occurred_at)
            })
            .collect::<CoreResult<_>>()?;
    }
    financial::inspect_changes(&changes, &request.space_id, &expected, &current, &request)?;
    let (changes, expected) = financial::prepare_financial(changes, expected, &request)?;
    financial::inspect_changes(&changes, &request.space_id, &expected, &current, &request)?;
    Ok(
        json!({"contractVersion":1,"status":"changed","changeSet":{"spaceId":request.space_id,"commandType":command,"operationId":request.context.operation_id,"occurredAt":request.context.occurred_at,"expectedRevisions":expected.iter().map(|e|json!({"id":e.id,"expectedRevision":e.expected_revision})).collect::<Vec<_>>(),"aggregates":changes}}),
    )
}
