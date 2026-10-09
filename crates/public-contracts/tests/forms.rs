// SPDX-License-Identifier: AGPL-3.0-or-later
#![forbid(unsafe_code)]
use wimm_public_contracts::{
    Validate,
    envelopes::{EncryptedOperation, SignedKeyRoster},
};
#[test]
fn native_public_forms_preserve_the_shared_structural_and_relational_oracles() {
    let catalog: serde_json::Value =
        serde_json::from_str(include_str!("fixtures/public-forms.json")).unwrap();
    assert_eq!(catalog["synthetic"], true);
    let cases = catalog["cases"].as_array().unwrap();
    assert_eq!(cases.len(), 42);
    for case in cases {
        let valid = match case["action"].as_str().unwrap() {
            "operation" => serde_json::from_value::<EncryptedOperation>(case["request"].clone())
                .is_ok_and(|v| v.validate().is_ok()),
            "roster" => serde_json::from_value::<SignedKeyRoster>(case["request"].clone())
                .is_ok_and(|v| v.validate().is_ok()),
            _ => panic!("Unbekannte synthetische Form."),
        };
        assert_eq!(valid, case["valid"].as_bool().unwrap(), "{}", case["name"]);
    }
}
