// SPDX-License-Identifier: AGPL-3.0-or-later
//! Standard-Formschemas; relationale CAS-/Rosterprüfungen bleiben zusätzlich in Rust.
use crate::{envelopes::*, errors::*, scalars::*};
use schemars::{JsonSchema, Schema, SchemaGenerator};
use std::borrow::Cow;
pub struct PublicBindingVersion;
macro_rules! schema {
    ($name:ident,$value:expr) => {
        impl JsonSchema for $name {
            fn schema_name() -> Cow<'static, str> {
                stringify!($name).into()
            }
            fn json_schema(_: &mut SchemaGenerator) -> Schema {
                $value
            }
        }
    };
}
schema!(
    PublicBindingVersion,
    schemars::json_schema!({"type":"integer","const":2})
);
schema!(
    PublicId,
    schemars::json_schema!({"type":"string","minLength":36,"maxLength":36,"pattern":wimm_contract_primitives::public_uuid_pattern()})
);
schema!(
    Base64Url,
    schemars::json_schema!({"type":"string","minLength":1,"maxLength":crate::MAX_BASE64URL_LENGTH,"pattern":"^[A-Za-z0-9_-]+$"})
);
schema!(
    NonEmptyString,
    schemars::json_schema!({"type":"string","minLength":1})
);
schema!(
    PublicRevision,
    schemars::json_schema!({"type":"integer","minimum":0,"maximum":wimm_contract_primitives::MAX_SAFE})
);
schema!(
    PositiveRevision,
    schemars::json_schema!({"type":"integer","minimum":1,"maximum":wimm_contract_primitives::MAX_SAFE})
);
schema!(
    ProtocolVersion,
    schemars::json_schema!({"type":"integer","const":crate::PROTOCOL_VERSION})
);
pub fn exports() -> Vec<(&'static str, Schema)> {
    vec![
        (
            "public-commit-result.schema.json",
            schemars::schema_for!(wimm_persistence_contracts::CommitOutcome<crate::persistence::OperationReceiptRecord,crate::storage_port::ServerPersistenceFailure,crate::persistence::ServerOperationKey>),
        ),
        (
            "public-persistence-error.schema.json",
            schemars::schema_for!(crate::storage_port::ServerPersistenceFailure),
        ),
        (
            "public-expected-head.schema.json",
            schemars::schema_for!(crate::storage_port::ExpectedHead),
        ),
        (
            "public-aggregate-head.schema.json",
            schemars::schema_for!(crate::persistence::OpaqueAggregateHead),
        ),
        (
            "public-operation-key.schema.json",
            schemars::schema_for!(crate::persistence::ServerOperationKey),
        ),
        (
            "public-operation-receipt.schema.json",
            schemars::schema_for!(crate::persistence::OperationReceiptRecord),
        ),
        (
            "public-encrypted-snapshot.schema.json",
            schemars::schema_for!(crate::persistence::EncryptedSnapshotRecord),
        ),
        (
            "public-encrypted-change.schema.json",
            schemars::schema_for!(crate::persistence::EncryptedChangeRecord),
        ),
        (
            "public-identity.schema.json",
            schemars::schema_for!(crate::persistence::PublicIdentityRecord),
        ),
        (
            "public-error.schema.json",
            schemars::schema_for!(PublicError),
        ),
        (
            "public-form-outcome.schema.json",
            schemars::schema_for!(PublicValidationOutcome),
        ),
        (
            "public-binding-error.schema.json",
            schemars::schema_for!(PublicContractError),
        ),
        (
            "public-operation.schema.json",
            schemars::schema_for!(EncryptedOperation),
        ),
        (
            "public-header.schema.json",
            schemars::schema_for!(EncryptedOperationHeader),
        ),
        (
            "public-roster.schema.json",
            schemars::schema_for!(KeyRoster),
        ),
        (
            "public-signed-roster.schema.json",
            schemars::schema_for!(SignedKeyRoster),
        ),
    ]
}
