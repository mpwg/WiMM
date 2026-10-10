// SPDX-License-Identifier: AGPL-3.0-or-later
//! ORM-Zugriff auf das unveränderte native Tauri-Bestandsschema.
//! Öffnen und Lesen erzeugen keine Tabellen, Migrationen oder Finanzwrites.
#[cfg(not(target_family = "wasm"))]
use diesel::connection::SimpleConnection;
use diesel::prelude::*;
use std::cell::RefCell;
use wimm_finance_types::scalars::EntityId;
use wimm_local_contracts::{persistence_errors::*, storage::*};

diesel::table! { storage_meta (key) { key -> Text, value -> Text, } }
diesel::table! { aggregates (profile_id, handle) { profile_id -> Text, handle -> Text, space_id -> Text, revision -> BigInt, payload -> Text, } }
diesel::table! { confirmed (profile_id, handle) { profile_id -> Text, handle -> Text, space_id -> Text, epoch -> Text, revision -> BigInt, payload -> Text, } }
diesel::table! { outbox (profile_id, operation_id) { profile_id -> Text, operation_id -> Text, space_id -> Text, state -> Text, payload -> Text, } }
diesel::table! { projections (profile_id, space_id, projection_kind, projection_key) { profile_id -> Text, space_id -> Text, projection_kind -> Text, projection_key -> Text, payload -> Text, } }
diesel::table! { sync_state (profile_id, space_id) { profile_id -> Text, space_id -> Text, epoch -> Text, cursor -> Text, } }
diesel::table! { storage_migrations (number) { number -> Integer, } }
diesel::table! { wimm_native_schema (version) { version -> Integer, original_version -> Integer, backups -> Text, } }
diesel::table! { sqlite_master (name) { name -> Text, #[sql_name="type"] type_ -> Text, } }

fn invalid() -> StorageFailure {
    StorageFailure::unknown(StorageFailureCode::InvalidResponse)
}
fn database(_: diesel::result::Error) -> StorageFailure {
    StorageFailure::unknown(StorageFailureCode::ResourceUnavailable)
}
fn decode<T: serde::de::DeserializeOwned>(s: &str) -> Result<T, StorageFailure> {
    serde_json::from_str(s).map_err(|_| invalid())
}
#[derive(Debug)]
struct ReadError(StorageFailure);
impl From<diesel::result::Error> for ReadError {
    fn from(e: diesel::result::Error) -> Self {
        Self(database(e))
    }
}
impl From<StorageFailure> for ReadError {
    fn from(e: StorageFailure) -> Self {
        Self(e)
    }
}

/// Profilgebundene Verbindung; die produktive Ablösung benötigt auch die Schreib-/Migrationsports.
pub struct LegacySqliteStore {
    connection: RefCell<SqliteConnection>,
    profile: EntityId,
}
impl LegacySqliteStore {
    /// Öffnet ausschließlich eine existierende Datei. Unbekannte Versionen werden abgewiesen.
    #[cfg(not(target_family = "wasm"))]
    pub fn open(path: &std::path::Path, profile: EntityId) -> Result<Self, StorageFailure> {
        Self::open_mode(path, profile, false)
    }
    #[cfg(not(target_family = "wasm"))]
    fn open_mode(
        path: &std::path::Path,
        profile: EntityId,
        writable: bool,
    ) -> Result<Self, StorageFailure> {
        if !path.is_file() {
            return Err(StorageFailure::unknown(
                StorageFailureCode::ResourceUnavailable,
            ));
        }
        let absolute = path
            .canonicalize()
            .map_err(|_| StorageFailure::unknown(StorageFailureCode::ResourceUnavailable))?;
        let encoded = absolute
            .to_str()
            .ok_or_else(invalid)?
            .bytes()
            .map(|b| {
                if b.is_ascii_alphanumeric() || b"/-._~".contains(&b) {
                    char::from(b).to_string()
                } else {
                    format!("%{b:02X}")
                }
            })
            .collect::<String>();
        // SQLite erzwingt den gewählten Modus; auch ein Rennen mit Dateientfernung erzeugt keinen Bestand.
        let mode = if writable { "rw" } else { "ro" };
        let location = format!("file:{encoded}?mode={mode}");
        let mut connection = SqliteConnection::establish(&location)
            .map_err(|_| StorageFailure::unknown(StorageFailureCode::ResourceUnavailable))?;
        // Verbindungsoptionen besitzen keine Diesel-Query-DSL; kein Schema-/Datenwrite.
        connection
            .batch_execute(if writable {
                "PRAGMA foreign_keys=ON; PRAGMA synchronous=FULL; PRAGMA busy_timeout=3000;"
            } else {
                "PRAGMA query_only=ON; PRAGMA busy_timeout=3000;"
            })
            .map_err(database)?;
        connection
            .transaction::<_, ReadError, _>(|c| {
                supported(c)?;
                Ok(())
            })
            .map_err(|e| e.0)?;
        Ok(Self {
            connection: RefCell::new(connection),
            profile,
        })
    }
    pub fn read_aggregate(
        &self,
        handle: &EntityId,
    ) -> Result<Option<StoredAggregate>, StorageFailure> {
        self.connection
            .borrow_mut()
            .transaction::<_, ReadError, _>(|c| {
                supported(c)?;
                let row: Option<(String, String, i64, String)> = aggregates::table
                    .filter(aggregates::profile_id.eq(self.profile.as_str()))
                    .filter(aggregates::handle.eq(handle.as_str()))
                    .select((
                        aggregates::handle,
                        aggregates::space_id,
                        aggregates::revision,
                        aggregates::payload,
                    ))
                    .first(c)
                    .optional()?;
                row.map(aggregate).transpose().map_err(Into::into)
            })
            .map_err(|e| e.0)
    }
    /// Alle Tabellen und Metadaten stammen aus derselben tatsächlichen SQLite-Lesetransaktion.
    pub fn export_snapshot(&self, space: &EntityId) -> Result<LocalSnapshot, StorageFailure> {
        self.connection
            .borrow_mut()
            .transaction::<_, ReadError, _>(|c| snapshot(c, &self.profile, space))
            .map_err(|e| e.0)
    }
}
fn snapshot(
    c: &mut SqliteConnection,
    profile: &EntityId,
    space: &EntityId,
) -> Result<LocalSnapshot, ReadError> {
    snapshot_with_projections(c, profile, space, None)
}
fn snapshot_with_projections(
    c: &mut SqliteConnection,
    profile: &EntityId,
    space: &EntityId,
    replacement: Option<&[StoredProjection]>,
) -> Result<LocalSnapshot, ReadError> {
    let version = supported(c)?;
    let rows: Vec<(String, String, i64, String)> = aggregates::table
        .filter(aggregates::profile_id.eq(profile.as_str()))
        .filter(aggregates::space_id.eq(space.as_str()))
        .order(aggregates::handle)
        .select((
            aggregates::handle,
            aggregates::space_id,
            aggregates::revision,
            aggregates::payload,
        ))
        .load(c)?;
    let aggregates = rows
        .into_iter()
        .map(aggregate)
        .collect::<Result<Vec<_>, _>>()?;
    let confirmed = read_confirmed(c, profile, space)?;
    let pending = read_pending(c, profile, space)?;
    let projections = if let Some(values) = replacement {
        values.to_vec()
    } else {
        let rows: Vec<(String, String, String)> = projections::table
            .filter(projections::profile_id.eq(profile.as_str()))
            .filter(projections::space_id.eq(space.as_str()))
            .order((projections::projection_kind, projections::projection_key))
            .select((
                projections::projection_kind,
                projections::projection_key,
                projections::payload,
            ))
            .load(c)?;
        let mut projections = Vec::new();
        for (kind, key, payload) in rows {
            let row: StoredProjection = decode(&payload)?;
            let (area, actual_kind, actual_key) = match &row {
                StoredProjection::Balance { space_id, key, .. } => {
                    (space_id, "balance", key.as_str())
                }
                StoredProjection::AccountBalance { space_id, key, .. } => {
                    (space_id, "accountBalance", key.as_str())
                }
                StoredProjection::Consumption { space_id, key, .. } => {
                    (space_id, "consumption", key.as_str())
                }
            };
            if area != space || kind != actual_kind || key != actual_key {
                return Err(invalid().into());
            }
            projections.push(row);
        }
        projections
    };
    let state: Option<(String, String)> = sync_state::table
        .filter(sync_state::profile_id.eq(profile.as_str()))
        .filter(sync_state::space_id.eq(space.as_str()))
        .select((sync_state::epoch, sync_state::cursor))
        .first(c)
        .optional()?;
    let sync_state = state
        .map(|(epoch, cursor)| -> Result<_, StorageFailure> {
            let s = SyncState {
                profile_id: profile.clone(),
                space_id: space.clone(),
                epoch: EntityId::new(epoch).map_err(|_| invalid())?,
                cursor,
            };
            if !s.check_cursor() {
                return Err(invalid());
            }
            Ok(s)
        })
        .transpose()?;
    let epoch_key = format!(
        "localEpoch:{}",
        serde_json::json!([profile.as_str(), space.as_str()])
    );
    let local: Option<String> = storage_meta::table
        .find(epoch_key)
        .select(storage_meta::value)
        .first(c)
        .optional()?;
    let epoch = sync_state
        .as_ref()
        .map(|s| s.epoch.clone())
        .or(local
            .map(EntityId::new)
            .transpose()
            .map_err(|_| invalid())?)
        .or_else(|| confirmed.first().map(|s| s.epoch.clone()))
        .ok_or_else(|| StorageFailure::unknown(StorageFailureCode::EpochMismatch))?;
    if confirmed.iter().any(|s| s.epoch != epoch) {
        return Err(invalid().into());
    }
    Ok(LocalSnapshot {
        storage_schema_version: SnapshotStorageVersion::new(version).map_err(|_| invalid())?,
        domain_schema_version: SnapshotDomainVersion::new(1).map_err(|_| invalid())?,
        profile_id: profile.clone(),
        space_id: space.clone(),
        epoch,
        aggregates,
        confirmed,
        pending,
        projections,
        sync_state,
    })
}

fn aggregate(
    (handle, space, revision, payload): (String, String, i64, String),
) -> Result<StoredAggregate, StorageFailure> {
    let row: StoredAggregate = decode(&payload)?;
    if row.handle.as_str() != handle
        || row.aggregate.id() != &row.handle
        || row.aggregate.space_id().as_str() != space
        || row.aggregate.revision().value() != revision
    {
        return Err(invalid());
    }
    Ok(row)
}
fn supported(c: &mut SqliteConnection) -> Result<u32, ReadError> {
    let meta: bool = diesel::select(diesel::dsl::exists(
        sqlite_master::table
            .filter(sqlite_master::type_.eq("table"))
            .filter(sqlite_master::name.eq("storage_meta")),
    ))
    .get_result(c)?;
    if !meta {
        return Err(StorageFailure::unknown(StorageFailureCode::UpdateRequired).into());
    }
    let storage: Option<String> = storage_meta::table
        .find("storageSchemaVersion")
        .select(storage_meta::value)
        .first(c)
        .optional()?;
    let domain: Option<String> = storage_meta::table
        .find("domainSchemaVersion")
        .select(storage_meta::value)
        .first(c)
        .optional()?;
    let version = match storage.as_deref() {
        Some("1") => 1,
        Some("2") => 2,
        Some("3" | "4") => {
            writer::receipts::read_schema(c)?;
            let original: i32 = wimm_native_schema::table
                .select(wimm_native_schema::original_version)
                .first(c)?;
            match original {
                1 => 1,
                2 => 2,
                _ => return Err(StorageFailure::unknown(StorageFailureCode::UpdateRequired).into()),
            }
        }
        _ => return Err(StorageFailure::unknown(StorageFailureCode::UpdateRequired).into()),
    };
    if !matches!(storage.as_deref(), Some("3" | "4")) {
        let extension: i64 = sqlite_master::table
            .filter(sqlite_master::name.eq_any([
                "wimm_native_schema",
                "wimm_native_receipts",
                "wimm_native_recovery",
                "wimm_native_receipts_by_area",
            ]))
            .count()
            .get_result(c)?;
        if extension != 0 {
            return Err(StorageFailure::unknown(StorageFailureCode::UpdateRequired).into());
        }
    }
    if domain.as_deref().is_some_and(|d| d != "1") {
        return Err(StorageFailure::unknown(StorageFailureCode::UpdateRequired).into());
    }
    if version == 2 {
        let journal: bool = diesel::select(diesel::dsl::exists(
            sqlite_master::table
                .filter(sqlite_master::type_.eq("table"))
                .filter(sqlite_master::name.eq("storage_migrations")),
        ))
        .get_result(c)?;
        if !journal || domain.as_deref() != Some("1") {
            return Err(StorageFailure::unknown(StorageFailureCode::UpdateRequired).into());
        }
        let number: Option<i32> = storage_migrations::table
            .select(diesel::dsl::max(storage_migrations::number))
            .first(c)?;
        let indexes: i64 = sqlite_master::table
            .filter(sqlite_master::type_.eq("index"))
            .filter(sqlite_master::name.eq_any([
                "transactions_by_account_date",
                "transactions_by_category_date",
                "transactions_by_import_reference",
                "outbox_by_state_created",
                "rules_by_order",
                "occurrences_by_schedule_date",
                "import_sources_by_external",
            ]))
            .count()
            .get_result(c)?;
        if number != Some(1) || indexes != 7 {
            return Err(StorageFailure::unknown(StorageFailureCode::UpdateRequired).into());
        }
    }
    Ok(version)
}

mod writer;
pub use writer::LegacySqliteWriter;

fn read_confirmed(
    c: &mut SqliteConnection,
    profile: &EntityId,
    space: &EntityId,
) -> Result<Vec<ConfirmedAggregate>, ReadError> {
    let rows: Vec<(String, String, String, i64, String)> = confirmed::table
        .filter(confirmed::profile_id.eq(profile.as_str()))
        .filter(confirmed::space_id.eq(space.as_str()))
        .order(confirmed::handle)
        .select((
            confirmed::handle,
            confirmed::space_id,
            confirmed::epoch,
            confirmed::revision,
            confirmed::payload,
        ))
        .load(c)?;
    let mut confirmed = Vec::new();
    for (handle, area, epoch, revision, payload) in rows {
        let row: ConfirmedAggregate = decode(&payload)?;
        if row.space_id.as_str() != area
            || row.epoch.as_str() != epoch
            || row.aggregate.handle.as_str() != handle
            || row.aggregate.aggregate.space_id().as_str() != area
            || row.aggregate.aggregate.id() != &row.aggregate.handle
            || row.aggregate.aggregate.revision().value() != revision
        {
            return Err(invalid().into());
        }
        confirmed.push(row);
    }

    Ok(confirmed)
}

fn read_pending(
    c: &mut SqliteConnection,
    profile: &EntityId,
    space: &EntityId,
) -> Result<Vec<PendingOperation>, ReadError> {
    let rows: Vec<(String, String, String)> = outbox::table
        .filter(outbox::profile_id.eq(profile.as_str()))
        .filter(outbox::space_id.eq(space.as_str()))
        .order(outbox::operation_id)
        .select((outbox::operation_id, outbox::state, outbox::payload))
        .load(c)?;
    let mut pending = Vec::new();
    for (id, state, payload) in rows {
        let row: PendingOperation = decode(&payload)?;
        let encoded = serde_json::to_value(row.state).map_err(|_| invalid())?;
        if row.operation_id.as_str() != id
            || &row.space_id != space
            || encoded.as_str() != Some(state.as_str())
        {
            return Err(invalid().into());
        }
        pending.push(row);
    }

    Ok(pending)
}

mod index_queries;

#[cfg(not(target_family = "wasm"))]
mod initial_schema;
