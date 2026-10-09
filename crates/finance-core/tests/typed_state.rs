// SPDX-License-Identifier: AGPL-3.0-or-later
#![forbid(unsafe_code)]
use serde_json::{Value, json};

#[test]
fn typed_state_actions_have_native_rust_assertions_for_all_representable_oracles() {
    let cases: Vec<Value> =
        serde_json::from_str(include_str!("fixtures/contract-catalog.json")).unwrap();
    let mut counts = [0, 0];
    for case in cases {
        let method = case["method"].as_str().unwrap();
        if !["project", "validate"].contains(&method) {
            continue;
        }
        let raw = case["request"]
            .as_str()
            .map(str::to_owned)
            .unwrap_or_else(|| case["request"].to_string());
        let output = if method == "project" {
            let Ok(request) = wimm_finance_core::decode_projection_request_v1(&raw) else { continue; };
            counts[0] += 1;
            wimm_finance_core::project(request).map(|projections| json!({"contractVersion":1,"status":"projected","projections":projections}))
        } else {
            let Ok(request) = wimm_finance_core::decode_validation_request_v1(&raw) else { continue; };
            counts[1] += 1;
            wimm_finance_core::validate(request).map(|()| json!({"contractVersion":1,"status":"valid"}))
        }.unwrap_or_else(|(code, message)| json!({"contractVersion":1,"status":"rejected","error":{"code":code,"message":message}}));
        assert_eq!(output, case["expected"], "{}", case["name"]);
    }
    assert_eq!(counts, [41, 46]);
}
