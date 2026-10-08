// SPDX-License-Identifier: AGPL-3.0-or-later
//! Strikter sprachneutraler Formvertrag für sämtliche vorhandenen Finanzaggregate.
use crate::{CoreResult, MAX_SAFE, calendar, valid_id};
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
pub fn integer(v: &Value) -> CoreResult<i64> {
    v.as_i64()
        .filter(|n| (-MAX_SAFE..=MAX_SAFE).contains(n))
        .ok_or(INVALID)
}
pub fn kind(v: &Value) -> &str {
    v["aggregateType"].as_str().unwrap_or("")
}
pub fn live(v: &Value) -> bool {
    v.get("deletedAt").is_none()
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
fn shape(v: &Value, fields: &[(&str, &str)], optional: &[(&str, &str)]) -> CoreResult<()> {
    let obj = v.as_object().ok_or(INVALID)?;
    if obj
        .keys()
        .any(|k| !fields.iter().chain(optional).any(|(name, _)| name == k))
    {
        return Err(INVALID);
    }
    for (name, ty) in fields {
        value(obj.get(*name).ok_or(INVALID)?, ty)?;
    }
    for (name, ty) in optional {
        if let Some(v) = obj.get(*name) {
            value(v, ty)?;
        }
    }
    Ok(())
}
fn value(v: &Value, ty: &str) -> CoreResult<()> {
    let valid = match ty {
        "string" => v.is_string(),
        "text" => v
            .as_str()
            .is_some_and(|s| !s.trim_matches(js_space).is_empty()),
        "uuid" => v.as_str().is_some_and(valid_id),
        "time" => v.as_str().is_some_and(timestamp),
        "date" => v
            .as_str()
            .is_some_and(|s| calendar::parse_finance_date(s).is_ok()),
        "money" => integer(v).is_ok(),
        "ordinal" => integer(v).is_ok_and(|n| n >= 0),
        "positive" => integer(v).is_ok_and(|n| n > 0),
        "bool" => v.is_boolean(),
        "json" => true,
        "hash" => v.as_str().is_some_and(|s| {
            s.len() == 64
                && s.bytes()
                    .all(|b| b.is_ascii_digit() || (b'a'..=b'f').contains(&b))
        }),
        "split" => shape(
            v,
            &[("id", "uuid"), ("categoryId", "uuid"), ("amount", "money")],
            &[],
        )
        .is_ok(),
        "candidate" => candidate(v).is_ok(),
        "nullableCandidate" => v.is_null() || candidate(v).is_ok(),
        "row" => shape(
            v,
            &[
                ("sourceRow", "positive"),
                ("candidate", "nullableCandidate"),
                ("decision", "import|exclude|separate"),
                ("issues", "[string]"),
            ],
            &[],
        )
        .is_ok(),
        "condition" => shape(
            v,
            &[
                ("field", "date|amount|payee|memo"),
                ("operator", "equals|contains|gte|lte"),
                ("value", "stringOrMoney"),
            ],
            &[],
        )
        .is_ok(),
        "stringOrMoney" => v.is_string() || integer(v).is_ok(),
        "action" => {
            let ty = if v["field"] == "clearance" {
                "uncleared|cleared"
            } else {
                "uuid"
            };
            shape(
                v,
                &[("field", "categoryId|payeeId|clearance"), ("value", ty)],
                &[],
            )
            .is_ok()
        }
        "template" => transaction_shape(v, false).is_ok(),
        other if other.starts_with('[') => array(v).is_ok_and(|entries| {
            entries
                .iter()
                .all(|v| value(v, &other[1..other.len() - 1]).is_ok())
        }),
        choices => v
            .as_str()
            .is_some_and(|s| choices.split('|').any(|choice| choice == s)),
    };
    if valid { Ok(()) } else { Err(INVALID) }
}
fn candidate(v: &Value) -> CoreResult<()> {
    shape(
        v,
        &[
            ("sourceRow", "positive"),
            ("date", "date"),
            ("amount", "money"),
        ],
        &[
            ("parserSource", "csv|camt053|ofx|qfx"),
            ("payee", "string"),
            ("memo", "string"),
            ("externalId", "string"),
            ("sourceFingerprint", "text"),
            ("categoryId", "uuid"),
            ("payeeId", "uuid"),
            ("clearance", "uncleared|cleared"),
        ],
    )
}
fn transaction_shape(v: &Value, dated: bool) -> CoreResult<()> {
    let mut required = vec![
        ("accountId", "uuid"),
        ("amount", "money"),
        ("kind", "normal|opening|transfer|contribution|settlement"),
        ("clearance", "uncleared|cleared|reconciled"),
        ("splits", "[split]"),
    ];
    let mut optional = vec![
        ("payeeId", "uuid"),
        ("note", "string"),
        ("transferId", "uuid"),
    ];
    if dated {
        required.push(("date", "date"));
        optional.extend([
            ("importReference", "text"),
            ("scheduleOccurrenceId", "uuid"),
        ]);
    }
    shape(v, &required, &optional)
}
pub fn aggregate(v: &Value) -> CoreResult<()> {
    let required_meta = [
        ("id", "uuid"),
        ("spaceId", "uuid"),
        ("revision", "positive"),
        ("createdAt", "time"),
        ("updatedAt", "time"),
        ("aggregateType", "string"),
    ];
    let mut required = required_meta.to_vec();
    let mut optional = vec![("deletedAt", "time")];
    match kind(v) {
        "account" => required.extend([
            ("name", "text"),
            ("type", "checking|cash|savings|credit|other"),
            ("onBudget", "bool"),
            ("archived", "bool"),
        ]),
        "financialRevision" => {}
        "categoryGroup" => required.extend([
            ("name", "text"),
            ("kind", "income|expense"),
            ("sortOrder", "ordinal"),
            ("archived", "bool"),
        ]),
        "category" => {
            required.extend([
                ("name", "text"),
                ("groupId", "uuid"),
                ("sortOrder", "ordinal"),
                ("archived", "bool"),
            ]);
            optional.push(("system", "uncategorized"));
        }
        "payee" => required.extend([
            ("name", "text"),
            ("aliases", "[text]"),
            ("archived", "bool"),
        ]),
        "transaction" => {
            let mut fields = v.as_object().ok_or(INVALID)?.clone();
            for (name, _) in required_meta.iter().chain(&optional) {
                fields.remove(*name);
            }
            transaction_shape(&Value::Object(fields), true)?;
            required.extend([
                ("accountId", "uuid"),
                ("date", "date"),
                ("amount", "money"),
                ("kind", "normal|opening|transfer|contribution|settlement"),
                ("clearance", "uncleared|cleared|reconciled"),
                ("splits", "[split]"),
            ]);
            optional.extend([
                ("payeeId", "uuid"),
                ("note", "string"),
                ("transferId", "uuid"),
                ("importReference", "text"),
                ("scheduleOccurrenceId", "uuid"),
            ]);
        }
        "transfer" => {
            required.extend([
                ("date", "date"),
                ("sourceAccountId", "uuid"),
                ("targetAccountId", "uuid"),
                ("sourceTransactionId", "uuid"),
                ("targetTransactionId", "uuid"),
                ("amount", "money"),
            ]);
            optional.extend([("budgetCategoryId", "uuid"), ("budgetRelease", "bool")]);
        }
        "reconciliation" => required.extend([
            ("accountId", "uuid"),
            ("statementDate", "date"),
            ("statementBalance", "money"),
            ("transactionIds", "[uuid]"),
        ]),
        "importMapping" => required.extend([("name", "text"), ("mapping", "json")]),
        "importBatch" => required.extend([
            ("fileHash", "hash"),
            ("accountId", "uuid"),
            ("rows", "[row]"),
            ("committedRows", "[positive]"),
            ("state", "ready|partial|completed"),
        ]),
        "importFingerprint" => {
            required.extend([
                ("accountId", "uuid"),
                ("parserSource", "text"),
                ("fingerprint", "text"),
                ("transactionId", "uuid"),
                ("importId", "uuid"),
                ("sourceRow", "positive"),
            ]);
            optional.push(("externalId", "string"));
        }
        "rule" => required.extend([
            ("order", "ordinal"),
            ("conditions", "[condition]"),
            ("actions", "[action]"),
            ("stopProcessing", "bool"),
            ("enabled", "bool"),
        ]),
        "schedule" => {
            required.extend([
                ("startDate", "date"),
                ("frequency", "weekly|monthly|yearly"),
                ("interval", "positive"),
                ("enabled", "bool"),
                ("template", "template"),
            ]);
            optional.push(("endDate", "date"));
        }
        "scheduleOccurrence" => {
            required.extend([
                ("scheduleId", "uuid"),
                ("dueDate", "date"),
                ("state", "confirmed|skipped"),
            ]);
            optional.push(("transactionId", "uuid"));
        }
        _ => return Err(INVALID),
    }
    shape(v, &required, &optional)?;
    for field in match kind(v) {
        "reconciliation" => &["transactionIds"][..],
        "importBatch" => &["rows"][..],
        "rule" => &["conditions", "actions"][..],
        _ => &[][..],
    } {
        let entries = array(&v[field])?;
        if entries.is_empty() || (kind(v) == "importBatch" && entries.len() > 100_000) {
            return Err(INVALID);
        }
    }
    Ok(())
}
