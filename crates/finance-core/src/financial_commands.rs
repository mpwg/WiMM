// SPDX-License-Identifier: AGPL-3.0-or-later
//! Buchungsbefehle mit geprüftem Folgebestand und atomarer Finanz-CAS-Vorbereitung.
use crate::{
    CoreResult, MAX_SAFE,
    aggregate_schema::{self, array, integer, kind, live, string},
    master_commands::{Expectation, Request},
    projections, state_validation,
};
use serde_json::{Value, json};
use std::collections::{BTreeMap, BTreeSet};
const COMMAND: (&str, &str) = ("INVALID_COMMAND", "Der Fachbefehl ist ungültig.");
pub(crate) fn revise(mut a: Value, time: &str) -> CoreResult<Value> {
    let revision = integer(&a["revision"])?;
    if revision == MAX_SAFE {
        return Err((
            "REVISION_OVERFLOW",
            "Die Aggregatrevision kann nicht mehr sicher erhöht werden.",
        ));
    }
    if time < string(&a["createdAt"])? {
        return Err((
            "INVALID_GENERATOR",
            "Der erzeugte Änderungszeitpunkt liegt vor dem Erstellungszeitpunkt.",
        ));
    }
    a["revision"] = json!(revision + 1);
    a["updatedAt"] = json!(time);
    Ok(a)
}
pub(crate) fn normalize(mut tx: Value) -> CoreResult<Value> {
    if kind(&tx) != "transaction" {
        return Err((
            "INVALID_AGGREGATE",
            "Die Buchung hat einen unpassenden Aggregattyp.",
        ));
    }
    state_validation::transaction(&tx)?;
    use unicode_normalization::UnicodeNormalization;
    for field in ["note", "importReference"] {
        if let Some(s) = tx.get(field).and_then(Value::as_str) {
            let n = s
                .nfc()
                .collect::<String>()
                .trim_matches(aggregate_schema::js_space)
                .to_string();
            if !n.is_empty() {
                tx[field] = json!(n);
            }
        }
    }
    Ok(tx)
}
fn require(
    tx: &Value,
    expected: &[Expectation],
    current: &BTreeMap<&str, &Value>,
) -> CoreResult<()> {
    let mut refs = vec![(
        &tx["accountId"],
        "account",
        "Das Buchungskonto benötigt eine erwartete Revision.",
        "Das Buchungskonto ist nicht als passendes Aggregat vorhanden.",
    )];
    for split in array(&tx["splits"])? {
        refs.push((
            &split["categoryId"],
            "category",
            "Die Splitkategorie benötigt eine erwartete Revision.",
            "Die Splitkategorie ist nicht als passendes Aggregat vorhanden.",
        ));
    }
    if let Some(id) = tx.get("payeeId") {
        refs.push((
            id,
            "payee",
            "Der Buchungsempfänger benötigt eine erwartete Revision.",
            "Der Buchungsempfänger ist nicht als passendes Aggregat vorhanden.",
        ));
    }
    for (id, ty, missing, absent) in refs {
        let id = string(id)?;
        if !expected.iter().any(|e| e.id == id) {
            return Err(("REVISION_MISSING", missing));
        }
        if current.get(id).is_none_or(|a| kind(a) != ty) {
            return Err(("INVALID_AGGREGATE", absent));
        }
    }
    Ok(())
}
pub(crate) fn inspect_changes(
    changes: &[Value],
    space: &str,
    expected: &[Expectation],
    current: &BTreeMap<&str, &Value>,
    request: &Request,
) -> CoreResult<()> {
    let mut r = request.clone();
    r.expected_revisions = expected.to_vec();
    let checked = crate::master_commands::expected(&r, current)?;
    let mut ids = BTreeSet::new();
    for a in changes {
        if string(&a["updatedAt"])? < string(&a["createdAt"])? {
            return Err((
                "INVALID_AGGREGATE",
                "Der Änderungszeitpunkt darf nicht vor dem Erstellungszeitpunkt liegen.",
            ));
        }
        if !ids.insert(string(&a["id"])?) {
            return Err((
                "DUPLICATE_REFERENCE",
                "Ein Aggregat darf in einer Änderungsmenge nur einmal vorkommen.",
            ));
        }
        crate::master_commands::transition(a, space, &checked, current)?;
    }
    Ok(())
}
pub(crate) fn prepare_financial(
    mut changes: Vec<Value>,
    mut expected: Vec<Expectation>,
    request: &Request,
) -> CoreResult<(Vec<Value>, Vec<Expectation>)> {
    let current = &request.aggregates;
    let space = &request.space_id;
    let time = &request.context.occurred_at;
    if current.iter().any(|a| a["spaceId"] != *space)
        || current
            .iter()
            .map(|a| a["id"].as_str().unwrap_or(""))
            .collect::<BTreeSet<_>>()
            .len()
            != current.len()
    {
        return Err((
            "INVALID_AGGREGATE",
            "Der Finanzbestand ist nicht eindeutig im aktuellen Bereich.",
        ));
    }
    crate::references::validate(&changes, current)?;
    let mut next = current.clone();
    let mut positions: BTreeMap<String, usize> = next
        .iter()
        .enumerate()
        .map(|(n, a)| Ok((string(&a["id"])?.to_string(), n)))
        .collect::<CoreResult<_>>()?;
    for a in &changes {
        let id = string(&a["id"])?;
        if let Some(n) = positions.get(id) {
            next[*n] = a.clone();
        } else {
            positions.insert(id.to_string(), next.len());
            next.push(a.clone());
        }
    }
    let mut txs: Vec<Value> = next
        .iter()
        .filter(|a| kind(a) == "transaction" && live(a))
        .cloned()
        .map(normalize)
        .collect::<CoreResult<_>>()?;
    txs.sort_by(|a, b| {
        projections::uuid_order(
            a["id"].as_str().unwrap_or(""),
            b["id"].as_str().unwrap_or(""),
        )
    });
    let balances = projections::balances(&txs)?;
    let mut total = 0;
    for balance in balances {
        total = projections::add(
            total,
            integer(&balance["balance"])?,
            "Der Gesamtkontostand überschreitet den sicheren Centbereich.",
        )?;
    }
    let categories: Vec<Value> = next
        .iter()
        .filter(|a| ["category", "categoryGroup"].contains(&kind(a)))
        .cloned()
        .collect();
    let mut projected = categories.clone();
    projected.extend(txs.clone());
    projections::consumption(&projected)?;
    let mut months = Vec::<(String, Vec<Value>)>::new();
    let mut month_index = BTreeMap::new();
    for tx in &txs {
        let key = &string(&tx["date"])?[..7];
        let n = *month_index.entry(key.to_string()).or_insert_with(|| {
            months.push((key.to_string(), vec![]));
            months.len() - 1
        });
        months[n].1.push(tx.clone());
    }
    for (_, month) in months {
        let mut sum = 0;
        for tx in &month {
            sum = projections::add(
                sum,
                integer(&tx["amount"])?,
                "Die Monatssumme überschreitet den sicheren Centbereich.",
            )?;
        }
        let mut all = categories.clone();
        all.extend(month);
        projections::consumption(&all)?;
    }
    let mut affected = BTreeSet::new();
    for tx in changes.iter().filter(|a| kind(a) == "transaction") {
        affected.insert(string(&tx["accountId"])?.to_string());
        if let Some(old) = current.iter().find(|a| a["id"] == tx["id"]) {
            affected.insert(string(&old["accountId"])?.to_string());
        }
    }
    let previous = current.iter().find(|a| a["id"] == *space);
    if previous.is_some_and(|a| kind(a) != "financialRevision")
        || changes
            .iter()
            .any(|a| a["id"] == *space && kind(a) != "financialRevision")
    {
        return Err((
            "INVALID_AGGREGATE",
            "Die reservierte lokale Finanzrevision ist nicht verfügbar.",
        ));
    }
    let guard = if let Some(a) = previous {
        revise(a.clone(), time)?
    } else {
        json!({"id":space,"spaceId":space,"aggregateType":"financialRevision","revision":1,"createdAt":time,"updatedAt":time})
    };
    if !changes.iter().any(|a| a["id"] == *space) {
        changes.push(guard);
    }
    let guard_revision = previous
        .map(|a| integer(&a["revision"]))
        .transpose()?
        .unwrap_or(0);
    if let Some(e) = expected.iter_mut().find(|e| e.id == *space) {
        e.expected_revision = guard_revision;
    } else {
        expected.push(Expectation {
            id: space.clone(),
            expected_revision: guard_revision,
        });
    }
    for a in current
        .iter()
        .filter(|a| ["category", "categoryGroup"].contains(&kind(a)))
    {
        let id = string(&a["id"])?;
        if !expected.iter().any(|e| e.id == id) {
            expected.push(Expectation {
                id: id.to_string(),
                expected_revision: integer(&a["revision"])?,
            });
        }
    }
    for a in current.iter().filter(|a| kind(a) == "account" && live(a)) {
        let id = string(&a["id"])?;
        if !expected.iter().any(|e| e.id == id) {
            expected.push(Expectation {
                id: id.to_string(),
                expected_revision: integer(&a["revision"])?,
            });
        }
        if affected.contains(id) && !changes.iter().any(|a| a["id"] == id) {
            changes.push(revise(a.clone(), time)?);
        }
    }
    Ok((changes, expected))
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
    if request.command.as_object().is_none_or(|o| o.len() != 2) {
        return Err(COMMAND);
    }
    if command == "account.save" {
        let entries = array(&request.command["aggregates"]).map_err(|_| COMMAND)?;
        if entries.len() != 2 {
            return Err((
                "INVALID_COMMAND",
                "Der Kontoeinstieg benötigt Konto und Anfangsbestand gemeinsam.",
            ));
        }
        for a in entries {
            aggregate_schema::aggregate(a).map_err(|_| COMMAND)?;
        }
        let account = crate::master_commands::normalize(entries[0].clone(), "account")?;
        let tx = normalize(entries[1].clone())?;
        if integer(&account["revision"])? != 1 || current.contains_key(string(&account["id"])?) {
            return Err((
                "INVALID_COMMAND",
                "Der Kontoeinstieg ist nur für ein neues Konto zulässig.",
            ));
        }
        if tx["kind"] != "opening"
            || tx["accountId"] != account["id"]
            || !live(&tx)
            || tx["clearance"] == "reconciled"
        {
            return Err((
                "INVALID_COMMAND",
                "Der Anfangsbestand muss zum neuen Konto gehören.",
            ));
        }
        let mut pending = current.clone();
        pending.insert(string(&account["id"])?, &account);
        require(&tx, &request.expected_revisions, &pending)?;
        let initial = vec![account, tx];
        inspect_changes(
            &initial,
            &request.space_id,
            &request.expected_revisions,
            &current,
            &request,
        )?;
        let (changes, expected) =
            prepare_financial(initial, request.expected_revisions.clone(), &request)?;
        inspect_changes(&changes, &request.space_id, &expected, &current, &request)?;
        return Ok(
            json!({"contractVersion":1,"status":"changed","changeSet":{"spaceId":request.space_id,"commandType":command,"operationId":request.context.operation_id,"occurredAt":request.context.occurred_at,"expectedRevisions":expected.iter().map(|e|json!({"id":e.id,"expectedRevision":e.expected_revision})).collect::<Vec<_>>(),"aggregates":changes}}),
        );
    }
    let deleting = command == "transaction.delete";
    let tx = if deleting {
        let id = string(&request.command["aggregateId"]).map_err(|_| COMMAND)?;
        if !crate::valid_id(id) {
            return Err(COMMAND);
        }
        normalize((*current.get(id).ok_or(aggregate_schema::INVALID)?).clone())?
    } else {
        let entries = array(&request.command["aggregates"]).map_err(|_| COMMAND)?;
        if entries.len() != 1 {
            return Err((
                "INVALID_COMMAND",
                "Der Buchungsbefehl benötigt genau eine vollständige Buchung.",
            ));
        }
        aggregate_schema::aggregate(&entries[0]).map_err(|_| COMMAND)?;
        normalize(entries[0].clone())?
    };
    let message = if deleting {
        "Abgeglichene Buchungen müssen vor dem Löschen atomar entsperrt werden."
    } else {
        "Abgeglichene Buchungen müssen vor einer Änderung atomar entsperrt werden."
    };
    if current
        .get(string(&tx["id"])?)
        .is_some_and(|a| kind(a) == "transaction" && a["clearance"] == "reconciled")
    {
        return Err(("INVALID_COMMAND", message));
    }
    if !deleting && !live(&tx) {
        return Err((
            "INVALID_COMMAND",
            "Eine gespeicherte Buchung darf kein Tombstone sein.",
        ));
    }
    if tx["clearance"] == "reconciled" {
        return Err(("INVALID_COMMAND", message));
    }
    if tx["kind"] == "transfer" {
        return Err((
            "INVALID_COMMAND",
            if deleting {
                "Umbuchungsseiten dürfen nur zusammen mit ihrer Gegenbuchung gelöscht werden."
            } else {
                "Umbuchungsseiten dürfen nur zusammen mit ihrer Gegenbuchung geändert werden."
            },
        ));
    }
    let tx = if deleting {
        let mut tx = tx;
        tx["deletedAt"] = tx["updatedAt"].clone();
        revise(tx, &request.context.occurred_at)?
    } else {
        tx
    };
    require(&tx, &request.expected_revisions, &current)?;
    inspect_changes(
        std::slice::from_ref(&tx),
        &request.space_id,
        &request.expected_revisions,
        &current,
        &request,
    )?;
    let (changes, expected) =
        prepare_financial(vec![tx], request.expected_revisions.clone(), &request)?;
    inspect_changes(&changes, &request.space_id, &expected, &current, &request)?;
    Ok(
        json!({"contractVersion":1,"status":"changed","changeSet":{"spaceId":request.space_id,"commandType":command,"operationId":request.context.operation_id,"occurredAt":request.context.occurred_at,"expectedRevisions":expected.iter().map(|e|json!({"id":e.id,"expectedRevision":e.expected_revision})).collect::<Vec<_>>(),"aggregates":changes}}),
    )
}
