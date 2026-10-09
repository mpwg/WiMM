# Gemeinsame WiMM-Oberfläche

React-Komponenten für PWA und Tauri, deutsche Sprache/Umlaute, Systemschriften, Lucide-Icons und native Plattformdienste. Die bestätigte Gestaltung nutzt Grünakzent, warme Flächen, ruhige Listen und die Wortmarke WiMM. [UI-Spezifikation](../../docs/ui.md), [UX](../../docs/ux-redesign.md).

## Bestand und Rust-Ziel

Im Bestand beobachtet die UI die außerhalb React liegenden TypeScript-Controller aus application; einzelne Eingabe-/Ansichtshelfer kommen noch aus domain. Konkrete Speicheradapter werden durch Web-/Desktop-Einstiegspunkte injiziert. Im [Rust-Ziel](../../docs/architecture.md) bleiben Darstellung, Navigation, Fokus und Formulardrafts hier; Fachberechnung, Commitkoordination, Historie und Schlüsselverwaltung laufen in der gemeinsamen Rust-Anwendung. Die UI erhält generierte Anwendungs-/Ansichtstypen und begrenzte Daten. Keine zweite Fachengine oder ORM-/SQL-Schnittstelle im Widget.

## Vorhandene Abläufe

Lokales Profil mit Tresor/Recovery, Bereichswechsel, Übersicht, Konten/Kategorien/Empfänger, Buchungen/Splits/Transfers/Abgleich, Importvorschau und bestätigte Gruppen, Regeln, Dauerzahlungen und revisionsgeschützte Undo/Redo-Aktionen. Standalone benötigt keine Anmeldung/Serveroutbox. Budget/Familienausgleich und weitere Server-/Syncfeatures bleiben eigene spätere Pakete; keine synthetischen Konzeptwerte als echte Finanzen anzeigen.

Desktop verwendet Seitenleiste und Systemmenüs, mobile Ansichten Übersicht/Buchungen/Mehr. Formulardrafts erhalten Navigationsschutz, Dialoge Fokusfang/-rückgabe, Tastatur-/Touchbedienung und verständliche Fehler. Native Datei-/Link-/Tokenfunktionen werden injiziert. Web fragt den tatsächlichen Browserpersistenzstatus über den Anwendungsport an; Ablehnung/fehlende API/Fehler bleiben unterscheidbar. Exportdownload ist noch keine neue aktivierte P10-Sicherung.

## Prüfungen und offene Abnahme

```sh
pnpm test:ui-unit
pnpm test:ui
pnpm test:ui:integration
pnpm test:ui:matrix
pnpm test:ui:acceptance
pnpm test:ui:zoom
pnpm test:ux
```

Die Befehle sind vorhanden, diese README ist kein neuer Testlauf. [Gesamtabnahme P4 #57](https://github.com/mpwg/WiMM/issues/57) und [P5 #71](https://github.com/mpwg/WiMM/issues/71) führen aktuelle Funktionen und fehlende Belege. Physische iOS-PWA, echter Zoom, Screenreader und native Zielsysteme bleiben tatsächliche Kriterien. Desktopfrontend-IndexedDB/Touchsimulation sind keine native Geräteabnahme. 50.000 Buchungen: Kaltöffnen unter 2.000 ms, Filter-/Scroll-p95 unter 100 ms.

[Abnahmekatalog](../../docs/acceptance-catalog.md), [Tests](../../docs/testing.md), [historische Belege](../../docs/review-evidence.md), [Aufträge/Freigaben](../../docs/tasks.md). Neue Rust-Anwendungs-/DAL-/Serverumstellung ist noch nicht implementiert. Eigene Inhalte AGPL-3.0-or-later.
