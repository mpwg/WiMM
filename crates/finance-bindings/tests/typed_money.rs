// SPDX-License-Identifier: AGPL-3.0-or-later
#![forbid(unsafe_code)]
use serde_json::Value;
use wimm_core_bindings::{MoneyRequestV2, MoneyStatusV2, calculate_money_v2};

#[test]
fn typed_v2_and_explicit_v1_adapter_preserve_the_same_finance_oracle() {
    let cases: Vec<Value> = serde_json::from_str(include_str!("fixtures/money-v2.json")).unwrap();
    assert_eq!(cases.len(), 17);
    for case in cases {
        let wire = &case["request"];
        let request = MoneyRequestV2 {
            contract_version: wire["contractVersion"]
                .as_u64()
                .unwrap()
                .try_into()
                .unwrap(),
            domain_schema_version: wire["domainSchemaVersion"]
                .as_u64()
                .unwrap()
                .try_into()
                .unwrap(),
            space_id: wire["spaceId"].as_str().unwrap().into(),
            text: wire["text"].as_str().unwrap().into(),
        };
        let result = calculate_money_v2(request);
        assert_eq!(result.contract_version(), 2);
        let mut actual: Value = serde_json::from_str(&result.to_v1_json()).unwrap();
        actual["contractVersion"] = 2.into();
        assert_eq!(actual, case["expected"], "{}", case["name"]);
        match result.status() {
            MoneyStatusV2::Money => {
                assert!(result.value().is_some());
                assert!(result.error_code().is_none());
                assert!(result.message().is_none());
            }
            MoneyStatusV2::Rejected => {
                assert!(result.value().is_none());
                assert_eq!(
                    result.error_code().as_deref(),
                    case["expected"]["error"]["code"].as_str()
                );
                assert_eq!(
                    result.message().as_deref(),
                    case["expected"]["error"]["message"].as_str()
                );
                assert!(
                    !result
                        .message()
                        .unwrap()
                        .contains(wire["spaceId"].as_str().unwrap())
                );
            }
        }
        // Der V1-Adapter erhält die Ausgabeform und das historische Geldorakel.
        // Eine V2-inkompatible Requestversion wird nicht zu einem V1-Erfolg umgedeutet.
        if wire["contractVersion"] == 2 && wire["domainSchemaVersion"] == 1 {
            let legacy = wimm_core_bindings::calculate_json(
                serde_json::json!({
                    "contractVersion":1,"domainSchemaVersion":1,"spaceId":wire["spaceId"],
                    "calculationType":"money.parse","text":wire["text"]
                })
                .to_string(),
            );
            assert_eq!(
                serde_json::from_str::<Value>(&legacy).unwrap(),
                serde_json::from_str::<Value>(&result.to_v1_json()).unwrap(),
                "{}",
                case["name"]
            );
        }
    }
}
