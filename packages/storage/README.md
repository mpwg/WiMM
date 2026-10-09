# @wimm/storage

Lokale atomare Speicherports für IndexedDB, SQLite und den Testadapter. Der DesktopStorageAdapter verwendet ausschließlich katalogisierte Tauri-Kommandos. Snapshotexport liest einen konsistenten Stand; Snapshotersatz prüft Profil, Bereich, Epoche, Fachbestand und Cachewerte. Fachberechnungen kommen aus dem gemeinsamen Fachkern.

## Verschlüsselte Migrationssicherungen

DesktopEncryptedBackupPort implementiert EncryptedBackupPort mit injizierter ID-Quelle und begrenztem Invoke-Port. Der Aufrufer verschlüsselt den vollständigen Ausgangssnapshot mit dem vorhandenen SnapshotProtector und liefert seinen Hash. Native SQLite speichert nur Chiffrat und Belegmetadaten in der separaten Datei wimm-backups.sqlite3; die Finanzdatenbank bleibt davon getrennt. Die Brücke akzeptiert keine frei gewählten Pfade oder SQL-Anweisungen.

Ein Beleg entsteht nach FULL-Commit und vollständigem Rücklesen. Backup-ID, Profil, Bereich, Epoche und Snapshot-Hash müssen exakt passen. Doppelte IDs überschreiben keine ältere Sicherung. Fehler, unbekannte Sicherungsschemas und abgeschwächte Durability liefern keinen Erfolgsbeleg. read(receipt) liest nur das exakt gebundene Chiffrat; Entschlüsselung und Inhaltsvalidierung bleiben beim Aufrufer. Das ist eine lokale Migrationsvoraussetzung für [#82](https://github.com/mpwg/WiMM/issues/82), keine vollständige P10-Sicherung oder bereits abgenommene Migration.

## Prüfung

Aus der aktiven Repository-Arbeitskopie:

```sh
pnpm test:storage
pnpm check:rust
pnpm test:storage:native
env -u NO_COLOR pnpm exec playwright test --config tests/storage/backups.config.ts
```

Native Rust-Assertions prüfen Commit, unveränderte ältere Sicherung, Kontextprüfung, ungültige Hüllen, synthetischen SQLite-Schreibfehler, Durability-Abweisung und echten Rust-Prozessneustart. Die native Vertragsserie prüft zusätzlich den authentifizierten P5-Snapshot-Roundtrip mit libsodium über den TypeScript-Port und tatsächliche Rust-/SQLite-Prozesse. Das belegt keine Tauri-GUI-, physische Disk-full- oder Stromausfallabnahme. Aktuelle Kriterien: [Abnahmesnapshot vom 9. Oktober 2026](../../docs/handoffs/migration-2026-10-09.md).
