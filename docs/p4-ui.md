# P4 — Teilaufgaben für Oberfläche und native App

## Auftrag und Reihenfolge

Diese Teilaufgaben konkretisieren [P4](tasks.md#p4--oberfläche-und-native-app). Der Nutzerauftrag vom 3. Oktober 2026 erlaubt ihre Planung; die Implementierungsfreigabe für P4 steht aus. P4.1 bis P4.6 werden in Reihenfolge nach abgeschlossenem [P3](p3-storage.md) bearbeitet. Die verbindliche Gestaltung steht in [ui.md](ui.md); spätere Budget-, Import-, Familien- und Syncflächen entstehen in ihren Paketen.

Status und konkrete Prüfbelege hier sowie den Gesamtstatus in [tasks.md](tasks.md) pflegen; nach jedem abgeschlossenen Abschnitt einen zusammengehörigen Zwischencommit und eine [Übergabe](templates/handoff.md) erstellen. P4 ist erst nach allen Teilabnahmen und der Gesamt-Abnahme erledigt; danach folgt [P5](p5-import.md). Für die Umsetzung wimm-ui verwenden, bei Schlüsselbedienung zusätzlich wimm-e2ee. Native Prüfungen und Browseremulation getrennt belegen.

## P4.1 — Composition Root und lokaler Einstieg

- Status: offen.
- Freigabe: Implementierungsauftrag für P4 erforderlich.
- Voraussetzungen: P3 erledigt.
- Schritte: gemeinsame Clientdienste und PlatformServices in Web/Desktop injizieren; lokalen Profil-/Bereichseinstieg, Tresorentsperrung und Rettungscodesicherung anbinden; Routing und flüchtigen UI-Zustand von Fachdaten trennen.
- Ergebnis: lokal startfähige App mit explizitem aktivem Bereich und injizierten Plattformdiensten.
- Verträge: [Architektur](architecture.md), [Produktabläufe](product.md), [Schlüsselbedienung](ui.md#schlüsselbedienung).
- Abnahme: Standalone ohne Anmeldung/Serverkonfiguration nutzbar; gesperrter Tresor zeigt keine Finanzansicht; Bereichswechsel übernimmt keine privaten Daten in andere Bereiche.
- Prüfungen: lokale Erstnutzung, Entsperren/Sperren und Offline-Neustart auf beiden Clients; Dienst-/Bereichswechsel mit synthetischen Profilen.
- Prüfbelege: noch keine.

## P4.2 — Navigation, Übersicht und Stammdaten

- Status: offen.
- Freigabe: Implementierungsauftrag für P4 erforderlich.
- Voraussetzungen: P4.1 erledigt.
- Schritte: Desktop-/Tablet-/Mobilnavigation, Bereichskennzeichnung, Übersicht und Konto-/Kategorie-/Empfängerverwaltung umsetzen; Systemtypografie, Hell/Dunkel und zugängliche Zustände aufbauen.
- Ergebnis: passende Arbeitsansichten für Tastatur und Touch mit echten lokalen Zahlen.
- Verträge: [Layout und Navigation](ui.md), [Produkt](product.md), P2-Stammdatenbefehle in [API](api.md).
- Abnahme: erster Kontostart/Anfangsbestand möglich; leere Daten erzeugen keine erfundenen Guthaben; Archivierung und Merge nachvollziehbar; 320-Pixel-Ansicht ohne Seitenüberlauf.
- Prüfungen: Playwright für Einstieg/Bereichswechsel/Stammdaten, Hell/Dunkel, lange deutsche Namen, Fokus und 200 % Zoom.
- Prüfbelege: noch keine.

## P4.3 — Buchungslisten und Erfassungsformulare

- Status: offen.
- Freigabe: Implementierungsauftrag für P4 erforderlich.
- Voraussetzungen: P4.2 erledigt.
- Schritte: virtualisierte Buchungslisten, Suche/Filter, Einzelbuchung und Splits anbinden; exakte Betragseingabe, Datum, Feldfehler und Speicherstatus umsetzen; mobile Details statt gequetschter Tabelle gestalten.
- Ergebnis: nutzbare Buchungserfassung mit dauerhaftem Speichern und erhaltenen Fehlereingaben.
- Verträge: [Formulare](ui.md#formulare-und-wichtige-dialoge), [Fachmodell](domain.md), [Oberflächenmatrix](testing.md#oberflächenmatrix-und-leistung).
- Abnahme: Tastatur-/Toucherfassung und Bearbeitung möglich; falsche Splitsumme abgewiesen; keine Erfolgsmeldung vor Commit; Quota/Disk-full erhält Eingaben.
- Prüfungen: F01/F02 über UI, Fehler-/Offlinezustände, virtuelle Liste mit Leistungsdatensatz und dokumentierter Messumgebung.
- Prüfbelege: noch keine.

## P4.4 — Transfer, Abgleich und Rückgängig

- Status: offen.
- Freigabe: Implementierungsauftrag für P4 erforderlich.
- Voraussetzungen: P4.3 erledigt.
- Schritte: Transfer-/Abgleichdialoge und atomare Entsperrung anbinden; Differenz ausdrücklich anzeigen; Undo/Redo als reguläre Gegenbefehle mit aktuellen Revisionen durchführen; ungespeicherte Eingaben schützen.
- Ergebnis: vollständige lokale Kontenpflege ohne versteckte Korrekturbuchungen.
- Verträge: [Transfer-/Abgleichregeln](domain.md), [Fachbefehle](api.md#fachbefehle), [Tastaturregeln](ui.md#tastatur-und-systemintegration).
- Abnahme: Transferseiten bleiben gemeinsam; abgeglichene Änderung erfordert Entsperrung; Korrekturbuchung nur nach eigener Bestätigung; Undo kann stale Revisionen nicht überschreiben.
- Prüfungen: F03, Abgleichdifferenz, gesperrte Bearbeitung, Gegenbefehl bei veraltetem Stand, Tastatur-/Touchdialoge.
- Prüfbelege: noch keine.

## P4.5 — Native Menüs, Dialoge und Plattformbedienung

- Status: offen.
- Freigabe: Implementierungsauftrag für P4 erforderlich.
- Voraussetzungen: P4.4 erledigt.
- Schritte: originale Fensterdekoration, Systemmenüs, Cmd-/Ctrl-Kurzbefehle, native Datei-/Speicherdialogports und Systembrowserlinks integrieren; Capabilities begrenzen; spätere Import-/Exportaktionen nur entsprechend vorhandenem Funktionsumfang anbieten.
- Ergebnis: plattformgerecht bedienbare Tauri-App und passende Browseralternativen.
- Verträge: [Plattformintegration](architecture.md#plattformintegration), [Systemintegration](ui.md), [Tauri-Sicherheit](security.md).
- Abnahme: echte native Menüs/Dialoge auf verfügbaren Zielsystemen; Textfeld-Undo unverändert plattformüblich; externe Links öffnen Systembrowser; Tauri lädt nur gebündelte Inhalte.
- Prüfungen: native Smokechecks mit Plattform/Architektur, Menü, Dialog, Shortcut, Fremdlink und Offline-Neustart; ungeprüfte Systeme konkret ausweisen.
- Prüfbelege: noch keine.

## P4.6 — Barrierefreiheit, Leistung und Gesamt-Abnahme

- Status: offen.
- Freigabe: Implementierungsauftrag für P4 erforderlich.
- Voraussetzungen: P4.5 erledigt.
- Schritte: Kernabläufe in Playwright und Projektprüfungen aufnehmen; Screenshot-/Viewportmatrix, Screenreader/Zoom, Fokus und Leistungsziele prüfen; native Belege zusammenführen.
- Ergebnis: abgenommenes lokales Haushaltsbuch als Basis der Planungsfunktionen.
- Verträge: [P4](tasks.md#p4--oberfläche-und-native-app), [UI](ui.md), [Prüfmatrix und Leistungsziele](testing.md).
- Abnahme: Buchung/Transfer/Abgleich per Tastatur und Touch, Daten nach Neustart erhalten; keine Überlappung/abgeschnittenen Beträge; verfügbare native Zielsysteme geprüft, fehlende Prüfungen einzeln benannt.
- Prüfungen: Chromium/Firefox/WebKit, fünf Viewports aus testing.md, Hell/Dunkel/200 % Zoom, echtes iOS-Safari soweit verfügbar; 50.000-Buchungen-Messung und native Plattformsmokechecks.
- Prüfbelege: noch keine.
