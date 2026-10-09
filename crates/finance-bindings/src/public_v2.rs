// SPDX-License-Identifier: AGPL-3.0-or-later
//! Native V2-Formbindings mit ausschließlich öffentlichen Rust-Modellen.
use wimm_public_contracts::{
    envelopes::{EncryptedOperation, SignedKeyRoster},
    errors::{PublicContractError, PublicValidationOutcome},
};
#[uniffi::export]
pub fn validate_public_operation_form_v2(
    operation: EncryptedOperation,
) -> Result<PublicValidationOutcome, PublicContractError> {
    wimm_public_contracts::api::validate_public_operation_form_v2(operation)
}
#[uniffi::export]
pub fn validate_public_roster_form_v2(
    roster: SignedKeyRoster,
) -> Result<PublicValidationOutcome, PublicContractError> {
    wimm_public_contracts::api::validate_public_roster_form_v2(roster)
}

#[cfg(feature = "contract-probe")]
#[uniffi::export]
pub fn public_operation_from_json(
    input: String,
) -> Result<EncryptedOperation, PublicContractError> {
    serde_json::from_str(&input).map_err(|_| PublicContractError::invalid())
}
#[cfg(feature = "contract-probe")]
#[uniffi::export]
pub fn public_roster_from_json(input: String) -> Result<SignedKeyRoster, PublicContractError> {
    serde_json::from_str(&input).map_err(|_| PublicContractError::invalid())
}
