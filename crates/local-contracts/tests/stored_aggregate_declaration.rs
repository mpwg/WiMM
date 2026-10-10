// SPDX-License-Identifier: AGPL-3.0-or-later
#![forbid(unsafe_code)]
use wimm_local_contracts::storage::StoredAggregate;
#[test]
fn stored_aggregate_remains_flat_with_required_handle() {
    let id = "10000000-0000-4000-8000-000000000001";
    let value = serde_json::json!({"aggregateType":"account","handle":id,"id":id,"spaceId":"10000000-0000-4000-8000-000000000002","revision":1,"createdAt":"2026-10-10T12:00:00Z","updatedAt":"2026-10-10T12:00:00Z","name":"Synthetisches Prüfkonto","type":"checking","onBudget":true,"archived":false});
    let typed: StoredAggregate = serde_json::from_value(value.clone()).unwrap();
    assert_eq!(typed.handle.as_str(), typed.aggregate.id().as_str());
    assert_eq!(serde_json::to_value(&typed).unwrap(), value);
    let mut missing = value;
    missing.as_object_mut().unwrap().remove("handle");
    assert!(serde_json::from_value::<StoredAggregate>(missing).is_err());
}
#[cfg(feature = "wasm-bindings")]
#[test]
fn stored_aggregate_uses_union_intersection_instead_of_invalid_interface() {
    assert!(
        <StoredAggregate as tsify::Tsify>::DECL
            .contains("type StoredAggregate = Aggregate & { handle: EntityId }")
    );
}
