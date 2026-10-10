# Lokaler Rust-DAL — Vertragsreferenz DAL02

SPDX-License-Identifier: AGPL-3.0-or-later

`MemoryStorage<V>` implementiert dieselben elf `LocalStoragePort`-Methoden aus wimm-local-contracts, zusätzlich die begrenzten `LocalIndexQueryPort`-Abfragen und den versionierten `LocalCommitPort`. Profile und sichere Schlüsselablage bleiben eigene Plattformports. Die Produktionsabhängigkeiten enthalten ausschließlich Datenformen, Serde und SHA-256; Finanzhandler werden nur im Test als Snapshotvalidator injiziert. Eine Instanz gehört genau einem Profil, Bereichsdaten werden getrennt gehalten.

Atomare Änderungen entstehen auf einer Kopie des Zustands und werden erst nach sämtlichen Guards veröffentlicht. CAS vergleicht erwartete Revisionen; Doppelhandles innerhalb eines Batches, fremde Bereiche/Epochen, ungültige Cursor und ungültige Snapshotformen werden abgewiesen. Bestätigungen, ursprüngliche opake Entwürfe, Outbox, Projektionen und Cursor bleiben eigenständige Speicherteile. Projektionen werden aus bereits im Fachkern berechneten Daten ersetzt; der DAL berechnet keine Geldwerte. Der Neuaufbau vergleicht den vollständigen Ausgangsbestand vor dem atomaren Ersatz.

Snapshotersatz benötigt zwingend `SnapshotValidationPort`: die gemeinsame Clientanwendung muss darüber Fach- und Cacheprüfung im Fachkern ausführen. Lokale strukturelle Guards ersetzen diese Prüfung nicht. Der native Testadapter führt die tatsächlichen Fachkern-/Cacheprüfungen aus. Logische Storageversionen eins und zwei bleiben beim Rundlauf erhalten; Memory führt keine physische Migration aus. Migrationsplan, Originalsnapshot und bestätigtes verschlüsseltes Backup sind weiterhin über die getrennten Vertragsports modelliert.

`LocalOperationIdentity` bindet Operationsvertragsversion eins, Profil, Bereich, Epoche und Operations-ID. Der Memoryadapter bindet dazu den vollständigen typisierten Request: SHA-256 über dessen Serde-JSONbytes, inklusive CAS, Aggregate, Originalentwürfe und Projektionen. Identischer Request liefert das ursprüngliche Receipt; abweichender Inhalt derselben Identität liefert `OPERATION_ID_REUSED`. Diese lokale Hashrepräsentation ist kein öffentliches Signatur-/JCSformat. Ein Receipt enthält den tatsächlichen Hash und die geschriebenen Revisionen.

Die ausdrücklich benannten Memory-Fehlerinjektionen prüfen Fehler vor Veröffentlichung und Antwortverlust nach erfolgreichem Commit. Bei Antwortverlust meldet `commit` unknown; `lookup_result` findet dasselbe Receipt. Eine neue Instanz besitzt keinen alten Zustand und kein Receipt. Dauerhafte SQLite-/OPFS-Receipts, Prozessabsturz, Wiederanlauf und reale Datenbankfehler müssen die folgenden Pakete nachweisen; Memory ist dafür kein Ersatzadapter und kein stiller Produktfallback.

Die drei Referenzabfragen scannen Memorydaten, erhalten Tombstone-, Bereichs-, Datums-/Handlecursor-, Pendingstatus- und Importquellensemantik und begrenzen Ergebnisse auf 1–1.000. Daraus folgt kein SQLindex- oder Leistungsnachweis.

```sh
cargo test --locked -p wimm-local-dal -p wimm-local-contracts -p wimm-persistence-contracts
cargo clippy --locked -p wimm-local-dal -p wimm-local-contracts -p wimm-public-contracts -p wimm-persistence-contracts --all-targets --all-features -- -D warnings
cargo check --locked -p wimm-local-dal --target wasm32-unknown-unknown
pnpm check:core
pnpm test:target:architecture
pnpm test:contracts:local
pnpm test:contracts:public
pnpm test:contracts:ports:native
pnpm test:contracts:public:native
```

[Kriterienmatrix und aktueller Beleg](../../docs/dal02-contracts.md), [DAL02 #107](https://github.com/mpwg/WiMM/issues/107). Physische lokale Persistenz und Anwendungen folgen der unveränderten Reihenfolge in [#114](https://github.com/mpwg/WiMM/issues/114).

## AR04-Persistenzabschnitt

Das optionale `sqlite`-Feature aktiviert `SqliteCommitStore` mit derselben registrierten leeren Schemaerzeugung und dieselben Commit-/Lookupmethoden nativ und auf SQLite/WASM/OPFS. Das Standardfeature bleibt Memory; keine produktive Umschaltung oder automatische Migration. `receipt-probe` ist ausschließlich der synthetische Native-/Browserprüfeinstieg. Verbindungsbesitz, ORM-Entities, DSL und feste technische PRAGMAs bleiben adapterintern. Keine Finanzberechnung im SQLiteadapter.

```sh
cargo test --locked -p wimm-local-dal --all-features
pnpm test:storage:receipts
```

[Sechs native SQLitefälle, elf Memorytests, tatsächliche Browserbelege und offene AR04-Grenzen](../../docs/ar04-local-receipts.md). Das größere neue Journal-/Sicherungs-/Restoreverfahren wird nicht durch den Initialschemafall ersetzt.

AR04-Folgeabschnitt: `LocalCommitCheckpoint` bindet den konsistenten lokalen Stand einschließlich aller historischen Receipts. `backup_checkpoint` und `restore_checkpoint` benötigen injizierten Fach-/Cachevalidator, vorhandene Snapshotverschlüsselung und tatsächliche dauerhafte Backup-Rückleseports. Die Ausgangssicherung ist Pflicht; vollständiger Checkpoint-CAS verhindert Restore über konkurrierende Writes. Bekannte Receipts werden erhalten, neues Schreiben bleibt an die vorbereitete Clientepoche gebunden. Neue Checkpointversion eins ist ein separater privater DAL-Vertrag; alte Nutzerexporte/Serverformate bleiben unverändert. Bestätigte/Syncdaten werden vorläufig ausdrücklich abgewiesen.

`CancellableLocalCommitPort` ergänzt die vorhandenen typisierten Methoden: Abbruch vor COMMIT rollt zurück; Abbruch nach COMMIT ändert dessen Ergebnis nicht. Ausschließlich der synthetische `receipt-probe` kann Beobachter an den tatsächlichen Transaktionsgrenzen injizieren; keine Testbeobachter im normalen SQLitefeature. Vier zusätzliche native SQLitefälle plus ergänzende OPFSfälle prüfen diese Grenzen und tatsächliche etablierte Rust-Verschlüsselung. Aktueller Status und vollständige Grenzen ausschließlich [#118](https://github.com/mpwg/WiMM/issues/118)/[Abnahmesnapshot](../../docs/ar04-local-receipts.md).

## DAL03 — Nativer Bestand

`legacy_sqlite::LegacySqliteStore` liest existierende native Tauri-Datenbanken über Diesel, ohne Tabellen oder Dateien zu erzeugen. SQLite öffnet die vorhandene Datei explizit read-only. Schema-/Fachversion und registrierter V2-Journal-/Indexstand werden beim Öffnen und Lesen geprüft. Profilgebundener Einzelzugriff und vollständiger Snapshot erhalten getrennte Aggregate, Bestätigungen, Originalentwürfe, Projektionen, lokale Epoche und Cursor; Snapshotdaten stammen aus einer Lesetransaktion. Metadatenwidersprüche werden ohne Originaländerung abgewiesen.

[DAL03-Matrix und Prüfgrenzen](../../docs/dal03-native.md). 44 native Fälle plus zwei tatsächliche Child-Probes prüfen vorhandene V1-/V2-Dateien, unveränderte Dateibytes, Neuöffnen/Prozesslesen, Profiltrennung, konkurrierende SQLitewrites und fehlerhafte Stände. `LegacySqliteWriter<V>` implementiert außerdem alle elf lokalen Speicherports mit tatsächlichen ORM-Transaktionen, CAS/Finanzrevisionsanker, getrennten Syncdaten und zwingendem Fachkernvalidator beim Snapshot-/Cacheersatz. Integrierte Originalreceipts, private Recoverybytes und eine registrierte gesicherte SeaQuery-Erweiterung ergänzen dieselben Bestandstabellen. Physischer Marker drei sperrt alte Tauri-Writer, die bisherige logische Snapshotform bleibt erhalten (ADR-058). Vollständige Checkpointversion zwei sichert auch Bestätigungen, Cursor, historische Receipts und private Recoverybytes. Nach Nutzerentscheidung ADR-059 rotiert Restore nur die lokale Schreibepoche; Serverdaten werden nicht umetikettiert. Physischer Stand vier sperrt auch frühere Drei-Writer; dessen gesicherter Vorwärtsschritt ist explizit. Runtime-/Tauri-/Konformitätsintegration bleiben [#108](https://github.com/mpwg/WiMM/issues/108); der vorhandene rusqlite-Produktpfad wird damit noch nicht ersetzt.

## DAL03 — Indizierte Zielabfragen

Der vollständige Writer implementiert `LocalIndexQueryPort` über begrenzte Diesel-Abfragen auf den registrierten Bestandsindizes. Datum-/Handlecursor, Livefilter, Kategoriejoin, Pendingzeit und dedupliziertes Importquellen-Subselect sind nativ geprüft. `migrate_indexes` sichert sämtliche vollständigen Bereichscheckpoints, vergleicht sie atomar und aktiviert den bestehenden logischen Eins-nach-zwei-Indexschritt bei unverändertem physischen Stand vier. [Technische SQL-Ausnahmen, tatsächliche Querypläne und DAO-Leistungsprobe](../../docs/dal03-native.md#registrierte-indizes-und-begrenzte-orm-abfragen) sind vom noch offenen produktiven Tauri-/GUI-/Konformitätsabschluss getrennt.

## DAL03 — V1-Kompatibilität im produktiven Tauri-Katalog

Die elf bisherigen Tauri-Finanzspeichercommands verwenden den gemeinsamen ORM-DAL. Die registrierte leere Schemaerzeugung übernimmt das vorhandene Format; bestehende Dateien werden beim Start nicht umgebaut. 18 unveränderte gemeinsame Zielkonformitätsfälle und insgesamt 48 tatsächliche native SQLitefälle bestehen. [Bestandsdeltas #144/#145 und Grenzen](../../docs/dal03-native.md#produktive-finanzcommands-und-gemeinsame-bestandskonformität): reine/flache Originalaggregate ohne Umschreiben und explizite V1-Cachekompatibilität, während typisierte Snapshot-/Restoreguards streng bleiben. Vollständige Schema-/Indexcommand- und Chiffratspeicherablösung bleibt #108, produktive Commitkoordination #119.

## DAL03 — Privater ORM-Chiffratstore

`sqlite_backup::SqliteBackupStore` übernimmt vorhandene native verschlüsselte Backupbestände mit Diesel, expliziter leerer SeaQuery-Erzeugung und unverändertem Receipt-/Schemaformat. FULL-Durabilität wird tatsächlich abgefragt, IDs werden nicht überschrieben und erfolgreicher Commit benötigt bytegleiches Rücklesen. Native Assertions prüfen tatsächliche Fehler/Neustarts; [Matrix](../../docs/dal03-native.md#produktiver-orm-chiffratspeicher-und-indexcommands). Keine eigene Kryptografie, Finanzklartexte, UI-Dateipfade oder Öffnungs-Upgrades.
