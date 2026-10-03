# P4 — Teilaufgaben für Oberfläche und native App

## Auftrag und Reihenfolge

Diese Teilaufgaben konkretisieren [P4](tasks.md#p4--oberfläche-und-native-app). P4.1 und P4.2 besitzen Teilimplementierungen aus ausdrücklichen Nutzeraufträgen vom 3. Oktober 2026, erfüllen nach der Nachprüfung ihre Abnahmen jedoch noch nicht; weitere Teilaufgaben benötigen jeweils ihre eigene Freigabe. P4.1 bis P4.6 werden in Reihenfolge nach abgeschlossenem [P3](p3-storage.md) bearbeitet. Die verbindliche Gestaltung steht in [ui.md](ui.md); spätere Budget-, Import-, Familien- und Syncflächen entstehen in ihren Paketen.

Status und konkrete Prüfbelege hier sowie den Gesamtstatus in [tasks.md](tasks.md) pflegen; nach jedem abgeschlossenen Abschnitt einen zusammengehörigen Zwischencommit und eine [Übergabe](templates/handoff.md) erstellen. P4 ist erst nach allen Teilabnahmen und der Gesamt-Abnahme erledigt; danach folgt [P5](p5-import.md). Für die Umsetzung wimm-ui verwenden, bei Schlüsselbedienung zusätzlich wimm-e2ee. Native Prüfungen und Browseremulation getrennt belegen.

## P4.1 — Composition Root und lokaler Einstieg

- Status: in Arbeit — Nachprüfung vom 3. Oktober 2026 hat offene Abnahmelücken ergeben.
- Freigabe: Nutzerauftrag zum vollständigen Abschluss von P4.
- Voraussetzungen: P3 erledigt.
- Schritte: gemeinsame Clientdienste und PlatformServices in Web/Desktop injizieren; lokalen Profil-/Bereichseinstieg, Tresorentsperrung und Rettungscodesicherung anbinden; Routing und flüchtigen UI-Zustand von Fachdaten trennen.
- Ergebnis: lokal startfähige App mit explizitem aktivem Bereich und injizierten Plattformdiensten.
- Verträge: [Architektur](architecture.md), [Produktabläufe](product.md), [Schlüsselbedienung](ui.md#schlüsselbedienung).
- Abnahme: Standalone ohne Anmeldung/Serverkonfiguration nutzbar; gesperrter Tresor zeigt keine Finanzansicht; Bereichswechsel übernimmt keine privaten Daten in andere Bereiche.
- Prüfungen: lokale Erstnutzung, Entsperren/Sperren und Offline-Neustart auf beiden Clients; Dienst-/Bereichswechsel mit synthetischen Profilen.
- Prüfbelege: `packages/ui` stellt für Web und Desktop denselben Composition Root mit injiziertem Profil- und `PlatformServices`-Port bereit. Ein neuer Tresor wird mit einer lokalen Passphrase angelegt; der Rettungscode wird ausschließlich einmalig angezeigt und muss vor dem lokalen Start bestätigt werden. `lockUserVault` entfernt geladene private Schlüssel und zeigt wieder nur den Sperrbildschirm. Drei UI-Unit-Tests prüfen profilgebundene Bereichswahl, defensive Profilkopien sowie die Standalone-Erstanlage. TypeScript, UI-Tests sowie Web- und Desktop-Frontend-Build bestanden.

  Offen nach Nachprüfung: `createHousehold` ergänzt den Bereichsschlüssel nur im flüchtigen Tresor, speichert aber weiterhin die vorherige verschlüsselte Tresorhülle im Profil. Nach Sperren oder Neustart ist der neue Haushaltsschlüssel daher nicht wiederherstellbar. Der Ablauf Haushalt anlegen → sperren → per Passphrase/Rettungscode entsperren → Bereich öffnen benötigt einen Regressionstest und eine persistente, verschlüsselte Aktualisierung der Tresorhülle. Ebenso fehlen die geforderten tatsächlichen Offline-Neustarts auf Web und Desktop sowie ein Interaktionsnachweis für Sperren/Entsperren.

## P4.2 — Navigation, Übersicht und Stammdaten

- Status: in Arbeit — Nachprüfung vom 3. Oktober 2026 hat offene Abnahmelücken ergeben.
- Freigabe: expliziter Nutzerauftrag „setze P4.2 vollständig um“.
- Voraussetzungen: P4.1 technisch umgesetzt, Abnahme wegen dokumentierter Lücken offen.
- Schritte: Desktop-/Tablet-/Mobilnavigation, Bereichskennzeichnung, Übersicht und Konto-/Kategorie-/Empfängerverwaltung umsetzen; Systemtypografie, Hell/Dunkel und zugängliche Zustände aufbauen.
- Ergebnis: passende Arbeitsansichten für Tastatur und Touch mit echten lokalen Zahlen.
- Verträge: [Layout und Navigation](ui.md), [Produkt](product.md), P2-Stammdatenbefehle in [API](api.md).
- Abnahme: erster Kontostart/Anfangsbestand möglich; leere Daten erzeugen keine erfundenen Guthaben; Archivierung und Merge nachvollziehbar; 320-Pixel-Ansicht ohne Seitenüberlauf.
- Prüfungen: Playwright für Einstieg/Bereichswechsel/Stammdaten, Hell/Dunkel, lange deutsche Namen, Fokus und 200 % Zoom.
- Prüfbelege: Gemeinsame Web-/Desktopansicht mit Bereichskennzeichnung, Übersicht sowie Konto-, Kategoriegruppen-, Kategorie- und Empfängerverwaltung liegt in `packages/ui/src/workspace.tsx` vor. Lokale Salden entstehen aus `projectAccountBalances`; leere Bereiche zeigen keinen erfundenen Saldo. Konten und Kategorien werden über die P2-Fachbefehle archiviert und bleiben damit an historischen Referenzen erhalten; ein Empfänger-Merge erfasst alle lokal vorhandenen Quellreferenzen in einer atomaren Änderungsmenge und archiviert die Quelle. Systemschrift, Hell-/Dunkelmodus, sichtbare Fokusregel und ein Touchlayout unter 768 CSS-Pixeln sind vorhanden. `pnpm test:ui` bestand am 3. Oktober 2026 in Chromium; TypeScript, die UI-Unit-Tests sowie Web- und Desktop-Frontend-Build bestanden ebenfalls.

  Offen nach Nachprüfung: Der Chromium-Ablauf prüft Kategoriearchivierung nicht und führt den Empfänger-Merge ohne referenzierte Buchung aus. Die Tastaturprüfung stellt nur die Existenz einer `:focus-visible`-CSS-Regel fest, nicht die reale Fokusreihenfolge oder den sichtbaren Fokus nach Tastaturnavigation. Bei CSS-Zoom 200 % wird nur die Sichtbarkeit einer Überschrift geprüft; ein Seitenüberlauf- oder Erreichbarkeitsnachweis fehlt. Browser-Zoom, Firefox/WebKit, echter Screenreader und native Desktop-Prüfungen bleiben als getrennte Nachweise offen. Die vollständige Übergabe steht in [P4.2-Übergabe](handoffs/p4-2.md).

## P4.3 — Buchungslisten und Erfassungsformulare

- Status: in Arbeit.
- Freigabe: Nutzerauftrag zum Abschluss von P4.
- Voraussetzungen: P4.2 technisch umgesetzt, Abnahme wegen dokumentierter Lücken offen.
- Schritte: virtualisierte Buchungslisten, Suche/Filter, Einzelbuchung und Splits anbinden; exakte Betragseingabe, Datum, Feldfehler und Speicherstatus umsetzen; mobile Details statt gequetschter Tabelle gestalten.
- Ergebnis: nutzbare Buchungserfassung mit dauerhaftem Speichern und erhaltenen Fehlereingaben.
- Verträge: [Formulare](ui.md#formulare-und-wichtige-dialoge), [Fachmodell](domain.md), [Oberflächenmatrix](testing.md#oberflächenmatrix-und-leistung).
- Abnahme: Tastatur-/Toucherfassung und Bearbeitung möglich; falsche Splitsumme abgewiesen; keine Erfolgsmeldung vor Commit; Quota/Disk-full erhält Eingaben.
- Prüfungen: F01/F02 über UI, Fehler-/Offlinezustände, virtuelle Liste mit Leistungsdatensatz und dokumentierter Messumgebung.
- Prüfbelege: Einzelbuchung, Anfangsbestand, Suche und ein zweizeiliger Split sind an `saveTransaction` gebunden. Betragstexte werden nur durch `parseMoney` im Fachkern verarbeitet; der zweite Split entsteht mit `subtractMoney`. Speichererfolg wird erst nach `LocalAreaService.applyChangeSet` angezeigt; Fachfehler bleiben im Formular sichtbar. Offen: Bearbeiten/Löschen, echte Virtualisierung, UI-Referenzfälle F01/F02, Quota-/Offline- und Leistungsnachweise.

## P4.4 — Transfer, Abgleich und Rückgängig

- Status: in Arbeit.
- Freigabe: Nutzerauftrag zum Abschluss von P4.
- Voraussetzungen: P4.3 erledigt.
- Schritte: Transfer-/Abgleichdialoge und atomare Entsperrung anbinden; Differenz ausdrücklich anzeigen; Undo/Redo als reguläre Gegenbefehle mit aktuellen Revisionen durchführen; ungespeicherte Eingaben schützen.
- Ergebnis: vollständige lokale Kontenpflege ohne versteckte Korrekturbuchungen.
- Verträge: [Transfer-/Abgleichregeln](domain.md), [Fachbefehle](api.md#fachbefehle), [Tastaturregeln](ui.md#tastatur-und-systemintegration).
- Abnahme: Transferseiten bleiben gemeinsam; abgeglichene Änderung erfordert Entsperrung; Korrekturbuchung nur nach eigener Bestätigung; Undo kann stale Revisionen nicht überschreiben.
- Prüfungen: F03, Abgleichdifferenz, gesperrte Bearbeitung, Gegenbefehl bei veraltetem Stand, Tastatur-/Touchdialoge.
- Prüfbelege: Die Kontenansicht besitzt Formulare für `saveTransfer` und `confirmReconciliation`; beide verwenden vollständige Fachaggregate und werden über den atomaren lokalen Speicher ausgeführt. Der Abgleich zeigt die vom Fachkern gelieferte Differenz und erzeugt keine verdeckte Korrekturbuchung. Offen: Entsperren abgeglichener Buchungen, Gegenbefehle für Undo/Redo, Schutz ungespeicherter Eingaben sowie UI-Prüfungen F03 und Stale-Revision.

## P4.5 — Native Menüs, Dialoge und Plattformbedienung

- Status: in Arbeit.
- Freigabe: Nutzerauftrag zum Abschluss von P4.
- Voraussetzungen: P4.4 erledigt.
- Schritte: originale Fensterdekoration, Systemmenüs, Cmd-/Ctrl-Kurzbefehle, native Datei-/Speicherdialogports und Systembrowserlinks integrieren; Capabilities begrenzen; spätere Import-/Exportaktionen nur entsprechend vorhandenem Funktionsumfang anbieten.
- Ergebnis: plattformgerecht bedienbare Tauri-App und passende Browseralternativen.
- Verträge: [Plattformintegration](architecture.md#plattformintegration), [Systemintegration](ui.md), [Tauri-Sicherheit](security.md).
- Abnahme: echte native Menüs/Dialoge auf verfügbaren Zielsystemen; Textfeld-Undo unverändert plattformüblich; externe Links öffnen Systembrowser; Tauri lädt nur gebündelte Inhalte.
- Prüfungen: native Smokechecks mit Plattform/Architektur, Menü, Dialog, Shortcut, Fremdlink und Offline-Neustart; ungeprüfte Systeme konkret ausweisen.
- Prüfbelege: Die Tauri-Hülle erstellt ein natives Datei-/Bearbeiten-Menü mit Neu, Undo/Redo und Standard-Textaktionen; `cargo check` und der Desktop-Produktionsbuild bestanden. Ein PlatformServices-Port wird sowohl in Web als auch Desktop injiziert. Offen: Anbindung der Menübefehle, native Datei-/Speicherdialoge, Systembrowserlinks, begrenzte Capabilities und echter nativer Smokecheck.

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
