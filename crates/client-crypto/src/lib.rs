// SPDX-License-Identifier: AGPL-3.0-or-later
//! Sichere libsodium-Clientgrenze; keine Fach-/Speicher-/HTTP-Abhängigkeit.
#![forbid(unsafe_code)]
use zeroize::{Zeroize, Zeroizing};
#[cfg(not(target_arch = "wasm32"))]
mod native;
#[cfg(target_arch = "wasm32")]
mod wasm;
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum CryptoError {
    InvalidInput,
    AuthenticationFailed,
    Unavailable,
    Locked,
}
impl std::fmt::Display for CryptoError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str(match self {
            Self::InvalidInput => "Ungültige Kryptoeingabe.",
            Self::AuthenticationFailed => {
                "Authentifizierung der verschlüsselten Daten fehlgeschlagen."
            }
            Self::Unavailable => "Die Kryptografielaufzeit ist nicht verfügbar.",
            Self::Locked => "Die Kryptografiesitzung ist gesperrt.",
        })
    }
}
impl std::error::Error for CryptoError {}
pub struct SecretKey {
    bytes: Zeroizing<Vec<u8>>,
    locked: bool,
}
impl SecretKey {
    pub fn generate() -> Result<Self, CryptoError> {
        let bytes = Zeroizing::new(random_bytes(32)?);
        Self::from_bytes(&bytes)
    }
    pub fn from_bytes(bytes: &[u8]) -> Result<Self, CryptoError> {
        if bytes.len() != 32 {
            return Err(CryptoError::InvalidInput);
        }
        Ok(Self {
            bytes: Zeroizing::new(bytes.to_vec()),
            locked: false,
        })
    }
    pub fn lock(&mut self) {
        self.bytes.as_mut_slice().zeroize();
        self.locked = true;
    }
    fn expose(&self) -> Result<&[u8], CryptoError> {
        if self.locked {
            Err(CryptoError::Locked)
        } else {
            Ok(&self.bytes)
        }
    }
}
impl std::fmt::Debug for SecretKey {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str("SecretKey([vertraulich])")
    }
}
pub fn initialize() -> Result<(), CryptoError> {
    #[cfg(not(target_arch = "wasm32"))]
    {
        native::initialize()
    }
    #[cfg(target_arch = "wasm32")]
    {
        wasm::initialize()
    }
}
/// Deterministische Nonce nur für Wiederverwendung bereits fixierter Hüllen/Testvektoren.
/// Neue Hüllen müssen eine kryptografisch zufällige Nonce verwenden.
fn encrypt_with_nonce(
    key: &SecretKey,
    nonce: &[u8],
    aad: &[u8],
    plaintext: &[u8],
) -> Result<Vec<u8>, CryptoError> {
    let key = key.expose()?;
    if nonce.len() != 24 {
        return Err(CryptoError::InvalidInput);
    }
    #[cfg(not(target_arch = "wasm32"))]
    {
        native::encrypt(key, nonce, aad, plaintext)
    }
    #[cfg(target_arch = "wasm32")]
    {
        wasm::encrypt_bytes(key, nonce, aad, plaintext)
    }
}
pub fn decrypt(
    key: &SecretKey,
    nonce: &[u8],
    aad: &[u8],
    ciphertext: &[u8],
) -> Result<Zeroizing<Vec<u8>>, CryptoError> {
    let key = key.expose()?;
    if nonce.len() != 24 || ciphertext.len() < 16 {
        return Err(CryptoError::InvalidInput);
    }
    #[cfg(not(target_arch = "wasm32"))]
    let result = native::decrypt(key, nonce, aad, ciphertext);
    #[cfg(target_arch = "wasm32")]
    let result = wasm::decrypt_bytes(key, nonce, aad, ciphertext);
    result.map(Zeroizing::new)
}
pub struct Ciphertext {
    pub nonce: Vec<u8>,
    pub ciphertext: Vec<u8>,
}
fn random_bytes(size: usize) -> Result<Vec<u8>, CryptoError> {
    #[cfg(not(target_arch = "wasm32"))]
    {
        native::random_bytes(size)
    }
    #[cfg(target_arch = "wasm32")]
    {
        wasm::random_bytes(size)
    }
}
pub fn encrypt(key: &SecretKey, aad: &[u8], plaintext: &[u8]) -> Result<Ciphertext, CryptoError> {
    key.expose()?;
    let nonce = random_bytes(24)?;
    let ciphertext = encrypt_with_nonce(key, &nonce, aad, plaintext)?;
    Ok(Ciphertext { nonce, ciphertext })
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
    fn fixed_c_vector_and_tampering_match_existing_wasm() {
        initialize().unwrap();
        let key = SecretKey::from_bytes(&(0u8..32).collect::<Vec<_>>()).unwrap();
        let nonce = (0u8..24).collect::<Vec<_>>();
        let aad = b"wimm/v1/operation";
        let clear = b"WIMM fixture v1";
        let expected = hex("c98b4232b0b4e4d6473154abeb249953c99a6f07b2319f879e4e4fe809b8eb");
        assert_eq!(
            encrypt_with_nonce(&key, &nonce, aad, clear).unwrap(),
            expected
        );
        assert_eq!(&*decrypt(&key, &nonce, aad, &expected).unwrap(), clear);
        let mut changed = expected.clone();
        changed[0] ^= 1;
        assert_eq!(
            decrypt(&key, &nonce, aad, &changed).unwrap_err(),
            CryptoError::AuthenticationFailed
        );
        let mut changed_nonce = nonce.clone();
        changed_nonce[0] ^= 1;
        assert!(decrypt(&key, &changed_nonce, aad, &expected).is_err());
        assert!(decrypt(&key, &nonce, b"wimm/v1/snapshot", &expected).is_err());
    }
    #[test]
    fn locked_or_invalid_keys_never_work_or_appear_in_diagnostics() {
        let bytes = [123u8; 32];
        let mut key = SecretKey::from_bytes(&bytes).unwrap();
        assert!(!format!("{key:?}").contains("123"));
        key.lock();
        assert!(key.bytes.iter().all(|b| *b == 0));
        assert_eq!(
            encrypt_with_nonce(&key, &[0; 24], b"", b"secret").unwrap_err(),
            CryptoError::Locked
        );
        assert!(SecretKey::from_bytes(&[1; 31]).is_err());
    }
}
