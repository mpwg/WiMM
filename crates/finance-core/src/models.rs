// SPDX-License-Identifier: AGPL-3.0-or-later
//! Kompatible private Fachmodelle aus der gemeinsamen Rust-Typquelle.
#[cfg(test)]
use crate::scalars::*;
pub use wimm_finance_types::models::*;

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::{Value, json};
    fn compare(value: &Value, command: bool) {
        let old = if command {
            crate::v1_shape_reference::command(value)
        } else {
            crate::v1_shape_reference::aggregate(value)
        }
        .is_ok();
        let new = if command {
            serde_json::from_value::<Command>(value.clone()).is_ok()
        } else {
            serde_json::from_value::<Aggregate>(value.clone()).is_ok()
        };
        assert_eq!(new, old, "Formabweichung: {value}");
        if new {
            let back = if command {
                serde_json::to_value(serde_json::from_value::<Command>(value.clone()).unwrap())
                    .unwrap()
            } else {
                serde_json::to_value(serde_json::from_value::<Aggregate>(value.clone()).unwrap())
                    .unwrap()
            };
            assert_eq!(back, *value, "Feldverlust: {value}");
        }
    }
    fn visit(value: &Value, count: &mut usize) {
        match value {
            Value::Object(fields) => {
                if fields.contains_key("aggregateType") || fields.contains_key("commandType") {
                    let command = fields.contains_key("commandType");
                    compare(value, command);
                    *count += 1;
                    let mut extra = value.clone();
                    extra["unknownField"] = json!(true);
                    compare(&extra, command);
                    for key in fields.keys() {
                        let mut missing = value.clone();
                        missing.as_object_mut().unwrap().remove(key);
                        compare(&missing, command);
                        for wrong in [
                            Value::Null,
                            json!(true),
                            json!(""),
                            json!(-1),
                            json!([]),
                            json!({}),
                        ] {
                            let mut changed = value.clone();
                            changed[key] = wrong;
                            compare(&changed, command);
                        }
                    }
                }
                for v in fields.values() {
                    visit(v, count);
                }
            }
            Value::Array(values) => {
                for v in values {
                    visit(v, count);
                }
            }
            _ => {}
        }
    }
    #[test]
    fn v1_shapes_and_field_roundtrips_match_the_locked_catalog_and_mutations() {
        let catalog: Value =
            serde_json::from_str(include_str!("../tests/fixtures/contract-catalog.json")).unwrap();
        let mut count = 0;
        visit(&catalog, &mut count);
        assert!(count > 1000, "Nur {count} Fachformen geprüft");
    }
    #[test]
    fn optional_null_is_rejected_but_required_nullable_candidate_is_preserved() {
        let candidate = json!({"sourceRow":1,"date":"2028-02-29","amount":100});
        assert!(serde_json::from_value::<ImportCandidate>(candidate.clone()).is_ok());
        let mut null = candidate;
        null["memo"] = Value::Null;
        assert!(serde_json::from_value::<ImportCandidate>(null).is_err());
        let row = json!({"sourceRow":1,"candidate":null,"decision":"exclude","issues":[]});
        let model: ImportRow = serde_json::from_value(row.clone()).unwrap();
        assert_eq!(serde_json::to_value(model).unwrap(), row);
        let mut missing = row;
        missing.as_object_mut().unwrap().remove("candidate");
        assert!(serde_json::from_value::<ImportRow>(missing).is_err());
    }
    #[test]
    fn action_value_types_and_collection_limits_are_enforced() {
        assert!(
            serde_json::from_value::<RuleAction>(json!({"field":"clearance","value":"reconciled"}))
                .is_err()
        );
        assert!(
            serde_json::from_value::<RuleAction>(json!({"field":"categoryId","value":"cleared"}))
                .is_err()
        );
        assert!(NonEmptyVec::<EntityId>::new(vec![]).is_err());
        assert!(BoundedVec::<u8, 1, 100_000>::new(vec![0; 100_001]).is_err());
        assert!(StoredRevision::new(0).is_err());
    }
}
