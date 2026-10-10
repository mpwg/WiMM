// SPDX-License-Identifier: AGPL-3.0-or-later
#![forbid(unsafe_code)]
use wimm_client_application::{api::*, *};
use wimm_finance_types::scalars::*;
fn request() -> ApplicationRequestV2 {
    let cases: Vec<serde_json::Value> = serde_json::from_str(include_str!(
        "../../finance-core/tests/fixtures/contract-catalog.json"
    ))
    .unwrap();
    let mut command = wimm_finance_core::decode_command_request_v1(
        &cases
            .iter()
            .find(|c| c["name"] == "Stammdaten account.save neu")
            .unwrap()["request"]
            .to_string(),
    )
    .unwrap();
    command.contract_version = 2.into();
    let ctx = CommitContext {
        profile_id: EntityId::new("50000000-0000-4000-8000-000000000001".into()).unwrap(),
        space_id: command.space_id.clone(),
        epoch: EntityId::new("50000000-0000-4000-8000-000000000003".into()).unwrap(),
        profile_revision: Revision::new(1).unwrap(),
        session_generation: Revision::new(1).unwrap(),
        generation: Revision::new(1).unwrap(),
    };
    ApplicationRequestV2 {
        contract_version: 2,
        domain_schema_version: 1,
        started: ctx.clone(),
        current: ctx,
        mode: AreaMode::Connected,
        action: ApplicationActionV2::Command(command.into()),
    }
}
#[test]
fn preparation_is_versioned_and_never_claims_a_storage_commit() {
    let input = request();
    let operation = match &input.action {
        ApplicationActionV2::Command(c) => c.context.operation_id.clone(),
        _ => unreachable!(),
    };
    match prepare_application_v2(input) {
        ApplicationPreparationV2::Prepared {
            contract_version,
            context,
            request,
        } => {
            assert_eq!(contract_version, 2);
            assert_eq!(request.identity.operation_id, operation);
            assert_eq!(request.identity.epoch, context.epoch);
            assert_eq!(request.batch.outbox.len(), 1);
            assert!(!request.batch.projections.is_empty());
        }
        _ => panic!("Vorbereitung fehlt"),
    }
}
#[test]
fn outer_and_inner_versions_and_all_scope_dimensions_are_checked() {
    for mode in 0..8 {
        let mut input = request();
        match mode {
            0 => input.contract_version = 99,
            1 => input.domain_schema_version = 99,
            2 => {
                input.current.profile_id =
                    EntityId::new("50000000-0000-4000-8000-000000000099".into()).unwrap()
            }
            3 => {
                input.current.space_id =
                    EntityId::new("50000000-0000-4000-8000-000000000099".into()).unwrap()
            }
            4 => {
                input.current.epoch =
                    EntityId::new("50000000-0000-4000-8000-000000000099".into()).unwrap()
            }
            5 => input.current.profile_revision = Revision::new(2).unwrap(),
            6 => input.current.session_generation = Revision::new(2).unwrap(),
            _ => input.current.generation = Revision::new(2).unwrap(),
        }
        assert!(
            matches!(prepare_application_v2(input),ApplicationPreparationV2::Rejected {contract_version:2,finance_code:None,code} if code==if mode<2 {ApplicationFailureCode::UpdateRequired}else{ApplicationFailureCode::ScopeChanged})
        );
    }
}
#[test]
fn strict_application_forms_reject_unknown_fields_and_keep_explicit_nullable_errors() {
    let mut value = serde_json::to_value(request()).unwrap();
    value["surprise"] = true.into();
    assert!(serde_json::from_value::<ApplicationRequestV2>(value).is_err());
    let mut input = request();
    input.contract_version = 99;
    let value = serde_json::to_value(prepare_application_v2(input)).unwrap();
    assert!(value["financeCode"].is_null());
    let mut missing = value.clone();
    missing.as_object_mut().unwrap().remove("financeCode");
    assert!(serde_json::from_value::<ApplicationPreparationV2>(missing).is_err());
    assert_eq!(value["status"], "rejected");
    assert_eq!(value["code"], "UPDATE_REQUIRED");
}
