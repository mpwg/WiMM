// SPDX-License-Identifier: AGPL-3.0-or-later
use crate::CryptoError;
use libsodium_rs::crypto_aead::xchacha20poly1305::{self as aead, Key, Nonce};
pub fn initialize() -> Result<(), CryptoError> {
    libsodium_rs::ensure_init().map_err(|_| CryptoError::Unavailable)
}
pub fn encrypt(key: &[u8], nonce: &[u8], aad: &[u8], plain: &[u8]) -> Result<Vec<u8>, CryptoError> {
    initialize()?;
    let key = Key::from_bytes(key).map_err(|_| CryptoError::InvalidInput)?;
    let nonce = Nonce::try_from_slice(nonce).map_err(|_| CryptoError::InvalidInput)?;
    aead::encrypt(plain, Some(aad), &nonce, &key).map_err(|_| CryptoError::Unavailable)
}
pub fn decrypt(
    key: &[u8],
    nonce: &[u8],
    aad: &[u8],
    cipher: &[u8],
) -> Result<Vec<u8>, CryptoError> {
    initialize()?;
    let key = Key::from_bytes(key).map_err(|_| CryptoError::InvalidInput)?;
    let nonce = Nonce::try_from_slice(nonce).map_err(|_| CryptoError::InvalidInput)?;
    aead::decrypt(cipher, Some(aad), &nonce, &key).map_err(|_| CryptoError::AuthenticationFailed)
}
pub fn random_bytes(size: usize) -> Result<Vec<u8>, CryptoError> {
    initialize()?;
    Ok(libsodium_rs::random::bytes(size))
}
