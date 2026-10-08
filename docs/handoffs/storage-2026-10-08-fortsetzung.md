# Speicherabnahme nach dem Rechnerwechsel

Stand: 8. Oktober 2026. Datierter Abnahmesnapshot; GitHub führt Fortschritt und Blockaden. Ausgangspunkt `ab16b69`, letzter übergebener Laufzeitstand `cc7b90f`. Aktive Arbeitskopie macOS 27.0.1 arm64, Node 26.10.0, pnpm 12.8.1, Rust 1.99.0, Playwright 1.63.0. Ausschließlich synthetische Finanzdaten und Testschlüssel.

## Snapshotprüfung #80

| Kriterium | Status | Aktueller Beleg |
| --- | --- | --- |
| Unterstützte Versionen, Profil/Bereich/Epoche, IDs, Revisionen und Aggregate prüfen | erfüllt | Gemeinsamer Snapshotkatalog: Version 999, falscher Kontext, ungültige Epoche, fremde/abweichende Handles, Revision null und doppelte Aggregate werden verschlüsselt abgewiesen |
| Verschachtelte Bestätigungen, Entwürfe, Caches und Synczustand prüfen | erfüllt | 26 negative Varianten pro tatsächlichem Adapter einschließlich Bestätigungsepoche, doppelter Operations-ID, doppelter Leserevisionen/Abhängigkeiten, fremdem Entwurfsbereich und Cursorbindung |
| Fachreferenzen und Cachewerte prüfen; Originalbestand erhalten | erfüllt | Fehlende Kategorie, falscher Saldo und unbekannte Cacheart abgewiesen; vollständiger Originalsnapshot nach jeder Ablehnung und erneutem Speicheröffnen unverändert |
| Echter SnapshotProtector und beide dauerhaften Adapter | erfüllt | Vier identische Fälle gegen echten DesktopStorageAdapter/Rust/SQLite-Datei und echte Chromium-IndexedDB; tatsächliche libsodium-Verschlüsselung, falscher Schlüssel ohne Write, P5-/Entwurfsroundtrip und fremde Handles in Aggregate/Confirmed/Outbox |
| P5- und Originalentwurfkompatibilität | erfüllt | CSV-Mapping, vollständige/teilweise Importgruppe, ursprünglicher Fingerprint nach Kontowechsel, Regel, bestätigte/übersprungene Dauerzahlungsfälligkeit, abweichendes Zahlungsdatum, historische archivierte Referenz und Tombstone; alle sieben Pendingzustände und unveränderte ursprüngliche Eingaben |
| README und wiederholbare Prüfkette | erfüllt | README beschreibt Verfahren/Grenzen; `test:storage:native` in `check:all`, gemeinsamer Browserkatalog in regulärer Speicherintegration; tests/storage in Typecheck aufgenommen |

Prüfungen auf diesem Abschnitt: vier gemeinsame native Snapshotfälle, 30 Chromium-/IndexedDB-Fälle einschließlich acht neuer gemeinsamer Katalogausführungen, 25 bestehende Speicher-/Schutzporttests und zwölf reguläre Rusttests bestanden. Der Rust-Testtreiber ist in der regulären Rustserie absichtlich nicht interaktiv gestartet; `test:storage:native` startet ihn ausdrücklich und prüft seine Ergebnisse. Typecheck, gezielter Oxlint mit Warnungen als Fehler, Rustformat, Clippy, Paketgraph, Dokumentationsvalidator und Whitespaceprüfung bestanden.

SQLite benutzt den echten Rust-Speichercode und eine Datei; Neustart beendet den nativen Testprozess vollständig. Der JSON-Testtransport ersetzt ausschließlich Tauri-IPC, keine Datenbank oder Fachberechnung. Er existiert nur im Testbinary und erweitert keine Produkt-Capabilities. Browserneustart dieses Katalogs bedeutet Adapter schließen/erneut öffnen. Die beiden Browserprojektlabels laufen auf derselben echten IndexedDB-Testseite und sind keine native SQLite-Komposition.

## Gesamtstatus und Folge

[#80](https://github.com/mpwg/WiMM/issues/80) besitzt damit seine konkrete Snapshotabnahme. Die vollständige gemeinsame Konformität [#85](https://github.com/mpwg/WiMM/issues/85) bleibt offen; der Snapshotkatalog alleine schließt weder Batch-/Syncseiten-/Quota-/Mehrtabkriterien noch native GUI-/Disk-full-Abnahmen. Projektionsneuaufbau [#81](https://github.com/mpwg/WiMM/issues/81) folgt vor Migration [#82](https://github.com/mpwg/WiMM/issues/82); weitere Voraussetzungen und Gesamtabnahme stehen in [#87](https://github.com/mpwg/WiMM/issues/87). Keine zusätzliche Freigabe für P6–P11 oder K01–K11. Kein vollständiger neuer CI- oder Releasebuildbeleg dieses Abschnitts.

## Projektionsneuaufbau #81

Abnahmesnapshot vom 8. Oktober 2026 nach dem Fortsetzungsauftrag; Umsetzung gemäß ADR-045.

| Kriterium | Status | Aktueller Beleg |
| --- | --- | --- |
| Vollständigen aktuellen Bereichsbestand fachlich berechnen und atomar ersetzen | erfüllt | Gemeinsame Speicherformatierung ruft ausschließlich vorhandene Fachkernvalidatoren und Saldo-/Konsumfunktionen auf; IndexedDB-Schreibtransaktion, Memory-Warteschlange, SQLite-Transaktion mit vollständigem Ausgangsbestandsvergleich |
| Inkrementelles Ergebnis, Tombstones, Opening, Transfers und Erstattung | erfüllt | Identischer expliziter Katalog auf beiden echten Adaptern: Opening 100.000 Cent, Ausgabe 10.000, Einnahme 20.000, Erstattung 2.000, Transfer 20.000 ergibt Salden 92.000/20.000/0 und Verbrauch 8.000 bei Einkommen 20.000; gelöschte Ausgabe 50.000 ignoriert; Legacy-/Monatsadressen und Neuaufbau ohne vorhandene Caches geprüft |
| Profil-/Bereichstrennung, Überlauf und Fehler vor Commit erhalten Bestand | erfüllt | Andere Profile/Bereiche unverändert; Überlauf lehnt Neuaufbau vor Löschung ab; Fehler bei zweiter Cachezeile rollt begonnenen Ersatz samt erster Zeile zurück; Aggregate, Bestätigungen, Originalentwürfe, Cursor und Epoche unverändert; erneuter Neuaufbau nach Fehler möglich |
| Gemeinsame echte SQLite-/IndexedDB-Prüfung ohne Rust-Finanzengine | erfüllt | Vier neue gemeinsame Szenarien plus zwei deterministische native CAS-Fälle für neues Aggregat und Änderung ohne Revisionserhöhung; parallel gespeicherte Buchung verliert keine Werte; dauerhaftes erneutes Speicheröffnen und echter SQLite-Prozessneustart |
| README/Verträge/Prüfkette | erfüllt | README, Speicherarchitektur, ADR-045, P3-Status und reguläre Speicherprüfungen aktualisiert; keine Schema- oder Finanzformatmigration |

Aktuelle Serie auf dem fertigen Abschnitt: zehn native Contractfälle, 38 echte Chromium-/IndexedDB-Ausführungen, 26 Speicher-/Schutzporttests, 94 Fachtests und zwölf reguläre Rusttests bestanden. Typecheck, vollständiger Oxlint mit Warnungen als Fehler, Rustformat/Clippy, Paketgraph, Dokumentations- und Whitespaceprüfung bestanden. SQLite-Rollback wird durch einen ausschließlich im Testtreiber installierten Trigger bei der zweiten Cachezeile ausgelöst; Browserrollback durch einen gezielt geworfenen QuotaExceededError im echten IDB-Schreibpfad. Dies sind Fehlerproben, keine tatsächlichen Disk-full-/Quota-Abnahmen. Native GUI-/Screenreader-/Geräte- und Gesamt-CI-Abnahme bleiben gesondert offen. Nächster Speicherabschnitt: gesicherte vorwärtsgerichtete Migration #82.
