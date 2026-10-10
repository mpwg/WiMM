# DAL04 — Aktueller Browser-SQLite-Abschnitt

Stand: 10. Oktober 2026. [#109](https://github.com/mpwg/WiMM/issues/109), [#146](https://github.com/mpwg/WiMM/issues/146), [#114](https://github.com/mpwg/WiMM/issues/114). Keine historische Datenübernahme nach ADR-060. Native Grundlage auf 2ee0cdf; #108 wegen nachträglicher CI-Schematestkorrektur #147 wieder geöffnet, neue CI separat nachweisen.

## Implementierter Abschnitt

[Browser-Rust-Laufzeit](../crates/browser-runtime/README.md) übernimmt dieselbe aktuelle Diesel-Verbindung, denselben vollständigen Schema-/CAS-/Snapshot-/Sync-/Index-/Commit-/Receiptcode und denselben Rust-Fachkernvalidator wie Tauri. Explizite leere Initialisierung ist von der schemaerhaltenden Verbindungskonstruktion getrennt. OPFS-VFS wird ohne Rücksetzen installiert; echte Dateiexistenz entscheidet über frische Initialisierung. Keine andere Datenbankimplementierung, Kopie von Finanzregeln, SQL-/Pfadparameter oder stiller Speicherfallback.

Rust-basierte typisierte WASM-Einstiege sind über den produktiven Dedicated Worker erreichbar. Web Lock schützt die gesamte Verbindungslebensdauer, einschließlich tatsächlich freigegebener OPFS-Handles. Zweiter Tab wartet, bis der vorherige Besitzer schließt. Keine automatischen Wiederholungen bei verlorenem Ergebnis; Ressourcen und Nachrichtenfristen begrenzt. Worker liefert ausschließlich sichere strukturierte Fehlerhüllen. Die Testseite konsumiert diesen produktiven Worker, kein separates Probe-Speicherbackend.

## Kriterienmatrix

| #109-Kriterium | Aktueller Stand |
| --- | --- |
| Tatsächlicher gemeinsamer Rust-ORM-/OPFS-DAL | Typisierter Worker auf aktuellem physischem Schema fünf implementiert und in Chromium/Firefox/WebKit geprüft. React-Composition-Root noch nicht umgestellt. |
| Offline und vollständiger Browserneustart | Vollständiger Neustart aller drei Browserprozesse mit persistentem Profil erhält synthetische P5-Aggregate, Bestätigungen, Originalentwürfe, Projektionen und Cursor. Offline-Produktionsassets noch offen. |
| Zwei Tabs und Führungswechsel | Tatsächlicher Web Lock hält zweiten Tab zurück; Close gibt OPFS-Handles frei, neuer Besitzer öffnet identischen Zustand. Dauerhafte Receipts, gleiche Operationsidentität/Inhaltsabweichung und stale CAS nach tatsächlicher Tabübergabe/Neuöffnen zusätzlich geprüft. Absturz-/Commitunklarheitsmatrix noch offen. |
| Persistenzablehnung, Quota und Fehler | Sichere Rust-/Workerfehler und begrenzte Pending-RPCs implementiert; tatsächliche Persistenz-/Quota-/Draft-/Oberflächenmatrix noch offen. |
| Drei Browser, Rust-Anwendung/Ports/Views | Native Rust-Assertion auf echter SQLite und tatsächlicher Portgrenze bestanden. Chromium/Firefox/WebKit je fünf tatsächliche Fälle bestanden. Private WebKit-Standardkontexte verweigern OPFS; separat tatsächliche Ressourcenabweisung vor Write geprüft. Reguläre Persistenzfälle laufen auf echten persistenten Browserprofilen, nicht auf einem Ersatzspeicher. Kein physischer iOS-Nachweis. Gemeinsame vollständige Anwendungs-/Views-/Katalogintegration noch offen. |
| 50.000 Buchungen und vorhandene Grenzen | Native Grundlage geprüft; neue Browser-Kaltöffnung/Listen-/Filter-/Scrollprobe noch offen. Keine Grenzlockerung. |

## Prüfbelege und Befehle

Aktive Linux-x86_64-Arbeitskopie mit gesperrten Bibliotheken. Native Browserhost-Assertion prüft aktuelle reale SQLite-Datei, explizite vollständige Initialisierung, profilgebundenes Neuöffnen, fremde Profile und Versionsabweisung vor Write. Tauri-Suite nach Auslagerung des identischen Validators: 14 erfolgreich, ein absichtlich ignorierter Prozesstreiber. Root-Typecheck, Lint, native/WASM-Clippy und Architektur-/Paketgraphprüfung erfolgreich. Gemeinsame DAL-Regressionsprüfung nach Verbindungsfactory-/Validatorauslagerung ebenfalls erfolgreich: 40 aktuelle native Adapter-, fünf Backup-, elf Memory- und zehn frühe Probe-Testeinträge. Rust-abgeleitete Worker-Signaturen ohne Umschreiben geprüft; absichtlich veränderte Signatur in isoliertem Testverzeichnis ohne Überschreiben abgewiesen.

```sh
cargo test --locked -p wimm-browser-runtime
pnpm build:browser:runtime
env -u NO_COLOR pnpm exec playwright test --config tests/browser-storage/config.ts
cargo test --locked -p wimm-local-dal --all-features
cargo test --locked --manifest-path apps/desktop/src-tauri/Cargo.toml
pnpm typecheck
pnpm lint
pnpm check:target:architecture
pnpm check:package-graph
```

Keine gesamte DAL04-/Produkt-/Legacy-/Plattformabnahme aus diesem Abschnitt. Produktive Entfernung des IndexedDB-Vorgängers gehört zur vollständigen #109-Integration; Rust-Commitumschaltung bleibt #119. Frühere optionalen Probes und alte Binding-/Vertrags-/KDFformen bleiben #146.

## Aktuelle Drei-Browser-Prüfung

Je fünf reguläre Fälle auf tatsächlicher Chromium-/Firefox-/WebKit-OPFS: leere Bereichsepoche über Worker-/Seitenneustart, tatsächliche Tabwartephase und Handlefreigabe, vollständiger synthetischer P5-Bestand einschließlich bestätigter Daten/Originalentwürfe/Cursor, vollständiger Browserprozess-Neustart mit demselben persistenten Profil sowie Originalreceipt/Idempotenz/Inhaltsabweichung/stale CAS nach Tabübergabe und erneutem Neuöffnen. Alle 15 bestanden. Separater echter WebKit-Privatmodusfall: OPFS-Öffnung RESOURCE_UNAVAILABLE/notCommitted, verständlicher Status failed, kein Write oder Ersatzbackend. Bestanden. Aktuelle Root-Typecheck-/Lint-/Whitespaceprüfungen erfolgreich.

Die neuen typisierten Clientmethoden delegieren ausschließlich an die Rust-Commit-/Receipt-/Indexports; keine zweite JS-Speicher-/Finanzlogik. Die Feld-/Versions-/CAS-/Originalguards sind unverändert. Gesamt-#109 bleibt offen; Schema-CI-Korrektur #147 und wieder geöffnete #108 benötigen noch die aktuelle erforderliche CI.

## Gemeinsamer verschlüsselter Backupstore

Der bestehende native `SqliteBackupStore` verwendet jetzt dieselbe explizite Initialisierung und schemaerhaltende Verbindungskonstruktion auf nativer SQLite und WASM/OPFS. Der Browserworker hält eine getrennte feste Chiffratdatei im selben OPFS-VFS. Typisierte Rust-abgeleitete `persist_backup`-/`read_backup`-Einstiege prüfen das aktive Profil vor dem Zugriff; vollständiger Receipt-Scope und Duplikatverbot bleiben im gemeinsamen DAL. Close gibt beide SQLite-Verbindungen vor dem VFS frei. Schlüssel und Entschlüsselung gelangen nicht in den DAL-Worker.

Aktuelle native Assertions prüfen zusätzlich direkte gemeinsame Verbindungskonstruktion, Ablehnung erneuter Initialisierung und unveränderte Chiffrate nach Wiederöffnung. In Chromium, Firefox und WebKit wird ein ausschließlich synthetischer Prüfsnapshot mit dem bestehenden libsodium-XChaCha20-Poly1305-Protector verschlüsselt, über den produktiven Worker gespeichert, nach Seiten-/Workerneustart bytegleich gelesen und im Client entschlüsselt. Fremdes Profil und überschreibendes Duplikat werden abgewiesen; Originalbytes bleiben erhalten. Diese drei Fälle bestanden. Der anschließende vollständige aktuelle Browserlauf bestand mit 19 erfolgreichen Fällen (18 reguläre Fälle, ein echter WebKit-Privatmodusfall); die nur für WebKit geltende Privatmodusprüfung ist in den zwei anderen Browserprojekten bewusst übersprungen. Native Backup-Suite: sechs erfolgreiche Assertions. Typecheck, Lint, native/WASM-Clippy, positive WASM-Signaturdriftprüfung, Architektur-/Paketgraph-/Dokumentations- und Whitespaceprüfung ebenfalls bestanden. Der Protector ist der bestehende Clientadapter, kein neuer kryptografischer Algorithmus. Ein vollständiger Rust-Restore-/Anwendungsnachweis folgt weiterhin im offenen Integrationsumfang.

```sh
cargo test --locked -p wimm-local-dal --all-features --test sqlite_backup
pnpm exec playwright test --config tests/browser-storage/config.ts --grep 'Verschlüsseltes Backup'
```

## Gemeinsame Rust-Sitzung im produktiven Worker

`crates/local-runtime` übernimmt die bisherigen Tauri-Runtimeports und deren native Assertions als gemeinsame native/WASM-Implementierung. Tauri reexportiert die gemeinsamen Ports; die alte Implementierung und die alte Testkopie sind entfernt. Der Browserhost teilt dieselbe einzelne profilgebundene SQL-Verbindung zwischen elf Speicherports, indizierten Abfragen, Rust-ClientRuntime, Commitreceipts und Originaljournal. Sitzungsschutz verwendet die vorhandenen Rust-libsodium-Primitive, Recovery-AAD und Snapshotformate. Schlüsselbesitz wird bei Sitzungsschluss gelöscht; kein neuer Kryptofallback.

Typisierte Workeraktionen öffnen/schließen eine Rust-Sitzung, führen Load/Execute/History/Resolve aus und liefern auf 100 Aggregate begrenzte Seiten. Seitenparameter durchlaufen die strikte Rust-Datengrenze einschließlich Ganzzahlprüfung. Falsche Versionen, zu große/gebrochene/NaN-Seitengrenzen werden abgewiesen. Nachrichtenhandler wird vor den asynchron geladenen Kryptomodulen registriert; dadurch geht die erste Öffnungsnachricht nicht während ihrer Initialisierung verloren. Build übernimmt die originalen Rust-generierten libsodium-Snippets reproduzierbar; versionierte Signaturen bleiben driftgeprüft.

Aktuelle native Prüfung: acht Runtime-Testeinträge einschließlich echtem Prozesswiederanlauf, falschem Schlüssel bei Originaljournal, verlorenem Ergebnis/Receiptlookup, lokaler Restoreepoche, Undo/Redo und zusätzlichem direkten Sitzungstest. Eine native Browserhost-Assertion sowie verbleibende sieben Tauri-Tests erfolgreich, ein bewusst ignorierter Tauri-Prozesstreiber. Keine native GUI-Abnahme hieraus ableiten.

```sh
cargo test --locked -p wimm-local-runtime -p wimm-browser-runtime
cargo test --locked --manifest-path apps/desktop/src-tauri/Cargo.toml
pnpm exec playwright test --config tests/browser-storage/config.ts --grep 'Gemeinsame Rust-Anwendung'
```

Aktueller vollständiger Drei-Browserlauf: 22 erfolgreich (je sieben reguläre Fälle und ein echter WebKit-Privatmodusfall), zwei bewusst übersprungene Privatmodusfälle außerhalb WebKit. Rust-Befehls-/Undo-/Redo-/Neuladefall in jedem Browser bestanden, einschließlich falscher Bindingversion und zu großer/gebrochener/NaN-Seitengrenzen. Typecheck, Lint, native/WASM-Clippy, Architektur-/Paketgraph-/Dokumentationsprüfung sowie absichtlicher negativer Signaturdrift ohne Überschreiben erfolgreich.

React-Controller/Composition-Root, vollständige Rust-Restore-/Recoverymatrix im Browser, Offline-Produktionsassets, Quota, gemeinsame Gesamtkataloge, indizierte begrenzte UI-Views und 50.000-Buchungen-Grenzen bleiben offen. Die laufende Sitzung lädt derzeit vollständigen Mutationsbestand; diese Abschnittsprüfung ist kein Leistungsnachweis. #109/#119/#146 bleiben offen.
