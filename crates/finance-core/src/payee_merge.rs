// SPDX-License-Identifier: AGPL-3.0-or-later
//! Typisierter Empfängermerge bewahrt Buchungsfelder und schützt die Referenzabfrage.
use crate::{
    CoreResult,
    aggregate_schema::INVALID,
    command_contracts::{self, COMMAND_ERROR, ChangeSet, Expectation, Request},
    models::{Aggregate, AggregateKind, Clearance, Command, Payee},
    scalars::{EntityId, NonEmptyText, Revision},
    state_validation,
};
use std::collections::BTreeSet;
pub(crate) fn execute_typed(request: Request) -> CoreResult<ChangeSet> {
    request.check_versions()?;
    let Command::PayeeMerge(cmd) = &request.command else {
        return Err(COMMAND_ERROR);
    };
    let current = request.current();
    let space = &request.space_id;
    let scope = request.scope();
    let read_payee = |id: &EntityId| -> CoreResult<Payee> {
        let a = current.get(id).copied().ok_or(INVALID)?;
        let Aggregate::Payee(a) = crate::master_commands::normalize_typed(a.clone(), "payee")?
        else {
            return Err(INVALID);
        };
        Ok(a)
    };
    let mut target = read_payee(&cmd.target_id)?;
    if target.space_id != *space || target.archived || target.deleted_at.is_some() {
        return Err((
            "INVALID_COMMAND",
            "Der Ziel-Empfänger muss aktiv sein und zum selben Bereich gehören.",
        ));
    }
    let mut sources = vec![];
    let mut source_set = BTreeSet::new();
    for id in cmd.source_ids.as_slice() {
        let source = read_payee(id)?;
        if source.space_id != *space
            || source.id == target.id
            || source.archived
            || source.deleted_at.is_some()
        {
            return Err((
                "INVALID_COMMAND",
                "Quell-Empfänger müssen aktiv, verschieden vom Ziel und im selben Bereich sein.",
            ));
        }
        if !source_set.insert(id) {
            return Err((
                "DUPLICATE_REFERENCE",
                "Ein Quell-Empfänger darf nur einmal zusammengeführt werden.",
            ));
        }
        sources.push(source);
    }
    if current.len() != request.aggregates.len()
        || request.aggregates.iter().any(|a| a.space_id() != space)
    {
        return Err((
            "INVALID_AGGREGATE",
            "Der Fachbestand für die Empfängerzusammenführung ist nicht eindeutig im aktuellen Bereich.",
        ));
    }
    let stored = request
        .aggregates
        .iter()
        .filter_map(|a| {
            if let Aggregate::Transaction(tx) = a
                && a.is_live()
                && tx
                    .payee_id
                    .as_ref()
                    .is_some_and(|id| source_set.contains(id))
            {
                Some(tx)
            } else {
                None
            }
        })
        .collect::<Vec<_>>();
    let mut transaction_set = BTreeSet::new();
    for id in &cmd.transaction_ids {
        let Aggregate::Transaction(tx) = current.get(id).copied().ok_or(INVALID)? else {
            return Err(INVALID);
        };
        if tx.space_id != *space
            || !tx
                .payee_id
                .as_ref()
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
        if tx.clearance == Clearance::Reconciled {
            return Err((
                "INVALID_COMMAND",
                "Abgeglichene Buchungen müssen vor der Empfängerzusammenführung ausdrücklich entsperrt werden.",
            ));
        }
    }
    if stored.len() != transaction_set.len()
        || stored.iter().any(|tx| !transaction_set.contains(&tx.id))
    {
        return Err((
            "INVALID_COMMAND",
            "Die Empfängerreferenzliste ist unvollständig.",
        ));
    }
    let mut aliases = target
        .aliases
        .iter()
        .map(|a| a.as_str().to_owned())
        .collect::<Vec<_>>();
    for source in &sources {
        aliases.push(source.name.as_str().to_owned());
        aliases.extend(source.aliases.iter().map(|a| a.as_str().to_owned()));
    }
    let name = state_validation::normal_text(target.name.as_str()).to_lowercase();
    let mut seen = BTreeSet::new();
    let mut normalized = vec![];
    for alias in aliases {
        let display = state_validation::normal_text(&alias);
        let key = display.to_lowercase();
        if key == name || !seen.insert(key) {
            continue;
        }
        normalized.push(NonEmptyText::new(display)?);
    }
    target.aliases = normalized;
    let target_id = target.id.clone();
    let time = &request.context.occurred_at;
    let mut changes = vec![command_contracts::revise(Aggregate::Payee(target), time)?];
    for mut source in sources {
        source.archived = true;
        changes.push(command_contracts::revise(Aggregate::Payee(source), time)?);
    }
    for tx in stored {
        let mut tx = tx.clone();
        tx.payee_id = Some(target_id.clone());
        changes.push(command_contracts::revise(Aggregate::Transaction(tx), time)?);
    }
    crate::references::typed_validate(&changes, &request.aggregates)?;
    let mut expected = request.expected_revisions.clone();
    let guard = current.get(space).copied();
    if guard.is_some_and(|a| a.kind() != AggregateKind::FinancialRevision) {
        return Err((
            "INVALID_AGGREGATE",
            "Die reservierte lokale Finanzrevision ist nicht verfügbar.",
        ));
    }
    let revision = Revision::new(guard.map(|a| a.revision().value()).unwrap_or(0))?;
    if !expected.iter().any(|e| &e.id == space) {
        expected.push(Expectation {
            id: space.clone(),
            expected_revision: revision,
        });
    }
    command_contracts::inspect_changes(&changes, &expected, &scope)?;
    let mut canonical = changes
        .iter()
        .map(|a| {
            Ok(Expectation {
                id: a.id().clone(),
                expected_revision: Revision::new(a.revision().value() - 1)?,
            })
        })
        .collect::<CoreResult<Vec<_>>>()?;
    canonical.push(Expectation {
        id: space.clone(),
        expected_revision: revision,
    });
    for e in expected {
        if !canonical.iter().any(|old| old.id == e.id) {
            canonical.push(e);
        }
    }
    Ok(request.changed("payee.merge", changes, canonical))
}
