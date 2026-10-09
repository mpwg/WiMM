// SPDX-License-Identifier: AGPL-3.0-or-later
//! Etablierte UniFFI-Konvertierung der unveränderten geschützten Fachtypen.
use crate::versions::{DomainSchemaVersion, EngineBindingVersion};
use crate::{ContractError, models::*, scalars::*};

// Die Versionen sind die ersten beiden Requestfelder. Native Formprüfung darf
// unbekannte Versionen nicht durch einen späteren Payloadfehler verdecken.
macro_rules! supported_version {
    ($name:ident, $supported:expr) => {
        uniffi::custom_type!($name, u32, {
            lower: |value| value.value(),
            try_lift: |value| {
                if value == $supported { Ok(value.into()) } else {
                    Err(ContractError::from(("UPDATE_REQUIRED", "Der Enginevertrag wird nicht unterstützt.")).into())
                }
            },
        });
    };
}
supported_version!(EngineBindingVersion, 2);
supported_version!(DomainSchemaVersion, 1);

macro_rules! checked_string {
    ($name:ident) => {
        uniffi::custom_type!($name, String, {
            lower: |value| value.as_str().to_owned(),
            try_lift: |value| Ok($name::new(value).map_err(|_| ContractError::invalid_command())?),
        });
    };
}
checked_string!(EntityId);
checked_string!(FinanceDate);
checked_string!(UtcTimestamp);
checked_string!(NonEmptyText);
checked_string!(FileHash);

macro_rules! checked_integer {
    ($name:ident, $getter:ident) => {
        uniffi::custom_type!($name, i64, {
            lower: |value| value.$getter(),
            try_lift: |value| Ok($name::new(value).map_err(|_| ContractError::invalid_command())?),
        });
    };
}
checked_integer!(MoneyCents, cents);
checked_integer!(Revision, value);
checked_integer!(StoredRevision, value);
checked_integer!(Ordinal, value);
checked_integer!(PositiveOrdinal, value);

pub type EntityIdList = NonEmptyVec<EntityId>;
pub type AggregateList = NonEmptyVec<Aggregate>;
pub type ConditionList = NonEmptyVec<RuleCondition>;
pub type ActionList = NonEmptyVec<RuleAction>;
pub type ImportRows = BoundedVec<ImportRow, 1, 100_000>;
macro_rules! checked_list {
    ($name:ident, $element:ty) => {
        uniffi::custom_type!($name, Vec<$element>, {
            lower: |value| value.as_slice().to_vec(),
            try_lift: |value| Ok($name::new(value).map_err(|_| ContractError::invalid_command())?),
        });
    };
}
checked_list!(EntityIdList, EntityId);
checked_list!(AggregateList, Aggregate);
checked_list!(ConditionList, RuleCondition);
checked_list!(ActionList, RuleAction);
checked_list!(ImportRows, ImportRow);

// Das bestehende Importmapping ist ausdrücklich ein opakes JSON-Fremdpayload.
// Alle Aggregate/Befehle bleiben Records/Enums, keine versteckten JSON-Strings.
pub type OpaqueMapping = serde_json::Value;
uniffi::custom_type!(OpaqueMapping, String, {
    remote,
    lower: |value| value.to_string(),
    try_lift: |value| Ok(serde_json::from_str(&value).map_err(|_| ContractError::invalid_command())?),
});

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{MAX_SAFE, UniFfiTag};
    #[test]
    fn native_versions_reject_unknown_headers_before_finance_fields() {
        let binding = <EngineBindingVersion as uniffi::Lift<UniFfiTag>>::try_lift(2).unwrap();
        assert_eq!(binding.value(), 2);
        for value in [0, 1, 3, 99, u32::MAX] {
            let error = <EngineBindingVersion as uniffi::Lift<UniFfiTag>>::try_lift(value)
                .unwrap_err()
                .downcast::<ContractError>()
                .unwrap();
            assert_eq!(
                error,
                ContractError::from((
                    "UPDATE_REQUIRED",
                    "Der Enginevertrag wird nicht unterstützt."
                ))
            );
        }
        assert!(<DomainSchemaVersion as uniffi::Lift<UniFfiTag>>::try_lift(1).is_ok());
        assert!(
            <DomainSchemaVersion as uniffi::Lift<UniFfiTag>>::try_lift(2)
                .unwrap_err()
                .downcast::<ContractError>()
                .is_ok()
        );
    }
    #[test]
    fn native_cent_lift_preserves_safe_bounds_and_returns_typed_errors() {
        for value in [-MAX_SAFE, -1, 0, 1, MAX_SAFE] {
            let actual = <MoneyCents as uniffi::Lift<UniFfiTag>>::try_lift(value).unwrap();
            assert_eq!(actual.cents(), value);
        }
        for value in [-MAX_SAFE - 1, MAX_SAFE + 1, i64::MAX, i64::MIN] {
            let error = <MoneyCents as uniffi::Lift<UniFfiTag>>::try_lift(value).unwrap_err();
            assert_eq!(
                error.downcast::<ContractError>().unwrap(),
                ContractError::invalid_command()
            );
        }
    }
    #[test]
    fn native_uuid_lift_keeps_original_spelling_and_hides_invalid_payloads() {
        let input = "30000000-ABCD-4000-8000-000000000001";
        let buffer = <String as uniffi::Lower<UniFfiTag>>::lower(input.to_owned());
        assert_eq!(
            <EntityId as uniffi::Lift<UniFfiTag>>::try_lift(buffer)
                .unwrap()
                .as_str(),
            input
        );
        let buffer = <String as uniffi::Lower<UniFfiTag>>::lower("privat – ungültig 🏠".to_owned());
        let error = <EntityId as uniffi::Lift<UniFfiTag>>::try_lift(buffer)
            .unwrap_err()
            .downcast::<ContractError>()
            .unwrap();
        assert_eq!(error, ContractError::invalid_command());
        assert!(!error.to_string().contains("privat"));
    }
}
