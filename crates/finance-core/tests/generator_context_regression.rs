// SPDX-License-Identifier: AGPL-3.0-or-later
#![forbid(unsafe_code)]
use serde::Deserialize;
use serde_json::Value;
#[derive(Deserialize)]
struct Case {
    name: String,
    request: Value,
    expected: Value,
}
#[test]
fn invalid_utc_generator_times_never_produce_a_change_set() {
    let cases: Vec<Case> =
        serde_json::from_str(include_str!("fixtures/generator-context-regression.json")).unwrap();
    assert_eq!(cases.len(), 10);
    for case in cases {
        let actual: Value = serde_json::from_str(&wimm_finance_core::execute_json(
            &case
                .request
                .as_str()
                .map_or_else(|| case.request.to_string(), str::to_owned),
        ))
        .unwrap();
        assert_eq!(actual, case.expected, "{}", case.name);
        if actual["status"] == "rejected" {
            assert!(actual.get("changeSet").is_none());
        } else {
            for a in actual["changeSet"]["aggregates"].as_array().unwrap() {
                let model = wimm_finance_core::models::Aggregate::from_wire(a).unwrap();
                assert_eq!(
                    model.updated_at().as_str(),
                    case.request["context"]["occurredAt"].as_str().unwrap()
                );
            }
        }
    }
}
