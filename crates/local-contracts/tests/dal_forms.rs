// SPDX-License-Identifier: AGPL-3.0-or-later
#![forbid(unsafe_code)]
use serde_json::Value;
#[test]
fn dal02_forms_preserve_versions_failures_identity_and_bounded_queries() {
    use wimm_local_contracts::{commit::*, index_ports::*};
    let cases: Vec<Value> = serde_json::from_str(include_str!("fixtures/dal-forms.json")).unwrap();
    for case in &cases {
        let input = case["value"].clone();
        let valid = match case["schema"].as_str().unwrap() {
            "local-operation-identity" => {
                serde_json::from_value::<LocalOperationIdentity>(input).is_ok()
            }
            "local-commit-request" => serde_json::from_value::<LocalCommitRequest>(input).is_ok(),
            "local-commit-receipt" => serde_json::from_value::<LocalCommitReceipt>(input).is_ok(),
            "local-commit-result" => serde_json::from_value::<LocalCommitOutcome>(input).is_ok(),
            "local-index-transaction" => {
                serde_json::from_value::<TransactionIndexQuery>(input).is_ok()
            }
            "local-index-pending" => serde_json::from_value::<PendingIndexQuery>(input).is_ok(),
            "local-index-import-source" => {
                serde_json::from_value::<ImportSourceQuery>(input).is_ok()
            }
            _ => panic!("Unbekannte Orakelform"),
        };
        assert_eq!(valid, case["valid"].as_bool().unwrap(), "{}", case["name"]);
    }
    assert_eq!(cases.len(), 28);
}
