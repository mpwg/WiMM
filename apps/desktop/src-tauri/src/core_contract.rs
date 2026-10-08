// SPDX-License-Identifier: AGPL-3.0-or-later
// Direkter Aufruf aus dem tatsächlichen Tauri-Appcrate; keine Produktumschaltung.
#[test]
fn tauri_appcrate_ruft_den_plattformfreien_kern_direkt_auf() {
    let input = serde_json::json!({"contractVersion":1,"domainSchemaVersion":1,"spaceId":"30000000-0000-4000-8000-000000000001","calculationType":"money.parse","text":"90071992547409.91"});
    let result: serde_json::Value =
        serde_json::from_str(&wimm_finance_core::calculate_json(&input.to_string())).unwrap();
    assert_eq!(result["status"], "money");
    assert_eq!(result["value"], 9_007_199_254_740_991_i64);
    let mut invalid = input.clone();
    invalid["text"] = serde_json::json!("90071992547409.92");
    let invalid: serde_json::Value =
        serde_json::from_str(&wimm_finance_core::calculate_json(&invalid.to_string())).unwrap();
    assert_eq!(invalid["error"]["code"], "MONEY_OVERFLOW");
}
