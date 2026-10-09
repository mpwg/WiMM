// SPDX-License-Identifier: AGPL-3.0-or-later
//! Vollständige gespeicherte Fachbestände; historische Ziele dürfen Tombstones sein.
use crate::{
    CoreResult,
    aggregate_schema::{self, INVALID, array, string},
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
pub(crate) fn typed_transaction(tx: &crate::models::Transaction) -> CoreResult<()> {
    transaction_fields(tx.kind, tx.amount, &tx.splits, tx.transfer_id.as_ref())
}
fn transaction_fields(
    kind: crate::models::TransactionKind,
    amount: crate::scalars::MoneyCents,
    splits: &[crate::models::Split],
    transfer_id: Option<&crate::scalars::EntityId>,
) -> CoreResult<()> {
    use crate::models::TransactionKind;
    let mut ids = BTreeSet::new();
    for split in splits {
        if !ids.insert(&split.id) {
            return failure(
                "DUPLICATE_REFERENCE",
                "Eine Split-ID darf nur einmal vorkommen.",
            );
        }
    }
    if kind == TransactionKind::Normal {
        if splits.is_empty() {
            return failure(
                "INVALID_AGGREGATE",
                "Normale Buchungen benötigen mindestens einen Split; nicht zugeordnete Buchungen verwenden die Systemkategorie.",
            );
        }
        let mut sum = crate::scalars::MoneyCents::new(0)?;
        for split in splits {
            sum = sum.checked_add(split.amount).map_err(|(code, _)| {
                (
                    code,
                    "Die Splitsumme überschreitet den sicheren Centbereich.",
                )
            })?;
        }
        if sum != amount {
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
    if kind == TransactionKind::Opening && transfer_id.is_some() {
        return failure(
            "INVALID_AGGREGATE",
            "Ein Anfangsbestand darf keine Umbuchung sein.",
        );
    }
    if kind == TransactionKind::Transfer && transfer_id.is_none() {
        return failure(
            "INVALID_AGGREGATE",
            "Eine Umbuchungsseite benötigt ihre Umbuchungs-ID.",
        );
    }
    Ok(())
}
pub(crate) fn rule(a: &Value) -> CoreResult<()> {
    use crate::models::Aggregate;
    let Aggregate::Rule(a) = Aggregate::from_wire(a)? else {
        return Err(INVALID);
    };
    typed_rule(&a)
}
fn typed_rule(a: &crate::models::Rule) -> CoreResult<()> {
    use crate::models::{ConditionField, ConditionOperator, ConditionValue};
    for c in a.conditions.as_slice() {
        if c.field == ConditionField::Amount {
            if !matches!(c.value, ConditionValue::Money(_)) {
                return failure(
                    "INVALID_SAFE_INTEGER",
                    "Der Geldbetrag muss ein sicherer ganzzahliger Centbetrag sein.",
                );
            }
            if c.operator == ConditionOperator::Contains {
                return failure("INVALID_COMMAND", "Beträge unterstützen keine Textsuche.");
            }
        } else {
            let text = match &c.value {
                ConditionValue::Text(text) if !text.is_empty() => text,
                _ => return failure("INVALID_COMMAND", "Die Textbedingung ist leer."),
            };
            if c.field == ConditionField::Date {
                calendar::parse_finance_date(text)?;
                if c.operator == ConditionOperator::Contains {
                    return failure("INVALID_COMMAND", "Datum unterstützt keine Textsuche.");
                }
            } else if ![ConditionOperator::Equals, ConditionOperator::Contains]
                .contains(&c.operator)
            {
                return failure(
                    "INVALID_COMMAND",
                    "Text unterstützt nur Gleichheit und Enthalten.",
                );
            }
        }
    }
    Ok(())
}
pub(crate) fn import_batch(a: &Value) -> CoreResult<()> {
    use crate::models::Aggregate;
    let Aggregate::ImportBatch(a) = Aggregate::from_wire(a)? else {
        return Err(INVALID);
    };
    typed_import_batch(&a)
}
fn typed_import_batch(a: &crate::models::ImportBatch) -> CoreResult<()> {
    use crate::models::ImportDecision;
    let rows = a.rows.as_slice();
    let ids = rows.iter().map(|r| r.source_row).collect::<BTreeSet<_>>();
    if ids.len() != rows.len() {
        return failure("INVALID_COMMAND", "Die Importbeschreibung ist ungültig.");
    }
    for row in rows {
        if row.decision != ImportDecision::Exclude
            && (row.candidate.is_none() || !row.issues.is_empty())
        {
            return failure(
                "INVALID_COMMAND",
                "Ungültige Zeilen müssen korrigiert oder ausdrücklich ausgeschlossen werden.",
            );
        }
        if row
            .candidate
            .as_ref()
            .is_some_and(|c| c.source_row != row.source_row)
        {
            return failure("INVALID_COMMAND", "Die Quellzeile stimmt nicht überein.");
        }
    }
    let unique = a.committed_rows.iter().copied().collect::<BTreeSet<_>>();
    if unique.len() != a.committed_rows.len() || unique.iter().any(|n| !ids.contains(n)) {
        return failure("INVALID_COMMAND", "Der Importfortschritt ist ungültig.");
    }
    Ok(())
}
pub fn validate(all: &[Value], space: &str) -> CoreResult<()> {
    let all = all
        .iter()
        .map(crate::models::Aggregate::from_wire)
        .collect::<CoreResult<Vec<_>>>()?;
    typed_validate(&all, space)
}
pub(crate) fn typed_validate(all: &[crate::models::Aggregate], space: &str) -> CoreResult<()> {
    use crate::models::{
        AccountType, Aggregate, AggregateKind, Clearance, GroupKind, OccurrenceState, RuleAction,
        TransactionKind,
    };
    use crate::scalars::{EntityId, MoneyCents};
    let mut by_id = BTreeMap::<&EntityId, &Aggregate>::new();
    for a in all {
        if a.space_id().as_str() != space
            || by_id.insert(a.id(), a).is_some()
            || a.updated_at() < a.created_at()
            || a.deleted_at().as_ref().is_some_and(|d| d < a.created_at())
            || ((a.id().as_str() == space) != (a.kind() == AggregateKind::FinancialRevision))
        {
            return Err(INVALID);
        }
    }
    let target = |id: &EntityId, expected: AggregateKind| -> CoreResult<&Aggregate> {
        by_id
            .get(id)
            .copied()
            .filter(|a| a.kind() == expected)
            .ok_or(INVALID)
    };
    let mut reconciled = BTreeSet::new();
    let mut system_categories = 0;
    for a in all {
        match a {
            Aggregate::Account(a) if a.account_type == AccountType::Credit && a.on_budget => {
                return failure(
                    "INVALID_AGGREGATE",
                    "Kreditkonten müssen außerhalb des Umschlagbudgets bleiben.",
                );
            }
            Aggregate::Payee(a) => {
                let name = normal_text(a.name.as_str()).to_lowercase();
                let mut aliases = BTreeSet::new();
                for alias in &a.aliases {
                    let key = normal_text(alias.as_str()).to_lowercase();
                    if key == name || !aliases.insert(key) {
                        return failure(
                            "DUPLICATE_REFERENCE",
                            "Empfängeraliasse müssen eindeutig sein und dürfen nicht dem Empfängernamen entsprechen.",
                        );
                    }
                }
            }
            Aggregate::Category(category) => {
                target(&category.group_id, AggregateKind::CategoryGroup)?;
                if category.system.is_some() {
                    system_categories += 1;
                    if category.archived || !a.is_live() || system_categories > 1 {
                        return Err(INVALID);
                    }
                }
            }
            Aggregate::Transaction(tx) => {
                typed_transaction(tx)?;
                target(&tx.account_id, AggregateKind::Account)?;
                if let Some(id) = &tx.payee_id {
                    target(id, AggregateKind::Payee)?;
                }
                for split in &tx.splits {
                    target(&split.category_id, AggregateKind::Category)?;
                }
                if let Some(id) = &tx.transfer_id {
                    let Aggregate::Transfer(transfer) = target(id, AggregateKind::Transfer)? else {
                        return Err(INVALID);
                    };
                    if tx.kind != TransactionKind::Transfer
                        || (transfer.source_transaction_id != tx.id
                            && transfer.target_transaction_id != tx.id)
                    {
                        return Err(INVALID);
                    }
                }
                if let Some(id) = &tx.schedule_occurrence_id {
                    let Aggregate::ScheduleOccurrence(occurrence) =
                        target(id, AggregateKind::ScheduleOccurrence)?
                    else {
                        return Err(INVALID);
                    };
                    if occurrence.transaction_id.as_ref() != Some(&tx.id)
                        || occurrence.state != OccurrenceState::Confirmed
                    {
                        return Err(INVALID);
                    }
                }
            }
            Aggregate::Transfer(transfer) => {
                target(&transfer.source_account_id, AggregateKind::Account)?;
                target(&transfer.target_account_id, AggregateKind::Account)?;
                let source_aggregate =
                    target(&transfer.source_transaction_id, AggregateKind::Transaction)?;
                let destination_aggregate =
                    target(&transfer.target_transaction_id, AggregateKind::Transaction)?;
                let Aggregate::Transaction(source) = source_aggregate else {
                    return Err(INVALID);
                };
                let Aggregate::Transaction(destination) = destination_aggregate else {
                    return Err(INVALID);
                };
                let amount = transfer.amount.cents();
                if amount <= 0 {
                    return failure(
                        "INVALID_AGGREGATE",
                        "Der Umbuchungsbetrag muss positiv sein.",
                    );
                }
                if transfer.source_account_id == transfer.target_account_id {
                    return failure(
                        "INVALID_AGGREGATE",
                        "Quell- und Zielkonto müssen verschieden sein.",
                    );
                }
                typed_transaction(source)?;
                typed_transaction(destination)?;
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
                    if side.kind != TransactionKind::Transfer
                        || side.transfer_id.as_ref() != Some(&transfer.id)
                    {
                        return failure("INVALID_AGGREGATE", label);
                    }
                }
                if source.account_id != transfer.source_account_id
                    || destination.account_id != transfer.target_account_id
                    || source.date != transfer.date
                    || destination.date != transfer.date
                    || source.amount.cents() != -amount
                    || destination.amount.cents() != amount
                {
                    return failure(
                        "INVALID_AGGREGATE",
                        "Die Umbuchungsseiten müssen entgegengesetzte Beträge, Konten und dasselbe Datum besitzen.",
                    );
                }
                if a.is_live() != source_aggregate.is_live()
                    || a.is_live() != destination_aggregate.is_live()
                {
                    return Err(INVALID);
                }
                if let Some(id) = &transfer.budget_category_id {
                    let Aggregate::Category(category) = target(id, AggregateKind::Category)? else {
                        return Err(INVALID);
                    };
                    let Aggregate::CategoryGroup(group) =
                        target(&category.group_id, AggregateKind::CategoryGroup)?
                    else {
                        return Err(INVALID);
                    };
                    if group.kind != GroupKind::Expense {
                        return Err(INVALID);
                    }
                }
            }
            Aggregate::Reconciliation(reconciliation) => {
                target(&reconciliation.account_id, AggregateKind::Account)?;
                let ids = reconciliation.transaction_ids.as_slice();
                let unique = ids.iter().collect::<BTreeSet<_>>();
                if unique.len() != ids.len() {
                    return failure(
                        "DUPLICATE_REFERENCE",
                        "Eine Abgleichbuchung darf nur einmal vorkommen.",
                    );
                }
                for id in ids {
                    let tx_aggregate = target(id, AggregateKind::Transaction)?;
                    let Aggregate::Transaction(tx) = tx_aggregate else {
                        return Err(INVALID);
                    };
                    if a.is_live()
                        && (!tx_aggregate.is_live()
                            || tx.account_id != reconciliation.account_id
                            || tx.date > reconciliation.statement_date
                            || tx.clearance != Clearance::Reconciled
                            || !reconciled.insert(id))
                    {
                        return Err(INVALID);
                    }
                }
            }
            Aggregate::ImportBatch(batch) => {
                typed_import_batch(batch)?;
                target(&batch.account_id, AggregateKind::Account)?;
                for row in batch.rows.as_slice() {
                    if let Some(candidate) = &row.candidate {
                        if let Some(id) = &candidate.category_id {
                            target(id, AggregateKind::Category)?;
                        }
                        if let Some(id) = &candidate.payee_id {
                            target(id, AggregateKind::Payee)?;
                        }
                    }
                }
            }
            Aggregate::ImportFingerprint(fingerprint) => {
                target(&fingerprint.account_id, AggregateKind::Account)?;
                target(&fingerprint.transaction_id, AggregateKind::Transaction)?;
                let Aggregate::ImportBatch(batch) =
                    target(&fingerprint.import_id, AggregateKind::ImportBatch)?
                else {
                    return Err(INVALID);
                };
                if batch.account_id != fingerprint.account_id
                    || !batch.committed_rows.contains(&fingerprint.source_row)
                {
                    return Err(INVALID);
                }
            }
            Aggregate::Rule(rule) => {
                typed_rule(rule)?;
                for action in rule.actions.as_slice() {
                    match action {
                        RuleAction::CategoryId(id) => {
                            target(id, AggregateKind::Category)?;
                        }
                        RuleAction::PayeeId(id) => {
                            target(id, AggregateKind::Payee)?;
                        }
                        RuleAction::Clearance(_) => {}
                    }
                }
            }
            Aggregate::Schedule(schedule) => {
                if schedule
                    .end_date
                    .as_ref()
                    .is_some_and(|end| end < &schedule.start_date)
                {
                    return failure("INVALID_COMMAND", "Das Enddatum liegt vor dem Startdatum.");
                }
                let t = &schedule.template;
                transaction_fields(t.kind, t.amount, &t.splits, t.transfer_id.as_ref())?;
                if t.kind != TransactionKind::Normal
                    || t.clearance == Clearance::Reconciled
                    || t.transfer_id.is_some()
                {
                    return Err(INVALID);
                }
                target(&t.account_id, AggregateKind::Account)?;
                if let Some(id) = &t.payee_id {
                    target(id, AggregateKind::Payee)?;
                }
                for split in &t.splits {
                    target(&split.category_id, AggregateKind::Category)?;
                }
            }
            Aggregate::ScheduleOccurrence(occurrence) => {
                target(&occurrence.schedule_id, AggregateKind::Schedule)?;
                if occurrence.state == OccurrenceState::Confirmed {
                    let id = occurrence.transaction_id.as_ref().ok_or(INVALID)?;
                    let Aggregate::Transaction(tx) = target(id, AggregateKind::Transaction)? else {
                        return Err(INVALID);
                    };
                    if tx.schedule_occurrence_id.as_ref() != Some(&occurrence.id) {
                        return Err(INVALID);
                    }
                } else if occurrence.transaction_id.is_some() {
                    return Err(INVALID);
                }
            }
            Aggregate::Account(_)
            | Aggregate::FinancialRevision(_)
            | Aggregate::CategoryGroup(_)
            | Aggregate::ImportMapping(_) => {}
        }
    }
    for a in all {
        if let Aggregate::Transaction(tx) = a
            && a.is_live()
            && tx.clearance == Clearance::Reconciled
            && !reconciled.contains(&tx.id)
        {
            return Err(INVALID);
        }
    }
    let balances = projections::typed_balances(all)?;
    projections::typed_consumption(all)?;
    let mut total = MoneyCents::new(0)?;
    for balance in balances {
        total = total.checked_add(balance.balance).map_err(|(code, _)| {
            (
                code,
                "Der Gesamtkontostand überschreitet den sicheren Centbereich.",
            )
        })?;
    }
    let mut months = Vec::<(&str, Vec<Aggregate>)>::new();
    let mut index = BTreeMap::new();
    for a in all {
        if let Aggregate::Transaction(tx) = a
            && a.is_live()
        {
            let key = &tx.date.as_str()[..7];
            let n = *index.entry(key).or_insert_with(|| {
                months.push((key, vec![]));
                months.len() - 1
            });
            months[n].1.push(a.clone());
        }
    }
    for (_, txs) in months {
        let mut sum = MoneyCents::new(0)?;
        for a in &txs {
            if let Aggregate::Transaction(tx) = a {
                sum = sum.checked_add(tx.amount).map_err(|(code, _)| {
                    (
                        code,
                        "Die Monatssumme überschreitet den sicheren Centbereich.",
                    )
                })?;
            }
        }
        let mut month = all
            .iter()
            .filter(|a| a.kind() != AggregateKind::Transaction)
            .cloned()
            .collect::<Vec<_>>();
        month.extend(txs);
        projections::typed_consumption(&month)?;
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

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{models::Aggregate, scalars::EntityId};
    fn state(name: &str) -> (String, Vec<Aggregate>) {
        let cases: Vec<Value> =
            serde_json::from_str(include_str!("../tests/fixtures/contract-catalog.json")).unwrap();
        let request = &cases.iter().find(|case| case["name"] == name).unwrap()["request"];
        (
            request["spaceId"].as_str().unwrap().to_owned(),
            request["aggregates"]
                .as_array()
                .unwrap()
                .iter()
                .map(Aggregate::from_wire)
                .collect::<CoreResult<_>>()
                .unwrap(),
        )
    }
    #[test]
    fn typed_state_requires_references_in_the_current_space() {
        let (space, mut all) = state("Bestandsprüfung validate: F01");
        assert!(typed_validate(&all, &space).is_ok());
        let account = all
            .iter()
            .position(|a| matches!(a, Aggregate::Account(_)))
            .unwrap();
        if let Aggregate::Account(a) = &mut all[account] {
            a.space_id = EntityId::new("40000000-0000-4000-8000-000000000099".to_owned()).unwrap();
        }
        assert_eq!(typed_validate(&all, &space).unwrap_err(), INVALID);
        let (space, mut all) = state("Bestandsprüfung validate: F01");
        all.retain(|a| !matches!(a, Aggregate::Category(_)));
        assert_eq!(typed_validate(&all, &space).unwrap_err(), INVALID);
    }
    #[test]
    fn typed_reconciliation_and_transfer_keep_both_sides_consistent() {
        let (space, mut all) = state("Bestandsprüfung validate: Abgleich");
        assert!(typed_validate(&all, &space).is_ok());
        for a in &mut all {
            if let Aggregate::Reconciliation(a) = a {
                a.transaction_ids =
                    crate::scalars::NonEmptyVec::new(vec![
                        a.transaction_ids.as_slice()[0].clone();
                        2
                    ])
                    .unwrap();
            }
        }
        assert_eq!(
            typed_validate(&all, &space).unwrap_err().0,
            "DUPLICATE_REFERENCE"
        );
        let (space, mut all) = state("Bestandsprüfung validate: F03 historisches Konto");
        assert!(typed_validate(&all, &space).is_ok());
        let id = all
            .iter()
            .find_map(|a| {
                if let Aggregate::Transfer(t) = a {
                    Some(t.source_transaction_id.clone())
                } else {
                    None
                }
            })
            .unwrap();
        for a in &mut all {
            if let Aggregate::Transaction(tx) = a
                && tx.id == id
            {
                tx.amount = crate::scalars::MoneyCents::new(tx.amount.cents() + 1).unwrap();
            }
        }
        assert_eq!(
            typed_validate(&all, &space).unwrap_err().1,
            "Die Umbuchungsseiten müssen entgegengesetzte Beträge, Konten und dasselbe Datum besitzen."
        );
    }
}
