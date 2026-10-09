// SPDX-License-Identifier: AGPL-3.0-or-later
//! Versionsdimensionen bleiben unabhängig; V1-Serdeformen bleiben u32.
use serde::{Deserialize, Serialize};
macro_rules! version {
    ($name:ident) => {
        #[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
        #[serde(transparent)]
        #[cfg_attr(feature = "wasm-bindings", derive(tsify::Tsify))]
        pub struct $name(u32);
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
