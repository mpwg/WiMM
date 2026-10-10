// SPDX-License-Identifier: AGPL-3.0-or-later
#![forbid(unsafe_code)]
use wimm_local_contracts::{checkpoint::*, commit::*};
#[test]
fn checkpoint_versions_scope_and_receipt_correlations_are_native_guards() {
    let request: LocalCommitRequest = serde_json::from_str(include_str!(
        "../../local-dal/tests/fixtures/receipt-request.json"
    ))
    .unwrap();
    let value = serde_json::json!({"checkpointVersion":1,"physicalSchemaVersion":1,"snapshot":{"storageSchemaVersion":1,"domainSchemaVersion":1,"profileId":request.identity.profile_id,"spaceId":request.identity.space_id,"epoch":request.identity.epoch,"aggregates":request.batch.aggregates,"pending":request.batch.outbox,"projections":request.batch.projections,"confirmed":[]},"operations":[{"request":request,"receipt":{"identity":request.identity,"contentHash":"ab".repeat(32),"committedRevisions":[{"handle":request.batch.aggregates[0].handle,"revision":1}]}}]});
    assert!(serde_json::from_value::<LocalCommitCheckpoint>(value.clone()).is_ok());
    for (field, v) in [("checkpointVersion", 2), ("physicalSchemaVersion", 2)] {
        let mut wrong = value.clone();
        wrong[field] = v.into();
        assert!(serde_json::from_value::<LocalCommitCheckpoint>(wrong).is_err());
    }
    let mut wrong = value.clone();
    wrong["operations"][0]["receipt"]["committedRevisions"][0]["revision"] = 2.into();
    assert!(serde_json::from_value::<LocalCommitCheckpoint>(wrong).is_err());
    let mut wrong = value.clone();
    wrong["snapshot"]["confirmed"] = serde_json::json!([{"spaceId":request.identity.space_id,"epoch":request.identity.epoch,"aggregate":request.batch.aggregates[0]}]);
    assert!(serde_json::from_value::<LocalCommitCheckpoint>(wrong).is_err());
    let mut wrong = value.clone();
    wrong["operations"]
        .as_array_mut()
        .unwrap()
        .push(value["operations"][0].clone());
    assert!(serde_json::from_value::<LocalCommitCheckpoint>(wrong).is_err());
}
