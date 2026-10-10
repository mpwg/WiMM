# Öffentliche Rust-Verträge

SPDX-License-Identifier: AGPL-3.0-or-later

Gemeinsame öffentliche V1-Operationen, Header, read/write-Handles, signierte Roster, Rollen und öffentliche Fehlerformen. Die Standard-Abhängigkeit enthält nur neutrale Vertragsprimitive, neutrale Persistenzverträge und Serde; keine privaten Fachmodelle, Fachhandler, Finanzklartext-/Schlüsselfelder, UI, HTTP oder ORM. Compiler- und Cargo-unsafe-Verbot bleiben verbindlich.

Eine Recorddeklaration erzeugt die Serde-/Schemars-/UniFFI-/Tsify-Feldformen. Der daraus erzeugte Deserialisierungsrecord prüft anschließend dieselben öffentlichen Revisions-/Rosterzusammenhänge wie die typisierten Formeinstiege. Revisionsnachfolger werden über i128 verglichen, damit auch die obere sichere Grenze keinen Zwischenüberlauf erzeugt. Protokollversion eins, Suite, Listen-/Base64-/Null-/Abwesenheitsgrenzen und bisherige öffentliche Max-UUID-Schreibweise bleiben erhalten. Keine neue Kryptografie, Authentifizierung, Rollenfreigabe oder Transportumschaltung.

Standard-JSON-Schema beschreibt strukturelle Formen und kann die arithmetische Beziehung proposedRevision = expectedRevision + 1 nicht allein ausdrücken. Der Exportmanifest verlangt deshalb zusätzlich den bereitgestellten Rust-Guard. Serde führt diesen automatisch aus; die native/WASM-Form-API ebenfalls. Die Schemas allein dürfen nicht als vollständiger öffentlicher Validator verwendet werden. Fünf absichtlich strukturkonforme, relational ungültige Katalogfälle belegen diese Grenze. Der bisherige Zod-Produktvalidator bleibt erhalten.

`validate_public_operation_form_v2` und `validate_public_roster_form_v2` liefern Bindingversion zwei und status formValid oder einen typisierten versionierten Formfehler. Das ist ausdrücklich keine Signatur-/Sitzungs-/Berechtigungs-/E2EE-Abnahme. Die native Clientbibliothek hält die dünnen Brücken; die unabhängige öffentliche WASM-Bibliothek enthält ausschließlich öffentliche Modelle und dieselben Guards. Sprachdateien und 16 Standard-Formschemas liegen getrennt unter [public-v2](../../packages/contracts/generated/public-v2/README.md).

```sh
cargo test --locked -p wimm-public-contracts
pnpm test:contracts:public
pnpm test:contracts:public:native
pnpm check:core
```

42 gemeinsame synthetische positive/negative Formorakel vergleichen Bestands-Zod, native Rust-Assertions, tatsächliches unabhängiges WASM/Node und Chromium. Swift/Kotlin vergleichen dieselben 42 Orakel einschließlich 33 vorgeschalteter Formablehnungen und neun typisierter gültiger API-Aufrufe; acht weitere Fälle ändern echte Sprachobjekte direkt und prüfen strukturierte Fehler. 17 tatsächliche native API-Aufrufe insgesamt, keine JSON-Fachausführung oder Sprachmocks. Nur synthetische Nonce-/Chiffrat-/Signaturzeichenketten: echte Kryptografienachweise stehen getrennt in der AR08-Abnahme.

`contract-schema`, `native-bindings` und `wasm-bindings` sind optionale vorhandene Generatoren mit unverändert gesperrten Versionen. Das normale Generierungsprüfskript prüft beide Vertragsmodule ohne Umschreiben. Die vollständige AR02-Vertragsabnahme ist in [#116](https://github.com/mpwg/WiMM/issues/116) abgeschlossen; produktive Umschaltung bleibt getrennt.

DAL02 ergänzt `storage_port.rs`: konkrete öffentliche Ciphertext-/Verwaltungsdatenmethoden im selben Transaktionskontext und strukturierte Persistenzfehler. Kein SQL-/Verbindungsobjekt oder privater Abhängigkeitsabschluss im Port. Native Fehlerformguards und negative Architekturprüfungen sichern die Trennung; [DAL02-Matrix](../../docs/dal02-contracts.md). Dieser Crate implementiert weder einen Server noch einen SQLadapter.
