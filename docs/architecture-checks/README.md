# Negative Architektur- und Abnahmegrenzen

SPDX-License-Identifier: AGPL-3.0-or-later

AR11 [#125](https://github.com/mpwg/WiMM/issues/125), Voraussetzung [AR02](../ar02-contract-generation.md) erfüllt. Die [Architektur](../architecture.md) ist verbindlich; [policy.json](policy.json) katalogisiert tatsächlich vorhandene Rust-Rollen/Features, zulässige Übergangskanten und gesperrte Contractinventare. [evidence.json](evidence.json) hält ausschließlich den getrennten Nachweistyp fest, keine zweite Deltaliste oder automatisch grüne Produktabnahme. Fortschritt und aktueller Abschluss in GitHub; Auftragsfreigabe ausschließlich [tasks.md](../tasks.md).

## Erzwungene Grenzen

Der Prüfmodus liest Cargo-Metadaten des Root-Workspaces und des separaten Tauri-Crates. Sämtliche lokalen Pfadpakete innerhalb der aktiven Arbeitskopie benötigen eine katalogisierte Rolle, bekannte Featureliste und native Assertions. Die beiden schon im Reviewstand 84d730c vorhandenen reinen Generatorwrapper ohne eigene Fachlogik sind ausdrücklich als historische Ausnahmen registriert; dies erlaubt keine Ausnahme für neue Crates. Compiler- und Cargo-unsafe-Sperren bleiben zusätzlich überall Pflicht, einschließlich Buildscripts und Tauri.

Für reine Primitive, private/öffentliche/lokale Datenquellen und Fachkern gelten transitive Verbote, nicht bloß direkte Dependencylisten. Cargo-normal-Abschlüsse werden für sämtliche Targets in Default- und Allfeaturekonfiguration geprüft. Optionale Datenbindings erlauben gezielt UniFFI/Tsify/WASM; reine Standardabschlüsse bleiben ohne Plattformruntime. Öffentliche Datenquellen importieren keine privaten Modelle; lokale Datenquellen/DAL enthalten keine Fachhandler. Die Fachkern-/Daten-/Bindingrollen dürfen keine ORM-/UI-/HTTP-Runtime enthalten.

Für spätere Client-/DAL-/Krypto-/Serverrollen sind Abhängigkeiten katalogisiert. Neue Crates werden vor Registrierung abgewiesen; bei tatsächlichen Server-/HTTP-Wurzeln wird der komplette normale Allfeatureabschluss auf privaten Finanzkern, lokale Clientverträge und Privatkrypto geprüft. Registrierte eigenständige Server-/HTTP-Binaries müssen einen Binarytarget besitzen. Die Zielservercrates sind noch nicht implementiert: Negativfixtures prüfen die Grenze, keine behauptete Serverbinary-/HTTP-/SQL-Abnahme aus diesen Fixtures.

Der etablierte Babel-Parser trennt Runtime- von Typimports. Neue UI-Fach-/Speicher-/Privatkryptokanten, relative Umgehungsimporte, unauflösbare dynamische Imports und Arithmetik an benannten Geld-/Betrags-/Saldo-/Budgetfeldern einschließlich davon abgeleiteter lokaler Variablen werden abgewiesen. Bestehende UI-/Plattformkanten und reine Geldformatierung sind exakt nach Datei, Symbolen und Ausdruck katalogisiert. Zusätzliche Symbole, Ausdrücke oder Kopien erhalten keine pauschale Altfreigabe. Das ist eine begrenzte Übergangssperre bis AR06; die vorhandene TS-Anwendung wird hier nicht vorzeitig ersetzt. Keine Behauptung eines vollständigen semantischen Beweises beliebig umbenannter Algorithmen allein durch statische AST-Prüfung; Fachassertions und Review bleiben erforderlich.

Sechs unveränderte Golden-/Formkataloge werden auf Anzahl und SHA256 geprüft. Der persistierte K04-Katalog enthält 479 Fälle, der getrennte Generatorfehlerkatalog zehn weitere: 489 tatsächliche V1-Laufzeitfälle. Auslassung, Duplikat statt Originalfall, geänderte Ergebnisform und Quellen-/Generierungsdrift dürfen nicht durch einen automatisch aktualisierten Golden ersetzt werden. Die vorhandenen privaten/öffentlichen/lokalen Driftprüfungen bleiben in der strengen CI-Kette; native Rust-Assertions und tatsächliche WASM-/SQLite-Prüfungen ersetzen einander nicht.

## Nachweise bleiben getrennt

Lokale SQLite nativ und echte SQLite/WASM-Persistenz in Chromium/Firefox/WebKit haben getrennte historische Commits/Befehle. IndexedDB-/Frontendprüfungen sind Bestandsnachweise, kein Browser-SQLite-Ersatz. PostgreSQL-/MySQL-Treiberbuilds sind keine ausgeführte Server-SQLkonformität; alle drei Serveradapter bleiben in ihren eigenen Issues offen. Runtimekind/Backend müssen zur Matrixspalte passen; SQLite darf nicht als PostgreSQL/MySQL umetikettiert werden. Mock-/Fallback-/Frontend-/Compilebelege dürfen keinen verifizierten Datenbankstatus erzeugen.

Native GUI, Screenreader und physische iOS-PWA bleiben ausdrücklich offen. Ein CI-Status kann diese manuellen Kriterien nicht auf verified setzen. Die Matrix bezeichnet historische Belege ausdrücklich historisch; sie beansprucht keine aktuelle neue Maschinenabnahme. Ein grüner Architekturcheck schließt weder #114 noch die offenen DAL-/K-/P4-/P5-Kriterien.

## Reproduzierbare Prüfung

```sh
pnpm check:target:architecture
pnpm test:target:architecture
pnpm check:core
pnpm check:contracts:generated
```

41 positive/negative Validatorfälle prüfen Runtime-/Typimports, neue UI-Facharithmetik, transitive ORM-/Server-/Privatkryptokanten, compiler-/Cargo-unsafe-Abschwächung, ausgelassene/veränderte Contractorakel und getrennte Matrixzustände. Zusätzlich wird eine neue synthetische UI-Fachquelle tatsächlich in der aktiven Arbeitskopie injiziert: dasselbe reguläre Prüfkommando muss fehlschlagen, die Policybytes bleiben unverändert. Quelle im finally-Block entfernt; danach muss derselbe Prüfmodus wieder bestehen. Keine bestehende Quelle oder Goldenfixture wird für diesen Negativlauf umgeschrieben.

Der native Assert-Runner führt cargo test --locked für jede registrierte Quelle mit Assertpflicht tatsächlich aus und verlangt mindestens einen bestandenen nativen Test; null bestandene oder ausschließlich ignorierte Tests scheitern. Ergebnisse in test-results/architecture-checks/native-assertions.json, keine Umdeutung bloßer Testquelltexte in Laufzeitbelege. Alle Prüfungen sind in check:all/check:ci integriert; der separate tatsächliche DAL01-CI-Job bleibt unverändert. Neue native Assertions im gemeinsamen Primitivecrate prüfen Nil-/Max-/RFC-UUIDs und die unterschiedliche öffentliche/private Max-UUID-Policy sowie sichere signed/unsigned Ganzzahlgrenzen, Brüche und nichtfinite Float-Grenzwerte. Diese Floating-Visitorprüfungen sind keine Geldberechnung mit Float. Bestehende Finanz-/Binding-/Schema-/Speicherregeln bleiben erhalten.

## Abnahmesnapshot vom 9. Oktober 2026

Aktive CachyOS Linux x86_64-Arbeitskopie, dokumentierte gesperrte Toolchain. 41 Validatorfälle, tatsächlicher CLI-UI-Injektionslauf und 74 bestandene native Rusttests über zehn Pflichtcrates erfolgreich. Zwei vorher vorhandene Generatorwrapper bleiben ausdrücklich historisch ausgenommen; keine neue Assertbefreiung. pnpm check:core, check:contracts:generated, Paketgraph/elf Tests, Typecheck/Lint, Dokumentationsvalidator/drei Tests und Whitespace grün. Logs ar11-*.log und tatsächliche native Resultate unter ignoriertem test-results. Keine neue Fremdversion, kein veränderter Golden und keine Produkt-/Storage-/Cryptoformatänderung. Schlusscommit und rückgelesener COMPLETED-Zustand in #125. Die offenen Server-/manuellen Matrixfelder bleiben unverändert offen.
