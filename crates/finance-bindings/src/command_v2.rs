// SPDX-License-Identifier: AGPL-3.0-or-later
//! V2-Binding derselben privaten Rust-Befehlsformen und Fachhandler.
use wimm_finance_types::{
    ContractError,
    command_contracts::{ChangeSet, CommandResult, Request},
};

#[derive(Debug, Clone, uniffi::Enum)]
pub enum CommandOutcomeV2 {
    Changed {
        contract_version: u32,
        change_set: ChangeSet,
    },
    Unchanged {
        contract_version: u32,
    },
}

impl CommandOutcomeV2 {
    pub fn to_v1_json(self) -> Result<String, ContractError> {
        let wire = match self {
            Self::Changed {
                contract_version: 2,
                change_set,
            } => CommandResult::Changed(change_set).to_wire(),
            Self::Unchanged {
                contract_version: 2,
            } => CommandResult::Unchanged.to_wire(),
            _ => {
                return Err((
                    "UPDATE_REQUIRED",
                    "Der Enginevertrag wird nicht unterstützt.",
                )
                    .into());
            }
        };
        wire.map(|value| value.to_string())
            .map_err(ContractError::from)
    }
}

/// Expliziter Formadapter für den synthetischen Bindingkatalog, keine Finanzberechnung.
#[cfg(feature = "contract-probe")]
#[uniffi::export]
pub fn command_request_from_v1(input: String) -> Result<Request, ContractError> {
    let mut request =
        wimm_finance_core::decode_command_request_v1(&input).map_err(ContractError::from)?;
    request.contract_version = 2.into();
    Ok(request)
}

#[cfg(feature = "contract-probe")]
#[uniffi::export]
pub fn command_outcome_to_v1(outcome: CommandOutcomeV2) -> Result<String, ContractError> {
    outcome.to_v1_json()
}

#[cfg(feature = "contract-probe")]
#[uniffi::export]
pub fn command_error_to_v1(error: ContractError) -> String {
    let ContractError::Rejected { code, detail } = error;
    serde_json::json!({"contractVersion":1,"status":"rejected","error":{"code":code,"message":detail}}).to_string()
}

#[uniffi::export]
pub fn execute_v2(mut request: Request) -> Result<CommandOutcomeV2, ContractError> {
    if request.contract_version != crate::v2::BINDING_VERSION || request.domain_schema_version != 1
    {
        return Err((
            "UPDATE_REQUIRED",
            "Der Enginevertrag wird nicht unterstützt.",
        )
            .into());
    }
    // Nur Bindingversion anpassen; dieselben Modelle, keine JSON-Rekonstruktion.
    request.contract_version = 1.into();
    match wimm_finance_core::execute(request).map_err(ContractError::from)? {
        CommandResult::Changed(change_set) => Ok(CommandOutcomeV2::Changed {
            contract_version: 2,
            change_set,
        }),
        CommandResult::Unchanged => Ok(CommandOutcomeV2::Unchanged {
            contract_version: 2,
        }),
    }
}
