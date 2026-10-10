// SPDX-License-Identifier: AGPL-3.0-or-later
//! Ausschließlich öffentliche Signaturprüfung; keine Client-/Tresorabhängigkeit.
#![forbid(unsafe_code)]
/// Ungültige Formen/Signaturen geben false zurück, ohne Originaldiagnosen.
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
