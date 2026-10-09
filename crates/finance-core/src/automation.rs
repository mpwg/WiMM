// SPDX-License-Identifier: AGPL-3.0-or-later
//! Typisierte Regelanwendung und Importklassifizierung; JSON nur an der Grenze.
use crate::{
    CoreResult, command_contracts::COMMAND_ERROR, models::*, projections, scalars::*,
    typed_automation as automation,
};
use std::collections::{BTreeMap, BTreeSet};
use unicode_normalization::UnicodeNormalization;
use wimm_finance_types::calculation_contracts::{
    CalculationOutcome, CalculationRequest as Calculation, ClassificationRow,
};
fn fold(text: &str) -> String {
    text.nfc().collect::<String>().to_lowercase()
}
fn matches(condition: &RuleCondition, row: &ImportCandidate) -> bool {
    if condition.field == ConditionField::Amount {
        let ConditionValue::Money(other) = condition.value else {
            return false;
        };
        return match condition.operator {
            ConditionOperator::Equals => row.amount == other,
            ConditionOperator::Gte => row.amount >= other,
            ConditionOperator::Lte => row.amount <= other,
            ConditionOperator::Contains => false,
        };
    }
    let value = match condition.field {
        ConditionField::Date => row.date.as_str(),
        ConditionField::Payee => row.payee.as_deref().unwrap_or(""),
        ConditionField::Memo => row.memo.as_deref().unwrap_or(""),
        ConditionField::Amount => return false,
    };
    let ConditionValue::Text(other) = &condition.value else {
        return false;
    };
    match condition.operator {
        ConditionOperator::Equals => value == other,
        ConditionOperator::Contains => fold(value).contains(&fold(other)),
        ConditionOperator::Gte => value >= other.as_str(),
        ConditionOperator::Lte => value <= other.as_str(),
    }
}
pub fn calculate(request: Calculation) -> CoreResult<CalculationOutcome> {
    match request {
        Calculation::RuleApply(request) => {
            if request.contract_version != 1 || request.domain_schema_version != 1 {
                return Err(COMMAND_ERROR);
            }
            let mut result = request.candidate;
            result.source_fingerprint = Some(NonEmptyText::new(automation::fingerprint(&result))?);
            let all = &request.aggregates;
            let mut rules = all
                .iter()
                .filter_map(|a| {
                    if let Aggregate::Rule(rule) = a
                        && rule.enabled
                        && a.is_live()
                        && rule.space_id == request.space_id
                    {
                        Some(rule)
                    } else {
                        None
                    }
                })
                .collect::<Vec<_>>();
            rules.sort_by(|a, b| {
                a.order
                    .cmp(&b.order)
                    .then_with(|| projections::uuid_order(a.id.as_str(), b.id.as_str()))
            });
            let mut applied = vec![];
            for rule in rules {
                automation::validate_rule(rule, all)?;
                if !rule
                    .conditions
                    .as_slice()
                    .iter()
                    .all(|c| matches(c, &result))
                {
                    continue;
                }
                for action in rule.actions.as_slice() {
                    match action {
                        RuleAction::CategoryId(id) => result.category_id = Some(id.clone()),
                        RuleAction::Clearance(clearance) => result.clearance = Some(*clearance),
                        RuleAction::PayeeId(id) => {
                            result.payee_id = Some(id.clone());
                            let Aggregate::Payee(payee) = automation::active(
                                all,
                                &request.space_id,
                                id,
                                AggregateKind::Payee,
                            )?
                            else {
                                return Err(COMMAND_ERROR);
                            };
                            result.payee = Some(payee.name.as_str().to_owned());
                        }
                    }
                }
                applied.push(rule.id.clone());
                if rule.stop_processing {
                    break;
                }
            }
            Ok(CalculationOutcome::RuleApplied {
                contract_version: 1,
                candidate: result,
                applied_rule_ids: applied,
            })
        }
        Calculation::ImportClassify(request) => {
            if request.contract_version != 1 || request.domain_schema_version != 1 {
                return Err(COMMAND_ERROR);
            }
            // space_id ist ein geprüfter Requestbereich; V1 klassifiziert anhand des expliziten Kontos.
            let _space = request.space_id;
            let mut identities = BTreeMap::<(String, String), BTreeSet<String>>::new();
            let mut contents = BTreeSet::new();
            for a in &request.aggregates {
                if let Aggregate::ImportFingerprint(fp) = a
                    && a.is_live()
                    && fp.account_id == request.account_id
                {
                    let fingerprint = fp.fingerprint.as_str().to_owned();
                    contents.insert(fingerprint.clone());
                    if let Some(id) = fp.external_id.as_deref().filter(|s| !s.is_empty()) {
                        identities
                            .entry((fp.parser_source.as_str().to_owned(), id.to_owned()))
                            .or_default()
                            .insert(fingerprint);
                    }
                }
            }
            let mut rows = vec![];
            let mut positions = BTreeMap::new();
            for row in request.candidates {
                let fp = automation::fingerprint(&row);
                let key = row
                    .external_id
                    .as_deref()
                    .filter(|s| !s.is_empty())
                    .map(|id| (automation::source(&row).to_owned(), id.to_owned()));
                let same = key.as_ref().and_then(|key| identities.get(key));
                let classification = if same.is_some_and(|values| values.iter().any(|s| s != &fp)) {
                    automation::Classification::Conflict
                } else if key.is_some() {
                    if same.is_some_and(|s| !s.is_empty()) {
                        automation::Classification::Duplicate
                    } else {
                        automation::Classification::New
                    }
                } else if contents.contains(&fp) {
                    automation::Classification::Duplicate
                } else {
                    automation::Classification::New
                };
                let result = ClassificationRow {
                    source_row: row.source_row,
                    classification,
                };
                let n = *positions.entry(row.source_row).or_insert_with(|| {
                    rows.push(ClassificationRow {
                        source_row: row.source_row,
                        classification,
                    });
                    rows.len() - 1
                });
                rows[n] = result;
                contents.insert(fp.clone());
                if let Some(key) = key {
                    identities.entry(key).or_default().insert(fp);
                }
            }
            Ok(CalculationOutcome::Classified {
                contract_version: 1,
                rows,
            })
        }
        _ => Err(COMMAND_ERROR),
    }
}
