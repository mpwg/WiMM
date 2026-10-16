use crate::{Error, Result};
use chrono::NaiveDate;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Account {
    pub id: Uuid,
    pub name: String,
    pub currency: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct AccountInput {
    pub name: String,
    pub currency: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Booking {
    pub id: Uuid,
    pub account_id: Uuid,
    pub booking_date: String,
    pub description: String,
    #[serde(with = "amount_string")]
    pub amount: i64,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct BookingInput {
    pub booking_date: String,
    pub description: String,
    #[serde(with = "amount_string")]
    pub amount: i64,
}

pub(crate) fn account(input: AccountInput) -> Result<AccountInput> {
    let name = input.name.trim().to_owned();
    if name.is_empty() {
        return Err(Error::Validation("account name must not be empty".into()));
    }
    currency_minor_units(&input.currency)?;
    Ok(AccountInput { name, ..input })
}

pub(crate) fn booking(input: &BookingInput) -> Result<()> {
    let date = NaiveDate::parse_from_str(&input.booking_date, "%Y-%m-%d")
        .map_err(|_| Error::Validation("booking_date must be YYYY-MM-DD".into()))?;
    if date.format("%Y-%m-%d").to_string() != input.booking_date || input.booking_date.len() != 10 {
        return Err(Error::Validation("booking_date must be YYYY-MM-DD".into()));
    }
    if input.amount == 0 {
        return Err(Error::Validation("amount must not be zero".into()));
    }
    Ok(())
}

/// ISO-4217 minor units from the bundled SIX List One snapshot.
/// Codes without a numeric minor unit (e.g. precious metals) are unsupported.
pub fn currency_minor_units(code: &str) -> Result<u8> {
    const CURRENCIES: &[(&str, u8)] = include!("currencies.rs");
    CURRENCIES
        .iter()
        .find(|(currency, _)| *currency == code)
        .map(|(_, units)| *units)
        .ok_or_else(|| Error::Validation(format!("unsupported currency: {code}")))
}

mod amount_string {
    use serde::{Deserialize, Deserializer, Serializer, de::Error};

    pub fn serialize<S: Serializer>(amount: &i64, serializer: S) -> Result<S::Ok, S::Error> {
        serializer.serialize_str(&amount.to_string())
    }

    pub fn deserialize<'de, D: Deserializer<'de>>(deserializer: D) -> Result<i64, D::Error> {
        let value = String::deserialize(deserializer)?;
        let amount: i64 = value.parse().map_err(D::Error::custom)?;
        if amount.to_string() != value {
            return Err(D::Error::custom(
                "amount must be a canonical signed integer string",
            ));
        }
        Ok(amount)
    }
}
