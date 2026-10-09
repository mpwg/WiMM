// SPDX-License-Identifier: AGPL-3.0-or-later
//! Explizite V1-Ergebnisformen; dieselben typisierten Erfolge, unveränderte Fehlerhülle.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
#[cfg_attr(feature = "contract-schema", derive(schemars::JsonSchema))]
pub struct LegacyError {
    pub code: String,
    pub message: String,
}
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
#[cfg_attr(feature = "contract-schema", derive(schemars::JsonSchema))]
pub enum RejectedStatus {
    Rejected,
}
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
#[cfg_attr(feature = "contract-schema", derive(schemars::JsonSchema))]
pub struct LegacyRejected {
    pub contract_version: u32,
    pub status: RejectedStatus,
    pub error: LegacyError,
}
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(untagged)]
#[cfg_attr(feature = "contract-schema", derive(schemars::JsonSchema))]
pub enum LegacyOutcome<T> {
    Success(T),
    Rejected(LegacyRejected),
}
