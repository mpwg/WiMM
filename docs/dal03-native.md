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

Dieser Writer ist nicht produktiv aktiviert. Die integrierten Receipt-/Recoveryports und registrierte Erweiterung folgen im nächsten Abschnitt; vollständige Checkpoint-/Restore-/Migrations-/Aktivierungsintegration bleibt offen. Verschlüsselte Sicherung und vollständiger Originalvergleich für Migration/Restore bleiben eigene vorgeschaltete Verfahren; der vorhandene Low-Level-Snapshotport ersetzt sie nicht. Diesel-Datenbankfehler enthalten keine privaten SQLdiagnosen in der Fehlerhülle; mangels nachgewiesener Commitgewissheit werden sie konservativ als unknown weitergegeben. Strukturelle Guards und stale CAS liefern notCommitted.

## Erster Receiptschemaabschnitt — historischer Stand drei

`enable_commit_schema` ist der explizite registrierte DSL-Schritt für native Erweiterung eins. Vor jeder DDL müssen die vollständigen betroffenen Profil-/Bereichssnapshots über vorhandene Snapshotverschlüsselung und `BackupReadPort` rückgelesen sein. Hash, Profil, Bereich, Epoche, tatsächlich entschlüsselter Inhalt und injizierte Fach-/Cacheprüfung müssen übereinstimmen. Der unmittelbare SQLite-Transaktionsanfang vergleicht alle aktuellen Bestände mit den gesicherten Originalen; fehlende Bereiche und konkurrierende Änderungen verhindern die Migration. SeaQuery erzeugt drei Tabellen und den Receipt-Bereichsindex. DDL, Sicherungsjournal und physischer Versionsmarker werden gemeinsam committed oder zurückgerollt.

Der erste Abschnitt auf 056fc7e verwendete den physischen Marker drei und sperrte die bisherigen Tauri-Writer. Der aktuelle Stand vier folgt im nächsten Abschnitt. `wimm_native_schema` bindet Erweiterung eins, ursprüngliches logisches Snapshotformat und die tatsächlich bestätigten Sicherungsbelege. Der gemeinsame DAL erhält beim Snapshotlesen die bisherige Form eins oder zwei sowie Fachschema eins. Der physische DB-Marker ist deshalb von der exportierten Snapshotform getrennt. Fremde/unvollständige Erweiterungsstände oder ein zurückgesetzter Marker werden abgewiesen. [ADR-058](decisions.md#adr-058--native-receipterweiterung-mit-sperre-älterer-writer) dokumentiert die Versionszuordnung.

`LocalCommitPort` und `CancellableLocalCommitPort` benutzen dieselben ORM-Batchtransaktionen und ergänzen das dauerhafte Original/Receipt atomar. Identischer Originalauftrag liefert das ursprüngliche Receipt; geänderter Inhalt derselben Identität wird abgewiesen. Lookup prüft gespeicherten Inhalt, Hash und Revisionsliste. Bereits bekannte Receipts werden auch bei späterem Abbruch oder autorisiertem Epochenwechsel nicht widerrufen. Bei nicht belegter Commitgewissheit bleibt das Ergebnis unknown. Profilgebundene Recoverybytes verwenden eine eigene private Blobtabelle, tatsächliche SQLitepersistenz und vollständiges Byte-CAS. Ihr Schutz und die Interpretation als `RecoveryTicket` gehören zum Anwendungs-/Kryptoport, nicht zum DAL.

Native Tests speichern den vollständigen synthetischen Originalauftrag mit tatsächlichen AR08-libsodium-Primitiven und Zufallsnonce im Journal und entschlüsseln ihn nach Prozessneustart. Der zusätzliche Triggerfehlerfall verwendet ausdrücklich opake synthetische Journalbytes; er beweist deren Erhalt beim Rollback, keine Verschlüsselung. Der vollständige Checkpoint-/Restorepfad ist im folgenden Abschnitt umgesetzt; `RecoveryTicket`-/Runtimeintegration, Tauri-Kommandokatalog und gemeinsame Konformität bleiben offen.

## Vollständiger Checkpoint und getrennte Epochen

Die neue Nutzerentscheidung [ADR-059](decisions.md#adr-059--lokale-schreibepoche-getrennt-von-bestätigter-serverepoche) führt physischen Stand vier/Erweiterung zwei und eine eigene lokale Schreibepoche ein. Der frühere in ADR-058 beschriebene Stand drei bleibt lesbar, verweigert jedoch Writes. Frische registrierte Aktivierung aus vorhandenen Ständen eins/zwei richtet unmittelbar Stand vier ein. Ein Drei-nach-vier-Schritt verlangt vollständige geschützte Bereichscheckpoints einschließlich Originalreceipts und Recoverybytes, erhält die ursprünglichen Sicherungsbelege und registriert zusätzliche Rücklesebelege. Kein automatischer Upgrade.

`LocalCheckpointV2` ist eine separate vollständige Form mit Checkpointversion zwei, unterstütztem physischen Stand drei/vier, vorhandener Snapshotform, `localWriteEpoch`, allen historischen Originalreceipts und optionaler nichtnullable privater Recoveryreferenz. Die gesamte Erfassung benutzt eine tatsächliche SQLite-Lesetransaktion. `backup_checkpoint_v2` verlangt tatsächliche Verschlüsselung, dauerhafte Speicherung, bytegleiches Rücklesen, Entschlüsselung und Originalvergleich.

Restore vergleicht den vollständigen Originalcheckpoint erneut unter unmittelbarer SQLite-Schreibtransaktion. Er ersetzt Snapshot-/Cacheteile, ergänzt historische Receipts kollisionsfrei und rotiert die lokale Schreibepoche gemeinsam. Bestätigte Serverdaten, deren Epoche und Cursor werden beim verbundenen Restore nicht umetikettiert. Alte lokale Writes werden abgewiesen; historische Receipts bleiben abfragbar. Ein aktueller ungelöster Originalauftrag bleibt auch dann erhalten, wenn die historische Zielsicherung keine Referenz enthält; eine abweichende Referenz wird abgewiesen. Fehler nach tatsächlicher Snapshotlöschung und Abbruch rollen alle Teile zurück.

Aktuelle neue Prüfungen: verbundener Restore mit unveränderten Serverbestätigungen/Cursor und getrenntem lokalem Wert, Standalone ohne erfundenen Cursor, Dateineuöffnen, alte/neue lokale Commitidentitäten, Erhalt sämtlicher historischer Receipts, Original-CAS bei konkurrierendem Commit oder Recoverywrite, ungelöste Referenzen, realer SQLite-Triggerfehler nach Löschungen, Abbruch nach begonnenem Ersatz und nach Epochenschreibschritt beim Drei-nach-vier-Upgrade. Schema-/Sprachmodelle werden direkt aus Rust erzeugt; negatives Enum-/Checkpointfelddriftverfahren überschreibt keine generierte Datei. Keine produktive Runtime-/Tauri-/Browseraktivierung aus diesen Fällen.

## Konkrete native Runtimeports

`apps/desktop/src-tauri/src/runtime_storage.rs` wird im normalen Tauri-Crate kompiliert. `NativeRuntimeStorage` stellt `MutationReadPort`, `CancellableLocalCommitPort` und `RecoveryJournalPort` bereit; klonbare Portansichten teilen einen profilgebundenen `LegacySqliteWriter` hinter demselben Mutex. Keine zweite Commitkoordination oder Finanzengine. `mutation_snapshot` liefert Finanzlesestand und lokale Schreibepoche aus einer tatsächlichen SQLite-Lesetransaktion. Der Host verlangt explizit aktivierten physischen Stand vier; weder Migration noch Rückfall auf den Bestand geschehen beim Öffnen.

Das Journal speichert/liest den tatsächlichen streng deserialisierten `RecoveryTicket` über die private SQLite-Blobtabelle. Profilabweichung, kaputte Tickets und fehlende Schlüssel führen nicht zur Entfernung des Originals. `NativeRuntimeProtection` erhält einen bereits entsperrten Schlüssel vom aufrufenden Client-Keyport und benutzt dieselben bestehenden AR08-Domains/Primitive für Originalauftrag beziehungsweise Snapshot-/Checkpointsicherung. Es erzeugt keine Ersatzschlüssel und gibt keine Schlüsselmaterialfelder aus. Fach-/Cachevalidierung bleibt im Kern.

Sechs native Integrationsfälle plus tatsächlich separat gestarteter Child-Probe im Tauri-Rust-Testbinary bestehen: gemeinsamer `ClientRuntime` mit tatsächlichem SQLite-Commit und Undo/Redo, echter dauerhafter Wiederanlauf nach simulierter Antwortverlustgrenze, neuer Runtime-/Prozessstart mit Originalentschlüsselung und unveränderten Finanzdaten/Receipts, falscher Schlüssel mit erhaltener Writesperre, reale lokale Restoreepoche neben unveränderter Serverepoche/Cursor sowie Profil-/Ticketnegativfälle. Die Antwortverlusthülle ist ausdrücklich synthetisch; Commit, Cipher, Journal und neuer Prozess sind tatsächlich. Der bisherige Tauri-Kommandokatalog/produktive Startpfad ist noch nicht umgestellt.

```sh
cargo test --locked --manifest-path apps/desktop/src-tauri/Cargo.toml runtime_storage::tests
cargo test --locked --manifest-path apps/desktop/src-tauri/Cargo.toml
cargo clippy --locked --manifest-path apps/desktop/src-tauri/Cargo.toml --all-targets -- -D warnings
```

Gesamte aktuelle Tauri-Rust-Suite: 36 bestanden, zwei vorhandene Contractdriver-Einstiege regulär ignoriert. Diese Driver werden für ihre jeweiligen gemeinsamen Konformitätsbefehle getrennt gestartet; die ignorierten Einträge sind kein Konformitätsnachweis. Keine GUI-/Produkt-/Swift-/Kotlin-/Browserruntime-Abnahme aus dem nativen Hostabschnitt. Der zusätzliche native Lockfileabschluss enthält ausschließlich schon im Workspace gesperrte Paketversionen mit identischen Checksummen; keine bisherige native Paketversion wurde entfernt.

## Kriterienmatrix

| #108-Kriterium | Aktueller Nachweis |
| --- | --- |
| Vorhandene SQLite-Bestände ohne Format-/Schemaumbau öffnen | Native synthetische Dateien im unveränderten Tauri-Schema eins und zwei; Bytevergleich vor/nach Lesen und Neuöffnen. Vollständige produktive Bestandsabnahme folgt mit Integration. |
| Alle lokalen Ports und konsistente Snapshots | Alle elf `LocalStoragePort`-Methoden implementiert und nativ gegen echte SQLite geprüft. Konsistente Lesetransaktion und gemeinsame atomare Syncdaten; vollständige gemeinsame Tauri-Konformität noch offen. |
| Atomare Batches/CAS/Snapshot-/Projektionsersatz | Tatsächliche ORM-Transaktionen prüfen Batch-/Sync-/Snapshotrollback nach begonnenen Writes, konkurrierende CAS-Verbindungen, Finanzrevisionsanker und vollständigen Ausgangsvergleich beim Cacheersatz. Integrierte Original-/Receipts und private Recoverybytes ebenfalls geprüft; konkrete native Runtimeports geprüft; vollständige Tauri-/Konformitätsintegration noch offen. |
| Gesicherte versionierte Migration | Registrierte SeaQuery-Erweiterung mit tatsächlich verschlüsselten/rückgelesenen Originalen, Vergleich aller Bereiche, Sicherungsjournal und DDL-/Abbruchrollback geprüft. Vollständiger V2-Checkpoint-/Restorepfad und gesicherter Drei-nach-vier-Schritt umgesetzt; Runtime-/Tauri-/Aktivierungsabnahme noch offen. |
| Reguläre ORM-Abfragen, Rust-DSL-Migrationen | Leseabfragen durch Diesel umgesetzt. Registrierte DSL-Erweiterung vorhanden; reguläre Writes ebenfalls durch ORM. Verbindungs-PRAGMAs und registrierte DDL bleiben gekapselte technische Ausnahmen. |
| Native Assertions, Neustart, Fehler, Leistung | 36 native Testfälle plus zwei tatsächlich separat gestartete Child-Probes; Receipt und verschlüsselter Originalauftrag überleben Prozessneustart. Keine GUI-/Disk-full-/Abfrageleistungsabnahme. |
| Vollständiger #77-Vertrag ohne dauerhaften rusqlite-Produktpfad | Tauri noch nicht umgeschaltet; Issue bleibt offen. |

## Ausgeführte Prüfungen

Aktive Arbeitskopie: Linux 7.2.9-1-cachyos, x86_64, Rust 1.99.0. Gesperrte Bibliotheken: Diesel 2.3.13 und libsqlite3-sys 0.38.2 mit tatsächlich abgefragter gebündelter SQLite 3.53.2. Keine neue Abhängigkeit oder Lockfileänderung. Ausschließlich synthetische Finanzdaten.

```sh
cargo test --locked -p wimm-local-dal --all-features -- --nocapture
cargo clippy --locked -p wimm-local-dal --all-targets --all-features -- -D warnings
cargo check --locked -p wimm-local-dal --features sqlite --target wasm32-unknown-unknown
pnpm check:target:architecture
cargo test --locked --manifest-path apps/desktop/src-tauri/Cargo.toml sqlite_unbekannte_versionen_bleiben_vor_jeder_initialisierung_unveraendert
```

Native Suite: 38 Bestands-Testeinträge einschließlich der beiden Child-Probe-Einstiege, elf Memoryreferenztests und zehn bestehende tatsächliche AR04-SQLitetests bestanden. Die Elternprozesse starten und überprüfen beide Child-Probes tatsächlich. Der aktuelle Tauri-Rustguard weist zusätzlich physische Stände drei und vier ohne Initialisierungs-/Datenänderung ab. Schemafixture wird gegen die aktuelle Initialschemaquelle geprüft; die V2-Datei verwendet die bestehende registrierte Index-DDL direkt aus der Tauri-Quelle. Fixtureerzeugung ist Testaufbau; der neue registrierte Erweiterungsschritt besitzt separat tatsächliche Sicherungs-/Original-/Abbruchbelege. WASM-Check prüft Kompatibilität der Crate, keine neue Browserpersistenz.

Aktuelles Tracking einschließlich nächster Implementierung und Prüfbelege ausschließlich in [#108](https://github.com/mpwg/WiMM/issues/108); Abhängigkeitsfolge in [#114](https://github.com/mpwg/WiMM/issues/114).
