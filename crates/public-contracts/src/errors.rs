// SPDX-License-Identifier: AGPL-3.0-or-later
//! Öffentliche HTTP-Fehler und versionierte Formbindingfehler ohne private Payloads.
use crate::{
    FormResult, Validate, record,
    scalars::{NonEmptyString, present},
};
#[derive(Debug, Clone, Copy, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
#[cfg_attr(feature = "contract-schema", derive(schemars::JsonSchema))]
#[cfg_attr(feature = "native-bindings", derive(uniffi::Enum))]
#[cfg_attr(feature = "wasm-bindings", derive(tsify::Tsify))]
pub enum PublicErrorCode {
    InvalidEnvelope,
    InvalidSignature,
    UnsupportedCryptoSuite,
    RevisionConflict,
    EpochMismatch,
    KeyVersionMismatch,
    RosterMismatch,
    OperationIdReused,
    DependencyNotAccepted,
    UpdateRequired,
}
record!(ContractIssue {
    path: NonEmptyString,
    code: NonEmptyString
});
impl Validate for ContractIssue {
    fn validate(&self) -> FormResult<()> {
        Ok(())
    }
}
record!(PublicError {
    code:PublicErrorCode, message:NonEmptyString,
    #[serde(default,deserialize_with="present",skip_serializing_if="Option::is_none")]
    #[cfg_attr(feature="contract-schema",schemars(with="Vec<ContractIssue>"))]
    fields:Option<Vec<ContractIssue>>,
    #[serde(default,deserialize_with="present",skip_serializing_if="Option::is_none")]
    #[cfg_attr(feature="contract-schema",schemars(with="NonEmptyString"))]
    request_id:Option<NonEmptyString>,
});
impl Validate for PublicError {
    fn validate(&self) -> FormResult<()> {
        Ok(())
    }
}
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(untagged, rename_all_fields = "camelCase", deny_unknown_fields)]
#[cfg_attr(feature = "contract-schema", derive(schemars::JsonSchema))]
#[cfg_attr(feature = "native-bindings", derive(uniffi::Error))]
#[cfg_attr(feature = "wasm-bindings", derive(tsify::Tsify))]
pub enum PublicContractError {
    Rejected {
        #[cfg_attr(
            feature = "contract-schema",
            schemars(with = "crate::schema::PublicBindingVersion")
        )]
        contract_version: u32,
        code: PublicErrorCode,
        detail: String,
    },
}
impl PublicContractError {
    pub fn invalid() -> Self {
        Self::Rejected {
            contract_version: 2,
            code: PublicErrorCode::InvalidEnvelope,
            detail: "Die öffentliche Vertragsform ist ungültig.".into(),
        }
    }
    pub fn update_required() -> Self {
        Self::Rejected {
            contract_version: 2,
            code: PublicErrorCode::UpdateRequired,
            detail: "Die Protokollversion wird nicht unterstützt.".into(),
        }
    }
}
impl std::fmt::Display for PublicContractError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Rejected { detail, .. } => f.write_str(detail),
        }
    }
}
impl std::error::Error for PublicContractError {}
#[derive(Debug, Clone, Copy, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
#[cfg_attr(feature = "contract-schema", derive(schemars::JsonSchema))]
#[cfg_attr(feature = "native-bindings", derive(uniffi::Enum))]
#[cfg_attr(feature = "wasm-bindings", derive(tsify::Tsify))]
pub enum PublicValidationStatus {
    FormValid,
}
record!(PublicValidationOutcome {
    #[cfg_attr(
        feature = "contract-schema",
        schemars(with = "crate::schema::PublicBindingVersion")
    )]
    contract_version: u32,
    status: PublicValidationStatus
});
impl Validate for PublicValidationOutcome {
    fn validate(&self) -> FormResult<()> {
        if self.contract_version == 2 {
            Ok(())
        } else {
            Err("Die Bindingversion wird nicht unterstützt.")
        }
    }
}
