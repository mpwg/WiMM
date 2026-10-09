// SPDX-License-Identifier: AGPL-3.0-or-later
#![forbid(unsafe_code)]
use serde_json::{Value, json};
use wimm_finance_core::command_contracts::Request;

#[test]
fn direct_typed_commands_match_the_unchanged_wire_oracle() {
    let cases: Vec<Value> =
        serde_json::from_str(include_str!("fixtures/contract-catalog.json")).unwrap();
    let mut typed_count = 0;
    let mut covered = std::collections::BTreeSet::new();
    for case in cases {
        if case["method"] != "execute" {
            continue;
        }
        let input = if let Some(raw) = case["request"].as_str() {
            raw.to_owned()
        } else {
            case["request"].to_string()
        };
        let Ok(request) = serde_json::from_str::<Request>(&input) else {
            // Nicht konstruierbare Formnegativfälle bleiben am V1-Einstieg geprüft.
            continue;
        };
        let command = serde_json::to_value(&request.command).unwrap();
        covered.insert(command["commandType"].as_str().unwrap().to_owned());
        let actual = match wimm_finance_core::execute(request).and_then(|result| result.to_wire()) {
            Ok(result) => result,
            Err((code, message)) => {
                json!({"contractVersion":1,"status":"rejected","error":{"code":code,"message":message}})
            }
        };
        assert_eq!(actual, case["expected"], "{}", case["name"]);
        typed_count += 1;
    }
    assert_eq!(
        typed_count, 176,
        "Der vollständige konstruierbare Befehlsabschnitt des gesperrten Katalogs fehlt"
    );
    assert_eq!(
        covered.len(),
        22,
        "Nicht alle bestehenden Befehlsarten geprüft: {covered:?}"
    );
    println!(
        "{typed_count} konstruierbare Referenzfälle und alle 22 Befehlsarten direkt typisiert geprüft."
    );
}
