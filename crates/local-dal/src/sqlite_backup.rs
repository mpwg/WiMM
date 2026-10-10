// SPDX-License-Identifier: AGPL-3.0-or-later
//! Bestehender privater Chiffratspeicher über ORM; keine Finanzklartexte oder Schlüssel.
use diesel::{connection::SimpleConnection, prelude::*};
use sea_query::{Alias, ColumnDef, Expr, Index, SqliteQueryBuilder, Table};
use std::cell::RefCell;
#[cfg(not(target_family = "wasm"))]
use std::path::Path;
use wimm_local_contracts::{models::EncryptedBackupReceipt, persistence_errors::*};
diesel::table! {backup_meta(id){id->Integer,version->Integer,}}
diesel::table! {encrypted_backups(backup_id){backup_id->Text,profile_id->Text,space_id->Text,epoch->Text,snapshot_hash->Text,ciphertext->Binary,}}
diesel::table! {sqlite_master(name){name->Text,#[sql_name="type"]type_->Text,}}
fn failure(code: StorageFailureCode) -> StorageFailure {
    StorageFailure::not_committed(code)
}
#[derive(Debug)]
enum Error {
    Store(StorageFailure),
    Database,
}
impl From<StorageFailure> for Error {
    fn from(v: StorageFailure) -> Self {
        Self::Store(v)
    }
}
impl From<diesel::result::Error> for Error {
    fn from(_: diesel::result::Error) -> Self {
        Self::Database
    }
}
fn mapped(e: Error) -> StorageFailure {
    match e {
        Error::Store(e) => e,
        Error::Database => failure(StorageFailureCode::WriteFailed),
    }
}
fn schema(c: &mut SqliteConnection) -> Result<(), Error> {
    let exists: bool = diesel::select(diesel::dsl::exists(
        sqlite_master::table
            .filter(sqlite_master::name.eq("backup_meta"))
            .filter(sqlite_master::type_.eq("table")),
    ))
    .get_result(c)?;
    if !exists {
        return Err(failure(StorageFailureCode::UpdateRequired).into());
    }
    let version: Option<i32> = backup_meta::table
        .find(1)
        .select(backup_meta::version)
        .first(c)
        .optional()?;
    if version != Some(1) {
        return Err(failure(StorageFailureCode::UpdateRequired).into());
    }
    Ok(())
}
#[derive(QueryableByName)]
struct Durability {
    #[diesel(sql_type=diesel::sql_types::Integer)]
    synchronous: i32,
}
fn read(c: &mut SqliteConnection, r: &EncryptedBackupReceipt) -> Result<Vec<u8>, Error> {
    schema(c)?;
    let bytes: Option<Vec<u8>> = encrypted_backups::table
        .filter(encrypted_backups::backup_id.eq(r.backup_id.as_str()))
        .filter(encrypted_backups::profile_id.eq(r.profile_id.as_str()))
        .filter(encrypted_backups::space_id.eq(r.space_id.as_str()))
        .filter(encrypted_backups::epoch.eq(r.epoch.as_str()))
        .filter(encrypted_backups::snapshot_hash.eq(r.snapshot_hash.as_str()))
        .select(encrypted_backups::ciphertext)
        .first(c)
        .optional()?;
    match bytes {
        Some(bytes) if !bytes.is_empty() => Ok(bytes),
        _ => Err(failure(StorageFailureCode::WriteFailed).into()),
    }
}
pub struct SqliteBackupStore {
    connection: RefCell<SqliteConnection>,
}
impl SqliteBackupStore {
    #[cfg(not(target_family = "wasm"))]
    fn connection(path: &Path, create: bool) -> Result<SqliteConnection, StorageFailure> {
        let location = if create {
            path.to_str()
                .ok_or_else(|| failure(StorageFailureCode::ResourceUnavailable))?
                .to_owned()
        } else {
            let absolute = path
                .canonicalize()
                .map_err(|_| failure(StorageFailureCode::ResourceUnavailable))?;
            let encoded = absolute
                .to_str()
                .ok_or_else(|| failure(StorageFailureCode::ResourceUnavailable))?
                .bytes()
                .map(|b| {
                    if b.is_ascii_alphanumeric() || b"/-._~".contains(&b) {
                        char::from(b).to_string()
                    } else {
                        format!("%{b:02X}")
                    }
                })
                .collect::<String>();
            format!("file:{encoded}?mode=rw")
        };
        let mut c = SqliteConnection::establish(&location)
            .map_err(|_| failure(StorageFailureCode::ResourceUnavailable))?;
        // Verbindungsoptionen ohne entsprechende ORM-DSL; kein Schemaabgleich.
        c.batch_execute("PRAGMA synchronous=FULL; PRAGMA busy_timeout=3000;")
            .map_err(|_| failure(StorageFailureCode::ResourceUnavailable))?;
        Ok(c)
    }
    #[cfg(not(target_family = "wasm"))]
    pub fn open_existing(path: &Path) -> Result<Self, StorageFailure> {
        if !path.is_file() {
            return Err(failure(StorageFailureCode::ResourceUnavailable));
        }
        Self::from_connection(Self::connection(path, false)?)
    }
    /// Übernimmt einen tatsächlichen aktuellen Chiffratstore ohne Schemaänderung.
    pub fn from_connection(mut c: SqliteConnection) -> Result<Self, StorageFailure> {
        c.batch_execute("PRAGMA synchronous=FULL; PRAGMA busy_timeout=3000;")
            .map_err(|_| failure(StorageFailureCode::ResourceUnavailable))?;
        schema(&mut c).map_err(mapped)?;
        Ok(Self {
            connection: RefCell::new(c),
        })
    }
    #[cfg(not(target_family = "wasm"))]
    pub fn initialize_new(path: &Path) -> Result<Self, StorageFailure> {
        Self::initialize_connection(Self::connection(path, true)?)
    }
    /// Expliziter Initialschritt derselben DSL auf einer leeren nativen/WASM-Verbindung.
    pub fn initialize_connection(mut c: SqliteConnection) -> Result<Self, StorageFailure> {
        c.batch_execute("PRAGMA synchronous=FULL; PRAGMA busy_timeout=3000;")
            .map_err(|_| failure(StorageFailureCode::ResourceUnavailable))?;
        c.immediate_transaction::<_, Error, _>(|c| {
            let tables: i64 = sqlite_master::table
                .filter(sqlite_master::type_.eq("table"))
                .count()
                .get_result(c)?;
            if tables != 0 {
                return Err(failure(StorageFailureCode::UpdateRequired).into());
            }
            let meta = Table::create()
                .table(Alias::new("backup_meta"))
                .col(
                    ColumnDef::new(Alias::new("id"))
                        .integer()
                        .primary_key()
                        .check(Expr::cust("id=1")),
                )
                .col(ColumnDef::new(Alias::new("version")).integer().not_null())
                .to_string(SqliteQueryBuilder);
            c.batch_execute(&meta)?;
            let mut table = Table::create();
            table.table(Alias::new("encrypted_backups"));
            for name in [
                "backup_id",
                "profile_id",
                "space_id",
                "epoch",
                "snapshot_hash",
            ] {
                table.col(ColumnDef::new(Alias::new(name)).text().not_null());
            }
            table.primary_key(Index::create().col(Alias::new("backup_id")));
            table.col(
                ColumnDef::new(Alias::new("ciphertext"))
                    .binary()
                    .not_null()
                    .check(Expr::cust("length(ciphertext)>0")),
            );
            c.batch_execute(&table.to_string(SqliteQueryBuilder))?;
            diesel::insert_into(backup_meta::table)
                .values((backup_meta::id.eq(1), backup_meta::version.eq(1)))
                .execute(c)?;
            Ok(())
        })
        .map_err(mapped)?;
        Ok(Self {
            connection: RefCell::new(c),
        })
    }
    #[cfg(feature = "receipt-probe")]
    pub fn probe_relax_durability(&mut self) -> Result<(), StorageFailure> {
        self.connection
            .get_mut()
            .batch_execute("PRAGMA synchronous=OFF")
            .map_err(|_| failure(StorageFailureCode::ResourceUnavailable))
    }
    pub fn read(&self, r: &EncryptedBackupReceipt) -> Result<Vec<u8>, StorageFailure> {
        self.connection
            .borrow_mut()
            .transaction::<_, Error, _>(|c| read(c, r))
            .map_err(mapped)
    }
    pub fn persist(
        &mut self,
        r: EncryptedBackupReceipt,
        bytes: &[u8],
    ) -> Result<EncryptedBackupReceipt, StorageFailure> {
        if bytes.is_empty() {
            return Err(failure(StorageFailureCode::WriteFailed));
        }
        let mut reached_commit = false;
        let result = self
            .connection
            .get_mut()
            .immediate_transaction::<_, Error, _>(|c| {
                schema(c)?;
                // PRAGMA-Abfrage ist eine feste technische Ausnahme; Zustand wird tatsächlich gelesen.
                let durability =
                    diesel::sql_query("PRAGMA synchronous").get_result::<Durability>(c)?;
                if durability.synchronous < 2 {
                    return Err(failure(StorageFailureCode::WriteFailed).into());
                }
                let duplicate: bool = diesel::select(diesel::dsl::exists(
                    encrypted_backups::table.find(r.backup_id.as_str()),
                ))
                .get_result(c)?;
                if duplicate {
                    return Err(failure(StorageFailureCode::WriteFailed).into());
                }
                diesel::insert_into(encrypted_backups::table)
                    .values((
                        encrypted_backups::backup_id.eq(r.backup_id.as_str()),
                        encrypted_backups::profile_id.eq(r.profile_id.as_str()),
                        encrypted_backups::space_id.eq(r.space_id.as_str()),
                        encrypted_backups::epoch.eq(r.epoch.as_str()),
                        encrypted_backups::snapshot_hash.eq(r.snapshot_hash.as_str()),
                        encrypted_backups::ciphertext.eq(bytes),
                    ))
                    .execute(c)?;
                reached_commit = true;
                Ok(())
            });
        if let Err(e) = result {
            return Err(if reached_commit {
                StorageFailure::unknown(StorageFailureCode::CommitUnknown)
            } else {
                mapped(e)
            });
        }
        let saved = self
            .read(&r)
            .map_err(|_| StorageFailure::unknown(StorageFailureCode::CommitUnknown))?;
        if saved != bytes {
            return Err(StorageFailure::unknown(StorageFailureCode::CommitUnknown));
        }
        Ok(r)
    }
}
