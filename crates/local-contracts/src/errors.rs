// SPDX-License-Identifier: AGPL-3.0-or-later
//! Versionierte lokale Formfehler; keine Persistenz-/Commitbehauptung.
use crate::{Validate, record};
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(untagged, rename_all_fields = "camelCase", deny_unknown_fields)]
#[cfg_attr(feature = "contract-schema", derive(schemars::JsonSchema))]
#[cfg_attr(feature = "native-bindings", derive(uniffi::Error))]
#[cfg_attr(feature = "wasm-bindings", derive(tsify::Tsify))]
pub enum LocalContractError {
    Rejected {
        #[cfg_attr(
            feature = "contract-schema",
            schemars(with = "wimm_public_contracts::schema::PublicBindingVersion")
        )]
        contract_version: u32,
        code: String,
        detail: String,
    },
}
impl LocalContractError {
    pub fn invalid() -> Self {
        Self::Rejected {
            contract_version: 2,
            code: "INVALID_LOCAL_CONTRACT".into(),
            detail: "Die lokale Vertragsform ist ungültig.".into(),
        }
    }
}
impl std::fmt::Display for LocalContractError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Rejected { detail, .. } => f.write_str(detail),
        }
    }
}
impl std::error::Error for LocalContractError {}
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
#[cfg_attr(feature = "contract-schema", derive(schemars::JsonSchema))]
#[cfg_attr(feature = "native-bindings", derive(uniffi::Enum))]
#[cfg_attr(feature = "wasm-bindings", derive(tsify::Tsify))]
pub enum LocalFormStatus {
    FormValid,
}
record!(LocalFormOutcome {
    #[cfg_attr(
        feature = "contract-schema",
        schemars(with = "wimm_public_contracts::schema::PublicBindingVersion")
    )]
    contract_version: u32,
    status: LocalFormStatus
});
impl Validate for LocalFormOutcome {
    fn validate(&self) -> Result<(), &'static str> {
        if self.contract_version == 2 {
            Ok(())
        } else {
            Err("Die lokale Bindingversion wird nicht unterstützt.")
        }
    }
}
