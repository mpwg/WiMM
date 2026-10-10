# Rust-Clientkryptografie — Machbarkeitsabschnitt

SPDX-License-Identifier: AGPL-3.0-or-later

AR08 [#122](https://github.com/mpwg/WiMM/issues/122), Stand 10. Oktober 2026. Gemeinsame Rust-Schlüssel-/Sperr-/AEAD-Grenze, nativ mit libsodium-rs 0.2.5 und im Browser mit der vorhandenen libsodium-wrappers-sumo 0.8.4 über wasm-bindgen 0.2.129. Beide Adapter verwenden libsodium, keinen eigenen Cipher und keinen RustCrypto-/WASI-/Memoryfallback. Die PWA bleibt auf wasm32-unknown-unknown. Safe Rust-API nativ und etablierte JS-Importbindung im Browser; unsafe ausschließlich in erhaltenen Fremdbindings, eigenes Compiler-/Cargoverbot unverändert.

SecretKey besitzt einen nicht serialisierbaren, nicht klonbaren Zeroizing-Puffer und redigierten Debug. Lock löscht den eigenen Schlüssel und blockiert weitere Operationen; Drop löscht den Puffer ebenfalls. Native libsodium-Schlüsselkopien verwenden die ZeroizeOnDrop-Typen des Fremdbindings. Der JS-Adapter kopiert eine geliehene Rust-Keyview vor dem Primitivaufruf und löscht ausschließlich diese temporäre Kopie. Er darf die Rust-Keyview nicht verändern. Rückgegebene temporäre JS-Klartext-/Zufallsbytes werden nach Kopieren nach Rust gelöscht. Externe Caller-Kopien, JS-Ausgabe und Register/Stacks liegen außerhalb einer garantierbaren vollständigen Speicherlöschung; vertrauenswürdige Laufzeit gemäß [E2EE](../../docs/encryption.md), keine Zusage gegen kompromittierte Clients.

Neue Verschlüsselungen erzeugen ihre Nonce immer über libsodium-CSPRNG. Deterministische Verschlüsselung mit vorgegebener Nonce dient ausschließlich festgeschriebenen Testvektoren; der WASM-Einstieg encrypt_fixed existiert nur mit contract-probe. Die Produktions-Session exportiert encrypt mit zufälliger Nonce, decrypt und lock, keinen privaten Schlüsselgetter. Rust-Fehler sind typisiert/statisch; die WASM-Hülle enthält ausschließlich Bindingversion 2 und stabile Codes ohne Eingaben oder Fremddiagnosen.

```sh
pnpm test:crypto:rust
cargo clippy --locked -p wimm-client-crypto -p wimm-public-crypto --all-targets -- -D warnings
cargo clippy --locked -p wimm-client-crypto --target wasm32-unknown-unknown --features contract-probe -- -D warnings
```

Der vorhandene synthetische C-XChaCha20-Vektor aus packages/crypto wird unverändert direkt nativ in Rust und in tatsächlichem Rust/WASM unter Node/Chromium geprüft. Noncefrische, Chiffrat-/AAD-/Noncetampering, Schlüssel-/Sperrfehler und Nichtveränderung der externen Caller-Keykopie geprüft. Zwei native Rusttests; ein tatsächlicher Chromiumfall ergänzt die Nodeprüfung. Versionierte Machbarkeitssignaturen entstehen mit dem vorhandenen Rust-WASM-Generator; Prüfbefehl vergleicht ohne Umschreiben. Root-Entwicklungsdependency verwendet exakt die bereits vorhandene JS-Bindingversion für Auflösung der generierten lokalen Testsnippets, keine zusätzliche Fremdversion.

[Herkunft/Lizenzen](../../docs/dependency-provenance/rust-crypto.json) erfasst 34 neue gesperrte Fremdpakete einschließlich Buildabhängigkeiten und Original-Lizenztexte. Sämtliche vorher gesperrten Rust-/pnpm-Versionen erhalten. Native Sys-Bindung 1.24.0 verwendet das im Crate enthaltene signaturgeprüfte libsodium-Archiv; fetch-latest ist nicht aktiviert. System-libsodium 1.0.22 ist vorhanden, der Nachweis verwendet den standardmäßig gebündelten Build.

Dieser abgeschlossene Abschnitt ist keine AR08-Gesamtabnahme oder produktive Tresorumstellung. Ed25519-Signieren/Schlüsselpaare, X25519/sealed boxes, Argon2id, Legacy-/Recovery-/Exportvergleich und vollständige native/WASM-Tamperingmatrix folgen vor Schließung von #122. Keine neue Suite, Domain-Separator-/KDF-/Hüllen-/Exportversion und kein Geräte-/Server-/P6–P11-/Release-/Auditnachweis.
