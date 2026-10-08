// SPDX-License-Identifier: AGPL-3.0-or-later
#![forbid(unsafe_code)]
use serde::Deserialize;
use serde_json::Value;
#[derive(Deserialize)]
struct Case {
    name: String,
    method: String,
    request: Value,
    expected: Value,
}
fn cases() -> Vec<Case> {
    serde_json::from_str(include_str!("fixtures/contract-catalog.json"))
        .expect("Der gesperrte synthetische Fachkatalog ist beschädigt")
}
fn wire(request: &Value) -> String {
    request
        .as_str()
        .map_or_else(|| request.to_string(), str::to_owned)
}
#[test]
fn produktive_fachvertraege_entsprechen_dem_gesperrten_referenzkatalog() {
    let mut count = 0;
    for case in cases() {
        let input = wire(&case.request);
        let result = match case.method.as_str() {
            "reverse" => wimm_finance_core::reverse_json(&input),
            "execute" => wimm_finance_core::execute_json(&input),
            "calculate" => wimm_finance_core::calculate_json(&input),
            "validate" => wimm_finance_core::validate_json(&input),
            "project" => wimm_finance_core::project_json(&input),
            "primitive" | "roundtrip" | "cache" => continue,
            _ => panic!("Unbekannte Aktion im Referenzkatalog"),
        };
        let actual: Value = serde_json::from_str(&result).expect("Ungültiges JSON-Ergebnis");
        assert_eq!(actual, case.expected, "{}", case.name);
        count += 1;
    }
    assert!(
        count >= 250,
        "Der vollständige produktive Fachkatalog fehlt"
    );
}
#[cfg(feature = "contract-probe")]
#[test]
fn technische_primitiv_und_feldtransportfaelle_entsprechen_dem_referenzkatalog() {
    let mut count = 0;
    for case in cases() {
        let input = wire(&case.request);
        let result = match case.method.as_str() {
            "cache" => wimm_finance_core::projection_cache::cache_json(&input),
            "primitive" => wimm_finance_core::primitive_json(&input),
            "roundtrip" => wimm_finance_core::roundtrip_json(&input),
            _ => continue,
        };
        let actual: Value = serde_json::from_str(&result).expect("Ungültiges JSON-Ergebnis");
        assert_eq!(actual, case.expected, "{}", case.name);
        count += 1;
    }
    assert!(count >= 80, "Der Primitivekatalog fehlt");
}
#[test]
fn geldarithmetik_prueft_sichere_grenzen_und_jeden_zwischenwert() {
    use wimm_finance_core::money::*;
    let max = 9_007_199_254_740_991;
    assert_eq!(sum_money(&[max, -max]).unwrap(), 0);
    assert_eq!(sum_money(&[max, 1, -1]).unwrap_err().0, "MONEY_OVERFLOW");
    assert_eq!(sum_money(&[max + 1]).unwrap_err().0, "INVALID_SAFE_INTEGER");
    assert_eq!(multiply_divide_money(-1001, 1, 2).unwrap(), -500);
    assert_eq!(multiply_divide_money(max, max, max).unwrap(), max);
    assert_eq!(
        multiply_divide_money(max, 2, 1).unwrap_err().0,
        "MONEY_OVERFLOW"
    );
    assert_eq!(
        multiply_divide_money(100, 1, 0).unwrap_err().0,
        "INVALID_DIVISOR"
    );
    assert_eq!(subtract_money(-max, 1).unwrap_err().0, "MONEY_OVERFLOW");
    assert_eq!(money_decimal(-max).unwrap(), "-90071992547409.91");
    assert_eq!(parse_directed_money("-12,34", false).unwrap(), 1234);
}
#[test]
fn kalender_ist_gregorianisch_und_unabhaengig_von_systemzeit() {
    use wimm_finance_core::calendar::*;
    for date in ["0000-02-29", "2000-02-29", "2028-02-29", "9999-12-31"] {
        assert_eq!(parse_finance_date(date).unwrap(), date);
    }
    for date in ["1900-02-29", "2100-02-29", "2028-04-31", "２０２８-02-29"] {
        assert_eq!(parse_finance_date(date).unwrap_err().0, "INVALID_DATE");
    }
    assert_eq!(month_of("2028-02-29").unwrap(), "2028-02");
    assert_eq!(parse_year_month("2028-13").unwrap_err().0, "INVALID_MONTH");
}
