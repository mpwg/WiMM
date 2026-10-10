# @wimm/storage

Lokale atomare Speicherports für IndexedDB, SQLite und den Testadapter. Der DesktopStorageAdapter verwendet ausschließlich katalogisierte Tauri-Kommandos. Snapshotexport liest einen konsistenten Stand; Snapshotersatz prüft Profil, Bereich, Epoche, Fachbestand und Cachewerte. Fachberechnungen kommen aus dem gemeinsamen Fachkern.

## Verschlüsselte Migrationssicherungen

DesktopEncryptedBackupPort implementiert EncryptedBackupPort mit injizierter ID-Quelle und begrenztem Invoke-Port. Der Aufrufer verschlüsselt den vollständigen Ausgangssnapshot mit dem vorhandenen SnapshotProtector und liefert seinen Hash. Native SQLite speichert nur Chiffrat und Belegmetadaten in der separaten Datei wimm-backups.sqlite3; die Finanzdatenbank bleibt davon getrennt. Die Brücke akzeptiert keine frei gewählten Pfade oder SQL-Anweisungen.

Ein Beleg entsteht nach FULL-Commit und vollständigem Rücklesen. Backup-ID, Profil, Bereich, Epoche und Snapshot-Hash müssen exakt passen. Doppelte IDs überschreiben keine ältere Sicherung. Fehler, unbekannte Sicherungsschemas und abgeschwächte Durability liefern keinen Erfolgsbeleg. read(receipt) liest nur das exakt gebundene Chiffrat; Entschlüsselung und Inhaltsvalidierung bleiben beim Aufrufer. Das ist eine lokale Migrationsvoraussetzung für [#82](https://github.com/mpwg/WiMM/issues/82), keine vollständige P10-Sicherung. Der Sicherungsport allein führt keine Migration aus.

## Gesicherte Vorwärtsmigration und Indexabfragen

Native SQLite verwendet unmittelbar das vollständige aktuelle Rust-DSL-Schema mit allen Referenzindizes. Der alte DesktopMigrationPort und seine Tauri-Kommandos sind entfernt. Unbekannte ältere native Dateiformen werden kontrolliert abgewiesen; es gibt keine Altdatenübernahme oder stille Reparatur. Aktuelle verschlüsselte Sicherung und Checkpoint/Restore bleiben erforderlich (ADR-060).

Der noch zu ersetzende Browser-IndexedDB-Adapter enthält historische Indexmigrationen. Diese sind keine Zielanforderung und werden mit der tatsächlichen persistenten Browser-SQLite-Integration in #109/#146 entfernt. Native Indexprüfungen beginnen direkt auf dem vollständigen Schema; sie behaupten keine durchgeführte Migration. Begrenzte Konto-/Kategorie-/Import-/Pendingabfragen und atomare Referenzpflege bleiben auf beiden tatsächlichen Adaptern geprüft.

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
