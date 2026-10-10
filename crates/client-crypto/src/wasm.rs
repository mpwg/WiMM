// SPDX-License-Identifier: AGPL-3.0-or-later
use crate::CryptoError;
use wasm_bindgen::prelude::*;
#[wasm_bindgen(module = "/js/sodium.js")]
extern "C" {
    #[wasm_bindgen(catch)]
    fn clear(bytes: &js_sys::Uint8Array) -> Result<(), JsValue>;
    #[wasm_bindgen(catch)]
    fn random(size: usize) -> Result<js_sys::Uint8Array, JsValue>;
    #[wasm_bindgen(catch)]
    fn ready() -> Result<bool, JsValue>;
    #[wasm_bindgen(catch)]
    fn encrypt(
        key: &[u8],
        nonce: &[u8],
        aad: &[u8],
        plain: &[u8],
    ) -> Result<js_sys::Uint8Array, JsValue>;
    #[wasm_bindgen(catch)]
    fn decrypt(
        key: &[u8],
        nonce: &[u8],
        aad: &[u8],
        cipher: &[u8],
    ) -> Result<js_sys::Uint8Array, JsValue>;
}
pub fn initialize() -> Result<(), CryptoError> {
    if ready().unwrap_or(false) {
        Ok(())
    } else {
        Err(CryptoError::Unavailable)
    }
}
pub fn encrypt_bytes(
    key: &[u8],
    nonce: &[u8],
    aad: &[u8],
    plain: &[u8],
) -> Result<Vec<u8>, CryptoError> {
    initialize()?;
    encrypt(key, nonce, aad, plain)
        .map(|v| v.to_vec())
        .map_err(|_| CryptoError::Unavailable)
}
pub fn decrypt_bytes(
    key: &[u8],
    nonce: &[u8],
    aad: &[u8],
    cipher: &[u8],
) -> Result<Vec<u8>, CryptoError> {
    initialize()?;
    let bytes = decrypt(key, nonce, aad, cipher).map_err(|_| CryptoError::AuthenticationFailed)?;
    let result = zeroize::Zeroizing::new(bytes.to_vec());
    clear(&bytes).map_err(|_| CryptoError::Unavailable)?;
    Ok(result.to_vec())
}

#[wasm_bindgen]
pub struct CryptoSession {
    key: crate::SecretKey,
}
#[wasm_bindgen]
impl CryptoSession {
    #[wasm_bindgen(constructor)]
    pub fn new(key: Vec<u8>) -> Result<CryptoSession, JsValue> {
        let key = zeroize::Zeroizing::new(key);
        crate::SecretKey::from_bytes(&key)
            .map(|key| Self { key })
            .map_err(js_error)
    }
    pub fn lock(&mut self) {
        self.key.lock();
    }
    #[cfg(feature = "contract-probe")]
    pub fn encrypt_fixed(
        &self,
        nonce: &[u8],
        aad: &[u8],
        plain: &[u8],
    ) -> Result<Vec<u8>, JsValue> {
        crate::encrypt_with_nonce(&self.key, nonce, aad, plain).map_err(js_error)
    }
    pub fn decrypt(
        &self,
        nonce: &[u8],
        aad: &[u8],
        cipher: &[u8],
    ) -> Result<js_sys::Uint8Array, JsValue> {
        let result = crate::decrypt(&self.key, nonce, aad, cipher).map_err(js_error)?;
        Ok(js_sys::Uint8Array::from(result.as_slice()))
    }
}

pub fn random_bytes(size: usize) -> Result<Vec<u8>, CryptoError> {
    initialize()?;
    let bytes = random(size).map_err(|_| CryptoError::Unavailable)?;
    let result = zeroize::Zeroizing::new(bytes.to_vec());
    clear(&bytes).map_err(|_| CryptoError::Unavailable)?;
    Ok(result.to_vec())
}
fn js_error(error: CryptoError) -> JsValue {
    let result = js_sys::Object::new();
    let code = match error {
        CryptoError::InvalidInput => "INVALID_CRYPTO_INPUT",
        CryptoError::AuthenticationFailed => "CRYPTO_AUTH_FAILED",
        CryptoError::Unavailable => "CRYPTO_UNAVAILABLE",
        CryptoError::Locked => "CRYPTO_LOCKED",
    };
    let _ = js_sys::Reflect::set(
        &result,
        &JsValue::from_str("contractVersion"),
        &JsValue::from_f64(2.0),
    );
    let _ = js_sys::Reflect::set(
        &result,
        &JsValue::from_str("code"),
        &JsValue::from_str(code),
    );
    result.into()
}
#[wasm_bindgen]
pub struct EncryptedBytes {
    inner: crate::Ciphertext,
}
#[wasm_bindgen]
impl EncryptedBytes {
    #[wasm_bindgen(getter)]
    pub fn nonce(&self) -> Vec<u8> {
        self.inner.nonce.clone()
    }
    #[wasm_bindgen(getter)]
    pub fn ciphertext(&self) -> Vec<u8> {
        self.inner.ciphertext.clone()
    }
}
#[wasm_bindgen]
impl CryptoSession {
    pub fn encrypt(&self, aad: &[u8], plaintext: &[u8]) -> Result<EncryptedBytes, JsValue> {
        crate::encrypt(&self.key, aad, plaintext)
            .map(|inner| EncryptedBytes { inner })
            .map_err(js_error)
    }
}
