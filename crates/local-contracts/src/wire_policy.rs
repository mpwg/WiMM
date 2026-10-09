// SPDX-License-Identifier: AGPL-3.0-or-later
//! Nominale Serde-Validierung erhält die engere lokale UUID-Wirepolicy ohne Feldkopien.
use serde::{Serialize, ser::*};
#[derive(Debug)]
pub struct PolicyError;
impl std::fmt::Display for PolicyError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str("Der lokale Wirevertrag ist ungültig.")
    }
}
impl std::error::Error for PolicyError {}
impl serde::ser::Error for PolicyError {
    fn custom<T: std::fmt::Display>(_: T) -> Self {
        Self
    }
}
pub fn check<T: Serialize + ?Sized>(v: &T) -> bool {
    v.serialize(Walk).is_ok()
}
struct Walk;
struct Children;
macro_rules! scalar {($($method:ident($type:ty)),*$(,)?)=>{$(fn $method(self,_:$type)->Result<(),PolicyError>{Ok(())})*};}
impl Serializer for Walk {
    type Ok = ();
    type Error = PolicyError;
    type SerializeSeq = Children;
    type SerializeTuple = Children;
    type SerializeTupleStruct = Children;
    type SerializeTupleVariant = Children;
    type SerializeMap = Children;
    type SerializeStruct = Children;
    type SerializeStructVariant = Children;
    scalar!(
        serialize_bool(bool),
        serialize_i8(i8),
        serialize_i16(i16),
        serialize_i32(i32),
        serialize_i64(i64),
        serialize_i128(i128),
        serialize_u8(u8),
        serialize_u16(u16),
        serialize_u32(u32),
        serialize_u64(u64),
        serialize_u128(u128),
        serialize_f32(f32),
        serialize_f64(f64),
        serialize_char(char),
        serialize_str(&str),
        serialize_bytes(&[u8])
    );
    fn serialize_none(self) -> Result<(), PolicyError> {
        Ok(())
    }
    fn serialize_some<T: Serialize + ?Sized>(self, v: &T) -> Result<(), PolicyError> {
        v.serialize(self)
    }
    fn serialize_unit(self) -> Result<(), PolicyError> {
        Ok(())
    }
    fn serialize_unit_struct(self, _: &'static str) -> Result<(), PolicyError> {
        Ok(())
    }
    fn serialize_unit_variant(
        self,
        _: &'static str,
        _: u32,
        _: &'static str,
    ) -> Result<(), PolicyError> {
        Ok(())
    }
    fn serialize_newtype_struct<T: Serialize + ?Sized>(
        self,
        name: &'static str,
        v: &T,
    ) -> Result<(), PolicyError> {
        if name == "EntityId" {
            let value = serde_json::to_value(v).map_err(|_| PolicyError)?;
            if !value
                .as_str()
                .is_some_and(wimm_contract_primitives::valid_public_uuid)
            {
                return Err(PolicyError);
            }
        }
        v.serialize(self)
    }
    fn serialize_newtype_variant<T: Serialize + ?Sized>(
        self,
        _: &'static str,
        _: u32,
        _: &'static str,
        v: &T,
    ) -> Result<(), PolicyError> {
        v.serialize(self)
    }
    fn serialize_seq(self, _: Option<usize>) -> Result<Children, PolicyError> {
        Ok(Children)
    }
    fn serialize_tuple(self, _: usize) -> Result<Children, PolicyError> {
        Ok(Children)
    }
    fn serialize_tuple_struct(self, _: &'static str, _: usize) -> Result<Children, PolicyError> {
        Ok(Children)
    }
    fn serialize_tuple_variant(
        self,
        _: &'static str,
        _: u32,
        _: &'static str,
        _: usize,
    ) -> Result<Children, PolicyError> {
        Ok(Children)
    }
    fn serialize_map(self, _: Option<usize>) -> Result<Children, PolicyError> {
        Ok(Children)
    }
    fn serialize_struct(self, _: &'static str, _: usize) -> Result<Children, PolicyError> {
        Ok(Children)
    }
    fn serialize_struct_variant(
        self,
        _: &'static str,
        _: u32,
        _: &'static str,
        _: usize,
    ) -> Result<Children, PolicyError> {
        Ok(Children)
    }
}
macro_rules! sequence {
    ($trait:ident,$method:ident) => {
        impl $trait for Children {
            type Ok = ();
            type Error = PolicyError;
            fn $method<T: Serialize + ?Sized>(&mut self, v: &T) -> Result<(), PolicyError> {
                v.serialize(Walk)
            }
            fn end(self) -> Result<(), PolicyError> {
                Ok(())
            }
        }
    };
}
sequence!(SerializeSeq, serialize_element);
sequence!(SerializeTuple, serialize_element);
sequence!(SerializeTupleStruct, serialize_field);
sequence!(SerializeTupleVariant, serialize_field);
impl SerializeMap for Children {
    type Ok = ();
    type Error = PolicyError;
    fn serialize_key<T: Serialize + ?Sized>(&mut self, v: &T) -> Result<(), PolicyError> {
        v.serialize(Walk)
    }
    fn serialize_value<T: Serialize + ?Sized>(&mut self, v: &T) -> Result<(), PolicyError> {
        v.serialize(Walk)
    }
    fn end(self) -> Result<(), PolicyError> {
        Ok(())
    }
}
macro_rules! structure {
    ($trait:ident) => {
        impl $trait for Children {
            type Ok = ();
            type Error = PolicyError;
            fn serialize_field<T: Serialize + ?Sized>(
                &mut self,
                _: &'static str,
                v: &T,
            ) -> Result<(), PolicyError> {
                v.serialize(Walk)
            }
            fn end(self) -> Result<(), PolicyError> {
                Ok(())
            }
        }
    };
}
structure!(SerializeStruct);
structure!(SerializeStructVariant);
