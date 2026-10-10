// SPDX-License-Identifier: AGPL-3.0-or-later
#![forbid(unsafe_code)]
use wimm_client_application::*;
use wimm_finance_types::{command_contracts::CommandResult, scalars::*};
mod support;
#[test]
fn all_countercommand_oracles_use_the_same_typed_preparation_path() {
    let cases: Vec<serde_json::Value> = serde_json::from_str(include_str!(
        "../../finance-core/tests/fixtures/contract-catalog.json"
    ))
    .unwrap();
    let mut total = 0;
    let mut accepted = 0;
    for case in cases.iter().filter(|c| c["method"] == "reverse") {
        total += 1;
        let r = wimm_finance_core::decode_reverse_request_v1(&case["request"].to_string()).unwrap();
        let ctx = CommitContext {
            profile_id: EntityId::new("50000000-0000-4000-8000-000000000001".into()).unwrap(),
            space_id: r.space_id.clone(),
            epoch: EntityId::new("50000000-0000-4000-8000-000000000003".into()).unwrap(),
            profile_revision: Revision::new(1).unwrap(),
            session_generation: Revision::new(1).unwrap(),
            generation: Revision::new(1).unwrap(),
        };
        let core = wimm_finance_core::reverse(r.clone());
        let prepared = prepare_reverse(r.clone(), &ctx, &ctx, AreaMode::Connected);
        match core {
            Err((code, _)) => {
                assert_eq!(case["expected"]["error"]["code"], code);
                assert!(
                    matches!(prepared, Err(PreparationFailure::FinanceRejected(actual)) if actual == code)
                );
            }
            Ok(change) => {
                assert_eq!(
                    CommandResult::Changed(change).to_wire().unwrap(),
                    case["expected"],
                    "{}",
                    case["name"]
                );
                let prepared = prepared.unwrap_or_else(|e| panic!("{}: {e:?}", case["name"]));
                accepted += 1;
                assert_eq!(prepared.request().batch.outbox.len(), 1);
                assert_eq!(
                    serde_json::to_value(&prepared.request().batch.outbox[0].draft).unwrap(),
                    serde_json::to_value(prepared.change()).unwrap()
                );
                assert!(!prepared.request().batch.projections.is_empty());
                let standalone =
                    prepare_reverse(r.clone(), &ctx, &ctx, AreaMode::Standalone).unwrap();
                assert!(standalone.request().batch.outbox.is_empty());
                support::persist(prepared, &r.aggregates);
            }
        }
        let mut other = ctx.clone();
        other.session_generation = Revision::new(2).unwrap();
        assert!(matches!(
            prepare_reverse(r, &ctx, &other, AreaMode::Connected),
            Err(PreparationFailure::ScopeChanged)
        ));
    }
    assert_eq!(total, 11);
    assert_eq!(accepted, 7);
}
