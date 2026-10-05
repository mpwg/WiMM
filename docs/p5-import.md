# P5 — Teilaufgaben für Import und Automatisierung

## Auftrag und Reihenfolge

Diese Teilaufgaben konkretisieren [P5](tasks.md#p5--import-und-automatisierung). Der ausdrückliche Nutzerauftrag „Setze P5.* um“ vom 5. Oktober 2026 gibt P5.1–P5.6 frei und erlaubt die Fortsetzung trotz offener P4-Abnahmen. Die zuvor ausdrücklich verschobenen Windows-/Linux-Prüfungen sowie die übrigen P4-Lücken bleiben sichtbar. Parser- und Fachregeln stehen weiterhin in den verlinkten Quellen.

Status und konkrete Prüfbelege hier sowie den Gesamtstatus in [tasks.md](tasks.md) pflegen; nach jedem abgeschlossenen Abschnitt einen zusammengehörigen Zwischencommit und eine [Übergabe](templates/handoff.md) erstellen. P5 ist erst nach allen Teilabnahmen und der Gesamt-Abnahme erledigt; danach folgt [P6](p6-budget.md). Für die Umsetzung wimm-finance und für die Importflächen wimm-ui verwenden. Kein Bankabruf und keine direkte Actual-Budgetmigration in diesem Paket.

## P5.1 — Parserauswahl und normalisierte Zwischenform

- Status: erledigt (5. Oktober 2026); P5.1-Kriterien auf macOS arm64 abgenommen, Windows-/Linux-Läufe folgen später.
- Freigabe: ausdrücklicher Nutzerauftrag für P5.1 vom 5. Oktober 2026.
- Voraussetzungen: P4; offene P4-Abnahmen für diesen Auftrag ausdrücklich zurückgestellt, ohne P4 als erledigt zu markieren.
- Schritte: gepflegte CSV-/XML-/OFX-/QFX-Parser anhand offizieller Quellen und Lizenzen wählen/sperren; Herkunft dokumentieren; normalisierte Importtypen, Workerport und Limits vor/während Verarbeitung anlegen.
- Ergebnis: gemeinsame Parserpipeline mit Quellzeilen und strukturierten Fehlern.
- Verträge: [Dateiformate](formats.md), [Architektur](architecture.md), [Parserfixtures](testing.md#zugriff-und-parser).
- Abnahme: etablierte Parser, keine Eigenparser; Datei maximal 25 MiB und 100.000 Buchungen; kein Netzwerkzugriff/Dateiupload im Parser; exakte Centnormalisierung.
- Prüfungen: Lizenz-/Versions-/Paketgrenzenprüfung, Grenzdateien, Abbruch und fehlerhafte Zwischenwerte.
- Prüfbelege: 32 Importertests, 53 Fachtests und echter Chromium-Worker mit Abbruch/Neustart bestanden; TypeScript, Lint, Paketgraph, gesperrte Installation und Dokumentationsprüfungen bestanden. Parserauswahl, Originalhinweise, Nutzung und Grenzen in der [Paket-README](../packages/importers/README.md); aktuelle [Kriterienmatrix und Übergabe](handoffs/p5-1.md). Windows/Linux bleiben ausdrücklich verschoben.

## P5.2 — CSV-Mapping und Vorschau

- Status: umgesetzt; CSV-Kriterien auf macOS arm64 in Chromium-Web/Desktop-Frontend abgenommen (5. Oktober 2026). Physische Geräte bleiben Teil der Gesamt-Abnahme.
- Freigabe: ausdrücklicher Nutzerauftrag „Setze P5.* um“ vom 5. Oktober 2026.
- Voraussetzungen: P5.1 erledigt.
- Schritte: Encoding-/Trennzeichen-/Kopfzeilenauswahl, explizite Datums-/Zahlenformate und Soll/Haben-Mapping umsetzen; Vorlagen speichern; Originalzeilen neben normalisierten Buchungen und Fehlern anzeigen.
- Ergebnis: korrigierbare CSV-Vorschau vor jeglicher Buchungsübernahme.
- Verträge: [CSV](formats.md#csv), [Importablauf](product.md), [Parserfälle](testing.md).
- Abnahme: UTF-8/BOM/Windows-1252, Quotes und Mehrzeilen korrekt; 1.234,56 exakt; gleichzeitig gefülltes Soll/Haben Fehler; ungültige Zeilen nur nach Korrektur oder ausdrücklichem Ausschluss übernehmbar.
- Prüfungen: CSV-Fixtures, Vorlagenwiederverwendung, Datum-/Signfehler und Vorschau-/Korrekturablauf per Tastatur/Touch.
- Prüfbelege: 47 Importertests insgesamt; echte Vorschau/Korrektur, persistente Vorlagen und Fehlerentscheidungen per Tastatur/Touchemulation auf beiden Frontends. [Kriterienmatrix](handoffs/p5.md).

## P5.3 — CAMT.053 und OFX/QFX

- Status: erledigt (5. Oktober 2026); Parser-/Normalisierungskriterien durch alle Formatfixtures belegt.
- Freigabe: ausdrücklicher Nutzerauftrag „Setze P5.* um“ vom 5. Oktober 2026.
- Voraussetzungen: P5.2 erledigt.
- Schritte: CAMT-Namespaces und Entry-/TransactionDetails abbilden; OFX SGML/XML und QFX normalisieren; externe IDs, Finanzdatum und EUR prüfen; Sammelbuchungen sowie Kontozuordnung ausdrücklich vorschlagen.
- Ergebnis: bankdateibasierter Import über dieselbe Vorschaupipeline.
- Verträge: [CAMT/OFX/QFX](formats.md#camt053-und-ofxqfx), [Finanzdatum](domain.md), [Parserfehlfälle](testing.md).
- Abnahme: keine DTD/externen Entitäten; Nicht-EUR abgewiesen; Detailbeträge nur bei exakter Entrysumme vereinzelt; Kontosalden erzeugen keine automatische Korrektur, Konten keine automatische Neuanlage.
- Prüfungen: Namespacevarianten, mehrere Details, fehlerhafte Summen, FITID, OFX-Datumsnormalisierung, DTD/Entitäten und Nicht-EUR.
- Prüfbelege: 47 Importertests insgesamt: CSV/CAMT/OFX/QFX, Namespacevarianten, Detailsummen, FITID, EUR, Datum und DTD/Entitäten. [Kriterienmatrix](handoffs/p5.md).

## P5.4 — Dubletten, gruppierte Übernahme und Wiederaufnahme

- Status: erledigt (5. Oktober 2026); Fach-/Webkriterien und echte native macOS-arm64-Großimport-/Disk-full-Wiederaufnahme abgenommen.
- Freigabe: ausdrücklicher Nutzerauftrag „Setze P5.* um“ vom 5. Oktober 2026.
- Voraussetzungen: P5.3 erledigt.
- Schritte: Quell-ID-Konflikte und normalisierte Fingerprintkandidaten ermitteln; Entscheidungen speichern; bestätigte Gruppen bis 100 Buchungen über Fachbefehle übernehmen; Import-ID/Quellzeile und Fortschritt dauerhaft speichern.
- Ergebnis: abbrechbarer, wiederaufnehmbarer Import mit nachvollziehbaren Dublettenentscheidungen.
- Verträge: [Dubletten und Importablauf](formats.md), ImportBatch/ImportFingerprint in [Datenmodell](data-model.md), [StorageAdapter](architecture.md).
- Abnahme: echte gleiche Zahlungen ausdrücklich getrennt möglich; gleiche ID mit anderem Inhalt Prüfkonflikt; Wiederaufnahme ohne Doppelbuchung; Teilübernahme klar angezeigt; kein Gesamtabbruch mit behauptetem Vollrollback.
- Prüfungen: Wiederimport, bewusst zugelassene Dublette, Abbruch vor/nach Gruppencommit, Quota/Disk-full und Großimport ohne blockierenden UI-Thread.
- Prüfbelege: Fachtests, echte IndexedDB-Gruppen 100/100/5, vollständiger Chromium-Neustart, simulierte Speicherfehler und Teilwrite-Rollback, 99.999-Zeilen-Vorschau und Zwei-Tab-CAS; native SQLite-Wiederaufnahme auf macOS arm64. Native 10.000-Zeilen-Vorschau, erste Gruppe, tatsächlich volles Testvolume, vollständiger SQLite-Rollback und Offline-Wiederaufnahme bestanden; [Matrix](handoffs/p5.md) und [native Teilabnahme](handoffs/p5-native.md).

## P5.5 — Deterministische Buchungsregeln

- Status: erledigt (5. Oktober 2026); deterministische Fachregeln und UI-Verwaltung abgenommen.
- Freigabe: ausdrücklicher Nutzerauftrag „Setze P5.* um“ vom 5. Oktober 2026.
- Voraussetzungen: P5.4 erledigt.
- Schritte: rule.save/delete/reorder mit Revisionen implementieren; katalogisierte Bedingungen/Aktionen und stopProcessing auswerten; Regeln in Importvorschau und Verwaltung integrieren.
- Ergebnis: nachvollziehbare Regelanwendung ohne ausführbare Skripte.
- Verträge: [Regeln](domain.md), Rule in [Datenmodell](data-model.md), [Fachbefehle](api.md#fachbefehle).
- Abnahme: feste Reihenfolge, Stop beendet Folgeauswertung; nur erlaubte Felder/Aktionen; Ergebnis weiterhin fachvalidiert; Umordnung atomar und revisionsgeprüft.
- Prüfungen: Reihenfolge/Stop, kollidierende Regeln, fremde Kategorien, ungültige Aktionen, Replay derselben Vorschau und UI-Verwaltung.
- Prüfbelege: Reihenfolge/Stop, Replay, erlaubter Katalog, fremde Referenzen, atomare Umordnung und UI-Bearbeitung/Löschung; insgesamt 68 Fachtests. [Kriterienmatrix](handoffs/p5.md).

## P5.6 — Dauerzahlungen und Gesamt-Abnahme

- Status: in Arbeit: Dauerzahlungen umgesetzt und fachlich/in Chromium abgenommen; Gesamt-Abnahme wegen Firefox-, Geräte- und Screenreaderprüfungen offen.
- Freigabe: ausdrücklicher Nutzerauftrag „Setze P5.* um“ vom 5. Oktober 2026.
- Voraussetzungen: P5.5 erledigt.
- Schritte: Schedule-/Occurrence-Befehle, ursprünglichen Fälligkeitstag, Bestätigung/Überspringen und explizite Importzuordnung umsetzen; fällige Vorschläge/Verwaltung anbinden; gesamte Import-/Automatisierungssuite integrieren.
- Ergebnis: wiederkehrende Vorschläge und abgenommene Dateiimporte ohne Doppelbuchung.
- Verträge: [Dauerzahlungen](domain.md), [Schedule-Befehle](api.md), [P5](tasks.md#p5--import-und-automatisierung), F14 in [Tests](testing.md).
- Abnahme: F14 und alle vier Formatfixtures bestanden; Vorschläge verändern keine Salden; wiederholte Bestätigung idempotent; Importzuordnung erzeugt keine zweite Fälligkeit/Buchung.
- Prüfungen: Monatsende/Schaltjahr/Intervall/Enddatum, Doppelbestätigung und Importzuordnung; Parser-/Dubletten-/Limit-/Abbruchsuite sowie UI-Abläufe und Fachregressionen.
- Prüfbelege: F14, Monatsende/Schaltjahr/weekly/yearly/Enddatum, sichere Kontosummen, wiederholte Bestätigung/Skip und ausdrückliche Importzuordnung; gebaute PWA offline einschließlich beider bisher ungenutzter Worker. [Kriterienmatrix](handoffs/p5.md) nennt bestandenen echten Browserzoom 200 % sowie verbleibende Firefox-, Geräte- und Screenreaderprüfungen.
