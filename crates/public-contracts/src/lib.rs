// SPDX-License-Identifier: AGPL-3.0-or-later
//! Öffentliche Hüllen und Metadaten; keine Finanzmodelle, Schlüssel oder Fachhandler.
#![forbid(unsafe_code)]
pub mod api;
pub mod envelopes;
pub mod errors;
pub mod scalars;
#[cfg(feature = "contract-schema")]
pub mod schema;
#[cfg(feature = "native-bindings")]
uniffi::setup_scaffolding!();
#[cfg(feature = "native-bindings")]
mod native;
pub const PROTOCOL_VERSION: u32 = 1;
pub const MAX_HANDLES: usize = 500;
pub const MAX_BASE64URL_LENGTH: usize = 65_536;
pub type FormResult<T> = Result<T, &'static str>;
pub trait Validate {
    fn validate(&self) -> FormResult<()>;
}

/// Derselbe deklarierte Record erzeugt Serde, Schema und beide Sprachmodelle.
/// Serde führt anschließend auch relationale öffentliche Formprüfungen aus.
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
                crate::Validate::validate(&result).map_err(serde::de::Error::custom)?;
                Ok(result)
            }
        }
    }
}
pub(crate) use record;
