# DAL03 — Aktueller nativer SQLite-DAL

Stand: 10. Oktober 2026. [#108](https://github.com/mpwg/WiMM/issues/108), [Architekturübersicht #114](https://github.com/mpwg/WiMM/issues/114), [Legacybereinigung #146](https://github.com/mpwg/WiMM/issues/146). Nutzerentscheidung ADR-060: unveröffentlichtes Projekt, keine Altdatenübernahme oder Legacy-Kompatibilität. Frühere V1/V2-/Drei-/Vier-Belege stehen unveränderlich in [1a3ef5a](https://github.com/mpwg/WiMM/blob/1a3ef5a/docs/dal03-native.md); sie sind keine aktuellen Zielkriterien.

## Implementierung

`wimm-local-dal::sqlite::SqliteStore` und `SqliteWriter<V>` bilden den aktuellen ORM-DAL. [Schemaquelle](../crates/local-dal/src/sqlite/schema.rs) erzeugt neue Dateien in einer unmittelbaren SQLite-Transaktion vollständig: neun Tabellen, elf Indizes und zwei Splitreferenztrigger. Physischer Stand fünf, logische Snapshotversion zwei und Fachversion eins werden getrennt gespeichert und geprüft. Keine nachträgliche Receipts-/Indexaktivierung, alten Header, Migrationsjournale oder historische Upgradepfade. Alte Tauri-Migrationskommandos, Rechte und DesktopMigrationPort sind entfernt.

Öffnen verlangt eine existierende Datei und unterstützt ausschließlich diesen aktuellen Stand. Jeder Zugriff vergleicht tatsächliche Tabellen-/Index-/Triggerdefinitionen mit derselben registrierten DSL und prüft Versionsmarker, zulässige Metadaten und die getrennten lokalen/Serverepochen. Ein gleichnamiger manipulierter Index, eine zusätzliche unbekannte Datentabelle oder eine fehlende Epochendimension wird abgewiesen. Kein Löschen, Reparieren, automatischer Umbau oder Backendfallback. Initialisierung einer nichtleeren Datei wird ohne Datenänderung abgewiesen; Abbruch nach tatsächlich ausgeführter DDL rollt sämtliche Tabellen zurück.

Alle elf LocalStoragePort-Methoden und begrenzte Index-, Commit-, Recovery- und Checkpointports verwenden denselben Writer. Batches, CAS/Finanzrevisionsanker, Projektionen, Bestätigungen, Pending und Cursor bleiben atomar und profil-/bereichsgebunden. Snapshot-/Cacheersatz verlangt injizierte tatsächliche Fachkernprüfung. Snapshotversion muss der aktuellen logischen Dateiform entsprechen. Projektionen sind typisiert; keine opake alte Cacheannahme oder Kompatibilitätsexporte. Pendingreihenfolge verwendet ausschließlich das aktuelle createdAt-Feld, keinen alten Datumspfad im Originalentwurf.

Receipts binden den vollständigen Originalauftrag und dieselbe Operationsidentität. Privates Recoveryjournal verwendet save-if-absent und vollständigen Byte-CAS. LocalCheckpointV2 akzeptiert ausschließlich physischen Stand fünf, sichert Bestätigungen, Cursor, historische Operationsreceipts und Recoverybytes und verlangt echte verschlüsselte, authentifiziert und byteidentisch rückgelesene Originale. Verbundener Restore rotiert ausschließlich die lokale Schreibepoche; Serverbestätigungen und Cursor bleiben erhalten. Standalone erzeugt keinen erfundenen Synccursor.

## Tauri und technische Ausnahmen

Produktive Finanz-, Chiffratsicherungs- und Indexkommandos verwenden ORM. Gemeinsame Rust-Modelle übernehmen Backupbelege, Snapshots und Projektionen; keine kopierten DTO-/UUID-/JSON-Adapter. Das frühere rusqlite-Produkt-/Testbackend ist entfernt. rusqlite bleibt ausschließlich ein Testwerkzeug für gezielte Fehler- und Versionsinjektion. Native Runtime verwendet dieselben tatsächlichen SQLite-, Krypto-, Commit- und Recoveryports.

SeaQuery 1.0.2 unterstützt SQLite-Ausdrucksindizes und Trigger/json_each nicht vollständig. Die gekapselten festen Index-/Trigger-DDL-Ausnahmen stammen aus derselben Schemaquelle, erhalten keine Caller-SQLdaten und werden durch echte Abfragen/EXPLAIN geprüft. Verbindungs-PRAGMAs und der native diagnostische Pagergrenzport besitzen keine bindbare Diesel-DDL-Darstellung. Dieser Diagnoseport ist nur mit receipt-probe verfügbar und begrenzt ausschließlich die echte SQLite-Verbindung auf ihre bereits gemessene Dateigröße. Keine eigene Finanzberechnung oder unsafe-Verwendung.

## Kriterienmatrix

| #108-Kriterium nach ADR-060 | Beleg |
| --- | --- |
| Ausschließlich aktuelles vollständiges Schema | Direkte vollständige DSL-Initialisierung; ältere Marker und fehlende/manipulierte Schema-/Epochendimensionen abgewiesen. Nichtleere Datei und DDL-Abbruch bleiben unverändert bzw. vollständig zurückgerollt. |
| Sämtliche lokalen Ports und konsistente Snapshots | Elf Ports nativ und gemeinsamer Tauri-ORM-Katalog auf tatsächlicher SQLite; atomare Syncseiten/Cursor und konsistente Lesetransaktionen. |
| Atomare Batches/CAS/Snapshot-/Projektionsersatz | Echte Rollbacks nach begonnenen Writes, parallele Verbindungen, Finanzrevisionsanker, vollständiger Ausgangsvergleich, Profil-/Bereichstrennung und aktuelle Fachkern-/Cacheprüfung. |
| Geschützter aktueller Checkpoint/Restore | Tatsächliche Sodium-Verschlüsselung und Backupreadback, Scope/Hash/Original-CAS, Abbruch nach Löschung, Receipts/Recovery und lokale/Serverepochentrennung. |
| Reguläre ORM-Abfragen und Rust-DSL | Aktuelle gemeinsame Schemaquelle; drei begrenzte Indexports mit tatsächlichen Queryplänen und atomarer Referenzpflege. Technische Ausnahmen oben begründet. |
| Native Assertions, Neustart, Fehler, Leistung | Tatsächliche Dateien und zusätzliche Childprozesse; aktuelle gemeinsame 50.000-Buchungen-Probe. Echte SQLite-Pagergrenze verhindert großen Write; nach Neuöffnen vollständiges Original und fehlendes Receipt bestätigt, derselbe Auftrag ohne Pagerbegrenzung erfolgreich. |
| Kein zweiter produktiver rusqlite-Pfad | Sämtliche produktiven Tauri-Speichercommands auf ORM; altes Produkt-/Testbackend, alte Migrationscommands und Treiberauswahl entfernt. |

## Aktuelle Prüfung

Aktive Linux-x86_64-Arbeitskopie: Linux 7.2.9-1-cachyos, Rust 1.99.0; gesperrte Diesel 2.3.13/libsqlite3-sys 0.38.2, SQLite 3.53.2. Native DAL-Suite: 40 aktuelle Adapter-Testeinträge, fünf ORM-Backup-, elf Memory- und zehn frühere Receipt-/Checkpoint-Probeeinträge bestanden. Elternprüfungen starten tatsächliche Rust-Childprozesse. Tauri: 14 bestanden, ein absichtlich ignorierter Prozess-Konformitätstreiber. Gemeinsamer aktueller nativer Katalog: 24 Fälle einschließlich echter verschlüsselter Sicherung, Prozessneustart, CAS, Rollback, Profiltrennung, Indexpflege und 50.000 Buchungen. Die sechs reinen historischen nativen Indexmigrationfälle entfallen gemäß Nutzerentscheidung; Finanzorakel bleiben erhalten.

```sh
cargo test --locked -p wimm-local-dal --all-features
cargo test --locked -p wimm-local-contracts
cargo test --locked --manifest-path apps/desktop/src-tauri/Cargo.toml
pnpm test:storage:native
cargo clippy --locked -p wimm-local-dal --all-targets --all-features -- -D warnings
cargo clippy --locked --manifest-path apps/desktop/src-tauri/Cargo.toml --all-targets -- -D warnings
cargo check --locked -p wimm-local-dal --features sqlite --target wasm32-unknown-unknown
pnpm check:contracts:generated
node scripts/test-contract-schema-drift.mjs
pnpm typecheck:contracts
pnpm typecheck
pnpm check:target:architecture
pnpm check:docs
```

Generierte Checkpointschemas aus Rust auf ausschließlich physischen Stand fünf aktualisiert; positive Rust- und negative Altversions-/Driftprüfungen bestanden. Finanz-Goldenkataloge, Bibliotheksversionen, unsafe- und Leistungsgrenzen unverändert.

Aktuelle gemeinsame 50.000-Buchungen-Probe: erste DAO-Seite 21.04 ms; Konto-/Kategorie-/Import-p95 8.94/8.79/8.21 ms. Unveränderte Ergebnisorakel und Grenzen eingehalten.

## Grenzen und Folgearbeit

Tauri-IPC-Prüfung verwendet echte Handler-/Argument-/Capability-Verarbeitung mit MockRuntime; kein GUI-Nachweis. Die begrenzte SQLite-Pagerprüfung ist ein tatsächlicher SQLite-Ressourcenfehler, kein Nachweis einer vollen Betriebssystempartition. Ein solcher Fehler kann die Diesel-Verbindung unbenutzbar machen; Commit bleibt unknown, dauerhafter Zustand wird erst über eine neu geöffnete Verbindung festgestellt. Fehlerhüllen enthalten keine Datenbankdiagnosen oder privaten Originaldaten. DAO-Indexmessungen sind keine native GUI-Kaltöffnung oder gesamte P4-Abnahme; #57/#90 und die vorhandenen Plattformissues bleiben offen.

Die frühen optionalen Receipt-/Checkpointprobes sind keine produktive Backendwahl. Ihre Bereinigung sowie alte Binding-/Vertragsformen bleiben #146; tatsächliche Browser-SQLite und Entfernung des IndexedDB-Vorgängers folgen #109, produktive gemeinsame Commitumschaltung #119. Keine gesamte Legacy-/Browser-/Produkt-/Plattformabnahme aus DAL03.
