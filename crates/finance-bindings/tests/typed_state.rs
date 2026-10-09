// SPDX-License-Identifier: AGPL-3.0-or-later
#![forbid(unsafe_code)]
#[cfg(feature = "native")]
#[test]
fn typed_state_actions_preserve_all_121_catalog_oracles() {
    use serde_json::{Value, json};
    use wimm_finance_types::ContractError;
    let cases: Vec<Value> = serde_json::from_str(include_str!(
        "../../finance-core/tests/fixtures/contract-catalog.json"
    ))
    .unwrap();
    let mut counts = [0, 0, 0];
    let mut typed_counts = [0, 0, 0];
    for case in cases {
        let method = case["method"].as_str().unwrap();
        if !["project", "validate", "reverse"].contains(&method) {
            continue;
        }
        let raw = case["request"]
            .as_str()
            .map(str::to_owned)
            .unwrap_or_else(|| case["request"].to_string());
        let result: Result<Value, ContractError> = if method == "project" {
            counts[0] += 1;
            wimm_finance_core::decode_projection_request_v1(&raw)
                .map_err(ContractError::from)
                .and_then(|mut request| {
                    typed_counts[0] += 1;
                    request.contract_version = 2.into();
                    wimm_core_bindings::project_v2(request)
                        .map(|result| serde_json::to_value(result).unwrap())
                })
        } else if method == "validate" {
            counts[1] += 1;
            wimm_finance_core::decode_validation_request_v1(&raw)
                .map_err(ContractError::from)
                .and_then(|mut request| {
                    typed_counts[1] += 1;
                    request.set_binding_version(2);
                    wimm_core_bindings::validate_v2(request)
                        .map(|result| serde_json::to_value(result).unwrap())
                })
        } else {
            counts[2] += 1;
            wimm_finance_core::decode_reverse_request_v1(&raw)
                .map_err(ContractError::from)
                .and_then(|mut request| {
                    typed_counts[2] += 1;
                    request.contract_version = 2.into();
                    wimm_core_bindings::reverse_v2(request)
                        .and_then(|outcome| outcome.to_v1_json())
                        .map(|wire| {
                            let mut value: Value = serde_json::from_str(&wire).unwrap();
                            value["contractVersion"] = 2.into();
                            value
                        })
                })
        };
        let output = match result {
            Ok(mut value) => {
                assert_eq!(value["contractVersion"], 2);
                value["contractVersion"] = 1.into();
                value
            }
            Err(ContractError::Rejected {
                contract_version,
                code,
                detail,
            }) => {
                assert_eq!(contract_version, 2);
                json!({"contractVersion":1,"status":"rejected","error":{"code":code,"message":detail}})
            }
        };
        assert_eq!(output, case["expected"], "{}", case["name"]);
    }
    assert_eq!(counts, [50, 60, 11]);
    assert_eq!(typed_counts, [41, 46, 11]);
}
