// SPDX-License-Identifier: AGPL-3.0-or-later
#![forbid(unsafe_code)]
use diesel::prelude::*;
use wimm_browser_runtime::StorageHost;
use wimm_finance_types::scalars::EntityId;
use wimm_local_contracts::{
    persistence_errors::StorageFailureCode, storage::*, storage_port::NeverCancel,
};
fn id(n: u32) -> EntityId {
    EntityId::new(format!("10000000-0000-4000-8000-{n:012}")).unwrap()
}
fn request(command: LocalPortCommand) -> LocalPortRequestV2 {
    LocalPortRequestV2 {
        contract_version: 2.into(),
        command,
    }
}
#[test]
fn same_current_connection_factory_persists_real_snapshot_and_rejects_unknown_binding_before_write()
{
    let root =
        std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("../../test-results/dal04/native");
    std::fs::create_dir_all(&root).unwrap();
    let file = root.join(format!(
        "{}-{}.sqlite3",
        std::process::id(),
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_nanos()
    ));
    let mut connection = SqliteConnection::establish(file.to_str().unwrap()).unwrap();
    wimm_local_dal::sqlite::SqliteStore::initialize_connection_cancellable(
        &mut connection,
        &NeverCancel,
    )
    .unwrap();
    let mut host = StorageHost::from_connection(connection, id(1)).unwrap();
    host.port(request(LocalPortCommand::InitializeArea {
        space_id: id(2),
        proposed_epoch: id(3),
    }))
    .unwrap();
    let before = host
        .port(request(LocalPortCommand::ExportSnapshot {
            space_id: id(2),
        }))
        .unwrap();
    let json = serde_json::to_value(&before).unwrap();
    assert_eq!(json["value"]["storageSchemaVersion"], 2);
    assert_eq!(json["value"]["epoch"], id(3).as_str());
    assert!(json["value"].get("syncState").is_none());
    let mut wrong = request(LocalPortCommand::InitializeArea {
        space_id: id(2),
        proposed_epoch: id(99),
    });
    wrong.contract_version = 1.into();
    assert_eq!(
        host.port(wrong).unwrap_err().code,
        StorageFailureCode::UpdateRequired
    );
    drop(host);
    let mut reopened = StorageHost::from_connection(
        SqliteConnection::establish(file.to_str().unwrap()).unwrap(),
        id(1),
    )
    .unwrap();
    assert_eq!(
        serde_json::to_value(
            reopened
                .port(request(LocalPortCommand::ExportSnapshot {
                    space_id: id(2)
                }))
                .unwrap()
        )
        .unwrap(),
        json
    );
    let mut foreign = StorageHost::from_connection(
        SqliteConnection::establish(file.to_str().unwrap()).unwrap(),
        id(90),
    )
    .unwrap();
    foreign
        .port(request(LocalPortCommand::InitializeArea {
            space_id: id(2),
            proposed_epoch: id(91),
        }))
        .unwrap();
    let other = serde_json::to_value(
        foreign
            .port(request(LocalPortCommand::ExportSnapshot {
                space_id: id(2),
            }))
            .unwrap(),
    )
    .unwrap();
    assert_eq!(other["value"]["epoch"], id(91).as_str());
    assert_eq!(
        serde_json::to_value(
            reopened
                .port(request(LocalPortCommand::ExportSnapshot {
                    space_id: id(2)
                }))
                .unwrap()
        )
        .unwrap(),
        json
    );
}
