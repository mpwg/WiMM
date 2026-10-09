// SPDX-License-Identifier: AGPL-3.0-or-later
//! Fälligkeiten aus dem gregorianischen Kalender, ohne Uhr oder Zeitzone.
use crate::{CoreResult, MAX_SAFE, aggregate_schema, calendar};
use wimm_finance_types::calculation_contracts::{CalculationOutcome, ScheduleRequest};
fn days(year: i128, month: i128) -> i128 {
    match month {
        2 => {
            if year % 4 == 0 && (year % 100 != 0 || year % 400 == 0) {
                29
            } else {
                28
            }
        }
        4 | 6 | 9 | 11 => 30,
        _ => 31,
    }
}
fn before_year(year: i128) -> i128 {
    365 * year + (year + 3) / 4 - (year + 99) / 100 + (year + 399) / 400
}
fn ordinal(year: i128, month: i128, day: i128) -> i128 {
    before_year(year) + (1..month).map(|m| days(year, m)).sum::<i128>() + day - 1
}
fn from_ordinal(n: i128) -> Option<String> {
    if n < 0 || n >= before_year(10000) {
        return None;
    }
    let (mut low, mut high) = (0, 10000);
    while low + 1 < high {
        let mid = (low + high) / 2;
        if before_year(mid) <= n {
            low = mid;
        } else {
            high = mid;
        }
    }
    let mut rest = n - before_year(low);
    let mut month = 1;
    while rest >= days(low, month) {
        rest -= days(low, month);
        month += 1;
    }
    Some(format!("{low:04}-{month:02}-{:02}", rest + 1))
}
pub(crate) fn typed_due_dates(
    schedule: &crate::models::Schedule,
    through: &str,
) -> CoreResult<Vec<String>> {
    let start = schedule.start_date.as_str();
    calendar::parse_finance_date(through)?;
    let interval = schedule.interval.value() as i128;
    let end = schedule.end_date.as_ref().map(|d| d.as_str());
    if end.is_some_and(|end| end < start) {
        return Err(("INVALID_COMMAND", "Das Enddatum liegt vor dem Startdatum."));
    }
    if !schedule.enabled {
        return Ok(vec![]);
    }
    let year: i128 = start[..4].parse().map_err(|_| aggregate_schema::INVALID)?;
    let month: i128 = start[5..7].parse().map_err(|_| aggregate_schema::INVALID)?;
    let day: i128 = start[8..].parse().map_err(|_| aggregate_schema::INVALID)?;
    let mut dates = vec![];
    for index in 0..=100000_i128 {
        let delta = index * interval;
        if delta > MAX_SAFE as i128 {
            return Err((
                "INVALID_COMMAND",
                "Das Intervall überschreitet die Ganzzahlgrenze.",
            ));
        }
        let date = if schedule.frequency == crate::models::Frequency::Weekly {
            from_ordinal(ordinal(year, month, day) + delta * 7)
        } else {
            let target = month - 1
                + if schedule.frequency == crate::models::Frequency::Monthly {
                    delta
                } else {
                    delta * 12
                };
            let y = year + target / 12;
            let m = target % 12 + 1;
            if y > 9999 {
                None
            } else {
                Some(format!("{y:04}-{m:02}-{:02}", day.min(days(y, m))))
            }
        };
        let Some(date) = date else {
            break;
        };
        if date.as_str() > through || end.is_some_and(|end| date.as_str() > end) {
            break;
        }
        if index == 100000 {
            return Err(("INVALID_COMMAND", "Zu viele Fälligkeiten."));
        }
        dates.push(date);
    }
    Ok(dates)
}
pub fn calculate(request: ScheduleRequest) -> CoreResult<CalculationOutcome> {
    const INVALID: (&str, &str) = ("INVALID_COMMAND", "Der Fachbefehl ist ungültig.");
    if request.contract_version != 1 || request.domain_schema_version != 1 {
        return Err(INVALID);
    }
    let schedule = request
        .aggregates
        .iter()
        .find_map(|a| {
            if let crate::models::Aggregate::Schedule(schedule) = a
                && schedule.id == request.schedule_id
                && schedule.space_id == request.space_id
            {
                Some(schedule)
            } else {
                None
            }
        })
        .ok_or((
            "INVALID_AGGREGATE",
            "Die Dauerzahlung fehlt im aktuellen Bereich.",
        ))?;
    Ok(CalculationOutcome::DueDates {
        contract_version: 1,
        dates: typed_due_dates(schedule, request.through.as_str())?
            .into_iter()
            .map(crate::scalars::FinanceDate::new)
            .collect::<CoreResult<_>>()?,
    })
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn wochentage_werden_ueber_jahrhundertgrenzen_exakt_abgeleitet() {
        assert_eq!(from_ordinal(ordinal(0, 2, 28) + 1).unwrap(), "0000-02-29");
        assert_eq!(
            from_ordinal(ordinal(1900, 2, 28) + 1).unwrap(),
            "1900-03-01"
        );
        assert_eq!(
            from_ordinal(ordinal(2000, 2, 28) + 1).unwrap(),
            "2000-02-29"
        );
        assert_eq!(from_ordinal(ordinal(9999, 12, 31) + 1), None);
    }
}
