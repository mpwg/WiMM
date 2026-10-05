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
- Geänderte Verträge: keine; reiner synthetischer Konzeptentwurf. Grünakzent, Budget und Ausgleich sind Designoptionen; keine Änderung der freigegebenen Appgestaltung oder P6-/P7-Implementierung.
- Geprüft: JavaScript-Syntax und reale Chromium-Klickabläufe auf macOS arm64 für Einstieg, Buchung/Teilen/Ausgleich, Budgetbestätigung, Privat-/Haushaltstrennung und Import. Übersichtsbreiten 320, 390, 736 und 1024 Pixel ohne horizontalen Überlauf; keine JavaScript-Laufzeitfehler. Lokale Dokumentationslinks, SPDX-Hinweis und `git diff --check` geprüft.
- Nicht geprüft: vollständiger Dokumentationsvalidator und seine Kontrolltests, da die Projektabhängigkeiten `markdown-it` und `yaml` nach Bereinigung nicht installiert sind. Keine Installation für diesen Ablageauftrag. Native Plattformen, Screenreader und Geräte nicht geprüft; die Konzeptprüfung ersetzt keine Appabnahme.
- Commits: zusammengehöriger Abschnitt auf `codex/ux-flow-konzept-ablage`; Commit ist in der Git-Historie des zugehörigen Pull Requests festgehalten.
- Einschränkungen: keine dauerhafte Speicherung oder Serveranbindung; Import und Finanzaktionen sind simuliert. Optionale Chat-Icons sind außerhalb der Inline-Vorschau nicht verfügbar; alle Aktionen bleiben beschriftet.
- Nächster Schritt: alternative Gestaltung mit dem Nutzer abstimmen. UX-06 bleibt offen; P6–P10 erhalten durch die Ablage keine Freigabe.
