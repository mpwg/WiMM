// SPDX-License-Identifier: AGPL-3.0-or-later
//! Unveränderte öffentliche V1-Hüllen; nur öffentliche Form-/CAS-Invarianten.
use crate::{FormResult, MAX_HANDLES, Validate, record, scalars::*};

#[derive(Debug, Clone, Copy, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
#[cfg_attr(feature = "contract-schema", derive(schemars::JsonSchema))]
#[cfg_attr(feature = "native-bindings", derive(uniffi::Enum))]
#[cfg_attr(feature = "wasm-bindings", derive(tsify::Tsify))]
pub enum CryptoSuite {
    #[serde(rename = "XCHACHA20_POLY1305_IETF_ED25519_V1")]
    V1,
}
#[derive(Debug, Clone, Copy, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
#[cfg_attr(feature = "contract-schema", derive(schemars::JsonSchema))]
#[cfg_attr(feature = "native-bindings", derive(uniffi::Enum))]
#[cfg_attr(feature = "wasm-bindings", derive(tsify::Tsify))]
pub enum Role {
    Admin,
    Member,
    Viewer,
}

record!(ExistingHandle {
    handle: PublicId,
    expected_revision: PositiveRevision,
    previous_ciphertext_hash: Base64Url
});
impl Validate for ExistingHandle {
    fn validate(&self) -> FormResult<()> {
        Ok(())
    }
}
record!(WriteHandle {
    handle: PublicId,
    expected_revision: PublicRevision,
    proposed_revision: PositiveRevision,
    #[serde(default, deserialize_with="present", skip_serializing_if="Option::is_none")]
    #[cfg_attr(feature="contract-schema",schemars(with="Base64Url"))]
    previous_ciphertext_hash: Option<Base64Url>,
});
impl Validate for WriteHandle {
    fn validate(&self) -> FormResult<()> {
        if self.proposed_revision.value() as i128 != self.expected_revision.value() as i128 + 1 {
            return Err("Die vorgeschlagene Revision muss genau um eins steigen.");
        }
        if (self.expected_revision.value() == 0) != self.previous_ciphertext_hash.is_none() {
            return Err(
                "Der vorherige Chiffrathash muss zur Neuanlage oder bestehenden Revision passen.",
            );
        }
        Ok(())
    }
}
record!(EncryptedOperationHeader {
    protocol_version: ProtocolVersion, crypto_suite: CryptoSuite,
    operation_id: PublicId, device_id: PublicId, space_id: PublicId, epoch: PublicId,
    key_version: PositiveRevision, roster_hash: Base64Url,
    #[cfg_attr(feature="contract-schema",schemars(length(max=500)))]
    depends_on: Vec<PublicId>,
    #[cfg_attr(feature="contract-schema",schemars(length(max=500)))]
    reads: Vec<ExistingHandle>,
    #[cfg_attr(feature="contract-schema",schemars(length(min=1,max=500)))]
    writes: Vec<WriteHandle>,
});
impl Validate for EncryptedOperationHeader {
    fn validate(&self) -> FormResult<()> {
        if self.depends_on.len() > MAX_HANDLES
            || self.reads.len() > MAX_HANDLES
            || !(1..=MAX_HANDLES).contains(&self.writes.len())
        {
            return Err("Die öffentliche Handleliste überschreitet ihre Formgrenze.");
        }
        for write in &self.writes {
            write.validate()?;
        }
        Ok(())
    }
}
record!(EncryptedOperation {
    header: EncryptedOperationHeader,
    nonce: Base64Url,
    ciphertext: Base64Url,
    signature: Base64Url
});
impl Validate for EncryptedOperation {
    fn validate(&self) -> FormResult<()> {
        self.header.validate()
    }
}
record!(KeyRosterMember {
    user_id: PublicId,
    identity_public_key: Base64Url,
    role: Role
});
impl Validate for KeyRosterMember {
    fn validate(&self) -> FormResult<()> {
        Ok(())
    }
}
record!(KeyRoster {
    protocol_version:ProtocolVersion, crypto_suite:CryptoSuite, space_id:PublicId,
    roster_version:PositiveRevision,
    #[serde(default, deserialize_with="present", skip_serializing_if="Option::is_none")]
    #[cfg_attr(feature="contract-schema",schemars(with="Base64Url"))]
    previous_manifest_hash:Option<Base64Url>,
    epoch:PublicId, key_version:PositiveRevision,
    #[cfg_attr(feature="contract-schema",schemars(length(min=1,max=500)))]
    members:Vec<KeyRosterMember>,
});
impl Validate for KeyRoster {
    fn validate(&self) -> FormResult<()> {
        if !(1..=MAX_HANDLES).contains(&self.members.len()) {
            return Err("Das öffentliche Roster benötigt ein bis 500 Mitglieder.");
        }
        if (self.roster_version.value() == 1) != self.previous_manifest_hash.is_none() {
            return Err("Der vorherige Manifesthash muss zu Genesis oder Folge-Roster passen.");
        }
        Ok(())
    }
}
record!(SignedKeyRoster {
    roster: KeyRoster,
    signature: Base64Url
});
impl Validate for SignedKeyRoster {
    fn validate(&self) -> FormResult<()> {
        self.roster.validate()
    }
}
