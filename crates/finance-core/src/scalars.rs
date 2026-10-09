// SPDX-License-Identifier: AGPL-3.0-or-later
//! AR01: geschützte skalare Fachtypen. JSON-Grenzkonvertierung ist keine
//! Gleitkomma-Geldberechnung; Fachoperationen verwenden ausschließlich Integer.
use crate::{CoreResult, MAX_SAFE};
use serde::{Deserialize, Deserializer, Serialize, de};

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Serialize)]
#[serde(transparent)]
pub struct MoneyCents(i64);
impl MoneyCents {
    pub fn new(value: i64) -> CoreResult<Self> {
        if (-MAX_SAFE..=MAX_SAFE).contains(&value) {
            Ok(Self(value))
        } else {
            Err((
                "INVALID_SAFE_INTEGER",
                "Der Geldbetrag muss ein sicherer ganzzahliger Centbetrag sein.",
            ))
        }
    }
    pub fn cents(self) -> i64 {
        self.0
    }
    pub fn checked_add(self, other: Self) -> CoreResult<Self> {
        let result = self.0 as i128 + other.0 as i128;
        if !(-(MAX_SAFE as i128)..=MAX_SAFE as i128).contains(&result) {
            return Err((
                "MONEY_OVERFLOW",
                "Die Geldsumme überschreitet den sicheren Centbereich.",
            ));
        }
        Ok(Self(result as i64))
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Serialize)]
#[serde(transparent)]
pub struct Revision(i64);
impl Revision {
    pub fn new(value: i64) -> CoreResult<Self> {
        if (0..=MAX_SAFE).contains(&value) {
            Ok(Self(value))
        } else {
            Err((
                "INVALID_SAFE_INTEGER",
                "Die Revision muss eine nichtnegative sichere Ganzzahl sein.",
            ))
        }
    }
    pub fn value(self) -> i64 {
        self.0
    }
    pub fn next(self) -> CoreResult<Self> {
        Self::new(self.0.checked_add(1).ok_or((
            "INVALID_SAFE_INTEGER",
            "Die Revision überschreitet den sicheren Ganzzahlbereich.",
        ))?)
    }
}

struct IntegerVisitor;
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
impl<'de> Deserialize<'de> for MoneyCents {
    fn deserialize<D: Deserializer<'de>>(deserializer: D) -> Result<Self, D::Error> {
        Self::new(deserializer.deserialize_any(IntegerVisitor)?)
            .map_err(|(_, message)| de::Error::custom(message))
    }
}
impl<'de> Deserialize<'de> for Revision {
    fn deserialize<D: Deserializer<'de>>(deserializer: D) -> Result<Self, D::Error> {
        Self::new(deserializer.deserialize_any(IntegerVisitor)?)
            .map_err(|(_, message)| de::Error::custom(message))
    }
}

// Strings werden geprüft, aber weder normalisiert noch umgeschrieben: UUID-
// Schreibweise und Zeitstempelpräzision gehören zum bestehenden V1-Vertrag.
macro_rules! checked_string {
    ($name:ident, $check:expr) => {
        #[derive(Debug, Clone, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize)]
        #[serde(try_from = "String")]
        pub struct $name(String);
        impl $name {
            pub fn new(value: String) -> CoreResult<Self> {
                if ($check)(&value) {
                    Ok(Self(value))
                } else {
                    Err(crate::aggregate_schema::INVALID)
                }
            }
            pub fn as_str(&self) -> &str {
                &self.0
            }
        }
        impl TryFrom<String> for $name {
            type Error = &'static str;
            fn try_from(value: String) -> Result<Self, Self::Error> {
                Self::new(value).map_err(|(_, message)| message)
            }
        }
    };
}
checked_string!(EntityId, crate::valid_id);
checked_string!(FinanceDate, |s: &str| crate::calendar::parse_finance_date(
    s
)
.is_ok());
checked_string!(UtcTimestamp, crate::aggregate_schema::timestamp);
checked_string!(NonEmptyText, |s: &str| !s
    .trim_matches(crate::aggregate_schema::js_space)
    .is_empty());
checked_string!(FileHash, |s: &str| s.len() == 64
    && s.bytes()
        .all(|b| b.is_ascii_digit() || (b'a'..=b'f').contains(&b)));

macro_rules! checked_ordinal {
    ($name:ident, $minimum:expr) => {
        #[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Serialize)]
        #[serde(transparent)]
        pub struct $name(i64);
        impl $name {
            pub fn new(value: i64) -> CoreResult<Self> {
                if ($minimum..=MAX_SAFE).contains(&value) {
                    Ok(Self(value))
                } else {
                    Err(crate::aggregate_schema::INVALID)
                }
            }
            pub fn value(self) -> i64 {
                self.0
            }
        }
        impl<'de> Deserialize<'de> for $name {
            fn deserialize<D: Deserializer<'de>>(d: D) -> Result<Self, D::Error> {
                Self::new(d.deserialize_any(IntegerVisitor)?).map_err(|(_, m)| de::Error::custom(m))
            }
        }
    };
}
checked_ordinal!(Ordinal, 0);
checked_ordinal!(PositiveOrdinal, 1);
checked_ordinal!(StoredRevision, 1);

/// Formgrenzen werden auch bei nativer Konstruktion erzwungen.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(transparent)]
pub struct BoundedVec<T, const MIN: usize, const MAX: usize>(Vec<T>);
impl<T, const MIN: usize, const MAX: usize> BoundedVec<T, MIN, MAX> {
    pub fn new(values: Vec<T>) -> CoreResult<Self> {
        if (MIN..=MAX).contains(&values.len()) {
            Ok(Self(values))
        } else {
            Err(crate::aggregate_schema::INVALID)
        }
    }
    pub fn as_slice(&self) -> &[T] {
        &self.0
    }
}
impl<'de, T: Deserialize<'de>, const MIN: usize, const MAX: usize> Deserialize<'de>
    for BoundedVec<T, MIN, MAX>
{
    fn deserialize<D: Deserializer<'de>>(d: D) -> Result<Self, D::Error> {
        Self::new(Vec::<T>::deserialize(d)?).map_err(|(_, m)| de::Error::custom(m))
    }
}
pub type NonEmptyVec<T> = BoundedVec<T, 1, { usize::MAX }>;

/// Optional heißt fehlend. Ein vorhandenes null ist für V1 kein gültiger Wert.
pub(crate) fn present<'de, T: Deserialize<'de>, D: Deserializer<'de>>(
    d: D,
) -> Result<Option<T>, D::Error> {
    T::deserialize(d).map(Some)
}
/// Nur Importzeilen besitzen ein erforderliches, ausdrücklich nullable Feld.
pub(crate) fn nullable<'de, T: Deserialize<'de>, D: Deserializer<'de>>(
    d: D,
) -> Result<Option<T>, D::Error> {
    Option::<T>::deserialize(d)
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn ids_dates_timestamps_and_text_keep_v1_boundaries_and_original_spelling() {
        for id in [
            "00000000-0000-0000-0000-000000000000",
            "ffffffff-ffff-ffff-ffff-ffffffffffff",
            "ABCDEF00-0000-8000-8000-000000000001",
        ] {
            let typed = EntityId::new(id.to_owned()).unwrap();
            assert_eq!(typed.as_str(), id);
            assert_eq!(serde_json::to_value(typed).unwrap(), serde_json::json!(id));
        }
        for id in [
            "abcdef00-0000-9000-8000-000000000001",
            "abcdef00-0000-4000-0000-000000000001",
            "abcdef00000040008000000000000001",
        ] {
            assert!(EntityId::new(id.to_owned()).is_err());
        }
        for date in ["0000-02-29", "2000-02-29", "9999-12-31"] {
            assert!(FinanceDate::new(date.to_owned()).is_ok());
        }
        for date in ["1900-02-29", "2028-04-31", "２０２８-02-29"] {
            assert!(FinanceDate::new(date.to_owned()).is_err());
        }
        for time in ["2026-10-09T00:00:00Z", "2026-10-09T23:59:59.123456Z"] {
            assert_eq!(UtcTimestamp::new(time.to_owned()).unwrap().as_str(), time);
        }
        for time in [
            "2026-10-09T24:00:00Z",
            "2026-10-09T00:00Z",
            "2026-10-09T00:00:00+02:00",
            "2026-10-09T00:00:00.Z",
        ] {
            assert!(UtcTimestamp::new(time.to_owned()).is_err());
        }
        assert!(NonEmptyText::new("\u{feff}\u{00a0}\t".to_owned()).is_err());
        assert_eq!(
            NonEmptyText::new("  Konto  ".to_owned()).unwrap().as_str(),
            "  Konto  "
        );
        assert!(FileHash::new("f".repeat(64)).is_ok());
        assert!(FileHash::new("F".repeat(64)).is_err());
        assert!(Ordinal::new(0).is_ok());
        assert!(PositiveOrdinal::new(0).is_err());
        assert!(PositiveOrdinal::new(MAX_SAFE).is_ok());
        assert!(PositiveOrdinal::new(MAX_SAFE + 1).is_err());
    }
    #[test]
    fn money_boundaries_and_intermediate_overflow_remain_exact() {
        for value in [-MAX_SAFE, -1, 0, 1, MAX_SAFE] {
            assert_eq!(MoneyCents::new(value).unwrap().cents(), value);
        }
        assert!(MoneyCents::new(MAX_SAFE + 1).is_err());
        assert!(MoneyCents::new(-MAX_SAFE - 1).is_err());
        assert_eq!(
            MoneyCents::new(-100)
                .unwrap()
                .checked_add(MoneyCents::new(75).unwrap())
                .unwrap()
                .cents(),
            -25
        );
        assert_eq!(
            MoneyCents::new(MAX_SAFE)
                .unwrap()
                .checked_add(MoneyCents::new(1).unwrap())
                .unwrap_err()
                .0,
            "MONEY_OVERFLOW"
        );
    }
    #[test]
    fn json_number_forms_preserve_v1_without_string_or_null_coercion() {
        for (text, expected) in [
            ("1", 1),
            ("1.0", 1),
            ("1e3", 1000),
            ("-9007199254740991", -MAX_SAFE),
        ] {
            let value: MoneyCents = serde_json::from_str(text).unwrap();
            assert_eq!(value.cents(), expected);
            assert_eq!(serde_json::to_string(&value).unwrap(), expected.to_string());
        }
        for text in [
            "null",
            "\"100\"",
            "1.1",
            "true",
            "9007199254740992",
            "-9007199254740992",
        ] {
            assert!(serde_json::from_str::<MoneyCents>(text).is_err(), "{text}");
        }
    }
    #[test]
    fn revisions_allow_creation_expectation_but_reject_negative_and_overflow() {
        assert_eq!(Revision::new(0).unwrap().next().unwrap().value(), 1);
        assert!(Revision::new(-1).is_err());
        assert!(Revision::new(MAX_SAFE).unwrap().next().is_err());
        assert!(serde_json::from_str::<Revision>("-1.0").is_err());
        assert!(serde_json::from_str::<Revision>("null").is_err());
        assert_eq!(serde_json::from_str::<Revision>("1.0").unwrap().value(), 1);
    }
}

#[cfg(feature = "contract-schema")]
mod schema_support {
    use super::*;
    use schemars::{JsonSchema, Schema, SchemaGenerator};
    use std::borrow::Cow;
    macro_rules! integer_schema {
        ($name:ident,$min:expr) => {
            impl JsonSchema for $name {
                fn schema_name() -> Cow<'static, str> {
                    stringify!($name).into()
                }
                fn json_schema(_: &mut SchemaGenerator) -> Schema {
                    crate::schema::integer($min)
                }
            }
        };
    }
    integer_schema!(MoneyCents, -MAX_SAFE);
    integer_schema!(Revision, 0);
    integer_schema!(Ordinal, 0);
    integer_schema!(PositiveOrdinal, 1);
    integer_schema!(StoredRevision, 1);
    macro_rules! string_schema {
        ($name:ident,$schema:expr) => {
            impl JsonSchema for $name {
                fn schema_name() -> Cow<'static, str> {
                    stringify!($name).into()
                }
                fn json_schema(_: &mut SchemaGenerator) -> Schema {
                    $schema
                }
            }
        };
    }
    string_schema!(
        EntityId,
        schemars::json_schema!({"type":"string","minLength":36,"maxLength":36,"pattern":"^(?:00000000-0000-0000-0000-000000000000|[fF]{8}-[fF]{4}-[fF]{4}-[fF]{4}-[fF]{12}|[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89aAbB][0-9a-fA-F]{3}-[0-9a-fA-F]{12})$"})
    );
    string_schema!(
        FinanceDate,
        schemars::json_schema!({"type":"string","format":"date","minLength":10,"maxLength":10,"pattern":"^[0-9]{4}-[0-9]{2}-[0-9]{2}$"})
    );
    string_schema!(
        UtcTimestamp,
        schemars::json_schema!({"type":"string","format":"date-time","pattern":"^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(?:\\.[0-9]+)?Z$"})
    );
    string_schema!(NonEmptyText, crate::schema::non_empty_text());
    string_schema!(
        FileHash,
        schemars::json_schema!({"type":"string","minLength":64,"maxLength":64,"pattern":"^[0-9a-f]{64}$"})
    );
    impl<T: JsonSchema, const MIN: usize, const MAX: usize> JsonSchema for BoundedVec<T, MIN, MAX> {
        fn schema_name() -> Cow<'static, str> {
            format!(
                "BoundedVec_{}_{}_{}",
                T::schema_name(),
                MIN,
                if MAX == usize::MAX {
                    "unbounded".to_owned()
                } else {
                    MAX.to_string()
                }
            )
            .into()
        }
        fn json_schema(generator: &mut SchemaGenerator) -> Schema {
            let mut schema = schemars::json_schema!({"type":"array","items":generator.subschema_for::<T>(),"minItems":MIN});
            if MAX < usize::MAX {
                schema.insert("maxItems".to_owned(), serde_json::json!(MAX));
            }
            schema
        }
    }
}
