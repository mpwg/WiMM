// SPDX-License-Identifier: AGPL-3.0-or-later
//! Atomare ORM-Ports auf denselben Bestandstabellen; keine Migration beim Öffnen.
use super::*;
use std::collections::BTreeSet;
use wimm_local_contracts::{commit::SnapshotValidationPort, storage_port::LocalStoragePort};
fn fail(code: StorageFailureCode) -> ReadError {
    StorageFailure::not_committed(code).into()
}
fn text<T: serde::Serialize + ?Sized>(v: &T) -> Result<String, ReadError> {
    serde_json::to_string(v).map_err(|_| fail(StorageFailureCode::WriteFailed))
}
fn unique<T: Ord>(items: impl Iterator<Item = T>) -> bool {
    let mut seen = BTreeSet::new();
    items.into_iter().all(|i| seen.insert(i))
}
fn projection_key(p: &StoredProjection) -> (&EntityId, &str, &str) {
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
fn epoch_key(profile: &EntityId, space: &EntityId) -> String {
    format!(
        "serverEpoch:{}",
        serde_json::json!([profile.as_str(), space.as_str()])
    )
}
fn write_epoch(
    c: &mut SqliteConnection,
    profile: &EntityId,
    space: &EntityId,
    epoch: &EntityId,
) -> Result<(), ReadError> {
    diesel::insert_into(storage_meta::table)
        .values((
            storage_meta::key.eq(epoch_key(profile, space)),
            storage_meta::value.eq(epoch.as_str()),
        ))
        .on_conflict(storage_meta::key)
        .do_update()
        .set(storage_meta::value.eq(epoch.as_str()))
        .execute(c)?;
    Ok(())
}
fn write_projections(
    c: &mut SqliteConnection,
    profile: &EntityId,
    values: &[StoredProjection],
) -> Result<(), ReadError> {
    if !unique(values.iter().map(projection_key)) {
        return Err(fail(StorageFailureCode::WriteFailed));
    }
    for p in values {
        let (space, kind, key) = projection_key(p);
        diesel::insert_into(projections::table)
            .values((
                projections::profile_id.eq(profile.as_str()),
                projections::space_id.eq(space.as_str()),
                projections::projection_kind.eq(kind),
                projections::projection_key.eq(key),
                projections::payload.eq(text(p)?),
            ))
            .on_conflict((
                projections::profile_id,
                projections::space_id,
                projections::projection_kind,
                projections::projection_key,
            ))
            .do_update()
            .set(projections::payload.eq(text(p)?))
            .execute(c)?;
    }
    Ok(())
}
fn write_batch(
    c: &mut SqliteConnection,
    profile: &EntityId,
    batch: &AtomicBatch,
) -> Result<(), ReadError> {
    if !unique(batch.expected_revisions.iter().map(|r| r.handle.as_str()))
        || !unique(batch.aggregates.iter().map(|r| r.handle.as_str()))
        || !unique(batch.outbox.iter().map(|r| r.operation_id.as_str()))
    {
        return Err(fail(StorageFailureCode::WriteFailed));
    }
    for expected in &batch.expected_revisions {
        let current: Option<i64> = aggregates::table
            .filter(aggregates::profile_id.eq(profile.as_str()))
            .filter(aggregates::handle.eq(expected.handle.as_str()))
            .select(aggregates::revision)
            .first(c)
            .optional()?;
        if current.unwrap_or(0) != expected.expected_revision.value() {
            return Err(fail(StorageFailureCode::RevisionConflict));
        }
    }
    for a in &batch.aggregates {
        if a.handle != *a.aggregate.id() {
            return Err(fail(StorageFailureCode::WriteFailed));
        }
        let old: Option<String> = aggregates::table
            .filter(aggregates::profile_id.eq(profile.as_str()))
            .filter(aggregates::handle.eq(a.handle.as_str()))
            .select(aggregates::space_id)
            .first(c)
            .optional()?;
        if old
            .as_ref()
            .is_some_and(|s| s != a.aggregate.space_id().as_str())
        {
            return Err(fail(StorageFailureCode::WriteFailed));
        }
        diesel::insert_into(aggregates::table)
            .values((
                aggregates::profile_id.eq(profile.as_str()),
                aggregates::handle.eq(a.handle.as_str()),
                aggregates::space_id.eq(a.aggregate.space_id().as_str()),
                aggregates::revision.eq(a.aggregate.revision().value()),
                aggregates::payload.eq(text(a)?),
            ))
            .on_conflict((aggregates::profile_id, aggregates::handle))
            .do_update()
            .set((
                aggregates::revision.eq(diesel::upsert::excluded(aggregates::revision)),
                aggregates::payload.eq(diesel::upsert::excluded(aggregates::payload)),
            ))
            .execute(c)?;
    }
    for p in &batch.outbox {
        check_pending(p)?;
        let old: Option<String> = outbox::table
            .filter(outbox::profile_id.eq(profile.as_str()))
            .filter(outbox::operation_id.eq(p.operation_id.as_str()))
            .select(outbox::space_id)
            .first(c)
            .optional()?;
        if old.as_ref().is_some_and(|s| s != p.space_id.as_str()) {
            return Err(fail(StorageFailureCode::WriteFailed));
        }
        let state =
            serde_json::to_value(p.state).map_err(|_| fail(StorageFailureCode::WriteFailed))?;
        let state = state
            .as_str()
            .ok_or_else(|| fail(StorageFailureCode::WriteFailed))?;
        diesel::insert_into(outbox::table)
            .values((
                outbox::profile_id.eq(profile.as_str()),
                outbox::operation_id.eq(p.operation_id.as_str()),
                outbox::space_id.eq(p.space_id.as_str()),
                outbox::state.eq(state),
                outbox::payload.eq(text(p)?),
            ))
            .on_conflict((outbox::profile_id, outbox::operation_id))
            .do_update()
            .set((outbox::state.eq(state), outbox::payload.eq(text(p)?)))
            .execute(c)?;
    }
    write_projections(c, profile, &batch.projections)
}
/// Jeder Write besitzt genau eine unmittelbare SQLite-Transaktion.
/// Finanz-/Cacheprüfung beim Snapshot-/Projektionsersatz wird zwingend injiziert.
pub struct SqliteWriter<V> {
    pub(super) store: SqliteStore,
    validator: V,
    #[cfg(feature = "receipt-probe")]
    pub(super) query_plans: RefCell<Vec<String>>,
}
impl<V: SnapshotValidationPort> SqliteWriter<V> {
    #[cfg(not(target_family = "wasm"))]
    pub fn open(
        path: &std::path::Path,
        profile: EntityId,
        validator: V,
    ) -> Result<Self, StorageFailure> {
        Ok(Self {
            store: SqliteStore::open_mode(path, profile, true)?,
            validator,
            #[cfg(feature = "receipt-probe")]
            query_plans: RefCell::new(Vec::new()),
        })
    }
    /// Derselbe profilgebundene Writer auf einer bereits tatsächlich geöffneten nativen/WASM-Verbindung.
    pub fn from_connection(
        connection: SqliteConnection,
        profile: EntityId,
        validator: V,
    ) -> Result<Self, StorageFailure> {
        Ok(Self {
            store: SqliteStore::from_connection(connection, profile)?,
            validator,
            #[cfg(feature = "receipt-probe")]
            query_plans: RefCell::new(Vec::new()),
        })
    }
    #[cfg(feature = "receipt-probe")]
    pub fn take_index_query_plans(&self) -> Vec<String> {
        std::mem::take(&mut *self.query_plans.borrow_mut())
    }
    /// Ausschließlich diagnostischer nativer Testport; begrenzt den realen SQLite-Pager auf die aktuelle Dateigröße.
    #[cfg(all(feature = "receipt-probe", not(target_family = "wasm")))]
    pub fn limit_to_current_page_count_for_probe(&mut self) -> Result<(), StorageFailure> {
        #[derive(diesel::QueryableByName)]
        struct Pages {
            #[diesel(sql_type=diesel::sql_types::BigInt)]
            page_count: i64,
        }
        let c = self.store.connection.get_mut();
        let pages = diesel::sql_query("PRAGMA page_count")
            .get_result::<Pages>(c)
            .map_err(database)?
            .page_count;
        // SQLite-PRAGMAs besitzen keinen bindbaren DSL-Parameter; Wert kommt ausschließlich aus SQLite.
        c.batch_execute(&format!("PRAGMA max_page_count={pages}"))
            .map_err(database)
    }
    /// Runtimewrites benötigen ausschließlich das vollständige aktuelle Schema.
    pub fn ensure_runtime_schema(&self) -> Result<(), StorageFailure> {
        self.store
            .connection
            .borrow_mut()
            .transaction::<_, ReadError, _>(|c| {
                supported(c)?;
                Ok(())
            })
            .map_err(|e| e.0)
    }
    /// Finanzlesestand und lokale Schreibepoche stammen aus derselben tatsächlichen Lesetransaktion.
    pub fn mutation_snapshot(
        &self,
        space: &EntityId,
    ) -> Result<(LocalSnapshot, EntityId), StorageFailure> {
        self.store
            .connection
            .borrow_mut()
            .transaction::<_, ReadError, _>(|c| {
                let snapshot = snapshot(c, &self.store.profile, space)?;
                let epoch = local_write_epoch(c, &self.store.profile, space)?;
                Ok((snapshot, epoch))
            })
            .map_err(|e| e.0)
    }
    fn write<T>(
        &mut self,
        work: impl FnOnce(&mut SqliteConnection, &EntityId, &V) -> Result<T, ReadError>,
    ) -> Result<T, StorageFailure> {
        let profile = &self.store.profile;
        let validator = &self.validator;
        self.store
            .connection
            .get_mut()
            .immediate_transaction::<_, ReadError, _>(|c| {
                supported(c)?;
                work(c, profile, validator)
            })
            .map_err(|e| e.0)
    }
}
impl<V: SnapshotValidationPort> LocalStoragePort for SqliteWriter<V> {
    type Error = StorageFailure;
    fn read_aggregate(&self, id: &EntityId) -> Result<Option<StoredAggregate>, StorageFailure> {
        self.store.read_aggregate(id)
    }
    fn query(&self, q: AggregateQuery) -> Result<Vec<StoredAggregate>, StorageFailure> {
        self.store
            .connection
            .borrow_mut()
            .transaction::<_, ReadError, _>(|c| {
                supported(c)?;
                let rows: Vec<(String, String, i64, String)> = aggregates::table
                    .filter(aggregates::profile_id.eq(self.store.profile.as_str()))
                    .filter(aggregates::space_id.eq(q.space_id.as_str()))
                    .order(aggregates::handle)
                    .select((
                        aggregates::handle,
                        aggregates::space_id,
                        aggregates::revision,
                        aggregates::payload,
                    ))
                    .load(c)?;
                rows.into_iter()
                    .map(aggregate)
                    .collect::<Result<_, _>>()
                    .map_err(Into::into)
            })
            .map_err(|e| e.0)
    }
    fn export_snapshot(&self, space: &EntityId) -> Result<LocalSnapshot, StorageFailure> {
        self.store.export_snapshot(space)
    }
    fn load_confirmed(&self, space: &EntityId) -> Result<Vec<ConfirmedAggregate>, StorageFailure> {
        self.store
            .connection
            .borrow_mut()
            .transaction::<_, ReadError, _>(|c| {
                supported(c)?;
                read_confirmed(c, &self.store.profile, space)
            })
            .map_err(|e| e.0)
    }
    fn load_pending(&self, space: &EntityId) -> Result<Vec<PendingOperation>, StorageFailure> {
        self.store
            .connection
            .borrow_mut()
            .transaction::<_, ReadError, _>(|c| {
                supported(c)?;
                read_pending(c, &self.store.profile, space)
            })
            .map_err(|e| e.0)
    }
    fn get_sync_state(&self, space: &EntityId) -> Result<Option<SyncState>, StorageFailure> {
        self.store
            .connection
            .borrow_mut()
            .transaction::<_, ReadError, _>(|c| {
                supported(c)?;
                read_sync(c, &self.store.profile, space)
            })
            .map_err(|e| e.0)
    }
    fn initialize_area(
        &mut self,
        space: &EntityId,
        proposed: &EntityId,
    ) -> Result<EntityId, StorageFailure> {
        self.write(|c, profile, _| {
            let write: Option<String> = storage_meta::table
                .find(local_write_key(profile, space))
                .select(storage_meta::value)
                .first(c)
                .optional()?;
            if let Some(epoch) = write {
                return EntityId::new(epoch).map_err(|_| invalid().into());
            }
            let local: Option<String> = storage_meta::table
                .find(epoch_key(profile, space))
                .select(storage_meta::value)
                .first(c)
                .optional()?;
            let current = read_sync(c, profile, space)?;
            let confirmed_epoch: Option<String> = confirmed::table
                .filter(confirmed::profile_id.eq(profile.as_str()))
                .filter(confirmed::space_id.eq(space.as_str()))
                .order(confirmed::handle)
                .select(confirmed::epoch)
                .first(c)
                .optional()?;
            let epoch = local
                .or(current.map(|s| s.epoch.as_str().to_owned()))
                .or(confirmed_epoch)
                .map(EntityId::new)
                .transpose()
                .map_err(|_| invalid())?
                .unwrap_or_else(|| proposed.clone());
            write_epoch(c, profile, space, &epoch)?;
            write_local_epoch(c, profile, space, &epoch)?;
            Ok(epoch)
        })
    }
    fn apply_atomic_batch(&mut self, batch: AtomicBatch) -> Result<(), StorageFailure> {
        self.write(|c, p, _| write_batch(c, p, &batch))
    }
    fn save_sync_page(&mut self, page: SyncPage) -> Result<(), StorageFailure> {
        self.write(|c, profile, _| {
            let space = &page.state.space_id;
            if page.state.profile_id != *profile
                || !page.state.check_cursor()
                || !unique(page.confirmed.iter().map(|a| a.aggregate.handle.as_str()))
                || !unique(page.remove_operation_ids.iter().map(EntityId::as_str))
            {
                return Err(fail(StorageFailureCode::WriteFailed));
            }
            let local: Option<String> = storage_meta::table
                .find(epoch_key(profile, space))
                .select(storage_meta::value)
                .first(c)
                .optional()?;
            if local
                .as_ref()
                .is_some_and(|e| e != page.state.epoch.as_str())
                || read_sync(c, profile, space)?.is_some_and(|s| s.epoch != page.state.epoch)
            {
                return Err(fail(StorageFailureCode::EpochMismatch));
            }
            let existing: Vec<String> = confirmed::table
                .filter(confirmed::profile_id.eq(profile.as_str()))
                .filter(confirmed::space_id.eq(space.as_str()))
                .select(confirmed::epoch)
                .load(c)?;
            if existing.iter().any(|e| e != page.state.epoch.as_str())
                || page
                    .projections
                    .iter()
                    .any(|p| projection_key(p).0 != space)
            {
                return Err(fail(StorageFailureCode::EpochMismatch));
            }
            for a in &page.confirmed {
                if a.space_id != *space
                    || a.epoch != page.state.epoch
                    || a.aggregate.aggregate.space_id() != space
                    || a.aggregate.handle != *a.aggregate.aggregate.id()
                {
                    return Err(fail(StorageFailureCode::EpochMismatch));
                }
                let old: Option<String> = confirmed::table
                    .filter(confirmed::profile_id.eq(profile.as_str()))
                    .filter(confirmed::handle.eq(a.aggregate.handle.as_str()))
                    .select(confirmed::space_id)
                    .first(c)
                    .optional()?;
                if old.as_ref().is_some_and(|s| s != space.as_str()) {
                    return Err(fail(StorageFailureCode::WriteFailed));
                }
                diesel::insert_into(confirmed::table)
                    .values((
                        confirmed::profile_id.eq(profile.as_str()),
                        confirmed::handle.eq(a.aggregate.handle.as_str()),
                        confirmed::space_id.eq(space.as_str()),
                        confirmed::epoch.eq(a.epoch.as_str()),
                        confirmed::revision.eq(a.aggregate.aggregate.revision().value()),
                        confirmed::payload.eq(text(a)?),
                    ))
                    .on_conflict((confirmed::profile_id, confirmed::handle))
                    .do_update()
                    .set((
                        confirmed::epoch.eq(a.epoch.as_str()),
                        confirmed::revision.eq(a.aggregate.aggregate.revision().value()),
                        confirmed::payload.eq(text(a)?),
                    ))
                    .execute(c)?;
            }
            for id in &page.remove_operation_ids {
                let old: Option<String> = outbox::table
                    .filter(outbox::profile_id.eq(profile.as_str()))
                    .filter(outbox::operation_id.eq(id.as_str()))
                    .select(outbox::space_id)
                    .first(c)
                    .optional()?;
                if old.as_ref().is_some_and(|s| s != space.as_str()) {
                    return Err(fail(StorageFailureCode::WriteFailed));
                }
                diesel::delete(
                    outbox::table
                        .filter(outbox::profile_id.eq(profile.as_str()))
                        .filter(outbox::operation_id.eq(id.as_str())),
                )
                .execute(c)?;
            }
            write_projections(c, profile, &page.projections)?;
            diesel::insert_into(sync_state::table)
                .values((
                    sync_state::profile_id.eq(profile.as_str()),
                    sync_state::space_id.eq(space.as_str()),
                    sync_state::epoch.eq(page.state.epoch.as_str()),
                    sync_state::cursor.eq(&page.state.cursor),
                ))
                .on_conflict((sync_state::profile_id, sync_state::space_id))
                .do_update()
                .set((
                    sync_state::epoch.eq(page.state.epoch.as_str()),
                    sync_state::cursor.eq(&page.state.cursor),
                ))
                .execute(c)?;
            write_epoch(c, profile, space, &page.state.epoch)
        })
    }
    fn replace_snapshot(&mut self, s: LocalSnapshot) -> Result<(), StorageFailure> {
        self.write(|c, p, v| replace_in_transaction(c, p, v, &s))
    }
    fn rebuild_projections(&mut self, r: ProjectionRebuild) -> Result<(), StorageFailure> {
        self.write(|c, p, v| {
            let mut current = snapshot_with_projections(c, p, &r.space_id, Some(&r.projections))?;
            let mut expected = r.source_aggregates.clone();
            expected.sort_by(|a, b| a.handle.as_str().cmp(b.handle.as_str()));
            if text(&current.aggregates)? != text(&expected)? {
                return Err(fail(StorageFailureCode::RevisionConflict));
            }
            if !unique(r.projections.iter().map(projection_key))
                || r.projections
                    .iter()
                    .any(|a| projection_key(a).0 != &r.space_id)
            {
                return Err(fail(StorageFailureCode::WriteFailed));
            }
            current.projections = r.projections.clone();
            v.validate(&current)?;
            diesel::delete(
                projections::table
                    .filter(projections::profile_id.eq(p.as_str()))
                    .filter(projections::space_id.eq(r.space_id.as_str())),
            )
            .execute(c)?;
            write_projections(c, p, &r.projections)
        })
    }
}
fn read_sync(
    c: &mut SqliteConnection,
    p: &EntityId,
    s: &EntityId,
) -> Result<Option<SyncState>, ReadError> {
    let row: Option<(String, String)> = sync_state::table
        .filter(sync_state::profile_id.eq(p.as_str()))
        .filter(sync_state::space_id.eq(s.as_str()))
        .select((sync_state::epoch, sync_state::cursor))
        .first(c)
        .optional()?;
    row.map(|(epoch, cursor)| {
        let state = SyncState {
            profile_id: p.clone(),
            space_id: s.clone(),
            epoch: EntityId::new(epoch).map_err(|_| invalid())?,
            cursor,
        };
        if !state.check_cursor() {
            return Err(invalid().into());
        }
        Ok(state)
    })
    .transpose()
}

fn check_pending(p: &PendingOperation) -> Result<(), ReadError> {
    if !unique(p.expected_revisions.iter().map(|r| r.handle.as_str()))
        || !unique(p.depends_on.iter().map(EntityId::as_str))
    {
        return Err(fail(StorageFailureCode::WriteFailed));
    }
    if let Some(object) = p.draft.0.as_object() {
        if object
            .get("spaceId")
            .is_some_and(|v| v.as_str() != Some(p.space_id.as_str()))
        {
            return Err(fail(StorageFailureCode::WriteFailed));
        }
        if let Some(rows) = object.get("aggregates") {
            let rows = rows
                .as_array()
                .ok_or_else(|| fail(StorageFailureCode::WriteFailed))?;
            for row in rows {
                let a: wimm_finance_types::models::Aggregate =
                    wimm_local_contracts::storage::decode_draft_aggregate(row)
                        .map_err(|_| fail(StorageFailureCode::WriteFailed))?;
                if a.space_id() != &p.space_id {
                    return Err(fail(StorageFailureCode::WriteFailed));
                }
            }
        }
    }
    Ok(())
}

pub(super) mod receipts;

fn local_write_key(profile: &EntityId, space: &EntityId) -> String {
    format!(
        "localWriteEpoch:{}",
        serde_json::json!([profile.as_str(), space.as_str()])
    )
}
fn write_local_epoch(
    c: &mut SqliteConnection,
    profile: &EntityId,
    space: &EntityId,
    epoch: &EntityId,
) -> Result<(), ReadError> {
    diesel::insert_into(storage_meta::table)
        .values((
            storage_meta::key.eq(local_write_key(profile, space)),
            storage_meta::value.eq(epoch.as_str()),
        ))
        .on_conflict(storage_meta::key)
        .do_update()
        .set(storage_meta::value.eq(epoch.as_str()))
        .execute(c)?;
    Ok(())
}
fn local_write_epoch(
    c: &mut SqliteConnection,
    profile: &EntityId,
    space: &EntityId,
) -> Result<EntityId, ReadError> {
    let epoch: String = storage_meta::table
        .find(local_write_key(profile, space))
        .select(storage_meta::value)
        .first(c)?;
    EntityId::new(epoch).map_err(|_| invalid().into())
}

fn replace_in_transaction(
    c: &mut SqliteConnection,
    p: &EntityId,
    v: &dyn SnapshotValidationPort,
    s: &LocalSnapshot,
) -> Result<(), ReadError> {
    if !s.check_versions() || s.storage_schema_version.value() != supported(c)? {
        return Err(fail(StorageFailureCode::UpdateRequired));
    }
    if s.profile_id != *p
        || !unique(s.aggregates.iter().map(|a| a.handle.as_str()))
        || !unique(s.confirmed.iter().map(|a| a.aggregate.handle.as_str()))
        || !unique(s.pending.iter().map(|a| a.operation_id.as_str()))
        || !unique(s.projections.iter().map(projection_key))
    {
        return Err(fail(StorageFailureCode::WriteFailed));
    }
    if s.aggregates
        .iter()
        .any(|a| a.aggregate.space_id() != &s.space_id || a.aggregate.id() != &a.handle)
        || s.confirmed.iter().any(|a| {
            a.space_id != s.space_id
                || a.epoch != s.epoch
                || a.aggregate.aggregate.space_id() != &s.space_id
                || a.aggregate.aggregate.id() != &a.aggregate.handle
        })
        || s.pending.iter().any(|a| a.space_id != s.space_id)
        || s.projections
            .iter()
            .any(|a| projection_key(a).0 != &s.space_id)
        || s.sync_state.as_ref().is_some_and(|a| {
            a.profile_id != *p
                || a.space_id != s.space_id
                || a.epoch != s.epoch
                || !a.check_cursor()
        })
    {
        return Err(fail(StorageFailureCode::WriteFailed));
    }
    for pending in &s.pending {
        check_pending(pending)?;
    }
    v.validate(s)?;
    // Fremde Bereichshandles prüfen, bevor der vorhandene Bereich gelöscht wird.
    for a in &s.aggregates {
        let old: Option<String> = aggregates::table
            .filter(aggregates::profile_id.eq(p.as_str()))
            .filter(aggregates::handle.eq(a.handle.as_str()))
            .select(aggregates::space_id)
            .first(c)
            .optional()?;
        if old.as_ref().is_some_and(|x| x != s.space_id.as_str()) {
            return Err(fail(StorageFailureCode::WriteFailed));
        }
    }
    for a in &s.confirmed {
        let old: Option<String> = confirmed::table
            .filter(confirmed::profile_id.eq(p.as_str()))
            .filter(confirmed::handle.eq(a.aggregate.handle.as_str()))
            .select(confirmed::space_id)
            .first(c)
            .optional()?;
        if old.as_ref().is_some_and(|x| x != s.space_id.as_str()) {
            return Err(fail(StorageFailureCode::WriteFailed));
        }
    }
    for a in &s.pending {
        let old: Option<String> = outbox::table
            .filter(outbox::profile_id.eq(p.as_str()))
            .filter(outbox::operation_id.eq(a.operation_id.as_str()))
            .select(outbox::space_id)
            .first(c)
            .optional()?;
        if old.as_ref().is_some_and(|x| x != s.space_id.as_str()) {
            return Err(fail(StorageFailureCode::WriteFailed));
        }
    }
    diesel::delete(
        aggregates::table
            .filter(aggregates::profile_id.eq(p.as_str()))
            .filter(aggregates::space_id.eq(s.space_id.as_str())),
    )
    .execute(c)?;
    diesel::delete(
        confirmed::table
            .filter(confirmed::profile_id.eq(p.as_str()))
            .filter(confirmed::space_id.eq(s.space_id.as_str())),
    )
    .execute(c)?;
    diesel::delete(
        outbox::table
            .filter(outbox::profile_id.eq(p.as_str()))
            .filter(outbox::space_id.eq(s.space_id.as_str())),
    )
    .execute(c)?;
    diesel::delete(
        projections::table
            .filter(projections::profile_id.eq(p.as_str()))
            .filter(projections::space_id.eq(s.space_id.as_str())),
    )
    .execute(c)?;
    diesel::delete(
        sync_state::table
            .filter(sync_state::profile_id.eq(p.as_str()))
            .filter(sync_state::space_id.eq(s.space_id.as_str())),
    )
    .execute(c)?;
    write_batch(
        c,
        p,
        &AtomicBatch {
            expected_revisions: vec![],
            aggregates: s.aggregates.clone(),
            outbox: s.pending.clone(),
            projections: s.projections.clone(),
        },
    )?;
    for a in &s.confirmed {
        diesel::insert_into(confirmed::table)
            .values((
                confirmed::profile_id.eq(p.as_str()),
                confirmed::handle.eq(a.aggregate.handle.as_str()),
                confirmed::space_id.eq(s.space_id.as_str()),
                confirmed::epoch.eq(a.epoch.as_str()),
                confirmed::revision.eq(a.aggregate.aggregate.revision().value()),
                confirmed::payload.eq(text(a)?),
            ))
            .execute(c)?;
    }
    if let Some(state) = &s.sync_state {
        diesel::insert_into(sync_state::table)
            .values((
                sync_state::profile_id.eq(p.as_str()),
                sync_state::space_id.eq(s.space_id.as_str()),
                sync_state::epoch.eq(state.epoch.as_str()),
                sync_state::cursor.eq(&state.cursor),
            ))
            .execute(c)?;
    }
    write_epoch(c, p, &s.space_id, &s.epoch)?;
    let local: Option<String> = storage_meta::table
        .find(local_write_key(p, &s.space_id))
        .select(storage_meta::value)
        .first(c)
        .optional()?;
    if local.is_none() {
        write_local_epoch(c, p, &s.space_id, &s.epoch)?;
    }
    Ok(())
}
