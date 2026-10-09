// SPDX-License-Identifier: AGPL-3.0-or-later
//! Typisierte Regelreihenfolge; Grenzprüfungen erhalten die V1-Fehlerpriorität.
use crate::{
    CoreResult, MAX_SAFE,
    command_contracts::{self, COMMAND_ERROR, ChangeSet, Context, Expectation},
    models::{Aggregate, Command},
    scalars::{EntityId, Ordinal, Revision, StoredRevision, UtcTimestamp},
};
use serde::Deserialize;
use serde_json::Value;
use std::collections::{BTreeMap, BTreeSet};
#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct Boundary {
    contract_version: u32,
    domain_schema_version: u32,
    space_id: String,
    aggregates: Vec<Aggregate>,
    command: Command,
    expected_revisions: Vec<crate::master_commands::Expectation>,
    context: crate::master_commands::Context,
}
pub(crate) fn execute(decoded: Value) -> CoreResult<Value> {
    let request: Boundary = serde_json::from_value(decoded).map_err(|_| COMMAND_ERROR)?;
    if request.contract_version != 1
        || request.domain_schema_version != 1
        || !crate::valid_id(&request.space_id)
    {
        return Err(COMMAND_ERROR);
    }
    let Command::RuleReorder(command) = request.command else {
        return Err(COMMAND_ERROR);
    };
    const GENERATOR: (&str, &str) = ("INVALID_GENERATOR", "Der erzeugte Kontext ist ungültig.");
    let context = Context {
        operation_id: EntityId::new(request.context.operation_id).map_err(|_| GENERATOR)?,
        occurred_at: UtcTimestamp::new(request.context.occurred_at).map_err(|_| GENERATOR)?,
        generated_ids: request
            .context
            .generated_ids
            .into_iter()
            .map(|id| EntityId::new(id).map_err(|_| GENERATOR))
            .collect::<CoreResult<_>>()?,
    };
    let space = EntityId::new(request.space_id).map_err(|_| COMMAND_ERROR)?;
    let mut current = BTreeMap::new();
    for aggregate in &request.aggregates {
        if aggregate.space_id() != &space || current.insert(aggregate.id(), aggregate).is_some() {
            return Err(("INVALID_AGGREGATE", "Der Finanzbestand ist ungültig."));
        }
    }
    let rules = current
        .iter()
        .filter_map(|(id, value)| {
            if let Aggregate::Rule(rule) = value
                && rule.deleted_at.is_none()
            {
                Some((*id, rule))
            } else {
                None
            }
        })
        .collect::<BTreeMap<_, _>>();
    let ids = command.rule_ids.iter().collect::<BTreeSet<_>>();
    if ids.len() != command.rule_ids.len()
        || ids.len() != rules.len()
        || rules.keys().any(|id| !ids.contains(id))
    {
        return Err((
            "INVALID_COMMAND",
            "Die neue Reihenfolge muss alle Regeln genau einmal enthalten.",
        ));
    }
    if rules.is_empty() {
        return Err(("INVALID_COMMAND", "Die Änderung ist leer."));
    }
    let mut expected = BTreeMap::new();
    for e in request.expected_revisions {
        const EXPECTED: (&str, &str) = ("INVALID_COMMAND", "Eine erwartete Revision ist ungültig.");
        let id = EntityId::new(e.id).map_err(|_| EXPECTED)?;
        let revision = Revision::new(e.expected_revision).map_err(|_| EXPECTED)?;
        if expected.insert(id.clone(), revision).is_some() {
            return Err((
                "DUPLICATE_REFERENCE",
                "Jede Aggregatrevision darf in einem Befehl nur einmal erwartet werden.",
            ));
        }
        let head = current.get(&id).map(|a| a.revision().value()).unwrap_or(0);
        if revision.value() != head {
            return Err((
                "REVISION_CONFLICT",
                "Eine erwartete Aggregatrevision ist nicht mehr aktuell.",
            ));
        }
    }
    let mut aggregates = vec![];
    let mut expectations = vec![];
    for (order, id) in command.rule_ids.iter().enumerate() {
        let rule = rules[id];
        let revision = rule.revision.value();
        if expected.get(id).map(|r| r.value()) != Some(revision) {
            return Err(("REVISION_MISSING", "Die erwartete Revision fehlt."));
        }
        if revision == MAX_SAFE {
            return Err((
                "REVISION_OVERFLOW",
                "Die Aggregatrevision kann nicht mehr sicher erhöht werden.",
            ));
        }
        if context.occurred_at < rule.created_at {
            return Err((
                "INVALID_GENERATOR",
                "Der erzeugte Änderungszeitpunkt liegt vor dem Erstellungszeitpunkt.",
            ));
        }
        let mut next = rule.clone();
        next.revision = StoredRevision::new(revision + 1)?;
        next.updated_at = context.occurred_at.clone();
        next.order = Ordinal::new(i64::try_from(order).map_err(|_| COMMAND_ERROR)?)?;
        aggregates.push(Aggregate::Rule(next));
        expectations.push(Expectation {
            id: id.clone(),
            expected_revision: Revision::new(revision)?,
        });
    }
    command_contracts::to_wire(ChangeSet {
        space_id: space,
        command_type: "rule.reorder".to_owned(),
        operation_id: context.operation_id,
        occurred_at: context.occurred_at,
        expected_revisions: expectations,
        aggregates,
    })
}
