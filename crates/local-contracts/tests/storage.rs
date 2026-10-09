// SPDX-License-Identifier: AGPL-3.0-or-later
#![forbid(unsafe_code)]
#[test]
fn flat_stored_aggregate_roundtrips_all_fourteen_kinds_without_changing_fields() {
    use serde_json::Value;
    use std::collections::BTreeSet;
    let catalog: Vec<Value> = serde_json::from_str(include_str!(
        "../../finance-core/tests/fixtures/contract-catalog.json"
    ))
    .unwrap();
    let mut kinds = BTreeSet::new();
    for c in catalog {
        for a in c["request"]["aggregates"].as_array().into_iter().flatten() {
            if serde_json::from_value::<wimm_finance_types::models::Aggregate>(a.clone()).is_err() {
                continue;
            }
            let mut stored = a.clone();
            stored["handle"] = stored["id"].clone();
            let decoded: wimm_local_contracts::storage::StoredAggregate =
                serde_json::from_value(stored.clone()).unwrap();
            assert_eq!(serde_json::to_value(decoded).unwrap(), stored);
            kinds.insert(stored["aggregateType"].as_str().unwrap().to_owned());
        }
    }
    assert_eq!(kinds.len(), 14);
}
#[test]
fn all_local_snapshot_oracles_preserve_flat_wire_and_opaque_original_drafts() {
    let catalog: serde_json::Value =
        serde_json::from_str(include_str!("fixtures/snapshot-forms.json")).unwrap();
    let cases = catalog["cases"].as_array().unwrap();
    assert_eq!(cases.len(), 40);
    for c in cases {
        let result =
            wimm_local_contracts::storage_api::snapshot_from_v1_json(&c["request"].to_string());
        assert_eq!(
            result.is_ok(),
            c["valid"].as_bool().unwrap(),
            "{}: {result:?}",
            c["name"]
        );
        if let Ok(snapshot) = result {
            assert_eq!(
                serde_json::from_str::<serde_json::Value>(
                    &wimm_local_contracts::storage_api::snapshot_to_v1_json(snapshot).unwrap()
                )
                .unwrap(),
                c["request"],
                "{}",
                c["name"]
            );
        }
    }
}
#[test]
fn local_port_requests_cover_all_eleven_existing_storage_methods() {
    let catalog: serde_json::Value =
        serde_json::from_str(include_str!("fixtures/port-forms.json")).unwrap();
    let mut accepted = 0;
    for c in catalog["cases"].as_array().unwrap() {
        let result = serde_json::from_value::<wimm_local_contracts::storage::LocalPortRequestV2>(
            c["request"].clone(),
        )
        .ok()
        .is_some_and(|r| wimm_local_contracts::storage_api::check_port(r).is_ok());
        assert_eq!(result, c["valid"].as_bool().unwrap(), "{}", c["name"]);
        if result {
            accepted += 1;
        }
    }
    assert_eq!(accepted, 11);
}
