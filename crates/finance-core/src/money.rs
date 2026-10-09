// SPDX-License-Identifier: AGPL-3.0-or-later
//! Ganze Cent mit geprüften Eingaben und exakten i128-Zwischenwerten.
use crate::{CoreResult, MAX_SAFE};

pub fn assert_money(value: i64) -> CoreResult<i64> {
    crate::scalars::MoneyCents::new(value).map(crate::scalars::MoneyCents::cents)
}
fn safe_integer(value: i64, message: &'static str) -> CoreResult<i64> {
    if !(-MAX_SAFE..=MAX_SAFE).contains(&value) {
        Err(("INVALID_SAFE_INTEGER", message))
    } else {
        Ok(value)
    }
}
fn range(value: i128, message: &'static str) -> CoreResult<i64> {
    if !(-(MAX_SAFE as i128)..=MAX_SAFE as i128).contains(&value) {
        Err(("MONEY_OVERFLOW", message))
    } else {
        Ok(value as i64)
    }
}
pub fn sum_money(values: &[i64]) -> CoreResult<i64> {
    let mut sum = 0i64;
    for &value in values {
        safe_integer(
            value,
            "Die Geldsumme muss ein sicherer ganzzahliger Centbetrag sein.",
        )?;
        sum = range(
            sum as i128 + value as i128,
            "Die Geldsumme überschreitet den sicheren Centbereich.",
        )?;
    }
    Ok(sum)
}
pub fn subtract_money(left: i64, right: i64) -> CoreResult<i64> {
    safe_integer(
        left,
        "Der linke Geldbetrag muss ein sicherer ganzzahliger Centbetrag sein.",
    )?;
    safe_integer(
        right,
        "Der rechte Geldbetrag muss ein sicherer ganzzahliger Centbetrag sein.",
    )?;
    range(
        left as i128 - right as i128,
        "Die Gelddifferenz überschreitet den sicheren Centbereich.",
    )
}
pub fn multiply_money(amount: i64, factor: i64) -> CoreResult<i64> {
    assert_money(amount)?;
    safe_integer(
        factor,
        "Der Gewichtungsfaktor muss eine sichere Ganzzahl sein.",
    )?;
    range(
        amount as i128 * factor as i128,
        "Das Gewichtsergebnis überschreitet den sicheren Centbereich.",
    )
}
pub fn multiply_divide_money(amount: i64, numerator: i64, denominator: i64) -> CoreResult<i64> {
    assert_money(amount)?;
    safe_integer(
        numerator,
        "Der Gewichtungszähler muss eine sichere Ganzzahl sein.",
    )?;
    safe_integer(
        denominator,
        "Der Gewichtungsnenner muss eine sichere Ganzzahl sein.",
    )?;
    if denominator <= 0 {
        return Err((
            "INVALID_DIVISOR",
            "Der Gewichtungsnenner muss größer als null sein.",
        ));
    }
    range(
        (amount as i128 * numerator as i128) / denominator as i128,
        "Der gewichtete Geldanteil überschreitet den sicheren Centbereich.",
    )
}
pub fn money_decimal(value: i64) -> CoreResult<String> {
    assert_money(value)?;
    let absolute = value.abs();
    Ok(format!(
        "{}{}.{:02}",
        if value < 0 { "-" } else { "" },
        absolute / 100,
        absolute % 100
    ))
}
pub fn parse_directed_money(text: &str, expense: bool) -> CoreResult<i64> {
    // Dasselbe Parsing mit dem verbindlichen Feldnamen des gerichteten Betrags.
    let amount = crate::parse_money(text).map_err(|(code, _)| {
        (
            code,
            if code == "INVALID_MONEY" {
                "Der Betrag muss ein Dezimaltext mit höchstens zwei Nachkommastellen sein."
            } else {
                "Der Betrag überschreitet den sicheren Centbereich."
            },
        )
    })?;
    Ok(if expense { -amount.abs() } else { amount.abs() })
}
