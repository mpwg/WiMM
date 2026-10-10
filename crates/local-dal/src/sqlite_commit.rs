// SPDX-License-Identifier: AGPL-3.0-or-later
//! Dauerhafte Operationsreceipts; kein Produktadapterfallback oder Finanzhandler.
use diesel::connection::SimpleConnection;
use diesel::prelude::*;
use sea_query::{Alias, ColumnDef, SqliteQueryBuilder, Table};
use sha2::{Digest, Sha256};
use std::cell::RefCell;
use std::collections::BTreeSet;
use wimm_finance_types::scalars::{EntityId, FileHash};
use wimm_local_contracts::{Validate, commit::*, persistence_errors::*, storage::*};
use wimm_persistence_contracts::CommitOutcome;
mod checkpoint_store;
use wimm_local_contracts::storage_port::{CancellationPort, NeverCancel};
#[cfg(feature = "receipt-probe")]
#[derive(Clone, Copy, PartialEq, Eq)]
pub enum CommitBoundary {
    AfterWrites,
    AfterCommit,
}

diesel::table! { wimm_local_schema (number) { number -> Integer, profile -> Text, } }
diesel::table! { wimm_local_areas (space) { space -> Text, epoch -> Text, } }
diesel::table! { wimm_local_aggregates (handle) { handle -> Text, space -> Text, revision -> BigInt, payload -> Text, } }
diesel::table! { wimm_local_pending (handle) { handle -> Text, space -> Text, payload -> Text, } }
diesel::table! { wimm_local_projections (handle) { handle -> Text, space -> Text, payload -> Text, } }
diesel::table! { wimm_local_receipts (identity) { identity -> Text, request -> Text, receipt -> Text, } }
diesel::table! { sqlite_master (name) { name -> Text, #[sql_name="type"] type_ -> Text, } }

fn failure(code: StorageFailureCode) -> StorageFailure {
    StorageFailure::not_committed(code)
}
enum TransactionError {
    Storage(StorageFailure),
    Database,
}
impl From<diesel::result::Error> for TransactionError {
    fn from(_: diesel::result::Error) -> Self {
        Self::Database
    }
}
impl From<StorageFailure> for TransactionError {
    fn from(e: StorageFailure) -> Self {
        Self::Storage(e)
    }
}
fn encode<T: serde::Serialize>(value: &T) -> Result<String, StorageFailure> {
    serde_json::to_string(value).map_err(|_| failure(StorageFailureCode::WriteFailed))
}
fn decode<T: serde::de::DeserializeOwned>(value: &str) -> Result<T, StorageFailure> {
    serde_json::from_str(value)
        .map_err(|_| StorageFailure::unknown(StorageFailureCode::InvalidResponse))
}
fn checked_receipt(
    payload: &str,
    key: &str,
    original: &str,
) -> Result<LocalCommitReceipt, StorageFailure> {
    let receipt: LocalCommitReceipt = decode(payload)?;
    let hash = Sha256::digest(original.as_bytes())
        .iter()
        .map(|b| format!("{b:02x}"))
        .collect::<String>();
    if encode(&receipt.identity)? != key || receipt.content_hash.as_str() != hash {
        return Err(StorageFailure::unknown(StorageFailureCode::InvalidResponse));
    }
    Ok(receipt)
}
fn projection(p: &StoredProjection) -> (&EntityId, &str, &str) {
    match p {
        StoredProjection::Balance { space_id, key, .. } => (space_id, "balance", key.as_str()),
        StoredProjection::AccountBalance { space_id, key, .. } => {
            (space_id, "accountBalance", key.as_str())
        }
        StoredProjection::Consumption { space_id, key, .. } => {
            (space_id, "consumption", key.as_str())
        }
    }
}
fn unique<T: Ord>(values: impl IntoIterator<Item = T>) -> bool {
    let mut seen = BTreeSet::new();
    values.into_iter().all(|v| seen.insert(v))
}
/// Verbindungsbesitz bleibt ausschließlich im Adapter; der Vertrag enthält keine Pfade/SQLobjekte.
pub struct SqliteCommitStore {
    connection: RefCell<SqliteConnection>,
    profile: EntityId,
    fail_before_receipt: bool,
    lose_response: bool,
    #[cfg(feature = "receipt-probe")]
    observer: Option<Box<dyn Fn(CommitBoundary)>>,
}
impl SqliteCommitStore {
    #[cfg(not(target_family = "wasm"))]
    pub fn open(path: &std::path::Path, profile: EntityId) -> Result<Self, StorageFailure> {
        Self::open_location(
            path.to_str()
                .ok_or_else(|| failure(StorageFailureCode::ResourceUnavailable))?,
            profile,
        )
    }
    #[cfg(target_family = "wasm")]
    pub async fn open_browser(profile: EntityId) -> Result<Self, StorageFailure> {
        let options = sqlite_wasm_vfs::sahpool::OpfsSAHPoolCfgBuilder::new()
            .directory(&format!("wimm-local-commit-{}", profile.as_str()))
            .build();
        sqlite_wasm_vfs::sahpool::install::<sqlite_wasm_rs::WasmOsCallback>(&options, false)
            .await
            .map_err(|_| failure(StorageFailureCode::ResourceUnavailable))?;
        Self::open_location("file:wimm-local-commit.db?vfs=opfs-sahpool", profile)
    }
    fn open_location(location: &str, profile: EntityId) -> Result<Self, StorageFailure> {
        let mut connection = SqliteConnection::establish(location)
            .map_err(|_| failure(StorageFailureCode::ResourceUnavailable))?;
        // Feste verbindungsbezogene Einstellungen: keine entsprechende Diesel-Query-DSL.
        connection
            .batch_execute(
                "PRAGMA busy_timeout=3000; PRAGMA foreign_keys=ON; PRAGMA synchronous=FULL;",
            )
            .map_err(|_| failure(StorageFailureCode::ResourceUnavailable))?;
        Ok(Self {
            connection: RefCell::new(connection),
            profile,
            fail_before_receipt: false,
            lose_response: false,
            #[cfg(feature = "receipt-probe")]
            observer: None,
        })
    }
    /// Nur die registrierte leere Initialschemaerzeugung eins; keine Bestandsmigration beim Öffnen.
    pub fn initialize_area(
        &mut self,
        space: &EntityId,
        proposed: &EntityId,
    ) -> Result<EntityId, StorageFailure> {
        let profile = self.profile.clone();
        let result = self
            .connection
            .get_mut()
            .immediate_transaction::<_, TransactionError, _>(|conn| {
                let count: i64 = sqlite_master::table
                    .filter(sqlite_master::name.eq("wimm_local_schema"))
                    .count()
                    .get_result(conn)?;
                if count == 0 {
                    let others: i64 = sqlite_master::table
                        .filter(sqlite_master::type_.eq("table"))
                        .count()
                        .get_result(conn)?;
                    if others != 0 {
                        return Err(failure(StorageFailureCode::UpdateRequired).into());
                    }
                    for (name, fields) in [
                        (
                            "wimm_local_schema",
                            vec![("number", true, true), ("profile", false, false)],
                        ),
                        (
                            "wimm_local_areas",
                            vec![("space", true, false), ("epoch", false, false)],
                        ),
                        (
                            "wimm_local_aggregates",
                            vec![
                                ("handle", true, false),
                                ("space", false, false),
                                ("revision", false, true),
                                ("payload", false, false),
                            ],
                        ),
                        (
                            "wimm_local_pending",
                            vec![
                                ("handle", true, false),
                                ("space", false, false),
                                ("payload", false, false),
                            ],
                        ),
                        (
                            "wimm_local_projections",
                            vec![
                                ("handle", true, false),
                                ("space", false, false),
                                ("payload", false, false),
                            ],
                        ),
                        (
                            "wimm_local_receipts",
                            vec![
                                ("identity", true, false),
                                ("request", false, false),
                                ("receipt", false, false),
                            ],
                        ),
                    ] {
                        let mut ddl = Table::create();
                        ddl.table(Alias::new(name));
                        for (field, primary, integer) in fields {
                            let mut column = ColumnDef::new(Alias::new(field));
                            if integer {
                                column.big_integer();
                            } else {
                                column.text();
                            }
                            column.not_null();
                            if primary {
                                column.primary_key();
                            }
                            ddl.col(column);
                        }
                        conn.batch_execute(&ddl.to_string(SqliteQueryBuilder))?;
                    }
                    diesel::insert_into(wimm_local_schema::table)
                        .values((
                            wimm_local_schema::number.eq(1),
                            wimm_local_schema::profile.eq(profile.as_str()),
                        ))
                        .execute(conn)?;
                }
                supported(conn, &profile)?;
                let old: Option<String> = wimm_local_areas::table
                    .find(space.as_str())
                    .select(wimm_local_areas::epoch)
                    .first(conn)
                    .optional()?;
                if let Some(old) = old {
                    return EntityId::new(old)
                        .map_err(|_| failure(StorageFailureCode::InvalidResponse).into());
                }
                diesel::insert_into(wimm_local_areas::table)
                    .values((
                        wimm_local_areas::space.eq(space.as_str()),
                        wimm_local_areas::epoch.eq(proposed.as_str()),
                    ))
                    .execute(conn)?;
                Ok(proposed.clone())
            });
        match result {
            Ok(epoch) => Ok(epoch),
            Err(TransactionError::Storage(e)) => Err(e),
            Err(TransactionError::Database) => {
                Err(StorageFailure::unknown(StorageFailureCode::WriteFailed))
            }
        }
    }
    pub fn inject_before_receipt_failure(&mut self) {
        self.fail_before_receipt = true;
    }
    pub fn inject_after_commit_response_loss(&mut self) {
        self.lose_response = true;
    }
    pub fn read_pending(&self, space: &EntityId) -> Result<Vec<PendingOperation>, StorageFailure> {
        let mut conn = self.connection.borrow_mut();
        supported(&mut conn, &self.profile).map_err(read_error)?;
        let rows: Vec<String> = wimm_local_pending::table
            .filter(wimm_local_pending::space.eq(space.as_str()))
            .order(wimm_local_pending::handle)
            .select(wimm_local_pending::payload)
            .load(&mut *conn)
            .map_err(|_| StorageFailure::unknown(StorageFailureCode::ResourceUnavailable))?;
        rows.iter().map(|v| decode(v)).collect()
    }
    pub fn read_projections(
        &self,
        space: &EntityId,
    ) -> Result<Vec<StoredProjection>, StorageFailure> {
        let mut conn = self.connection.borrow_mut();
        supported(&mut conn, &self.profile).map_err(read_error)?;
        let rows: Vec<String> = wimm_local_projections::table
            .filter(wimm_local_projections::space.eq(space.as_str()))
            .order(wimm_local_projections::handle)
            .select(wimm_local_projections::payload)
            .load(&mut *conn)
            .map_err(|_| StorageFailure::unknown(StorageFailureCode::ResourceUnavailable))?;
        rows.iter().map(|v| decode(v)).collect()
    }
    pub fn read_aggregate(
        &self,
        handle: &EntityId,
    ) -> Result<Option<StoredAggregate>, StorageFailure> {
        let mut conn = self.connection.borrow_mut();
        supported(&mut conn, &self.profile).map_err(read_error)?;
        let value: Option<String> = wimm_local_aggregates::table
            .find(handle.as_str())
            .select(wimm_local_aggregates::payload)
            .first(&mut *conn)
            .optional()
            .map_err(|_| StorageFailure::unknown(StorageFailureCode::ResourceUnavailable))?;
        value.map(|v| decode(&v)).transpose()
    }
}
fn read_error(e: TransactionError) -> StorageFailure {
    match e {
        TransactionError::Storage(e) => e,
        TransactionError::Database => {
            StorageFailure::unknown(StorageFailureCode::ResourceUnavailable)
        }
    }
}
fn supported(conn: &mut SqliteConnection, profile: &EntityId) -> Result<(), TransactionError> {
    let rows: Vec<(i32, String)> = wimm_local_schema::table
        .select((wimm_local_schema::number, wimm_local_schema::profile))
        .load(conn)?;
    if rows.len() != 1 || rows[0].0 != 1 {
        return Err(failure(StorageFailureCode::UpdateRequired).into());
    }
    if rows[0].1 != profile.as_str() {
        return Err(failure(StorageFailureCode::EpochMismatch).into());
    }
    Ok(())
}
impl SqliteCommitStore {
    #[cfg(feature = "receipt-probe")]
    pub fn observe_commit(&mut self, observer: impl Fn(CommitBoundary) + 'static) {
        self.observer = Some(Box::new(observer));
    }
    fn commit_observing(
        &mut self,
        request: LocalCommitRequest,
        cancellation: &dyn CancellationPort,
    ) -> LocalCommitOutcome {
        let identity = request.identity.clone();
        if identity.validate().is_err() {
            return CommitOutcome::NotCommitted {
                error: failure(StorageFailureCode::UpdateRequired),
            };
        }
        if identity.profile_id != self.profile {
            return CommitOutcome::NotCommitted {
                error: failure(StorageFailureCode::EpochMismatch),
            };
        }
        let prepared = (|| {
            let batch = &request.batch;
            if !unique(batch.expected_revisions.iter().map(|r| r.handle.as_str()))
                || !unique(batch.aggregates.iter().map(|a| a.handle.as_str()))
                || !unique(batch.outbox.iter().map(|p| p.operation_id.as_str()))
                || !unique(batch.projections.iter().map(projection))
                || batch.aggregates.iter().any(|a| {
                    a.handle != *a.aggregate.id() || a.aggregate.space_id() != &identity.space_id
                })
                || batch.outbox.iter().any(|p| p.space_id != identity.space_id)
                || batch
                    .projections
                    .iter()
                    .any(|p| projection(p).0 != &identity.space_id)
            {
                return Err(failure(StorageFailureCode::WriteFailed));
            }
            let text = encode(&request)?;
            let hash = Sha256::digest(text.as_bytes())
                .iter()
                .map(|b| format!("{b:02x}"))
                .collect::<String>();
            let receipt = LocalCommitReceipt {
                identity: identity.clone(),
                content_hash: FileHash::new(hash)
                    .map_err(|_| failure(StorageFailureCode::WriteFailed))?,
                committed_revisions: batch
                    .aggregates
                    .iter()
                    .map(|a| CommittedRevision {
                        handle: a.handle.clone(),
                        revision: a.aggregate.revision(),
                    })
                    .collect(),
            };
            Ok((encode(&identity)?, text, receipt))
        })();
        let (key, text, receipt) = match prepared {
            Ok(v) => v,
            Err(error) => return CommitOutcome::NotCommitted { error },
        };
        let profile = self.profile.clone();
        let inject = std::mem::take(&mut self.fail_before_receipt);
        let result = self
            .connection
            .get_mut()
            .immediate_transaction::<_, TransactionError, _>(|conn| {
                supported(conn, &profile)?;
                let previous: Option<(String, String)> = wimm_local_receipts::table
                    .find(&key)
                    .select((wimm_local_receipts::request, wimm_local_receipts::receipt))
                    .first(conn)
                    .optional()?;
                if let Some((original, value)) = previous {
                    let cached = checked_receipt(&value, &key, &original)?;
                    if original != text {
                        return Err(failure(StorageFailureCode::OperationIdReused).into());
                    }
                    return Ok(cached);
                }
                let epoch: Option<String> = wimm_local_areas::table
                    .find(identity.space_id.as_str())
                    .select(wimm_local_areas::epoch)
                    .first(conn)
                    .optional()?;
                if epoch.as_deref() != Some(identity.epoch.as_str()) {
                    return Err(failure(StorageFailureCode::EpochMismatch).into());
                }
                if cancellation.is_cancelled() {
                    return Err(failure(StorageFailureCode::Cancelled).into());
                }
                for expected in &request.batch.expected_revisions {
                    let actual: Option<(String, i64)> = wimm_local_aggregates::table
                        .find(expected.handle.as_str())
                        .select((
                            wimm_local_aggregates::space,
                            wimm_local_aggregates::revision,
                        ))
                        .first(conn)
                        .optional()?;
                    if actual
                        .as_ref()
                        .is_some_and(|(area, _)| area != identity.space_id.as_str())
                    {
                        return Err(failure(StorageFailureCode::WriteFailed).into());
                    }
                    if actual.map(|(_, revision)| revision).unwrap_or(0)
                        != expected.expected_revision.value()
                    {
                        return Err(failure(StorageFailureCode::RevisionConflict).into());
                    }
                }
                for a in &request.batch.aggregates {
                    let previous: Option<String> = wimm_local_aggregates::table
                        .find(a.handle.as_str())
                        .select(wimm_local_aggregates::space)
                        .first(conn)
                        .optional()?;
                    if previous
                        .as_deref()
                        .is_some_and(|v| v != identity.space_id.as_str())
                    {
                        return Err(failure(StorageFailureCode::WriteFailed).into());
                    }
                    diesel::insert_into(wimm_local_aggregates::table)
                        .values((
                            wimm_local_aggregates::handle.eq(a.handle.as_str()),
                            wimm_local_aggregates::space.eq(identity.space_id.as_str()),
                            wimm_local_aggregates::revision.eq(a.aggregate.revision().value()),
                            wimm_local_aggregates::payload.eq(encode(a)?),
                        ))
                        .on_conflict(wimm_local_aggregates::handle)
                        .do_update()
                        .set((
                            wimm_local_aggregates::revision.eq(a.aggregate.revision().value()),
                            wimm_local_aggregates::payload.eq(encode(a)?),
                        ))
                        .execute(conn)?;
                }
                for p in &request.batch.outbox {
                    let previous: Option<String> = wimm_local_pending::table
                        .find(p.operation_id.as_str())
                        .select(wimm_local_pending::space)
                        .first(conn)
                        .optional()?;
                    if previous
                        .as_deref()
                        .is_some_and(|v| v != identity.space_id.as_str())
                    {
                        return Err(failure(StorageFailureCode::WriteFailed).into());
                    }
                    diesel::insert_into(wimm_local_pending::table)
                        .values((
                            wimm_local_pending::handle.eq(p.operation_id.as_str()),
                            wimm_local_pending::space.eq(p.space_id.as_str()),
                            wimm_local_pending::payload.eq(encode(p)?),
                        ))
                        .on_conflict(wimm_local_pending::handle)
                        .do_update()
                        .set(wimm_local_pending::payload.eq(encode(p)?))
                        .execute(conn)?;
                }
                for p in &request.batch.projections {
                    let projected = projection(p);
                    let handle = encode(&(projected.0.as_str(), projected.1, projected.2))?;
                    diesel::insert_into(wimm_local_projections::table)
                        .values((
                            wimm_local_projections::handle.eq(&handle),
                            wimm_local_projections::space.eq(projected.0.as_str()),
                            wimm_local_projections::payload.eq(encode(p)?),
                        ))
                        .on_conflict(wimm_local_projections::handle)
                        .do_update()
                        .set(wimm_local_projections::payload.eq(encode(p)?))
                        .execute(conn)?;
                }
                #[cfg(feature = "receipt-probe")]
                if let Some(observer) = &self.observer {
                    observer(CommitBoundary::AfterWrites);
                }
                if cancellation.is_cancelled() {
                    return Err(failure(StorageFailureCode::Cancelled).into());
                }
                if inject {
                    return Err(failure(StorageFailureCode::WriteFailed).into());
                }
                diesel::insert_into(wimm_local_receipts::table)
                    .values((
                        wimm_local_receipts::identity.eq(&key),
                        wimm_local_receipts::request.eq(&text),
                        wimm_local_receipts::receipt.eq(encode(&receipt)?),
                    ))
                    .execute(conn)?;
                Ok(receipt.clone())
            });
        #[cfg(feature = "receipt-probe")]
        if result.is_ok()
            && let Some(observer) = &self.observer
        {
            observer(CommitBoundary::AfterCommit);
        }
        match result {
            Ok(_value) if std::mem::take(&mut self.lose_response) => {
                CommitOutcome::Unknown { identity }
            }
            Ok(value) => CommitOutcome::Committed { value },
            Err(TransactionError::Storage(error))
                if error.commit_state == FailureCommitState::Unknown =>
            {
                CommitOutcome::Unknown { identity }
            }
            Err(TransactionError::Storage(error)) => CommitOutcome::NotCommitted { error },
            // COMMIT-/Rollback-/IOfehler lassen den Ausgang konservativ offen; nie Meldungsanalyse.
            Err(TransactionError::Database) => CommitOutcome::Unknown { identity },
        }
    }
}
impl CancellableLocalCommitPort for SqliteCommitStore {
    fn commit_cancellable(
        &mut self,
        request: LocalCommitRequest,
        cancellation: &dyn CancellationPort,
    ) -> LocalCommitOutcome {
        self.commit_observing(request, cancellation)
    }
}
impl LocalCommitPort for SqliteCommitStore {
    fn commit(&mut self, request: LocalCommitRequest) -> LocalCommitOutcome {
        self.commit_observing(request, &NeverCancel)
    }
    fn lookup_result(
        &self,
        identity: &LocalOperationIdentity,
    ) -> Result<Option<LocalCommitReceipt>, StorageFailure> {
        identity
            .validate()
            .map_err(|_| failure(StorageFailureCode::UpdateRequired))?;
        if identity.profile_id != self.profile {
            return Err(failure(StorageFailureCode::EpochMismatch));
        }
        let mut conn = self.connection.borrow_mut();
        supported(&mut conn, &self.profile).map_err(read_error)?;
        let key = encode(identity)?;
        let payload: Option<(String, String)> = wimm_local_receipts::table
            .find(&key)
            .select((wimm_local_receipts::request, wimm_local_receipts::receipt))
            .first(&mut *conn)
            .optional()
            .map_err(|_| StorageFailure::unknown(StorageFailureCode::ResourceUnavailable))?;
        payload
            .map(|(original, value)| checked_receipt(&value, &key, &original))
            .transpose()
    }
}
