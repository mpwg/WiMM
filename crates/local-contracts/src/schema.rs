// SPDX-License-Identifier: AGPL-3.0-or-later
//! Lokale Strukturformen; lückenlose Migrationsrelationen zusätzlich in Rust.
use crate::{errors::*, models::*};
use schemars::Schema;
pub fn exports() -> Vec<(&'static str, Schema)> {
    vec![
        (
            "local-versions.schema.json",
            schemars::schema_for!(StorageVersions),
        ),
        (
            "local-migration-step.schema.json",
            schemars::schema_for!(StorageMigrationStep),
        ),
        (
            "local-migration-plan.schema.json",
            schemars::schema_for!(StorageMigrationPlan),
        ),
        (
            "local-application-scope.schema.json",
            schemars::schema_for!(ApplicationScope),
        ),
        (
            "local-backup-receipt.schema.json",
            schemars::schema_for!(EncryptedBackupReceipt),
        ),
        (
            "local-form-outcome.schema.json",
            schemars::schema_for!(LocalFormOutcome),
        ),
        (
            "local-binding-error.schema.json",
            schemars::schema_for!(LocalContractError),
        ),
    ]
}
