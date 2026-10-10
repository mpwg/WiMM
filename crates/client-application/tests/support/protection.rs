// SPDX-License-Identifier: AGPL-3.0-or-later
#![forbid(unsafe_code)]
use wimm_local_contracts::{
    commit::LocalCommitRequest, persistence_errors::*, storage_port::SnapshotProtectionPort,
};
// Ausschließlich synthetischer Testschlüssel. Echte AR08-libsodium-Primitive mit Zufallsnonce.
pub struct Protect(pub wimm_client_crypto::SecretKey);
impl Protect {
    pub fn new() -> Self {
        wimm_client_crypto::initialize().unwrap();
        Self(wimm_client_crypto::SecretKey::from_bytes(&[42; 32]).unwrap())
    }
}
impl SnapshotProtectionPort<LocalCommitRequest> for Protect {
    type Error = StorageFailure;
    fn seal(&self, request: LocalCommitRequest) -> Result<Vec<u8>, StorageFailure> {
        let bytes = serde_json::to_vec(&request).map_err(|_| failure())?;
        let sealed =
            wimm_client_crypto::encrypt(&self.0, b"wimm/local/application-recovery/v1", &bytes)
                .map_err(|_| failure())?;
        serde_json::to_vec(
            &serde_json::json!({"nonce":sealed.nonce,"ciphertext":sealed.ciphertext}),
        )
        .map_err(|_| failure())
    }
    fn unseal(&self, bytes: &[u8]) -> Result<LocalCommitRequest, StorageFailure> {
        #[derive(serde::Deserialize)]
        #[serde(deny_unknown_fields)]
        struct Boxed {
            nonce: Vec<u8>,
            ciphertext: Vec<u8>,
        }
        let boxed: Boxed = serde_json::from_slice(bytes).map_err(|_| failure())?;
        let opened = wimm_client_crypto::decrypt(
            &self.0,
            &boxed.nonce,
            b"wimm/local/application-recovery/v1",
            &boxed.ciphertext,
        )
        .map_err(|_| failure())?;
        serde_json::from_slice(&opened).map_err(|_| failure())
    }
}
pub fn failure() -> StorageFailure {
    StorageFailure::not_committed(StorageFailureCode::WriteFailed)
}
