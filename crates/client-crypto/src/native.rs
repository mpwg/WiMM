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
pub fn identity(seed: &[u8]) -> Result<Vec<u8>, CryptoError> {
    initialize()?;
    let pair = libsodium_rs::crypto_sign::KeyPair::from_seed(seed)
        .map_err(|_| CryptoError::InvalidInput)?;
    let mut result = pair.public_key.as_bytes().to_vec();
    result.extend_from_slice(pair.secret_key.as_bytes());
    Ok(result)
}
pub fn sign(message: &[u8], secret: &[u8]) -> Result<Vec<u8>, CryptoError> {
    initialize()?;
    let key = libsodium_rs::crypto_sign::SecretKey::from_bytes(secret)
        .map_err(|_| CryptoError::InvalidInput)?;
    libsodium_rs::crypto_sign::sign_detached(message, &key)
        .map(|v| v.to_vec())
        .map_err(|_| CryptoError::Unavailable)
}
pub fn encryption_pair(seed: &[u8]) -> Result<Vec<u8>, CryptoError> {
    initialize()?;
    let pair = libsodium_rs::crypto_box::KeyPair::from_seed(seed)
        .map_err(|_| CryptoError::InvalidInput)?;
    let mut result = pair.public_key.as_bytes().to_vec();
    result.extend_from_slice(pair.secret_key.as_bytes());
    Ok(result)
}
pub fn sealed(message: &[u8], public: &[u8]) -> Result<Vec<u8>, CryptoError> {
    initialize()?;
    let key = libsodium_rs::crypto_box::PublicKey::from_bytes(public)
        .map_err(|_| CryptoError::InvalidInput)?;
    libsodium_rs::crypto_box::seal_box(message, &key).map_err(|_| CryptoError::InvalidInput)
}
pub fn opened(cipher: &[u8], public: &[u8], secret: &[u8]) -> Result<Vec<u8>, CryptoError> {
    initialize()?;
    let public = libsodium_rs::crypto_box::PublicKey::from_bytes(public)
        .map_err(|_| CryptoError::InvalidInput)?;
    let secret = libsodium_rs::crypto_box::SecretKey::from_bytes(secret)
        .map_err(|_| CryptoError::InvalidInput)?;
    libsodium_rs::crypto_box::open_sealed_box(cipher, &public, &secret)
        .map_err(|_| CryptoError::AuthenticationFailed)
}
pub fn pwhash(
    password: &[u8],
    salt: &[u8],
    ops: u64,
    memory: usize,
) -> Result<Vec<u8>, CryptoError> {
    initialize()?;
    libsodium_rs::crypto_pwhash::argon2id::pwhash(32, password, salt, ops, memory)
        .map_err(|_| CryptoError::Unavailable)
}
pub fn public_identity(secret: &[u8]) -> Result<Vec<u8>, CryptoError> {
    initialize()?;
    let key = libsodium_rs::crypto_sign::SecretKey::from_bytes(secret)
        .map_err(|_| CryptoError::InvalidInput)?;
    let seed = zeroize::Zeroizing::new(
        libsodium_rs::crypto_sign::secret_key_to_seed(&key)
            .map_err(|_| CryptoError::InvalidInput)?,
    );
    let pair = libsodium_rs::crypto_sign::KeyPair::from_seed(seed.as_slice())
        .map_err(|_| CryptoError::InvalidInput)?;
    if !libsodium_rs::utils::memcmp(pair.secret_key.as_bytes(), secret) {
        return Err(CryptoError::InvalidInput);
    }
    Ok(pair.public_key.as_bytes().to_vec())
}
pub fn public_encryption(secret: &[u8]) -> Result<Vec<u8>, CryptoError> {
    initialize()?;
    libsodium_rs::crypto_scalarmult::curve25519::scalarmult_base(secret)
        .map(|p| p.to_vec())
        .map_err(|_| CryptoError::InvalidInput)
}
