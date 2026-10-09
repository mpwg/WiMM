# @wimm/storage

Lokale atomare Speicherports für IndexedDB, SQLite und den Testadapter. Der DesktopStorageAdapter verwendet ausschließlich katalogisierte Tauri-Kommandos. Snapshotexport liest einen konsistenten Stand; Snapshotersatz prüft Profil, Bereich, Epoche, Fachbestand und Cachewerte. Fachberechnungen kommen aus dem gemeinsamen Fachkern.

## Verschlüsselte Migrationssicherungen

DesktopEncryptedBackupPort implementiert EncryptedBackupPort mit injizierter ID-Quelle und begrenztem Invoke-Port. Der Aufrufer verschlüsselt den vollständigen Ausgangssnapshot mit dem vorhandenen SnapshotProtector und liefert seinen Hash. Native SQLite speichert nur Chiffrat und Belegmetadaten in der separaten Datei wimm-backups.sqlite3; die Finanzdatenbank bleibt davon getrennt. Die Brücke akzeptiert keine frei gewählten Pfade oder SQL-Anweisungen.

Ein Beleg entsteht nach FULL-Commit und vollständigem Rücklesen. Backup-ID, Profil, Bereich, Epoche und Snapshot-Hash müssen exakt passen. Doppelte IDs überschreiben keine ältere Sicherung. Fehler, unbekannte Sicherungsschemas und abgeschwächte Durability liefern keinen Erfolgsbeleg. read(receipt) liest nur das exakt gebundene Chiffrat; Entschlüsselung und Inhaltsvalidierung bleiben beim Aufrufer. Das ist eine lokale Migrationsvoraussetzung für [#82](https://github.com/mpwg/WiMM/issues/82), keine vollständige P10-Sicherung. Der Sicherungsport allein führt keine Migration aus.

## Gesicherte Vorwärtsmigration und Indexabfragen

LOCAL_INDEX_MIGRATION_PLAN registriert Schritt 1 von Storage 1/Fachversion 1 nach Storage 2/Fachversion 1. LocalMigrationCoordinator verschlüsselt und bestätigt den Originalsnapshot vor dem Schritt. DesktopMigrationPort übergibt ausschließlich den festen Plan, den vollständigen Ausgangsstand und dessen JSON-Bytes; Rust prüft Hash, gespeicherten Beleg und Snapshot erneut innerhalb BEGIN IMMEDIATE. IndexedDbStorageAdapter.migrate verlangt eine injizierte MigrationBackupVerification, etwa createMigrationBackupVerifier aus application, und prüft den vollständigen Originalstand im expliziten Dexie-Upgrade. Ohne Sicherungsverifikation wird kein Upgrade ausgeführt. Beide Ports führen Indexaufbau, Versionsfortschritt und Journal atomar aus.

Bekannte V1-/V2-Datenbanken öffnen ohne automatische Migration; unbekannte Versionen bleiben erhalten. IndexQueryPorts bieten begrenzte Seiten für Konto/Datum/ID, Splitkategorie/Datum, direkte Importreferenz, externe Importquell-ID und Outboxzustand/Reihenfolge. Fachänderungen und Referenzzeilen bleiben zusammen atomar. Alte Snapshots und unveränderte Originalentwürfe bleiben kompatibel. [Historischer Abnahmesnapshot für #82/#83](https://github.com/mpwg/WiMM/blob/84d730cc6e10d70cf6ac6ff9bc28c4a9c4376e92/docs/handoffs/storage-index-migration-2026-10-09.md), ADR-048. Die Startkoordination der Anwendung folgt mit K05.

## Prüfung

Aus der aktiven Repository-Arbeitskopie:

```sh
pnpm test:storage
pnpm check:rust
pnpm test:storage:native
env -u NO_COLOR pnpm test:storage:migrations
```

Native Rust-Assertions prüfen Commit, unveränderte ältere Sicherung, Kontextprüfung, ungültige Hüllen, synthetischen SQLite-Schreibfehler, Durability-Abweisung und echten Rust-Prozessneustart. Die native Vertragsserie prüft zusätzlich den authentifizierten P5-Snapshot-Roundtrip mit libsodium über den TypeScript-Port und tatsächliche Rust-/SQLite-Prozesse. Das belegt keine Tauri-GUI-, physische Disk-full- oder Stromausfallabnahme. Historische Kriterienbelege: [Abnahmesnapshot vom 9. Oktober 2026](https://github.com/mpwg/WiMM/blob/84d730cc6e10d70cf6ac6ff9bc28c4a9c4376e92/docs/handoffs/migration-2026-10-09.md).

## Architekturstand vom 9. Oktober 2026

Bestand und Ziel sind getrennt: [gemeinsame Rust-Architektur](../../docs/architecture.md). Hier dokumentierte Funktionen und Arbeitsregeln beziehen sich auf den Bestand; neue Rust-Anwendungs-/DAL-/Serverumstellung ist noch nicht implementiert. Aktuelle Aufträge und Kriterien in tasks.md/GitHub; historische Belege ersetzen keine Zielabnahme.

## Strukturierte Fehlergrenzen

AR03 ersetzt native Text-/Regexerkennung durch Rust-abgeleitete StorageFailure-Codes und expliziten Commitstatus. Deutsche Meldungen entstehen im Client; fremde Payloads/Diagnosetexte werden verworfen. Unklare/ungültige Writeantworten sperren Wiederholungswrites in der aktiven Anwendung. Durable Receipts folgen separat. [Abnahme und Grenzen](../../docs/ar03-errors.md), Prüfung `pnpm test:contracts:storage-errors`.
