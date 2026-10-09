// SPDX-License-Identifier: AGPL-3.0-or-later
//! Typisierte Gegenbefehle verändern Aktionsaggregate, niemals Bereichssnapshots.
use crate::{
    CoreResult,
    aggregate_schema::INVALID,
    command_contracts::{self, COMMAND_ERROR, ChangeSet, Context, Expectation, Request, Scope},
    models::*,
    scalars::*,
};
use serde::Deserialize;
use std::collections::{BTreeMap, BTreeSet};
#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct Target {
    id: EntityId,
    #[serde(default, deserialize_with = "present")]
    previous: Option<Aggregate>,
}
#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct ReverseRequest {
    contract_version: u32,
    domain_schema_version: u32,
    space_id: EntityId,
    aggregates: Vec<Aggregate>,
    expected_revisions: Vec<Expectation>,
    context: Context,
    targets: NonEmptyVec<Target>,
}
impl ReverseRequest {
    fn scope(&self) -> Scope<'_> {
        Scope {
            space_id: &self.space_id,
            aggregates: &self.aggregates,
            context: &self.context,
        }
    }
    fn child(&self, command: Command, expected_revisions: Vec<Expectation>) -> Request {
        Request {
            contract_version: 1.into(),
            domain_schema_version: 1.into(),
            space_id: self.space_id.clone(),
            aggregates: self.aggregates.clone(),
            command,
            expected_revisions,
            context: self.context.clone(),
        }
    }
}
fn expectations(
    aggs: &[&Aggregate],
    current: &BTreeMap<&EntityId, &Aggregate>,
) -> CoreResult<Vec<Expectation>> {
    let mut ids = BTreeSet::new();
    aggs.iter()
        .filter(|a| ids.insert(a.id()))
        .map(|a| {
            Ok(Expectation {
                id: a.id().clone(),
                expected_revision: Revision::new(
                    current
                        .get(a.id())
                        .map(|a| a.revision().value())
                        .unwrap_or(0),
                )?,
            })
        })
        .collect()
}
pub fn reverse_json(input: &str) -> String {
    crate::output((|| {
        let request: ReverseRequest =
            serde_json::from_value(crate::decode(input)?).map_err(|_| COMMAND_ERROR)?;
        command_contracts::to_wire(reverse(request)?)
    })())
}
fn reverse(request: ReverseRequest) -> CoreResult<ChangeSet> {
    if request.contract_version != 1 || request.domain_schema_version != 1 {
        return Err(COMMAND_ERROR);
    }
    let scope = request.scope();
    let current = scope.current();
    let mut desired = vec![];
    let mut positions = BTreeMap::new();
    for target in request.targets.as_slice() {
        if target.previous.as_ref().is_some_and(|a| {
            !matches!(
                a,
                Aggregate::Transaction(_) | Aggregate::Transfer(_) | Aggregate::Reconciliation(_)
            )
        }) {
            return Err((
                "INVALID_COMMAND",
                "Nur Finanzaktionen besitzen Gegenbefehle.",
            ));
        }
        let head = current
            .get(&target.id)
            .copied()
            .filter(|a| {
                matches!(
                    a,
                    Aggregate::Transaction(_)
                        | Aggregate::Transfer(_)
                        | Aggregate::Reconciliation(_)
                ) && a.space_id() == &request.space_id
            })
            .ok_or((
                "REVISION_CONFLICT",
                "Die Aktion gehört nicht zum aktuellen Bereich.",
            ))?;
        let mut value = if target.previous.as_ref().is_none_or(|a| !a.is_live()) {
            let mut a = head.clone();
            *a.deleted_at_mut() = Some(request.context.occurred_at.clone());
            a
        } else {
            let mut a = target.previous.as_ref().ok_or(COMMAND_ERROR)?.clone();
            *a.deleted_at_mut() = None;
            *a.revision_mut() = head.revision();
            a
        };
        value = command_contracts::revise(value, &request.context.occurred_at)?;
        if let Some(n) = positions.get(&target.id) {
            desired[*n] = value;
        } else {
            positions.insert(target.id.clone(), desired.len());
            desired.push(value);
        }
    }
    command_contracts::inspect_changes(&desired, &request.expected_revisions, &scope)?;
    let (checked, expected) = crate::typed_financial::prepare(
        desired.clone(),
        request.expected_revisions.clone(),
        &scope,
    )?;
    command_contracts::inspect_changes(&checked, &expected, &scope)?;
    let mut children = vec![];
    let mut owned = BTreeSet::new();
    for a in &desired {
        if let Aggregate::Reconciliation(entry) = a {
            let mut transactions = vec![];
            for id in entry.transaction_ids.as_slice() {
                owned.insert(id.clone());
                transactions.push(
                    current
                        .get(id)
                        .copied()
                        .ok_or(("INVALID_AGGREGATE", "Die Abgleichbuchung fehlt."))?,
                );
            }
            let account = current.get(&entry.account_id).copied().ok_or(INVALID)?;
            let mut reads = vec![current.get(&entry.id).copied().ok_or(INVALID)?];
            reads.extend(transactions);
            let command = if entry.deleted_at.is_some() {
                Command::ReconciliationUnlock(ReconciliationUnlock {
                    reconciliation_id: entry.id.clone(),
                })
            } else {
                for a in request.aggregates.iter().filter(|a|matches!(a,Aggregate::Transaction(tx) if a.is_live() && tx.account_id==entry.account_id && tx.clearance==Clearance::Reconciled && tx.date<=entry.statement_date && !owned.contains(&tx.id))){reads.push(a);}
                Command::ReconciliationConfirm(ReconciliationConfirm {
                    account_id: entry.account_id.clone(),
                    statement_date: entry.statement_date.clone(),
                    statement_balance: entry.statement_balance,
                    selected_transaction_ids: entry.transaction_ids.clone(),
                })
            };
            reads.push(account);
            let mut child = request.child(command, expectations(&reads, &current)?);
            if entry.deleted_at.is_none() {
                child.context.generated_ids.insert(0, entry.id.clone());
            }
            let mut result =
                crate::reconciliation_commands::execute_typed(child, Some(entry.clone()))?;
            if entry.deleted_at.is_some() {
                for a in &mut result.aggregates {
                    if let Aggregate::Transaction(tx) = a
                        && let Some(Aggregate::Transaction(target)) =
                            desired.iter().find(|v| v.id() == &tx.id)
                    {
                        if ![Clearance::Cleared, Clearance::Uncleared].contains(&target.clearance) {
                            return Err((
                                "INVALID_COMMAND",
                                "Ungültiger Gegenbefehl zum Entsperren.",
                            ));
                        }
                        tx.clearance = target.clearance;
                    }
                }
            }
            children.push(result);
        }
    }
    for a in &desired {
        if let Aggregate::Transfer(entry) = a {
            let deleting = entry.deleted_at.is_some();
            let values = if deleting {
                &request.aggregates
            } else {
                &desired
            };
            let source = values
                .iter()
                .find(|a| a.id() == &entry.source_transaction_id)
                .ok_or((
                    "INVALID_AGGREGATE",
                    "Der Gegenbefehl benötigt beide Umbuchungsseiten.",
                ))?;
            let target = values
                .iter()
                .find(|a| a.id() == &entry.target_transaction_id)
                .ok_or((
                    "INVALID_AGGREGATE",
                    "Der Gegenbefehl benötigt beide Umbuchungsseiten.",
                ))?;
            owned.insert(source.id().clone());
            owned.insert(target.id().clone());
            let transfer = if deleting {
                current.get(&entry.id).copied().ok_or(INVALID)?
            } else {
                a
            };
            let mut reads = vec![transfer, source, target];
            for id in [&entry.source_account_id, &entry.target_account_id] {
                reads.push(current.get(id).copied().ok_or(INVALID)?);
            }
            if let Some(id) = &entry.budget_category_id {
                let category = current.get(id).copied().ok_or(INVALID)?;
                reads.push(category);
                let Aggregate::Category(c) = category else {
                    return Err(INVALID);
                };
                reads.push(current.get(&c.group_id).copied().ok_or(INVALID)?);
            }
            let command = if deleting {
                Command::TransferDelete(AggregateCommand {
                    aggregate_id: entry.id.clone(),
                })
            } else {
                Command::TransferSave(SaveCommand {
                    aggregates: NonEmptyVec::new(vec![
                        transfer.clone(),
                        source.clone(),
                        target.clone(),
                    ])?,
                })
            };
            children.push(crate::transfer_commands::execute_typed(
                request.child(command, expectations(&reads, &current)?),
            )?);
        }
    }
    for a in &desired {
        if let Aggregate::Transaction(entry) = a
            && !owned.contains(&entry.id)
        {
            let head = current.get(&entry.id).copied().ok_or(INVALID)?;
            if entry.kind == TransactionKind::Transfer {
                let mut after = a.clone();
                *after.revision_mut() = head.revision();
                *after.updated_at_mut() = head.updated_at().clone();
                if *head != after {
                    return Err((
                        "INVALID_COMMAND",
                        "Eine einzelne Umbuchungsseite darf nicht geändert werden.",
                    ));
                }
                continue;
            }
            let mut reads = vec![head];
            let mut refs = vec![&entry.account_id];
            refs.extend(entry.splits.iter().map(|s| &s.category_id));
            if let Some(id) = &entry.payee_id {
                refs.push(id);
            }
            for id in refs {
                reads.push(
                    current
                        .get(id)
                        .copied()
                        .ok_or(("INVALID_AGGREGATE", "Eine Referenz fehlt."))?,
                );
            }
            let command = if entry.deleted_at.is_some() {
                Command::TransactionDelete(AggregateCommand {
                    aggregate_id: entry.id.clone(),
                })
            } else {
                Command::TransactionSave(SaveCommand {
                    aggregates: NonEmptyVec::new(vec![a.clone()])?,
                })
            };
            children.push(crate::typed_financial::execute(
                request.child(command, expectations(&reads, &current)?),
            )?);
        }
    }
    let mut changes = vec![];
    let mut index = BTreeMap::new();
    let mut all_expected = request.expected_revisions.clone();
    let mut command = "reconciliation.unlock".to_owned();
    for (n, child) in children.into_iter().enumerate() {
        if n == 0 {
            command = child.command_type;
        }
        for a in child.aggregates {
            if let Some(n) = index.get(a.id()) {
                changes[*n] = a;
            } else {
                index.insert(a.id().clone(), changes.len());
                changes.push(a);
            }
        }
        for e in child.expected_revisions {
            if let Some(old) = all_expected.iter_mut().find(|old| old.id == e.id) {
                old.expected_revision = e.expected_revision;
            } else {
                all_expected.push(e);
            }
        }
    }
    for a in desired {
        if !index.contains_key(a.id()) {
            index.insert(a.id().clone(), changes.len());
            changes.push(a);
        }
    }
    command_contracts::inspect_changes(&changes, &all_expected, &scope)?;
    let (changes, expected) = if [
        "reconciliation.confirm",
        "reconciliation.unlock",
        "payee.merge",
    ]
    .contains(&command.as_str())
    {
        (changes, all_expected)
    } else {
        crate::typed_financial::prepare(changes, all_expected, &scope)?
    };
    command_contracts::inspect_changes(&changes, &expected, &scope)?;
    Ok(ChangeSet {
        space_id: request.space_id,
        command_type: command,
        operation_id: request.context.operation_id,
        occurred_at: request.context.occurred_at,
        expected_revisions: expected,
        aggregates: changes,
    })
}
