# #82/#83 — Gesicherte Indexmigration und lokale Abfragen

Abnahmesnapshot vom 9. Oktober 2026, Ausgangsstand `f89ebfa`. Fortschritt und Abschlussbelege stehen in [#82](https://github.com/mpwg/WiMM/issues/82) und [#83](https://github.com/mpwg/WiMM/issues/83). Die [native Sicherungsgrundlage](migration-2026-10-09.md) bleibt als historischer Abschnitt erhalten.

## Ergebnis

Registrierter Schritt 1 migriert Storage 1/Fachversion 1 nach Storage 2/Fachversion 1. Vor dem Schritt wird derselbe konsistente Ausgangssnapshot wie beim lokalen Export verschlüsselt und dauerhaft gesichert. Profil, Bereich, Epoche und Snapshot-Hash binden den Beleg; tatsächliches Chiffrat und vollständiger Ausgangsstand werden geprüft. Fehlender Schlüssel, falscher Beleg, Sicherungsfehler, Abbruch oder konkurrierend geänderter Originalentwurf verhindern den Upgrade.

SQLite prüft innerhalb BEGIN IMMEDIATE den vollständigen gespeicherten Snapshot einschließlich aller Entwürfe und Metadaten erneut. DDL, Referenzzeilen, Versionsfortschritt und Journal werden gemeinsam committed. Der native Job beobachtet einen Abbruch vor dem Commit außerhalb des UI-Threads. IndexedDB liest bekannte Versionen ohne automatischen Upgrade; erst der gesicherte Port wechselt physisch von Dexie 1 nach 2. Der Upgrade enthält keine externen Crypto-/Worker-/Netzwerkwartezeiten. Ein Abbruch nach Index-/Journalschreiben rollt auch das physische Schema zurück. Originalbackup bleibt erhalten. Wiederverwendung alter Migrationsnummern und unbekannte/rückwärtsgerichtete Schritte werden abgewiesen.

Pflichtindizes umfassen Konto/Datum/ID, deduplizierte Splitkategorie/Datum/ID, direkte Importreferenz und externe Importquell-ID über Account/Parser/ImportFingerprint sowie Outboxzustand/createdAt/Operations-ID. Regelreihenfolge und Dauerzahlungsfälligkeiten sind als vorhandene P5-Indexadressen ebenfalls abgebildet. Fachdaten und Sekundärreferenzen werden zusammen aktualisiert; Tombstones bleiben als Historie im Fachbestand und verschwinden aus aktiven Indexabfragen. Snapshotersatz und CAS-Fehler erhalten diese Atomarität. Neue Outboxeinträge bekommen den vorhandenen Befehlszeitpunkt; Altentwürfe bleiben unverändert. Altindizes nutzen vorhandenes draft.occurredAt oder einen leeren Sortierschlüssel, anschließend die Operations-ID; es wird keine historische Uhrzeit erfunden.

## Kriterienmatrix

| Issue/Kriterium | Status | Aktueller Beleg |
| --- | --- | --- |
| #82 Versionen/Epoche getrennt; unbekannte Version ohne Write | erfüllt | Vorhandener gemeinsamer negativer Versionskatalog bleibt Bestandteil der nativen Suite; V2 verlangt vollständigen Journalstand |
| #82 Nummerierte Migration/Sicherungsbasis in beiden Adaptern | erfüllt | Tatsächlicher registrierter V1→V2-Schritt mit durabler verschlüsselter Originalsicherung, Hash und atomarem vollständigem CAS |
| #82 Abbruch/Rollback/Neustart | erfüllt | Native Rust-Abbruchcheckpoints nach DDL; echte IndexedDB-Abweisung nach Index-/Journalschreiben; echte Rust-/Chromium-Prozessneustarts |
| #82 Schlüssel-/Sicherungsfehler bewahren Original | erfüllt | Gemeinsame Fehlerfälle fehlender Schlüssel, Sicherungsfehler, falscher Hashbeleg, Abbruch nach Sicherung und konkurrierender Originalentwurf |
| #83 Schema-/Indexabgleich | erfüllt | Reale SQLite-Indizes/Referenztabelle und tatsächliche IndexedDB-Compoundindizes/Referenzstores; feste typisierte Ports |
| #83 Atomare Pflege mit Tombstones | erfüllt | Gemeinsamer Änderungs-/Tombstone-/CAS-/Snapshotersatzkatalog; native SQLite-Referenztrigger und IndexedDB-Gesamttransaktion |
| #83 Konto/Kategorie/Import/Outboxkonformität | erfüllt | Derselbe tatsächliche Katalog in Rust/SQLite und Chromium/IndexedDB, einschließlich externer Importquell-ID und Legacy-Outboxsortierung |
| #83 50.000-Buchungen-Basis, Migration und Trennung | erfüllt | 50.000 aktive Buchungen, zehn Konten, 100 Kategorien und 36 Monate; verschlüsselte Migration, tatsächliche Indexseiten, Profil-/Bereichstrennung |
| README/Verträge | erfüllt | Speicher-/Desktop-README, Schemaentwicklung, Architektur und ADR-048 aktualisiert |

## Prüfungen und Grenzen

Aktuelle Ergebnisse: 26 native Rust-Tests bestanden (zwei gesonderte Prozess-/Katalogtreiber werden durch ihre aufrufenden Tests ausgeführt), 30 tatsächliche Rust-/SQLite-Vertragsfälle, zwei Browser-Sicherungsfälle und elf echte IndexedDB-Migrations-/Indexfälle bestanden. Zusätzlich 17 Speicherpakettests, zwölf Snapshot-/Neuaufbautests und 14 Anwendungstests bestanden. Letzter nativer Vertragslauf: 42,44 s; Browsermigrationen: 17,9 s, Browser-Sicherungsserie: 1,8 s. Typecheck, vollständiger Lint und die genannten Architektur-/Dokumentationsprüfungen bestanden.

Native Rust-Komponenten besitzen direkte Rust-Assertions für Migration, Hash-/Belegbindung, Rollback, DDL-Teilfehler, Indexabfragen, Referenztrigger und Outboxreihenfolge. Der gemeinsame Adapterkatalog verwendet echte Rust-/SQLite-Prozesse und echten Browser-IndexedDB-Speicher. Synthetische Triggerfehler sind keine physische Disk-full-Abnahme.

Prüfbefehle: pnpm check:rust, pnpm test:storage:native, pnpm test:storage:migrations, pnpm test:storage, pnpm test:application, pnpm typecheck, pnpm lint sowie Dokumentation, Paketgraph, Anwendungs-/Kernarchitektur und Whitespaceprüfung. Native Logs: test-results/migration-index-native-rust.log und test-results/migration-index-native-contract.log. Browserlog: test-results/migration-index-browser.log. Letzte Messwerte bei 50.000 aktiven Buchungen: SQLite kalt 13,50 ms, warme p95 Konto 6,43 ms/Kategorie 6,75 ms/Import 6,36 ms; IndexedDB kalt 3,40 ms, warme p95 Konto 2,70 ms/Kategorie 2,40 ms/Import 2,20 ms. Native Messwerte: test-results/migration-index-metrics-sqlite.json; Browsermesswerte werden an den Playwright-Fall angehängt.

Messgrenzen bleiben unverändert: kalte erste Indexseite unter zwei Sekunden, warme p95-Abfragen unter 100 ms. Diese Messung belegt die Speicherabfragebasis; sichtbare UI-Öffnung, Scrollreaktion, native Tauri-Bedienung und die gesamte Oberflächenmatrix bleiben ihre eigenen Kriterien. Die Basis enthält keine neuen P6–P11-Datenmodelle oder 1.000 SharedExpenses, weil dieses Produktpaket nicht freigegeben ist.

Plattform: macOS 27.0.1 arm64, Node 26.10.0/pnpm 12.8.1, Rust 1.99.0, Chromium aus dem gesperrten Playwright 1.63.0; ausschließlich synthetische Daten und Schlüssel. sha2 0.10.9 und base64 0.22.1 waren bereits transitiv gesperrt und sind nun direkte native Hilfsabhängigkeiten; keine neue Bibliotheksversion oder eigene Kryptografie. [Herkunftssnapshot](../dependency-provenance/local-migration.json); das vollständige Register bleibt #72. Globales Rust-Unsafe-Verbot bleibt wirksam. Native GUI, physische Stromausfälle und fehlende Zielsysteme werden hier nicht abgenommen.

## Fortsetzung

Nach dem geprüften Commit Belege in #82/#83 führen und ihre erfüllten Kriterien schließen. Danach #84 tatsächliche Browserpersistenz und #86 verbindliche Rust-Referenzvalidierung, anschließend #85/#77 vollständige gemeinsame Adapterabnahme und aktuelle Nachprüfung #75/#78/#79/#80/#81. K05-Produktumschaltung folgt der freigegebenen Reihenfolge. Fehlende Plattformbelege bleiben gemäß Nutzerantwort vom 9. Oktober offen; zunächst alle Arbeiten auf diesem Mac umsetzen.
