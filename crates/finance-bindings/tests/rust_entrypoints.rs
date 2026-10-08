// SPDX-License-Identifier: AGPL-3.0-or-later
#![forbid(unsafe_code)]
use serde_json::{Value, json};
#[test]
fn bindings_geben_strukturierte_fehler_an_allen_produktiven_rusteinstiegen_zurueck() {
    for call in [
        wimm_core_bindings::execute_json,
        wimm_core_bindings::calculate_json,
        wimm_core_bindings::validate_json,
        wimm_core_bindings::project_json,
    ] {
        let result = call(r#"{"contractVersion":999,"domainSchemaVersion":1}"#.to_string());
        let parsed: Value = serde_json::from_str(&result).unwrap();
        assert_eq!(
            parsed,
            json!({"contractVersion":1,"status":"rejected","error":{"code":"UPDATE_REQUIRED","message":"Der Enginevertrag wird nicht unterstützt."}})
        );
        let result = call("{beschädigt".to_string());
        assert!(result.contains("INVALID_COMMAND"));
        assert!(!result.contains("beschädigt"));
    }
}
#[test]
fn bindings_erhalten_die_sichere_centgrenze_und_leeren_bestaende() {
    let scope = "30000000-0000-4000-8000-000000000001";
    let result = wimm_core_bindings::calculate_json(format!(
        r#"{{"contractVersion":1,"domainSchemaVersion":1,"spaceId":"{scope}","calculationType":"money.parse","text":"90071992547409.91"}}"#
    ));
    assert_eq!(
        serde_json::from_str::<Value>(&result).unwrap(),
        json!({"contractVersion":1,"status":"money","value":9007199254740991_i64})
    );
    let state = format!(
        r#"{{"contractVersion":1,"domainSchemaVersion":1,"spaceId":"{scope}","aggregates":[]}}"#
    );
    let projected: Value = serde_json::from_str(&wimm_core_bindings::project_json(state)).unwrap();
    assert_eq!(
        projected,
        json!({"contractVersion":1,"status":"projected","projections":{"accountBalances":[],"consumption":{"categories":[],"expense":0,"income":0,"net":0}}})
    );
}
