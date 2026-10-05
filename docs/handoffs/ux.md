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

Die fünf Pull Requests bauen aufeinander auf und sind noch nicht zusammengeführt:

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
