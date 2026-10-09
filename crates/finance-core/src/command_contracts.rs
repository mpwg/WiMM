// SPDX-License-Identifier: AGPL-3.0-or-later
//! Typisierte Befehlsverträge und CAS-Prüfungen ohne Speicherung oder Plattform.
use crate::{
    CoreResult, MAX_SAFE,
    aggregate_schema::INVALID,
    models::{Aggregate, AggregateKind, Command},
    scalars::{EntityId, Revision, StoredRevision, UtcTimestamp},
};
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
pub const COMMAND_ERROR: (&str, &str) = ("INVALID_COMMAND", "Der Fachbefehl ist ungültig.");
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Expectation {
    pub id: EntityId,
    pub expected_revision: Revision,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Context {
    pub operation_id: EntityId,
    pub occurred_at: UtcTimestamp,
    pub generated_ids: Vec<EntityId>,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Request {
    pub contract_version: u32,
    pub domain_schema_version: u32,
    pub space_id: EntityId,
    pub aggregates: Vec<Aggregate>,
    pub command: Command,
    pub expected_revisions: Vec<Expectation>,
    pub context: Context,
}
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ChangeSet {
    pub space_id: EntityId,
    pub command_type: String,
    pub operation_id: EntityId,
    pub occurred_at: UtcTimestamp,
    pub expected_revisions: Vec<Expectation>,
    pub aggregates: Vec<Aggregate>,
}
pub struct Scope<'a> {
    pub space_id: &'a EntityId,
    pub aggregates: &'a [Aggregate],
    pub context: &'a Context,
}
impl Scope<'_> {
    pub fn current(&self) -> BTreeMap<&EntityId, &Aggregate> {
        self.aggregates.iter().map(|a| (a.id(), a)).collect()
    }
}
impl Request {
    pub fn check_versions(&self) -> CoreResult<()> {
        if self.contract_version != 1 || self.domain_schema_version != 1 {
            Err(COMMAND_ERROR)
        } else {
            Ok(())
        }
    }
    pub fn scope(&self) -> Scope<'_> {
        Scope {
            space_id: &self.space_id,
            aggregates: &self.aggregates,
            context: &self.context,
        }
    }
    pub fn current(&self) -> BTreeMap<&EntityId, &Aggregate> {
        self.aggregates.iter().map(|a| (a.id(), a)).collect()
    }
    pub fn changed(
        &self,
        command: &str,
        aggregates: Vec<Aggregate>,
        expected_revisions: Vec<Expectation>,
    ) -> ChangeSet {
        ChangeSet {
            space_id: self.space_id.clone(),
            command_type: command.to_owned(),
            operation_id: self.context.operation_id.clone(),
            occurred_at: self.context.occurred_at.clone(),
            expected_revisions,
            aggregates,
        }
    }
}
pub fn expected(
    request: &Scope<'_>,
    expectations: &[Expectation],
    current: &BTreeMap<&EntityId, &Aggregate>,
) -> CoreResult<BTreeMap<EntityId, Revision>> {
    let mut result = BTreeMap::new();
    for e in expectations {
        if result.contains_key(&e.id) {
            return Err((
                "DUPLICATE_REFERENCE",
                "Jede Aggregatrevision darf in einem Befehl nur einmal erwartet werden.",
            ));
        }
        if let Some(a) = current.get(&e.id) {
            if a.space_id() != request.space_id {
                return Err((
                    "CROSS_SPACE_REFERENCE",
                    "Eine erwartete Aggregatrevision verweist auf einen anderen Bereich.",
                ));
            }
            if a.revision().value() != e.expected_revision.value() {
                return Err((
                    "REVISION_CONFLICT",
                    "Eine erwartete Aggregatrevision ist nicht mehr aktuell.",
                ));
            }
        } else if e.expected_revision.value() != 0 {
            return Err((
                "REVISION_CONFLICT",
                "Eine erwartete Aggregatrevision verweist auf kein vorhandenes Aggregat.",
            ));
        }
        result.insert(e.id.clone(), e.expected_revision);
    }
    Ok(result)
}
pub fn transition(
    a: &Aggregate,
    space: &EntityId,
    expected: &BTreeMap<EntityId, Revision>,
    current: &BTreeMap<&EntityId, &Aggregate>,
) -> CoreResult<()> {
    if (a.id() == space) != (a.kind() == AggregateKind::FinancialRevision) {
        return Err((
            "INVALID_AGGREGATE",
            "Die Bereichs-ID ist ausschließlich für die lokale Finanzrevision reserviert.",
        ));
    }
    if a.space_id() != space {
        return Err((
            "CROSS_SPACE_REFERENCE",
            "Ein vollständiges Aggregat verweist auf einen anderen Bereich.",
        ));
    }
    let previous = expected
        .get(a.id())
        .ok_or((
            "REVISION_MISSING",
            "Für jedes geänderte Aggregat muss eine erwartete Revision angegeben sein.",
        ))?
        .value();
    let old = current.get(a.id());
    if previous == 0 {
        if old.is_some() {
            return Err((
                "REVISION_CONFLICT",
                "Ein bereits vorhandenes Aggregat kann nicht mit Revision null angelegt werden.",
            ));
        }
        if a.revision().value() != 1 {
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
        if old.space_id() != a.space_id() || old.kind() != a.kind() {
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
        if a.revision().value() != previous + 1 {
            return Err((
                "REVISION_CONFLICT",
                "Die neue Aggregatrevision muss genau um eins steigen.",
            ));
        }
    }
    Ok(())
}
pub fn revise(mut a: Aggregate, time: &UtcTimestamp) -> CoreResult<Aggregate> {
    if a.revision().value() == MAX_SAFE {
        return Err((
            "REVISION_OVERFLOW",
            "Die Aggregatrevision kann nicht mehr sicher erhöht werden.",
        ));
    }
    if time < a.created_at() {
        return Err((
            "INVALID_GENERATOR",
            "Der erzeugte Änderungszeitpunkt liegt vor dem Erstellungszeitpunkt.",
        ));
    }
    *a.revision_mut() = StoredRevision::new(a.revision().value() + 1)?;
    *a.updated_at_mut() = time.clone();
    Ok(a)
}
pub fn inspect_changes(
    changes: &[Aggregate],
    expected_revisions: &[Expectation],
    request: &Scope<'_>,
) -> CoreResult<()> {
    let current = request.current();
    let checked = expected(request, expected_revisions, &current)?;
    let mut ids = std::collections::BTreeSet::new();
    for a in changes {
        if a.updated_at() < a.created_at() {
            return Err((
                "INVALID_AGGREGATE",
                "Der Änderungszeitpunkt darf nicht vor dem Erstellungszeitpunkt liegen.",
            ));
        }
        if !ids.insert(a.id()) {
            return Err((
                "DUPLICATE_REFERENCE",
                "Ein Aggregat darf in einer Änderungsmenge nur einmal vorkommen.",
            ));
        }
        transition(a, request.space_id, &checked, &current)?;
    }
    Ok(())
}
pub fn to_wire(changes: ChangeSet) -> CoreResult<serde_json::Value> {
    serde_json::to_value(
        serde_json::json!({"contractVersion":1,"status":"changed","changeSet":changes}),
    )
    .map_err(|_| INVALID)
}

#[derive(Debug, Clone)]
pub enum CommandResult {
    Changed(ChangeSet),
    Unchanged,
}
impl CommandResult {
    pub fn to_wire(self) -> CoreResult<serde_json::Value> {
        match self {
            Self::Changed(change) => to_wire(change),
            Self::Unchanged => Ok(serde_json::json!({"contractVersion":1,"status":"unchanged"})),
        }
    }
}
