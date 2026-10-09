// SPDX-License-Identifier: AGPL-3.0-or-later
//! Versionsdimensionen bleiben unabhängig; V1-Serdeformen bleiben u32.
use serde::{Deserialize, Serialize};
pub const ENGINE_BINDING_VERSION: u32 = 2;
pub const DOMAIN_SCHEMA_VERSION: u32 = 1;
macro_rules! version {
    ($name:ident) => {
        #[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
        #[serde(transparent)]
        #[cfg_attr(feature = "wasm-bindings", derive(tsify::Tsify))]
        pub struct $name(u32);
        impl<'de> Deserialize<'de> for $name {
            fn deserialize<D: serde::Deserializer<'de>>(d: D) -> Result<Self, D::Error> {
                // Versionszahlen besitzen dieselbe JSON-Ganzzahlsemantik wie
                // übrige sichere Skalare: 2, 2.0 und 2e0 sind äquivalent.
                let value = crate::scalars::Revision::deserialize(d)?.value();
                u32::try_from(value)
                    .map(Self)
                    .map_err(serde::de::Error::custom)
            }
        }
        impl $name {
            pub const fn value(self) -> u32 {
                self.0
            }
        }
        impl From<u32> for $name {
            fn from(value: u32) -> Self {
                Self(value)
            }
        }
        impl PartialEq<u32> for $name {
            fn eq(&self, other: &u32) -> bool {
                self.0 == *other
            }
        }
    };
}
version!(EngineBindingVersion);
version!(DomainSchemaVersion);
