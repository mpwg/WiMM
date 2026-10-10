// SPDX-License-Identifier: AGPL-3.0-or-later
#![forbid(unsafe_code)]
use wimm_finance_types::{scalars::*, state_contracts::ValidationRequest};
use wimm_local_contracts::{
    commit::*,
    persistence_errors::{StorageFailure, StorageFailureCode},
    storage::*,
    storage_port::LocalStoragePort,
};
use wimm_local_dal::memory::MemoryStorage;
struct CoreValidator;
impl SnapshotValidationPort for CoreValidator {
    fn validate(&self, s: &LocalSnapshot) -> Result<(), StorageFailure> {
        let fail = || StorageFailure::not_committed(StorageFailureCode::WriteFailed);
        let local = s
            .aggregates
            .iter()
            .map(|a| a.aggregate.clone())
            .collect::<Vec<_>>();
        wimm_finance_core::validate(ValidationRequest::Historical {
            contract_version: 1.into(),
            domain_schema_version: 1.into(),
            space_id: s.space_id.clone(),
            aggregates: local.clone(),
        })
        .map_err(|_| fail())?;
        let mut confirmed = s
            .aggregates
            .iter()
            .map(|a| (a.handle.as_str().to_owned(), a.aggregate.clone()))
            .collect::<std::collections::BTreeMap<_, _>>();
        for row in &s.confirmed {
            confirmed.insert(
                row.aggregate.handle.as_str().into(),
                row.aggregate.aggregate.clone(),
            );
        }
        if !s.confirmed.is_empty() {
            wimm_finance_core::validate(ValidationRequest::Historical {
                contract_version: 1.into(),
                domain_schema_version: 1.into(),
                space_id: s.space_id.clone(),
                aggregates: confirmed.values().cloned().collect(),
            })
            .map_err(|_| fail())?;
        }
        let source = if local
            .iter()
            .any(|a| a.kind() != wimm_finance_types::models::AggregateKind::FinancialRevision)
        {
            local
        } else {
            confirmed.into_values().collect()
        };
        let source = source
            .iter()
            .map(serde_json::to_value)
            .collect::<Result<Vec<_>, _>>()
            .map_err(|_| fail())?;
        let projections = s
            .projections
            .iter()
            .map(serde_json::to_value)
            .collect::<Result<Vec<_>, _>>()
            .map_err(|_| fail())?;
        wimm_finance_core::projection_cache::validate(&source, &projections).map_err(|_| fail())
    }
}

fn id(n: u32) -> EntityId {
    EntityId::new(format!("50000000-0000-4000-8000-{n:012}")).unwrap()
}
fn aggregate(n: u32, revision: u32) -> StoredAggregate {
    serde_json::from_value(serde_json::json!({"handle":id(n),"id":id(n),"spaceId":id(2),"revision":revision,"aggregateType":"account","createdAt":"2026-10-10T00:00:00Z","updatedAt":"2026-10-10T00:00:00Z","name":"Synthetisch 🏠","type":"checking","onBudget":true,"archived":false})).unwrap()
}
fn batch(a: StoredAggregate, expected: i64) -> AtomicBatch {
    AtomicBatch {
        expected_revisions: vec![RevisionExpectation {
            handle: a.handle.clone(),
            expected_revision: Revision::new(expected).unwrap(),
        }],
        aggregates: vec![a],
        outbox: vec![],
        projections: vec![],
    }
}
fn fixture() -> MemoryStorage<CoreValidator> {
    let mut db = MemoryStorage::new(id(1), CoreValidator);
    db.initialize_area(&id(2), &id(3)).unwrap();
    db
}
#[test]
fn cas_and_before_commit_fault_are_atomic_and_preserve_snapshot() {
    let mut db = fixture();
    db.apply_atomic_batch(batch(aggregate(4, 1), 0)).unwrap();
    let before = serde_json::to_value(db.export_snapshot(&id(2)).unwrap()).unwrap();
    assert_eq!(
        db.apply_atomic_batch(batch(aggregate(4, 2), 0))
            .unwrap_err()
            .code,
        StorageFailureCode::RevisionConflict
    );
    assert_eq!(
        serde_json::to_value(db.export_snapshot(&id(2)).unwrap()).unwrap(),
        before
    );
    db.inject_before_commit_failure();
    assert_eq!(
        db.apply_atomic_batch(batch(aggregate(4, 2), 1))
            .unwrap_err()
            .code,
        StorageFailureCode::WriteFailed
    );
    assert_eq!(
        serde_json::to_value(db.export_snapshot(&id(2)).unwrap()).unwrap(),
        before
    );
}
#[test]
fn confirmed_pending_drafts_and_sync_cursor_are_separate_and_atomic() {
    let mut db = fixture();
    let pending:PendingOperation=serde_json::from_value(serde_json::json!({"operationId":id(6),"spaceId":id(2),"expectedRevisions":[],"dependsOn":[],"state":"queued","draft":{"original":"Nie umdeuten 🏠","values":[null,1,true]},"retryCount":0})).unwrap();
    let mut b = batch(aggregate(4, 1), 0);
    b.outbox.push(pending.clone());
    db.apply_atomic_batch(b).unwrap();
    let page = SyncPage {
        state: SyncState {
            profile_id: id(1),
            space_id: id(2),
            epoch: id(3),
            cursor: "17".into(),
        },
        confirmed: vec![ConfirmedAggregate {
            space_id: id(2),
            epoch: id(3),
            aggregate: aggregate(4, 2),
        }],
        remove_operation_ids: vec![],
        projections: vec![],
    };
    db.inject_before_commit_failure();
    assert!(db.save_sync_page(page.clone()).is_err());
    assert!(db.get_sync_state(&id(2)).unwrap().is_none());
    db.save_sync_page(page).unwrap();
    assert_eq!(
        db.read_aggregate(&id(4))
            .unwrap()
            .unwrap()
            .aggregate
            .revision()
            .value(),
        1
    );
    assert_eq!(
        db.load_confirmed(&id(2)).unwrap()[0]
            .aggregate
            .aggregate
            .revision()
            .value(),
        2
    );
    assert_eq!(
        serde_json::to_value(&db.load_pending(&id(2)).unwrap()[0].draft).unwrap(),
        serde_json::to_value(pending.draft).unwrap()
    );
    assert_eq!(db.get_sync_state(&id(2)).unwrap().unwrap().cursor, "17");
}
#[test]
fn snapshot_replace_respects_core_validation_scope_original_drafts_and_cache_cas() {
    let mut db = fixture();
    db.apply_atomic_batch(batch(aggregate(4, 1), 0)).unwrap();
    let snapshot = db.export_snapshot(&id(2)).unwrap();
    db.replace_snapshot(snapshot.clone()).unwrap();
    let mut foreign = snapshot.clone();
    foreign.profile_id = id(90);
    assert!(db.replace_snapshot(foreign).is_err());
    let mut bad = snapshot.clone();
    bad.aggregates[0].handle = id(88);
    assert!(db.replace_snapshot(bad).is_err());
    let projections = vec![StoredProjection::Balance {
        space_id: id(2),
        key: id(4),
        payload: MoneyCents::new(10).unwrap(),
    }];
    db.rebuild_projections(ProjectionRebuild {
        space_id: id(2),
        source_aggregates: snapshot.aggregates.clone(),
        projections: projections.clone(),
    })
    .unwrap();
    let before = serde_json::to_value(db.export_snapshot(&id(2)).unwrap()).unwrap();
    assert!(
        db.rebuild_projections(ProjectionRebuild {
            space_id: id(2),
            source_aggregates: vec![],
            projections: vec![]
        })
        .is_err()
    );
    assert_eq!(
        serde_json::to_value(db.export_snapshot(&id(2)).unwrap()).unwrap(),
        before
    );
    db.apply_atomic_batch(AtomicBatch {
        expected_revisions: vec![],
        aggregates: vec![],
        outbox: vec![],
        projections: vec![StoredProjection::Balance {
            space_id: id(2),
            key: id(4),
            payload: MoneyCents::new(20).unwrap(),
        }],
    })
    .unwrap();
    assert_eq!(db.export_snapshot(&id(2)).unwrap().projections.len(), 1);
}
#[test]
fn versioned_commit_receipt_survives_response_loss_without_repeat_write() {
    use wimm_persistence_contracts::CommitOutcome;
    let mut db = fixture();
    let identity = LocalOperationIdentity {
        operation_contract_version: 1,
        profile_id: id(1),
        space_id: id(2),
        epoch: id(3),
        operation_id: id(30),
    };
    let request = LocalCommitRequest {
        identity: identity.clone(),
        batch: batch(aggregate(4, 1), 0),
    };
    db.inject_after_commit_response_loss();
    assert!(matches!(
        db.commit(request.clone()),
        CommitOutcome::Unknown { .. }
    ));
    let receipt = db.lookup_result(&identity).unwrap().unwrap();
    assert_eq!(receipt.committed_revisions[0].revision.value(), 1);
    assert!(matches!(
        db.commit(request.clone()),
        CommitOutcome::Committed { .. }
    ));
    let mut changed = request.clone();
    changed.batch.aggregates[0] = aggregate(4, 2);
    assert!(matches!(
        db.commit(changed),
        CommitOutcome::NotCommitted {
            error: StorageFailure {
                code: StorageFailureCode::OperationIdReused,
                ..
            }
        }
    ));
    assert_eq!(
        db.read_aggregate(&id(4))
            .unwrap()
            .unwrap()
            .aggregate
            .revision()
            .value(),
        1
    );
    let mut wrong = request;
    wrong.identity.epoch = id(99);
    assert!(matches!(
        db.commit(wrong),
        CommitOutcome::NotCommitted {
            error: StorageFailure {
                code: StorageFailureCode::EpochMismatch,
                ..
            }
        }
    ));
}
#[test]
fn failed_commit_has_no_receipt_and_does_not_mutate_original() {
    use wimm_persistence_contracts::CommitOutcome;
    let mut db = fixture();
    let identity = LocalOperationIdentity {
        operation_contract_version: 1,
        profile_id: id(1),
        space_id: id(2),
        epoch: id(3),
        operation_id: id(31),
    };
    db.inject_before_commit_failure();
    assert!(matches!(
        db.commit(LocalCommitRequest {
            identity: identity.clone(),
            batch: batch(aggregate(4, 1), 0)
        }),
        CommitOutcome::NotCommitted { .. }
    ));
    assert!(db.lookup_result(&identity).unwrap().is_none());
    assert!(db.read_aggregate(&id(4)).unwrap().is_none());
}
#[test]
fn bounded_index_ports_keep_cursor_state_reference_and_tombstone_semantics() {
    use wimm_local_contracts::index_ports::*;
    let mut db = fixture();
    let make = |n: u32, date: &str, deleted: bool| {
        let mut value = serde_json::json!({"id":id(n),"handle":id(n),"spaceId":id(2),"revision":1,"aggregateType":"transaction","createdAt":"2026-10-10T00:00:00Z","updatedAt":"2026-10-10T00:00:00Z","date":date,"accountId":id(4),"amount":-1001,"kind":"opening","clearance":"uncleared","splits":[],"importReference":"Quelle β"});
        if deleted {
            value["deletedAt"] = "2026-10-10T00:00:00Z".into();
        }
        serde_json::from_value::<StoredAggregate>(value).unwrap()
    };
    db.apply_atomic_batch(AtomicBatch {
        expected_revisions: vec![],
        aggregates: vec![
            make(11, "2026-10-10", false),
            make(12, "2026-10-11", false),
            make(13, "2026-10-11", true),
        ],
        outbox: vec![],
        projections: vec![],
    })
    .unwrap();
    let mut query = TransactionIndexQuery {
        space_id: id(2),
        kind: ReferenceKind::Account,
        reference: id(4).as_str().into(),
        from_date: None,
        through_date: None,
        after: None,
        limit: 1,
    };
    assert_eq!(
        db.query_transactions(query.clone()).unwrap()[0].handle,
        id(11)
    );
    query.after = Some(TransactionCursor {
        date: FinanceDate::new("2026-10-10".into()).unwrap(),
        handle: id(11),
    });
    assert_eq!(
        db.query_transactions(query.clone()).unwrap()[0].handle,
        id(12)
    );
    query.kind = ReferenceKind::Import;
    query.reference = "Quelle β".into();
    query.limit = 1000;
    assert_eq!(db.query_transactions(query.clone()).unwrap().len(), 1);
    query.limit = 1001;
    assert!(db.query_transactions(query).is_err());
}
#[test]
fn snapshot_version_duplicates_and_foreign_pending_handles_are_not_repaired() {
    let mut db = fixture();
    db.apply_atomic_batch(batch(aggregate(4, 1), 0)).unwrap();
    let mut snapshot = db.export_snapshot(&id(2)).unwrap();
    snapshot.storage_schema_version = SnapshotStorageVersion::new(2).unwrap();
    db.replace_snapshot(snapshot.clone()).unwrap();
    assert_eq!(
        db.export_snapshot(&id(2))
            .unwrap()
            .storage_schema_version
            .value(),
        2
    );
    snapshot.aggregates.push(snapshot.aggregates[0].clone());
    assert!(db.replace_snapshot(snapshot).is_err());
    assert_eq!(db.export_snapshot(&id(2)).unwrap().aggregates.len(), 1);
}
#[test]
fn pending_and_import_source_queries_use_the_same_bounded_data_ports() {
    use wimm_local_contracts::index_ports::*;
    let mut db = fixture();
    let pending = |n: u32, at: &str| {
        serde_json::from_value::<PendingOperation>(serde_json::json!({"operationId":id(n),"spaceId":id(2),"expectedRevisions":[],"dependsOn":[],"state":"queued","draft":{"occurredAt":at},"retryCount":0})).unwrap()
    };
    db.apply_atomic_batch(AtomicBatch {
        expected_revisions: vec![],
        aggregates: vec![],
        outbox: vec![
            pending(22, "2026-10-10T01:00:00Z"),
            pending(21, "2026-10-10T00:00:00Z"),
        ],
        projections: vec![],
    })
    .unwrap();
    assert_eq!(
        db.query_pending(PendingIndexQuery {
            space_id: id(2),
            state: PendingState::Queued,
            limit: 1
        })
        .unwrap()[0]
            .operation_id,
        id(21)
    );
    assert!(
        db.query_pending(PendingIndexQuery {
            space_id: id(2),
            state: PendingState::Queued,
            limit: 0
        })
        .is_err()
    );
    assert!(
        db.query_imported(ImportSourceQuery {
            space_id: id(2),
            account_id: id(4),
            parser_source: "csv".into(),
            external_id: "row-1".into(),
            limit: 10
        })
        .unwrap()
        .is_empty()
    );
    let transaction: StoredAggregate = serde_json::from_value(serde_json::json!({
        "id":id(40),"handle":id(40),"spaceId":id(2),"revision":1,
        "aggregateType":"transaction","createdAt":"2026-10-10T00:00:00Z","updatedAt":"2026-10-10T00:00:00Z",
        "date":"2026-10-10","accountId":id(4),"amount":-1001,"kind":"opening","clearance":"uncleared","splits":[]
    })).unwrap();
    let fingerprint: StoredAggregate = serde_json::from_value(serde_json::json!({
        "id":id(41),"handle":id(41),"spaceId":id(2),"revision":1,
        "aggregateType":"importFingerprint","createdAt":"2026-10-10T00:00:00Z","updatedAt":"2026-10-10T00:00:00Z",
        "accountId":id(4),"parserSource":"csv","fingerprint":"synthetisch","transactionId":id(40),
        "importId":id(42),"sourceRow":1,"externalId":"row-1"
    })).unwrap();
    db.apply_atomic_batch(AtomicBatch {
        expected_revisions: vec![],
        aggregates: vec![transaction, fingerprint],
        outbox: vec![],
        projections: vec![],
    })
    .unwrap();
    let query = ImportSourceQuery {
        space_id: id(2),
        account_id: id(4),
        parser_source: "csv".into(),
        external_id: "row-1".into(),
        limit: 1,
    };
    assert_eq!(db.query_imported(query.clone()).unwrap()[0].handle, id(40));
    let mut wrong_source = query;
    wrong_source.external_id = "row-2".into();
    assert!(db.query_imported(wrong_source).unwrap().is_empty());
    assert!(
        db.query_imported(ImportSourceQuery {
            space_id: id(2),
            account_id: id(4),
            parser_source: String::new(),
            external_id: "row-1".into(),
            limit: 10
        })
        .is_err()
    );
}
#[test]
fn snapshot_financial_cache_validation_is_owned_by_the_injected_core_port() {
    let mut db = fixture();
    db.apply_atomic_batch(batch(aggregate(4, 1), 0)).unwrap();
    let original = db.export_snapshot(&id(2)).unwrap();
    let mut corrupted = original.clone();
    corrupted.projections.push(StoredProjection::Balance {
        space_id: id(2),
        key: id(4),
        payload: MoneyCents::new(123).unwrap(),
    });
    assert!(db.replace_snapshot(corrupted).is_err());
    assert_eq!(
        serde_json::to_value(db.export_snapshot(&id(2)).unwrap()).unwrap(),
        serde_json::to_value(original).unwrap()
    );
}
#[test]
fn duplicate_batches_and_foreign_sync_handles_roll_back_without_epoch_change() {
    let mut db = fixture();
    let mut input = batch(aggregate(4, 1), 0);
    input.aggregates.push(aggregate(4, 2));
    assert!(db.apply_atomic_batch(input).is_err());
    assert!(db.read_aggregate(&id(4)).unwrap().is_none());
    let page = SyncPage {
        state: SyncState {
            profile_id: id(1),
            space_id: id(2),
            epoch: id(3),
            cursor: "1".into(),
        },
        confirmed: vec![ConfirmedAggregate {
            space_id: id(2),
            epoch: id(3),
            aggregate: aggregate(4, 1),
        }],
        remove_operation_ids: vec![],
        projections: vec![],
    };
    db.save_sync_page(page.clone()).unwrap();
    let before = serde_json::to_value(db.export_snapshot(&id(2)).unwrap()).unwrap();
    let mut wrong_epoch = page.clone();
    wrong_epoch.state.epoch = id(50);
    wrong_epoch.confirmed[0].epoch = id(50);
    assert!(db.save_sync_page(wrong_epoch).is_err());
    db.initialize_area(&id(70), &id(71)).unwrap();
    let mut foreign = page;
    foreign.state.space_id = id(70);
    foreign.state.epoch = id(71);
    foreign.confirmed[0].space_id = id(70);
    foreign.confirmed[0].epoch = id(71);
    let mut value = serde_json::to_value(&foreign.confirmed[0].aggregate).unwrap();
    value["spaceId"] = serde_json::to_value(id(70)).unwrap();
    foreign.confirmed[0].aggregate = serde_json::from_value(value).unwrap();
    assert!(db.save_sync_page(foreign).is_err());
    assert_eq!(
        serde_json::to_value(db.export_snapshot(&id(2)).unwrap()).unwrap(),
        before
    );
    assert!(db.load_confirmed(&id(70)).unwrap().is_empty());
}
#[test]
fn known_receipt_remains_committed_after_authorized_snapshot_epoch_change() {
    use wimm_persistence_contracts::CommitOutcome;
    let mut db = fixture();
    let request = LocalCommitRequest {
        identity: LocalOperationIdentity {
            operation_contract_version: 1,
            profile_id: id(1),
            space_id: id(2),
            epoch: id(3),
            operation_id: id(80),
        },
        batch: batch(aggregate(4, 1), 0),
    };
    assert!(matches!(
        db.commit(request.clone()),
        CommitOutcome::Committed { .. }
    ));
    let before = db.lookup_result(&request.identity).unwrap().unwrap();
    let mut restored = db.export_snapshot(&id(2)).unwrap();
    restored.epoch = id(81);
    db.replace_snapshot(restored).unwrap();
    match db.commit(request.clone()) {
        CommitOutcome::Committed { value } => assert_eq!(
            serde_json::to_value(value).unwrap(),
            serde_json::to_value(before).unwrap()
        ),
        _ => panic!("Bekanntes Receipt darf nicht als uncommitted umgedeutet werden"),
    }
    let mut unknown = request;
    unknown.identity.operation_id = id(82);
    assert!(matches!(
        db.commit(unknown),
        CommitOutcome::NotCommitted {
            error: StorageFailure {
                code: StorageFailureCode::EpochMismatch,
                ..
            }
        }
    ));
}
