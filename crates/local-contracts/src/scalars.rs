// SPDX-License-Identifier: AGPL-3.0-or-later
//! Lokale Brands über denselben neutralen Zahl-/öffentlichen Textprüfungen.
use serde::{Deserialize, Serialize};
macro_rules! text {
    ($name:ident,$inner:ty) => {
        #[derive(Debug, Clone, Serialize)]
        #[serde(transparent)]
        #[cfg_attr(feature = "contract-schema", derive(schemars::JsonSchema))]
        #[cfg_attr(feature = "wasm-bindings", derive(tsify::Tsify))]
        pub struct $name($inner);
        impl $name {
            pub fn new(v: String) -> Result<Self, &'static str> {
                <$inner>::new(v).map(Self)
            }
            pub fn as_str(&self) -> &str {
                self.0.as_str()
            }
        }
        impl<'de> Deserialize<'de> for $name {
            fn deserialize<D: serde::Deserializer<'de>>(d: D) -> Result<Self, D::Error> {
                Self::new(String::deserialize(d)?).map_err(serde::de::Error::custom)
            }
        }
    };
}
text!(LocalId, wimm_public_contracts::scalars::PublicId);
text!(LocalHash, wimm_public_contracts::scalars::Base64Url);
macro_rules! integer {
    ($name:ident,$min:expr) => {
        #[derive(Debug,Clone,Copy,PartialEq,Eq,Serialize)]
        #[serde(transparent)]
        #[cfg_attr(feature="wasm-bindings",derive(tsify::Tsify))]
        pub struct $name(i64);
        impl $name {pub fn new(v:i64)->Result<Self,&'static str>{if ($min..=wimm_contract_primitives::MAX_SAFE).contains(&v){Ok(Self(v))}else{Err("Die lokale Ganzzahl liegt außerhalb ihrer sicheren Formgrenze.")}} pub fn value(self)->i64{self.0}}
        impl<'de> Deserialize<'de> for $name {fn deserialize<D:serde::Deserializer<'de>>(d:D)->Result<Self,D::Error>{Self::new(wimm_contract_primitives::integer(d)?).map_err(serde::de::Error::custom)}}
        #[cfg(feature="contract-schema")]
        impl schemars::JsonSchema for $name {fn schema_name()->std::borrow::Cow<'static,str>{stringify!($name).into()} fn json_schema(_: &mut schemars::SchemaGenerator)->schemars::Schema{schemars::json_schema!({"type":"integer","minimum":$min,"maximum":wimm_contract_primitives::MAX_SAFE})}}
    }
}
integer!(LocalRevision, 0);
integer!(LocalPositive, 1);
macro_rules! flag {
    ($name:ident,$expected:expr)=>{
        #[derive(Debug,Clone,Copy,Serialize)]
        #[serde(transparent)]
        #[cfg_attr(feature="wasm-bindings",derive(tsify::Tsify))]
        pub struct $name(bool);
        impl $name {pub fn new(v:bool)->Result<Self,&'static str>{if v==$expected{Ok(Self(v))}else{Err("Der Persistenzstatus widerspricht seiner Unterstützungsmarkierung.")}}pub fn value(self)->bool{self.0}}
        impl<'de> Deserialize<'de> for $name{fn deserialize<D:serde::Deserializer<'de>>(d:D)->Result<Self,D::Error>{Self::new(bool::deserialize(d)?).map_err(serde::de::Error::custom)}}
        #[cfg(feature="contract-schema")]
        impl schemars::JsonSchema for $name {fn schema_name()->std::borrow::Cow<'static,str>{stringify!($name).into()}fn json_schema(_: &mut schemars::SchemaGenerator)->schemars::Schema{schemars::json_schema!({"type":"boolean","const":$expected})}}
    }
}
flag!(SupportedFlag, true);
flag!(UnsupportedFlag, false);
