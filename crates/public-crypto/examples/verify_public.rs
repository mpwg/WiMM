// SPDX-License-Identifier: AGPL-3.0-or-later
#![forbid(unsafe_code)]
fn main() {
    assert!(!wimm_public_crypto::verify_ed25519(
        b"synthetisch",
        &[],
        &[]
    ));
    println!("Öffentlicher Signaturprüfer ohne Client-/Tresor-API ausgeführt.");
}
