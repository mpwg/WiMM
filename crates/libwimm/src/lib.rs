//! Portable personal-finance core. All amounts are signed minor units, never floats.
//! A handle owns one synchronous SQLite connection. Browser bindings serialize calls
//! in a dedicated worker. Close a handle explicitly or let it drop.
mod error;
mod model;
mod schema;
mod storage;

pub use error::{Error, Result};
pub use model::{Account, AccountInput, Booking, BookingInput, currency_minor_units};
pub use uuid::Uuid;

use diesel::{connection::SimpleConnection, prelude::*};
use diesel_migrations::{EmbeddedMigrations, MigrationHarness, embed_migrations};
use schema::{accounts, bookings};
use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use storage::{AccountRow, BookingRow};

const MIGRATIONS: EmbeddedMigrations = embed_migrations!("migrations");
const FORMAT_VERSION: u64 = 1;

/// Owns a database connection; no ORM types cross the public interface.
pub struct WiMM {
    connection: SqliteConnection,
}

#[derive(Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
struct Backup {
    format_version: u64,
    accounts: Vec<Account>,
    bookings: Vec<Booking>,
}

impl WiMM {
    /// Opens a SQLite file/URI, enables foreign keys, and applies embedded migrations.
    /// On WASM the host must install a persistent VFS before calling this method.
    pub fn open(location: &str) -> Result<Self> {
        let mut connection = SqliteConnection::establish(location)
            .map_err(|error| Error::Storage(error.to_string()))?;
        connection.batch_execute("PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;")?;
        connection
            .run_pending_migrations(MIGRATIONS)
            .map_err(|error| Error::Storage(error.to_string()))?;
        Ok(Self { connection })
    }

    pub fn in_memory() -> Result<Self> {
        Self::open(":memory:")
    }

    /// Drops the connection. Committed writes are already persisted.
    pub fn close(self) {
        drop(self);
    }

    pub fn create_account(&mut self, input: AccountInput) -> Result<Account> {
        let input = model::account(input)?;
        let value = Account {
            id: Uuid::new_v4(),
            name: input.name,
            currency: input.currency,
        };
        diesel::insert_into(accounts::table)
            .values(AccountRow::from(&value))
            .execute(&mut self.connection)?;
        Ok(value)
    }

    pub fn get_account(&mut self, id: Uuid) -> Result<Account> {
        storage::get_account(&mut self.connection, id)
    }

    pub fn list_accounts(&mut self) -> Result<Vec<Account>> {
        storage::list_accounts(&mut self.connection)
    }

    pub fn update_account(&mut self, id: Uuid, input: AccountInput) -> Result<Account> {
        let input = model::account(input)?;
        self.connection.immediate_transaction(|conn| {
            let old = storage::get_account(conn, id)?;
            if old.currency != input.currency {
                let count = bookings::table
                    .filter(bookings::account_id.eq(id.to_string()))
                    .count()
                    .get_result::<i64>(conn)?;
                if count != 0 {
                    return Err(Error::Validation(
                        "currency cannot change while bookings exist".into(),
                    ));
                }
            }
            diesel::update(accounts::table.find(id.to_string()))
                .set((
                    accounts::name.eq(&input.name),
                    accounts::currency.eq(&input.currency),
                ))
                .execute(conn)?;
            Ok(Account {
                id,
                name: input.name,
                currency: input.currency,
            })
        })
    }

    /// Deletes the account and all its bookings in one SQLite statement/transaction.
    pub fn delete_account(&mut self, id: Uuid) -> Result<()> {
        let count =
            diesel::delete(accounts::table.find(id.to_string())).execute(&mut self.connection)?;
        if count == 0 {
            return Err(Error::NotFound(format!("account {id}")));
        }
        Ok(())
    }

    pub fn create_booking(&mut self, account_id: Uuid, input: BookingInput) -> Result<Booking> {
        model::booking(&input)?;
        self.connection.immediate_transaction(|conn| {
            storage::get_account(conn, account_id)?;
            let value = Booking {
                id: Uuid::new_v4(),
                account_id,
                booking_date: input.booking_date,
                description: input.description,
                amount: input.amount,
            };
            diesel::insert_into(bookings::table)
                .values(BookingRow::from(&value))
                .execute(conn)?;
            Ok(value)
        })
    }

    pub fn get_booking(&mut self, account_id: Uuid, id: Uuid) -> Result<Booking> {
        self.connection
            .transaction(|conn| storage::get_booking(conn, account_id, id))
    }

    pub fn list_bookings(&mut self, account_id: Uuid) -> Result<Vec<Booking>> {
        self.connection
            .transaction(|conn| storage::list_bookings(conn, account_id))
    }

    pub fn update_booking(
        &mut self,
        account_id: Uuid,
        id: Uuid,
        input: BookingInput,
    ) -> Result<Booking> {
        model::booking(&input)?;
        self.connection.immediate_transaction(|conn| {
            storage::get_booking(conn, account_id, id)?;
            diesel::update(
                bookings::table
                    .find(id.to_string())
                    .filter(bookings::account_id.eq(account_id.to_string())),
            )
            .set((
                bookings::booking_date.eq(&input.booking_date),
                bookings::description.eq(&input.description),
                bookings::amount.eq(input.amount),
            ))
            .execute(conn)?;
            Ok(Booking {
                id,
                account_id,
                booking_date: input.booking_date,
                description: input.description,
                amount: input.amount,
            })
        })
    }

    pub fn delete_booking(&mut self, account_id: Uuid, id: Uuid) -> Result<()> {
        self.connection.immediate_transaction(|conn| {
            storage::get_booking(conn, account_id, id)?;
            diesel::delete(
                bookings::table
                    .find(id.to_string())
                    .filter(bookings::account_id.eq(account_id.to_string())),
            )
            .execute(conn)?;
            Ok(())
        })
    }

    /// Exports a consistent snapshot including stable IDs and exact integer strings.
    pub fn export_json(&mut self) -> Result<String> {
        self.connection.transaction(|conn| {
            let accounts = storage::list_accounts(conn)?;
            let bookings = bookings::table
                .order((bookings::booking_date.asc(), bookings::id.asc()))
                .select(BookingRow::as_select())
                .load::<BookingRow>(conn)?
                .into_iter()
                .map(TryInto::try_into)
                .collect::<Result<Vec<Booking>>>()?;
            serde_json::to_string_pretty(&Backup {
                format_version: FORMAT_VERSION,
                accounts,
                bookings,
            })
            .map_err(|error| Error::Storage(error.to_string()))
        })
    }

    /// DESTRUCTIVE: replaces all accounts and bookings. Validation and write failures
    /// preserve the previous database. Even an empty valid backup replaces everything.
    pub fn replace_from_json(&mut self, json: &str) -> Result<()> {
        let invalid = |error: String| Error::InvalidImport(error);
        let value: serde_json::Value =
            serde_json::from_str(json).map_err(|e| invalid(e.to_string()))?;
        let version = value
            .get("format_version")
            .and_then(|v| v.as_u64())
            .ok_or_else(|| invalid("format_version must be an unsigned integer".into()))?;
        if version != FORMAT_VERSION {
            return Err(Error::UnsupportedFormatVersion(version));
        }
        // Parse the original text so duplicate JSON object keys are rejected by serde.
        let mut backup: Backup = serde_json::from_str(json).map_err(|e| invalid(e.to_string()))?;
        let mut account_ids = HashSet::new();
        for account in &mut backup.accounts {
            if !account_ids.insert(account.id) {
                return Err(invalid("duplicate account ID".into()));
            }
            let normalized = model::account(AccountInput {
                name: account.name.clone(),
                currency: account.currency.clone(),
            })
            .map_err(|e| invalid(e.to_string()))?;
            account.name = normalized.name;
        }
        let mut booking_ids = HashSet::new();
        for booking in &backup.bookings {
            if !booking_ids.insert(booking.id) {
                return Err(invalid("duplicate booking ID".into()));
            }
            if !account_ids.contains(&booking.account_id) {
                return Err(invalid("booking references missing account".into()));
            }
            model::booking(&BookingInput {
                booking_date: booking.booking_date.clone(),
                description: booking.description.clone(),
                amount: booking.amount,
            })
            .map_err(|e| invalid(e.to_string()))?;
        }
        self.connection.immediate_transaction(|conn| {
            diesel::delete(bookings::table).execute(conn)?;
            diesel::delete(accounts::table).execute(conn)?;
            for account in &backup.accounts {
                diesel::insert_into(accounts::table)
                    .values(AccountRow::from(account))
                    .execute(conn)?;
            }
            for booking in &backup.bookings {
                diesel::insert_into(bookings::table)
                    .values(BookingRow::from(booking))
                    .execute(conn)?;
            }
            Ok(())
        })
    }
}
