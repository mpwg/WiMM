use crate::{
    Account, Booking, Error, Result,
    schema::{accounts, bookings},
};
use diesel::prelude::*;
use uuid::Uuid;

#[derive(Queryable, Selectable, Insertable)]
#[diesel(table_name = accounts)]
pub(crate) struct AccountRow {
    pub id: String,
    pub name: String,
    pub currency: String,
}

#[derive(Queryable, Selectable, Insertable)]
#[diesel(table_name = bookings)]
pub(crate) struct BookingRow {
    pub id: String,
    pub account_id: String,
    pub booking_date: String,
    pub description: String,
    pub amount: i64,
}

fn id(value: &str) -> Result<Uuid> {
    Uuid::parse_str(value).map_err(|_| Error::Storage("invalid UUID in database".into()))
}

impl TryFrom<AccountRow> for Account {
    type Error = Error;
    fn try_from(row: AccountRow) -> Result<Self> {
        Ok(Self {
            id: id(&row.id)?,
            name: row.name,
            currency: row.currency,
        })
    }
}

impl From<&Account> for AccountRow {
    fn from(value: &Account) -> Self {
        Self {
            id: value.id.to_string(),
            name: value.name.clone(),
            currency: value.currency.clone(),
        }
    }
}

impl TryFrom<BookingRow> for Booking {
    type Error = Error;
    fn try_from(row: BookingRow) -> Result<Self> {
        Ok(Self {
            id: id(&row.id)?,
            account_id: id(&row.account_id)?,
            booking_date: row.booking_date,
            description: row.description,
            amount: row.amount,
        })
    }
}

impl From<&Booking> for BookingRow {
    fn from(value: &Booking) -> Self {
        Self {
            id: value.id.to_string(),
            account_id: value.account_id.to_string(),
            booking_date: value.booking_date.clone(),
            description: value.description.clone(),
            amount: value.amount,
        }
    }
}

pub(crate) fn get_account(conn: &mut SqliteConnection, id: Uuid) -> Result<Account> {
    accounts::table
        .find(id.to_string())
        .select(AccountRow::as_select())
        .first::<AccountRow>(conn)
        .optional()?
        .ok_or_else(|| Error::NotFound(format!("account {id}")))?
        .try_into()
}

pub(crate) fn list_accounts(conn: &mut SqliteConnection) -> Result<Vec<Account>> {
    accounts::table
        .order(accounts::id.asc())
        .select(AccountRow::as_select())
        .load::<AccountRow>(conn)?
        .into_iter()
        .map(TryInto::try_into)
        .collect()
}

pub(crate) fn get_booking(
    conn: &mut SqliteConnection,
    account_id: Uuid,
    id: Uuid,
) -> Result<Booking> {
    get_account(conn, account_id)?;
    bookings::table
        .find(id.to_string())
        .filter(bookings::account_id.eq(account_id.to_string()))
        .select(BookingRow::as_select())
        .first::<BookingRow>(conn)
        .optional()?
        .ok_or_else(|| Error::NotFound(format!("booking {id} in account {account_id}")))?
        .try_into()
}

pub(crate) fn list_bookings(conn: &mut SqliteConnection, account_id: Uuid) -> Result<Vec<Booking>> {
    get_account(conn, account_id)?;
    bookings::table
        .filter(bookings::account_id.eq(account_id.to_string()))
        .order((bookings::booking_date.asc(), bookings::id.asc()))
        .select(BookingRow::as_select())
        .load::<BookingRow>(conn)?
        .into_iter()
        .map(TryInto::try_into)
        .collect()
}
