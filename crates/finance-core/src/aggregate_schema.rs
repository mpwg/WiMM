// SPDX-License-Identifier: AGPL-3.0-or-later
//! Strikter sprachneutraler Formvertrag für sämtliche vorhandenen Finanzaggregate.
use crate::{CoreResult, calendar};
use serde_json::Value;
pub const INVALID: (&str, &str) = (
    "INVALID_AGGREGATE",
    "Der Finanzbestand ist unvollständig oder widerspricht dem Fachvertrag.",
);
pub fn string(v: &Value) -> CoreResult<&str> {
    v.as_str().ok_or(INVALID)
}
pub fn array(v: &Value) -> CoreResult<&[Value]> {
    v.as_array().map(Vec::as_slice).ok_or(INVALID)
}
pub fn timestamp(s: &str) -> bool {
    let b = s.as_bytes();
    if !s.is_ascii()
        || b.len() < 17
        || b[10] != b'T'
        || b[13] != b':'
        || b.last() != Some(&b'Z')
        || calendar::parse_finance_date(&s[..10]).is_err()
    {
        return false;
    }
    if !b[11..13].iter().all(u8::is_ascii_digit)
        || !b[14..16].iter().all(u8::is_ascii_digit)
        || &s[11..13] > "23"
        || &s[14..16] > "59"
    {
        return false;
    }
    if b.len() == 17 {
        return false;
    }
    if b.len() < 20
        || b[16] != b':'
        || !b[17..19].iter().all(u8::is_ascii_digit)
        || &s[17..19] > "59"
    {
        return false;
    }
    b.len() == 20
        || (b.len() > 21 && b[19] == b'.' && b[20..b.len() - 1].iter().all(u8::is_ascii_digit))
}
pub fn js_space(c: char) -> bool {
    matches!(c, '\u{0009}'..='\u{000d}' | '\u{0020}' | '\u{00a0}' | '\u{1680}' | '\u{2000}'..='\u{200a}' | '\u{2028}' | '\u{2029}' | '\u{202f}' | '\u{205f}' | '\u{3000}' | '\u{feff}')
}
/// JSON ist ausschließlich die Formgrenze; keine zweite Laufzeitschemapflege.
pub fn aggregate(v: &Value) -> CoreResult<()> {
    crate::models::Aggregate::from_wire(v).map(|_| ())
}
pub fn command(v: &Value) -> CoreResult<()> {
    serde_json::from_value::<crate::models::Command>(v.clone())
        .map(|_| ())
        .map_err(|_| INVALID)
}
