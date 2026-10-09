// SPDX-License-Identifier: AGPL-3.0-or-later
//! Neutrale UUID-/JSON-Ganzzahlgrenzen ohne private Fachmodelle.
#![forbid(unsafe_code)]
use serde::{Deserializer, de};
use uuid::Uuid;
pub const UUID_PATTERN: &str = "^(?:00000000-0000-0000-0000-000000000000|[fF]{8}-[fF]{4}-[fF]{4}-[fF]{4}-[fF]{12}|[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89aAbB][0-9a-fA-F]{3}-[0-9a-fA-F]{12})$";
pub const MAX_SAFE: i64 = 9_007_199_254_740_991;
pub fn valid_uuid(value: &str) -> bool {
    valid_uuid_policy(value, true)
}
/// Bestehende öffentliche Zod-Form: die Max-UUID ist ausschließlich kleingeschrieben.
pub fn valid_public_uuid(value: &str) -> bool {
    valid_uuid_policy(value, false)
}
pub fn public_uuid_pattern() -> String {
    UUID_PATTERN.replace(
        "[fF]{8}-[fF]{4}-[fF]{4}-[fF]{4}-[fF]{12}",
        "ffffffff-ffff-ffff-ffff-ffffffffffff",
    )
}
fn valid_uuid_policy(value: &str, allow_uppercase_max: bool) -> bool {
    let b = value.as_bytes();
    b.len() == 36
        && b.iter().enumerate().all(|(n, c)| {
            if [8, 13, 18, 23].contains(&n) {
                *c == b'-'
            } else {
                c.is_ascii_hexdigit()
            }
        })
        && Uuid::parse_str(value).is_ok_and(|id| {
            id.is_nil()
                || (id == Uuid::max()
                    && (allow_uppercase_max || value == "ffffffff-ffff-ffff-ffff-ffffffffffff"))
                || (id.get_variant() == uuid::Variant::RFC4122
                    && (1..=8).contains(&id.get_version_num()))
        })
}
pub struct IntegerVisitor;
impl<'de> de::Visitor<'de> for IntegerVisitor {
    type Value = i64;
    fn expecting(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        formatter.write_str("eine sichere JSON-Ganzzahl")
    }
    fn visit_i64<E: de::Error>(self, value: i64) -> Result<i64, E> {
        if (-MAX_SAFE..=MAX_SAFE).contains(&value) {
            Ok(value)
        } else {
            Err(E::custom(
                "Die JSON-Ganzzahl liegt außerhalb des sicheren Bereichs.",
            ))
        }
    }
    fn visit_u64<E: de::Error>(self, value: u64) -> Result<i64, E> {
        if value <= MAX_SAFE as u64 {
            Ok(value as i64)
        } else {
            Err(E::custom(
                "Die JSON-Ganzzahl liegt außerhalb des sicheren Bereichs.",
            ))
        }
    }
    fn visit_f64<E: de::Error>(self, value: f64) -> Result<i64, E> {
        // V1 akzeptiert äquivalente JSON-Zahlformen wie 1.0/1e3. Konvertierung
        // nur bei exakt ganzzahligem sicheren Wert, niemals Geldarithmetik.
        if value.is_finite() && value.fract() == 0.0 && value.abs() <= MAX_SAFE as f64 {
            Ok(value as i64)
        } else {
            Err(E::custom("Der JSON-Wert ist keine sichere Ganzzahl."))
        }
    }
}

pub fn integer<'de, D: Deserializer<'de>>(d: D) -> Result<i64, D::Error> {
    d.deserialize_any(IntegerVisitor)
}

/// Derselbe deklarierte Record erzeugt Serde, Schema und beide Sprachmodelle.
/// Serde führt anschließend auch relationale öffentliche Formprüfungen aus.
#[macro_export]
macro_rules! record {
    ($name:ident { $($(#[$attr:meta])* $field:ident: $ty:ty),* $(,)? }) => {
        #[derive(Debug, Clone, serde::Serialize)]
        #[serde(rename_all = "camelCase", deny_unknown_fields)]
        #[cfg_attr(feature = "contract-schema", derive(schemars::JsonSchema))]
        #[cfg_attr(feature = "native-bindings", derive(uniffi::Record))]
        #[cfg_attr(feature = "wasm-bindings", derive(tsify::Tsify))]
        pub struct $name { $($(#[$attr])* pub $field: $ty),* }
        impl<'de> serde::Deserialize<'de> for $name {
            fn deserialize<D:serde::Deserializer<'de>>(d:D)->Result<Self,D::Error> {
                #[derive(serde::Deserialize)]
                #[cfg_attr(feature = "contract-schema", derive(schemars::JsonSchema))]
                #[serde(rename_all = "camelCase", deny_unknown_fields)]
                struct Wire { $($(#[$attr])* $field: $ty),* }
                let wire = Wire::deserialize(d)?;
                let result = Self { $($field:wire.$field),* };
                $crate::Validate::validate(&result).map_err(serde::de::Error::custom)?;
                Ok(result)
            }
        }
    }
}

pub trait Validate {
    fn validate(&self) -> Result<(), &'static str>;
}

#[cfg(feature = "wasm-data")]
pub mod wasm_data;
