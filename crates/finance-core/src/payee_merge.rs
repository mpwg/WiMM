// SPDX-License-Identifier: AGPL-3.0-or-later
//! Empfängermerge bewahrt gespeicherte Buchungsfelder und schützt die Referenzabfrage.
use crate::{
    CoreResult,
    aggregate_schema::{self, array, integer, kind, live, string},
    financial_commands as financial,
    master_commands::{self, Expectation, Request},
    state_validation,
};
use serde_json::{Value, json};
use std::collections::{BTreeMap, BTreeSet};
const COMMAND: (&str, &str) = ("INVALID_COMMAND", "Der Fachbefehl ist ungültig.");
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
    let cmd = &request.command;
    let space = &request.space_id;
    if cmd.as_object().is_none_or(|o| o.len() != 4)
        || !cmd["targetId"].as_str().is_some_and(crate::valid_id)
    {
        return Err(COMMAND);
    }
    let source_ids = array(&cmd["sourceIds"]).map_err(|_| COMMAND)?;
    let tx_ids = array(&cmd["transactionIds"]).map_err(|_| COMMAND)?;
    if source_ids.is_empty()
        || source_ids
            .iter()
            .chain(tx_ids)
            .any(|id| !id.as_str().is_some_and(crate::valid_id))
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
    let read_payee = |id: &Value| -> CoreResult<Value> {
        let a = current
            .get(string(id)?)
            .copied()
            .ok_or(aggregate_schema::INVALID)?;
        master_commands::normalize(a.clone(), "payee")
    };
    let mut target = read_payee(&cmd["targetId"])?;
    if target["spaceId"] != *space || target["archived"] == true || !live(&target) {
        return Err((
            "INVALID_COMMAND",
            "Der Ziel-Empfänger muss aktiv sein und zum selben Bereich gehören.",
        ));
    }
    let mut sources = vec![];
    let mut source_set = BTreeSet::new();
    for id in source_ids {
        let source = read_payee(id)?;
        if source["spaceId"] != *space
            || source["id"] == target["id"]
            || source["archived"] == true
            || !live(&source)
        {
            return Err((
                "INVALID_COMMAND",
                "Quell-Empfänger müssen aktiv, verschieden vom Ziel und im selben Bereich sein.",
            ));
        }
        if !source_set.insert(string(id)?) {
            return Err((
                "DUPLICATE_REFERENCE",
                "Ein Quell-Empfänger darf nur einmal zusammengeführt werden.",
            ));
        }
        sources.push(source);
    }
    if current.len() != request.aggregates.len()
        || request.aggregates.iter().any(|a| a["spaceId"] != *space)
    {
        return Err((
            "INVALID_AGGREGATE",
            "Der Fachbestand für die Empfängerzusammenführung ist nicht eindeutig im aktuellen Bereich.",
        ));
    }
    let stored: Vec<_> = request
        .aggregates
        .iter()
        .filter(|a| {
            kind(a) == "transaction"
                && live(a)
                && a["payeeId"]
                    .as_str()
                    .is_some_and(|id| source_set.contains(id))
        })
        .collect();
    let mut transaction_set = BTreeSet::new();
    for id in tx_ids {
        let id = string(id)?;
        let tx = current
            .get(id)
            .copied()
            .filter(|a| kind(a) == "transaction")
            .ok_or(aggregate_schema::INVALID)?;
        if tx["spaceId"] != *space
            || !tx["payeeId"]
                .as_str()
                .is_some_and(|id| source_set.contains(id))
        {
            return Err((
                "INVALID_COMMAND",
                "Jede übergebene Transaktion muss einen Quell-Empfänger desselben Bereichs referenzieren.",
            ));
        }
        if !transaction_set.insert(id) {
            return Err((
                "DUPLICATE_REFERENCE",
                "Eine Transaktionsreferenz darf nur einmal zusammengeführt werden.",
            ));
        }
        if tx["clearance"] == "reconciled" {
            return Err((
                "INVALID_COMMAND",
                "Abgeglichene Buchungen müssen vor der Empfängerzusammenführung ausdrücklich entsperrt werden.",
            ));
        }
    }
    if stored.len() != transaction_set.len()
        || stored
            .iter()
            .any(|tx| !transaction_set.contains(tx["id"].as_str().unwrap_or("")))
    {
        return Err((
            "INVALID_COMMAND",
            "Die Empfängerreferenzliste ist unvollständig.",
        ));
    }
    let mut all_aliases = array(&target["aliases"])?
        .iter()
        .map(|v| Ok(string(v)?.to_string()))
        .collect::<CoreResult<Vec<_>>>()?;
    for source in &sources {
        all_aliases.push(string(&source["name"])?.to_string());
        for alias in array(&source["aliases"])? {
            all_aliases.push(string(alias)?.to_string());
        }
    }
    let name = state_validation::normal_text(string(&target["name"])?).to_lowercase();
    let mut seen = BTreeSet::new();
    let mut aliases = vec![];
    for alias in all_aliases {
        let display = state_validation::normal_text(&alias);
        let key = display.to_lowercase();
        if key == name || !seen.insert(key) {
            continue;
        }
        aliases.push(display);
    }
    target["aliases"] = json!(aliases);
    let target_id = target["id"].clone();
    let mut changes = vec![financial::revise(target, &request.context.occurred_at)?];
    for mut source in sources {
        source["archived"] = json!(true);
        changes.push(financial::revise(source, &request.context.occurred_at)?);
    }
    for tx in stored {
        let mut tx = tx.clone();
        tx["payeeId"] = target_id.clone();
        changes.push(financial::revise(tx, &request.context.occurred_at)?);
    }
    crate::references::validate(&changes, &request.aggregates)?;
    let mut expected = request.expected_revisions.clone();
    let guard = current.get(space.as_str()).copied();
    if guard.is_some_and(|a| kind(a) != "financialRevision") {
        return Err((
            "INVALID_AGGREGATE",
            "Die reservierte lokale Finanzrevision ist nicht verfügbar.",
        ));
    }
    if !expected.iter().any(|e| e.id == *space) {
        expected.push(Expectation {
            id: space.clone(),
            expected_revision: guard
                .map(|a| integer(&a["revision"]))
                .transpose()?
                .unwrap_or(0),
        });
    }
    // Merge verändert keine Geldwerte: die lokale Finanzrevision wird nur gelesen, nicht erhöht.
    financial::inspect_changes(&changes, space, &expected, &current, &request)?;
    // Verbindliche Reihenfolge: Ziel, Quellen, tatsächliche gespeicherte Buchungen, Bereichsanker.
    let mut canonical = changes
        .iter()
        .map(|a| {
            Ok(Expectation {
                id: string(&a["id"])?.to_string(),
                expected_revision: integer(&a["revision"])? - 1,
            })
        })
        .collect::<CoreResult<Vec<_>>>()?;
    canonical.push(Expectation {
        id: space.clone(),
        expected_revision: guard
            .map(|a| integer(&a["revision"]))
            .transpose()?
            .unwrap_or(0),
    });
    for e in expected {
        if !canonical.iter().any(|old| old.id == e.id) {
            canonical.push(e);
        }
    }
    let expected = canonical;
    Ok(
        json!({"contractVersion":1,"status":"changed","changeSet":{"spaceId":space,"commandType":"payee.merge","operationId":request.context.operation_id,"occurredAt":request.context.occurred_at,"expectedRevisions":expected.iter().map(|e|json!({"id":e.id,"expectedRevision":e.expected_revision})).collect::<Vec<_>>(),"aggregates":changes}}),
    )
}
