# DAL03 — Native Bestandsübernahme

SPDX-License-Identifier: AGPL-3.0-or-later

Stand: 10. Oktober 2026. [#108](https://github.com/mpwg/WiMM/issues/108) ist in Arbeit. Dieser Abschnitt prüft ORM-Lese-/Schreibports auf dem bestehenden nativen Tauri-Schema; er nimmt weder den vollständigen DAL noch seine produktive Umschaltung ab.

## Implementierter Bestandszugriff

`LegacySqliteStore` im gemeinsamen lokalen Rust-DAL öffnet eine vorhandene Datei mit SQLite-URI `mode=ro` und zusätzlichem verbindungsbezogenem `query_only`. Fehlende Dateien werden nicht erzeugt. Diesel bildet die unveränderten Tabellen `storage_meta`, `aggregates`, `confirmed`, `outbox`, `projections`, `sync_state` und das bestehende Migrationsjournal ab. Reguläre Leseoperationen verwenden ausschließlich die ORM-Query-DSL. Die beiden festen Verbindungs-PRAGMAs sind technische adapterinterne Ausnahmen.

Schema eins mit optional fehlender Fachversionszeile sowie Schema zwei mit Fachversion eins, registriertem Journalstand und sieben bestehenden Indizes bleiben lesbar. Öffnen und jedes Lesen prüfen den aktuellen Versionsstand; es gibt keinen automatischen Schemaabgleich. Der Snapshot liest Metadaten und alle getrennten Datenanteile in derselben SQLite-Transaktion. Die lokale Epoche benötigt keinen künstlichen Servercursor. Cursor bleiben Dezimalstrings einschließlich Werten oberhalb der JavaScript-Ganzzahlgrenze.

Spalten und private typisierte Payloads müssen hinsichtlich Handle, Bereich, Revision, bestätigter Epoche, Pendingstatus und Projektionsschlüssel übereinstimmen. Widersprüche werden strukturiert abgewiesen und nicht repariert. Der Adapter berechnet keine Finanzwerte. Vollständige fachliche Snapshotvalidierung bei späteren Schreib-/Restoreports bleibt Aufgabe des injizierten Fachkernports.

## Atomare Speicherports

`LegacySqliteWriter<V>` öffnet denselben vorhandenen Bestand ausdrücklich mit `mode=rw`, ohne Tabellen anzulegen oder Migrationen auszuführen. Er implementiert alle elf `LocalStoragePort`-Methoden. Profilbindung liegt an der Instanz; Syncseiten und Snapshots prüfen ihren zusätzlichen Profilbezug. Aggregate, Bestätigungen und Outboxhandles dürfen nicht zwischen Bereichen verschoben werden.

Jeder Write läuft in einer unmittelbaren SQLite-Transaktion. Batches vergleichen alle erwarteten Revisionen einschließlich des vom Fachkern gelieferten Finanzrevisionsankers, bevor sie Aggregate, Originalentwürfe und Projektionen schreiben. Syncseiten verändern Bestätigungen, Pendingentfernung, Projektionen, lokale Epoche und Cursor gemeinsam; sie ersetzen keine lokalen Finanzaggregate. Snapshotersatz erhält die separate Speicherform, prüft Versionen, Handles, Bereiche, Epochen und Originalentwürfe und ruft den zwingend injizierten `SnapshotValidationPort` auf. Der Projektionsersatz vergleicht den vollständigen Ausgangsbestand und prüft den neuen Cache über denselben Port. Die Tests injizieren die tatsächlichen Rust-Fachkern-/Cachevalidatoren. Keine Finanzregeln wurden in den Adapter übertragen.

Dieser Writer enthält noch keinen integrierten Operationsreceipt-/Recoveryjournal-/Migrationsport und ist nicht produktiv aktiviert. Verschlüsselte Sicherung und vollständiger Originalvergleich für Migration/Restore bleiben eigene vorgeschaltete Verfahren; der vorhandene Low-Level-Snapshotport ersetzt sie nicht. Diesel-Datenbankfehler enthalten keine privaten SQLdiagnosen in der Fehlerhülle; mangels nachgewiesener Commitgewissheit werden sie konservativ als unknown weitergegeben. Strukturelle Guards und stale CAS liefern notCommitted.

## Kriterienmatrix

| #108-Kriterium | Aktueller Nachweis |
| --- | --- |
| Vorhandene SQLite-Bestände ohne Format-/Schemaumbau öffnen | Native synthetische Dateien im unveränderten Tauri-Schema eins und zwei; Bytevergleich vor/nach Lesen und Neuöffnen. Vollständige produktive Bestandsabnahme folgt mit Integration. |
| Alle lokalen Ports und konsistente Snapshots | Alle elf `LocalStoragePort`-Methoden implementiert und nativ gegen echte SQLite geprüft. Konsistente Lesetransaktion und gemeinsame atomare Syncdaten; vollständige gemeinsame Tauri-Konformität noch offen. |
| Atomare Batches/CAS/Snapshot-/Projektionsersatz | Tatsächliche ORM-Transaktionen prüfen Batch-/Sync-/Snapshotrollback nach begonnenen Writes, konkurrierende CAS-Verbindungen, Finanzrevisionsanker und vollständigen Ausgangsvergleich beim Cacheersatz. Receipt-/Recoveryintegration noch offen. |
| Gesicherte versionierte Migration | Bestehenden registrierten V2-Stand lesen und unvollständigen Stand abweisen; kein neuer Migrationswrite. Vollständiger Migrationsport offen. |
| Reguläre ORM-Abfragen, Rust-DSL-Migrationen | Leseabfragen durch Diesel umgesetzt. Neue DSL-Migrationen und begründete Schreibausnahmen noch offen. |
| Native Assertions, Neustart, Fehler, Leistung | 17 native Testfälle plus Child-Probe im tatsächlich separat gestarteten Rust-Prozess. Keine GUI-/Disk-full-/Abfrageleistungsabnahme. |
| Vollständiger #77-Vertrag ohne dauerhaften rusqlite-Produktpfad | Tauri noch nicht umgeschaltet; Issue bleibt offen. |

## Ausgeführte Prüfungen

Aktive Arbeitskopie: Linux 7.2.9-1-cachyos, x86_64, Rust 1.99.0. Gesperrte Bibliotheken: Diesel 2.3.13 und libsqlite3-sys 0.38.2 mit gebündelter SQLite. Keine neue Abhängigkeit oder Lockfileänderung. Ausschließlich synthetische Finanzdaten.

```sh
cargo test --locked -p wimm-local-dal --all-features
cargo clippy --locked -p wimm-local-dal --all-targets --all-features -- -D warnings
cargo check --locked -p wimm-local-dal --features sqlite --target wasm32-unknown-unknown
pnpm check:target:architecture
```

Native Suite: 18 Bestands-Testeinträge einschließlich des Child-Probe-Einstiegs, elf Memoryreferenztests und zehn bestehende tatsächliche AR04-SQLitetests bestanden. Der Elternprozess startet und überprüft den Child-Probe tatsächlich. Schemafixture wird gegen die aktuelle Initialschemaquelle geprüft; die V2-Datei verwendet die bestehende registrierte Index-DDL direkt aus der Tauri-Quelle. Fixtureerzeugung ist Testaufbau, kein gesicherter Produktmigrationsnachweis. WASM-Check prüft Kompatibilität der Crate, keine neue Browserpersistenz.

Aktuelles Tracking einschließlich nächster Implementierung und Prüfbelege ausschließlich in [#108](https://github.com/mpwg/WiMM/issues/108); Abhängigkeitsfolge in [#114](https://github.com/mpwg/WiMM/issues/114).
