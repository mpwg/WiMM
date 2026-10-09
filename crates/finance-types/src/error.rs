// SPDX-License-Identifier: AGPL-3.0-or-later
//! Sprachneutraler Bindingfehler ohne Originalpayloads oder Schlüssel.
#[cfg_attr(feature = "native-bindings", derive(uniffi::Error))]
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ContractError {
    Rejected { code: String, detail: String },
}
impl ContractError {
    pub fn invalid_command() -> Self {
        Self::Rejected {
            code: "INVALID_COMMAND".into(),
            detail: "Der Fachbefehl ist ungültig.".into(),
        }
    }
}
impl From<(&'static str, &'static str)> for ContractError {
    fn from((code, message): (&'static str, &'static str)) -> Self {
        Self::Rejected {
            code: code.into(),
            detail: message.into(),
        }
    }
}
impl std::fmt::Display for ContractError {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Rejected { detail, .. } => formatter.write_str(detail),
        }
    }
}
impl std::error::Error for ContractError {}
