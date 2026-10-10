# AR04 — Dauerhafte lokale Commitreceipts

Stand: 10. Oktober 2026. [AR04 #118](https://github.com/mpwg/WiMM/issues/118) vollständig als Commit-/Receipt-/Sicherungsabschnitt abgenommen und als COMPLETED geschlossen, Beschreibung/Schließungsgrund rückgelesen, auf [290f6e3](https://github.com/mpwg/WiMM/commit/290f6e3c74e2068adf70b4735dc72a88ecf6de62). Voraussetzungen #116/#117/#107 erfüllt. [Verträge](core-contracts.md), ADR-055 in [Entscheidungen](decisions.md), [Adapter-README](../crates/local-dal/README.md).

## Kriterienmatrix

| Kriterium #118 | Tatsächliche Umsetzung und Abnahme |
| --- | --- |
| Antwortverlust/Prozessneustart: genau ein Write und ursprüngliches Ergebnis | Profil-/Bereichs-/Epochenschlüssel und vollständiger Requestinhalt binden das Receipt. Aggregate, Originaloutbox, vorbereitete Projektionen und Receipt in derselben unmittelbaren SQLite-Transaktion. Native CLI-Prozessneustart und vollständige Browserprozessneustarts finden dasselbe Receipt; identische Wiederholung erhöht keine Revision und verdoppelt weder Outbox noch Projektionen |
| Inhaltsabweichung, Scope und Rollback | Andere Inhalte derselben Identität -> OPERATION_ID_REUSED. CAS und Profil-/Bereichs-/Epochenbindung, Originaldrafts und vollständiger vierteiliger Rollback tatsächlich geprüft. Beschädigtes bekanntes Receipt ergibt unknown, keinen Wiederholungswrite und keine falsche notCommitted-Antwort |
| Commitgewissheit und verspäteter Abbruch | CancellableLocalCommitPort für Memory/SQLite. Beobachter ausschließlich im synthetischen Prüffeature an tatsächlichen Transaktionsgrenzen. Abbruch vor COMMIT -> notCommitted/CANCELLED und Rollback; nach tatsächlichem COMMIT -> committed. Bekannte identische Wiederholung bleibt trotz Abbruchsignal bestätigt; verlorene Zustellung bleibt unknown und verlangt Ergebnisabfrage |
| Registriertes gesichertes kompatibles Schema, native/Browserkonformität | Öffnen erzeugt/migriert kein Schema. Registrierte Initialerzeugung eins nur in leerer DB; vorhandene fremde Tabellen/unsupported Journale bleiben geschützt. Neue versionierte private Checkpointform eins enthält vollständigen unterstützten Datenstand und ursprüngliche Receipts. Verschlüsseltes dauerhaft gespeichertes/rückgelesenes Original vor Restore, tatsächliche Fach-/Cacheprüfung, vollständiger Checkpoint-CAS und atomarer Ersatz. Native und drei echte OPFS-Browser bestehen dieselben Restore-/Abbruch-/Persistenzfälle; alte Snapshot-/Export-/Crypto-/Bindingformen unverändert |

## Implementierung und Aufbewahrung

`SqliteCommitStore` implementiert den typisierten Rust-LocalCommitPort mit Diesel 2.3.13 und SeaQuery 1.0.2, nativ libsqlite3-sys 0.38.2 sowie sqlite-wasm-rs 0.5.5/OPFS-SAH-Pool 0.2.0. Exakt die gesperrten DAL01-Versionen; keine neue Fremdversion. Das normale `sqlite`-Feature verwendet denselben tatsächlichen Code nativ/WASM. Memory bleibt eine ausdrücklich flüchtige Referenz, kein stiller Persistenzfallback.

Receipts werden nicht automatisch gelöscht. Historische Identitäten und Ergebnisse bleiben abfragbar; bei bekannter unveränderter Wiederholung wird zunächst das ursprüngliche Receipt ermittelt. Neue unbekannte Writes müssen zur aktuellen autorisierten Epoche passen. [Bestandsdelta #135](https://github.com/mpwg/WiMM/issues/135) korrigierte die frühere umgekehrte Prüfpriorität. Der DAL berechnet keine Finanzwerte; vollständige Fach-/Cacheprüfung wird vom Client/Fachkern injiziert.

`LocalCommitCheckpoint` besitzt Checkpointversion eins und physische Schemaversion eins. Er enthält den konsistenten Bereichsdatenstand plus vollständige ursprüngliche Request-/Receipteinträge, einschließlich historischer Epochen. Dieses private DAL-Verfahren erweitert keine alten Nutzerexporte oder Serverreceipts. Der erste Commitstore unterstützt noch keine bestätigten/Syncdaten und weist entsprechende Checkpoints ausdrücklich ab. Kein stilles Auslassen solcher Daten.

`backup_checkpoint` prüft den Datenstand über den tatsächlichen Fachkern, schützt ihn über `SnapshotProtectionPort<LocalCommitCheckpoint>` und verlangt dauerhafte Speicherung sowie bytegleiches Rücklesen über BackupReadPort. Vor Restore binden Backupreceipt und Checkpointhash das komplette Original. Entschlüsselter Zielstand wird strukturell/fachlich geprüft; die neue Epoche wird vom autorisierten Client vorbereitet. Unter derselben SQLite-Transaktion wird der vollständige Ausgangscheckpoint einschließlich Receipts erneut verglichen. Historische Receipts werden erhalten, kollidierende Inhalte abgewiesen. Fehlende Sicherung, falscher Schlüssel/Scope, Backup-/Validierungsfehler, Abbruch, konkurrierender Write oder Fehler nach Datenersatz erhält den Originalbestand.

## Tatsächliche Prüfungen

Aktive CachyOS/Linux-x86_64-Arbeitskopie, Rust 1.99.0. Gemeinsame synthetische Eingabe `crates/local-dal/tests/fixtures/receipt-request.json`. Keine realen Finanzdaten oder Schlüssel in Fixtures/Logs.

```sh
cargo test --locked -p wimm-local-dal --all-features
cargo test --locked -p wimm-local-contracts
cargo clippy --locked -p wimm-local-dal -p wimm-local-contracts --all-targets --all-features -- -D warnings
pnpm test:storage:receipts
pnpm test:contracts:ports:native
pnpm test:contracts:local
pnpm check:contracts:generated
pnpm test:target:architecture
pnpm check:rust-format
```

- Elf tatsächliche Memorytests, sechs native SQLite-Receiptfälle und vier zusätzliche native SQLite-Abbruch-/Backup-/Restore-/Schemafälle. Negative Unterfälle: fehlende Originaldatei, fehlgeschlagenes Backup, falscher Schlüssel, manipuliertes Chiffrat, falscher Profilkontext, ungültiger Finanzcache, Abbruch, Fehler nach tatsächlichem Datenersatz, konkurrierender Write und unsupported/fremdes Schema. Native Tests verwenden die bestehende tatsächliche Rust/libsodium-Implementierung und eine echte Datei mit sync_all/Rücklesen; keine Klartext-Sicherungsdatei.
- Lokal je sieben Chromium-/Firefox-Fälle: echte SQLite/WASM/OPFS-Verbindung in einem Worker, separates tatsächliches Rust-Cryptomodul und OPFS-SyncAccessHandle für verschlüsselte Sicherung mit write/flush/read. Native und WASM-Fachprüfungen stammen aus demselben Rust-Kern. Keine Finanzrechnung in JS/SQL. Native Feld-/Scope-/Receiptkorrelationsassertions plus AJV-Formvergleich bestanden; drei neue Schemas und Sprachdatenmodelle reproduzierbar erzeugt. Vorhandene tatsächliche Swift/Kotlin-Portorakel erneut erfolgreich.
- [Unabhängiger Ubuntu-DAL-Job 114159975858](https://github.com/mpwg/WiMM/actions/runs/38033806558/job/114159975858) auf 290f6e3 tatsächlich SUCCESS: elf Memory-/vier SQLite-Checkpoint-/sechs SQLite-Receiptfälle plus **alle 21 Chromium-/Firefox-/WebKitfälle**. Vollständiges Joblog und JSONreport aus `dal01-native-browser-belege` abgerufen/rückgelesen: expected 21, skipped 0, unexpected 0, flaky 0. Derselbe Job besteht zusätzlich unveränderte fünf native/15 Browser-DAL01-Fälle. Neue unabhängige Prozess-/Verbindungsfälle sind echte Datenbankbelege.
- Root-/Allfeature-Clippy/unsafe, 41 positive/negative Architekturvalidatorfälle und 111 tatsächliche native Assertions über 14 Pflichtcrates, Schema-/Sprachgenerierung einschließlich negativer Quellendrift, Oxc, Vertrags-Typecheck, Format, Dokumentationsvalidator und Whitespaceprüfung bestanden.

Lokales WebKit benötigt auf CachyOS zusätzliche, im Arch-Flite-Paket nicht vollständig enthaltene Kompatibilitätsbibliotheken. Diese lokale Grenze bleibt konkret bestehen; der aktuelle echte Ubuntu-WebKit-Nachweis wird nicht als lokal ausgeführter Fall umetikettiert. ICU 74.2 wurde aus SHA256-geprüftem Paket gebaut, Arch-Flite signaturgeprüft; keine Majorversionssymlinks oder gelockerte Prüfung.

## Grenzen und getrennte Folgearbeit

Diese Abnahme betrifft die erste gemeinsame Commit-/Receipt-/Sicherungsgrundlage, keine produktive Speicheraktivierung. Vollständige Storage-/Bestätigungs-/Sync-/Indexports, IndexedDB-/rusqlite-Migration, Geräte-/GUI-/Server-SQL- und Leistungsabnahmen bleiben #108/#109 und den weiteren Issues zugeordnet. Kein neuer P10-Gesamtexport, keine P6–P11-/Release-/Gesamtarchitekturabnahme. Nächstes Paket nach unveränderter Folge #114: [AR05 #119](https://github.com/mpwg/WiMM/issues/119).

Zusätzlicher Generatorbefund [#137](https://github.com/mpwg/WiMM/issues/137): maschinenabhängige Tsify-Customsection-Teilmengen werden im Vertragsgenerator durch einen gemeinsamen WASM-Codegen-Unit verhindert, vollständige Deklarationen erhalten. Strenge byteweise/negative Drift- und unsafe-/Warnsperren bleiben erhalten. Produktbuildkonfiguration nicht global geändert; Unabhängiger Ubuntu-Generatorcheck auf 290f6e3 tatsächlich bestanden, #137 als COMPLETED geschlossen und vollständig rückgelesen. Die Gesamtprüfung scheitert erst später am separaten #138 (fehlender Standalone-WASM-Ergebnisordner), keine Gesamt-CI-Freigabe.

[Leistungsdelta #136](https://github.com/mpwg/WiMM/issues/136) bleibt separat offen. Der frühere Job auf 34094b4 meldete Web kalt 2.463,0 ms statt unter 2.000 ms; der separate aktuelle Leistungslauf auf 290f6e3 ist grün, ohne Änderung am produktiven Startpfad. Ein Einzelgreen ist keine belegte Korrektur der Schwankung. Keine Gesamt-CI-Freigabe aus dem erfolgreichen DAL-Job; die weitere Ubuntu-Gesamtprüfung ist separat zu bewerten.
