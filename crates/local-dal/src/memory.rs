// SPDX-License-Identifier: AGPL-3.0-or-later
//! Atomare in-memory Referenz; fachliche Snapshotvalidierung ausschließlich injiziert.
use std::collections::BTreeMap;
use wimm_finance_types::scalars::EntityId;
use wimm_local_contracts::{
    commit::*,
    persistence_errors::{StorageFailure, StorageFailureCode},
    storage::*,
};
#[derive(Clone, Default)]
struct State {
    aggregates: BTreeMap<String, StoredAggregate>,
    confirmed: BTreeMap<String, ConfirmedAggregate>,
    pending: BTreeMap<String, PendingOperation>,
    projections: BTreeMap<String, StoredProjection>,
    sync: BTreeMap<String, SyncState>,
    epochs: BTreeMap<String, EntityId>,
    versions: BTreeMap<String, SnapshotStorageVersion>,
}
pub struct MemoryStorage<V> {
    profile_id: EntityId,
    validator: V,
    state: State,
    receipts: BTreeMap<String, (LocalCommitRequest, LocalCommitReceipt)>,
    fail_next: bool,
    lose_next: bool,
}
impl<V: SnapshotValidationPort> MemoryStorage<V> {
    pub fn new(profile_id: EntityId, validator: V) -> Self {
        Self {
            profile_id,
            validator,
            state: State::default(),
            receipts: BTreeMap::new(),
            fail_next: false,
            lose_next: false,
        }
    }
    pub fn profile_id(&self) -> &EntityId {
        &self.profile_id
    }
    pub fn inject_before_commit_failure(&mut self) {
        self.fail_next = true;
    }
    pub fn inject_after_commit_response_loss(&mut self) {
        self.lose_next = true;
    }
    fn publish(&mut self, state: State) -> Result<(), StorageFailure> {
        if std::mem::take(&mut self.fail_next) {
            return Err(error(StorageFailureCode::WriteFailed));
        }
        self.state = state;
        Ok(())
    }
}
fn error(code: StorageFailureCode) -> StorageFailure {
    StorageFailure::not_committed(code)
}
fn space(p: &StoredProjection) -> &EntityId {
    match p {
        StoredProjection::Balance { space_id, .. }
        | StoredProjection::AccountBalance { space_id, .. }
        | StoredProjection::Consumption { space_id, .. } => space_id,
    }
}
fn projection_key(p: &StoredProjection) -> String {
    let (kind, key) = match p {
        StoredProjection::Balance { key, .. } => ("balance", key.as_str()),
        StoredProjection::AccountBalance { key, .. } => ("accountBalance", key.as_str()),
        StoredProjection::Consumption { key, .. } => ("consumption", key.as_str()),
    };
    serde_json::to_string(&(space(p).as_str(), kind, key)).expect("Geprüfter Projektschlüssel")
}
fn same<T: serde::Serialize>(a: &T, b: &T) -> bool {
    match (serde_json::to_value(a), serde_json::to_value(b)) {
        (Ok(a), Ok(b)) => a == b,
        _ => false,
    }
}
fn batch(state: &mut State, input: AtomicBatch) -> Result<(), StorageFailure> {
    if !unique(input.expected_revisions.iter().map(|r| r.handle.as_str()))
        || !unique(input.aggregates.iter().map(|a| a.handle.as_str()))
        || !unique(input.outbox.iter().map(|p| p.operation_id.as_str()))
        || !unique(input.projections.iter().map(projection_key))
    {
        return Err(error(StorageFailureCode::WriteFailed));
    }
    for expected in &input.expected_revisions {
        let actual = state
            .aggregates
            .get(expected.handle.as_str())
            .map(|a| a.aggregate.revision().value())
            .unwrap_or(0);
        if actual != expected.expected_revision.value() {
            return Err(error(StorageFailureCode::RevisionConflict));
        }
    }
    for entry in input.aggregates {
        if entry.handle != *entry.aggregate.id() {
            return Err(error(StorageFailureCode::WriteFailed));
        }
        if state
            .aggregates
            .get(entry.handle.as_str())
            .is_some_and(|a| a.aggregate.space_id() != entry.aggregate.space_id())
        {
            return Err(error(StorageFailureCode::WriteFailed));
        }
        state.aggregates.insert(entry.handle.as_str().into(), entry);
    }
    for entry in input.outbox {
        if state
            .pending
            .get(entry.operation_id.as_str())
            .is_some_and(|v| v.space_id != entry.space_id)
        {
            return Err(error(StorageFailureCode::WriteFailed));
        }
        state
            .pending
            .insert(entry.operation_id.as_str().into(), entry);
    }
    for entry in input.projections {
        state.projections.insert(projection_key(&entry), entry);
    }
    Ok(())
}
fn clear_space(state: &mut State, id: &EntityId) {
    state.aggregates.retain(|_, v| v.aggregate.space_id() != id);
    state.confirmed.retain(|_, v| &v.space_id != id);
    state.pending.retain(|_, v| &v.space_id != id);
    state.projections.retain(|_, v| space(v) != id);
    state.sync.remove(id.as_str());
    state.epochs.remove(id.as_str());
}
impl<V: SnapshotValidationPort> wimm_local_contracts::storage_port::LocalStoragePort
    for MemoryStorage<V>
{
    type Error = StorageFailure;
    fn initialize_area(
        &mut self,
        id: &EntityId,
        proposed: &EntityId,
    ) -> Result<EntityId, Self::Error> {
        let epoch = self
            .state
            .epochs
            .get(id.as_str())
            .or_else(|| self.state.sync.get(id.as_str()).map(|s| &s.epoch))
            .or_else(|| {
                self.state
                    .confirmed
                    .values()
                    .find(|c| &c.space_id == id)
                    .map(|c| &c.epoch)
            })
            .unwrap_or(proposed)
            .clone();
        let mut next = self.state.clone();
        next.epochs.insert(id.as_str().into(), epoch.clone());
        self.publish(next)?;
        Ok(epoch)
    }
    fn read_aggregate(&self, handle: &EntityId) -> Result<Option<StoredAggregate>, Self::Error> {
        Ok(self.state.aggregates.get(handle.as_str()).cloned())
    }
    fn query(&self, query: AggregateQuery) -> Result<Vec<StoredAggregate>, Self::Error> {
        Ok(self
            .state
            .aggregates
            .values()
            .filter(|v| v.aggregate.space_id() == &query.space_id)
            .cloned()
            .collect())
    }
    fn apply_atomic_batch(&mut self, input: AtomicBatch) -> Result<(), Self::Error> {
        let mut next = self.state.clone();
        batch(&mut next, input)?;
        self.publish(next)
    }
    fn load_confirmed(&self, id: &EntityId) -> Result<Vec<ConfirmedAggregate>, Self::Error> {
        Ok(self
            .state
            .confirmed
            .values()
            .filter(|v| &v.space_id == id)
            .cloned()
            .collect())
    }
    fn load_pending(&self, id: &EntityId) -> Result<Vec<PendingOperation>, Self::Error> {
        Ok(self
            .state
            .pending
            .values()
            .filter(|v| &v.space_id == id)
            .cloned()
            .collect())
    }
    fn get_sync_state(&self, id: &EntityId) -> Result<Option<SyncState>, Self::Error> {
        Ok(self.state.sync.get(id.as_str()).cloned())
    }
    fn save_sync_page(&mut self, page: SyncPage) -> Result<(), Self::Error> {
        if page.state.profile_id != self.profile_id || !page.state.check_cursor() {
            return Err(error(StorageFailureCode::WriteFailed));
        }
        if page.confirmed.iter().any(|c| {
            c.space_id != page.state.space_id
                || c.aggregate.aggregate.space_id() != &page.state.space_id
                || c.epoch != page.state.epoch
        }) || page
            .projections
            .iter()
            .any(|p| space(p) != &page.state.space_id)
        {
            return Err(error(StorageFailureCode::EpochMismatch));
        }
        if self
            .state
            .confirmed
            .values()
            .any(|v| v.space_id == page.state.space_id && v.epoch != page.state.epoch)
        {
            return Err(error(StorageFailureCode::EpochMismatch));
        }
        if self
            .state
            .epochs
            .get(page.state.space_id.as_str())
            .is_some_and(|epoch| epoch != &page.state.epoch)
        {
            return Err(error(StorageFailureCode::EpochMismatch));
        }
        if !unique(page.confirmed.iter().map(|c| c.aggregate.handle.as_str()))
            || !unique(page.remove_operation_ids.iter().map(|id| id.as_str()))
            || !unique(page.projections.iter().map(projection_key))
            || page.confirmed.iter().any(|c| {
                c.aggregate.handle != *c.aggregate.aggregate.id()
                    || self
                        .state
                        .confirmed
                        .get(c.aggregate.handle.as_str())
                        .is_some_and(|old| old.space_id != page.state.space_id)
            })
        {
            return Err(error(StorageFailureCode::WriteFailed));
        }
        let mut next = self.state.clone();
        for c in page.confirmed {
            next.confirmed.insert(c.aggregate.handle.as_str().into(), c);
        }
        for id in page.remove_operation_ids {
            if next
                .pending
                .get(id.as_str())
                .is_some_and(|p| p.space_id != page.state.space_id)
            {
                return Err(error(StorageFailureCode::WriteFailed));
            }
            next.pending.remove(id.as_str());
        }
        for p in page.projections {
            next.projections.insert(projection_key(&p), p);
        }
        next.epochs.insert(
            page.state.space_id.as_str().into(),
            page.state.epoch.clone(),
        );
        next.sync
            .insert(page.state.space_id.as_str().into(), page.state);
        self.publish(next)
    }
    fn export_snapshot(&self, id: &EntityId) -> Result<LocalSnapshot, Self::Error> {
        let epoch = self
            .state
            .sync
            .get(id.as_str())
            .map(|s| &s.epoch)
            .or_else(|| self.state.epochs.get(id.as_str()))
            .or_else(|| {
                self.state
                    .confirmed
                    .values()
                    .find(|c| &c.space_id == id)
                    .map(|c| &c.epoch)
            })
            .ok_or_else(|| error(StorageFailureCode::EpochMismatch))?
            .clone();
        Ok(LocalSnapshot {
            storage_schema_version: self.state.versions.get(id.as_str()).copied().unwrap_or(
                SnapshotStorageVersion::new(1)
                    .map_err(|_| error(StorageFailureCode::UpdateRequired))?,
            ),
            domain_schema_version: SnapshotDomainVersion::new(1)
                .map_err(|_| error(StorageFailureCode::UpdateRequired))?,
            profile_id: self.profile_id.clone(),
            space_id: id.clone(),
            epoch,
            aggregates: self.query(AggregateQuery {
                space_id: id.clone(),
            })?,
            confirmed: self.load_confirmed(id)?,
            pending: self.load_pending(id)?,
            projections: self
                .state
                .projections
                .values()
                .filter(|v| space(v) == id)
                .cloned()
                .collect(),
            sync_state: self.get_sync_state(id)?,
        })
    }
    fn replace_snapshot(&mut self, snapshot: LocalSnapshot) -> Result<(), Self::Error> {
        if !snapshot.check_versions() {
            return Err(error(StorageFailureCode::UpdateRequired));
        }
        if snapshot.profile_id != self.profile_id {
            return Err(error(StorageFailureCode::WriteFailed));
        }
        if !unique(snapshot.aggregates.iter().map(|a| a.handle.as_str()))
            || !unique(
                snapshot
                    .confirmed
                    .iter()
                    .map(|a| a.aggregate.handle.as_str()),
            )
            || !unique(snapshot.pending.iter().map(|p| p.operation_id.as_str()))
            || !unique(snapshot.projections.iter().map(projection_key))
        {
            return Err(error(StorageFailureCode::WriteFailed));
        }
        for pending in &snapshot.pending {
            if !unique(pending.expected_revisions.iter().map(|r| r.handle.as_str()))
                || !unique(pending.depends_on.iter().map(|id| id.as_str()))
            {
                return Err(error(StorageFailureCode::WriteFailed));
            }
            if let Some(object) = pending.draft.0.as_object() {
                if object
                    .get("spaceId")
                    .is_some_and(|v| v.as_str() != Some(snapshot.space_id.as_str()))
                {
                    return Err(error(StorageFailureCode::WriteFailed));
                }
                if let Some(aggregates) = object.get("aggregates") {
                    let Some(rows) = aggregates.as_array() else {
                        return Err(error(StorageFailureCode::WriteFailed));
                    };
                    for row in rows {
                        let value: wimm_finance_types::models::Aggregate =
                            wimm_local_contracts::storage::decode_draft_aggregate(row)
                                .map_err(|_| error(StorageFailureCode::WriteFailed))?;
                        if value.space_id() != &snapshot.space_id {
                            return Err(error(StorageFailureCode::WriteFailed));
                        }
                    }
                }
            }
        }
        self.validator.validate(&snapshot)?;
        for a in &snapshot.aggregates {
            if a.handle != *a.aggregate.id()
                || a.aggregate.space_id() != &snapshot.space_id
                || self
                    .state
                    .aggregates
                    .get(a.handle.as_str())
                    .is_some_and(|v| v.aggregate.space_id() != &snapshot.space_id)
            {
                return Err(error(StorageFailureCode::WriteFailed));
            }
        }
        if snapshot.confirmed.iter().any(|v| {
            v.space_id != snapshot.space_id
                || v.epoch != snapshot.epoch
                || v.aggregate.aggregate.space_id() != &snapshot.space_id
                || v.aggregate.handle != *v.aggregate.aggregate.id()
        }) || snapshot
            .pending
            .iter()
            .any(|v| v.space_id != snapshot.space_id)
            || snapshot
                .projections
                .iter()
                .any(|v| space(v) != &snapshot.space_id)
            || snapshot.sync_state.as_ref().is_some_and(|s| {
                s.profile_id != self.profile_id
                    || s.space_id != snapshot.space_id
                    || s.epoch != snapshot.epoch
                    || !s.check_cursor()
            })
        {
            return Err(error(StorageFailureCode::WriteFailed));
        }
        let mut next = self.state.clone();
        clear_space(&mut next, &snapshot.space_id);
        for a in snapshot.aggregates {
            next.aggregates.insert(a.handle.as_str().into(), a);
        }
        for c in snapshot.confirmed {
            if self
                .state
                .confirmed
                .get(c.aggregate.handle.as_str())
                .is_some_and(|v| v.space_id != snapshot.space_id)
            {
                return Err(error(StorageFailureCode::WriteFailed));
            }
            next.confirmed.insert(c.aggregate.handle.as_str().into(), c);
        }
        for p in snapshot.pending {
            if self
                .state
                .pending
                .get(p.operation_id.as_str())
                .is_some_and(|v| v.space_id != snapshot.space_id)
            {
                return Err(error(StorageFailureCode::WriteFailed));
            }
            next.pending.insert(p.operation_id.as_str().into(), p);
        }
        for p in snapshot.projections {
            next.projections.insert(projection_key(&p), p);
        }
        if let Some(s) = snapshot.sync_state {
            next.sync.insert(s.space_id.as_str().into(), s);
        }
        next.versions.insert(
            snapshot.space_id.as_str().into(),
            snapshot.storage_schema_version,
        );
        next.epochs
            .insert(snapshot.space_id.as_str().into(), snapshot.epoch);
        self.publish(next)
    }
    fn rebuild_projections(&mut self, request: ProjectionRebuild) -> Result<(), Self::Error> {
        let current = self.query(AggregateQuery {
            space_id: request.space_id.clone(),
        })?;
        let mut expected = request.source_aggregates.clone();
        expected.sort_by(|a, b| a.handle.as_str().cmp(b.handle.as_str()));
        if !same(&current, &expected) {
            return Err(error(StorageFailureCode::RevisionConflict));
        }
        if request
            .projections
            .iter()
            .any(|p| space(p) != &request.space_id)
        {
            return Err(error(StorageFailureCode::WriteFailed));
        }
        let mut next = self.state.clone();
        next.projections
            .retain(|_, v| space(v) != &request.space_id);
        for p in request.projections {
            next.projections.insert(projection_key(&p), p);
        }
        self.publish(next)
    }
}
impl<V: SnapshotValidationPort> MemoryStorage<V> {
    fn commit_observing(
        &mut self,
        request: LocalCommitRequest,
        cancellation: &dyn wimm_local_contracts::storage_port::CancellationPort,
    ) -> LocalCommitOutcome {
        use sha2::{Digest, Sha256};
        use wimm_local_contracts::{Validate, storage_port::LocalStoragePort};
        use wimm_persistence_contracts::CommitOutcome as Outcome;
        let identity = &request.identity;
        if identity.validate().is_err() {
            return Outcome::NotCommitted {
                error: error(StorageFailureCode::UpdateRequired),
            };
        }
        if identity.profile_id != self.profile_id {
            return Outcome::NotCommitted {
                error: error(StorageFailureCode::EpochMismatch),
            };
        }
        let key = serde_json::to_string(identity).expect("Geprüfte Identität ist serialisierbar.");
        if let Some((original, receipt)) = self.receipts.get(&key) {
            return if same(original, &request) {
                Outcome::Committed {
                    value: receipt.clone(),
                }
            } else {
                Outcome::NotCommitted {
                    error: error(StorageFailureCode::OperationIdReused),
                }
            };
        }
        if self.state.epochs.get(identity.space_id.as_str()) != Some(&identity.epoch) {
            return Outcome::NotCommitted {
                error: error(StorageFailureCode::EpochMismatch),
            };
        }
        if request.batch.expected_revisions.iter().any(|r| {
            self.state
                .aggregates
                .get(r.handle.as_str())
                .is_some_and(|a| a.aggregate.space_id() != &identity.space_id)
        }) {
            return Outcome::NotCommitted {
                error: error(StorageFailureCode::WriteFailed),
            };
        }
        if request
            .batch
            .aggregates
            .iter()
            .any(|v| v.aggregate.space_id() != &identity.space_id)
            || request
                .batch
                .outbox
                .iter()
                .any(|v| v.space_id != identity.space_id)
            || request
                .batch
                .projections
                .iter()
                .any(|v| space(v) != &identity.space_id)
        {
            return Outcome::NotCommitted {
                error: error(StorageFailureCode::WriteFailed),
            };
        }
        let revisions = request
            .batch
            .aggregates
            .iter()
            .map(|v| CommittedRevision {
                handle: v.handle.clone(),
                revision: v.aggregate.revision(),
            })
            .collect();
        let data = serde_json::to_vec(&request).expect("Geprüfte Anfrage ist serialisierbar.");
        let hash = Sha256::digest(data)
            .iter()
            .map(|b| format!("{b:02x}"))
            .collect::<String>();
        let receipt = LocalCommitReceipt {
            identity: identity.clone(),
            content_hash: wimm_finance_types::scalars::FileHash::new(hash).expect("SHA256-Hex"),
            committed_revisions: revisions,
        };
        if cancellation.is_cancelled() {
            return Outcome::NotCommitted {
                error: error(StorageFailureCode::Cancelled),
            };
        }
        if let Err(error) = self.apply_atomic_batch(request.batch.clone()) {
            return Outcome::NotCommitted { error };
        }
        self.receipts.insert(key, (request, receipt.clone()));
        if std::mem::take(&mut self.lose_next) {
            Outcome::Unknown {
                identity: receipt.identity,
            }
        } else {
            Outcome::Committed { value: receipt }
        }
    }
}
impl<V: SnapshotValidationPort> CancellableLocalCommitPort for MemoryStorage<V> {
    fn commit_cancellable(
        &mut self,
        request: LocalCommitRequest,
        cancellation: &dyn wimm_local_contracts::storage_port::CancellationPort,
    ) -> LocalCommitOutcome {
        self.commit_observing(request, cancellation)
    }
}
impl<V: SnapshotValidationPort> LocalCommitPort for MemoryStorage<V> {
    fn commit(&mut self, request: LocalCommitRequest) -> LocalCommitOutcome {
        self.commit_observing(request, &wimm_local_contracts::storage_port::NeverCancel)
    }
    fn lookup_result(
        &self,
        identity: &LocalOperationIdentity,
    ) -> Result<Option<LocalCommitReceipt>, StorageFailure> {
        use wimm_local_contracts::Validate;
        if identity.profile_id != self.profile_id {
            return Err(error(StorageFailureCode::EpochMismatch));
        }
        identity
            .validate()
            .map_err(|_| error(StorageFailureCode::UpdateRequired))?;
        let key =
            serde_json::to_string(identity).map_err(|_| error(StorageFailureCode::WriteFailed))?;
        Ok(self.receipts.get(&key).map(|(_, r)| r.clone()))
    }
}
impl<V: SnapshotValidationPort> wimm_local_contracts::index_ports::LocalIndexQueryPort
    for MemoryStorage<V>
{
    fn query_transactions(
        &self,
        query: wimm_local_contracts::index_ports::TransactionIndexQuery,
    ) -> Result<Vec<StoredAggregate>, StorageFailure> {
        use wimm_finance_types::models::Aggregate;
        use wimm_local_contracts::{Validate, index_ports::ReferenceKind};
        query
            .validate()
            .map_err(|_| error(StorageFailureCode::WriteFailed))?;
        let mut rows = self
            .state
            .aggregates
            .values()
            .filter(|a| a.aggregate.space_id() == &query.space_id)
            .filter_map(|a| {
                if let Aggregate::Transaction(t) = &a.aggregate {
                    let matches = match query.kind {
                        ReferenceKind::Account => t.account_id.as_str() == query.reference,
                        ReferenceKind::Category => t
                            .splits
                            .iter()
                            .any(|s| s.category_id.as_str() == query.reference),
                        ReferenceKind::Import => t
                            .import_reference
                            .as_ref()
                            .is_some_and(|r| r.as_str() == query.reference),
                    };
                    if t.deleted_at.is_none()
                        && matches
                        && query
                            .from_date
                            .as_ref()
                            .is_none_or(|d| t.date.as_str() >= d.as_str())
                        && query
                            .through_date
                            .as_ref()
                            .is_none_or(|d| t.date.as_str() <= d.as_str())
                        && query.after.as_ref().is_none_or(|c| {
                            (t.date.as_str(), a.handle.as_str())
                                > (c.date.as_str(), c.handle.as_str())
                        })
                    {
                        Some((t.date.as_str().to_owned(), a.clone()))
                    } else {
                        None
                    }
                } else {
                    None
                }
            })
            .collect::<Vec<_>>();
        rows.sort_by(|a, b| (&a.0, a.1.handle.as_str()).cmp(&(&b.0, b.1.handle.as_str())));
        Ok(rows
            .into_iter()
            .take(query.limit as usize)
            .map(|(_, a)| a)
            .collect())
    }
    fn query_pending(
        &self,
        query: wimm_local_contracts::index_ports::PendingIndexQuery,
    ) -> Result<Vec<PendingOperation>, StorageFailure> {
        use wimm_local_contracts::Validate;
        query
            .validate()
            .map_err(|_| error(StorageFailureCode::WriteFailed))?;
        let mut rows = self
            .state
            .pending
            .values()
            .filter(|p| p.space_id == query.space_id && p.state == query.state)
            .cloned()
            .collect::<Vec<_>>();
        let time = |p: &PendingOperation| {
            p.created_at
                .as_ref()
                .map(|s| s.as_str().to_owned())
                .unwrap_or_default()
        };
        rows.sort_by(|a, b| {
            (time(a), a.operation_id.as_str()).cmp(&(time(b), b.operation_id.as_str()))
        });
        Ok(rows.into_iter().take(query.limit as usize).collect())
    }
    fn query_imported(
        &self,
        query: wimm_local_contracts::index_ports::ImportSourceQuery,
    ) -> Result<Vec<StoredAggregate>, StorageFailure> {
        use wimm_finance_types::models::Aggregate;
        use wimm_local_contracts::Validate;
        query
            .validate()
            .map_err(|_| error(StorageFailureCode::WriteFailed))?;
        let ids = self
            .state
            .aggregates
            .values()
            .filter_map(|a| match &a.aggregate {
                Aggregate::ImportFingerprint(f)
                    if f.space_id == query.space_id
                        && f.account_id == query.account_id
                        && f.parser_source.as_str() == query.parser_source
                        && f.external_id
                            .as_ref()
                            .is_some_and(|v| v.as_str() == query.external_id)
                        && f.deleted_at.is_none() =>
                {
                    Some(f.transaction_id.as_str().to_owned())
                }
                _ => None,
            })
            .collect::<std::collections::BTreeSet<_>>();
        let mut rows = ids
            .into_iter()
            .filter_map(|id| self.state.aggregates.get(&id))
            .filter(|a| {
                a.aggregate.space_id() == &query.space_id
                    && matches!(&a.aggregate,Aggregate::Transaction(t)if t.deleted_at.is_none())
            })
            .cloned()
            .collect::<Vec<_>>();
        rows.sort_by(|a, b| {
            let date = |v: &StoredAggregate| {
                if let Aggregate::Transaction(t) = &v.aggregate {
                    t.date.as_str().to_owned()
                } else {
                    String::new()
                }
            };
            (date(a), a.handle.as_str()).cmp(&(date(b), b.handle.as_str()))
        });
        Ok(rows.into_iter().take(query.limit as usize).collect())
    }
}

fn unique<K: Ord>(mut items: impl Iterator<Item = K>) -> bool {
    let mut set = std::collections::BTreeSet::new();
    items.all(|key| set.insert(key))
}
