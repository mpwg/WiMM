# Rust-Vertragsschemas

SPDX-License-Identifier: AGPL-3.0-or-later

AR02-Schemawerkzeug für [#116](https://github.com/mpwg/WiMM/issues/116). Schemars 1.2.2 erzeugt die privaten Aggregat-/Befehls-/Requestschemaformen unmittelbar aus [wimm-finance-types](../../crates/finance-types/README.md) und dessen Serde-Metadaten, ohne Fachhandlerabhängigkeit. Das optionale Feature `contract-schema` ist eine plattformfreie Entwicklungsabhängigkeit; der Kern reexportiert den bisherigen Schemapfad, produktive native/WASM-Bindings benötigen dieses Feature nicht. Eigener Werkzeugcode bleibt unsafe-frei und erbt die Workspace-Sperre.

```sh
cargo run --locked -p wimm-contract-schema -- --write test-results/architecture-implementation/schema-proof
cargo run --locked -p wimm-contract-schema -- --check test-results/architecture-implementation/schema-proof
cargo test --locked -p wimm-contract-schema
cargo test --locked -p wimm-finance-types --features contract-schema schema::tests
```

`--write` erzeugt die drei privaten Prototypformen, zehn zusätzliche V2-Request-/Ergebnis-/Fehlerschemas und ein Exportmanifest im ausdrücklich benannten Verzeichnis. `--check` vergleicht exakte reproduzierte Inhalte ohne Dateien zu überschreiben; fehlende, zusätzliche JSON-Dateien oder geänderte Dateien führen zu einem Fehlerstatus. Ohne Argumente wird der Export auf stdout angezeigt. Es wird kein Produktbestand geöffnet, geschrieben oder migriert.

Geprüft: deterministische Generierung, bestehende Serde-Feldnamen/Tags, ausgeschlossene Zusatzfelder, sichere Ganzzahlgrenzen, optionale nichtnullable Felder und erforderliches nullable Importkandidatenfeld. Der Werkzeugtest verändert ausschließlich eine eigene synthetische Schemafixture und belegt Driftablehnung ohne Reparatur. Die Nutzerentscheidung B ist in ADR-053 festgehalten: typisierte UniFFI-/WASM-APIs mit Bindingversion 2 und V1-Kompatibilitätsadapter. Alle fünf bestehenden Engineaktionen sind inzwischen typisiert gebunden; die zehn V2-Schemas und manifest.json beschreiben ihre Requests, vollständigen Ergebnisse und gemeinsamen versionierten Fehler. Versionskonstanten liegen in derselben privaten Rust-Typquelle und begrenzen alle entsprechenden Headerfelder. Öffentliche/lokale Module, weitere Kompatibilitätsformen und vollständige Schema-/Sprachabnahme bleiben innerhalb #116 offen. Die bisherigen JSON-Einstiege bleiben erhalten.

Schemars berücksichtigt Serde-Tags und Feldattribute; Formgrenzen für geprüfte Skalare bleiben aus Rusttypen und gemeinsamen Konstanten beschrieben. [Offizielle Schemars-Attribute](https://graham.cool/schemars/deriving/attributes/). [Auftrag](../../docs/tasks.md), [Architektur](../../docs/architecture.md). Projektlizenz bleibt AGPL-3.0-or-later; Schemars und Fremdhinweise behalten ihre ursprünglichen Lizenzen.


`pnpm generate:contracts:bindings` versioniert auch die Schemaausgaben; der Prüfmodus erkennt Sprach- und Schemadrift gemeinsam. `pnpm test:contracts:schema` vergleicht 380 unveränderte produktive Katalogformen und 44 eindeutige Zusatzformen zwischen tatsächlichem Rust-Serde und Ajv2020. Tatsächliche WASM-Resultate entsprechen zusätzlich den unveränderten Fachorakeln und den Ergebnis-/Fehlerschemas. 354 Katalogformen werden angenommen, 26 bereits vor Fachausführung abgewiesen. Der rein technische `--probe-private-v2`-STDIN-Modus liest synthetische action/request-Zeilen, deserialisiert unmittelbar dieselben Rust-Modelle und gibt ausschließlich valid-Booleans aus; keine Fachhandler oder Originalpayloadausgabe.

Die negative CI-Prüfung ändert vorübergehend die eigene Rust-Bindingversionskonstante, fordert Driftablehnung ohne Umschreiben und stellt die Quelle im finally-Block wieder her. Danach muss derselbe Prüfmodus bestehen und sämtliche versionierten Hashes unverändert sein. Native Rust-Assertions prüfen Katalogformzahlen, Ganzzahlnotation ohne Stringcoercion und Dateidrift. Ajv 8.20.0/ajv-formats 3.0.1 sind unveränderte bereits gesperrte transitive Versionen, jetzt für diese zusätzliche Abnahme direkt referenziert; [Herkunft und Original-MIT-Lizenzen](../../docs/dependency-provenance/private-schema-validation.json).

Im tatsächlichen Negativvergleich gefunden und korrigiert: date-time-Formatvalidatoren erlauben RFC-Schaltsekunden, der bestehende UTC-Fachvertrag erlaubt Sekunden nur 00–59. Die Rust-Schemabeschreibung begrenzt jetzt Stunden/Minuten/Sekunden zusätzlich zum Kalenderformat. Keine Änderung der UTC-Fachprüfung oder Goldenfälle; der ausdrücklich geprüfte Fall 23:59:60Z bleibt abgewiesen.


Öffentliche Quelle separat: `--public --write|--check VERZEICHNIS` exportiert sieben Struktur-/Fehlerschemas und einen Manifest aus wimm-public-contracts. `--probe-public-v2` deserialisiert dieselben öffentlichen Hüllen einschließlich der verpflichtenden relationalen Rust-Guards und gibt nur synthetische valid-Booleans aus. Der öffentliche Standardcrate hat keine private Fachabhängigkeit. Die normale Generierung prüft beide Module; `pnpm test:contracts:public` belegt 42 gemeinsame Zod-/Rust-/WASM-/Browserformen und einen echten öffentlichen Quellendrift-Negativlauf. Genauere Grenzen, insbesondere Standardschema plus relationaler Guard, im [öffentlichen README](../../crates/public-contracts/README.md).

Lokaler Metadatenmodus: `--local --write|--check VERZEICHNIS` erzeugt sieben lokale Struktur-/Fehlerformen und einen Manifest. `--probe-local-v2` prüft synthetische Migrationspläne einschließlich relationaler Rust-Guards ohne Speicherport. Lokale Snapshot-/Kompatibilitätsformen noch offen; [lokaler README](../../crates/local-contracts/README.md).
