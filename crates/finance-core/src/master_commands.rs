// SPDX-License-Identifier: AGPL-3.0-or-later
//! Erste Stammdatenhandler mit vollständigen Revisionsübergängen; keine Persistenz.
use crate::{CoreResult, aggregate_schema, state_validation};
use serde::Deserialize;
use std::collections::BTreeSet;
#[derive(Clone, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct Expectation {
    pub(crate) id: String,
    pub(crate) expected_revision: i64,
}
#[derive(Clone, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct Context {
    pub(crate) operation_id: String,
    pub(crate) occurred_at: String,
    pub(crate) generated_ids: Vec<String>,
}
fn fail<T>(code: &'static str, message: &'static str) -> CoreResult<T> {
    Err((code, message))
}
pub(crate) fn normalize_typed(
    a: crate::models::Aggregate,
    ty: &str,
) -> CoreResult<crate::models::Aggregate> {
    if a.kind().as_str() != ty {
        return fail(
            "INVALID_AGGREGATE",
            match ty {
                "account" => "Das Konto hat einen unpassenden Aggregattyp.",
                "categoryGroup" => "Die Kategoriegruppe hat einen unpassenden Aggregattyp.",
                "category" => "Die Kategorie hat einen unpassenden Aggregattyp.",
                _ => "Der Empfänger hat einen unpassenden Aggregattyp.",
            },
        );
    }
    use crate::{
        models::{AccountType, Aggregate},
        scalars::NonEmptyText,
    };
    let mut a = a;
    match &mut a {
        Aggregate::Account(a) => {
            a.name = NonEmptyText::new(state_validation::normal_text(a.name.as_str()))?;
            if a.account_type == AccountType::Credit && a.on_budget {
                return fail(
                    "INVALID_AGGREGATE",
                    "Kreditkonten müssen außerhalb des Umschlagbudgets bleiben.",
                );
            }
        }
        Aggregate::CategoryGroup(a) => {
            a.name = NonEmptyText::new(state_validation::normal_text(a.name.as_str()))?
        }
        Aggregate::Category(a) => {
            a.name = NonEmptyText::new(state_validation::normal_text(a.name.as_str()))?
        }
        Aggregate::Payee(a) => {
            a.name = NonEmptyText::new(state_validation::normal_text(a.name.as_str()))?;
            let name = a.name.as_str().to_lowercase();
            let mut seen = BTreeSet::new();
            for alias in &mut a.aliases {
                let display = state_validation::normal_text(alias.as_str());
                let key = display.to_lowercase();
                if key == name || !seen.insert(key) {
                    return fail(
                        "DUPLICATE_REFERENCE",
                        "Empfängeraliasse müssen eindeutig sein und dürfen nicht dem Empfängernamen entsprechen.",
                    );
                }
                *alias = NonEmptyText::new(display)?;
            }
        }
        _ => return Err(aggregate_schema::INVALID),
    }
    Ok(a)
}
pub(crate) fn execute_typed(
    request: crate::command_contracts::Request,
) -> CoreResult<crate::command_contracts::ChangeSet> {
    use crate::{
        command_contracts::{self, COMMAND_ERROR},
        models::{Aggregate, AggregateKind, CategorySystem, Command},
    };
    request.check_versions()?;
    let current = request.current();
    if current.len() != request.aggregates.len() {
        return Err(aggregate_schema::INVALID);
    }
    let (ty, command_type, archiving, entries, id) = match &request.command {
        Command::AccountSave(c) => (
            "account",
            "account.save",
            false,
            Some(c.aggregates.as_slice()),
            None,
        ),
        Command::CategoryGroupSave(c) => (
            "categoryGroup",
            "categoryGroup.save",
            false,
            Some(c.aggregates.as_slice()),
            None,
        ),
        Command::CategorySave(c) => (
            "category",
            "category.save",
            false,
            Some(c.aggregates.as_slice()),
            None,
        ),
        Command::PayeeSave(c) => (
            "payee",
            "payee.save",
            false,
            Some(c.aggregates.as_slice()),
            None,
        ),
        Command::AccountArchive(c) => (
            "account",
            "account.archive",
            true,
            None,
            Some(&c.aggregate_id),
        ),
        Command::CategoryArchive(c) => (
            "category",
            "category.archive",
            true,
            None,
            Some(&c.aggregate_id),
        ),
        _ => return Err(COMMAND_ERROR),
    };
    let a = if let Some(id) = id {
        let mut a = command_contracts::revise(
            (*current.get(id).ok_or(aggregate_schema::INVALID)?).clone(),
            &request.context.occurred_at,
        )?;
        match &mut a {
            Aggregate::Account(a) => a.archived = true,
            Aggregate::Category(a) => a.archived = true,
            _ => return normalize_typed(a, ty).and(Err(aggregate_schema::INVALID)),
        }
        normalize_typed(a, ty)?
    } else {
        let entries = entries.ok_or(COMMAND_ERROR)?;
        if entries.len() != 1 {
            return Err((
                "INVALID_COMMAND",
                "Der Stammdatenbefehl benötigt genau ein vollständiges Aggregat des passenden Typs.",
            ));
        }
        normalize_typed(entries[0].clone(), ty)?
    };
    if let Aggregate::Category(category) = &a {
        if !request
            .expected_revisions
            .iter()
            .any(|e| e.id == category.group_id)
        {
            return Err((
                "REVISION_MISSING",
                "Die referenzierte Kategoriegruppe benötigt eine erwartete Revision.",
            ));
        }
        if current
            .get(&category.group_id)
            .is_none_or(|g| g.kind() != AggregateKind::CategoryGroup)
        {
            return Err((
                "INVALID_AGGREGATE",
                "Die referenzierte Kategoriegruppe existiert nicht im selben Fachbestand.",
            ));
        }
        crate::references::typed_validate(std::slice::from_ref(&a), &request.aggregates)?;
        if let Some(old) = current.get(a.id()) {
            let old_system = if let Aggregate::Category(old) = old {
                old.system
            } else {
                None
            };
            if old_system == Some(CategorySystem::Uncategorized)
                && (category.system != Some(CategorySystem::Uncategorized)
                    || category.archived
                    || !a.is_live())
            {
                return Err((
                    "INVALID_COMMAND",
                    "Die Systemkategorie „Nicht zugeordnet“ darf weder umgewidmet noch archiviert oder gelöscht werden.",
                ));
            }
            if old_system != Some(CategorySystem::Uncategorized) && old_system != category.system {
                return Err((
                    "INVALID_COMMAND",
                    "Der Systemstatus einer gespeicherten Kategorie darf nicht geändert werden.",
                ));
            }
        }
        if archiving && category.system == Some(CategorySystem::Uncategorized) {
            return Err((
                "INVALID_COMMAND",
                "Die Systemkategorie „Nicht zugeordnet“ darf nicht archiviert werden.",
            ));
        }
    }
    let scope = request.scope();
    let expected = command_contracts::expected(&scope, &request.expected_revisions, &current)?;
    if a.updated_at() < a.created_at() {
        return Err((
            "INVALID_AGGREGATE",
            "Der Änderungszeitpunkt darf nicht vor dem Erstellungszeitpunkt liegen.",
        ));
    }
    command_contracts::transition(&a, &request.space_id, &expected, &current)?;
    Ok(request.changed(command_type, vec![a], request.expected_revisions.clone()))
}
