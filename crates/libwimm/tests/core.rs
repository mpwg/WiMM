use diesel::{Connection, connection::SimpleConnection};
use libwimm::{AccountInput, BookingInput, Error, Uuid, WiMM, currency_minor_units};
use serde_json::{Value, json};

fn account(name: &str, currency: &str) -> AccountInput {
    AccountInput {
        name: name.into(),
        currency: currency.into(),
    }
}
fn booking(amount: i64, date: &str) -> BookingInput {
    BookingInput {
        amount,
        booking_date: date.into(),
        description: "Lunch 🍜".into(),
    }
}
fn seeded() -> (WiMM, libwimm::Account, libwimm::Booking) {
    let mut db = WiMM::in_memory().unwrap();
    let a = db.create_account(account("  Daily  ", "EUR")).unwrap();
    let b = db
        .create_booking(a.id, booking(-1234, "2026-10-16"))
        .unwrap();
    (db, a, b)
}

#[test]
fn account_crud_and_currency_rules() {
    let mut db = WiMM::in_memory().unwrap();
    let a = db.create_account(account("  Daily  ", "EUR")).unwrap();
    assert_eq!(a.name, "Daily");
    assert_eq!(db.get_account(a.id).unwrap(), a);
    db.create_account(account("Daily", "EUR")).unwrap(); // duplicate names permitted
    let mut ids: Vec<_> = db
        .list_accounts()
        .unwrap()
        .into_iter()
        .map(|a| a.id)
        .collect();
    let sorted = ids.clone();
    ids.sort();
    assert_eq!(ids, sorted);
    let a = db.update_account(a.id, account("Travel", "JPY")).unwrap();
    assert_eq!(a.currency, "JPY");
    let b = db.create_booking(a.id, booking(50, "2026-01-01")).unwrap();
    assert!(matches!(
        db.update_account(a.id, account("Travel", "EUR")),
        Err(Error::Validation(_))
    ));
    db.update_account(a.id, account("New name", "JPY")).unwrap();
    db.delete_booking(a.id, b.id).unwrap();
    db.update_account(a.id, account("Travel", "EUR")).unwrap();
    db.delete_account(a.id).unwrap();
    assert!(matches!(db.get_account(a.id), Err(Error::NotFound(_))));
    assert!(matches!(db.delete_account(a.id), Err(Error::NotFound(_))));
    assert!(matches!(
        db.update_account(a.id, account("X", "EUR")),
        Err(Error::NotFound(_))
    ));
}

#[test]
fn booking_crud_scoping_order_and_cascade() {
    let (mut db, a, b) = seeded();
    let other = db.create_account(account("Other", "KWD")).unwrap();
    assert!(matches!(
        db.get_booking(other.id, b.id),
        Err(Error::NotFound(_))
    ));
    assert!(matches!(
        db.update_booking(other.id, b.id, booking(10, "2026-01-01")),
        Err(Error::NotFound(_))
    ));
    assert!(matches!(
        db.delete_booking(other.id, b.id),
        Err(Error::NotFound(_))
    ));
    assert_eq!(db.get_booking(a.id, b.id).unwrap(), b);
    let edited = db
        .update_booking(a.id, b.id, booking(3000, "2026-01-01"))
        .unwrap();
    assert_eq!(edited.id, b.id);
    assert_eq!(edited.account_id, a.id);
    assert_eq!(edited.amount, 3000);
    db.create_booking(a.id, booking(2, "2026-01-01")).unwrap();
    db.create_booking(a.id, booking(1, "2025-12-31")).unwrap();
    let values = db.list_bookings(a.id).unwrap();
    let keys: Vec<_> = values.iter().map(|b| (&b.booking_date, b.id)).collect();
    let mut sorted = keys.clone();
    sorted.sort();
    assert_eq!(keys, sorted);
    db.delete_account(a.id).unwrap();
    assert!(matches!(db.list_bookings(a.id), Err(Error::NotFound(_))));
    let backup: Value = serde_json::from_str(&db.export_json().unwrap()).unwrap();
    assert_eq!(backup["bookings"], json!([]));
    let missing = Uuid::new_v4();
    assert!(matches!(
        db.create_booking(missing, booking(1, "2026-01-01")),
        Err(Error::NotFound(_))
    ));
    assert!(matches!(
        db.get_booking(missing, b.id),
        Err(Error::NotFound(_))
    ));
}

#[test]
fn validation_and_exact_minor_units() {
    let mut db = WiMM::in_memory().unwrap();
    for (code, units) in [("EUR", 2), ("JPY", 0), ("KWD", 3), ("CLF", 4)] {
        assert_eq!(currency_minor_units(code).unwrap(), units);
    }
    for bad in ["eur", "", "ZZZ", "XAU"] {
        assert!(currency_minor_units(bad).is_err());
    }
    assert!(db.create_account(account("\n \t", "EUR")).is_err());
    assert!(db.create_account(account("X", "eur")).is_err());
    let a = db.create_account(account("X", "JPY")).unwrap();
    for date in [
        "2026-02-29",
        "2026-1-01",
        "2026-01-1",
        "2026-13-01",
        "2026-01-01T00:00:00Z",
        "2026-01-01 ",
    ] {
        assert!(db.create_booking(a.id, booking(1, date)).is_err(), "{date}");
    }
    assert!(db.create_booking(a.id, booking(0, "2026-01-01")).is_err());
    for amount in [
        i64::MIN,
        i64::MAX,
        -9_007_199_254_740_993,
        9_007_199_254_740_993,
    ] {
        let b = db
            .create_booking(a.id, booking(amount, "2024-02-29"))
            .unwrap();
        assert_eq!(db.get_booking(a.id, b.id).unwrap().amount, amount);
        let json = serde_json::to_value(&b).unwrap();
        assert_eq!(json["amount"], amount.to_string());
    }
}

#[test]
fn backup_roundtrip_replaces_everything_and_preserves_ids() {
    let (mut db, a, _) = seeded();
    db.create_booking(a.id, booking(i64::MIN, "2026-10-16"))
        .unwrap();
    db.create_booking(a.id, booking(i64::MAX, "2026-10-16"))
        .unwrap();
    let backup = db.export_json().unwrap();
    let mut other = WiMM::in_memory().unwrap();
    other.create_account(account("Discard", "USD")).unwrap();
    other.replace_from_json(&backup).unwrap();
    assert_eq!(other.export_json().unwrap(), backup);
    other
        .replace_from_json(r#"{"format_version":1,"accounts":[],"bookings":[]}"#)
        .unwrap();
    assert!(other.list_accounts().unwrap().is_empty());
}

#[test]
fn malformed_imports_never_change_existing_data() {
    let (mut db, _, _) = seeded();
    let original = db.export_json().unwrap();
    let base: Value = serde_json::from_str(&original).unwrap();
    let mut cases = vec!["bad json".into(), "{}".into(), "null".into()];
    let mut add = |path: &str, value: Value| {
        let mut v = base.clone();
        *v.pointer_mut(path).unwrap() = value;
        cases.push(v.to_string());
    };
    add("/format_version", json!(2));
    add("/format_version", json!(-1));
    add("/accounts/0/name", json!("  "));
    add("/accounts/0/currency", json!("XYZ"));
    add("/accounts/0/id", json!("invalid"));
    add("/bookings/0/account_id", json!(Uuid::new_v4()));
    add("/bookings/0/booking_date", json!("2026-02-30"));
    for value in [
        json!(0),
        json!("0"),
        json!("9223372036854775808"),
        json!("-9223372036854775809"),
        json!("1.2"),
        json!("01"),
        json!("+1"),
        json!("-0"),
    ] {
        add("/bookings/0/amount", value);
    }
    for key in ["accounts", "bookings"] {
        let mut v = base.clone();
        let item = v[key][0].clone();
        v[key].as_array_mut().unwrap().push(item);
        cases.push(v.to_string());
    }
    let mut v = base.clone();
    v["unexpected"] = json!(true);
    cases.push(v.to_string());
    cases.push(original.replacen(
        "\"format_version\": 1",
        "\"format_version\": 1, \"format_version\": 1",
        1,
    ));
    for bad in cases {
        assert!(db.replace_from_json(&bad).is_err(), "accepted: {bad}");
        assert_eq!(db.export_json().unwrap(), original);
    }
    assert!(matches!(
        db.replace_from_json(r#"{"format_version":99}"#),
        Err(Error::UnsupportedFormatVersion(99))
    ));
}

#[test]
fn file_persistence_and_failed_write_roll_back_replacement() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("wimm.sqlite3");
    let path = path.to_str().unwrap();
    let mut db = WiMM::open(path).unwrap();
    let a = db.create_account(account("Original", "EUR")).unwrap();
    db.create_booking(a.id, booking(-55, "2026-10-16")).unwrap();
    let original = db.export_json().unwrap();
    db.close();
    let mut db = WiMM::open(path).unwrap();
    assert_eq!(db.export_json().unwrap(), original);
    // A real SQLite trigger fails after replacement has deleted the old data
    // and inserted the new account, exercising rollback of every preceding write.
    let mut external = diesel::sqlite::SqliteConnection::establish(path).unwrap();
    external.batch_execute("CREATE TRIGGER fail_import BEFORE INSERT ON bookings BEGIN SELECT RAISE(ABORT, 'injected write failure'); END;").unwrap();
    let mut replacement: Value = serde_json::from_str(&original).unwrap();
    replacement["accounts"][0]["name"] = json!("Replacement");
    assert!(matches!(
        db.replace_from_json(&replacement.to_string()),
        Err(Error::Storage(_))
    ));
    assert_eq!(db.export_json().unwrap(), original);
    db.close();
    assert_eq!(WiMM::open(path).unwrap().export_json().unwrap(), original);
}
