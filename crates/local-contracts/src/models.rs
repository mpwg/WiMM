// SPDX-License-Identifier: AGPL-3.0-or-later
//! Vorhandene lokale Metadatenformen, getrennte Versions-/CAS-Dimensionen.
use crate::scalars::{
    LocalHash as Base64Url, LocalId as PublicId, LocalPositive as PositiveOrdinal,
    LocalRevision as Ordinal, LocalRevision as Revision,
};
use crate::{Validate, record};
record!(StorageVersions {
    storage_schema_version: PositiveOrdinal,
    domain_schema_version: PositiveOrdinal
});
impl Validate for StorageVersions {
    fn validate(&self) -> Result<(), &'static str> {
        Ok(())
    }
}
record!(StorageMigrationStep {
    number: PositiveOrdinal,
    from: StorageVersions,
    to: StorageVersions,
    destructive: bool
});
impl Validate for StorageMigrationStep {
    fn validate(&self) -> Result<(), &'static str> {
        let (a, b) = (
            self.from.storage_schema_version.value(),
            self.from.domain_schema_version.value(),
        );
        let (c, d) = (
            self.to.storage_schema_version.value(),
            self.to.domain_schema_version.value(),
        );
        if c >= a && d >= b && (c > a || d > b) {
            Ok(())
        } else {
            Err("Migrationen sind ausschließlich vorwärtsgerichtet.")
        }
    }
}
record!(StorageMigrationPlan {
    expected_migration_number:Ordinal,from:StorageVersions,
    #[cfg_attr(feature="contract-schema",schemars(length(min=1)))]
    steps:Vec<StorageMigrationStep>,
});
impl Validate for StorageMigrationPlan {
    fn validate(&self) -> Result<(), &'static str> {
        if self.steps.is_empty() {
            return Err("Der Migrationsplan benötigt mindestens einen Schritt.");
        }
        let mut previous = &self.from;
        for (index, step) in self.steps.iter().enumerate() {
            step.validate()?;
            let expected = self.expected_migration_number.value() as i128 + index as i128 + 1;
            if step.number.value() as i128 != expected
                || step.from.storage_schema_version != previous.storage_schema_version
                || step.from.domain_schema_version != previous.domain_schema_version
            {
                return Err(
                    "Migrationsnummern und Ausgangsversionen müssen lückenlos anschließen.",
                );
            }
            previous = &step.to;
        }
        Ok(())
    }
}
record!(ApplicationScope {
    profile_id: PublicId,
    space_id: PublicId,
    profile_revision: Revision,
    session_generation: Revision
});
impl Validate for ApplicationScope {
    fn validate(&self) -> Result<(), &'static str> {
        Ok(())
    }
}
record!(EncryptedBackupReceipt {
    backup_id: PublicId,
    profile_id: PublicId,
    space_id: PublicId,
    epoch: PublicId,
    snapshot_hash: Base64Url
});
impl Validate for EncryptedBackupReceipt {
    fn validate(&self) -> Result<(), &'static str> {
        Ok(())
    }
}
