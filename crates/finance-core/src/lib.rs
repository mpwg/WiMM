// SPDX-License-Identifier: AGPL-3.0-or-later
//! Gemeinsamer Fachkern im Aufbau (K03/K04): keine UI, Datenbank, HTTP, Systemzeit oder Zufallsquelle.
//! Produktmigration sämtlicher vorhandener Regeln bleibt K04/K05.
#![forbid(unsafe_code)]
use serde::Deserialize;
use serde_json::{Value, json};
use uuid::Uuid;
mod aggregate_schema;
mod automation;
mod automation_commands;
pub mod command_contracts;
mod inverse;
mod typed_automation;
mod typed_automation_commands;
#[cfg(test)]
#[path = "../tests/support/v1_shape_reference.rs"]
mod v1_shape_reference;
pub use inverse::reverse_json;
pub mod calendar;
mod financial_commands;
mod master_commands;
mod payee_merge;
pub mod projection_cache;
mod projections;
mod reconciliation_commands;
mod references;
mod rule_reorder;
mod schedule_dates;
mod state_validation;
mod transfer_commands;
mod typed_financial;
pub use state_validation::{project_json, validate_json};
pub mod models;
pub mod money;
#[cfg(feature = "contract-probe")]
mod primitive_probe;
pub mod scalars;
#[cfg(feature = "contract-schema")]
pub mod schema;
#[cfg(feature = "contract-probe")]
pub use primitive_probe::primitive_json;

const MAX_SAFE: i64 = 9_007_199_254_740_991;

pub type CoreResult<T> = Result<T, (&'static str, &'static str)>;
fn rejection(code: &str, message: &str) -> Value {
    json!({"contractVersion":1,"status":"rejected","error":{"code":code,"message":message}})
}
fn decode(input: &str) -> CoreResult<Value> {
    let mut value: Value = serde_json::from_str(input)
        .map_err(|_| ("INVALID_COMMAND", "Der Fachbefehl ist ungültig."))?;
    normalize_json_integers(&mut value);
    if !value.is_object()
        || value.get("contractVersion").is_none()
        || value.get("domainSchemaVersion").is_none()
    {
        return Err(("INVALID_COMMAND", "Der Fachbefehl ist ungültig."));
    }
    if value["contractVersion"] != 1 || value["domainSchemaVersion"] != 1 {
        return Err((
            "UPDATE_REQUIRED",
            "Der Enginevertrag wird nicht unterstützt.",
        ));
    }
    Ok(value)
}
// JSON-Zahlen haben keine separate Integer-Syntax im sprachneutralen Vertrag.
// Nur Eingabevalidierung/Konvertierung, keine Gleitkomma-Geldberechnung.
fn normalize_json_integers(value: &mut Value) {
    match value {
        Value::Number(number) if number.is_f64() => {
            if let Some(n) = number.as_f64()
                && n.is_finite()
                && n.fract() == 0.0
                && n.abs() <= MAX_SAFE as f64
            {
                *value = json!(n as i64);
            }
        }
        Value::Array(values) => values.iter_mut().for_each(normalize_json_integers),
        Value::Object(values) => values.values_mut().for_each(normalize_json_integers),
        _ => {}
    }
}

fn output(result: CoreResult<Value>) -> String {
    match result {
        Ok(value) => value,
        Err((code, message)) => rejection(code, message),
    }
    .to_string()
}
fn valid_id(value: &str) -> bool {
    let b = value.as_bytes();
    b.len() == 36
        && b.iter().enumerate().all(|(n, c)| {
            if [8, 13, 18, 23].contains(&n) {
                *c == b'-'
            } else {
                c.is_ascii_hexdigit()
            }
        })
        && Uuid::parse_str(value).is_ok_and(|id| {
            id.is_nil()
                || id == Uuid::max()
                || (id.get_variant() == uuid::Variant::RFC4122
                    && (1..=8).contains(&id.get_version_num()))
        })
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct MoneyRequest {
    contract_version: u32,
    domain_schema_version: u32,
    space_id: String,
    calculation_type: String,
    text: String,
}

/// Exakte Dezimaltextverarbeitung; ausschließlich Integer, auch für Zwischenwerte.
pub fn parse_money(text: &str) -> CoreResult<i64> {
    const INVALID: (&str, &str) = (
        "INVALID_MONEY",
        "Der Geldbetrag muss ein Dezimaltext mit höchstens zwei Nachkommastellen sein.",
    );
    const OVERFLOW: (&str, &str) = (
        "MONEY_OVERFLOW",
        "Der Geldbetrag überschreitet den sicheren Centbereich.",
    );
    let (negative, digits) = if let Some(rest) = text.strip_prefix('-') {
        (true, rest)
    } else {
        (false, text.strip_prefix('+').unwrap_or(text))
    };
    let mut parts = digits.split([',', '.']);
    let whole = parts.next().unwrap_or_default();
    let fraction = parts.next();
    if whole.is_empty()
        || !whole.bytes().all(|byte| byte.is_ascii_digit())
        || parts.next().is_some()
        || fraction.is_some_and(|part| {
            part.is_empty() || part.len() > 2 || !part.bytes().all(|byte| byte.is_ascii_digit())
        })
    {
        return Err(INVALID);
    }
    let whole: i128 = whole.parse().map_err(|_| OVERFLOW)?;
    let fractional: i128 = match fraction {
        None => 0,
        Some(part) => {
            part.parse::<i128>().map_err(|_| INVALID)? * if part.len() == 1 { 10 } else { 1 }
        }
    };
    let magnitude = whole
        .checked_mul(100)
        .and_then(|value| value.checked_add(fractional))
        .ok_or(OVERFLOW)?;
    let cents = if negative { -magnitude } else { magnitude };
    if !(-(MAX_SAFE as i128)..=MAX_SAFE as i128).contains(&cents) {
        return Err(OVERFLOW);
    }
    Ok(cents as i64)
}

pub fn calculate_json(input: &str) -> String {
    output((|| {
        let decoded = decode(input)?;
        if ["rule.apply", "import.classify"]
            .contains(&decoded["calculationType"].as_str().unwrap_or(""))
        {
            return automation::calculate(decoded);
        }
        if decoded["calculationType"] == "schedule.dueDates" {
            return schedule_dates::calculate(decoded);
        }
        let request: MoneyRequest = serde_json::from_value(decoded)
            .map_err(|_| ("INVALID_COMMAND", "Der Fachbefehl ist ungültig."))?;
        if request.contract_version != 1
            || request.domain_schema_version != 1
            || request.calculation_type != "money.parse"
            || !valid_id(&request.space_id)
        {
            return Err(("INVALID_COMMAND", "Der Fachbefehl ist ungültig."));
        }
        Ok(json!({"contractVersion":1,"status":"money","value":parse_money(&request.text)?}))
    })())
}

/// Schrittweise portierte Fachhandler über K01; keine Persistenz oder Produktumschaltung.
pub fn execute_json(input: &str) -> String {
    output((|| {
        let decoded = decode(input)?;
        let current = aggregate_schema::array(&decoded["aggregates"])
            .map_err(|_| ("INVALID_COMMAND", "Der Fachbefehl ist ungültig."))?;
        for a in current {
            aggregate_schema::aggregate(a)
                .map_err(|_| ("INVALID_COMMAND", "Der Fachbefehl ist ungültig."))?;
        }
        aggregate_schema::command(&decoded["command"])
            .map_err(|_| ("INVALID_COMMAND", "Der Fachbefehl ist ungültig."))?;
        if [
            "rule.save",
            "rule.delete",
            "schedule.save",
            "schedule.confirm",
            "schedule.skip",
            "importMapping.save",
            "importBatch.save",
            "import.commit",
        ]
        .contains(&decoded["command"]["commandType"].as_str().unwrap_or(""))
        {
            return automation_commands::execute(decoded);
        }
        if decoded["command"]["commandType"] == "payee.merge" {
            return payee_merge::execute(decoded);
        }
        if ["reconciliation.confirm", "reconciliation.unlock"]
            .contains(&decoded["command"]["commandType"].as_str().unwrap_or(""))
        {
            return reconciliation_commands::execute(decoded);
        }
        if ["transfer.save", "transfer.delete"]
            .contains(&decoded["command"]["commandType"].as_str().unwrap_or(""))
        {
            return transfer_commands::execute(decoded);
        }
        if decoded["command"]["commandType"] == "account.save"
            && decoded["command"]["aggregates"]
                .as_array()
                .is_some_and(|a| a.len() == 2)
        {
            return financial_commands::execute(decoded);
        }
        if ["transaction.save", "transaction.delete"]
            .contains(&decoded["command"]["commandType"].as_str().unwrap_or(""))
        {
            return financial_commands::execute(decoded);
        }
        if [
            "account.save",
            "account.archive",
            "categoryGroup.save",
            "category.save",
            "category.archive",
            "payee.save",
        ]
        .contains(&decoded["command"]["commandType"].as_str().unwrap_or(""))
        {
            return master_commands::execute(decoded);
        }
        rule_reorder::execute(decoded)
    })())
}

/// Nur Technikharness: vollständige JSON-Felder verlustfrei über die Bindings transportieren.
#[cfg(feature = "contract-probe")]
pub fn roundtrip_json(input: &str) -> String {
    output(decode(input))
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn sichere_centgrenzen_und_dezimaltexte_sind_exakt() {
        assert_eq!(parse_money("90071992547409.91").unwrap(), MAX_SAFE);
        assert_eq!(parse_money("-90071992547409,91").unwrap(), -MAX_SAFE);
        assert_eq!(parse_money("+1,2").unwrap(), 120);
        assert_eq!(parse_money("-0").unwrap(), 0);
        assert_eq!(
            parse_money("90071992547409.92").unwrap_err().0,
            "MONEY_OVERFLOW"
        );
        assert_eq!(parse_money("1,234").unwrap_err().0, "INVALID_MONEY");
    }
    #[test]
    fn unbekannte_vertraege_erzeugen_keine_teilresultate() {
        let value: Value = serde_json::from_str(&execute_json(
            r#"{"contractVersion":999,"domainSchemaVersion":1}"#,
        ))
        .unwrap();
        assert_eq!(value["error"]["code"], "UPDATE_REQUIRED");
        assert!(value.get("changeSet").is_none());
    }
}
