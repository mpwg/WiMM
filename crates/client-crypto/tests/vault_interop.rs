// SPDX-License-Identifier: AGPL-3.0-or-later
#![forbid(unsafe_code)]
use wimm_client_crypto::{CryptoError, SecretKey, vault};
fn fixture() -> serde_json::Value {
    serde_json::from_str(include_str!("fixtures/vault-interop.json")).unwrap()
}
#[test]
fn original_ts_current_legacy_recovery_and_tampering_are_native_compatible() {
    let data = fixture();
    let password = data["password"].as_str().unwrap().as_bytes();
    let recovery = data["recoveryCode"].as_str().unwrap();
    let space = data["spaceId"].as_str().unwrap();
    for version in ["current", "legacy"] {
        let record = serde_json::to_vec(&data[version]).unwrap();
        let mut a = vault::unlock_passphrase(&record, password).unwrap();
        let b = vault::unlock_recovery(&record, recovery).unwrap();
        assert_eq!(a.public_identity().unwrap(), b.public_identity().unwrap());
        assert!(a.has_space(space, 1));
        assert!(vault::unlock_passphrase(&record, b"falsche synthetische Passphrase").is_err());
        let upgraded = a.reencrypt_record(&record, password).unwrap();
        let decoded: serde_json::Value = serde_json::from_slice(&upgraded).unwrap();
        assert_eq!(decoded["recoveryWrap"], data[version]["recoveryWrap"]);
        assert_eq!(decoded["vault"], data[version]["vault"]);
        assert_eq!(decoded["passphraseWrap"]["version"], 2);
        assert_eq!(
            vault::unlock_passphrase(&upgraded, password)
                .unwrap()
                .public_identity()
                .unwrap(),
            b.public_identity().unwrap()
        );
        a.lock();
        assert_eq!(a.public_identity().unwrap_err(), CryptoError::Locked);
    }
    for malformed in [
        serde_json::json!({"version":null}),
        serde_json::json!({"version":99}),
        serde_json::json!({"kdf":{"opslimit":7,"memlimit":67108864}}),
        serde_json::json!({"version":null,"kdf":null}),
    ] {
        let mut input = data["current"].clone();
        for (k, v) in malformed.as_object().unwrap() {
            input["passphraseWrap"][k] = v.clone();
        }
        assert!(vault::unlock_passphrase(&serde_json::to_vec(&input).unwrap(), password).is_err());
        assert!(vault::unlock_recovery(&serde_json::to_vec(&input).unwrap(), recovery).is_err());
    }
}
#[test]
fn native_creation_recovery_export_and_lock_have_direct_assertions() {
    let created = vault::create_vault("Synthetische Passphrase 🏠".as_bytes()).unwrap();
    let a =
        vault::unlock_passphrase(&created.record, "Synthetische Passphrase 🏠".as_bytes()).unwrap();
    let b = vault::unlock_recovery(&created.record, &created.recovery_code).unwrap();
    assert_eq!(a.public_identity().unwrap(), b.public_identity().unwrap());
    let key = SecretKey::from_bytes(&[7; 32]).unwrap();
    let plaintext = "{\"synthetisch\":\"🏠\",\"betrag\":1001}".as_bytes();
    let sealed = vault::seal_snapshot(&key, plaintext).unwrap();
    assert_eq!(&*vault::open_snapshot(&key, &sealed).unwrap(), plaintext);
    let mut changed: serde_json::Value = serde_json::from_slice(&sealed).unwrap();
    changed["version"] = 2.into();
    assert!(vault::open_snapshot(&key, &serde_json::to_vec(&changed).unwrap()).is_err());
    assert!(vault::open_snapshot(&SecretKey::from_bytes(&[8; 32]).unwrap(), &sealed).is_err());
    assert!(!format!("{a:?}").contains(&created.recovery_code[..]));
}
#[test]
fn authenticated_but_mathematically_damaged_private_keys_are_never_released() {
    use base64::{Engine, engine::general_purpose::URL_SAFE_NO_PAD};
    let data = fixture();
    let mut record = data["current"].clone();
    let recovery = SecretKey::from_bytes(
        &URL_SAFE_NO_PAD
            .decode(data["recoveryCode"].as_str().unwrap())
            .unwrap(),
    )
    .unwrap();
    let aad = b"wimm/v1/snapshot";
    let vault_key = wimm_client_crypto::decrypt(
        &recovery,
        &URL_SAFE_NO_PAD
            .decode(record["recoveryWrap"]["nonce"].as_str().unwrap())
            .unwrap(),
        aad,
        &URL_SAFE_NO_PAD
            .decode(record["recoveryWrap"]["ciphertext"].as_str().unwrap())
            .unwrap(),
    )
    .unwrap();
    let key = SecretKey::from_bytes(&vault_key).unwrap();
    let clear = wimm_client_crypto::decrypt(
        &key,
        &URL_SAFE_NO_PAD
            .decode(record["vault"]["nonce"].as_str().unwrap())
            .unwrap(),
        aad,
        &URL_SAFE_NO_PAD
            .decode(record["vault"]["ciphertext"].as_str().unwrap())
            .unwrap(),
    )
    .unwrap();
    let mut payload: serde_json::Value = serde_json::from_slice(&clear).unwrap();
    let mut private = URL_SAFE_NO_PAD
        .decode(payload["identityPrivateKey"].as_str().unwrap())
        .unwrap();
    private[63] ^= 1;
    payload["identityPrivateKey"] = URL_SAFE_NO_PAD.encode(&private).into();
    let encrypted =
        wimm_client_crypto::encrypt(&key, aad, &serde_json::to_vec(&payload).unwrap()).unwrap();
    record["vault"]["nonce"] = URL_SAFE_NO_PAD.encode(encrypted.nonce).into();
    record["vault"]["ciphertext"] = URL_SAFE_NO_PAD.encode(encrypted.ciphertext).into();
    let bytes = serde_json::to_vec(&record).unwrap();
    assert_eq!(
        vault::unlock_recovery(&bytes, data["recoveryCode"].as_str().unwrap()).err(),
        Some(CryptoError::InvalidInput)
    );
    assert_eq!(
        vault::unlock_passphrase(&bytes, data["password"].as_str().unwrap().as_bytes()).err(),
        Some(CryptoError::InvalidInput)
    );
}
