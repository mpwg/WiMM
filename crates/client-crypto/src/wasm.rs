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
#[wasm_bindgen(module = "/js/sodium.js")]
extern "C" {
    #[wasm_bindgen(catch,js_name=identity)]
    fn js_identity(seed: &[u8]) -> Result<js_sys::Uint8Array, JsValue>;
    #[wasm_bindgen(catch,js_name=sign)]
    fn js_sign(message: &[u8], secret: &[u8]) -> Result<js_sys::Uint8Array, JsValue>;
    #[wasm_bindgen(catch,js_name=encryptionPair)]
    fn js_encryption_pair(seed: &[u8]) -> Result<js_sys::Uint8Array, JsValue>;
    #[wasm_bindgen(catch,js_name=sealed)]
    fn js_sealed(message: &[u8], public: &[u8]) -> Result<js_sys::Uint8Array, JsValue>;
    #[wasm_bindgen(catch,js_name=opened)]
    fn js_opened(
        cipher: &[u8],
        public: &[u8],
        secret: &[u8],
    ) -> Result<js_sys::Uint8Array, JsValue>;
    #[wasm_bindgen(catch,js_name=pwhash)]
    fn js_pwhash(
        password: &[u8],
        salt: &[u8],
        ops: u32,
        memory: u32,
    ) -> Result<js_sys::Uint8Array, JsValue>;
    #[wasm_bindgen(catch,js_name=publicIdentity)]
    fn js_public_identity(secret: &[u8]) -> Result<js_sys::Uint8Array, JsValue>;
    #[wasm_bindgen(catch,js_name=publicEncryption)]
    fn js_public_encryption(secret: &[u8]) -> Result<js_sys::Uint8Array, JsValue>;
}
fn take_private(bytes: js_sys::Uint8Array) -> Result<Vec<u8>, CryptoError> {
    let result = zeroize::Zeroizing::new(bytes.to_vec());
    clear(&bytes).map_err(|_| CryptoError::Unavailable)?;
    Ok(result.to_vec())
}
pub fn identity(seed: &[u8]) -> Result<Vec<u8>, CryptoError> {
    initialize()?;
    take_private(js_identity(seed).map_err(|_| CryptoError::InvalidInput)?)
}
pub fn encryption_pair(seed: &[u8]) -> Result<Vec<u8>, CryptoError> {
    initialize()?;
    take_private(js_encryption_pair(seed).map_err(|_| CryptoError::InvalidInput)?)
}
pub fn sign(message: &[u8], secret: &[u8]) -> Result<Vec<u8>, CryptoError> {
    initialize()?;
    js_sign(message, secret)
        .map(|v| v.to_vec())
        .map_err(|_| CryptoError::InvalidInput)
}
pub fn sealed(message: &[u8], public: &[u8]) -> Result<Vec<u8>, CryptoError> {
    initialize()?;
    js_sealed(message, public)
        .map(|v| v.to_vec())
        .map_err(|_| CryptoError::InvalidInput)
}
pub fn opened(cipher: &[u8], public: &[u8], secret: &[u8]) -> Result<Vec<u8>, CryptoError> {
    initialize()?;
    take_private(js_opened(cipher, public, secret).map_err(|_| CryptoError::AuthenticationFailed)?)
}
pub fn pwhash(
    password: &[u8],
    salt: &[u8],
    ops: u64,
    memory: usize,
) -> Result<Vec<u8>, CryptoError> {
    initialize()?;
    take_private(
        js_pwhash(
            password,
            salt,
            ops.try_into().map_err(|_| CryptoError::InvalidInput)?,
            memory.try_into().map_err(|_| CryptoError::InvalidInput)?,
        )
        .map_err(|_| CryptoError::Unavailable)?,
    )
}
pub fn public_identity(secret: &[u8]) -> Result<Vec<u8>, CryptoError> {
    initialize()?;
    js_public_identity(secret)
        .map(|v| v.to_vec())
        .map_err(|_| CryptoError::InvalidInput)
}
pub fn public_encryption(secret: &[u8]) -> Result<Vec<u8>, CryptoError> {
    initialize()?;
    js_public_encryption(secret)
        .map(|v| v.to_vec())
        .map_err(|_| CryptoError::InvalidInput)
}
#[wasm_bindgen]
pub struct SigningSession {
    inner: crate::keys::Identity,
}
#[wasm_bindgen]
impl SigningSession {
    #[wasm_bindgen(constructor)]
    pub fn new() -> Result<SigningSession, JsValue> {
        crate::keys::Identity::generate()
            .map(|inner| Self { inner })
            .map_err(js_error)
    }
    #[cfg(feature = "contract-probe")]
    pub fn from_seed(seed: Vec<u8>) -> Result<SigningSession, JsValue> {
        let seed = zeroize::Zeroizing::new(seed);
        crate::keys::Identity::from_seed(&seed)
            .map(|inner| Self { inner })
            .map_err(js_error)
    }
    #[wasm_bindgen(getter,js_name=publicKey)]
    pub fn public_key(&self) -> Vec<u8> {
        self.inner.public_key().to_vec()
    }
    pub fn sign(&self, message: &[u8]) -> Result<Vec<u8>, JsValue> {
        self.inner.sign(message).map_err(js_error)
    }
    pub fn lock(&mut self) {
        self.inner.lock();
    }
}
#[wasm_bindgen]
pub struct SealedSession {
    inner: crate::keys::EncryptionIdentity,
}
#[wasm_bindgen]
impl SealedSession {
    #[wasm_bindgen(constructor)]
    pub fn new() -> Result<SealedSession, JsValue> {
        crate::keys::EncryptionIdentity::generate()
            .map(|inner| Self { inner })
            .map_err(js_error)
    }
    #[cfg(feature = "contract-probe")]
    pub fn from_seed(seed: Vec<u8>) -> Result<SealedSession, JsValue> {
        let seed = zeroize::Zeroizing::new(seed);
        crate::keys::EncryptionIdentity::from_seed(&seed)
            .map(|inner| Self { inner })
            .map_err(js_error)
    }
    #[wasm_bindgen(getter,js_name=publicKey)]
    pub fn public_key(&self) -> Vec<u8> {
        self.inner.public_key().to_vec()
    }
    pub fn open(&self, cipher: &[u8]) -> Result<js_sys::Uint8Array, JsValue> {
        let result = self.inner.open(cipher).map_err(js_error)?;
        Ok(js_sys::Uint8Array::from(result.as_slice()))
    }
    pub fn lock(&mut self) {
        self.inner.lock();
    }
}
#[wasm_bindgen]
pub fn seal_to(message: &[u8], public: &[u8]) -> Result<Vec<u8>, JsValue> {
    crate::keys::sealed(message, public).map_err(js_error)
}
#[wasm_bindgen]
pub fn passphrase_session(
    password: Vec<u8>,
    salt: &[u8],
    ops: u32,
    memory: u32,
    legacy: bool,
) -> Result<CryptoSession, JsValue> {
    let password = zeroize::Zeroizing::new(password);
    crate::keys::derive_key(&password, salt, ops.into(), memory as usize, legacy)
        .map(|key| CryptoSession { key })
        .map_err(js_error)
}
#[wasm_bindgen]
pub fn validate_key_pairs(
    identity_public: &[u8],
    identity_secret: Vec<u8>,
    encryption_public: &[u8],
    encryption_secret: Vec<u8>,
) -> Result<(), JsValue> {
    let a = zeroize::Zeroizing::new(identity_secret);
    let b = zeroize::Zeroizing::new(encryption_secret);
    crate::keys::validate_key_pairs(identity_public, &a, encryption_public, &b).map_err(js_error)
}
#[wasm_bindgen]
pub struct VaultSession {
    inner: crate::vault::UnlockedVault,
}
#[wasm_bindgen]
impl VaultSession {
    pub fn unlock_passphrase(record: &[u8], password: Vec<u8>) -> Result<VaultSession, JsValue> {
        let password = zeroize::Zeroizing::new(password);
        crate::vault::unlock_passphrase(record, &password)
            .map(|inner| Self { inner })
            .map_err(js_error)
    }
    pub fn unlock_recovery(record: &[u8], code: String) -> Result<VaultSession, JsValue> {
        let code = zeroize::Zeroizing::new(code);
        crate::vault::unlock_recovery(record, &code)
            .map(|inner| Self { inner })
            .map_err(js_error)
    }
    #[wasm_bindgen(getter,js_name=publicKey)]
    pub fn public_key(&self) -> Result<Vec<u8>, JsValue> {
        self.inner.public_identity().map_err(js_error)
    }
    pub fn has_space(&self, id: &str, version: i64) -> bool {
        self.inner.has_space(id, version)
    }
    pub fn upgrade_passphrase(&self, record: &[u8], password: Vec<u8>) -> Result<Vec<u8>, JsValue> {
        let password = zeroize::Zeroizing::new(password);
        self.inner
            .reencrypt_record(record, &password)
            .map_err(js_error)
    }
    pub fn lock(&mut self) {
        self.inner.lock();
    }
}
#[wasm_bindgen]
pub struct CreatedVault {
    inner: crate::vault::CreatedVault,
}
#[wasm_bindgen]
impl CreatedVault {
    pub fn create(password: Vec<u8>) -> Result<CreatedVault, JsValue> {
        let password = zeroize::Zeroizing::new(password);
        crate::vault::create_vault(&password)
            .map(|inner| Self { inner })
            .map_err(js_error)
    }
    #[wasm_bindgen(getter)]
    pub fn record(&self) -> Vec<u8> {
        self.inner.record.clone()
    }
    #[wasm_bindgen(getter,js_name=recoveryCode)]
    pub fn recovery_code(&self) -> String {
        self.inner.recovery_code.to_string()
    }
}
#[wasm_bindgen]
impl CryptoSession {
    pub fn seal_snapshot(&self, plaintext: &[u8]) -> Result<Vec<u8>, JsValue> {
        crate::vault::seal_snapshot(&self.key, plaintext).map_err(js_error)
    }
    pub fn open_snapshot(&self, record: &[u8]) -> Result<js_sys::Uint8Array, JsValue> {
        let result = crate::vault::open_snapshot(&self.key, record).map_err(js_error)?;
        Ok(js_sys::Uint8Array::from(result.as_slice()))
    }
}
#[wasm_bindgen]
pub fn verify_public(message: &[u8], signature: &[u8], public_key: &[u8]) -> bool {
    wimm_public_crypto::verify_ed25519(message, signature, public_key)
}
#[wasm_bindgen]
pub fn canonical_json(input: &str) -> Result<Vec<u8>, JsValue> {
    let value = serde_json::from_str(input).map_err(|_| js_error(CryptoError::InvalidInput))?;
    wimm_public_crypto::canonical_json_bytes(&value)
        .map_err(|_| js_error(CryptoError::InvalidInput))
}
