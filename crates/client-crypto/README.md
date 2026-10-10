# Rust-Clientkryptografie

SPDX-License-Identifier: AGPL-3.0-or-later

## Historischer Machbarkeitsabschnitt 7f560d9

AR08 [#122](https://github.com/mpwg/WiMM/issues/122), Stand 10. Oktober 2026. Gemeinsame Rust-Schlüssel-/Sperr-/AEAD-Grenze, nativ mit libsodium-rs 0.2.5 und im Browser mit der vorhandenen libsodium-wrappers-sumo 0.8.4 über wasm-bindgen 0.2.129. Beide Adapter verwenden libsodium, keinen eigenen Cipher und keinen RustCrypto-/WASI-/Memoryfallback. Die PWA bleibt auf wasm32-unknown-unknown. Safe Rust-API nativ und etablierte JS-Importbindung im Browser; unsafe ausschließlich in erhaltenen Fremdbindings, eigenes Compiler-/Cargoverbot unverändert.

SecretKey besitzt einen nicht serialisierbaren, nicht klonbaren Zeroizing-Puffer und redigierten Debug. Lock löscht den eigenen Schlüssel und blockiert weitere Operationen; Drop löscht den Puffer ebenfalls. Native libsodium-Schlüsselkopien verwenden die ZeroizeOnDrop-Typen des Fremdbindings. Der JS-Adapter kopiert eine geliehene Rust-Keyview vor dem Primitivaufruf und löscht ausschließlich diese temporäre Kopie. Er darf die Rust-Keyview nicht verändern. Rückgegebene temporäre JS-Klartext-/Zufallsbytes werden nach Kopieren nach Rust gelöscht. Externe Caller-Kopien, JS-Ausgabe und Register/Stacks liegen außerhalb einer garantierbaren vollständigen Speicherlöschung; vertrauenswürdige Laufzeit gemäß [E2EE](../../docs/encryption.md), keine Zusage gegen kompromittierte Clients.

Neue Verschlüsselungen erzeugen ihre Nonce immer über libsodium-CSPRNG. Deterministische Verschlüsselung mit vorgegebener Nonce dient ausschließlich festgeschriebenen Testvektoren; der WASM-Einstieg encrypt_fixed existiert nur mit contract-probe. Die Produktions-Session exportiert encrypt mit zufälliger Nonce, decrypt und lock, keinen privaten Schlüsselgetter. Rust-Fehler sind typisiert/statisch; die WASM-Hülle enthält ausschließlich Bindingversion 2 und stabile Codes ohne Eingaben oder Fremddiagnosen.

```sh
pnpm test:crypto:rust
cargo clippy --locked -p wimm-client-crypto -p wimm-public-crypto --all-targets -- -D warnings
cargo clippy --locked -p wimm-client-crypto --target wasm32-unknown-unknown --features contract-probe -- -D warnings
```

Der vorhandene synthetische C-XChaCha20-Vektor aus packages/crypto wird unverändert direkt nativ in Rust und in tatsächlichem Rust/WASM unter Node/Chromium geprüft. Noncefrische, Chiffrat-/AAD-/Noncetampering, Schlüssel-/Sperrfehler und Nichtveränderung der externen Caller-Keykopie geprüft. Zwei native Rusttests; ein tatsächlicher Chromiumfall ergänzt die Nodeprüfung. Versionierte Machbarkeitssignaturen entstehen mit dem vorhandenen Rust-WASM-Generator; Prüfbefehl vergleicht ohne Umschreiben. Root-Entwicklungsdependency verwendet exakt die bereits vorhandene JS-Bindingversion für Auflösung der generierten lokalen Testsnippets, keine zusätzliche Fremdversion.

[Herkunft/Lizenzen](../../docs/dependency-provenance/rust-crypto.json) erfasst 36 neue gesperrte Fremdpakete einschließlich Buildabhängigkeiten und Original-Lizenztexte. Sämtliche vorher gesperrten Rust-/pnpm-Versionen erhalten. Native Sys-Bindung 1.24.0 verwendet das im Crate enthaltene signaturgeprüfte libsodium-Archiv; fetch-latest ist nicht aktiviert. System-libsodium 1.0.22 ist vorhanden, der Nachweis verwendet den standardmäßig gebündelten Build.

Der historische Machbarkeitsabschnitt war keine AR08-Gesamtabnahme oder produktive Tresorumstellung. Ed25519-Signieren/Schlüsselpaare, X25519/sealed boxes, Argon2id, Legacy-/Recovery-/Exportvergleich und vollständige native/WASM-Tamperingmatrix folgen vor Schließung von #122. Keine neue Suite, Domain-Separator-/KDF-/Hüllen-/Exportversion und kein Geräte-/Server-/P6–P11-/Release-/Auditnachweis.

## Vollständiger AR08-Portabschnitt

Signieren, X25519/sealed boxes, Argon2id und öffentliche Signaturprüfung haben gemeinsame Rust-Einstiege und echte native/WASM-Adapter. Private Identitäts-/Boxschlüssel sind nicht serialisierbare eigene Sitzungstypen mit Löschung/Sperre. Mathematische Paarprüfung rekonstruiert Ed25519 einschließlich privatem öffentlichem Suffix und X25519 über libsodium; beschädigte authentisch verschlüsselte Tresore werden vor Freigabe abgewiesen.

Rust liest die unveränderten bestehenden verschlüsselten UserVault-Hüllen einschließlich Legacy 2/64 MiB und V2 3/64 MiB, unterstützt Recovery und erzeugt kompatible neue V2-Tresore. Unbekannte Versionen, nullable optionale Header und KDFgrenzen scheitern vor Ableitung ohne Legacyfallback. Private entschlüsselte JSONbytes und Schlüsselstrings verwenden Zeroizing; temporäre Parser-/Caller-/JS-Stringkopien sind keine garantiert geschützte Laufzeit. Passphraseumverpackung liefert nur einen neuen verschlüsselten Datensatz, erhält vorhandene Vault-/Recoveryhüllen und führt keinen Profilwrite aus. Atomare Freigabe/Schema-/Profil-CAS bleibt Aufgabe der Anwendung.

Die bisherigen verschlüsselten P3-JSON-Snapshot-/Bereichsexporte sind nativ/WASM/TS in beiden Richtungen geprüft. Dies implementiert keine zusätzliche P10-WIMMENC1-/ZIP-Produktoberfläche oder P10-Gesamtabnahme. Bestandsdelta [#132](https://github.com/mpwg/WiMM/issues/132) ergänzt die bisher fehlende Snapshot-Hüllenversionprüfung; gültige Version-1-Bytes unverändert. RFC8785 nutzt serde_json_canonicalizer 0.3.2 und wird mit vorhandener canonicalize-Bibliothek für Unicode/UTF16-Sortierung, Zahlen und Arrays verglichen. Fünf feste Domain-Separatoren zentral in der öffentlichen Rust-Quelle, keine Format-/Suite-/Transportversionsänderung.

Abschließende Prüfung: pnpm test:crypto:rust führt native Assertions, tatsächliches Node-WASM und drei Chromiumfälle aus. Je 17 Signatur-/Box-/KDF-/JCS- und 16 aktuelle/Legacy-/Recovery-/Exportvergleichsfälle; Basisspec ergänzt festen C-XChaCha20-Vektor, neue Nonces, Tampering und Lock. Rust-Assertions ergänzen die Sprachfälle: native KDF-Vektoren, feste Signatur-/Ciphervektoren, beide Tresorwege, authentische semantische Schlüsselkorruption, Export und Sperre. Generatorprüfmodus vergleicht die actual Rust-WASM-Signaturen ohne Umschreiben. In check:all/check:ci integriert. Keine GUI-/Geräte-/gesamte Server-/Produkt-/Release-/externes Auditabnahme aus diesen Portbelegen.

## Kriterienmatrix und aktueller Abschluss

| Kriterium aus #122 | Status/Nachweis |
| --- | --- |
| Native/WASM-Interop, C-Vektoren, Tampering, Empfänger, Paare, Legacy/Recovery/Export | erfüllt: direkte Rust-Assertions und tatsächliche Node-/Chromium-Rust-WASM-Vergleiche gegen bestehendes TS |
| Kein eigenes unsafe/FFI/Cipher, globale Sperren | erfüllt: native/WASM-Clippy -D warnings, Workspace-/Target-/Cargoprüfungen; ausschließlich safe Fremd-API/wasm-bindgen |
| Öffentlicher zulässiger Abschluss ohne eigene private Client-/Tresorfunktion, keine Schlüssel in Diagnosen | erfüllt: separate verify-only-API, Cargoabschluss/kompiliertes öffentliches Beispiel; Redaktion/Löschung/static Fehler geprüft |
| Bindingeignung belegt, kein stiller Ersatz | erfüllt: native libsodium und tatsächlicher Browser-WASM-Backend hinter denselben Rust-Ports, kein Wechsel auf WASI/RustCrypto |

Aktiver Nachweis auf CachyOS Linux x86_64 am 10. Oktober 2026. Native Crypto-Suite: elf tatsächliche Rusttests über Client/public einschließlich aktueller und Legacy-TS-Goldenorakel; tatsächliche Node-/Chromium-WASM-Suite wie oben. Bestehende TS-Cryptosuite 25 Tests grün. P3-JSON-Snapshotabnahme ersetzt keine P10-Produktfunktion; laufende Server-/Geräte-/Release-/Protokollauditkriterien bleiben getrennt. Abschlusscommit und rückgelesene Issuezustände in #122/#132.
