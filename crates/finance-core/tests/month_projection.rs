// SPDX-License-Identifier: AGPL-3.0-or-later
#![forbid(unsafe_code)]
use wimm_finance_types::state_contracts::ProjectionRequest;
#[test]
fn empty_month_keeps_valid_transfer_references_and_rejects_broken_full_state() {
    let catalog: Vec<serde_json::Value> =
        serde_json::from_str(include_str!("fixtures/contract-catalog.json")).unwrap();
    let case = catalog
        .iter()
        .find(|case| {
            case["method"] == "project"
                && case["expected"]["status"] == "projected"
                && case["request"]["aggregates"]
                    .as_array()
                    .unwrap()
                    .iter()
                    .any(|entry| entry["aggregateType"] == "transfer")
        })
        .unwrap();
    let request: ProjectionRequest = serde_json::from_value(case["request"].clone()).unwrap();
    let before = serde_json::to_value(&request).unwrap();
    let actual = wimm_finance_core::project_month(request.clone(), "2099-12").unwrap();
    assert_eq!(
        serde_json::to_value(actual).unwrap(),
        serde_json::json!({"income":0,"expense":0,"net":0,"categories":[]})
    );
    assert_eq!(serde_json::to_value(&request).unwrap(), before);
    let mut broken = request.clone();
    broken
        .aggregates
        .retain(|entry| !matches!(entry, wimm_finance_types::models::Aggregate::Transaction(_)));
    assert!(wimm_finance_core::project_month(broken, "2099-12").is_err());
    assert!(wimm_finance_core::project_month(request, "ungültig").is_err());
}
