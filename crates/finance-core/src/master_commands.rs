// SPDX-License-Identifier: AGPL-3.0-or-later
//! Erste Stammdatenhandler mit vollständigen Revisionsübergängen; keine Persistenz.
use crate::{
    CoreResult, MAX_SAFE,
    aggregate_schema::{self, array, integer, string},
    state_validation,
};
use serde::Deserialize;
use serde_json::{Value, json};
use std::collections::{BTreeMap, BTreeSet};
const INVALID: (&str, &str) = ("INVALID_COMMAND", "Der Fachbefehl ist ungültig.");
#[derive(Clone, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct Expectation {
    pub(crate) id: String,
    pub(crate) expected_revision: i64,
}
#[derive(Clone, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct Context {
    pub(crate) operation_id: String,
    pub(crate) occurred_at: String,
    pub(crate) generated_ids: Vec<String>,
}
#[derive(Clone, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct Request {
    pub(crate) contract_version: u32,
    pub(crate) domain_schema_version: u32,
    pub(crate) space_id: String,
    pub(crate) aggregates: Vec<Value>,
    pub(crate) command: Value,
    pub(crate) expected_revisions: Vec<Expectation>,
    pub(crate) context: Context,
}
fn fail(code: &'static str, message: &'static str) -> CoreResult<Value> {
    Err((code, message))
}
pub(crate) fn normalize(a: Value, ty: &str) -> CoreResult<Value> {
    if aggregate_schema::kind(&a) != ty {
        return fail(
            "INVALID_AGGREGATE",
            match ty {
                "account" => "Das Konto hat einen unpassenden Aggregattyp.",
                "categoryGroup" => "Die Kategoriegruppe hat einen unpassenden Aggregattyp.",
                "category" => "Die Kategorie hat einen unpassenden Aggregattyp.",
                _ => "Der Empfänger hat einen unpassenden Aggregattyp.",
            },
        );
    }
    use crate::{
        models::{AccountType, Aggregate},
        scalars::NonEmptyText,
    };
    let mut a = Aggregate::from_wire(&a)?;
    match &mut a {
        Aggregate::Account(a) => {
            a.name = NonEmptyText::new(state_validation::normal_text(a.name.as_str()))?;
            if a.account_type == AccountType::Credit && a.on_budget {
                return fail(
                    "INVALID_AGGREGATE",
                    "Kreditkonten müssen außerhalb des Umschlagbudgets bleiben.",
                );
            }
        }
        Aggregate::CategoryGroup(a) => {
            a.name = NonEmptyText::new(state_validation::normal_text(a.name.as_str()))?
        }
        Aggregate::Category(a) => {
            a.name = NonEmptyText::new(state_validation::normal_text(a.name.as_str()))?
        }
        Aggregate::Payee(a) => {
            a.name = NonEmptyText::new(state_validation::normal_text(a.name.as_str()))?;
            let name = a.name.as_str().to_lowercase();
            let mut seen = BTreeSet::new();
            for alias in &mut a.aliases {
                let display = state_validation::normal_text(alias.as_str());
                let key = display.to_lowercase();
                if key == name || !seen.insert(key) {
                    return fail(
                        "DUPLICATE_REFERENCE",
                        "Empfängeraliasse müssen eindeutig sein und dürfen nicht dem Empfängernamen entsprechen.",
                    );
                }
                *alias = NonEmptyText::new(display)?;
            }
        }
        _ => return Err(aggregate_schema::INVALID),
    }
    serde_json::to_value(a).map_err(|_| aggregate_schema::INVALID)
}
pub(crate) fn expected(
    request: &Request,
    current: &BTreeMap<&str, &Value>,
) -> CoreResult<BTreeMap<String, i64>> {
    let mut expected = BTreeMap::new();
    for e in &request.expected_revisions {
        if !crate::valid_id(&e.id) || !(0..=MAX_SAFE).contains(&e.expected_revision) {
            return Err(INVALID);
        }
        if expected.contains_key(&e.id) {
            return Err((
                "DUPLICATE_REFERENCE",
                "Jede Aggregatrevision darf in einem Befehl nur einmal erwartet werden.",
            ));
        }
        if let Some(a) = current.get(e.id.as_str()) {
            if a["spaceId"] != request.space_id {
                return Err((
                    "CROSS_SPACE_REFERENCE",
                    "Eine erwartete Aggregatrevision verweist auf einen anderen Bereich.",
                ));
            }
            if integer(&a["revision"])? != e.expected_revision {
                return Err((
                    "REVISION_CONFLICT",
                    "Eine erwartete Aggregatrevision ist nicht mehr aktuell.",
                ));
            }
        } else if e.expected_revision != 0 {
            return Err((
                "REVISION_CONFLICT",
                "Eine erwartete Aggregatrevision verweist auf kein vorhandenes Aggregat.",
            ));
        }
        expected.insert(e.id.clone(), e.expected_revision);
    }
    Ok(expected)
}
pub(crate) fn transition(
    a: &Value,
    space: &str,
    expected: &BTreeMap<String, i64>,
    current: &BTreeMap<&str, &Value>,
) -> CoreResult<()> {
    let id = string(&a["id"])?;
    if (id == space) != (aggregate_schema::kind(a) == "financialRevision") {
        return Err((
            "INVALID_AGGREGATE",
            "Die Bereichs-ID ist ausschließlich für die lokale Finanzrevision reserviert.",
        ));
    }
    if a["spaceId"] != space {
        return Err((
            "CROSS_SPACE_REFERENCE",
            "Ein vollständiges Aggregat verweist auf einen anderen Bereich.",
        ));
    }
    let previous = *expected.get(id).ok_or((
        "REVISION_MISSING",
        "Für jedes geänderte Aggregat muss eine erwartete Revision angegeben sein.",
    ))?;
    let revision = integer(&a["revision"])?;
    let old = current.get(id);
    if previous == 0 {
        if old.is_some() {
            return Err((
                "REVISION_CONFLICT",
                "Ein bereits vorhandenes Aggregat kann nicht mit Revision null angelegt werden.",
            ));
        }
        if revision != 1 {
            return Err((
                "REVISION_CONFLICT",
                "Ein neues Aggregat muss mit Revision eins beginnen.",
            ));
        }
    } else {
        let old = old.ok_or((
            "REVISION_CONFLICT",
            "Die erwartete Aggregatrevision ist nicht mehr aktuell.",
        ))?;
        if old["spaceId"] != a["spaceId"] || old["aggregateType"] != a["aggregateType"] {
            return Err((
                "CROSS_SPACE_REFERENCE",
                "Die Aggregatrevision passt nicht zum Bereich oder Aggregattyp des Befehls.",
            ));
        }
        if previous == MAX_SAFE {
            return Err((
                "REVISION_OVERFLOW",
                "Die Aggregatrevision kann nicht mehr sicher erhöht werden.",
            ));
        }
        if revision != previous + 1 {
            return Err((
                "REVISION_CONFLICT",
                "Die neue Aggregatrevision muss genau um eins steigen.",
            ));
        }
    }
    Ok(())
}
pub fn execute(decoded: Value) -> CoreResult<Value> {
    let request: Request = serde_json::from_value(decoded).map_err(|_| INVALID)?;
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
        return Err(INVALID);
    }
    for a in &request.aggregates {
        aggregate_schema::aggregate(a).map_err(|_| INVALID)?;
    }
    let current: BTreeMap<&str, &Value> = request
        .aggregates
        .iter()
        .map(|a| Ok((string(&a["id"])?, a)))
        .collect::<CoreResult<_>>()?;
    if current.len() != request.aggregates.len() {
        return Err(aggregate_schema::INVALID);
    }
    let command_type = string(&request.command["commandType"])?;
    let (ty, archiving) = match command_type {
        "account.save" => ("account", false),
        "categoryGroup.save" => ("categoryGroup", false),
        "category.save" => ("category", false),
        "payee.save" => ("payee", false),
        "account.archive" => ("account", true),
        "category.archive" => ("category", true),
        _ => return Err(INVALID),
    };
    let obj = request.command.as_object().ok_or(INVALID)?;
    if obj.len() != 2 {
        return Err(INVALID);
    }
    let a = if archiving {
        let id = string(&request.command["aggregateId"]).map_err(|_| INVALID)?;
        if !crate::valid_id(id) {
            return Err(INVALID);
        }
        let mut a = (*current.get(id).ok_or(aggregate_schema::INVALID)?).clone();
        let revision = integer(&a["revision"])?;
        if revision == MAX_SAFE {
            return fail(
                "REVISION_OVERFLOW",
                "Die Aggregatrevision kann nicht mehr sicher erhöht werden.",
            );
        }
        if request.context.occurred_at.as_str() < string(&a["createdAt"])? {
            return fail(
                "INVALID_GENERATOR",
                "Der erzeugte Änderungszeitpunkt liegt vor dem Erstellungszeitpunkt.",
            );
        }
        a["revision"] = json!(revision + 1);
        a["updatedAt"] = json!(request.context.occurred_at);
        a["archived"] = json!(true);
        normalize(a, ty)?
    } else {
        let entries = array(&request.command["aggregates"]).map_err(|_| INVALID)?;
        if entries.len() != 1 {
            return fail(
                "INVALID_COMMAND",
                "Der Stammdatenbefehl benötigt genau ein vollständiges Aggregat des passenden Typs.",
            );
        }
        aggregate_schema::aggregate(&entries[0]).map_err(|_| INVALID)?;
        normalize(entries[0].clone(), ty)?
    };
    if ty == "category" {
        let group_id = string(&a["groupId"])?;
        if !request.expected_revisions.iter().any(|e| e.id == group_id) {
            return fail(
                "REVISION_MISSING",
                "Die referenzierte Kategoriegruppe benötigt eine erwartete Revision.",
            );
        }
        if current
            .get(group_id)
            .is_none_or(|g| aggregate_schema::kind(g) != "categoryGroup")
        {
            return fail(
                "INVALID_AGGREGATE",
                "Die referenzierte Kategoriegruppe existiert nicht im selben Fachbestand.",
            );
        }
        crate::references::validate(std::slice::from_ref(&a), &request.aggregates)?;
        if let Some(old) = current.get(string(&a["id"])?) {
            if old["system"] == "uncategorized"
                && (a["system"] != "uncategorized"
                    || a["archived"] == true
                    || !aggregate_schema::live(&a))
            {
                return fail(
                    "INVALID_COMMAND",
                    "Die Systemkategorie „Nicht zugeordnet“ darf weder umgewidmet noch archiviert oder gelöscht werden.",
                );
            }
            if old["system"] != "uncategorized" && old.get("system") != a.get("system") {
                return fail(
                    "INVALID_COMMAND",
                    "Der Systemstatus einer gespeicherten Kategorie darf nicht geändert werden.",
                );
            }
        }
        if archiving && a["system"] == "uncategorized" {
            return fail(
                "INVALID_COMMAND",
                "Die Systemkategorie „Nicht zugeordnet“ darf nicht archiviert werden.",
            );
        }
    }
    let expected = expected(&request, &current)?;
    // Metadatenzeitprüfung folgt dem bisherigen generischen Revisionsvertrag.
    if string(&a["updatedAt"])? < string(&a["createdAt"])? {
        return fail(
            "INVALID_AGGREGATE",
            "Der Änderungszeitpunkt darf nicht vor dem Erstellungszeitpunkt liegen.",
        );
    }
    transition(&a, &request.space_id, &expected, &current)?;
    // Nur bereinigte Darstellungsfelder werden ausgegeben, kein zusätzlicher Systemzeitbezug.
    Ok(
        json!({"contractVersion":1,"status":"changed","changeSet":{"spaceId":request.space_id,"commandType":command_type,"operationId":request.context.operation_id,"occurredAt":request.context.occurred_at,"expectedRevisions":request.expected_revisions.iter().map(|e|json!({"id":e.id,"expectedRevision":e.expected_revision})).collect::<Vec<_>>(),"aggregates":[a]}}),
    )
}
