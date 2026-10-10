// SPDX-License-Identifier: AGPL-3.0-or-later
use wimm_finance_types::scalars::*;
use wimm_local_contracts::commit::*;
pub fn id(n: u32) -> EntityId {
    EntityId::new(format!("50000000-0000-4000-8000-{n:012}")).unwrap()
}
pub fn path(name: &str) -> std::path::PathBuf {
    let root =
        std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("../../test-results/ar04/native");
    std::fs::create_dir_all(&root).unwrap();
    root.join(format!(
        "{name}-{}-{}.sqlite3",
        std::process::id(),
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_nanos()
    ))
}
pub fn request(operation: u32, revision: u32) -> LocalCommitRequest {
    let mut value: serde_json::Value =
        serde_json::from_str(include_str!("../fixtures/receipt-request.json")).unwrap();
    value["identity"]["operationId"] = serde_json::to_value(id(operation)).unwrap();
    value["batch"]["aggregates"][0]["revision"] = revision.into();
    value["batch"]["expectedRevisions"][0]["expectedRevision"] = (revision - 1).into();
    value["batch"]["outbox"][0]["operationId"] = serde_json::to_value(id(operation + 100)).unwrap();
    serde_json::from_value(value).unwrap()
}
