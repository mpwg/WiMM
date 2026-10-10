// SPDX-License-Identifier: AGPL-3.0-or-later
//! Bestehende Hüllen/Legacy-KDF; keine Profilpersistenz oder automatische Migration.
use crate::{CryptoError, SecretKey};
use base64::{Engine, engine::general_purpose::URL_SAFE_NO_PAD};
use serde::{Deserialize, Serialize};
use zeroize::{Zeroize, Zeroizing};
const AAD: &[u8] = wimm_public_crypto::Context::Snapshot.as_bytes();
#[derive(Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct Envelope {
    #[serde(deserialize_with = "version")]
    version: u32,
    nonce: String,
    ciphertext: String,
}
#[derive(Deserialize, Serialize)]
struct Wrap {
    nonce: String,
    ciphertext: String,
}
#[derive(Deserialize, Serialize)]
struct Kdf {
    #[serde(deserialize_with = "unsigned")]
    opslimit: u64,
    #[serde(deserialize_with = "memory")]
    memlimit: usize,
}
#[derive(Deserialize, Serialize)]
struct PassphraseWrap {
    algorithm: String,
    #[serde(
        default,
        skip_serializing_if = "Option::is_none",
        deserialize_with = "present_version"
    )]
    version: Option<u32>,
    #[serde(
        default,
        skip_serializing_if = "Option::is_none",
        deserialize_with = "present"
    )]
    kdf: Option<Kdf>,
    salt: String,
    nonce: String,
    ciphertext: String,
}
#[derive(Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct Record {
    #[serde(deserialize_with = "version")]
    version: u32,
    vault: Envelope,
    passphrase_wrap: PassphraseWrap,
    recovery_wrap: Wrap,
}
#[derive(Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct Space {
    space_id: String,
    #[serde(deserialize_with = "wimm_contract_primitives::integer")]
    key_version: i64,
    key: Zeroizing<String>,
}
impl Drop for Space {
    fn drop(&mut self) {
        self.key.zeroize();
    }
}
#[derive(Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct Payload {
    identity_public_key: String,
    identity_private_key: Zeroizing<String>,
    encryption_public_key: String,
    encryption_private_key: Zeroizing<String>,
    spaces: Vec<Space>,
}
impl Drop for Payload {
    fn drop(&mut self) {
        self.identity_private_key.zeroize();
        self.encryption_private_key.zeroize();
    }
}
fn decoded(value: &str) -> Result<Vec<u8>, CryptoError> {
    URL_SAFE_NO_PAD
        .decode(value)
        .map_err(|_| CryptoError::InvalidInput)
}
fn present<'de, D, T>(d: D) -> Result<Option<T>, D::Error>
where
    D: serde::Deserializer<'de>,
    T: Deserialize<'de>,
{
    T::deserialize(d).map(Some)
}
fn record(input: &[u8]) -> Result<Record, CryptoError> {
    let value: Record = serde_json::from_slice(input).map_err(|_| CryptoError::InvalidInput)?;
    if value.version != 1
        || value.vault.version != 1
        || value.passphrase_wrap.algorithm != "argon2id"
    {
        return Err(CryptoError::InvalidInput);
    }
    match (value.passphrase_wrap.version, &value.passphrase_wrap.kdf) {
        (None, None) => {}
        (Some(2), Some(kdf))
            if (3..=6).contains(&kdf.opslimit)
                && (67108864..=268435456).contains(&kdf.memlimit) => {}
        _ => return Err(CryptoError::InvalidInput),
    }
    Ok(value)
}
fn passphrase_key(
    wrap: &PassphraseWrap,
    password: &[u8],
) -> Result<(SecretKey, Vec<u8>), CryptoError> {
    let (ops, memory, legacy) = match (wrap.version, &wrap.kdf) {
        (None, None) => (2, 67108864, true),
        (Some(2), Some(kdf)) => (kdf.opslimit, kdf.memlimit, false),
        _ => return Err(CryptoError::InvalidInput),
    };
    let salt = decoded(&wrap.salt)?;
    let key = crate::keys::derive_key(password, &salt, ops, memory, legacy)?;
    let aad = if legacy {
        AAD.to_vec()
    } else {
        serde_json::to_vec(&serde_json::json!([
            "wimm/v1/passphrase-wrap",
            2,
            "argon2id",
            ops,
            memory,
            wrap.salt
        ]))
        .map_err(|_| CryptoError::InvalidInput)?
    };
    Ok((key, aad))
}
fn unwrap(
    nonce: &str,
    cipher: &str,
    key: &SecretKey,
    aad: &[u8],
) -> Result<SecretKey, CryptoError> {
    let clear = crate::decrypt(key, &decoded(nonce)?, aad, &decoded(cipher)?)?;
    SecretKey::from_bytes(&clear)
}
pub struct UnlockedVault {
    key: SecretKey,
    payload: Payload,
    locked: bool,
}
impl std::fmt::Debug for UnlockedVault {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str("UnlockedVault([vertraulich])")
    }
}
impl UnlockedVault {
    pub fn lock(&mut self) {
        self.key.lock();
        self.payload.identity_private_key.zeroize();
        self.payload.encryption_private_key.zeroize();
        for space in &mut self.payload.spaces {
            space.key.zeroize();
        }
        self.locked = true;
    }
    pub fn public_identity(&self) -> Result<Vec<u8>, CryptoError> {
        if self.locked {
            return Err(CryptoError::Locked);
        }
        decoded(&self.payload.identity_public_key)
    }
    pub fn has_space(&self, id: &str, version: i64) -> bool {
        !self.locked
            && self
                .payload
                .spaces
                .iter()
                .any(|s| s.space_id == id && s.key_version == version)
    }
}
fn vault(value: Record, key: SecretKey) -> Result<UnlockedVault, CryptoError> {
    let clear = crate::decrypt(
        &key,
        &decoded(&value.vault.nonce)?,
        AAD,
        &decoded(&value.vault.ciphertext)?,
    )?;
    let payload: Payload = serde_json::from_slice(&clear).map_err(|_| CryptoError::InvalidInput)?;
    let a = Zeroizing::new(decoded(&payload.identity_private_key)?);
    let b = Zeroizing::new(decoded(&payload.encryption_private_key)?);
    crate::keys::validate_key_pairs(
        &decoded(&payload.identity_public_key)?,
        &a,
        &decoded(&payload.encryption_public_key)?,
        &b,
    )?;
    for space in &payload.spaces {
        let key = Zeroizing::new(decoded(&space.key)?);
        if key.len() != 32
            || !(-9_007_199_254_740_991..=9_007_199_254_740_991).contains(&space.key_version)
        {
            return Err(CryptoError::InvalidInput);
        }
    }
    Ok(UnlockedVault {
        key,
        payload,
        locked: false,
    })
}
pub fn unlock_passphrase(input: &[u8], password: &[u8]) -> Result<UnlockedVault, CryptoError> {
    let value = record(input)?;
    let (derived, aad) = passphrase_key(&value.passphrase_wrap, password)?;
    let key = unwrap(
        &value.passphrase_wrap.nonce,
        &value.passphrase_wrap.ciphertext,
        &derived,
        &aad,
    )?;
    vault(value, key)
}
pub fn unlock_recovery(input: &[u8], code: &str) -> Result<UnlockedVault, CryptoError> {
    let value = record(input)?;
    let bytes = Zeroizing::new(decoded(code)?);
    let recovery = SecretKey::from_bytes(&bytes)?;
    let key = unwrap(
        &value.recovery_wrap.nonce,
        &value.recovery_wrap.ciphertext,
        &recovery,
        AAD,
    )?;
    vault(value, key)
}
pub fn open_snapshot(key: &SecretKey, input: &[u8]) -> Result<Zeroizing<Vec<u8>>, CryptoError> {
    let value: Envelope = serde_json::from_slice(input).map_err(|_| CryptoError::InvalidInput)?;
    if value.version != 1 {
        return Err(CryptoError::InvalidInput);
    }
    crate::decrypt(
        key,
        &decoded(&value.nonce)?,
        AAD,
        &decoded(&value.ciphertext)?,
    )
}
pub struct CreatedVault {
    pub record: Vec<u8>,
    pub recovery_code: Zeroizing<String>,
}
fn wrap(key: &SecretKey, plain: &[u8], aad: &[u8]) -> Result<Wrap, CryptoError> {
    let result = crate::encrypt(key, aad, plain)?;
    Ok(Wrap {
        nonce: URL_SAFE_NO_PAD.encode(result.nonce),
        ciphertext: URL_SAFE_NO_PAD.encode(result.ciphertext),
    })
}
fn pass_wrap(vault_key: &SecretKey, password: &[u8]) -> Result<PassphraseWrap, CryptoError> {
    let text = std::str::from_utf8(password).map_err(|_| CryptoError::InvalidInput)?;
    if !(12..=1024).contains(&text.encode_utf16().count()) {
        return Err(CryptoError::InvalidInput);
    }
    let salt = crate::random_bytes(16)?;
    let derived = crate::keys::derive_key(password, &salt, 3, 67108864, false)?;
    let salt = URL_SAFE_NO_PAD.encode(salt);
    let header = serde_json::to_vec(&serde_json::json!([
        "wimm/v1/passphrase-wrap",
        2,
        "argon2id",
        3,
        67108864,
        salt
    ]))
    .map_err(|_| CryptoError::InvalidInput)?;
    let encrypted = wrap(&derived, vault_key.expose()?, &header)?;
    Ok(PassphraseWrap {
        algorithm: "argon2id".into(),
        version: Some(2),
        kdf: Some(Kdf {
            opslimit: 3,
            memlimit: 67108864,
        }),
        salt,
        nonce: encrypted.nonce,
        ciphertext: encrypted.ciphertext,
    })
}
#[cfg(not(target_arch = "wasm32"))]
use crate::native as backend;
#[cfg(target_arch = "wasm32")]
use crate::wasm as backend;
pub fn create_vault(password: &[u8]) -> Result<CreatedVault, CryptoError> {
    let text = std::str::from_utf8(password).map_err(|_| CryptoError::InvalidInput)?;
    if !(12..=1024).contains(&text.encode_utf16().count()) {
        return Err(CryptoError::InvalidInput);
    }
    let key = SecretKey::generate()?;
    let recovery = SecretKey::generate()?;
    let seed_a = Zeroizing::new(crate::random_bytes(32)?);
    let seed_b = Zeroizing::new(crate::random_bytes(32)?);
    let a = Zeroizing::new(backend::identity(&seed_a)?);
    let b = Zeroizing::new(backend::encryption_pair(&seed_b)?);
    let payload = Payload {
        identity_public_key: URL_SAFE_NO_PAD.encode(&a[..32]),
        identity_private_key: Zeroizing::new(URL_SAFE_NO_PAD.encode(&a[32..])),
        encryption_public_key: URL_SAFE_NO_PAD.encode(&b[..32]),
        encryption_private_key: Zeroizing::new(URL_SAFE_NO_PAD.encode(&b[32..])),
        spaces: vec![],
    };
    let bytes =
        Zeroizing::new(serde_json::to_vec(&payload).map_err(|_| CryptoError::InvalidInput)?);
    let body = wrap(&key, &bytes, AAD)?;
    let value = Record {
        version: 1,
        vault: Envelope {
            version: 1,
            nonce: body.nonce,
            ciphertext: body.ciphertext,
        },
        passphrase_wrap: pass_wrap(&key, password)?,
        recovery_wrap: wrap(&recovery, key.expose()?, AAD)?,
    };
    Ok(CreatedVault {
        record: serde_json::to_vec(&value).map_err(|_| CryptoError::InvalidInput)?,
        recovery_code: Zeroizing::new(URL_SAFE_NO_PAD.encode(recovery.expose()?)),
    })
}
impl UnlockedVault {
    pub fn reencrypt_record(&self, input: &[u8], password: &[u8]) -> Result<Vec<u8>, CryptoError> {
        if self.locked {
            return Err(CryptoError::Locked);
        }
        let mut value = record(input)?;
        let existing = vault(record(input)?, SecretKey::from_bytes(self.key.expose()?)?)?;
        if existing.public_identity()? != self.public_identity()? {
            return Err(CryptoError::InvalidInput);
        }
        value.passphrase_wrap = pass_wrap(&self.key, password)?;
        serde_json::to_vec(&value).map_err(|_| CryptoError::InvalidInput)
    }
}
pub fn seal_snapshot(key: &SecretKey, plain: &[u8]) -> Result<Vec<u8>, CryptoError> {
    let body = wrap(key, plain, AAD)?;
    serde_json::to_vec(&Envelope {
        version: 1,
        nonce: body.nonce,
        ciphertext: body.ciphertext,
    })
    .map_err(|_| CryptoError::InvalidInput)
}

fn unsigned<'de, D: serde::Deserializer<'de>>(d: D) -> Result<u64, D::Error> {
    wimm_contract_primitives::integer(d)?
        .try_into()
        .map_err(|_| serde::de::Error::custom("Ungültige KDF-Parameter."))
}
fn memory<'de, D: serde::Deserializer<'de>>(d: D) -> Result<usize, D::Error> {
    wimm_contract_primitives::integer(d)?
        .try_into()
        .map_err(|_| serde::de::Error::custom("Ungültige KDF-Parameter."))
}

fn version<'de, D: serde::Deserializer<'de>>(d: D) -> Result<u32, D::Error> {
    wimm_contract_primitives::integer(d)?
        .try_into()
        .map_err(|_| serde::de::Error::custom("Ungültige Hüllenversion."))
}
fn present_version<'de, D: serde::Deserializer<'de>>(d: D) -> Result<Option<u32>, D::Error> {
    version(d).map(Some)
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn unsupported_kdf_never_falls_back_to_legacy() {
        let wrap = PassphraseWrap {
            algorithm: "argon2id".into(),
            version: Some(99),
            kdf: None,
            salt: "AA".into(),
            nonce: String::new(),
            ciphertext: String::new(),
        };
        assert_eq!(
            passphrase_key(&wrap, b"secret").err(),
            Some(CryptoError::InvalidInput)
        );
    }
}
