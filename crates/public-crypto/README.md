# Öffentliche Rust-Signaturprüfung

SPDX-License-Identifier: AGPL-3.0-or-later

AR08 [#122](https://github.com/mpwg/WiMM/issues/122), Portabnahme vom 10. Oktober 2026. Die öffentliche eigene API bietet ausschließlich verify_ed25519(message, signature, public_key). Kein privater Schlüsselparameter, Signieren, Entschlüsseln, Tresor, Finanzmodell oder Clientkryptografiecrate. Ungültige Signaturen/Formen liefern false, keine Originaldiagnosen. Separate öffentliche Cargoquelle; negativer Server-/Privatabschluss aus AR11 bleibt aktiv.

Native direkte Rust-Assertion prüft den unveränderten synthetischen C-Signaturvektor aus packages/crypto sowie veränderte Nachricht/Signatur und falsche Bytegrößen. `cargo test --locked -p wimm-public-crypto`. Die Fremdprimitive kommen aus libsodium-rs 0.2.5/libsodium-sys-stable 1.24.0; deren allgemeine libsodium-Primitiven sind keine eigene private Client-/Tresor-API. Dieser Abschnitt behauptet weder einen implementierten Server noch die physische Abwesenheit sämtlicher generischer Cipherfunktionen im Fremdlibsodium-Archiv. Öffentliche eigene Abhängigkeits-/APItrennung und tatsächlicher Serverbinaryabschluss bleiben getrennte Nachweise.

Die öffentliche Quelle enthält außerdem die fünf vorhandenen Domain-Separatoren und RFC8785-Kanonisierung über serde_json_canonicalizer 0.3.2. WASM verwendet dieselbe verify-only-Grenze via vorhandener libsodium-Bindung; kein private Schlüsselparameter oder Tresor. Das eigenständige Beispiel verify_public wird tatsächlich kompiliert/ausgeführt, normaler Cargoabschluss ohne eigene Client-/Tresor-/Finanzcrates geprüft. Noch keine vollständige Rust-Serveranwendung; deren eigene Abnahme folgt separat.
