// SPDX-License-Identifier: AGPL-3.0-or-later
#![forbid(unsafe_code)]
#[cfg(feature = "native")]
#[test]
fn native_v2_commands_and_v1_result_adapter_preserve_all_command_oracles() {
    use serde_json::Value;
    use wimm_finance_types::{ContractError, command_contracts::Request};
    let cases: Vec<Value> = serde_json::from_str(include_str!(
        "../../finance-core/tests/fixtures/contract-catalog.json"
    ))
    .unwrap();
    let mut count = 0;
    for case in cases {
        if case["method"] != "execute" {
            continue;
        }
        let raw = if let Some(raw) = case["request"].as_str() {
            raw.to_owned()
        } else {
            case["request"].to_string()
        };
        let mut request: Request = wimm_finance_core::decode_command_request_v1(&raw).unwrap();
        request.contract_version = 2.into();
        let output = match wimm_core_bindings::execute_v2(request)
            .and_then(|result| result.to_v1_json())
        {
            Ok(value) => serde_json::from_str::<Value>(&value).unwrap(),
            Err(ContractError::Rejected { code, detail }) => {
                serde_json::json!({"contractVersion":1,"status":"rejected","error":{"code":code,"message":detail}})
            }
        };
        assert_eq!(output, case["expected"], "{}", case["name"]);
        count += 1;
    }
    assert_eq!(count, 176);
}
