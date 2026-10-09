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
