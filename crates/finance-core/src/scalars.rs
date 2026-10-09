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

#[cfg(test)]
mod tests {
    use super::*;
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
