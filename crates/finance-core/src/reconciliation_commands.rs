// SPDX-License-Identifier: AGPL-3.0-or-later
//! Typisierter Abgleich ohne Geldmutation; verbundene Transfers gemeinsam entsperren.
use crate::{
    CoreResult,
    aggregate_schema::INVALID,
    command_contracts::{self, COMMAND_ERROR, ChangeSet, Expectation, Request},
    models::{
        Aggregate, AggregateKind, Clearance, Command, Reconciliation, Transaction, TransactionKind,
    },
    scalars::{EntityId, MoneyCents, Revision, StoredRevision},
    typed_financial,
};
use serde_json::Value;
use std::collections::{BTreeMap, BTreeSet};
fn read<'a>(
    current: &BTreeMap<&EntityId, &'a Aggregate>,
    id: &EntityId,
    kind: AggregateKind,
) -> CoreResult<&'a Aggregate> {
    current
        .get(id)
        .copied()
        .filter(|a| a.kind() == kind)
        .ok_or(("INVALID_AGGREGATE", "Eine Abgleichbuchung fehlt."))
}
fn tx<'a>(
    current: &BTreeMap<&EntityId, &'a Aggregate>,
    id: &EntityId,
) -> CoreResult<&'a Transaction> {
    let Aggregate::Transaction(tx) = read(current, id, AggregateKind::Transaction)? else {
        return Err(INVALID);
    };
    Ok(tx)
}
fn add_expected(expected: &mut Vec<Expectation>, a: &Aggregate) -> CoreResult<()> {
    if !expected.iter().any(|e| &e.id == a.id()) {
        expected.push(Expectation {
            id: a.id().clone(),
            expected_revision: Revision::new(a.revision().value())?,
        });
    }
    Ok(())
}
pub fn execute(decoded: Value) -> CoreResult<Value> {
    let request: Request = serde_json::from_value(decoded).map_err(|_| COMMAND_ERROR)?;
    command_contracts::to_wire(execute_typed(request, None)?)
}
pub(crate) fn execute_typed(
    request: Request,
    override_record: Option<Reconciliation>,
) -> CoreResult<ChangeSet> {
    request.check_versions()?;
    let current = request.current();
    let time = &request.context.occurred_at;
    let space = &request.space_id;
    let mut expected = request.expected_revisions.clone();
    let mut changes = vec![];
    let command_type = match &request.command {
        Command::ReconciliationConfirm(command) => {
            let ids = command.selected_transaction_ids.as_slice();
            let mut unique = BTreeSet::new();
            for id in ids {
                if !unique.insert(id) {
                    return Err((
                        "DUPLICATE_REFERENCE",
                        "Eine Abgleichbuchung darf nur einmal vorkommen.",
                    ));
                }
            }
            let account = read(&current, &command.account_id, AggregateKind::Account)?;
            let rec = if let Some(record) = override_record.as_ref() {
                record.clone()
            } else {
                Reconciliation {
                    id: request
                        .context
                        .generated_ids
                        .first()
                        .ok_or((
                            "INVALID_GENERATOR",
                            "Die erzeugte Aggregat-ID ist ungültig.",
                        ))?
                        .clone(),
                    space_id: space.clone(),
                    revision: StoredRevision::new(1)?,
                    created_at: time.clone(),
                    updated_at: time.clone(),
                    deleted_at: None,
                    account_id: account.id().clone(),
                    statement_date: command.statement_date.clone(),
                    statement_balance: command.statement_balance,
                    transaction_ids: command.selected_transaction_ids.clone(),
                }
            };
            let selected = ids
                .iter()
                .map(|id| tx(&current, id))
                .collect::<CoreResult<Vec<_>>>()?;
            for tx in &selected {
                typed_financial::normalize((*tx).clone())?;
                if &tx.space_id != space
                    || &tx.account_id != account.id()
                    || tx.deleted_at.is_some()
                {
                    return Err((
                        "INVALID_AGGREGATE",
                        "Eine Abgleichbuchung passt nicht zum Kontoauszug.",
                    ));
                }
            }
            let previous = request
                .aggregates
                .iter()
                .filter_map(|a| {
                    if let Aggregate::Transaction(tx) = a
                        && a.is_live()
                        && &tx.account_id == account.id()
                        && tx.clearance == Clearance::Reconciled
                        && tx.date <= command.statement_date
                        && !ids.contains(&tx.id)
                    {
                        Some(tx)
                    } else {
                        None
                    }
                })
                .collect::<Vec<_>>();
            let mut sum = MoneyCents::new(0)?;
            for tx in previous.iter().chain(&selected) {
                typed_financial::normalize((*tx).clone())?;
                if &tx.space_id != space || tx.date > command.statement_date {
                    return Err((
                        "INVALID_AGGREGATE",
                        "Die Auszugsauswahl enthält unpassende oder doppelte Buchungen.",
                    ));
                }
                sum = sum.checked_add(tx.amount).map_err(|(code, _)| {
                    (
                        code,
                        "Die Geldsumme überschreitet den sicheren Centbereich.",
                    )
                })?;
            }
            let difference = rec
                .statement_balance
                .checked_add(MoneyCents::new(-sum.cents())?)
                .map_err(|(code, _)| {
                    (
                        code,
                        "Die Auszugsdifferenz überschreitet den sicheren Centbereich.",
                    )
                })?;
            if difference.cents() != 0 {
                return Err((
                    "INVALID_COMMAND",
                    "Die Auszugsdifferenz muss vor der Bestätigung null sein.",
                ));
            }
            if selected
                .iter()
                .any(|tx| tx.clearance == Clearance::Reconciled)
            {
                return Err((
                    "INVALID_COMMAND",
                    "Bereits abgeglichene Buchungen gehören zum bestätigten Ausgangssaldo.",
                ));
            }
            changes.push(Aggregate::Reconciliation(rec));
            for tx in &selected {
                let mut a = (*tx).clone();
                a.clearance = Clearance::Reconciled;
                changes.push(command_contracts::revise(Aggregate::Transaction(a), time)?);
                add_expected(&mut expected, &Aggregate::Transaction((*tx).clone()))?;
            }
            for tx in &previous {
                add_expected(&mut expected, &Aggregate::Transaction((*tx).clone()))?;
            }
            add_expected(&mut expected, account)?;
            "reconciliation.confirm"
        }
        Command::ReconciliationUnlock(command) => {
            let record = read(
                &current,
                &command.reconciliation_id,
                AggregateKind::Reconciliation,
            )?;
            let Aggregate::Reconciliation(rec) = record else {
                return Err(INVALID);
            };
            if !record.is_live() {
                return Err((
                    "INVALID_COMMAND",
                    "Der zugehörige vollständige Abgleich fehlt.",
                ));
            }
            let initial = rec.transaction_ids.as_slice();
            let seed = initial.first().ok_or(INVALID)?;
            let txs = request
                .aggregates
                .iter()
                .filter_map(|a| {
                    if let Aggregate::Transaction(tx) = a
                        && a.is_live()
                    {
                        Some(tx)
                    } else {
                        None
                    }
                })
                .collect::<Vec<_>>();
            let recs = request
                .aggregates
                .iter()
                .filter_map(|a| {
                    if let Aggregate::Reconciliation(rec) = a
                        && a.is_live()
                    {
                        Some(rec)
                    } else {
                        None
                    }
                })
                .collect::<Vec<_>>();
            let mut ids = if override_record.is_some() {
                initial.iter().cloned().collect::<BTreeSet<_>>()
            } else {
                BTreeSet::from([seed.clone()])
            };
            let mut groups = if override_record.is_some() {
                BTreeSet::from([rec.id.clone()])
            } else {
                BTreeSet::new()
            };
            let mut expanded = override_record.is_none();
            while expanded {
                expanded = false;
                for tx in txs
                    .iter()
                    .filter(|a| ids.contains(&a.id))
                    .copied()
                    .collect::<Vec<_>>()
                {
                    if let Some(id) = &tx.transfer_id {
                        let Aggregate::Transfer(transfer) = current
                            .get(id)
                            .copied()
                            .filter(|a| a.kind() == AggregateKind::Transfer && a.is_live())
                            .ok_or(("INVALID_AGGREGATE", "Die vollständige Umbuchung fehlt."))?
                        else {
                            return Err(INVALID);
                        };
                        let source = txs.iter().find(|a| a.id == transfer.source_transaction_id);
                        let target = txs.iter().find(|a| a.id == transfer.target_transaction_id);
                        let valid = if let (Some(source), Some(target)) = (source, target) {
                            source.kind == TransactionKind::Transfer
                                && target.kind == TransactionKind::Transfer
                                && source.transfer_id.as_ref() == Some(&transfer.id)
                                && target.transfer_id.as_ref() == Some(&transfer.id)
                                && source.account_id == transfer.source_account_id
                                && target.account_id == transfer.target_account_id
                                && source.date == transfer.date
                                && target.date == transfer.date
                                && source.amount.cents() == -transfer.amount.cents()
                                && target.amount == transfer.amount
                        } else {
                            false
                        };
                        if !valid {
                            return Err((
                                "INVALID_AGGREGATE",
                                "Die vollständigen Umbuchungsseiten passen nicht zum Abgleich.",
                            ));
                        }
                        for id in [
                            &transfer.source_transaction_id,
                            &transfer.target_transaction_id,
                        ] {
                            if ids.insert(id.clone()) {
                                expanded = true;
                            }
                        }
                    }
                }
                for rec in &recs {
                    if !groups.contains(&rec.id)
                        && rec
                            .transaction_ids
                            .as_slice()
                            .iter()
                            .any(|id| ids.contains(id))
                    {
                        groups.insert(rec.id.clone());
                        ids.extend(rec.transaction_ids.as_slice().iter().cloned());
                        expanded = true;
                    }
                }
            }
            if groups.is_empty() {
                return Err((
                    "INVALID_COMMAND",
                    "Der zugehörige vollständige Abgleich fehlt.",
                ));
            }
            let mut changed_index = BTreeMap::<EntityId, usize>::new();
            for rec in recs.iter().filter(|a| groups.contains(&a.id)) {
                let rec_ids = rec.transaction_ids.as_slice();
                if rec_ids.iter().collect::<BTreeSet<_>>().len() != rec_ids.len() {
                    return Err((
                        "DUPLICATE_REFERENCE",
                        "Eine Abgleichbuchung darf nur einmal vorkommen.",
                    ));
                }
                let account = read(&current, &rec.account_id, AggregateKind::Account)?;
                let mut tomb = (*rec).clone();
                tomb.deleted_at = Some(tomb.updated_at.clone());
                changes.push(command_contracts::revise(
                    Aggregate::Reconciliation(tomb),
                    time,
                )?);
                add_expected(&mut expected, &Aggregate::Reconciliation((*rec).clone()))?;
                for id in rec_ids {
                    let tx = tx(&current, id)?;
                    typed_financial::normalize(tx.clone())?;
                    if &tx.space_id != space
                        || tx.account_id != rec.account_id
                        || tx.deleted_at.is_some()
                    {
                        return Err((
                            "INVALID_AGGREGATE",
                            "Eine Abgleichbuchung passt nicht zum Kontoauszug.",
                        ));
                    }
                    if tx.clearance != Clearance::Reconciled {
                        return Err((
                            "INVALID_COMMAND",
                            "Nur abgeglichene Buchungen können gemeinsam entsperrt werden.",
                        ));
                    }
                    let mut a = tx.clone();
                    a.clearance = Clearance::Cleared;
                    let a = command_contracts::revise(Aggregate::Transaction(a), time)?;
                    if let Some(n) = changed_index.get(id) {
                        changes[*n] = a;
                    } else {
                        changed_index.insert(id.clone(), changes.len());
                        changes.push(a);
                    }
                    add_expected(&mut expected, &Aggregate::Transaction(tx.clone()))?;
                }
                add_expected(&mut expected, account)?;
            }
            for tx in txs
                .iter()
                .filter(|a| override_record.is_none() && ids.contains(&a.id))
            {
                if !changed_index.contains_key(&tx.id) {
                    if tx.clearance == Clearance::Reconciled {
                        return Err((
                            "INVALID_COMMAND",
                            "Der zugehörige vollständige Abgleich fehlt.",
                        ));
                    }
                    changes.push(command_contracts::revise(
                        Aggregate::Transaction((*tx).clone()),
                        time,
                    )?);
                }
                add_expected(&mut expected, &Aggregate::Transaction((*tx).clone()))?;
                if let Some(id) = &tx.transfer_id {
                    add_expected(&mut expected, read(&current, id, AggregateKind::Transfer)?)?;
                }
            }
            "reconciliation.unlock"
        }
        _ => return Err(COMMAND_ERROR),
    };
    command_contracts::inspect_changes(&changes, &expected, &request.scope())?;
    Ok(request.changed(command_type, changes, expected))
}
