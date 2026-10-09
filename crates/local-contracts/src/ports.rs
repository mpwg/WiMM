// SPDX-License-Identifier: AGPL-3.0-or-later
//! Plattform-/Profil-/Sicherungsportdaten; Implementierungen bleiben außerhalb der Vertragsquelle.
use crate::{
    Validate,
    models::{EncryptedBackupReceipt, StorageMigrationPlan},
    record,
    scalars::{LocalId, LocalPositive},
    storage::{LegacyJson, LocalSnapshot},
};
use serde::{Deserialize, Serialize};
record!(ImportFileRequest {
    accepted_media_types:Vec<String>,accepted_extensions:Vec<String>,multiple:bool,
    #[serde(default,skip_serializing_if="Option::is_none",deserialize_with="wimm_public_contracts::scalars::present")]
    #[cfg_attr(feature="contract-schema",schemars(with="LocalPositive"))]
    max_bytes:Option<LocalPositive>,
    #[serde(default,skip_serializing_if="Option::is_none",deserialize_with="wimm_public_contracts::scalars::present")]
    #[cfg_attr(feature="contract-schema",schemars(with="LocalPositive"))]
    max_files:Option<LocalPositive>,
    #[serde(default,skip_serializing_if="Option::is_none",deserialize_with="wimm_public_contracts::scalars::present")]
    #[cfg_attr(feature="contract-schema",schemars(with="LocalPositive"))]
    max_total_bytes:Option<LocalPositive>,
});
impl Validate for ImportFileRequest {
    fn validate(&self) -> Result<(), &'static str> {
        if self.max_bytes.is_some_and(|v| v.value() > 25 * 1024 * 1024)
            || self.max_files.is_some_and(|v| v.value() > 10)
            || self
                .max_total_bytes
                .is_some_and(|v| v.value() > 50 * 1024 * 1024)
        {
            Err("Die Dateiauswahlgrenzen dürfen nicht überschritten werden.")
        } else {
            Ok(())
        }
    }
}
record!(ImportedFile {
    name:String,
    #[serde(default,skip_serializing_if="Option::is_none",deserialize_with="wimm_public_contracts::scalars::present")]
    #[cfg_attr(feature="contract-schema",schemars(with="String"))]
    media_type:Option<String>,bytes:Vec<u8>,
});
impl Validate for ImportedFile {
    fn validate(&self) -> Result<(), &'static str> {
        Ok(())
    }
}
record!(ExportFileRequest {suggested_name:String,media_type:String,bytes:Vec<u8>});
impl Validate for ExportFileRequest {
    fn validate(&self) -> Result<(), &'static str> {
        Ok(())
    }
}
record!(PlatformCommand {
    id: String,
    title: String,
    enabled: bool
});
impl Validate for PlatformCommand {
    fn validate(&self) -> Result<(), &'static str> {
        Ok(())
    }
}
record!(EncryptedBackupRequest {profile_id:LocalId,space_id:LocalId,epoch:LocalId,snapshot_hash:crate::scalars::LocalHash,ciphertext:Vec<u8>});
impl Validate for EncryptedBackupRequest {
    fn validate(&self) -> Result<(), &'static str> {
        Ok(())
    }
}
// Snapshot und Backup bleiben explizit getrennt; kein SQL-Callback im Migrationsvertrag.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
#[cfg_attr(feature = "contract-schema", derive(schemars::JsonSchema))]
#[cfg_attr(feature = "native-bindings", derive(uniffi::Record))]
#[cfg_attr(feature = "wasm-bindings", derive(tsify::Tsify))]
pub struct LocalMigrationRequest {
    pub plan: StorageMigrationPlan,
    pub expected_snapshot: LocalSnapshot,
    #[serde(
        default,
        skip_serializing_if = "Option::is_none",
        deserialize_with = "wimm_public_contracts::scalars::present"
    )]
    #[cfg_attr(feature = "contract-schema", schemars(with = "EncryptedBackupReceipt"))]
    pub backup: Option<EncryptedBackupReceipt>,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(
    tag = "kind",
    rename_all = "camelCase",
    rename_all_fields = "camelCase",
    deny_unknown_fields
)]
#[cfg_attr(feature = "contract-schema", derive(schemars::JsonSchema))]
#[cfg_attr(feature = "native-bindings", derive(uniffi::Enum))]
#[cfg_attr(feature = "wasm-bindings", derive(tsify::Tsify))]
pub enum ProfileLoadOutcome {
    Missing,
    Loaded { profile: LegacyJson },
    Corrupt,
    Unreadable,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(
    tag = "status",
    rename_all = "camelCase",
    rename_all_fields = "camelCase",
    deny_unknown_fields
)]
#[cfg_attr(feature = "contract-schema", derive(schemars::JsonSchema))]
#[cfg_attr(feature = "native-bindings", derive(uniffi::Enum))]
#[cfg_attr(feature = "wasm-bindings", derive(tsify::Tsify))]
pub enum StoragePersistenceOutcome {
    Unsupported {
        supported: crate::scalars::UnsupportedFlag,
    },
    Granted {
        supported: crate::scalars::SupportedFlag,
    },
    Denied {
        supported: crate::scalars::SupportedFlag,
    },
    Error {
        supported: crate::scalars::SupportedFlag,
    },
}
