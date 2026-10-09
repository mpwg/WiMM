// SPDX-License-Identifier: AGPL-3.0-or-later
//! Sichere Fehlerhülle ohne Meldung, Payload, Pfad oder Schlüssel.
use crate::{Validate, record};
#[derive(Debug, Clone, Copy, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
#[cfg_attr(feature = "contract-schema", derive(schemars::JsonSchema))]
#[cfg_attr(feature = "native-bindings", derive(uniffi::Enum))]
#[cfg_attr(feature = "wasm-bindings", derive(tsify::Tsify))]
pub enum StorageFailureCode {
    RevisionConflict,
    Quota,
    ResourceUnavailable,
    WriteFailed,
    UpdateRequired,
    EpochMismatch,
    Cancelled,
    CommitUnknown,
    InvalidResponse,
    OperationIdReused,
}
#[derive(Debug, Clone, Copy, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
#[cfg_attr(feature = "contract-schema", derive(schemars::JsonSchema))]
#[cfg_attr(feature = "native-bindings", derive(uniffi::Enum))]
#[cfg_attr(feature = "wasm-bindings", derive(tsify::Tsify))]
pub enum FailureCommitState {
    NotCommitted,
    Unknown,
}
record!(StorageFailure {
    #[cfg_attr(
        feature = "contract-schema",
        schemars(with = "wimm_public_contracts::schema::PublicBindingVersion")
    )]
    contract_version: u32,
    code: StorageFailureCode,
    commit_state: FailureCommitState
});
impl Validate for StorageFailure {
    fn validate(&self) -> Result<(), &'static str> {
        if self.contract_version != 2
            || (self.code == StorageFailureCode::CommitUnknown
                && self.commit_state != FailureCommitState::Unknown)
        {
            return Err("Ungültige Speicherfehlerhülle.");
        }
        Ok(())
    }
}
impl StorageFailure {
    pub fn not_committed(code: StorageFailureCode) -> Self {
        Self {
            contract_version: 2,
            code,
            commit_state: FailureCommitState::NotCommitted,
        }
    }
    pub fn unknown(code: StorageFailureCode) -> Self {
        Self {
            contract_version: 2,
            code,
            commit_state: FailureCommitState::Unknown,
        }
    }
}
impl std::fmt::Display for StorageFailure {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{:?}", self.code)
    }
}
impl std::error::Error for StorageFailure {}

#[cfg(any(feature = "native-bindings", not(feature = "wasm-bindings")))]
pub fn roundtrip_storage_failure_v2(
    input: StorageFailure,
) -> Result<StorageFailure, crate::errors::LocalContractError> {
    input
        .validate()
        .map_err(|_| crate::errors::LocalContractError::invalid())?;
    Ok(input)
}
#[cfg(all(feature = "wasm-bindings", not(feature = "native-bindings")))]
#[wasm_bindgen::prelude::wasm_bindgen]
pub fn roundtrip_storage_failure_v2(
    input: tsify::Ts<StorageFailure>,
) -> Result<tsify::Ts<StorageFailure>, wasm_bindgen::JsValue> {
    let invalid = || {
        tsify::Ts::from_rust(&crate::errors::LocalContractError::invalid())
            .expect("Statischer Fehler")
            .js_value()
    };
    let raw = input.js_value();
    if !wimm_contract_primitives::wasm_data::check(&raw) {
        return Err(invalid());
    }
    let text = js_sys::JSON::stringify(&raw)
        .map_err(|_| invalid())?
        .as_string()
        .ok_or_else(invalid)?;
    let value: StorageFailure = serde_json::from_str(&text).map_err(|_| invalid())?;
    tsify::Ts::from_rust(&value).map_err(|_| invalid())
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn codes_status_und_strikte_huelle_bleiben_erhalten() {
        for code in [
            StorageFailureCode::RevisionConflict,
            StorageFailureCode::Quota,
            StorageFailureCode::ResourceUnavailable,
            StorageFailureCode::WriteFailed,
            StorageFailureCode::UpdateRequired,
            StorageFailureCode::EpochMismatch,
            StorageFailureCode::Cancelled,
            StorageFailureCode::CommitUnknown,
            StorageFailureCode::InvalidResponse,
            StorageFailureCode::OperationIdReused,
        ] {
            let value = if code == StorageFailureCode::CommitUnknown {
                StorageFailure::unknown(code)
            } else {
                StorageFailure::not_committed(code)
            };
            let text = serde_json::to_string(&value).unwrap();
            let decoded: StorageFailure = serde_json::from_str(&text).unwrap();
            assert_eq!(decoded.code, code);
            assert_eq!(decoded.commit_state, value.commit_state);
        }
        for text in [
            r#"{"contractVersion":2,"code":"SECRET","commitState":"notCommitted"}"#,
            r#"{"contractVersion":1,"code":"QUOTA","commitState":"notCommitted"}"#,
            r#"{"contractVersion":2,"code":"QUOTA","commitState":"notCommitted","payload":"secret"}"#,
            r#"{"contractVersion":2,"code":"COMMIT_UNKNOWN","commitState":"notCommitted"}"#,
        ] {
            assert!(serde_json::from_str::<StorageFailure>(text).is_err());
        }
    }
}
