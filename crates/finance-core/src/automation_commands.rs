// SPDX-License-Identifier: AGPL-3.0-or-later
//! Automatisierungsbefehle mit injizierten IDs/Zeit und bestehenden atomaren Fachverträgen.
use crate::{
    CoreResult,
    aggregate_schema::{self, array, integer, kind, live, string},
    automation, financial_commands as financial,
    master_commands::{self, Expectation, Request},
    projections, state_validation,
};
use serde_json::{Value, json};
use std::collections::{BTreeMap, BTreeSet};
const COMMAND: (&str, &str) = ("INVALID_COMMAND", "Der Fachbefehl ist ungültig.");
struct Ids<'a> {
    values: &'a [String],
    position: usize,
}
impl Ids<'_> {
    fn next(&mut self) -> CoreResult<String> {
        let id = self
            .values
            .get(self.position)
            .ok_or((
                "INVALID_GENERATOR",
                "Die erzeugte Aggregat-ID ist ungültig.",
            ))?
            .clone();
        self.position += 1;
        Ok(id)
    }
    fn meta(&mut self, space: &str, time: &str) -> CoreResult<Value> {
        Ok(
            json!({"id":self.next()?,"spaceId":space,"revision":1,"createdAt":time,"updatedAt":time}),
        )
    }
}
fn refs(tx: &Value, all: &[Value], space: &str) -> CoreResult<Vec<String>> {
    let mut ids = vec![string(&tx["accountId"])?.to_string()];
    automation::active_reference(all, space, &tx["accountId"], "account")?;
    for split in array(&tx["splits"])? {
        automation::active_reference(all, space, &split["categoryId"], "category")?;
        ids.push(string(&split["categoryId"])?.to_string());
    }
    if let Some(id) = tx.get("payeeId") {
        automation::active_reference(all, space, id, "payee")?;
        ids.push(string(id)?.to_string());
    }
    Ok(ids)
}
fn checked_tx(
    tx: Value,
    all: &[Value],
    request: &Request,
) -> CoreResult<(Value, Vec<Expectation>)> {
    let space = &request.space_id;
    let read = refs(&tx, all, space)?;
    let mut ids = vec![string(&tx["id"])?.to_string()];
    ids.extend(read);
    let current: BTreeMap<&str, &Value> = all
        .iter()
        .map(|a| Ok((string(&a["id"])?, a)))
        .collect::<CoreResult<_>>()?;
    let mut seen = BTreeSet::new();
    let expected = ids
        .into_iter()
        .filter(|id| seen.insert(id.clone()))
        .map(|id| {
            Ok(Expectation {
                expected_revision: current
                    .get(id.as_str())
                    .map(|a| integer(&a["revision"]))
                    .transpose()?
                    .unwrap_or(0),
                id,
            })
        })
        .collect::<CoreResult<Vec<_>>>()?;
    let tx = financial::normalize(tx)?;
    if let Some(old) = current.get(string(&tx["id"])?)
        && old["clearance"] == "reconciled"
    {
        return Err((
            "INVALID_COMMAND",
            "Abgeglichene Buchungen müssen vor einer Änderung atomar entsperrt werden.",
        ));
    }
    if tx["clearance"] == "reconciled" {
        return Err((
            "INVALID_COMMAND",
            "Abgeglichene Buchungen müssen vor einer Änderung atomar entsperrt werden.",
        ));
    }
    if !live(&tx) {
        return Err((
            "INVALID_COMMAND",
            "Eine gespeicherte Buchung darf kein Tombstone sein.",
        ));
    }
    if tx["kind"] == "transfer" {
        return Err((
            "INVALID_COMMAND",
            "Umbuchungsseiten dürfen nur zusammen mit ihrer Gegenbuchung geändert werden.",
        ));
    }
    let mut temp = request.clone();
    temp.aggregates = all.to_vec();
    temp.expected_revisions = expected.clone();
    financial::inspect_changes(std::slice::from_ref(&tx), space, &expected, &current, &temp)?;
    let (changes, expectations) = financial::prepare_financial(vec![tx], expected, &temp)?;
    financial::inspect_changes(&changes, space, &expectations, &current, &temp)?;
    Ok((changes[0].clone(), expectations))
}
fn finish(changes: Vec<Value>, read: Vec<String>, request: &Request) -> CoreResult<Value> {
    if changes.is_empty() {
        return Err(("INVALID_COMMAND", "Die Änderung ist leer."));
    }
    let current: BTreeMap<&str, &Value> = request
        .aggregates
        .iter()
        .map(|a| Ok((string(&a["id"])?, a)))
        .collect::<CoreResult<_>>()?;
    master_commands::expected(request, &current)?;
    let mut ids = changes
        .iter()
        .map(|a| Ok(string(&a["id"])?.to_string()))
        .collect::<CoreResult<Vec<_>>>()?;
    ids.extend(read);
    let mut seen = BTreeSet::new();
    let mut expected = ids
        .into_iter()
        .filter(|id| seen.insert(id.clone()))
        .map(|id| {
            Ok(Expectation {
                expected_revision: current
                    .get(id.as_str())
                    .map(|a| integer(&a["revision"]))
                    .transpose()?
                    .unwrap_or(0),
                id,
            })
        })
        .collect::<CoreResult<Vec<_>>>()?;
    for e in &request.expected_revisions {
        if !expected.iter().any(|old| old.id == e.id) {
            expected.push(e.clone());
        }
    }
    financial::inspect_changes(&changes, &request.space_id, &expected, &current, request)?;
    let command = string(&request.command["commandType"])?;
    let (changes, expected) = financial::prepare_financial(changes, expected, request)?; // Ohne Buchungsmutation darf kein Finanzanker angelegt werden.
    financial::inspect_changes(&changes, &request.space_id, &expected, &current, request)?;
    Ok(
        json!({"contractVersion":1,"status":"changed","changeSet":{"spaceId":request.space_id,"commandType":command,"operationId":request.context.operation_id,"occurredAt":request.context.occurred_at,"expectedRevisions":expected.iter().map(|e|json!({"id":e.id,"expectedRevision":e.expected_revision})).collect::<Vec<_>>(),"aggregates":changes}}),
    )
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
    let command = string(&request.command["commandType"])?;
    let all = &request.aggregates;
    let space = &request.space_id;
    let time = &request.context.occurred_at;
    let mut ids = Ids {
        values: &request.context.generated_ids,
        position: 0,
    };
    if [
        "rule.save",
        "schedule.save",
        "importBatch.save",
        "importMapping.save",
    ]
    .contains(&command)
    {
        if request.command.as_object().is_none_or(|o| o.len() != 2) {
            return Err(COMMAND);
        }
        let entries = array(&request.command["aggregates"]).map_err(|_| COMMAND)?;
        if entries.len() != 1 {
            return Err(COMMAND);
        }
        let a = entries[0].clone();
        aggregate_schema::aggregate(&a).map_err(|_| COMMAND)?;
        if kind(&a) != command.split('.').next().unwrap_or("") {
            return Err(COMMAND);
        }
        if ["importBatch.save", "schedule.save"].contains(&command) && a["spaceId"] != *space {
            return Err((
                "INVALID_COMMAND",
                "Die Referenz ist nicht im aktiven Bereich verfügbar.",
            ));
        }
        let mut read = vec![];
        match command {
            "rule.save" => {
                automation::validate_rule(&a, all)?;
                for action in array(&a["actions"])? {
                    if action["field"] != "clearance" {
                        read.push(string(&action["value"])?.to_string());
                    }
                }
            }
            "importBatch.save" => {
                automation::active_reference(all, space, &a["accountId"], "account")?;
                state_validation::import_batch(&a)?;
                let old = all.iter().find(|old| old["id"] == a["id"]);
                let committed = array(&a["committedRows"])?;
                if old.is_none() && (!committed.is_empty() || a["state"] != "ready") {
                    return Err((
                        "INVALID_COMMAND",
                        "Ein neuer Import muss ohne übernommene Zeilen beginnen.",
                    ));
                }
                if let Some(old) = old {
                    let old_rows = array(&old["rows"])?;
                    let new_rows = array(&a["rows"])?;
                    if old_rows.len() != new_rows.len()
                        || old_rows
                            .iter()
                            .any(|row| !new_rows.iter().any(|r| r["sourceRow"] == row["sourceRow"]))
                        || old["state"] != a["state"]
                    {
                        return Err((
                            "INVALID_COMMAND",
                            "Quellzeilen und Fortschrittsstatus dürfen nicht still geändert werden.",
                        ));
                    }
                    if old["fileHash"] != a["fileHash"]
                        || old["accountId"] != a["accountId"]
                        || old["committedRows"] != a["committedRows"]
                        || array(&old["committedRows"])?.iter().any(|n| {
                            old_rows.iter().find(|r| r["sourceRow"] == *n)
                                != new_rows.iter().find(|r| r["sourceRow"] == *n)
                        })
                    {
                        return Err((
                            "INVALID_COMMAND",
                            "Bereits übernommene Importzeilen sind unveränderlich.",
                        ));
                    }
                }
                read.push(string(&a["accountId"])?.to_string());
            }
            "schedule.save" => {
                let mut active = a.clone();
                active["enabled"] = json!(true);
                crate::schedule_dates::due_dates(&active, string(&a["startDate"])?)?;
                let mut tx = ids.meta(space, time)?;
                for (key, value) in a["template"].as_object().ok_or(COMMAND)? {
                    tx[key] = value.clone();
                }
                tx["aggregateType"] = json!("transaction");
                tx["date"] = a["startDate"].clone();
                if tx["kind"] != "normal" || tx["clearance"] == "reconciled" {
                    return Err((
                        "INVALID_COMMAND",
                        "Die Vorlage muss eine normale offene Buchung sein.",
                    ));
                }
                let (tx, expectations) = checked_tx(tx, all, &request)?;
                read.extend(
                    expectations
                        .into_iter()
                        .filter(|e| e.id != tx["id"].as_str().unwrap_or(""))
                        .map(|e| e.id),
                );
            }
            _ => {}
        }
        return finish(vec![a], read, &request);
    }
    if command == "rule.delete" {
        if request.command.as_object().is_none_or(|o| o.len() != 2) {
            return Err(COMMAND);
        }
        let a = all
            .iter()
            .find(|a| a["id"] == request.command["aggregateId"] && kind(a) == "rule")
            .ok_or(aggregate_schema::INVALID)?;
        let mut tomb = a.clone();
        tomb["deletedAt"] = json!(time);
        return finish(vec![financial::revise(tomb, time)?], vec![], &request);
    }
    if command == "schedule.confirm" || command == "schedule.skip" {
        let wanted = if command == "schedule.confirm" {
            "confirmed"
        } else {
            "skipped"
        };
        let schedule =
            automation::active_reference(all, space, &request.command["scheduleId"], "schedule")?;
        let date = string(&request.command["dueDate"])?;
        if !crate::schedule_dates::due_dates(schedule, date)?
            .iter()
            .any(|d| d == date)
        {
            return Err(("INVALID_COMMAND", "Das Datum ist keine aktive Fälligkeit."));
        }
        if let Some(existing) = all.iter().find(|a| {
            kind(a) == "scheduleOccurrence"
                && live(a)
                && a["scheduleId"] == schedule["id"]
                && a["dueDate"] == date
                && a["spaceId"] == *space
        }) {
            if existing["state"] != wanted
                || request
                    .command
                    .get("importedTransactionId")
                    .is_some_and(|id| existing["transactionId"] != *id)
            {
                return Err((
                    "INVALID_COMMAND",
                    "Die Fälligkeit ist bereits anders erledigt.",
                ));
            }
            return Ok(json!({"contractVersion":1,"status":"unchanged"}));
        }
        let mut occurrence = ids.meta(space, time)?;
        occurrence["aggregateType"] = json!("scheduleOccurrence");
        occurrence["scheduleId"] = schedule["id"].clone();
        occurrence["dueDate"] = json!(date);
        occurrence["state"] = json!(wanted);
        let mut changes = vec![financial::revise(schedule.clone(), time)?];
        let mut read = vec![string(&schedule["id"])?.to_string()];
        if wanted == "confirmed" {
            let imported = request
                .command
                .get("importedTransactionId")
                .map(|id| {
                    all.iter()
                        .find(|a| a["id"] == *id && kind(a) == "transaction")
                        .ok_or(aggregate_schema::INVALID)
                })
                .transpose()?;
            if imported.is_some_and(|a| {
                a["spaceId"] != schedule["spaceId"]
                    || a["accountId"] != schedule["template"]["accountId"]
            }) {
                return Err((
                    "INVALID_COMMAND",
                    "Die importierte Zahlung liegt in einem anderen Bereich.",
                ));
            }
            if imported.is_some_and(|a| a.get("scheduleOccurrenceId").is_some()) {
                return Err((
                    "INVALID_COMMAND",
                    "Die Zahlung ist bereits einer Fälligkeit zugeordnet.",
                ));
            }
            let tx = if let Some(imported) = imported {
                let mut tx = imported.clone();
                tx["scheduleOccurrenceId"] = occurrence["id"].clone();
                financial::revise(tx, time)?
            } else {
                let mut tx = ids.meta(space, time)?;
                for (key, value) in schedule["template"].as_object().ok_or(COMMAND)? {
                    tx[key] = value.clone();
                }
                tx["aggregateType"] = json!("transaction");
                tx["date"] = json!(date);
                tx["scheduleOccurrenceId"] = occurrence["id"].clone();
                let mut splits = vec![];
                for split in array(&tx["splits"])? {
                    let mut split = split.clone();
                    split["id"] = json!(ids.next()?);
                    splits.push(split);
                }
                tx["splits"] = json!(splits);
                tx
            };
            if imported.is_none() {
                let mut sum = 0;
                for a in all.iter().filter(|a| {
                    kind(a) == "transaction"
                        && live(a)
                        && a["spaceId"] == schedule["spaceId"]
                        && a["accountId"] == tx["accountId"]
                }) {
                    sum = projections::add(
                        sum,
                        integer(&a["amount"])?,
                        "Die Geldsumme überschreitet den sicheren Centbereich.",
                    )?;
                }
                projections::add(
                    sum,
                    integer(&tx["amount"])?,
                    "Die Geldsumme überschreitet den sicheren Centbereich.",
                )?;
                changes.push(financial::revise(
                    automation::active_reference(all, space, &tx["accountId"], "account")?.clone(),
                    time,
                )?);
            }
            let (tx, expectations) = checked_tx(tx, all, &request)?;
            read.extend(
                expectations
                    .into_iter()
                    .filter(|e| e.id != tx["id"].as_str().unwrap_or(""))
                    .map(|e| e.id),
            );
            occurrence["transactionId"] = tx["id"].clone();
            changes.push(tx);
            changes.push(occurrence);
        } else {
            changes.push(occurrence);
        }
        return finish(changes, read, &request);
    }
    if command != "import.commit" {
        return Err(COMMAND);
    }
    let batch =
        automation::active_reference(all, space, &request.command["importId"], "importBatch")?;
    automation::active_reference(all, space, &batch["accountId"], "account")?;
    state_validation::import_batch(batch)?;
    let committed = array(&batch["committedRows"])?;
    let pending: Vec<_> = array(&batch["rows"])?
        .iter()
        .filter(|r| !committed.contains(&r["sourceRow"]))
        .take(100)
        .collect();
    if pending.is_empty() {
        return Ok(json!({"contractVersion":1,"status":"unchanged"}));
    }
    let fingerprints: Vec<Value> = all
        .iter()
        .filter(|a| kind(a) == "importFingerprint" && live(a))
        .cloned()
        .collect();
    let mut changes = vec![];
    let mut read = vec![string(&batch["accountId"])?.to_string()];
    let mut read_set = BTreeSet::from([read[0].clone()]);
    for row in &pending {
        if row["decision"] == "exclude" {
            continue;
        }
        let candidate = &row["candidate"];
        let mut fp = fingerprints.clone();
        fp.extend(
            changes
                .iter()
                .filter(|a| kind(a) == "importFingerprint")
                .cloned(),
        );
        let status = automation::duplicate(candidate, &batch["accountId"], &fp)?;
        if status == "conflict" {
            return Err((
                "INVALID_COMMAND",
                "Gleiche Quell-ID mit anderem Inhalt: zuerst den Prüfkonflikt klären oder ausschließen.",
            ));
        }
        if status == "duplicate" && row["decision"] != "separate" {
            return Err((
                "INVALID_COMMAND",
                "Eine mögliche Dublette benötigt eine ausdrückliche Entscheidung.",
            ));
        }
        if !candidate["categoryId"]
            .as_str()
            .is_some_and(crate::valid_id)
        {
            return Err(("INVALID_COMMAND", "Die Importkategorie fehlt."));
        }
        let mut payee = candidate.get("payeeId").cloned();
        if payee.is_none()
            && candidate["payee"]
                .as_str()
                .is_some_and(|s| !s.trim_matches(aggregate_schema::js_space).is_empty())
        {
            let match_text =
                state_validation::normal_text(string(&candidate["payee"])?).to_lowercase();
            let matches: Vec<_> = all
                .iter()
                .chain(&changes)
                .filter(|a| {
                    kind(a) == "payee" && a["spaceId"] == *space && live(a) && a["archived"] != true
                })
                .filter(|p| {
                    std::iter::once(&p["name"])
                        .chain(p["aliases"].as_array().into_iter().flatten())
                        .any(|name| {
                            name.as_str().is_some_and(|s| {
                                state_validation::normal_text(s).to_lowercase() == match_text
                            })
                        })
                })
                .collect();
            if matches.len() > 1 {
                return Err((
                    "INVALID_COMMAND",
                    "Der Empfängername ist mehrdeutig. Bitte über eine Regel ausdrücklich zuordnen.",
                ));
            }
            if let Some(a) = matches.first() {
                payee = Some(a["id"].clone());
            } else {
                let mut a = ids.meta(space, time)?;
                a["aggregateType"] = json!("payee");
                a["name"] = candidate["payee"].clone();
                a["aliases"] = json!([]);
                a["archived"] = json!(false);
                let a = master_commands::normalize(a, "payee")?;
                payee = Some(a["id"].clone());
                changes.push(a);
            }
        }
        let mut tx = ids.meta(space, time)?;
        tx["aggregateType"] = json!("transaction");
        tx["kind"] = json!("normal");
        tx["accountId"] = batch["accountId"].clone();
        tx["date"] = candidate["date"].clone();
        tx["amount"] = candidate["amount"].clone();
        tx["clearance"] = candidate
            .get("clearance")
            .cloned()
            .unwrap_or(json!("uncleared"));
        tx["importReference"] = json!(format!(
            "{}:{}",
            string(&batch["id"])?,
            integer(&row["sourceRow"])?
        ));
        if let Some(note) = candidate
            .get("memo")
            .filter(|v| v.as_str().is_some_and(|s| !s.is_empty()))
        {
            tx["note"] = note.clone();
        }
        if let Some(payee) = payee {
            tx["payeeId"] = payee;
        }
        tx["splits"] = json!([{"id":ids.next()?,"categoryId":candidate["categoryId"],"amount":candidate["amount"]}]);
        let mut before = all.to_vec();
        before.extend(changes.clone());
        let (tx, expectations) = checked_tx(tx, &before, &request)?;
        for e in expectations {
            if e.id != tx["id"].as_str().unwrap_or("") && read_set.insert(e.id.clone()) {
                read.push(e.id);
            }
        }
        let mut fp = ids.meta(space, time)?;
        fp["aggregateType"] = json!("importFingerprint");
        fp["accountId"] = batch["accountId"].clone();
        fp["parserSource"] = candidate
            .get("parserSource")
            .cloned()
            .unwrap_or(json!("csv"));
        if let Some(external) = candidate.get("externalId") {
            fp["externalId"] = external.clone();
        }
        fp["fingerprint"] = json!(automation::fingerprint(candidate)?);
        fp["transactionId"] = tx["id"].clone();
        fp["importId"] = batch["id"].clone();
        fp["sourceRow"] = row["sourceRow"].clone();
        changes.push(tx);
        changes.push(fp);
    }
    let mut sum = 0;
    for tx in all
        .iter()
        .filter(|a| {
            kind(a) == "transaction"
                && live(a)
                && a["spaceId"] == *space
                && a["accountId"] == batch["accountId"]
        })
        .chain(changes.iter().filter(|a| kind(a) == "transaction"))
    {
        sum = projections::add(
            sum,
            integer(&tx["amount"])?,
            "Die Geldsumme überschreitet den sicheren Centbereich.",
        )?;
    }
    let mut batch_next = batch.clone();
    let mut done = committed.to_vec();
    done.extend(pending.iter().map(|r| r["sourceRow"].clone()));
    batch_next["state"] = json!(if done.len() == array(&batch["rows"])?.len() {
        "completed"
    } else {
        "partial"
    });
    batch_next["committedRows"] = json!(done);
    changes.push(financial::revise(
        automation::active_reference(all, space, &batch["accountId"], "account")?.clone(),
        time,
    )?);
    changes.push(financial::revise(batch_next, time)?);
    for fp in fingerprints {
        let id = string(&fp["id"])?;
        if read_set.insert(id.to_string()) {
            read.push(id.to_string());
        }
    }
    finish(changes, read, &request)
}
