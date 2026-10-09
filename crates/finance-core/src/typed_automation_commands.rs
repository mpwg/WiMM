// SPDX-License-Identifier: AGPL-3.0-or-later
//! Typisierte Automatisierungsbefehle mit expliziten IDs und atomaren Fachankern.
use crate::{
    CoreResult,
    aggregate_schema::INVALID,
    command_contracts::{self, COMMAND_ERROR, CommandResult, Expectation, Request},
    models::*,
    scalars::*,
    state_validation, typed_automation as automation, typed_financial as financial,
};
use std::collections::BTreeSet;
struct Ids<'a> {
    values: &'a [EntityId],
    position: usize,
}
impl Ids<'_> {
    fn next(&mut self) -> CoreResult<EntityId> {
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
}
fn new_tx(
    id: EntityId,
    space: &EntityId,
    time: &UtcTimestamp,
    date: FinanceDate,
    t: &TransactionTemplate,
) -> CoreResult<Transaction> {
    Ok(Transaction {
        id,
        space_id: space.clone(),
        revision: StoredRevision::new(1)?,
        created_at: time.clone(),
        updated_at: time.clone(),
        deleted_at: None,
        account_id: t.account_id.clone(),
        date,
        amount: t.amount,
        kind: t.kind,
        clearance: t.clearance,
        splits: t.splits.clone(),
        payee_id: t.payee_id.clone(),
        note: t.note.clone(),
        transfer_id: t.transfer_id.clone(),
        import_reference: None,
        schedule_occurrence_id: None,
    })
}
fn checked_tx(
    tx: Transaction,
    all: &[Aggregate],
    request: &Request,
) -> CoreResult<(Transaction, Vec<Expectation>)> {
    let mut ids = vec![tx.id.clone(), tx.account_id.clone()];
    automation::active(
        all,
        &request.space_id,
        &tx.account_id,
        AggregateKind::Account,
    )?;
    for split in &tx.splits {
        automation::active(
            all,
            &request.space_id,
            &split.category_id,
            AggregateKind::Category,
        )?;
        ids.push(split.category_id.clone());
    }
    if let Some(id) = &tx.payee_id {
        automation::active(all, &request.space_id, id, AggregateKind::Payee)?;
        ids.push(id.clone());
    }
    let current = all
        .iter()
        .map(|a| (a.id(), a))
        .collect::<std::collections::BTreeMap<_, _>>();
    let mut seen = BTreeSet::new();
    let expected = ids
        .into_iter()
        .filter(|id| seen.insert(id.clone()))
        .map(|id| {
            Ok(Expectation {
                expected_revision: Revision::new(
                    current.get(&id).map(|a| a.revision().value()).unwrap_or(0),
                )?,
                id,
            })
        })
        .collect::<CoreResult<Vec<_>>>()?;
    let tx = financial::normalize(tx)?;
    if current.get(&tx.id).is_some_and(
        |a| matches!(a,Aggregate::Transaction(t) if t.clearance==Clearance::Reconciled),
    ) || tx.clearance == Clearance::Reconciled
    {
        return Err((
            "INVALID_COMMAND",
            "Abgeglichene Buchungen müssen vor einer Änderung atomar entsperrt werden.",
        ));
    }
    if tx.deleted_at.is_some() {
        return Err((
            "INVALID_COMMAND",
            "Eine gespeicherte Buchung darf kein Tombstone sein.",
        ));
    }
    if tx.kind == TransactionKind::Transfer {
        return Err((
            "INVALID_COMMAND",
            "Umbuchungsseiten dürfen nur zusammen mit ihrer Gegenbuchung geändert werden.",
        ));
    }
    let scope = command_contracts::Scope {
        space_id: &request.space_id,
        aggregates: all,
        context: &request.context,
    };
    let a = Aggregate::Transaction(tx);
    command_contracts::inspect_changes(std::slice::from_ref(&a), &expected, &scope)?;
    let (changes, expectations) = financial::prepare(vec![a], expected, &scope)?;
    command_contracts::inspect_changes(&changes, &expectations, &scope)?;
    let Some(Aggregate::Transaction(tx)) = changes.into_iter().next() else {
        return Err(INVALID);
    };
    Ok((tx, expectations))
}
fn finish(
    changes: Vec<Aggregate>,
    read: Vec<EntityId>,
    request: &Request,
    command: &str,
) -> CoreResult<CommandResult> {
    if changes.is_empty() {
        return Err(("INVALID_COMMAND", "Die Änderung ist leer."));
    }
    let scope = request.scope();
    let current = request.current();
    command_contracts::expected(&scope, &request.expected_revisions, &current)?;
    let mut ids = changes.iter().map(|a| a.id().clone()).collect::<Vec<_>>();
    ids.extend(read);
    let mut seen = BTreeSet::new();
    let mut expected = ids
        .into_iter()
        .filter(|id| seen.insert(id.clone()))
        .map(|id| {
            Ok(Expectation {
                expected_revision: Revision::new(
                    current.get(&id).map(|a| a.revision().value()).unwrap_or(0),
                )?,
                id,
            })
        })
        .collect::<CoreResult<Vec<_>>>()?;
    for e in &request.expected_revisions {
        if !expected.iter().any(|old| old.id == e.id) {
            expected.push(e.clone());
        }
    }
    command_contracts::inspect_changes(&changes, &expected, &scope)?;
    let (changes, expected) = financial::prepare(changes, expected, &scope)?;
    command_contracts::inspect_changes(&changes, &expected, &scope)?;
    Ok(CommandResult::Changed(
        request.changed(command, changes, expected),
    ))
}
pub(crate) fn execute(request: Request) -> CoreResult<CommandResult> {
    request.check_versions()?;
    let all = &request.aggregates;
    let space = &request.space_id;
    let time = &request.context.occurred_at;
    let mut ids = Ids {
        values: &request.context.generated_ids,
        position: 0,
    };
    let save = match &request.command {
        Command::RuleSave(c) => Some((c, "rule.save", AggregateKind::Rule)),
        Command::ScheduleSave(c) => Some((c, "schedule.save", AggregateKind::Schedule)),
        Command::ImportBatchSave(c) => Some((c, "importBatch.save", AggregateKind::ImportBatch)),
        Command::ImportMappingSave(c) => {
            Some((c, "importMapping.save", AggregateKind::ImportMapping))
        }
        _ => None,
    };
    if let Some((c, command, kind)) = save {
        let entries = c.aggregates.as_slice();
        if entries.len() != 1 || entries[0].kind() != kind {
            return Err(COMMAND_ERROR);
        }
        let a = entries[0].clone();
        if matches!(kind, AggregateKind::ImportBatch | AggregateKind::Schedule)
            && a.space_id() != space
        {
            return Err((
                "INVALID_COMMAND",
                "Die Referenz ist nicht im aktiven Bereich verfügbar.",
            ));
        }
        let mut read = vec![];
        match &a {
            Aggregate::Rule(rule) => {
                automation::validate_rule(rule, all)?;
                for action in rule.actions.as_slice() {
                    match action {
                        RuleAction::CategoryId(id) | RuleAction::PayeeId(id) => {
                            read.push(id.clone())
                        }
                        RuleAction::Clearance(_) => {}
                    }
                }
            }
            Aggregate::ImportBatch(batch) => {
                automation::active(all, space, &batch.account_id, AggregateKind::Account)?;
                state_validation::typed_import_batch(batch)?;
                let old = all.iter().find(|old| old.id() == a.id());
                if old.is_none()
                    && (!batch.committed_rows.is_empty() || batch.state != ImportState::Ready)
                {
                    return Err((
                        "INVALID_COMMAND",
                        "Ein neuer Import muss ohne übernommene Zeilen beginnen.",
                    ));
                }
                if let Some(old) = old {
                    let Aggregate::ImportBatch(old) = old else {
                        return Err(INVALID);
                    };
                    let old_rows = old.rows.as_slice();
                    let new_rows = batch.rows.as_slice();
                    if old_rows.len() != new_rows.len()
                        || old_rows
                            .iter()
                            .any(|row| !new_rows.iter().any(|r| r.source_row == row.source_row))
                        || old.state != batch.state
                    {
                        return Err((
                            "INVALID_COMMAND",
                            "Quellzeilen und Fortschrittsstatus dürfen nicht still geändert werden.",
                        ));
                    }
                    if old.file_hash != batch.file_hash
                        || old.account_id != batch.account_id
                        || old.committed_rows != batch.committed_rows
                        || old.committed_rows.iter().any(|n| {
                            old_rows.iter().find(|r| &r.source_row == n)
                                != new_rows.iter().find(|r| &r.source_row == n)
                        })
                    {
                        return Err((
                            "INVALID_COMMAND",
                            "Bereits übernommene Importzeilen sind unveränderlich.",
                        ));
                    }
                }
                read.push(batch.account_id.clone());
            }
            Aggregate::Schedule(schedule) => {
                let mut active = schedule.clone();
                active.enabled = true;
                crate::schedule_dates::typed_due_dates(&active, schedule.start_date.as_str())?;
                let tx = new_tx(
                    ids.next()?,
                    space,
                    time,
                    schedule.start_date.clone(),
                    &schedule.template,
                )?;
                if tx.kind != TransactionKind::Normal || tx.clearance == Clearance::Reconciled {
                    return Err((
                        "INVALID_COMMAND",
                        "Die Vorlage muss eine normale offene Buchung sein.",
                    ));
                }
                let (tx, expectations) = checked_tx(tx, all, &request)?;
                read.extend(
                    expectations
                        .into_iter()
                        .filter(|e| e.id != tx.id)
                        .map(|e| e.id),
                );
            }
            Aggregate::ImportMapping(_) => {}
            _ => return Err(COMMAND_ERROR),
        }
        return finish(vec![a], read, &request, command);
    }
    if let Command::RuleDelete(c) = &request.command {
        let a = all
            .iter()
            .find(|a| a.id() == &c.aggregate_id && a.kind() == AggregateKind::Rule)
            .ok_or(INVALID)?;
        let mut tomb = a.clone();
        *tomb.deleted_at_mut() = Some(time.clone());
        return finish(
            vec![command_contracts::revise(tomb, time)?],
            vec![],
            &request,
            "rule.delete",
        );
    }
    let occurrence = match &request.command {
        Command::ScheduleConfirm(c) => Some((
            &c.schedule_id,
            &c.due_date,
            OccurrenceState::Confirmed,
            c.imported_transaction_id.as_ref(),
            "schedule.confirm",
        )),
        Command::ScheduleSkip(c) => Some((
            &c.schedule_id,
            &c.due_date,
            OccurrenceState::Skipped,
            None,
            "schedule.skip",
        )),
        _ => None,
    };
    if let Some((schedule_id, date, wanted, imported_id, command)) = occurrence {
        let Aggregate::Schedule(schedule) =
            automation::active(all, space, schedule_id, AggregateKind::Schedule)?
        else {
            return Err(INVALID);
        };
        if !crate::schedule_dates::typed_due_dates(schedule, date.as_str())?
            .iter()
            .any(|d| d == date.as_str())
        {
            return Err(("INVALID_COMMAND", "Das Datum ist keine aktive Fälligkeit."));
        }
        if let Some(existing) = all.iter().find_map(|a| {
            if let Aggregate::ScheduleOccurrence(o) = a
                && a.is_live()
                && o.schedule_id == schedule.id
                && &o.due_date == date
                && a.space_id() == space
            {
                Some(o)
            } else {
                None
            }
        }) {
            if existing.state != wanted
                || imported_id.is_some_and(|id| existing.transaction_id.as_ref() != Some(id))
            {
                return Err((
                    "INVALID_COMMAND",
                    "Die Fälligkeit ist bereits anders erledigt.",
                ));
            }
            return Ok(CommandResult::Unchanged);
        }
        let mut occurrence = ScheduleOccurrence {
            id: ids.next()?,
            space_id: space.clone(),
            revision: StoredRevision::new(1)?,
            created_at: time.clone(),
            updated_at: time.clone(),
            deleted_at: None,
            schedule_id: schedule.id.clone(),
            due_date: date.clone(),
            state: wanted,
            transaction_id: None,
        };
        let mut changes = vec![command_contracts::revise(
            Aggregate::Schedule(schedule.clone()),
            time,
        )?];
        let mut read = vec![schedule.id.clone()];
        if wanted == OccurrenceState::Confirmed {
            let imported = imported_id
                .map(|id| {
                    all.iter()
                        .find_map(|a| {
                            if let Aggregate::Transaction(tx) = a
                                && &tx.id == id
                            {
                                Some(tx)
                            } else {
                                None
                            }
                        })
                        .ok_or(INVALID)
                })
                .transpose()?;
            if imported.is_some_and(|a| {
                a.space_id != schedule.space_id || a.account_id != schedule.template.account_id
            }) {
                return Err((
                    "INVALID_COMMAND",
                    "Die importierte Zahlung liegt in einem anderen Bereich.",
                ));
            }
            if imported.is_some_and(|a| a.schedule_occurrence_id.is_some()) {
                return Err((
                    "INVALID_COMMAND",
                    "Die Zahlung ist bereits einer Fälligkeit zugeordnet.",
                ));
            }
            let tx = if let Some(imported) = imported {
                let mut tx = imported.clone();
                tx.schedule_occurrence_id = Some(occurrence.id.clone());
                let Aggregate::Transaction(tx) =
                    command_contracts::revise(Aggregate::Transaction(tx), time)?
                else {
                    return Err(INVALID);
                };
                tx
            } else {
                let mut tx = new_tx(ids.next()?, space, time, date.clone(), &schedule.template)?;
                tx.schedule_occurrence_id = Some(occurrence.id.clone());
                for split in &mut tx.splits {
                    split.id = ids.next()?;
                }
                tx
            };
            if imported.is_none() {
                let mut sum = MoneyCents::new(0)?;
                for a in all {
                    if let Aggregate::Transaction(a) = a
                        && a.deleted_at.is_none()
                        && a.space_id == schedule.space_id
                        && a.account_id == tx.account_id
                    {
                        sum = sum.checked_add(a.amount)?;
                    }
                }
                sum.checked_add(tx.amount)?;
                changes.push(command_contracts::revise(
                    automation::active(all, space, &tx.account_id, AggregateKind::Account)?.clone(),
                    time,
                )?);
            }
            let (tx, expectations) = checked_tx(tx, all, &request)?;
            read.extend(
                expectations
                    .into_iter()
                    .filter(|e| e.id != tx.id)
                    .map(|e| e.id),
            );
            occurrence.transaction_id = Some(tx.id.clone());
            changes.push(Aggregate::Transaction(tx));
        }
        changes.push(Aggregate::ScheduleOccurrence(occurrence));
        return finish(changes, read, &request, command);
    }
    let Command::ImportCommit(command) = &request.command else {
        return Err(COMMAND_ERROR);
    };
    let Aggregate::ImportBatch(batch) =
        automation::active(all, space, &command.import_id, AggregateKind::ImportBatch)?
    else {
        return Err(INVALID);
    };
    automation::active(all, space, &batch.account_id, AggregateKind::Account)?;
    state_validation::typed_import_batch(batch)?;
    let pending = batch
        .rows
        .as_slice()
        .iter()
        .filter(|r| !batch.committed_rows.contains(&r.source_row))
        .take(100)
        .collect::<Vec<_>>();
    if pending.is_empty() {
        return Ok(CommandResult::Unchanged);
    }
    let fingerprints = all
        .iter()
        .filter(|a| a.kind() == AggregateKind::ImportFingerprint && a.is_live())
        .cloned()
        .collect::<Vec<_>>();
    let mut changes = Vec::<Aggregate>::new();
    let mut read = vec![batch.account_id.clone()];
    let mut read_set = BTreeSet::from([batch.account_id.clone()]);
    for row in &pending {
        if row.decision == ImportDecision::Exclude {
            continue;
        }
        let candidate = row.candidate.as_ref().ok_or(COMMAND_ERROR)?;
        let mut fp = fingerprints.clone();
        fp.extend(
            changes
                .iter()
                .filter(|a| a.kind() == AggregateKind::ImportFingerprint)
                .cloned(),
        );
        let status = automation::duplicate(candidate, &batch.account_id, &fp);
        if status == automation::Classification::Conflict {
            return Err((
                "INVALID_COMMAND",
                "Gleiche Quell-ID mit anderem Inhalt: zuerst den Prüfkonflikt klären oder ausschließen.",
            ));
        }
        if status == automation::Classification::Duplicate
            && row.decision != ImportDecision::Separate
        {
            return Err((
                "INVALID_COMMAND",
                "Eine mögliche Dublette benötigt eine ausdrückliche Entscheidung.",
            ));
        }
        let category = candidate
            .category_id
            .as_ref()
            .ok_or(("INVALID_COMMAND", "Die Importkategorie fehlt."))?;
        let mut payee = candidate.payee_id.clone();
        if payee.is_none()
            && candidate
                .payee
                .as_ref()
                .is_some_and(|s| !s.trim_matches(crate::aggregate_schema::js_space).is_empty())
        {
            let name =
                state_validation::normal_text(candidate.payee.as_deref().ok_or(COMMAND_ERROR)?)
                    .to_lowercase();
            let matches = all
                .iter()
                .chain(&changes)
                .filter_map(|a| {
                    if let Aggregate::Payee(p) = a
                        && p.space_id == *space
                        && a.is_live()
                        && !p.archived
                    {
                        Some(p)
                    } else {
                        None
                    }
                })
                .filter(|p| {
                    std::iter::once(&p.name)
                        .chain(&p.aliases)
                        .any(|n| state_validation::normal_text(n.as_str()).to_lowercase() == name)
                })
                .collect::<Vec<_>>();
            if matches.len() > 1 {
                return Err((
                    "INVALID_COMMAND",
                    "Der Empfängername ist mehrdeutig. Bitte über eine Regel ausdrücklich zuordnen.",
                ));
            }
            if let Some(a) = matches.first() {
                payee = Some(a.id.clone());
            } else {
                let a = Aggregate::Payee(Payee {
                    id: ids.next()?,
                    space_id: space.clone(),
                    revision: StoredRevision::new(1)?,
                    created_at: time.clone(),
                    updated_at: time.clone(),
                    deleted_at: None,
                    name: NonEmptyText::new(candidate.payee.clone().ok_or(COMMAND_ERROR)?)?,
                    aliases: vec![],
                    archived: false,
                });
                let a = crate::master_commands::normalize_typed(a, "payee")?;
                payee = Some(a.id().clone());
                changes.push(a);
            }
        }
        let mut tx = Transaction {
            id: ids.next()?,
            space_id: space.clone(),
            revision: StoredRevision::new(1)?,
            created_at: time.clone(),
            updated_at: time.clone(),
            deleted_at: None,
            kind: TransactionKind::Normal,
            account_id: batch.account_id.clone(),
            date: candidate.date.clone(),
            amount: candidate.amount,
            clearance: match candidate.clearance {
                Some(ImportClearance::Cleared) => Clearance::Cleared,
                _ => Clearance::Uncleared,
            },
            import_reference: Some(NonEmptyText::new(format!(
                "{}:{}",
                batch.id.as_str(),
                row.source_row.value()
            ))?),
            note: candidate.memo.clone().filter(|s| !s.is_empty()),
            payee_id: payee,
            transfer_id: None,
            schedule_occurrence_id: None,
            splits: vec![],
        };
        tx.splits.push(Split {
            id: ids.next()?,
            category_id: category.clone(),
            amount: candidate.amount,
        });
        let mut before = all.to_vec();
        before.extend(changes.clone());
        let (tx, expectations) = checked_tx(tx, &before, &request)?;
        for e in expectations {
            if e.id != tx.id && read_set.insert(e.id.clone()) {
                read.push(e.id);
            }
        }
        let fp = ImportFingerprint {
            id: ids.next()?,
            space_id: space.clone(),
            revision: StoredRevision::new(1)?,
            created_at: time.clone(),
            updated_at: time.clone(),
            deleted_at: None,
            account_id: batch.account_id.clone(),
            parser_source: NonEmptyText::new(automation::source(candidate).to_owned())?,
            external_id: candidate.external_id.clone(),
            fingerprint: NonEmptyText::new(automation::fingerprint(candidate))?,
            transaction_id: tx.id.clone(),
            import_id: batch.id.clone(),
            source_row: row.source_row,
        };
        changes.push(Aggregate::Transaction(tx));
        changes.push(Aggregate::ImportFingerprint(fp));
    }
    let mut sum = MoneyCents::new(0)?;
    for a in all
        .iter()
        .filter(|a| a.is_live() && a.space_id() == space)
        .chain(&changes)
    {
        if let Aggregate::Transaction(tx) = a
            && tx.account_id == batch.account_id
        {
            sum = sum.checked_add(tx.amount)?;
        }
    }
    let mut next = batch.clone();
    next.committed_rows
        .extend(pending.iter().map(|r| r.source_row));
    next.state = if next.committed_rows.len() == batch.rows.as_slice().len() {
        ImportState::Completed
    } else {
        ImportState::Partial
    };
    changes.push(command_contracts::revise(
        automation::active(all, space, &batch.account_id, AggregateKind::Account)?.clone(),
        time,
    )?);
    changes.push(command_contracts::revise(
        Aggregate::ImportBatch(next),
        time,
    )?);
    for fp in fingerprints {
        if read_set.insert(fp.id().clone()) {
            read.push(fp.id().clone());
        }
    }
    finish(changes, read, &request, "import.commit")
}
