// SPDX-License-Identifier: AGPL-3.0-or-later
#[cfg(not(target_arch = "wasm32"))]
use crate::native as backend;
#[cfg(target_arch = "wasm32")]
use crate::wasm as backend;
use crate::{CryptoError, random_bytes};
use zeroize::{Zeroize, Zeroizing};
pub struct Identity {
    public: Vec<u8>,
    secret: Zeroizing<Vec<u8>>,
    locked: bool,
}
impl Identity {
    pub fn generate() -> Result<Self, CryptoError> {
        let seed = Zeroizing::new(random_bytes(32)?);
        Self::from_seed(&seed)
    }
    pub fn from_seed(seed: &[u8]) -> Result<Self, CryptoError> {
        if seed.len() != 32 {
            return Err(CryptoError::InvalidInput);
        }
        let pair = Zeroizing::new(backend::identity(seed)?);
        Ok(Self {
            public: pair[..32].to_vec(),
            secret: Zeroizing::new(pair[32..].to_vec()),
            locked: false,
        })
    }
    pub fn public_key(&self) -> &[u8] {
        &self.public
    }
    pub fn sign(&self, message: &[u8]) -> Result<Vec<u8>, CryptoError> {
        if self.locked {
            return Err(CryptoError::Locked);
        }
        backend::sign(message, &self.secret)
    }
    pub fn lock(&mut self) {
        self.secret.as_mut_slice().zeroize();
        self.locked = true;
    }
}
impl std::fmt::Debug for Identity {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str("Identity([vertraulich])")
    }
}
pub struct EncryptionIdentity {
    public: Vec<u8>,
    secret: Zeroizing<Vec<u8>>,
    locked: bool,
}
impl EncryptionIdentity {
    pub fn generate() -> Result<Self, CryptoError> {
        let seed = Zeroizing::new(random_bytes(32)?);
        Self::from_seed(&seed)
    }
    pub fn from_seed(seed: &[u8]) -> Result<Self, CryptoError> {
        if seed.len() != 32 {
            return Err(CryptoError::InvalidInput);
        }
        let pair = Zeroizing::new(backend::encryption_pair(seed)?);
        Ok(Self {
            public: pair[..32].to_vec(),
            secret: Zeroizing::new(pair[32..].to_vec()),
            locked: false,
        })
    }
    pub fn public_key(&self) -> &[u8] {
        &self.public
    }
    pub fn open(&self, cipher: &[u8]) -> Result<Zeroizing<Vec<u8>>, CryptoError> {
        if self.locked {
            return Err(CryptoError::Locked);
        }
        if cipher.len() < 48 {
            return Err(CryptoError::InvalidInput);
        }
        backend::opened(cipher, &self.public, &self.secret).map(Zeroizing::new)
    }
    pub fn lock(&mut self) {
        self.secret.as_mut_slice().zeroize();
        self.locked = true;
    }
}
pub fn sealed(message: &[u8], public: &[u8]) -> Result<Vec<u8>, CryptoError> {
    if public.len() != 32 {
        return Err(CryptoError::InvalidInput);
    }
    backend::sealed(message, public)
}
pub fn derive_key(
    password: &[u8],
    salt: &[u8],
    ops: u64,
    memory: usize,
    legacy: bool,
) -> Result<crate::SecretKey, CryptoError> {
    if salt.len() != 16
        || !(64 * 1024 * 1024..=256 * 1024 * 1024).contains(&memory)
        || if legacy {
            ops != 2 || memory != 64 * 1024 * 1024
        } else {
            !(3..=6).contains(&ops)
        }
    {
        return Err(CryptoError::InvalidInput);
    }
    let bytes = Zeroizing::new(backend::pwhash(password, salt, ops, memory)?);
    crate::SecretKey::from_bytes(&bytes)
}
pub fn validate_key_pairs(
    identity_public: &[u8],
    identity_secret: &[u8],
    encryption_public: &[u8],
    encryption_secret: &[u8],
) -> Result<(), CryptoError> {
    if identity_public.len() != 32
        || identity_secret.len() != 64
        || encryption_public.len() != 32
        || encryption_secret.len() != 32
    {
        return Err(CryptoError::InvalidInput);
    }
    let a = backend::public_identity(identity_secret)?;
    let b = backend::public_encryption(encryption_secret)?;
    if a != identity_public || b != encryption_public {
        return Err(CryptoError::InvalidInput);
    }
    Ok(())
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn identity_signature_sealed_recipient_and_lock() {
        let mut a = Identity::from_seed(&[0; 32]).unwrap();
        assert_eq!(a.sign(b"sample").unwrap().len(), 64);
        a.lock();
        assert_eq!(a.sign(b"sample").unwrap_err(), CryptoError::Locked);
        let mut recipient = EncryptionIdentity::from_seed(&[1; 32]).unwrap();
        let other = EncryptionIdentity::from_seed(&[2; 32]).unwrap();
        let cipher = sealed(b"synthetisch", recipient.public_key()).unwrap();
        assert_eq!(&*recipient.open(&cipher).unwrap(), b"synthetisch");
        assert!(other.open(&cipher).is_err());
        recipient.lock();
        assert_eq!(recipient.open(&cipher).unwrap_err(), CryptoError::Locked);
    }
    #[test]
    fn kdf_bounds_rejected_before_execution() {
        for (ops, memory, legacy) in [
            (1, 64 * 1024 * 1024, false),
            (7, 64 * 1024 * 1024, false),
            (3, 63 * 1024 * 1024, false),
            (3, 257 * 1024 * 1024, false),
            (3, 64 * 1024 * 1024, true),
        ] {
            assert_eq!(
                derive_key(b"synthetisch", &[0; 16], ops, memory, legacy).err(),
                Some(CryptoError::InvalidInput)
            );
        }
    }
}
#[cfg(test)]
mod kdf_vectors {
    use super::*;
    #[test]
    fn existing_wasm_argon2id_legacy_and_v2_vectors_match_native() {
        for (ops, expected) in [
            (
                2,
                "9e1dfb08d6c8290323091b1a9cebfdc4f6568b1ecf68c4667077898cd754b6f5",
            ),
            (
                3,
                "fe08c4f202a3354c5fbd304fe21b7e5b28c9f1fa660385a950714695a85570a4",
            ),
        ] {
            let key = derive_key(
                "Synthetische Passphrase 🏠".as_bytes(),
                &[0; 16],
                ops,
                67108864,
                ops == 2,
            )
            .unwrap();
            let actual = key
                .expose()
                .unwrap()
                .iter()
                .map(|b| format!("{b:02x}"))
                .collect::<String>();
            assert_eq!(actual, expected);
        }
    }
}
