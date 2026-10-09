// SPDX-License-Identifier: AGPL-3.0-or-later
//! Gemeinsame typisierte Finanzvorbereitung und atomare CAS-Anker.
use crate::{
    CoreResult,
    aggregate_schema::INVALID,
    command_contracts::{self, Expectation, Scope},
    models::{Aggregate, AggregateKind, FinancialRevision, Transaction},
    projections,
    scalars::{MoneyCents, Revision, StoredRevision},
    state_validation,
};
use std::collections::{BTreeMap, BTreeSet};
pub(crate) fn normalize(mut tx: Transaction) -> CoreResult<Transaction> {
    state_validation::typed_transaction(&tx)?;
    use unicode_normalization::UnicodeNormalization;
    if let Some(note) = &mut tx.note {
        let normalized = note
            .nfc()
            .collect::<String>()
            .trim_matches(crate::aggregate_schema::js_space)
            .to_owned();
        if !normalized.is_empty() {
            *note = normalized;
        }
    }
    if let Some(reference) = &mut tx.import_reference {
        let normalized = reference
            .as_str()
            .nfc()
            .collect::<String>()
            .trim_matches(crate::aggregate_schema::js_space)
            .to_owned();
        *reference = crate::scalars::NonEmptyText::new(normalized)?;
    }
    Ok(tx)
}
pub(crate) fn prepare(
    mut changes: Vec<Aggregate>,
    mut expected: Vec<Expectation>,
    request: &Scope<'_>,
) -> CoreResult<(Vec<Aggregate>, Vec<Expectation>)> {
    if !changes
        .iter()
        .any(|a| a.kind() == AggregateKind::Transaction)
    {
        return Ok((changes, expected));
    }
    let current = request.aggregates;
    let space = request.space_id;
    let time = &request.context.occurred_at;
    if current.iter().any(|a| a.space_id() != space)
        || current
            .iter()
            .map(Aggregate::id)
            .collect::<BTreeSet<_>>()
            .len()
            != current.len()
    {
        return Err((
            "INVALID_AGGREGATE",
            "Der Finanzbestand ist nicht eindeutig im aktuellen Bereich.",
        ));
    }
    crate::references::typed_validate(&changes, current)?;
    let mut next = current.to_vec();
    let mut positions = next
        .iter()
        .enumerate()
        .map(|(n, a)| (a.id().clone(), n))
        .collect::<BTreeMap<_, _>>();
    for a in &changes {
        if let Some(n) = positions.get(a.id()) {
            next[*n] = a.clone();
        } else {
            positions.insert(a.id().clone(), next.len());
            next.push(a.clone());
        }
    }
    let mut txs = next
        .iter()
        .filter_map(|a| {
            if let Aggregate::Transaction(tx) = a
                && a.is_live()
            {
                Some(normalize(tx.clone()).map(Aggregate::Transaction))
            } else {
                None
            }
        })
        .collect::<CoreResult<Vec<_>>>()?;
    txs.sort_by(|a, b| projections::uuid_order(a.id().as_str(), b.id().as_str()));
    let mut total = MoneyCents::new(0)?;
    for balance in projections::typed_balances(&txs)? {
        total = total.checked_add(balance.balance).map_err(|(code, _)| {
            (
                code,
                "Der Gesamtkontostand überschreitet den sicheren Centbereich.",
            )
        })?;
    }
    let categories = next
        .iter()
        .filter(|a| matches!(a, Aggregate::Category(_) | Aggregate::CategoryGroup(_)))
        .cloned()
        .collect::<Vec<_>>();
    let mut projected = categories.clone();
    projected.extend(txs.clone());
    projections::typed_consumption(&projected)?;
    let mut months = Vec::<(String, Vec<Aggregate>)>::new();
    let mut month_index = BTreeMap::new();
    for a in &txs {
        let Aggregate::Transaction(tx) = a else {
            return Err(INVALID);
        };
        let key = &tx.date.as_str()[..7];
        let n = *month_index.entry(key.to_owned()).or_insert_with(|| {
            months.push((key.to_owned(), vec![]));
            months.len() - 1
        });
        months[n].1.push(a.clone());
    }
    for (_, month) in months {
        let mut sum = MoneyCents::new(0)?;
        for a in &month {
            if let Aggregate::Transaction(tx) = a {
                sum = sum.checked_add(tx.amount).map_err(|(code, _)| {
                    (
                        code,
                        "Die Monatssumme überschreitet den sicheren Centbereich.",
                    )
                })?;
            }
        }
        let mut all = categories.clone();
        all.extend(month);
        projections::typed_consumption(&all)?;
    }
    let mut affected = BTreeSet::new();
    for a in &changes {
        if let Aggregate::Transaction(tx) = a {
            affected.insert(tx.account_id.clone());
            if let Some(old) = current.iter().find(|a| a.id() == &tx.id) {
                let Aggregate::Transaction(old) = old else {
                    return Err(INVALID);
                };
                affected.insert(old.account_id.clone());
            }
        }
    }
    let previous = current.iter().find(|a| a.id() == space);
    if previous.is_some_and(|a| a.kind() != AggregateKind::FinancialRevision)
        || changes
            .iter()
            .any(|a| a.id() == space && a.kind() != AggregateKind::FinancialRevision)
    {
        return Err((
            "INVALID_AGGREGATE",
            "Die reservierte lokale Finanzrevision ist nicht verfügbar.",
        ));
    }
    let guard = if let Some(a) = previous {
        command_contracts::revise(a.clone(), time)?
    } else {
        Aggregate::FinancialRevision(FinancialRevision {
            id: space.clone(),
            space_id: space.clone(),
            revision: StoredRevision::new(1)?,
            created_at: time.clone(),
            updated_at: time.clone(),
            deleted_at: None,
        })
    };
    if !changes.iter().any(|a| a.id() == space) {
        changes.push(guard);
    }
    let guard_revision = Revision::new(previous.map(|a| a.revision().value()).unwrap_or(0))?;
    if let Some(e) = expected.iter_mut().find(|e| &e.id == space) {
        e.expected_revision = guard_revision;
    } else {
        expected.push(Expectation {
            id: space.clone(),
            expected_revision: guard_revision,
        });
    }
    for a in current
        .iter()
        .filter(|a| matches!(a, Aggregate::Category(_) | Aggregate::CategoryGroup(_)))
    {
        if !expected.iter().any(|e| &e.id == a.id()) {
            expected.push(Expectation {
                id: a.id().clone(),
                expected_revision: Revision::new(a.revision().value())?,
            });
        }
    }
    for a in current
        .iter()
        .filter(|a| a.kind() == AggregateKind::Account && a.is_live())
    {
        if !expected.iter().any(|e| &e.id == a.id()) {
            expected.push(Expectation {
                id: a.id().clone(),
                expected_revision: Revision::new(a.revision().value())?,
            });
        }
        if affected.contains(a.id()) && !changes.iter().any(|v| v.id() == a.id()) {
            changes.push(command_contracts::revise(a.clone(), time)?);
        }
    }
    Ok((changes, expected))
}
fn require(
    tx: &Transaction,
    expected: &[Expectation],
    current: &BTreeMap<&crate::scalars::EntityId, &Aggregate>,
) -> CoreResult<()> {
    let mut refs = vec![(
        &tx.account_id,
        AggregateKind::Account,
        "Das Buchungskonto benötigt eine erwartete Revision.",
        "Das Buchungskonto ist nicht als passendes Aggregat vorhanden.",
    )];
    for split in &tx.splits {
        refs.push((
            &split.category_id,
            AggregateKind::Category,
            "Die Splitkategorie benötigt eine erwartete Revision.",
            "Die Splitkategorie ist nicht als passendes Aggregat vorhanden.",
        ));
    }
    if let Some(id) = &tx.payee_id {
        refs.push((
            id,
            AggregateKind::Payee,
            "Der Buchungsempfänger benötigt eine erwartete Revision.",
            "Der Buchungsempfänger ist nicht als passendes Aggregat vorhanden.",
        ));
    }
    for (id, kind, missing, absent) in refs {
        if !expected.iter().any(|e| &e.id == id) {
            return Err(("REVISION_MISSING", missing));
        }
        if current.get(id).is_none_or(|a| a.kind() != kind) {
            return Err(("INVALID_AGGREGATE", absent));
        }
    }
    Ok(())
}
pub(crate) fn execute(
    request: crate::command_contracts::Request,
) -> CoreResult<crate::command_contracts::ChangeSet> {
    use crate::command_contracts::{COMMAND_ERROR, inspect_changes};
    use crate::models::{Clearance, Command, TransactionKind};
    request.check_versions()?;
    let current = request.current();
    let scope = request.scope();
    if let Command::AccountSave(c) = &request.command {
        let entries = c.aggregates.as_slice();
        if entries.len() != 2 {
            return Err((
                "INVALID_COMMAND",
                "Der Kontoeinstieg benötigt Konto und Anfangsbestand gemeinsam.",
            ));
        }
        let account = crate::master_commands::normalize_typed(entries[0].clone(), "account")?;
        let Aggregate::Transaction(tx) = &entries[1] else {
            return Err((
                "INVALID_AGGREGATE",
                "Die Buchung hat einen unpassenden Aggregattyp.",
            ));
        };
        let tx = normalize(tx.clone())?;
        if account.revision().value() != 1 || current.contains_key(account.id()) {
            return Err((
                "INVALID_COMMAND",
                "Der Kontoeinstieg ist nur für ein neues Konto zulässig.",
            ));
        }
        if tx.kind != TransactionKind::Opening
            || &tx.account_id != account.id()
            || tx.deleted_at.is_some()
            || tx.clearance == Clearance::Reconciled
        {
            return Err((
                "INVALID_COMMAND",
                "Der Anfangsbestand muss zum neuen Konto gehören.",
            ));
        }
        let mut pending = current.clone();
        pending.insert(account.id(), &account);
        require(&tx, &request.expected_revisions, &pending)?;
        let initial = vec![account, Aggregate::Transaction(tx)];
        inspect_changes(&initial, &request.expected_revisions, &scope)?;
        let (changes, expected) = prepare(initial, request.expected_revisions.clone(), &scope)?;
        inspect_changes(&changes, &expected, &scope)?;
        return Ok(request.changed("account.save", changes, expected));
    }
    let (deleting, command_type, tx) = match &request.command {
        Command::TransactionDelete(c) => {
            let a = current.get(&c.aggregate_id).ok_or(INVALID)?;
            let Aggregate::Transaction(tx) = a else {
                return Err((
                    "INVALID_AGGREGATE",
                    "Die Buchung hat einen unpassenden Aggregattyp.",
                ));
            };
            (true, "transaction.delete", normalize(tx.clone())?)
        }
        Command::TransactionSave(c) => {
            let entries = c.aggregates.as_slice();
            if entries.len() != 1 {
                return Err((
                    "INVALID_COMMAND",
                    "Der Buchungsbefehl benötigt genau eine vollständige Buchung.",
                ));
            }
            let Aggregate::Transaction(tx) = &entries[0] else {
                return Err((
                    "INVALID_AGGREGATE",
                    "Die Buchung hat einen unpassenden Aggregattyp.",
                ));
            };
            (false, "transaction.save", normalize(tx.clone())?)
        }
        _ => return Err(COMMAND_ERROR),
    };
    let message = if deleting {
        "Abgeglichene Buchungen müssen vor dem Löschen atomar entsperrt werden."
    } else {
        "Abgeglichene Buchungen müssen vor einer Änderung atomar entsperrt werden."
    };
    if current.get(&tx.id).is_some_and(
        |a| matches!(a,Aggregate::Transaction(tx) if tx.clearance==Clearance::Reconciled),
    ) {
        return Err(("INVALID_COMMAND", message));
    }
    if !deleting && tx.deleted_at.is_some() {
        return Err((
            "INVALID_COMMAND",
            "Eine gespeicherte Buchung darf kein Tombstone sein.",
        ));
    }
    if tx.clearance == Clearance::Reconciled {
        return Err(("INVALID_COMMAND", message));
    }
    if tx.kind == TransactionKind::Transfer {
        return Err((
            "INVALID_COMMAND",
            if deleting {
                "Umbuchungsseiten dürfen nur zusammen mit ihrer Gegenbuchung gelöscht werden."
            } else {
                "Umbuchungsseiten dürfen nur zusammen mit ihrer Gegenbuchung geändert werden."
            },
        ));
    }
    let tx = if deleting {
        let mut a = Aggregate::Transaction(tx);
        *a.deleted_at_mut() = Some(a.updated_at().clone());
        command_contracts::revise(a, &request.context.occurred_at)?
    } else {
        Aggregate::Transaction(tx)
    };
    let Aggregate::Transaction(value) = &tx else {
        return Err(INVALID);
    };
    require(value, &request.expected_revisions, &current)?;
    inspect_changes(
        std::slice::from_ref(&tx),
        &request.expected_revisions,
        &scope,
    )?;
    let (changes, expected) = prepare(vec![tx], request.expected_revisions.clone(), &scope)?;
    inspect_changes(&changes, &expected, &scope)?;
    Ok(request.changed(command_type, changes, expected))
}
