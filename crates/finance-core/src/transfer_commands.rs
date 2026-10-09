// SPDX-License-Identifier: AGPL-3.0-or-later
//! Transfer und beide Seiten werden ausschließlich gemeinsam typisiert vorbereitet.
use crate::{
    CoreResult,
    aggregate_schema::INVALID,
    command_contracts::{self, COMMAND_ERROR, Expectation, Request},
    models::{
        Aggregate, AggregateKind, Clearance, Command, GroupKind, Transaction, TransactionKind,
    },
    scalars::{EntityId, Revision},
    typed_financial,
};
use serde_json::Value;
use std::collections::BTreeMap;
fn needed<'a>(
    current: &BTreeMap<&EntityId, &'a Aggregate>,
    id: &EntityId,
    kind: AggregateKind,
    space: &EntityId,
) -> CoreResult<&'a Aggregate> {
    current
        .get(id)
        .copied()
        .filter(|a| a.kind() == kind && a.space_id() == space)
        .ok_or((
            "INVALID_AGGREGATE",
            "Eine benötigte Referenz ist nicht im selben Bereich vorhanden.",
        ))
}
fn normalize(a: &Aggregate) -> CoreResult<Transaction> {
    let Aggregate::Transaction(a) = a else {
        return Err((
            "INVALID_AGGREGATE",
            "Die Buchung hat einen unpassenden Aggregattyp.",
        ));
    };
    typed_financial::normalize(a.clone())
}
pub fn execute(decoded: Value) -> CoreResult<Value> {
    let request: Request = serde_json::from_value(decoded).map_err(|_| COMMAND_ERROR)?;
    command_contracts::to_wire(execute_typed(request)?)
}
pub(crate) fn execute_typed(request: Request) -> CoreResult<command_contracts::ChangeSet> {
    request.check_versions()?;
    let current = request.current();
    let scope = request.scope();
    let (deleting, command_type, transfer, source, target) = match &request.command {
        Command::TransferDelete(c) => {
            let a = current
                .get(&c.aggregate_id)
                .copied()
                .filter(|a| a.kind() == AggregateKind::Transfer)
                .ok_or(INVALID)?;
            let Aggregate::Transfer(t) = a else {
                return Err(INVALID);
            };
            let source = needed(
                &current,
                &t.source_transaction_id,
                AggregateKind::Transaction,
                &request.space_id,
            )?;
            let target = needed(
                &current,
                &t.target_transaction_id,
                AggregateKind::Transaction,
                &request.space_id,
            )?;
            (
                true,
                "transfer.delete",
                t.clone(),
                normalize(source)?,
                normalize(target)?,
            )
        }
        Command::TransferSave(c) => {
            let entries = c.aggregates.as_slice();
            if entries.len() != 3 {
                return Err((
                    "INVALID_COMMAND",
                    "Eine Umbuchung benötigt Transfer und beide vollständigen Seiten.",
                ));
            }
            let transfer = entries
                .iter()
                .find_map(|a| {
                    if let Aggregate::Transfer(t) = a {
                        Some(t)
                    } else {
                        None
                    }
                })
                .ok_or(INVALID)?;
            let source = entries
                .iter()
                .find(|a| a.id() == &transfer.source_transaction_id)
                .ok_or(INVALID)?;
            let target = entries
                .iter()
                .find(|a| a.id() == &transfer.target_transaction_id)
                .ok_or(INVALID)?;
            (
                false,
                "transfer.save",
                transfer.clone(),
                normalize(source)?,
                normalize(target)?,
            )
        }
        _ => return Err(COMMAND_ERROR),
    };
    if transfer.space_id != request.space_id {
        return Err((
            "CROSS_SPACE_REFERENCE",
            "Die Umbuchung gehört zu einem anderen Bereich.",
        ));
    }
    let amount = transfer.amount.cents();
    if amount <= 0 {
        return Err((
            "INVALID_AGGREGATE",
            "Der Umbuchungsbetrag muss positiv sein.",
        ));
    }
    if transfer.source_account_id == transfer.target_account_id {
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
        if side.space_id != request.space_id {
            return Err((
                "CROSS_SPACE_REFERENCE",
                "Die Umbuchungsbuchung gehört zu einem anderen Bereich.",
            ));
        }
        if side.kind != TransactionKind::Transfer
            || side.transfer_id.as_ref() != Some(&transfer.id)
            || !side.splits.is_empty()
        {
            return Err(("INVALID_AGGREGATE", message));
        }
    }
    if source.id != transfer.source_transaction_id
        || target.id != transfer.target_transaction_id
        || source.account_id != transfer.source_account_id
        || target.account_id != transfer.target_account_id
        || source.date != transfer.date
        || target.date != transfer.date
        || source.amount.cents() != -amount
        || target.amount.cents() != amount
    {
        return Err((
            "INVALID_AGGREGATE",
            "Die Umbuchungsseiten müssen entgegengesetzte Beträge, Konten und dasselbe Datum besitzen.",
        ));
    }
    let source_account = needed(
        &current,
        &transfer.source_account_id,
        AggregateKind::Account,
        &request.space_id,
    )?;
    let target_account = needed(
        &current,
        &transfer.target_account_id,
        AggregateKind::Account,
        &request.space_id,
    )?;
    let Aggregate::Account(source_account_value) = source_account else {
        return Err(INVALID);
    };
    let Aggregate::Account(target_account_value) = target_account else {
        return Err(INVALID);
    };
    let leaves = source_account_value.on_budget && !target_account_value.on_budget;
    let enters = !source_account_value.on_budget && target_account_value.on_budget;
    let budget = transfer.budget_category_id.as_ref();
    if leaves && budget.is_none() {
        return Err((
            "INVALID_AGGREGATE",
            "Beim Verlassen des Budgets ist eine Ausgabenkategorie erforderlich.",
        ));
    }
    let category = budget.and_then(|id| current.get(id).copied());
    let group = category.and_then(|a| {
        if let Aggregate::Category(c) = a {
            current.get(&c.group_id).copied()
        } else {
            None
        }
    });
    if leaves
        && (category.is_none_or(|a| {
            a.kind() != AggregateKind::Category || a.space_id() != &request.space_id
        }) || group.is_none_or(|a| {
            a.space_id() != &request.space_id
                || !matches!(a,Aggregate::CategoryGroup(g) if g.kind==GroupKind::Expense)
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
    if enters != transfer.budget_release.unwrap_or(false) {
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
        if side.clearance == Clearance::Reconciled
            || current.get(&side.id).is_some_and(
                |a| matches!(a,Aggregate::Transaction(t) if t.clearance==Clearance::Reconciled),
            )
        {
            return Err(("INVALID_COMMAND", blocked));
        }
    }
    let mut expected = request.expected_revisions.clone();
    for a in [Some(source_account), Some(target_account), category, group]
        .into_iter()
        .flatten()
    {
        if !expected.iter().any(|e| &e.id == a.id()) {
            expected.push(Expectation {
                id: a.id().clone(),
                expected_revision: Revision::new(a.revision().value())?,
            });
        }
    }
    let mut changes = vec![
        Aggregate::Transfer(transfer),
        Aggregate::Transaction(source),
        Aggregate::Transaction(target),
    ];
    if deleting {
        changes = changes
            .into_iter()
            .map(|mut a| {
                *a.deleted_at_mut() = Some(a.updated_at().clone());
                command_contracts::revise(a, &request.context.occurred_at)
            })
            .collect::<CoreResult<_>>()?;
    }
    command_contracts::inspect_changes(&changes, &expected, &scope)?;
    let (changes, expected) = typed_financial::prepare(changes, expected, &scope)?;
    command_contracts::inspect_changes(&changes, &expected, &scope)?;
    Ok(request.changed(command_type, changes, expected))
}
