// SPDX-License-Identifier: AGPL-3.0-or-later
//! Typisierte Regel- und Importports; kanonischer Fingerprint bleibt V1-kompatibel.
use crate::{
    CoreResult,
    models::{Aggregate, AggregateKind, ImportCandidate, Rule, RuleAction},
    scalars::EntityId,
    state_validation,
};
pub(crate) fn active<'a>(
    all: &'a [Aggregate],
    space: &EntityId,
    id: &EntityId,
    kind: AggregateKind,
) -> CoreResult<&'a Aggregate> {
    all.iter()
        .find(|a| {
            a.id() == id
                && a.kind() == kind
                && a.space_id() == space
                && a.is_live()
                && match a {
                    Aggregate::Account(a) => !a.archived,
                    Aggregate::Category(a) => !a.archived,
                    Aggregate::CategoryGroup(a) => !a.archived,
                    Aggregate::Payee(a) => !a.archived,
                    _ => true,
                }
        })
        .ok_or((
            "INVALID_COMMAND",
            "Die Referenz ist nicht im aktiven Bereich verfügbar.",
        ))
}
pub(crate) fn validate_rule(rule: &Rule, all: &[Aggregate]) -> CoreResult<()> {
    state_validation::typed_rule(rule)?;
    for action in rule.actions.as_slice() {
        match action {
            RuleAction::CategoryId(id) => {
                active(all, &rule.space_id, id, AggregateKind::Category)?;
            }
            RuleAction::PayeeId(id) => {
                active(all, &rule.space_id, id, AggregateKind::Payee)?;
            }
            RuleAction::Clearance(_) => {}
        }
    }
    Ok(())
}
pub(crate) fn fingerprint(row: &ImportCandidate) -> String {
    if let Some(fp) = &row.source_fingerprint {
        return fp.as_str().to_owned();
    }
    // Formatdefinition eines V1-Fingerprints, keine dynamischen Fachmodelle.
    serde_json::to_string(&(
        row.date.as_str(),
        row.amount,
        state_validation::normal_text(row.payee.as_deref().unwrap_or("")).to_lowercase(),
        state_validation::normal_text(row.memo.as_deref().unwrap_or("")).to_lowercase(),
    ))
    .expect("Ein typisierter Fingerprint ist serialisierbar")
}
pub(crate) fn source(row: &ImportCandidate) -> &'static str {
    match row.parser_source {
        None | Some(crate::models::ParserSource::Csv) => "csv",
        Some(crate::models::ParserSource::Camt053) => "camt053",
        Some(crate::models::ParserSource::Ofx) => "ofx",
        Some(crate::models::ParserSource::Qfx) => "qfx",
    }
}
pub(crate) use wimm_finance_types::calculation_contracts::Classification;
pub(crate) fn duplicate(
    row: &ImportCandidate,
    account: &EntityId,
    all: &[Aggregate],
) -> Classification {
    let fp = fingerprint(row);
    let source = source(row);
    let external = row.external_id.as_deref().filter(|s| !s.is_empty());
    let fingerprints = all
        .iter()
        .filter_map(|a| {
            if let Aggregate::ImportFingerprint(fp) = a
                && &fp.account_id == account
            {
                Some(fp)
            } else {
                None
            }
        })
        .collect::<Vec<_>>();
    let same = fingerprints
        .iter()
        .filter(|a| {
            external.is_some_and(|id| {
                a.parser_source.as_str() == source && a.external_id.as_deref() == Some(id)
            })
        })
        .collect::<Vec<_>>();
    if same.iter().any(|a| a.fingerprint.as_str() != fp) {
        return Classification::Conflict;
    }
    if external.is_some() {
        if same.is_empty() {
            Classification::New
        } else {
            Classification::Duplicate
        }
    } else if fingerprints.iter().any(|a| a.fingerprint.as_str() == fp) {
        Classification::Duplicate
    } else {
        Classification::New
    }
}
