// SPDX-License-Identifier: AGPL-3.0-or-later
//! Öffentliche geschützte Werte; dieselben neutralen UUID-/Zahlgrenzen wie privat.
use crate::FormResult;
use serde::{Deserialize, Serialize};
macro_rules! string {
    ($name:ident, $check:expr) => {
        #[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
        #[serde(try_from = "String")]
        #[cfg_attr(feature = "wasm-bindings", derive(tsify::Tsify))]
        pub struct $name(String);
        impl $name {
            pub fn new(value: String) -> FormResult<Self> {
                if ($check)(&value) {
                    Ok(Self(value))
                } else {
                    Err("Der öffentliche Vertragswert ist ungültig.")
                }
            }
            pub fn as_str(&self) -> &str {
                &self.0
            }
        }
        impl TryFrom<String> for $name {
            type Error = &'static str;
            fn try_from(v: String) -> Result<Self, Self::Error> {
                Self::new(v)
            }
        }
    };
}
string!(PublicId, |v: &str| {
    wimm_contract_primitives::valid_public_uuid(v)
});
string!(Base64Url, |v: &str| !v.is_empty()
    && v.len() <= crate::MAX_BASE64URL_LENGTH
    && v.bytes().all(|b| b.is_ascii_alphanumeric()
        || b == b'_'
        || b == b'-'));
string!(NonEmptyString, |v: &str| !v.is_empty());
macro_rules! revision {
    ($name:ident,$min:expr) => {
        #[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
        #[serde(transparent)]
        #[cfg_attr(feature = "wasm-bindings", derive(tsify::Tsify))]
        pub struct $name(i64);
        impl $name {
            pub fn new(v: i64) -> FormResult<Self> {
                if ($min..=wimm_contract_primitives::MAX_SAFE).contains(&v) {
                    Ok(Self(v))
                } else {
                    Err("Die öffentliche Revision ist ungültig.")
                }
            }
            pub fn value(self) -> i64 {
                self.0
            }
        }
        impl<'de> Deserialize<'de> for $name {
            fn deserialize<D: serde::Deserializer<'de>>(d: D) -> Result<Self, D::Error> {
                Self::new(wimm_contract_primitives::integer(d)?).map_err(serde::de::Error::custom)
            }
        }
    };
}
revision!(PublicRevision, 0);
revision!(PositiveRevision, 1);

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(transparent)]
#[cfg_attr(feature = "wasm-bindings", derive(tsify::Tsify))]
pub struct ProtocolVersion(u32);
impl ProtocolVersion {
    pub fn new(v: u32) -> FormResult<Self> {
        if v == crate::PROTOCOL_VERSION {
            Ok(Self(v))
        } else {
            Err("Die Protokollversion wird nicht unterstützt.")
        }
    }
    pub fn value(self) -> u32 {
        self.0
    }
}
impl<'de> Deserialize<'de> for ProtocolVersion {
    fn deserialize<D: serde::Deserializer<'de>>(d: D) -> Result<Self, D::Error> {
        let v = wimm_contract_primitives::integer(d)?;
        Self::new(u32::try_from(v).map_err(serde::de::Error::custom)?)
            .map_err(serde::de::Error::custom)
    }
}
pub fn present<'de, T: Deserialize<'de>, D: serde::Deserializer<'de>>(
    d: D,
) -> Result<Option<T>, D::Error> {
    T::deserialize(d).map(Some)
}
