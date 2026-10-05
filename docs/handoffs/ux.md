# Übergabe UX-Neugestaltung

## Ergebnis

UX-01–UX-05 implementiert: Gestaltung, Navigation, Liste zuerst, Erfassungs-/Kontodialoge, Verwaltung und vierstufiger Import. UX-06 prüft den aktuellen Gesamtstand.

## Kriterienmatrix

| Kriterium | Status | Beleg |
| --- | --- | --- |
| Konzept und Freigabe | erfüllt | [UX-Konzept](../ux-redesign.md), Nutzerauftrag 5. Oktober 2026 |
| Desktop-/Mobilentwürfe | erfüllt | [Synthetische Entwürfe](../assets/ux-wireframes.svg) |
| Implementierung UX-02–UX-05 | erfüllt | Quellstand und sieben Chromium-UX-Tests |
| Aktuelle Gesamtabnahme | offen | UX-06: vollständige Regression und Plattformmatrix |
| Native und physische Geräteprüfung | offen | Verfügbarkeit je Plattform feststellen |

## Nächster Schritt

UX-06: aktuelle Gesamtabnahme und Regression der geänderten Bedienabläufe. P6–P10 bleiben nicht freigegeben.

## Haltepunkt am 5. Oktober 2026

Auf Nutzerwunsch nach UX-05 angehalten. Die Implementierung ist gesichert; die gesamte Neugestaltung ist noch nicht abgenommen. Aktiver Branch: `codex/ux-05-verwaltung-import`, Implementierungscommit: `f37f40a`.

Die fünf Pull Requests bauen aufeinander auf. UX-01–UX-04 sind inzwischen auf `main` integriert; UX-05 folgt mit PR 20. Der Nutzer hat am 5. Oktober 2026 den Merge aller fünf UX-PRs und das Übergehen der GitHub-Prüfregeln ausdrücklich freigegeben. Diese Freigabe ersetzt keine UX-06-Gesamtabnahme. Die Ubuntu-Prüfung von UX-05 meldete 33 fehlgeschlagene und fünf bestandene bestehende UI-Tests; die offenen Prüfungen unten bleiben bestehen.

- [UX-01: Konzept – PR 15](https://github.com/mpwg/WiMM/pull/15)
- [UX-02: Gestaltung – PR 16](https://github.com/mpwg/WiMM/pull/16)
- [UX-03: Navigation – PR 17](https://github.com/mpwg/WiMM/pull/17)
- [UX-04: Buchungen und Konten – PR 18](https://github.com/mpwg/WiMM/pull/18)
- [UX-05: Verwaltung und Import – PR 20](https://github.com/mpwg/WiMM/pull/20)

Am Stand UX-05 bestehen Typecheck, Linter, Dokumentationsprüfung, sieben gezielte Chromium-UX-Tests und 47 Importtests. Am Stand UX-04 bestanden außerdem 71 Fachkerntests und zwölf UI-Komponenten-/Kontrasttests; diese wurden nach UX-05 noch nicht vollständig wiederholt.

Für die Fortsetzung in UX-06:

- Bestehende Ablauf- und Abnahmetests an Dialoge, Einstellungsnavigation, Filter und die vier Importstufen anpassen. Ihre bisherigen Schutz- und Fehlerszenarien erhalten; die vollständige alte Regression wurde nach der Neugestaltung noch nicht ausgeführt.
- Die neue Testsuite `tests/ux/config.ts` in die regulären Prüfbefehle und CI aufnehmen; Firefox und WebKit zusätzlich zu Chromium prüfen.
- Aktuelle visuelle Belege für die Größen-, Hell-/Dunkel- und Zoommatrix erstellen. Die SVG-Entwürfe sind Konzeptbelege, keine Laufzeitabnahme.
- Mobile Zeilenhöhen bei langen Namen und Zoom sowie Eingabesperren während der Kontoanlage gezielt prüfen.
- Gesamtbuilds, Offlineverhalten und die Leistungsziele mit 50.000 Buchungen erneut prüfen.
- Tastatur, Fokus und Screenreader sowie native Menüs, echte mobile Tastatur und sichere Bildschirmflächen prüfen. Fehlende Plattformen und Geräte ausdrücklich als offen dokumentieren.

Manueller Aufruf der gezielten Suite: `pnpm exec playwright test --config tests/ux/config.ts --project Chromium`. Vor der Gesamtabnahme sämtliche relevanten Prüfungen auf dem dann aktuellen Stand ausführen.

## Ablage des alternativen UX-Flows

- Ergebnis: Auf Nutzerauftrag vom 5. Oktober 2026 ist der [klickbare alternative UX-Flow](../assets/ux-flow-konzept.html) dauerhaft unter `docs/assets` abgelegt. Der vorherige Pfad unter `.toolchain-checks` fehlte; die temporäre Ablage ist für ein dauerhaftes Konzept ungeeignet. [Konzeptbeschreibung](../ux-redesign.md#alternativer-klickbarer-ux-flow) und Aufgabenübersicht verlinken die neue Ablage.
- Geänderte Verträge: keine; reiner synthetischer Konzeptentwurf. Zum damaligen Ablagezeitpunkt waren Grünakzent, Budget und Ausgleich Designoptionen. Der anschließende Implementierungsauftrag gibt Grünakzent und vorhandene Abläufe frei; P6/P7 bleiben spätere Fachpakete.
- Geprüft: JavaScript-Syntax und reale Chromium-Klickabläufe auf macOS arm64 für Einstieg, Buchung/Teilen/Ausgleich, Budgetbestätigung, Privat-/Haushaltstrennung und Import. Übersichtsbreiten 320, 390, 736 und 1024 Pixel ohne horizontalen Überlauf; keine JavaScript-Laufzeitfehler. Lokale Dokumentationslinks, SPDX-Hinweis und `git diff --check` geprüft.
- Nicht geprüft: vollständiger Dokumentationsvalidator und seine Kontrolltests, da die Projektabhängigkeiten `markdown-it` und `yaml` nach Bereinigung nicht installiert sind. Keine Installation für diesen Ablageauftrag. Native Plattformen, Screenreader und Geräte nicht geprüft; die Konzeptprüfung ersetzt keine Appabnahme.
- Commits: zusammengehöriger Abschnitt auf `codex/ux-flow-konzept-ablage`; Commit ist in der Git-Historie des zugehörigen Pull Requests festgehalten.
- Einschränkungen: keine dauerhafte Speicherung oder Serveranbindung; Import und Finanzaktionen sind simuliert. Optionale Chat-Icons sind außerhalb der Inline-Vorschau nicht verfügbar; alle Aktionen bleiben beschriftet.
- Damals nächster Schritt: alternative Gestaltung mit dem Nutzer abstimmen. Die neue Freigabe und Umsetzung stehen unten. UX-06 bleibt offen; P6–P10 erhalten durch die Ablage keine Freigabe.

## Umsetzung des freigegebenen UX-Flows am 5. Oktober 2026

Der neue Implementierungsauftrag übernimmt den klickbaren Flow für bestehende Funktionen. Grünakzent, warme Hell-/Dunkelflächen, „WiMM.“, separater Bereichskopf, „Alles im Blick.“, tatsächlicher Kontostand, letzte fünf Buchungen und fällige Zahlungsvorschläge sind umgesetzt. Bestehende Dialoge, vier Importstufen, Desktopvirtualisierung, Fehlerschutz und Finanzverträge bleiben erhalten. P6/P7 sind nicht Teil dieser Umsetzung.

Geprüfter Implementierungsstand: `861e498` (UI-Änderungen bis `430a4b0`) auf `codex/ux-flow-umsetzung`, nach `cc9f0d2`. Die folgenden Belege stammen vom aktuellen UI-Quellstand, auf macOS 27 arm64 / Apple M4 Pro, ausschließlich mit synthetischen Daten. Lokale Rohprotokolle stehen unter `.toolchain-checks/ux-flow-*.log`, Browseraufzeichnungen unter `test-results/`; beide sind bewusst nicht Teil des Repositorys. Dauerhafte Screenshots und Messungen liegen unter [UX-Laufzeitbelege](../assets/ux-flow-runtime/README.md).

| Kriterium | Status | Konkreter Beleg / Grenze |
| --- | --- | --- |
| Gemeinsame Gestaltung und vorhandene Funktionen | erfüllt | UI-Tokens, tatsächliche Übersicht, Navigation und Einstieg in `packages/ui/src`; keine Fachkern-, Crypto-, Speicherformat- oder API-Änderung |
| Designfreigabe und READMEs | erfüllt | UI-Spezifikation, UX-Konzept, ADR-035, Aufgaben sowie UI-/Web-/Desktop-README aktualisiert |
| Fach-, Crypto-, Speicher- und Importregression | erfüllt | `pnpm test`: 4 Vertrags-, 71 Fachkern-, 14 Crypto-, 9 Speicher-, 2 Server-, 12 UI- und 47 Importtests; Service-Worker-Tests ebenfalls erfolgreich |
| Buchung, Erstattung, Splits, Archivierung und Empfängermerge | erfüllt | `pnpm test:ui:build`: 38 Web- und 35 Desktop-Frontendfälle bestanden; Web-PWA-Fall wird separat im gebauten Offline-Lauf geprüft, Browser-Dateiporttest ist im Desktoplauf bewusst ausgelassen und native Dateiport-Teilbelege stehen unten |
| Transfer, Abgleich, Undo/Redo, Fehler und Konflikte | erfüllt | `pnpm test:ui:integration`: 58 bestanden für Web und Desktop-Frontend; atomarer Partial-write-Rollback, Quota/Disk-full, Entwurfsabbruch und veraltete Revisionen |
| Importwiederaufnahme und Bedienbarkeit | erfüllt | Echter Browserprozessneustart mit 205 Zeilen, konkurrierende Tabs, 99.999-Zeilen-Worker und pausierter Commit in der Integrationssuite; separater Importworker-Test bestanden |
| Tresorsperre und Bereichstrennung | erfüllt | Falsche Passphrase und gesperrte Ansicht ohne Finanzansicht; Bereichswechsel in UI-/UX-/Browserabläufen; Chromium und WebKit |
| Größen, Hell/Dunkel, lange deutsche Namen und große Beträge | erfüllt | `pnpm test:ui:matrix`: 24 bestanden; 320×568, 390×844, 768×1024, 1440×900, 1920×1080 für Web und Desktop-Frontend, beide Farbschemata; Dialogüberlauf und modaler Tastaturfokus geprüft |
| WCAG-AA-Kontraste und Touchziele | erfüllt | Zwölf Komponenten-/Tokenprüfungen; Text-/Grenzkontrast und 44-Pixel-Designregeln; kein Ersatz für Screenreaderabnahme |
| Echter Browserzoom 200 % | offen | `pnpm test:ui:zoom`: echter Chromium-Systemmenüzoom bestanden, einschließlich messbar verdoppelter Pixeldichte, halbierter CSS-Breite, Betrag, Fehler und Fokus. Vollständige Kombination aller fünf Größen und beider Farbschemata bei echtem Zoom fehlt |
| Chromium und WebKit | erfüllt | Je sieben UX-Tests; je zwei Produktionsbrowserabläufe für Web/Desktop-Frontend inklusive Prozessneustart bestanden |
| Firefox | erfüllt | Ubuntu-CI am Stand `2c20bfa`: alle sieben Firefox-UX-Fälle bestanden. Lokal auf macOS beendet Firefox 1543 den Profilstart mit „Could not find profile folder“; die beiden lokalen Produktionsbrowserfälle bleiben dort nicht prüfbar und werden nicht als bestanden ausgegeben |
| Produktionsbuilds | erfüllt | `pnpm build`: beide Frontends; separater Tauri-Releasebuild. Enge Lucide-Transformation entfernt ausschließlich die für diese reinen Clients bedeutungslose Modul-Direktive; Warnungsregeln bleiben aktiv |
| Gebauter PWA-Offline-Neustart | erfüllt | `pnpm test:ui:offline`: zwei bestanden; Passphrase/Rettungscode und bisher ungenutzter Importworker bei ausgeschaltetem Netzwerk, dauerhaft übernommene Daten |
| Leistung mit 50.000 Buchungen | erfüllt | Kaltöffnung 501/515 ms, warme Öffnung 29/29 ms, Filter-p95 34/34 ms, Scroll-p95 34/34 ms; höchstens 16 DOM-Zeilen, Treffer- und Positionsorakel. Vite/IndexedDB-Messung für Web und Desktop-Frontend, keine native SQLite-Leistungsmessung |
| Reguläre Prüfbefehle und CI | erfüllt | `test:ux` in `check:all`; CI installiert Chromium, Firefox und WebKit. Typecheck, Linter, Rust-Format/Clippy/fünf Rust-Tests bestanden |
| Native macOS-Menüs, Kurzbefehle und Dateiportale | erfüllt | Tatsächliche Menüs Ansicht → Übersicht, Datei → Neue Buchung, Bearbeiten → Rückgängig/Wiederholen: Finanzstand 900 → 1.000 → 900 €. Text-Undo mit leerem Betragsfeld; Cmd+N öffnet den Dialog, Cmd+F fokussiert Durchsuchen. Native Öffnen-/Speichern-Dialoge samt Abbruch, gelesene synthetische TXT-Datei, tatsächlich gespeicherte Portdatei und abgewiesene unzulässige Commands/Pfade/Links |
| Native macOS-Offline-Neustart | erfüllt | Separater Tauri-Releaseprozess mit isoliertem Profil `wimm/ux-flow-native/v2`, SQLite-Konto 1.000,00 €. Tresor gesperrt und Prozess beendet; echter Neustart mit `sandbox-exec` und `(deny network*)`, zunächst keine Finanzansicht, dann Passphraseentsperrung und gespeicherte 1.000,00 € sichtbar |
| Physische Geräte, Screenreader, Windows/Linux | nicht prüfbar | Keine Geräte-/Screenreaderinteraktion oder native Windows-/Linuxlaufzeit verfügbar. Browseremulation zählt hierfür nicht |

UX-06 ist **nicht vollständig abgenommen**. Nächste Schritte sind die vollständige echte Zoommatrix, Geräte-/Screenreaderbelege und weitere native Plattformen. Fehlende Belege werden nicht durch Screenshots, Emulation oder Builds ersetzt.

Native Teilbelege: [AX-Protokollauszüge](../assets/ux-flow-runtime/native-macos.json) aus dem isolierten zweiten Prüfprofil. Der erste Prüfprofilversuch hatte keine verlässlich reproduzierte Passphrase und ist kein positiver Neustartbeleg. Das zweite Profil wurde neu angelegt, sein Anfangsbestand bestätigt gespeichert und nach echtem Netzwerk-aus-Prozessneustart wieder geöffnet. Die native Prüfung ersetzt weder Geräte-/Screenreaderabnahme noch Windows-/Linuxlaufzeiten. Native Importgruppierung und Fehlerfälle sind durch diese Einzelbelege nicht zusätzlich abgenommen.

## Ergänzende CI- und macOS-Belege

Der [vollständige Ubuntu-Lauf am Stand `2c20bfa`](https://github.com/mpwg/WiMM/actions/runs/37358666680) besteht: `pnpm check:ci` einschließlich 38 Web-, 36 Desktop-Frontend-, 58 Speicherintegrations-, 24 Matrix-/Leistungs-, 21 UX-Browser-, zwei PWA-Offline- und eines Workerfalls. Alle sieben Firefox-UX-Fälle laufen auf dieser funktionierenden Linuxlaufzeit. Auch die drei CodeQL-Analysen bestehen. Die anschließend ergänzten Dateien ändern ausschließlich die Dokumentation und Belege; Dokumentationsvalidator und seine Kontrolltests wurden danach erneut ausgeführt.

Weitere tatsächliche macOS-Interaktionen im isolierten Prüfprofil: synthetische TXT-Datei gelesen; Speicherport schreibt den erwarteten Inhalt im Prüfdateiordner; 100-€-Ausgabe dauerhaft gespeichert, über Bearbeiten → Rückgängig auf 1.000 € und Wiederholen zurück auf 900 €; Cmd+N öffnet die Erfassung und Cmd+F fokussiert Durchsuchen. AX-Auszüge und gespeicherter Prüftext stehen im verlinkten nativen Beleg. Es wurden keine realen Dateien importiert oder überschrieben.
