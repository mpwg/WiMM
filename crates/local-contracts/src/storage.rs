// SPDX-License-Identifier: AGPL-3.0-or-later
//! Vollständige vorhandene lokale Datenformen, keine ORM-Entities oder Finanzregeln.
use serde::{Deserialize, Serialize};
use wimm_finance_types::{
    models::Aggregate,
    scalars::{EntityId, MoneyCents, NonEmptyText, Ordinal, Revision, UtcTimestamp, present},
    state_contracts::Consumption,
};
macro_rules! record {
    ($name:ident {$($(#[$attr:meta])* $field:ident:$ty:ty),* $(,)?})=>{
        #[derive(Debug,Clone,Serialize,Deserialize)]
        #[serde(rename_all="camelCase",deny_unknown_fields)]
        #[cfg_attr(feature="contract-schema",derive(schemars::JsonSchema))]
        #[cfg_attr(feature="native-bindings",derive(uniffi::Record))]
        #[cfg_attr(feature="wasm-bindings",derive(tsify::Tsify))]
        pub struct $name {$($(#[$attr])* pub $field:$ty),*}
    }
}
/// Native Records trennen Handle und Fachaggregat; Serde erhält das flache V1-Format.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[cfg_attr(feature = "contract-schema", derive(schemars::JsonSchema))]
#[cfg_attr(feature = "native-bindings", derive(uniffi::Record))]
#[cfg_attr(feature = "wasm-bindings", derive(tsify::Tsify))]
#[cfg_attr(feature="contract-schema",schemars(extend("unevaluatedProperties" = false)))]
#[cfg_attr(
    feature = "wasm-bindings",
    tsify(type = "Aggregate & { handle: EntityId }")
)]
pub struct StoredAggregate {
    pub handle: EntityId,
    #[serde(flatten)]
    pub aggregate: Aggregate,
}
record!(ConfirmedAggregate {
    space_id: EntityId,
    epoch: EntityId,
    aggregate: StoredAggregate
});
record!(RevisionExpectation {
    handle: EntityId,
    expected_revision: Revision
});
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
#[cfg_attr(feature = "contract-schema", derive(schemars::JsonSchema))]
#[cfg_attr(feature = "native-bindings", derive(uniffi::Enum))]
#[cfg_attr(feature = "wasm-bindings", derive(tsify::Tsify))]
pub enum PendingState {
    Queued,
    Sending,
    Accepted,
    Conflict,
    Blocked,
    Forbidden,
    Invalid,
}
// Bewusst opakes bestehendes JSON-Entwurfsformat; niemals automatisch neu interpretieren.
record!(PendingOperation {
    operation_id:EntityId,space_id:EntityId,expected_revisions:Vec<RevisionExpectation>,depends_on:Vec<EntityId>,state:PendingState,
    draft:LegacyJson,retry_count:Ordinal,
    #[serde(default,deserialize_with="present",skip_serializing_if="Option::is_none")]
    #[cfg_attr(feature="contract-schema",schemars(with="UtcTimestamp"))]
    created_at:Option<UtcTimestamp>,
});
record!(BalancePayload {
    #[serde(default,deserialize_with="present",skip_serializing_if="Option::is_none")]
    #[cfg_attr(feature="contract-schema",schemars(with="EntityId"))]
    account_id:Option<EntityId>,
    balance:MoneyCents,
});
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
pub enum StoredProjection {
    Balance {
        space_id: EntityId,
        key: EntityId,
        payload: MoneyCents,
    },
    AccountBalance {
        space_id: EntityId,
        key: EntityId,
        payload: BalancePayload,
    },
    Consumption {
        space_id: EntityId,
        key: NonEmptyText,
        payload: Consumption,
    },
}
record!(SyncState {
    profile_id: EntityId,
    space_id: EntityId,
    epoch: EntityId,
    cursor: String
});
record!(SyncPage {state:SyncState,confirmed:Vec<ConfirmedAggregate>,remove_operation_ids:Vec<EntityId>,projections:Vec<StoredProjection>});
record!(LocalSnapshot {
    storage_schema_version:SnapshotStorageVersion,
    domain_schema_version:SnapshotDomainVersion,profile_id:EntityId,space_id:EntityId,epoch:EntityId,
    aggregates:Vec<StoredAggregate>,confirmed:Vec<ConfirmedAggregate>,pending:Vec<PendingOperation>,projections:Vec<StoredProjection>,
    #[serde(default,deserialize_with="present",skip_serializing_if="Option::is_none")]
    #[cfg_attr(feature="contract-schema",schemars(with="SyncState"))]
    sync_state:Option<SyncState>,
});
record!(AtomicBatch {expected_revisions:Vec<RevisionExpectation>,aggregates:Vec<StoredAggregate>,outbox:Vec<PendingOperation>,projections:Vec<StoredProjection>});
record!(ProjectionRebuild {space_id:EntityId,source_aggregates:Vec<StoredAggregate>,projections:Vec<StoredProjection>});
record!(AggregateQuery { space_id: EntityId });

impl LocalSnapshot {
    pub fn check_versions(&self) -> bool {
        [1, 2].contains(&self.storage_schema_version.value())
            && self.domain_schema_version.value() == 1
    }
}
impl SyncState {
    pub fn check_cursor(&self) -> bool {
        self.cursor == "0"
            || (!self.cursor.starts_with('0')
                && !self.cursor.is_empty()
                && self.cursor.bytes().all(|b| b.is_ascii_digit()))
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(
    tag = "method",
    rename_all = "camelCase",
    rename_all_fields = "camelCase",
    deny_unknown_fields
)]
#[cfg_attr(feature = "contract-schema", derive(schemars::JsonSchema))]
#[cfg_attr(feature = "native-bindings", derive(uniffi::Enum))]
#[cfg_attr(feature = "wasm-bindings", derive(tsify::Tsify))]
pub enum LocalPortCommand {
    ReadAggregate {
        handle: EntityId,
    },
    Query {
        query: AggregateQuery,
    },
    ApplyAtomicBatch {
        batch: AtomicBatch,
    },
    LoadConfirmed {
        space_id: EntityId,
    },
    LoadPending {
        space_id: EntityId,
    },
    SaveSyncPage {
        page: SyncPage,
    },
    ExportSnapshot {
        space_id: EntityId,
    },
    ReplaceSnapshot {
        snapshot: LocalSnapshot,
    },
    RebuildProjections {
        request: ProjectionRebuild,
    },
    GetSyncState {
        space_id: EntityId,
    },
    InitializeArea {
        space_id: EntityId,
        proposed_epoch: EntityId,
    },
}
record!(LocalPortRequestV2 {
    #[cfg_attr(
        feature = "contract-schema",
        schemars(with = "wimm_public_contracts::schema::PublicBindingVersion")
    )]
    contract_version: wimm_finance_types::versions::EngineBindingVersion,
    command: LocalPortCommand
});
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
pub enum LocalPortOutcomeV2 {
    Aggregate {
        contract_version: u32,
        value: Option<StoredAggregate>,
    },
    Aggregates {
        contract_version: u32,
        value: Vec<StoredAggregate>,
    },
    Confirmed {
        contract_version: u32,
        value: Vec<ConfirmedAggregate>,
    },
    Pending {
        contract_version: u32,
        value: Vec<PendingOperation>,
    },
    Snapshot {
        contract_version: u32,
        value: LocalSnapshot,
    },
    SyncState {
        contract_version: u32,
        value: Option<SyncState>,
    },
    Initialized {
        contract_version: u32,
        epoch: EntityId,
    },
    Applied {
        contract_version: u32,
    },
}
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
#[cfg_attr(feature = "contract-schema", derive(schemars::JsonSchema))]
#[cfg_attr(feature = "native-bindings", derive(uniffi::Enum))]
#[cfg_attr(feature = "wasm-bindings", derive(tsify::Tsify))]
pub enum PersistenceErrorCode {
    RevisionConflict,
    Quota,
    WriteFailed,
    UpdateRequired,
    EpochMismatch,
    OperationIdReused,
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
pub enum CommitOutcomeV2 {
    Committed {
        contract_version: u32,
        value: Box<LocalPortOutcomeV2>,
    },
    NotCommitted {
        contract_version: u32,
        code: PersistenceErrorCode,
    },
    Unknown {
        contract_version: u32,
        operation_id: EntityId,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(transparent)]
#[cfg_attr(feature = "contract-schema", derive(schemars::JsonSchema))]
#[cfg_attr(feature = "wasm-bindings", derive(tsify::Tsify))]
pub struct LegacyJson(
    #[cfg_attr(feature = "wasm-bindings", tsify(type = "unknown"))] pub serde_json::Value,
);
#[cfg(feature = "native-bindings")]
uniffi::custom_type!(LegacyJson,String,{lower:|v|v.0.to_string(),try_lift:|v|Ok(LegacyJson(serde_json::from_str(&v).map_err(|_|wimm_finance_types::ContractError::invalid_command())?))});

macro_rules! version {
    ($name:ident,$supported:expr)=>{
        #[derive(Debug,Clone,Copy,Serialize)]
        #[serde(transparent)]
        #[cfg_attr(feature="wasm-bindings",derive(tsify::Tsify))]
        pub struct $name(u32);
        impl $name {pub fn value(self)->u32{self.0}pub fn new(v:u32)->Result<Self,&'static str>{if $supported.contains(&v){Ok(Self(v))}else{Err("Die lokale Storage-/Fachversion wird nicht unterstützt.")}}}
        impl<'de> Deserialize<'de> for $name{fn deserialize<D:serde::Deserializer<'de>>(d:D)->Result<Self,D::Error>{Self::new(u32::try_from(wimm_contract_primitives::integer(d)?).map_err(serde::de::Error::custom)?).map_err(serde::de::Error::custom)}}
        #[cfg(feature="contract-schema")]
        impl schemars::JsonSchema for $name {fn schema_name()->std::borrow::Cow<'static,str>{stringify!($name).into()}fn json_schema(_: &mut schemars::SchemaGenerator)->schemars::Schema{schemars::json_schema!({"type":"integer","enum":$supported})}}
        #[cfg(feature="native-bindings")]
        uniffi::custom_type!($name,u32,{lower:|v|v.value(),try_lift:|v|Ok($name::new(v).map_err(|_|wimm_finance_types::ContractError::from(("UPDATE_REQUIRED","Die lokale Storage-/Fachversion wird nicht unterstützt.")))?)});
    }
}
version!(SnapshotStorageVersion, [1, 2]);
version!(SnapshotDomainVersion, [1]);

/// Historische Originalentwürfe enthalten entweder Fachaggregate oder flache StoredAggregate-Records.
/// Kein Umformen des Originals; nur typisierte Struktur-/Handleprüfung für vorhandene Daten.
pub fn decode_draft_aggregate(value: &serde_json::Value) -> Result<Aggregate, &'static str> {
    if value.get("handle").is_some() {
        let stored: StoredAggregate =
            serde_json::from_value(value.clone()).map_err(|_| "Ungültiges Originalaggregat.")?;
        if stored.handle != *stored.aggregate.id() {
            return Err("Widersprüchlicher Originalhandle.");
        }
        Ok(stored.aggregate)
    } else {
        serde_json::from_value(value.clone()).map_err(|_| "Ungültiges Originalaggregat.")
    }
}
#[cfg(test)]
mod draft_tests {
    use super::*;
    #[test]
    fn historical_flat_original_handles_are_checked_without_rewriting() {
        let fixture: serde_json::Value = serde_json::from_str(include_str!(
            "../../local-dal/tests/fixtures/receipt-request.json"
        ))
        .unwrap();
        let stored = fixture["batch"]["aggregates"][0].clone();
        let before = stored.clone();
        assert_eq!(
            decode_draft_aggregate(&stored).unwrap().id().as_str(),
            stored["id"].as_str().unwrap()
        );
        assert_eq!(stored, before);
        let mut plain = stored.clone();
        plain.as_object_mut().unwrap().remove("handle");
        assert!(decode_draft_aggregate(&plain).is_ok());
        let mut wrong = stored;
        wrong["handle"] = "50000000-0000-4000-8000-000000000099".into();
        assert!(decode_draft_aggregate(&wrong).is_err());
    }
}
