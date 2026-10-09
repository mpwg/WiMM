// SPDX-License-Identifier: AGPL-3.0-or-later
//! Grenzadapter für die noch nicht umgestellten Aufrufer. Fachprüfung nur typisiert.
use crate::{
    CoreResult,
    aggregate_schema::INVALID,
    command_contracts::{self, Scope},
    master_commands::{Expectation, Request},
    models::Aggregate,
    scalars::{EntityId, Revision, UtcTimestamp},
};
use serde_json::Value;
use std::collections::BTreeMap;
const COMMAND: (&str, &str) = ("INVALID_COMMAND", "Der Fachbefehl ist ungültig.");
fn wire(a: Aggregate) -> CoreResult<Value> {
    serde_json::to_value(a).map_err(|_| INVALID)
}
pub(crate) fn typed_expected(
    values: &[Expectation],
) -> CoreResult<Vec<command_contracts::Expectation>> {
    values
        .iter()
        .map(|e| {
            Ok(command_contracts::Expectation {
                id: EntityId::new(e.id.clone()).map_err(|_| COMMAND)?,
                expected_revision: Revision::new(e.expected_revision).map_err(|_| COMMAND)?,
            })
        })
        .collect()
}
fn legacy_expected(values: Vec<command_contracts::Expectation>) -> Vec<Expectation> {
    values
        .into_iter()
        .map(|e| Expectation {
            id: e.id.as_str().to_owned(),
            expected_revision: e.expected_revision.value(),
        })
        .collect()
}
pub(crate) fn context(request: &Request) -> CoreResult<command_contracts::Context> {
    Ok(command_contracts::Context {
        operation_id: EntityId::new(request.context.operation_id.clone()).map_err(|_| COMMAND)?,
        occurred_at: UtcTimestamp::new(request.context.occurred_at.clone()).map_err(|_| COMMAND)?,
        generated_ids: request
            .context
            .generated_ids
            .iter()
            .map(|id| EntityId::new(id.clone()).map_err(|_| COMMAND))
            .collect::<CoreResult<_>>()?,
    })
}
pub(crate) fn revise(a: Value, time: &str) -> CoreResult<Value> {
    wire(command_contracts::revise(
        Aggregate::from_wire(&a)?,
        &UtcTimestamp::new(time.to_owned()).map_err(|_| COMMAND)?,
    )?)
}
pub(crate) fn normalize(tx: Value) -> CoreResult<Value> {
    if crate::aggregate_schema::kind(&tx) != "transaction" {
        return Err((
            "INVALID_AGGREGATE",
            "Die Buchung hat einen unpassenden Aggregattyp.",
        ));
    }
    let Aggregate::Transaction(tx) = Aggregate::from_wire(&tx)? else {
        return Err(INVALID);
    };
    wire(Aggregate::Transaction(crate::typed_financial::normalize(
        tx,
    )?))
}
pub(crate) fn inspect_changes(
    changes: &[Value],
    space: &str,
    expected: &[Expectation],
    current: &BTreeMap<&str, &Value>,
    request: &Request,
) -> CoreResult<()> {
    let all = current
        .values()
        .map(|a| Aggregate::from_wire(a))
        .collect::<CoreResult<Vec<_>>>()?;
    let changes = changes
        .iter()
        .map(Aggregate::from_wire)
        .collect::<CoreResult<Vec<_>>>()?;
    let space_id = EntityId::new(space.to_owned()).map_err(|_| COMMAND)?;
    let context = context(request)?;
    let scope = Scope {
        space_id: &space_id,
        aggregates: &all,
        context: &context,
    };
    command_contracts::inspect_changes(&changes, &typed_expected(expected)?, &scope)
}
pub(crate) fn prepare_financial(
    changes: Vec<Value>,
    expected: Vec<Expectation>,
    request: &Request,
) -> CoreResult<(Vec<Value>, Vec<Expectation>)> {
    let changes = changes
        .iter()
        .map(Aggregate::from_wire)
        .collect::<CoreResult<Vec<_>>>()?;
    let all = request
        .aggregates
        .iter()
        .map(Aggregate::from_wire)
        .collect::<CoreResult<Vec<_>>>()?;
    let space = EntityId::new(request.space_id.clone()).map_err(|_| COMMAND)?;
    let context = context(request)?;
    let scope = Scope {
        space_id: &space,
        aggregates: &all,
        context: &context,
    };
    let (changes, expected) =
        crate::typed_financial::prepare(changes, typed_expected(&expected)?, &scope)?;
    Ok((
        changes.into_iter().map(wire).collect::<CoreResult<_>>()?,
        legacy_expected(expected),
    ))
}
pub fn execute(decoded: Value) -> CoreResult<Value> {
    let request: command_contracts::Request =
        serde_json::from_value(decoded).map_err(|_| COMMAND)?;
    command_contracts::to_wire(crate::typed_financial::execute(request)?)
}
