// SPDX-License-Identifier: AGPL-3.0-or-later
//! Vollständige gespeicherte Fachbestände; historische Ziele dürfen Tombstones sein.
use crate::{
    CoreResult,
    aggregate_schema::{self, INVALID, array, integer, kind, live, string},
    calendar, projections,
};
use serde_json::{Value, json};
use std::collections::{BTreeMap, BTreeSet};
use unicode_normalization::UnicodeNormalization;
fn failure(code: &'static str, message: &'static str) -> CoreResult<()> {
    Err((code, message))
}
pub(crate) fn normal_text(s: &str) -> String {
    s.nfc()
        .collect::<String>()
        .split(aggregate_schema::js_space)
        .filter(|s| !s.is_empty())
        .collect::<Vec<_>>()
        .join(" ")
}
pub fn transaction(tx: &Value) -> CoreResult<()> {
    let mut ids = BTreeSet::new();
    let splits = array(&tx["splits"])?;
    for split in splits {
        if !ids.insert(string(&split["id"])?) {
            return failure(
                "DUPLICATE_REFERENCE",
                "Eine Split-ID darf nur einmal vorkommen.",
            );
        }
    }
    if tx["kind"] == "normal" {
        if splits.is_empty() {
            return failure(
                "INVALID_AGGREGATE",
                "Normale Buchungen benötigen mindestens einen Split; nicht zugeordnete Buchungen verwenden die Systemkategorie.",
            );
        }
        let mut sum = 0;
        for split in splits {
            sum = projections::add(
                sum,
                integer(&split["amount"])?,
                "Die Splitsumme überschreitet den sicheren Centbereich.",
            )?;
        }
        if sum != integer(&tx["amount"])? {
            return failure(
                "INVALID_AGGREGATE",
                "Die Splitsumme muss exakt dem Buchungsbetrag entsprechen.",
            );
        }
    } else if !splits.is_empty() {
        return failure(
            "INVALID_AGGREGATE",
            "Nur normale Buchungen dürfen kategorisierte Splits enthalten.",
        );
    }
    if tx["kind"] == "opening" && tx.get("transferId").is_some() {
        return failure(
            "INVALID_AGGREGATE",
            "Ein Anfangsbestand darf keine Umbuchung sein.",
        );
    }
    if tx["kind"] == "transfer" && tx.get("transferId").is_none() {
        return failure(
            "INVALID_AGGREGATE",
            "Eine Umbuchungsseite benötigt ihre Umbuchungs-ID.",
        );
    }
    Ok(())
}
fn rule(a: &Value) -> CoreResult<()> {
    for c in array(&a["conditions"])? {
        if c["field"] == "amount" {
            if integer(&c["value"]).is_err() {
                return failure(
                    "INVALID_SAFE_INTEGER",
                    "Der Geldbetrag muss ein sicherer ganzzahliger Centbetrag sein.",
                );
            }
            if c["operator"] == "contains" {
                return failure("INVALID_COMMAND", "Beträge unterstützen keine Textsuche.");
            }
        } else {
            let Some(text) = c["value"].as_str().filter(|s| !s.is_empty()) else {
                return failure("INVALID_COMMAND", "Die Textbedingung ist leer.");
            };
            if c["field"] == "date" {
                calendar::parse_finance_date(text)?;
                if c["operator"] == "contains" {
                    return failure("INVALID_COMMAND", "Datum unterstützt keine Textsuche.");
                }
            } else if c["operator"] != "equals" && c["operator"] != "contains" {
                return failure(
                    "INVALID_COMMAND",
                    "Text unterstützt nur Gleichheit und Enthalten.",
                );
            }
        }
    }
    Ok(())
}
fn import_batch(a: &Value) -> CoreResult<()> {
    let rows = array(&a["rows"])?;
    let ids: BTreeSet<_> = rows
        .iter()
        .map(|r| integer(&r["sourceRow"]))
        .collect::<CoreResult<_>>()?;
    if ids.len() != rows.len() {
        return failure("INVALID_COMMAND", "Die Importbeschreibung ist ungültig.");
    }
    for row in rows {
        if row["decision"] != "exclude"
            && (row["candidate"].is_null() || !array(&row["issues"])?.is_empty())
        {
            return failure(
                "INVALID_COMMAND",
                "Ungültige Zeilen müssen korrigiert oder ausdrücklich ausgeschlossen werden.",
            );
        }
        if !row["candidate"].is_null() && row["candidate"]["sourceRow"] != row["sourceRow"] {
            return failure("INVALID_COMMAND", "Die Quellzeile stimmt nicht überein.");
        }
    }
    let committed = array(&a["committedRows"])?;
    let unique: BTreeSet<_> = committed.iter().map(integer).collect::<CoreResult<_>>()?;
    if unique.len() != committed.len() || unique.iter().any(|n| !ids.contains(n)) {
        return failure("INVALID_COMMAND", "Der Importfortschritt ist ungültig.");
    }
    Ok(())
}
pub fn validate(all: &[Value], space: &str) -> CoreResult<()> {
    let mut by_id = BTreeMap::<&str, &Value>::new();
    for a in all {
        aggregate_schema::aggregate(a)?;
        let id = string(&a["id"])?;
        if a["spaceId"] != space
            || by_id.insert(id, a).is_some()
            || string(&a["updatedAt"])? < string(&a["createdAt"])?
            || a.get("deletedAt")
                .is_some_and(|d| d.as_str() < a["createdAt"].as_str())
            || ((id == space) != (kind(a) == "financialRevision"))
        {
            return Err(INVALID);
        }
    }
    let target = |id: &Value, expected: &str| -> CoreResult<&Value> {
        by_id
            .get(string(id)?)
            .copied()
            .filter(|a| kind(a) == expected)
            .ok_or(INVALID)
    };
    let mut reconciled = BTreeSet::new();
    let mut system_categories = 0;
    for a in all {
        match kind(a) {
            "account" if a["type"] == "credit" && a["onBudget"] == true => {
                return failure(
                    "INVALID_AGGREGATE",
                    "Kreditkonten müssen außerhalb des Umschlagbudgets bleiben.",
                );
            }
            "payee" => {
                let name = normal_text(string(&a["name"])?).to_lowercase();
                let mut aliases = BTreeSet::new();
                for alias in array(&a["aliases"])? {
                    let key = normal_text(string(alias)?).to_lowercase();
                    if key == name || !aliases.insert(key) {
                        return failure(
                            "DUPLICATE_REFERENCE",
                            "Empfängeraliasse müssen eindeutig sein und dürfen nicht dem Empfängernamen entsprechen.",
                        );
                    }
                }
            }
            "category" => {
                target(&a["groupId"], "categoryGroup")?;
                if a.get("system").is_some() {
                    system_categories += 1;
                    if a["archived"] == true || !live(a) || system_categories > 1 {
                        return Err(INVALID);
                    }
                }
            }
            "transaction" => {
                transaction(a)?;
                target(&a["accountId"], "account")?;
                if let Some(id) = a.get("payeeId") {
                    target(id, "payee")?;
                }
                for split in array(&a["splits"])? {
                    target(&split["categoryId"], "category")?;
                }
                if let Some(id) = a.get("transferId") {
                    let transfer = target(id, "transfer")?;
                    if a["kind"] != "transfer"
                        || (transfer["sourceTransactionId"] != a["id"]
                            && transfer["targetTransactionId"] != a["id"])
                    {
                        return Err(INVALID);
                    }
                }
                if let Some(id) = a.get("scheduleOccurrenceId") {
                    let occurrence = target(id, "scheduleOccurrence")?;
                    if occurrence["transactionId"] != a["id"] || occurrence["state"] != "confirmed"
                    {
                        return Err(INVALID);
                    }
                }
            }
            "transfer" => {
                target(&a["sourceAccountId"], "account")?;
                target(&a["targetAccountId"], "account")?;
                let source = target(&a["sourceTransactionId"], "transaction")?;
                let destination = target(&a["targetTransactionId"], "transaction")?;
                let amount = integer(&a["amount"])?;
                if amount <= 0 {
                    return failure(
                        "INVALID_AGGREGATE",
                        "Der Umbuchungsbetrag muss positiv sein.",
                    );
                }
                if a["sourceAccountId"] == a["targetAccountId"] {
                    return failure(
                        "INVALID_AGGREGATE",
                        "Quell- und Zielkonto müssen verschieden sein.",
                    );
                }
                transaction(source)?;
                transaction(destination)?;
                for (side, label) in [
                    (
                        source,
                        "Die Quellseite ist keine vollständige Umbuchungsseite.",
                    ),
                    (
                        destination,
                        "Die Zielseite ist keine vollständige Umbuchungsseite.",
                    ),
                ] {
                    if side["kind"] != "transfer" || side["transferId"] != a["id"] {
                        return failure("INVALID_AGGREGATE", label);
                    }
                }
                if source["accountId"] != a["sourceAccountId"]
                    || destination["accountId"] != a["targetAccountId"]
                    || source["date"] != a["date"]
                    || destination["date"] != a["date"]
                    || integer(&source["amount"])? != -amount
                    || integer(&destination["amount"])? != amount
                {
                    return failure(
                        "INVALID_AGGREGATE",
                        "Die Umbuchungsseiten müssen entgegengesetzte Beträge, Konten und dasselbe Datum besitzen.",
                    );
                }
                if live(a) != live(source) || live(a) != live(destination) {
                    return Err(INVALID);
                }
                if let Some(id) = a.get("budgetCategoryId") {
                    let category = target(id, "category")?;
                    if target(&category["groupId"], "categoryGroup")?["kind"] != "expense" {
                        return Err(INVALID);
                    }
                }
            }
            "reconciliation" => {
                target(&a["accountId"], "account")?;
                let ids = array(&a["transactionIds"])?;
                let unique: BTreeSet<_> = ids.iter().map(string).collect::<CoreResult<_>>()?;
                if unique.len() != ids.len() {
                    return failure(
                        "DUPLICATE_REFERENCE",
                        "Eine Abgleichbuchung darf nur einmal vorkommen.",
                    );
                }
                for id in ids {
                    let tx = target(id, "transaction")?;
                    if live(a)
                        && (!live(tx)
                            || tx["accountId"] != a["accountId"]
                            || string(&tx["date"])? > string(&a["statementDate"])?
                            || tx["clearance"] != "reconciled"
                            || !reconciled.insert(string(id)?))
                    {
                        return Err(INVALID);
                    }
                }
            }
            "importBatch" => {
                import_batch(a)?;
                target(&a["accountId"], "account")?;
                for row in array(&a["rows"])? {
                    for (field, ty) in [("categoryId", "category"), ("payeeId", "payee")] {
                        if let Some(id) = row["candidate"].get(field) {
                            target(id, ty)?;
                        }
                    }
                }
            }
            "importFingerprint" => {
                target(&a["accountId"], "account")?;
                target(&a["transactionId"], "transaction")?;
                let batch = target(&a["importId"], "importBatch")?;
                if batch["accountId"] != a["accountId"]
                    || !array(&batch["committedRows"])?.contains(&a["sourceRow"])
                {
                    return Err(INVALID);
                }
            }
            "rule" => {
                rule(a)?;
                for action in array(&a["actions"])? {
                    if action["field"] != "clearance" {
                        target(
                            &action["value"],
                            if action["field"] == "categoryId" {
                                "category"
                            } else {
                                "payee"
                            },
                        )?;
                    }
                }
            }
            "schedule" => {
                if let Some(end) = a.get("endDate")
                    && string(end)? < string(&a["startDate"])?
                {
                    return failure("INVALID_COMMAND", "Das Enddatum liegt vor dem Startdatum.");
                }
                transaction(&a["template"])?;
                let t = &a["template"];
                if t["kind"] != "normal"
                    || t["clearance"] == "reconciled"
                    || t.get("transferId").is_some()
                {
                    return Err(INVALID);
                }
                target(&t["accountId"], "account")?;
                if let Some(id) = t.get("payeeId") {
                    target(id, "payee")?;
                }
                for split in array(&t["splits"])? {
                    target(&split["categoryId"], "category")?;
                }
            }
            "scheduleOccurrence" => {
                target(&a["scheduleId"], "schedule")?;
                if a["state"] == "confirmed" {
                    if target(&a["transactionId"], "transaction")?["scheduleOccurrenceId"]
                        != a["id"]
                    {
                        return Err(INVALID);
                    }
                } else if a.get("transactionId").is_some() {
                    return Err(INVALID);
                }
            }
            _ => {}
        }
    }
    for a in all {
        if kind(a) == "transaction"
            && live(a)
            && a["clearance"] == "reconciled"
            && !reconciled.contains(string(&a["id"])?)
        {
            return Err(INVALID);
        }
    }
    let projections = projections::rebuild(all)?;
    let mut total = 0;
    for balance in array(&projections["accountBalances"])? {
        total = projections::add(
            total,
            integer(&balance["balance"])?,
            "Der Gesamtkontostand überschreitet den sicheren Centbereich.",
        )?;
    }
    let mut months = Vec::<(String, Vec<Value>)>::new();
    let mut index = BTreeMap::new();
    for a in all.iter().filter(|a| kind(a) == "transaction" && live(a)) {
        let key = &string(&a["date"])?[..7];
        let n = *index.entry(key.to_string()).or_insert_with(|| {
            months.push((key.to_string(), vec![]));
            months.len() - 1
        });
        months[n].1.push(a.clone());
    }
    for (_, txs) in months {
        let mut sum = 0;
        for tx in &txs {
            sum = projections::add(
                sum,
                integer(&tx["amount"])?,
                "Die Monatssumme überschreitet den sicheren Centbereich.",
            )?;
        }
        let mut month: Vec<_> = all
            .iter()
            .filter(|a| kind(a) != "transaction")
            .cloned()
            .collect();
        month.extend(txs);
        projections::consumption(&month)?;
    }
    Ok(())
}
const COMMAND_ERROR: (&str, &str) = ("INVALID_COMMAND", "Der Fachbefehl ist ungültig.");
fn request_shape(v: &Value, fields: &[&str]) -> CoreResult<()> {
    let object = v.as_object().ok_or(COMMAND_ERROR)?;
    if object.len() != fields.len()
        || fields.iter().any(|f| !object.contains_key(*f))
        || !v["spaceId"].as_str().is_some_and(crate::valid_id)
    {
        return Err(COMMAND_ERROR);
    }
    Ok(())
}
fn request_aggregates(v: &Value) -> CoreResult<&[Value]> {
    let all = array(v).map_err(|_| COMMAND_ERROR)?;
    for a in all {
        aggregate_schema::aggregate(a).map_err(|_| COMMAND_ERROR)?;
    }
    Ok(all)
}
pub fn validate_json(input: &str) -> String {
    crate::output((|| {
        let v = crate::decode(input)?;
        let space = string(&v["spaceId"]).map_err(|_| COMMAND_ERROR)?;
        if v["mode"] == "historical" {
            request_shape(
                &v,
                &[
                    "contractVersion",
                    "domainSchemaVersion",
                    "spaceId",
                    "mode",
                    "aggregates",
                ],
            )?;
            validate(request_aggregates(&v["aggregates"])?, space)?;
        } else if v["mode"] == "mutation" {
            request_shape(
                &v,
                &[
                    "contractVersion",
                    "domainSchemaVersion",
                    "spaceId",
                    "mode",
                    "before",
                    "after",
                ],
            )?;
            let before = request_aggregates(&v["before"])?;
            let after = request_aggregates(&v["after"])?;
            validate(before, space)?;
            validate(after, space)?;
            crate::references::validate(after, before)?;
        } else {
            return Err(COMMAND_ERROR);
        }
        Ok(json!({"contractVersion":1,"status":"valid"}))
    })())
}
pub fn project_json(input: &str) -> String {
    crate::output((|| {
        let v = crate::decode(input)?;
        request_shape(
            &v,
            &[
                "contractVersion",
                "domainSchemaVersion",
                "spaceId",
                "aggregates",
            ],
        )?;
        let all = request_aggregates(&v["aggregates"])?;
        validate(all, string(&v["spaceId"])?)?;
        Ok(
            json!({"contractVersion":1,"status":"projected","projections":projections::rebuild(all)?}),
        )
    })())
}
