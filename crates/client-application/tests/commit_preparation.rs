// SPDX-License-Identifier: AGPL-3.0-or-later
#![forbid(unsafe_code)]
use wimm_client_application::*;
use wimm_finance_types::{command_contracts::Request, scalars::*};
mod support;
fn context(r: &Request) -> CommitContext {
    CommitContext {
        profile_id: EntityId::new("50000000-0000-4000-8000-000000000001".into()).unwrap(),
        space_id: r.space_id.clone(),
        epoch: EntityId::new("50000000-0000-4000-8000-000000000003".into()).unwrap(),
        profile_revision: Revision::new(1).unwrap(),
        session_generation: Revision::new(1).unwrap(),
        generation: Revision::new(1).unwrap(),
    }
}
#[test]
fn all_existing_command_oracles_keep_core_results_and_atomically_prepared_data() {
    let cases: Vec<serde_json::Value> = serde_json::from_str(include_str!(
        "../../finance-core/tests/fixtures/contract-catalog.json"
    ))
    .unwrap();
    let mut covered = 0;
    let mut prepared = 0;
    let mut command_types = std::collections::BTreeSet::new();
    let mut incomplete = 0;
    for case in cases.iter().filter(|c| c["method"] == "execute") {
        covered += 1;
        let text = if let Some(text) = case["request"].as_str() {
            text.to_owned()
        } else {
            case["request"].to_string()
        };
        let Ok(r) = wimm_finance_core::decode_command_request_v1(&text) else {
            continue;
        };
        let ctx = context(&r);
        let core = wimm_finance_core::execute(r.clone());
        let before = r.aggregates.clone();
        let result = prepare_command(r, &ctx, &ctx, AreaMode::Standalone);
        if core.is_err() {
            assert!(result.is_err());
            continue;
        }
        let core = core.unwrap().to_wire().unwrap();
        assert_eq!(core, case["expected"], "{}", case["name"]);
        if let Err(e) = &result {
            assert_eq!(case["name"], "Abgleich bestätigten Ausgangssaldo verwenden");
            assert_eq!(*e, PreparationFailure::FinanceRejected("INVALID_AGGREGATE"));
            incomplete += 1;
            continue;
        }
        if let Some(value) = result.unwrap_or_else(|e| panic!("{}: {e:?}", case["name"])) {
            prepared += 1;
            command_types.insert(value.change().command_type.clone());
            assert!(value.request().batch.outbox.is_empty());
            assert_eq!(
                value.request().identity.operation_id,
                value.change().operation_id
            );
            assert_eq!(
                value.request().batch.aggregates.len(),
                value.change().aggregates.len()
            );
            assert!(!value.request().batch.projections.is_empty());
            support::persist(value, &before);
        }
    }
    assert_eq!(covered, 176);
    assert_eq!(incomplete, 1);
    assert_eq!(command_types.len(), 22);
    assert_eq!(prepared, 63);
}
#[test]
fn changed_profile_epoch_or_generation_rejects_before_preparation() {
    let cases: Vec<serde_json::Value> = serde_json::from_str(include_str!(
        "../../finance-core/tests/fixtures/contract-catalog.json"
    ))
    .unwrap();
    let r: Request = cases
        .iter()
        .filter(|c| c["method"] == "execute")
        .find_map(|c| wimm_finance_core::decode_command_request_v1(&c["request"].to_string()).ok())
        .unwrap();
    let started = context(&r);
    let mut changed = started.clone();
    changed.generation = Revision::new(2).unwrap();
    assert!(matches!(
        prepare_command(r.clone(), &started, &changed, AreaMode::Connected),
        Err(PreparationFailure::ScopeChanged)
    ));
    changed = started.clone();
    changed.epoch = EntityId::new("50000000-0000-4000-8000-000000000099".into()).unwrap();
    assert!(matches!(
        prepare_command(r, &started, &changed, AreaMode::Connected),
        Err(PreparationFailure::ScopeChanged)
    ));
}

#[test]
fn complete_reconciliation_seed_preserves_confirmed_opening_balance_and_connected_original() {
    let cases: Vec<serde_json::Value> = serde_json::from_str(include_str!(
        "../../finance-core/tests/fixtures/contract-catalog.json"
    ))
    .unwrap();
    let original = &cases
        .iter()
        .find(|c| c["name"] == "Abgleich bestätigten Ausgangssaldo verwenden")
        .unwrap()["request"];
    let mut extended = original.clone();
    // Eigene vollständige Anwendungsfixture, kein automatisches Umschreiben des Kern-Goldens.
    extended["aggregates"].as_array_mut().unwrap().push(serde_json::json!({"id":"b0000000-0000-4000-8000-000000000099","spaceId":"b0000000-0000-4000-8000-000000000001","revision":1,"createdAt":"2026-10-08T12:00:00Z","updatedAt":"2026-10-08T12:00:00Z","aggregateType":"reconciliation","accountId":"b0000000-0000-4000-8000-000000000002","statementDate":"2026-10-08","statementBalance":100000,"transactionIds":["b0000000-0000-4000-8000-000000000010"]}));
    let r = wimm_finance_core::decode_command_request_v1(&extended.to_string()).unwrap();
    let ctx = context(&r);
    let before = r.aggregates.clone();
    let prepared = prepare_command(r, &ctx, &ctx, AreaMode::Connected)
        .unwrap()
        .unwrap();
    assert_eq!(prepared.request().batch.outbox.len(), 1);
    assert_eq!(
        serde_json::to_value(&prepared.request().batch.outbox[0].draft).unwrap(),
        serde_json::to_value(prepared.change()).unwrap()
    );
    assert_eq!(
        prepared.request().batch.outbox[0].operation_id,
        prepared.request().identity.operation_id
    );
    assert_eq!(prepared.request().batch.aggregates.len(), 2);
    support::persist(prepared, &before);
}
