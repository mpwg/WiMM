// SPDX-License-Identifier: AGPL-3.0-or-later
#![forbid(unsafe_code)]
#[test]
fn native_local_migration_forms_preserve_the_shared_oracles_without_writes() {
    let catalog: serde_json::Value =
        serde_json::from_str(include_str!("fixtures/migration-forms.json")).unwrap();
    assert_eq!(catalog["synthetic"], true);
    let cases = catalog["cases"].as_array().unwrap();
    assert_eq!(cases.len(), 20);
    for c in cases {
        let valid = serde_json::from_value::<wimm_local_contracts::models::StorageMigrationPlan>(
            c["request"].clone(),
        )
        .is_ok();
        assert_eq!(valid, c["valid"].as_bool().unwrap(), "{}", c["name"]);
    }
}
