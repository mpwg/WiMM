// SPDX-License-Identifier: AGPL-3.0-or-later
//! Ausschließlich öffentliche Signaturprüfung; keine Client-/Tresorabhängigkeit.
#![forbid(unsafe_code)]
/// Ungültige Formen/Signaturen geben false zurück, ohne Originaldiagnosen.
#[cfg(not(target_arch = "wasm32"))]
pub fn verify_ed25519(message: &[u8], signature: &[u8], public_key: &[u8]) -> bool {
    if libsodium_rs::ensure_init().is_err() {
        return false;
    }
    let Ok(signature): Result<&[u8; 64], _> = signature.try_into() else {
        return false;
    };
    let Ok(key) = libsodium_rs::crypto_sign::PublicKey::from_bytes(public_key) else {
        return false;
    };
    libsodium_rs::crypto_sign::verify_detached(signature, message, &key)
}
#[cfg(target_arch = "wasm32")]
#[wasm_bindgen::prelude::wasm_bindgen(module = "/js/verify.js")]
extern "C" {
    #[wasm_bindgen::prelude::wasm_bindgen(catch)]
    fn verify(
        message: &[u8],
        signature: &[u8],
        public_key: &[u8],
    ) -> Result<bool, wasm_bindgen::JsValue>;
}
#[cfg(target_arch = "wasm32")]
pub fn verify_ed25519(message: &[u8], signature: &[u8], public_key: &[u8]) -> bool {
    signature.len() == 64
        && public_key.len() == 32
        && verify(message, signature, public_key).unwrap_or(false)
}
pub fn canonical_json_bytes(value: &serde_json::Value) -> Result<Vec<u8>, serde_json::Error> {
    serde_json_canonicalizer::to_vec(value)
}
pub enum Context {
    Certificate,
    Grant,
    Operation,
    Roster,
    Snapshot,
}
impl Context {
    pub const fn as_bytes(&self) -> &'static [u8] {
        match self {
            Self::Certificate => b"wimm/v1/certificate",
            Self::Grant => b"wimm/v1/grant",
            Self::Operation => b"wimm/v1/operation",
            Self::Roster => b"wimm/v1/roster",
            Self::Snapshot => b"wimm/v1/snapshot",
        }
    }
}
#[cfg(test)]
mod tests {
    use super::*;
    fn hex(text: &str) -> Vec<u8> {
        text.as_bytes()
            .as_chunks::<2>()
            .0
            .iter()
            .map(|b| u8::from_str_radix(std::str::from_utf8(b).unwrap(), 16).unwrap())
            .collect()
    }
    #[test]
    fn existing_c_signature_vector_and_tampering_are_checked_without_private_keys() {
        let pk = hex("03a107bff3ce10be1d70dd18e74bc09967e4d6309ba50d5f1ddc8664125531b8");
        let sig = hex(
            "2910c7c85ff35cdf16e16d9d6787cd999a33e20cac7ba336f3198dee292fedd35077993e21d2a82338e1bf5354fe5e77c19645da394cf42c11e1bdfd5ea9ac06",
        );
        let msg = b"WIMM fixture signature v1";
        assert!(verify_ed25519(msg, &sig, &pk));
        assert!(!verify_ed25519(b"anderer Kontext", &sig, &pk));
        let mut changed = sig.clone();
        changed[0] ^= 1;
        assert!(!verify_ed25519(msg, &changed, &pk));
        assert!(!verify_ed25519(msg, &sig, &pk[..31]));
        assert!(!verify_ed25519(msg, &sig[..63], &pk));
    }
}

#[cfg(test)]
mod canonical_tests {
    #[test]
    fn canonical_unicode_numeric_and_context_values_match_existing_contract() {
        let value = serde_json::json!({"€":0.1,"𐐀":1e21,"\u{e000}":1,"inner":[true,null,"🏠",9007199254740991u64]});
        let text = String::from_utf8(super::canonical_json_bytes(&value).unwrap()).unwrap();
        assert_eq!(
            text,
            "{\"inner\":[true,null,\"🏠\",9007199254740991],\"€\":0.1,\"𐐀\":1e+21,\"\u{e000}\":1}"
        );
        assert_eq!(
            super::Context::Certificate.as_bytes(),
            b"wimm/v1/certificate"
        );
        assert_eq!(super::Context::Grant.as_bytes(), b"wimm/v1/grant");
        assert_eq!(super::Context::Operation.as_bytes(), b"wimm/v1/operation");
        assert_eq!(super::Context::Roster.as_bytes(), b"wimm/v1/roster");
        assert_eq!(super::Context::Snapshot.as_bytes(), b"wimm/v1/snapshot");
    }
}
