// SPDX-License-Identifier: AGPL-3.0-or-later
//! Neue Referenzen benötigen lebende Ziele; historische Referenzen bleiben erhalten.
use crate::{
    CoreResult,
    models::{Aggregate, AggregateKind},
    scalars::EntityId,
};
use serde_json::Value;
use std::collections::BTreeMap;
const INVALID: (&str, &str) = (
    "INVALID_AGGREGATE",
    "Neue Finanzreferenzen benötigen ein vorhandenes, nicht gelöschtes Ziel im selben Bereich.",
);
pub fn validate(changes: &[Value], current: &[Value]) -> CoreResult<()> {
    let changes = changes
        .iter()
        .map(Aggregate::from_wire)
        .collect::<CoreResult<Vec<_>>>()?;
    let current = current
        .iter()
        .map(Aggregate::from_wire)
        .collect::<CoreResult<Vec<_>>>()?;
    typed_validate(&changes, &current)
}
pub(crate) fn typed_validate(changes: &[Aggregate], current: &[Aggregate]) -> CoreResult<()> {
    let before = current
        .iter()
        .map(|a| (a.id(), a))
        .collect::<BTreeMap<_, _>>();
    let mut after = before.clone();
    for a in changes {
        after.insert(a.id(), a);
    }
    let target = |id: &EntityId, kind: AggregateKind, space: &EntityId| -> CoreResult<&Aggregate> {
        after
            .get(id)
            .copied()
            .filter(|a| a.kind() == kind && a.space_id() == space && a.is_live())
            .ok_or(INVALID)
    };
    let category = |id: &EntityId, space: &EntityId| -> CoreResult<()> {
        let Aggregate::Category(a) = target(id, AggregateKind::Category, space)? else {
            return Err(INVALID);
        };
        target(&a.group_id, AggregateKind::CategoryGroup, space)?;
        Ok(())
    };
    for a in changes {
        if !a.is_live() {
            continue;
        }
        let previous = before.get(a.id()).copied().filter(|a| a.is_live());
        let space = a.space_id();
        match a {
            Aggregate::Category(a) => {
                let old = previous.and_then(|p| {
                    if let Aggregate::Category(p) = p {
                        Some(&p.group_id)
                    } else {
                        None
                    }
                });
                if old != Some(&a.group_id) {
                    target(&a.group_id, AggregateKind::CategoryGroup, space)?;
                }
            }
            Aggregate::Transaction(a) => {
                let old = match previous {
                    Some(Aggregate::Transaction(p)) => Some(p),
                    None => None,
                    Some(_) => return Err(crate::aggregate_schema::INVALID),
                };
                for (id, previous, kind) in [
                    (
                        Some(&a.account_id),
                        old.map(|p| &p.account_id),
                        AggregateKind::Account,
                    ),
                    (
                        a.payee_id.as_ref(),
                        old.and_then(|p| p.payee_id.as_ref()),
                        AggregateKind::Payee,
                    ),
                    (
                        a.transfer_id.as_ref(),
                        old.and_then(|p| p.transfer_id.as_ref()),
                        AggregateKind::Transfer,
                    ),
                ] {
                    if let Some(id) = id
                        && previous != Some(id)
                    {
                        target(id, kind, space)?;
                    }
                }
                let old_splits = old
                    .map(|p| {
                        p.splits
                            .iter()
                            .map(|s| (&s.id, &s.category_id))
                            .collect::<BTreeMap<_, _>>()
                    })
                    .unwrap_or_default();
                for split in &a.splits {
                    if old_splits.get(&split.id).copied() != Some(&split.category_id) {
                        category(&split.category_id, space)?;
                    }
                }
            }
            Aggregate::Transfer(a) => {
                let old = previous.and_then(|p| {
                    if let Aggregate::Transfer(p) = p {
                        Some(p)
                    } else {
                        None
                    }
                });
                for (id, previous, kind) in [
                    (
                        &a.source_account_id,
                        old.map(|p| &p.source_account_id),
                        AggregateKind::Account,
                    ),
                    (
                        &a.target_account_id,
                        old.map(|p| &p.target_account_id),
                        AggregateKind::Account,
                    ),
                    (
                        &a.source_transaction_id,
                        old.map(|p| &p.source_transaction_id),
                        AggregateKind::Transaction,
                    ),
                    (
                        &a.target_transaction_id,
                        old.map(|p| &p.target_transaction_id),
                        AggregateKind::Transaction,
                    ),
                ] {
                    if previous != Some(id) {
                        target(id, kind, space)?;
                    }
                }
                if let Some(id) = &a.budget_category_id
                    && old.and_then(|p| p.budget_category_id.as_ref()) != Some(id)
                {
                    category(id, space)?;
                }
            }
            _ => {}
        }
    }
    Ok(())
}
