// SPDX-License-Identifier: AGPL-3.0-or-later
//! Gregorischer Kalender ohne Systemzeit oder Zeitzone; einschließlich Jahr 0000.
use crate::CoreResult;
fn digits(bytes: &[u8]) -> bool {
    bytes.iter().all(u8::is_ascii_digit)
}
pub fn parse_finance_date(text: &str) -> CoreResult<&str> {
    let invalid = (
        "INVALID_DATE",
        "Das Finanzdatum muss ein gültiger Kalendertag im Format YYYY-MM-DD sein.",
    );
    let b = text.as_bytes();
    if b.len() != 10
        || b[4] != b'-'
        || b[7] != b'-'
        || !digits(&b[..4])
        || !digits(&b[5..7])
        || !digits(&b[8..])
    {
        return Err(invalid);
    }
    let year: u32 = text[..4].parse().map_err(|_| invalid)?;
    let month: u32 = text[5..7].parse().map_err(|_| invalid)?;
    let day: u32 = text[8..].parse().map_err(|_| invalid)?;
    let leap = year.is_multiple_of(4) && (!year.is_multiple_of(100) || year.is_multiple_of(400));
    let days = match month {
        2 => {
            if leap {
                29
            } else {
                28
            }
        }
        4 | 6 | 9 | 11 => 30,
        1..=12 => 31,
        _ => return Err(invalid),
    };
    if day == 0 || day > days {
        return Err(invalid);
    }
    Ok(text)
}
pub fn parse_year_month(text: &str) -> CoreResult<&str> {
    let invalid = ("INVALID_MONTH", "Der Monatsschlüssel muss YYYY-MM sein.");
    let b = text.as_bytes();
    if b.len() != 7 || b[4] != b'-' || !digits(&b[..4]) || !digits(&b[5..]) {
        return Err(invalid);
    }
    let month: u32 = text[5..].parse().map_err(|_| invalid)?;
    if !(1..=12).contains(&month) {
        return Err(invalid);
    }
    Ok(text)
}
pub fn month_of(date: &str) -> CoreResult<&str> {
    parse_finance_date(date)?;
    parse_year_month(&date[..7])
}
