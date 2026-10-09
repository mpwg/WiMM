// SPDX-License-Identifier: AGPL-3.0-or-later
//! AR02: strukturelle Schemas aus den vorhandenen Rust-Verträgen; keine Produktumschaltung.
use schemars::{JsonSchema, Schema, SchemaGenerator};
use std::borrow::Cow;
pub(crate) fn integer(min: i64) -> Schema {
    schemars::json_schema!({"type":"integer","minimum":min,"maximum":crate::MAX_SAFE})
}
pub(crate) fn non_empty_text() -> Schema {
    // Dieselbe JS-Whitespacequelle wie der Konstruktor; keine zweite Feldvalidierungsliste.
    let spaces = (0..=0x10ffff)
        .filter_map(char::from_u32)
        .filter(|c| crate::aggregate_schema::js_space(*c))
        .map(|c| format!("\\u{:04x}", c as u32))
        .collect::<String>();
    schemars::json_schema!({"type":"string","minLength":1,"pattern":format!("[^{spaces}]")})
}
pub(crate) struct RequiredNullableCandidate;
impl JsonSchema for RequiredNullableCandidate {
    fn schema_name() -> Cow<'static, str> {
        "RequiredNullableCandidate".into()
    }
    fn json_schema(generator: &mut SchemaGenerator) -> Schema {
        generator.subschema_for::<Option<crate::models::ImportCandidate>>()
    }
}
pub fn aggregate() -> Schema {
    schemars::schema_for!(crate::models::Aggregate)
}
pub fn command() -> Schema {
    schemars::schema_for!(crate::models::Command)
}
pub fn request() -> Schema {
    schemars::schema_for!(crate::command_contracts::Request)
}

/// Derselbe V2-Header für alle privaten Aktionsformen; keine zweite Feldliste.
fn binding_v2(mut schema: Schema) -> Schema {
    fn versions(value: &mut serde_json::Value) {
        match value {
            serde_json::Value::Object(object) => {
                if let Some(properties) = object
                    .get_mut("properties")
                    .and_then(serde_json::Value::as_object_mut)
                {
                    for (name, version) in [
                        ("contractVersion", crate::versions::ENGINE_BINDING_VERSION),
                        (
                            "domainSchemaVersion",
                            crate::versions::DOMAIN_SCHEMA_VERSION,
                        ),
                    ] {
                        if let Some(property) = properties
                            .get_mut(name)
                            .and_then(serde_json::Value::as_object_mut)
                        {
                            property.insert("const".into(), version.into());
                        }
                    }
                }
                object.values_mut().for_each(versions);
            }
            serde_json::Value::Array(values) => values.iter_mut().for_each(versions),
            _ => {}
        }
    }
    let mut value = schema.to_value();
    versions(&mut value);
    schema = value
        .try_into()
        .expect("Eine Schemaobjekt-Transformation bleibt ein Schema.");
    schema
}

pub fn private_v2() -> Vec<(&'static str, Schema)> {
    use crate::{
        ContractError,
        calculation_contracts::{CalculationOutcome, CalculationRequest},
        command_contracts::{CommandOutcomeV2, Request},
        reverse_contracts::ReverseRequest,
        state_contracts::{
            ProjectionOutcome, ProjectionRequest, ValidationOutcome, ValidationRequest,
        },
    };
    vec![
        (
            "private-v2-execute-request.schema.json",
            binding_v2(schemars::schema_for!(Request)),
        ),
        (
            "private-v2-command-outcome.schema.json",
            binding_v2(schemars::schema_for!(CommandOutcomeV2)),
        ),
        (
            "private-v2-calculation-request.schema.json",
            binding_v2(schemars::schema_for!(CalculationRequest)),
        ),
        (
            "private-v2-calculation-outcome.schema.json",
            binding_v2(schemars::schema_for!(CalculationOutcome)),
        ),
        (
            "private-v2-reverse-request.schema.json",
            binding_v2(schemars::schema_for!(ReverseRequest)),
        ),
        (
            "private-v2-projection-request.schema.json",
            binding_v2(schemars::schema_for!(ProjectionRequest)),
        ),
        (
            "private-v2-projection-outcome.schema.json",
            binding_v2(schemars::schema_for!(ProjectionOutcome)),
        ),
        (
            "private-v2-validation-request.schema.json",
            binding_v2(schemars::schema_for!(ValidationRequest)),
        ),
        (
            "private-v2-validation-outcome.schema.json",
            binding_v2(schemars::schema_for!(ValidationOutcome)),
        ),
        (
            "private-v2-error.schema.json",
            binding_v2(schemars::schema_for!(ContractError)),
        ),
    ]
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn optional_presence_and_required_nullable_fields_remain_distinct() {
        let schema = aggregate().to_value();
        let defs = &schema["$defs"];
        assert!(
            defs["ImportRow"]["required"]
                .as_array()
                .unwrap()
                .iter()
                .any(|f| f == "candidate")
        );
        assert!(defs["ImportRow"]["properties"]["candidate"]["$ref"].is_string());
        let account = schema["oneOf"]
            .as_array()
            .unwrap()
            .iter()
            .find(|v| v["properties"]["aggregateType"]["const"] == "account")
            .unwrap();
        assert!(account["properties"]["deletedAt"]["anyOf"].is_null());
        assert_eq!(defs["MoneyCents"]["maximum"], crate::MAX_SAFE);
        assert_eq!(account["additionalProperties"], false);
    }
    #[test]
    fn generation_is_deterministic() {
        assert_eq!(request().to_value(), request().to_value());
    }
}
