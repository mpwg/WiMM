// SPDX-License-Identifier: AGPL-3.0-or-later
//! Ausschließlich Testbrücke: keine zusätzliche Produkt-Bindingoperation.
use crate::{CoreResult, calendar, decode, money, output};
use serde_json::{Value, json};
fn integer(value: &Value, message: &'static str) -> CoreResult<i64> {
    value.as_i64().ok_or(("INVALID_SAFE_INTEGER", message))
}
fn text(value: &Value) -> CoreResult<&str> {
    value
        .as_str()
        .ok_or(("INVALID_COMMAND", "Der Fachbefehl ist ungültig."))
}
pub fn primitive_json(input: &str) -> String {
    output((|| {
        let request = decode(input)?;
        let args = request["args"]
            .as_array()
            .ok_or(("INVALID_COMMAND", "Der Fachbefehl ist ungültig."))?;
        let at = |n: usize| args.get(n).unwrap_or(&Value::Null);
        let amount = |n| {
            integer(
                at(n),
                "Der Geldbetrag muss ein sicherer ganzzahliger Centbetrag sein.",
            )
        };
        let result = match request["primitive"].as_str() {
            Some("money.assert") => json!(money::assert_money(amount(0)?)?),
            Some("money.sum") => {
                let values = at(0)
                    .as_array()
                    .ok_or(("INVALID_COMMAND", "Der Fachbefehl ist ungültig."))?;
                let values = values
                    .iter()
                    .map(|v| {
                        integer(
                            v,
                            "Die Geldsumme muss ein sicherer ganzzahliger Centbetrag sein.",
                        )
                    })
                    .collect::<CoreResult<Vec<_>>>()?;
                json!(money::sum_money(&values)?)
            }
            Some("money.subtract") => json!(money::subtract_money(
                integer(
                    at(0),
                    "Der linke Geldbetrag muss ein sicherer ganzzahliger Centbetrag sein."
                )?,
                integer(
                    at(1),
                    "Der rechte Geldbetrag muss ein sicherer ganzzahliger Centbetrag sein."
                )?
            )?),
            Some("money.multiply") => json!(money::multiply_money(
                amount(0)?,
                integer(
                    at(1),
                    "Der Gewichtungsfaktor muss eine sichere Ganzzahl sein."
                )?
            )?),
            Some("money.divide") => json!(money::multiply_divide_money(
                amount(0)?,
                integer(
                    at(1),
                    "Der Gewichtungszähler muss eine sichere Ganzzahl sein."
                )?,
                integer(
                    at(2),
                    "Der Gewichtungsnenner muss eine sichere Ganzzahl sein."
                )?
            )?),
            Some("money.decimal") => json!(money::money_decimal(amount(0)?)?),
            Some("money.directed") => {
                let direction = text(at(1))?;
                if !["income", "expense"].contains(&direction) {
                    return Err(("INVALID_COMMAND", "Der Fachbefehl ist ungültig."));
                }
                json!(money::parse_directed_money(
                    text(at(0))?,
                    direction == "expense"
                )?)
            }
            Some("calendar.date") => json!(calendar::parse_finance_date(text(at(0))?)?),
            Some("calendar.month") => json!(calendar::parse_year_month(text(at(0))?)?),
            Some("calendar.monthOf") => json!(calendar::month_of(text(at(0))?)?),
            _ => return Err(("INVALID_COMMAND", "Der Fachbefehl ist ungültig.")),
        };
        Ok(json!({"contractVersion":1,"status":"primitive","value":result}))
    })())
}
