# Funktionaler Abnahmekatalog P1–P5

Verbindliche Anforderungen aus den bisherigen Teilplänen, konsolidiert am 9. Oktober 2026. Aktueller Fortschritt ausschließlich in GitHub und [Aufgaben](tasks.md). Diese Kriterien werden auf dem tatsächlichen umgestellten Rust-Client erneut geprüft; historische Prüfbefehle/Belege stehen im [Belegindex](review-evidence.md). Fachmodell/Formatspezifikation und Finanz-/E2EE-Invarianten bleiben verbindlich.

## P1.1 — Versions- und Lizenzprüfung

- Verträge: Architektur, E2EE und AGPL-3.0-or-later; Fremdhinweise erhalten.
- Abnahme: jede Auswahl nennt Version, offizielle Quelle, Lizenz und Kompatibilitätsgrund; verfügbare und noch ungeprüfte Zielsysteme sind getrennt ausgewiesen.
- Prüfungen: Quellen-/Lizenzprüfung und Abgleich der Engine-/SDK-Anforderungen; tatsächliche Builds folgen ab P1.2.
## P1.2 — Workspace und Paketgraph

- Verträge: Paketgraph der Architektur; domain bleibt plattformfrei, contracts importiert nicht domain, Server erhält keine Finanzfachlogik.
- Abnahme: Installation mit unverändertem Lockfile und Typprüfung funktionieren; Grenze zwischen öffentlichen Serververträgen und clientseitigen Fachverträgen ist explizit.
- Prüfungen: frischer Checkout, Typprüfung und Paketgraphprüfung; absichtlich verbotenen Import in temporärem Prüfstand als negativen Kontrollfall erkennen und anschließend entfernen.
## P1.3 — Gemeinsame Verträge und Ports

- Verträge: [Datenmodell](data-model.md), [API](api.md), Architektur und E2EE; vollständige Fachhandler entstehen in P2.
- Abnahme: bekannte gültige Eingaben akzeptiert, unsichere Zahlen und unbekannte Versionen abgewiesen; öffentliche Hüllen deklarieren keine Finanzklartextfelder; Apps können Ports ohne Plattformabhängigkeit im Fachkern referenzieren.
- Prüfungen: gezielte positive/negative Schematests und Typ-/Importgrenzenprüfung; neue Vertragsschemas mit den Dokumenten abgleichen.
## P1.4 — Crypto-Binding und Testgrundlage

- Verträge: [Verschlüsselung](encryption.md); reine Rechenbeispiele aus dem Referenzhaushalt sind keine Crypto-Testvektoren.
- Abnahme: Bibliotheksinitialisierung funktioniert in Web- und Desktoplaufzeit; kanonische Bytes, Verschlüsselung/Entschlüsselung und Signaturen stimmen mit festen Vektoren überein; Manipulation von Chiffrat, AAD und Signatur wird erkannt. Fixierte Nonces ausschließlich in isolierten Tests, frische Nonces bei neuer produktiver Verschlüsselung.
- Prüfungen: Bindingsmokechecks, Vektor- und Manipulationstests als Grundlage für C01/C02; kein behauptetes Bestehen der vollständigen C01–C14 oder unabhängiges Audit.
## P1.5 — Minimale Apphüllen

- Verträge: Architektur, API-Health und [Betrieb](operations.md); Bereitschaft nur für tatsächlich vorhandene Komponenten melden.
- Abnahme: Web und Tauri starten auf dokumentierten verfügbaren Zielsystemen; Server liefert richtige Healthstatuscodes ohne persönliche Daten; fehlende Plattformprüfungen sind benannt.
- Prüfungen: Start-/Buildsmokechecks, Health-Tests und Crypto-Binding in beiden Clienthüllen ausführen.
## P1.6 — CI, Prüfungen und Entwicklungsanleitung

- Verträge: Entwicklungsanleitung, Teststrategie, Hook-Konzept und Gesamt-Abnahme P1.
- Abnahme: dokumentierte Befehle sind vorhanden und tatsächlich ausführbar; Hookaktivierung/-deaktivierung ist checkoutlokal dokumentiert; vorgemerkte Inhalte werden ohne Dateiumschreiben geprüft. Noch leere App-/E2E-Suites werden als solche ausgewiesen. CI-Konfiguration lokal geprüft; Remoteausführung erst nach autorisiertem Push belegen.
- Prüfungen: frischer Checkout mit gesperrtem Lockfile; Typ-/Build-/Vertragstests und Paketgraph; Dokumentationsprüfung einschließlich absichtlich defekter Links/JSON/YAML in temporären Prüfständen. Hook mit teilweise vorgemerkter Datei prüfen; Arbeitskopie darf das geprüfte Commitbild nicht ersetzen. Vorhandenen abweichenden hooksPath bei Aktivierung erkennen und nicht automatisch überschreiben.
## P2.1 — Exakte Geld- und Kalenderprimitive

- Verträge: [Geld und Datum](domain.md), [gemeinsame Typen](data-model.md), [Fachtests](testing.md).
- Abnahme: Vorzeichen und höchstens zwei Nachkommastellen korrekt; unsichere Zahlen, Zwischenwertüberlauf und ungültige Kalenderdaten abgewiesen; Finanzdatum unabhängig von Zeitzone.
- Prüfungen: Vitest mit Grenzwerten, Schaltjahren und ungültigen Texten; Eigenschaften für sichere Summen.
## P2.2 — Fachaggregate und atomare Befehlsverträge

- Verträge: [Datenmodell](data-model.md), [clientinterne Fachbefehle](api.md#fachbefehle), [Paketgrenzen](architecture.md).
- Abnahme: fehlende/veraltete Revisionen und fremde Referenzen ergeben kein Teiländerungsset; contracts importiert nicht domain; Server erhält keine Fachhandler.
- Prüfungen: gültige/ungültige Befehle, Mehraggregatrevisionen, Determinismus und Paketgraphprüfung.
## P2.3 — Konten, Kategorien und Empfänger

- Verträge: [Stammdaten](data-model.md), [Konten und Löschung](domain.md), account/category/payee-Befehle in [API](api.md).
- Abnahme: Kreditkonten bleiben off-budget; Systemkategorie nicht löschbar; referenzierte Daten archiviert; Merge prüft und ändert alle betroffenen Referenzen atomar.
- Prüfungen: Kontenarten, archivierte/fremde Referenzen, Systemschutz und Merge mit veralteter Buchungsrevision.
## P2.4 — Buchungen, Splits und Anfangsbestand

- Verträge: [Buchungsregeln](domain.md), Transaction in [Datenmodell](data-model.md), F01/F02 in [Tests](testing.md).
- Abnahme: Splitsumme exakt gleich Betrag; Opening kein Einkommen; negative Guthaben zulässig; abgeglichene Buchung ohne Entsperrung unveränderbar; Fehler verändern kein Aggregat.
- Prüfungen: F01/F02, positive Ausgabenerstattung, Splitüberlauf, Löschung und Reconciled-Lock.
## P2.5 — Umbuchungen und Kontenabgleich

- Verträge: [Transfer und Abgleich](domain.md), Transfer/Reconciliation in [Datenmodell](data-model.md), F03 in [Tests](testing.md).
- Abnahme: verschiedene Konten, Gegenbeträge und gemeinsames Datum; keine unabhängig änderbaren Transferseiten; Abgleichdifferenz sichtbar; Entsperrung aller betroffenen Buchungen atomar.
- Prüfungen: F03, Transfererhaltung, Budgetgrenzübertritt, fehlende Revisionen, unpassender Auszugssaldo und Entsperrung.
## P2.6 — Projektionen und Gesamt-Abnahme

- Verträge: [Fachinvarianten](domain.md), [P2](tasks.md#p2--fachkern), [Teststrategie](testing.md).
- Abnahme: F01–F03 sowie Geld-/Datum-/Abgleichfehlfälle bestanden; Neuaufbau gleich inkrementellem Ergebnis; Summen sicher; keine UI-/HTTP-/Speicherabhängigkeit und keine Teiländerungssets.
- Prüfungen: vollständige P2-Fachsuite, Summen-/Transfer-/Überlaufeigenschaften, Vertrags-/Typ-/Paketgraph- und Dokumentationsprüfung.
## P3.1 — Speicherverträge, Schemata und Konformitätssuite

- Verträge: [Speicherports](architecture.md#dal-und-migrationen), [Datenmodell](data-model.md), [S01–S03/S14](testing.md).
- Abnahme: vollständige Aggregate, Projektionen und gegebenenfalls Outbox in derselben Transaktion; Cursorcommit atomar; Versionen von Storage/Fachschema/Epoche getrennt.
- Prüfungen: Vertragssuite mit Revisionenkonflikten, Rollback und Neuaufbau; Schemata/Indizes gegen Modell prüfen.
## P3.2 — Lokaler Tresor und Schlüsselports

- Verträge: [Schlüsselhierarchie und Entsperren](encryption.md), [Sicherheit](security.md), [Krypto-Testvektoren](crypto-test-vectors.md).
- Abnahme: keine persistierten Klartextkeys; PWA nach Neustart gesperrt; Passphrase bleibt lokal; Rettungscode und verschlüsselter Tresor stellen eigene Keys wieder her; Verlust aller Mittel nicht als recoverbar dargestellt.
- Prüfungen: falsche Passphrase, manipuliertes Keywrap, KDF-Grenzen, frische Salt/Nonce, unabhängige Bereichsschlüssel und lokale Grundlagen von C10/C11.
## P3.3 — SQLite-Adapter und begrenzte Rust-Brücke

- Verträge: [Desktop-Speicherports](architecture.md), [Aggregate und Indizes](data-model.md), [Tauri-Grenzen](security.md).
- Abnahme: kein beliebiges SQL/Dateikommando aus UI; stale Revisionen und Disk-full ohne Teilerfolg; gespeicherte Daten nach Offline-Neustart unverändert.
- Prüfungen: gemeinsame Suite gegen echte SQLite, S01–S03, Fehler zwischen Transferseiten und vor Commit, Migrationsabbruch/Neustart.
## P3.4 — IndexedDB-Adapter und Tabkoordination

- Verträge: [Lokalbetrieb](architecture.md#lokaler-commit-und-projektionen), [Datenmodell](data-model.md), S01–S03/S14 in [Tests](testing.md).
- Abnahme: gleiche Adapterergebnisse wie SQLite; Quota/Persistenzablehnung sichtbar; zwei Tabs verlieren keine Änderungen; ein Führungsmechanismus pro Bereich für spätere Syncläufe vorbereitet.
- Prüfungen: gemeinsame Suite gegen echte IndexedDB, Tabkonkurrenz und Führungswechsel, Quota-Fehler und Offline-Neustart im Browser.
## P3.5 — Lokale Orchestrierung und getrennte Entwürfe

- Verträge: [Datenfluss](architecture.md#komponenten-und-abhängigkeiten), [Synczustände](synchronization.md), [Speicherdaten](data-model.md).
- Abnahme: UI-Erfolg erst nach Commit; Standalone ohne Anmeldung/Outbox; Originalentwürfe bleiben erhalten; Snapshotaustausch und Seiten-/Cursorcommit ohne Zwischenzustand.
- Prüfungen: beide Adapter mit Befehlsketten, stale Revisionen, Abbruch vor Seiten-/Cursorcommit und Profil-/Bereichstrennung; Netzwerk noch nicht behaupten.
## P3.6 — Offline-Start und Gesamt-Abnahme

- Verträge: [Offlinearchitektur](architecture.md), [P3](tasks.md#p3--lokaler-speicher-und-sicherung), [Tests](testing.md).
- Abnahme: S01–S03 und lokaler Teil von S14 bestanden; keine API-Antworten im Service-Worker-Cache; Neustart bewahrt Buchungen/Entwürfe; Profile getrennt; kein Klartextkey im persistenten Store.
- Prüfungen: echte Adapterkonformität, Network-off-Neustart beider Clients, Quota/Disk-full, Projektionen neu aufbauen und mit Original vergleichen; vollständiger Synclaufteil von S14 folgt in P9.
## P3 — Übergabe

## P4.1 — Composition Root und lokaler Einstieg

- Verträge: [Architektur](architecture.md), [Produktabläufe](product.md), [Schlüsselbedienung](ui.md#schlüsselbedienung).
- Abnahme: Standalone ohne Anmeldung/Serverkonfiguration nutzbar; gesperrter Tresor zeigt keine Finanzansicht; Bereichswechsel übernimmt keine privaten Daten in andere Bereiche.
- Prüfungen: lokale Erstnutzung, Entsperren/Sperren und Offline-Neustart auf beiden Clients; Dienst-/Bereichswechsel mit synthetischen Profilen.
### P4.1.1 — Gemeinsame Dienste und Plattformports prüfen

- Verträge: [Architektur](architecture.md), [Schlüsselbedienung](ui.md#schlüsselbedienung), [Verschlüsselung](encryption.md), [P3-Speicherbasis](https://github.com/mpwg/WiMM/blob/84d730cc6e10d70cf6ac6ff9bc28c4a9c4376e92/docs/p3-storage.md).
- Abnahme: Beide Clients verwenden gemeinsame lokale Dienste und den jeweils richtigen Speicher-/Plattformadapter; UI-Zustand ist von gespeicherten Fachdaten getrennt; lokale Nutzung benötigt keine Outbox oder Serverbestätigung.
- Prüfungen: Gezielte UI-Integration für beide Clientkompositionen, TypeScript und Paketgraph; tatsächlichen Adapter benennen.
### P4.1.2 — Tresor-Erstnutzung und Rettungscodebestätigung prüfen

- Verträge: [Architektur](architecture.md), [Schlüsselbedienung](ui.md#schlüsselbedienung), [Verschlüsselung](encryption.md), [P3-Speicherbasis](https://github.com/mpwg/WiMM/blob/84d730cc6e10d70cf6ac6ff9bc28c4a9c4376e92/docs/p3-storage.md).
- Abnahme: Ohne Server/Anmeldung anlegbar; vor Codebestätigung keine Finanzansicht; Code nicht in Logs oder dauerhaftem UI-Zustand abgelegt.
- Prüfungen: Chromium auf Web und Desktop-Frontend: Anlage → unbestätigt → bestätigt; Fehleingaben und abgebrochene Anlage.
### P4.1.3 — Sperren und Passphrase-Entsperrung prüfen

- Verträge: [Architektur](architecture.md), [Schlüsselbedienung](ui.md#schlüsselbedienung), [Verschlüsselung](encryption.md), [P3-Speicherbasis](https://github.com/mpwg/WiMM/blob/84d730cc6e10d70cf6ac6ff9bc28c4a9c4376e92/docs/p3-storage.md).
- Abnahme: Sperren entfernt flüchtige private Schlüssel und Finanzansicht; falsche Passphrase gibt keine Daten frei; richtige stellt denselben Bereich her.
- Prüfungen: Crypto-/UI-Integration für Schlüsselentfernung plus Chromium-Sperrablauf auf beiden Frontends; Prüfung nach Neustart.
### P4.1.4 — Rettungscode-Entsperrung separat prüfen

- Verträge: [Architektur](architecture.md), [Schlüsselbedienung](ui.md#schlüsselbedienung), [Verschlüsselung](encryption.md), [P3-Speicherbasis](https://github.com/mpwg/WiMM/blob/84d730cc6e10d70cf6ac6ff9bc28c4a9c4376e92/docs/p3-storage.md).
- Abnahme: Richtiger Code stellt vorhandene Bereiche wieder her; falscher Code verändert keinen Speicher und gibt keine Daten frei.
- Prüfungen: Crypto-/UI-Integration und Chromium mit frischer Clientinstanz auf Web und Desktop-Frontend; kein unverschlüsselter Recoveryfallback.
### P4.1.5 — Haushaltsschlüssel dauerhaft sichern

- Verträge: [Architektur](architecture.md), [Schlüsselbedienung](ui.md#schlüsselbedienung), [Verschlüsselung](encryption.md), [P3-Speicherbasis](https://github.com/mpwg/WiMM/blob/84d730cc6e10d70cf6ac6ff9bc28c4a9c4376e92/docs/p3-storage.md).
- Abnahme: Neuer Haushalt bleibt nach Neustart über Passphrase und Code verfügbar; frische Nonce; Fehler meldet keinen erfolgreichen dauerhaft angelegten Haushalt.
- Prüfungen: Gezielte Crypto-/UI-Integration für beide Entsperrwege und Speicherfehler; UI-Neustartablauf je Client.
### P4.1.6 — Profil- und Bereichstrennung prüfen

- Verträge: [Architektur](architecture.md), [Schlüsselbedienung](ui.md#schlüsselbedienung), [Verschlüsselung](encryption.md), [P3-Speicherbasis](https://github.com/mpwg/WiMM/blob/84d730cc6e10d70cf6ac6ff9bc28c4a9c4376e92/docs/p3-storage.md).
- Abnahme: Nur aktiver Bereich lesbar; keine privaten Daten oder Entwürfe gelangen in andere Bereiche/Profile; gesperrte Bereiche zeigen keine Finanzdaten.
- Prüfungen: Integration der Profil-/Bereichsdienste und Chromium-Wechsel mit unterscheidbaren Fixtures; kein bloßer Wechsel der Überschrift.
### P4.1.7 — PWA-Einstieg nach Offline-Neustart prüfen

- Verträge: [Architektur](architecture.md), [Schlüsselbedienung](ui.md#schlüsselbedienung), [Verschlüsselung](encryption.md), [P3-Speicherbasis](https://github.com/mpwg/WiMM/blob/84d730cc6e10d70cf6ac6ff9bc28c4a9c4376e92/docs/p3-storage.md).
- Abnahme: App-Assets starten ohne Netz; Passphrase und Rettungscode erreichen den gespeicherten Haushalt; keine Anmeldung/Serverkonfiguration nötig.
- Prüfungen: Echter Network-off-Chromium-Ablauf mit dokumentierter PWA-/Service-Worker-Version; native Prüfung separat P4.1.8.
### P4.1.8 — Nativen lokalen Einstieg nach Neustart prüfen

- Verträge: [Architektur](architecture.md), [Schlüsselbedienung](ui.md#schlüsselbedienung), [Verschlüsselung](encryption.md), [P3-Speicherbasis](https://github.com/mpwg/WiMM/blob/84d730cc6e10d70cf6ac6ff9bc28c4a9c4376e92/docs/p3-storage.md).
- Abnahme: Vollständiger nativer Ablauf erreicht wieder den Haushalt über beide Entsperrwege; bloß sichtbares Tresorformular genügt nicht.
- Prüfungen: Echter Tauri-Smokecheck mit OS/Architektur/Build und synthetischen Daten; fehlende Zielsysteme separat offen halten, Menüs/Dialoge bleiben P4.5.
## P4.2 — Navigation, Übersicht und Stammdaten

- Verträge: [Layout und Navigation](ui.md), [Produkt](product.md), P2-Stammdatenbefehle in [API](api.md).
- Abnahme: erster Kontostart/Anfangsbestand möglich; leere Daten erzeugen keine erfundenen Guthaben; Archivierung und Merge nachvollziehbar; 320-Pixel-Ansicht ohne Seitenüberlauf.
- Prüfungen: Playwright für Einstieg/Bereichswechsel/Stammdaten, Hell/Dunkel, lange deutsche Namen, Fokus und 200 % Zoom.
### P4.2.1 — Navigation und Bereichstrennung prüfen

- Verträge: [UI](ui.md), [Produkt](product.md), P2-Stammdatenbefehle in [API](api.md).
- Abnahme: Übersicht, Konten, Buchungen und Stammdaten sind erreichbar; aktiver Bereich ist erkennbar; Wechsel zeigt ausschließlich dessen Daten.
- Prüfungen: Chromium-Ablauf auf Web und Desktop-Frontend mit verschieden benannten privaten und gemeinsamen Konten.
### P4.2.2 — Übersicht und Kontostart prüfen

- Verträge: [UI](ui.md), [Produkt](product.md), P2-Stammdatenbefehle in [API](api.md).
- Abnahme: Leerer Bereich zeigt einen Leerzustand; Anfang 1.000 EUR ergibt 1.000 EUR Saldo und keine Konsumeinnahme, auch nach erneutem Laden.
- Prüfungen: Chromium: leerer Bereich → Konto mit Anfangsbestand → Übersicht und Konto prüfen; Web und Desktop-Frontend.
### P4.2.3 — Kontoarchivierung mit Referenzen abnehmen

- Verträge: [UI](ui.md), [Produkt](product.md), P2-Stammdatenbefehle in [API](api.md).
- Abnahme: Historische Buchung und Saldo bleiben erhalten; archiviertes Konto wird für neue Buchungen nicht vorausgewählt.
- Prüfungen: Chromium: Konto bebuchen → archivieren → Historie und neue Buchungsmaske prüfen.
### P4.2.4 — Kategoriearchivierung mit Referenzen abnehmen

- Verträge: [UI](ui.md), [Produkt](product.md), P2-Stammdatenbefehle in [API](api.md).
- Abnahme: Archivierte Kategorie bleibt an der alten Buchung lesbar und wird für neue Eingaben nicht vorausgewählt; kein Referenzverlust.
- Prüfungen: Chromium-Ablauf mit echter gespeicherter Kategorienreferenz; atomaren Fehlerfall des Fachbefehls weiterverwenden.
### P4.2.5 — Empfänger-Merge mit Buchungsreferenz abnehmen

- Verträge: [UI](ui.md), [Produkt](product.md), P2-Stammdatenbefehle in [API](api.md).
- Abnahme: Buchung referenziert das Ziel, Quelle ist archiviert; Betrag und Konto bleiben gleich; nach Neustart derselbe Stand.
- Prüfungen: Chromium-Merge mit referenzierter Buchung und Neustart; keine Prüfung nur mit unbenutzten Empfängern.
### P4.2.6 — Layout und Farbschema stabilisieren

- Verträge: [UI](ui.md), [Produkt](product.md), P2-Stammdatenbefehle in [API](api.md).
- Abnahme: Kein horizontaler Seitenüberlauf oder abgeschnittener Betrag; Touchziele mindestens 44 × 44; Hell/Dunkel folgt System und lässt sich überschreiben.
- Prüfungen: Gezielte Chromium-Screenshots und Überlauf-/Touchzielprüfung für Navigation und Stammdaten; gesamte Matrix folgt P4.6.2.
### P4.2.7 — Tastaturfokus für Navigation und Stammdaten abnehmen

- Verträge: [UI](ui.md), [Produkt](product.md), P2-Stammdatenbefehle in [API](api.md).
- Abnahme: Bereichswechsel, Konto-/Kategorieanlage und Merge sind per Tastatur erreichbar; Fokus sichtbar; Dialogfokus kehrt zum Auslöser zurück.
- Prüfungen: Chromium mit Tab/Shift+Tab/Enter/Escape und Prüfung des tatsächlich fokussierten Elements auf Web und Desktop-Frontend; reine CSS-Regel zählt nicht.
## P4.3 — Buchungslisten und Erfassungsformulare

- Verträge: [Formulare](ui.md#formulare-und-wichtige-dialoge), [Fachmodell](domain.md), [Oberflächenmatrix](testing.md#oberflächenmatrix-und-leistung).
- Abnahme: Tastatur-/Toucherfassung und Bearbeitung möglich; falsche Splitsumme abgewiesen; keine Erfolgsmeldung vor Commit; Quota/Disk-full erhält Eingaben.
- Prüfungen: F01/F02 über UI, Fehler-/Offlinezustände, virtuelle Liste mit Leistungsdatensatz und dokumentierter Messumgebung.
### P4.3.1 — Einzelbuchung und F01 abnehmen

- Verträge: [Formulare](ui.md#formulare-und-wichtige-dialoge), [Fachmodell](domain.md), [Tests](testing.md).
- Abnahme: F01 ergibt Saldo 1.100 EUR, Ausgabe 100 EUR, Einnahme 200 EUR; ungültiger Betrag oder Kalenderwert bleibt mit Feldfehler im Formular.
- Prüfungen: F01 per Chromium auf Web und Desktop-Frontend; eine Erfassung mit Tastatur und eine mit Touch sowie ungültige Eingaben.
### P4.3.2 — Spliterfassung und F02 abnehmen

- Verträge: [Formulare](ui.md#formulare-und-wichtige-dialoge), [Fachmodell](domain.md), [Tests](testing.md).
- Abnahme: F02 -60/-40 zu -100 EUR speichert vollständig; -60/-39 wird vollständig abgewiesen; mindestens drei Zeilen sind erfassbar.
- Prüfungen: Chromium: gültiger und ungültiger F02-Fall sowie Hinzufügen/Entfernen einer dritten Splitzeile; Saldo unverändert im Fehlfall.
### P4.3.3 — Bestehende Buchung bearbeiten

- Verträge: [Formulare](ui.md#formulare-und-wichtige-dialoge), [Fachmodell](domain.md), [Tests](testing.md).
- Abnahme: Normale und Splitbuchung lassen sich ändern; kein Duplikat; ungültige Änderung erhält Eingaben und bisherigen gespeicherten Stand.
- Prüfungen: Chromium: normale und Splitbuchung öffnen → ändern → erneut öffnen; Fehlfall und veraltete Revision gezielt prüfen.
### P4.3.4 — Buchung bestätigt löschen

- Verträge: [Formulare](ui.md#formulare-und-wichtige-dialoge), [Fachmodell](domain.md), [Tests](testing.md).
- Abnahme: Abbruch verändert nichts; Bestätigung entfernt die Buchung aus aktiver Liste und Saldo; Tombstone bleibt; gesperrte Buchung wird abgewiesen.
- Prüfungen: Chromium: abbrechen/bestätigen und Neustart; gezielte Prüfung des gesperrten Fehlfalls.
### P4.3.5 — Suche, Filter und mobile Details abnehmen

- Verträge: [Formulare](ui.md#formulare-und-wichtige-dialoge), [Fachmodell](domain.md), [Tests](testing.md).
- Abnahme: Leere Liste und Suche ohne Treffer haben verständliche Leerzustände; Filterkombinationen liefern passende Buchungen; zurücksetzen zeigt alle; 320-Pixel-Details enthalten vollständigen Betrag und Aktionen.
- Prüfungen: Chromium mit unterscheidbaren Fixtures: Suche/Filter/zurücksetzen, keine Treffer und mobile Detailansicht.
### P4.3.6 — Buchungsliste virtualisieren

- Verträge: [Formulare](ui.md#formulare-und-wichtige-dialoge), [Fachmodell](domain.md), [Tests](testing.md).
- Abnahme: 50.000 synthetische Buchungen erzeugen keine 50.000 DOM-Zeilen; erste, mittlere und letzte Buchung sind erreichbar und bearbeitbar.
- Prüfungen: Chromium mit 50.000 Buchungen: DOM-Zeilenanzahl, Scrollen und Detailrückkehr prüfen; Zeitmessung separat P4.6.5.
### P4.3.7 — Commit- und Speicherfehler sichtbar behandeln

- Verträge: [Formulare](ui.md#formulare-und-wichtige-dialoge), [Fachmodell](domain.md), [Tests](testing.md).
- Abnahme: Vor Commit kein Erfolg; bei Fehler sämtliche Formularwerte erhalten, keine Teilbuchung und unveränderter Saldo; erneuter Versuch speichert einmal.
- Prüfungen: UI-Integration mit verzögertem Adapter, Quota und Disk-full; Fehlereinspritzung getrennt vom echten nativen Nachweis in P4.6.6 bezeichnen.
### P4.3.8 — Offline-Neustart der Buchungsabläufe abnehmen

- Verträge: [Formulare](ui.md#formulare-und-wichtige-dialoge), [Fachmodell](domain.md), [Tests](testing.md).
- Abnahme: Echte Network-off-PWA startet nach Erstladen offline; gespeicherter Stand und Salden bleiben; Desktop-Frontend erhält denselben Datensatz.
- Prüfungen: Chromium mit abgeschaltetem Netzwerk und Neustart, nicht nur Offline-Banner; Web/PWA und Desktop-Frontend getrennt belegen, native Wiederholung in P4.6.6.
## P4.4 — Transfer, Abgleich und Rückgängig

- Verträge: [Transfer-/Abgleichregeln](domain.md), [Fachbefehle](api.md#fachbefehle), [Tastaturregeln](ui.md#tastatur-und-systemintegration).
- Abnahme: Transferseiten bleiben gemeinsam; abgeglichene Änderung erfordert Entsperrung; Korrekturbuchung nur nach eigener Bestätigung; Undo kann stale Revisionen nicht überschreiben.
- Prüfungen: F03, Abgleichdifferenz, gesperrte Bearbeitung, Gegenbefehl bei veraltetem Stand, Tastatur-/Touchdialoge.
### P4.4.1 — Transferdialog und F03 abnehmen

- Verträge: [Fachmodell](domain.md), [Fachbefehle](api.md#fachbefehle), [Tastaturregeln](ui.md#tastatur-und-systemintegration).
- Abnahme: F03 zeigt 800/200 EUR, Gesamt 1.000 EUR und Verbrauch null; Budgetgrenztransfer verlangt die vorgesehene Kategorie/Freigabe.
- Prüfungen: F03 über Chromium auf Web und Desktop-Frontend per Tastatur/Touch; Fehler zwischen Transferseiten erzeugt keine Teilbuchung.
### P4.4.2 — Abgleich und Differenz abnehmen

- Verträge: [Fachmodell](domain.md), [Fachbefehle](api.md#fachbefehle), [Tastaturregeln](ui.md#tastatur-und-systemintegration).
- Abnahme: Passende Summe gleicht exakt die Auswahl ab; abweichende Summe zeigt Differenz und erzeugt keine Korrekturbuchung.
- Prüfungen: Chromium: erfolgreicher und abgelehnter Abgleich; Auswahl, Status und Saldo nach Neustart vergleichen.
### P4.4.3 — Abgeglichene Buchungen atomar entsperren

- Verträge: [Fachmodell](domain.md), [Fachbefehle](api.md#fachbefehle), [Tastaturregeln](ui.md#tastatur-und-systemintegration).
- Abnahme: Änderung/Löschung vor Entsperrung gesperrt; bestätigte Entsperrung betrifft das vollständige Aggregat; Abbruch verändert nichts.
- Prüfungen: Chromium: Sperre → Abbruch → bestätigte Entsperrung → Bearbeitung; Transferseiten und Fehlrollback prüfen.
### P4.4.4 — Korrekturbuchung ausdrücklich bestätigen

- Verträge: [Fachmodell](domain.md), [Fachbefehle](api.md#fachbefehle), [Tastaturregeln](ui.md#tastatur-und-systemintegration).
- Abnahme: Differenz allein bucht nichts; erst eigene Bestätigung legt die sichtbare Korrekturbuchung an; Abbruch erhält Daten.
- Prüfungen: Chromium: Differenz → Korrekturvorschau → abbrechen/bestätigen; Projektion und erneuten Abgleich prüfen.
### P4.4.5 — Rückgängig mit Revisionsprüfung umsetzen

- Verträge: [Fachmodell](domain.md), [Fachbefehle](api.md#fachbefehle), [Tastaturregeln](ui.md#tastatur-und-systemintegration).
- Abnahme: Undo stellt fachlichen Vorzustand atomar wieder her; nach zwischenzeitlicher Fremdänderung klare Ablehnung und kein Überschreiben.
- Prüfungen: Gezielte Integration für Erfassung, Änderung, Löschung, Transfer und Abgleich; Chromium für Undo und stale Revision; keine unkontrollierte Snapshotrücksetzung.
### P4.4.6 — Wiederholen mit Revisionsprüfung umsetzen

- Verträge: [Fachmodell](domain.md), [Fachbefehle](api.md#fachbefehle), [Tastaturregeln](ui.md#tastatur-und-systemintegration).
- Abnahme: Redo reproduziert Aktion einmal; stale Revision wird abgewiesen; neue Aktion verwirft Redo-Zweig; keine Historie wirkt auf fremden Bereich.
- Prüfungen: Integrationsprüfungen der Gegenbefehle plus Chromium: Undo → Redo, stale Revision und Bereichswechsel.
### P4.4.7 — Ungespeicherte Eingaben schützen

- Verträge: [Fachmodell](domain.md), [Fachbefehle](api.md#fachbefehle), [Tastaturregeln](ui.md#tastatur-und-systemintegration).
- Abnahme: Geänderte Eingaben werden nur nach ausdrücklichem Verwerfen entfernt; Abbruch der Rückfrage erhält Werte; sauberes Formular schließt ohne Rückfrage.
- Prüfungen: Chromium per Tastatur und Touch mit Buchungs-, Transfer- und Abgleichformular; Fokus nach Rückfrage prüfen.
## P4.5 — Native Menüs, Dialoge und Plattformbedienung

- Verträge: [Plattformintegration](architecture.md#fach--und-anwendungsschnittstellen), [Systemintegration](ui.md), [Tauri-Sicherheit](security.md).
- Abnahme: echte native Menüs/Dialoge auf verfügbaren Zielsystemen; Textfeld-Undo unverändert plattformüblich; externe Links öffnen Systembrowser; Tauri lädt nur gebündelte Inhalte.
- Prüfungen: native Smokechecks mit Plattform/Architektur, Menü, Dialog, Shortcut, Fremdlink und Offline-Neustart; ungeprüfte Systeme konkret ausweisen.
### P4.5.1 — Native Menübefehle anbinden

- Verträge: [Plattformintegration](architecture.md#fach--und-anwendungsschnittstellen), [Systemintegration](ui.md), [Sicherheit](security.md).
- Abnahme: Datei/Bearbeiten/Ansicht/Hilfe und plattformübliche Appaktionen erreichbar; nicht verfügbare Import-/Exportfunktionen nicht als nutzbar dargestellt.
- Prüfungen: Menüereignisse gezielt integrieren und echten macOS-Menüaufruf prüfen; native Plattformmatrix separat P4.5.7.
### P4.5.2 — Plattformübliche Kurzbefehle abnehmen

- Verträge: [Plattformintegration](architecture.md#fach--und-anwendungsschnittstellen), [Systemintegration](ui.md), [Sicherheit](security.md).
- Abnahme: Neue Buchung/Suche und Fach-Undo funktionieren außerhalb Textfeldern; Textfeld-Undo und Standardtextaktionen bleiben plattformüblich.
- Prüfungen: Gezielte UI-Prüfung plus echtes Tauri auf macOS: Menü und Tastatur, fokussiertes Textfeld und Finanzaktion.
### P4.5.3 — Nativen Öffnendialog als Port bereitstellen

- Verträge: [Plattformintegration](architecture.md#fach--und-anwendungsschnittstellen), [Systemintegration](ui.md), [Sicherheit](security.md).
- Abnahme: Desktop zeigt echten Systemdialog; Auswahl liefert nur bestätigte Datei; Abbruch ist folgenlos; Webalternative funktioniert.
- Prüfungen: Portintegration und echter Öffnendialog auf verfügbarer Plattform; kein Finanzimport vor P5.
### P4.5.4 — Nativen Speicherdialog als Port bereitstellen

- Verträge: [Plattformintegration](architecture.md#fach--und-anwendungsschnittstellen), [Systemintegration](ui.md), [Sicherheit](security.md).
- Abnahme: Desktop bestätigt Pfad und Überschreiben im Systemdialog; Abbruch schreibt nichts; Schreibfehler sichtbar; Webdownload nutzbar.
- Prüfungen: Portintegration und echter Speicherdialog mit Abbruch/Fehler auf verfügbarer Plattform; kein WIMM-Export vor P10.
### P4.5.5 — Externe Links im Systembrowser öffnen

- Verträge: [Plattformintegration](architecture.md#fach--und-anwendungsschnittstellen), [Systemintegration](ui.md), [Sicherheit](security.md).
- Abnahme: Externer Link öffnet im Systembrowser; privilegiertes Tauri-Fenster bleibt bei gebündelter App; Browseralternative öffnet sicher.
- Prüfungen: URL-Fehlfälle am Port und echter Tauri-Linkaufruf auf verfügbarer Plattform.
### P4.5.6 — Tauri-Capabilities begrenzen

- Verträge: [Plattformintegration](architecture.md#fach--und-anwendungsschnittstellen), [Systemintegration](ui.md), [Sicherheit](security.md).
- Abnahme: Nur benötigte Commands/Scopes freigegeben; kein beliebiger SQL-/Dateizugriff; entfernte Inhalte können nicht in privilegierter Ansicht laden.
- Prüfungen: Konfigurationsprüfung, negative Command-/Navigationsfälle und Desktopbuild; konkrete erlaubte Rechte dokumentieren.
### P4.5.7 — Native Systemintegration je Zielsystem prüfen

- Verträge: [Plattformintegration](architecture.md#fach--und-anwendungsschnittstellen), [Systemintegration](ui.md), [Sicherheit](security.md).
- Abnahme: Jede verfügbare Plattform hat eigenen Nachweis mit Architektur/Build; fehlende Windows-/Linux-/macOS-Zellen bleiben offen und benannt.
- Prüfungen: Pro Plattform eigener kleiner Smokecheck mit synthetischen Daten; keine Browseremulation als native Abnahme.
## P4.6 — Barrierefreiheit, Leistung und Gesamt-Abnahme

- Verträge: [P4](tasks.md#p4--oberfläche-und-plattformabnahme), [UI](ui.md), [Prüfmatrix und Leistungsziele](testing.md).
- Abnahme: Buchung/Transfer/Abgleich per Tastatur und Touch, Daten nach Neustart erhalten; keine Überlappung/abgeschnittenen Beträge; verfügbare native Zielsysteme geprüft, fehlende Prüfungen einzeln benannt.
- Prüfungen: Chromium/Firefox/WebKit, fünf Viewports aus testing.md, Hell/Dunkel/200 % Zoom, echtes iOS-Safari soweit verfügbar; 50.000-Buchungen-Messung und native Plattformsmokechecks.
### P4.6.1 — Kernabläufe in drei Browsern prüfen

- Verträge: [P4-Abnahme](tasks.md#p4--oberfläche-und-plattformabnahme), [UI](ui.md), [Prüfmatrix](testing.md).
- Abnahme: Buchung, Split, Transfer und Abgleich bestehen in jedem Browser; Offline-/Neustartnachweis konkret je unterstütztem Client dokumentiert.
- Prüfungen: Pro Browser eigener Lauf mit Version, Web-/Desktop-Frontend und Ergebnis; WebKit ersetzt keinen echten iOS-Safari-Nachweis.
### P4.6.2 — Screenshot- und Viewportmatrix abnehmen

- Verträge: [P4-Abnahme](tasks.md#p4--oberfläche-und-plattformabnahme), [UI](ui.md), [Prüfmatrix](testing.md).
- Abnahme: Keine Überlappung, abgeschnittenen Beträge oder horizontaler Seitenüberlauf; Desktop-, Tablet- und Mobilkomposition erfüllen ui.md.
- Prüfungen: Pro Viewport eigene Screenshotgruppe mit Übersichten, Liste, Details und Dialogen; lange deutsche Namen und große/negative Beträge.
### P4.6.3 — Echten Zoom und Tastaturzugang abnehmen

- Verträge: [P4-Abnahme](tasks.md#p4--oberfläche-und-plattformabnahme), [UI](ui.md), [Prüfmatrix](testing.md).
- Abnahme: Bei 200 % bleiben Beträge, Fehler und Aktionen erreichbar; Tastatur kann gesamten Ablauf bedienen; CSS-Zoom allein gilt nicht als Beleg.
- Prüfungen: Realer Browserzoom mit Browser/Version dokumentiert; Tastaturabläufe und reduced motion prüfen; fehlende Automatisierung manuell belegen.
### P4.6.4 — Screenreader und Kontraste abnehmen

- Verträge: [P4-Abnahme](tasks.md#p4--oberfläche-und-plattformabnahme), [UI](ui.md), [Prüfmatrix](testing.md).
- Abnahme: Tresor, Buchung und Abgleich verständlich bedienbar; Status/Fehler angesagt; Kontrast mindestens 4,5:1 und Bedeutung zusätzlich als Text/Symbol.
- Prüfungen: VoiceOver oder anderer verfügbarer Screenreader mit OS/Browser dokumentieren; Kontrastmessung; automatisierter Semantiktest allein genügt nicht.
### P4.6.5 — Leistungsziele mit 50.000 Buchungen messen

- Verträge: [P4-Abnahme](tasks.md#p4--oberfläche-und-plattformabnahme), [UI](ui.md), [Prüfmatrix](testing.md).
- Abnahme: Liste innerhalb zwei Sekunden, p95 Filter-/Scrollreaktion unter 100 ms; Zahlen bleiben korrekt; Datensatz, Hardware, Versionen und Messverfahren nachvollziehbar.
- Prüfungen: Wiederholbare Messung von 50.000 Buchungen, zehn Konten, 100 Kategorien, 36 Monate und 1.000 SharedExpenses gemäß testing.md; SharedExpenses für P4 nur als synthetische Speicherlast, funktionale Familienabnahme erst in P7; konkrete Messwerte statt subjektiver Geschwindigkeit.
### P4.6.6 — Native Persistenz und echte Geräte ergänzen

- Verträge: [P4-Abnahme](tasks.md#p4--oberfläche-und-plattformabnahme), [UI](ui.md), [Prüfmatrix](testing.md).
- Abnahme: Gespeicherte Buchungen/Transfer/Abgleich bleiben; echtes Disk-full zeigt Fehler und erhält Entwurf ohne Teilerfolg; reale Geräte separat nachgewiesen.
- Prüfungen: Je verfügbarer Plattform/Architektur beziehungsweise Gerät eigener Lauf; Disk-full in begrenztem Testvolume ohne produktive Daten; fehlende Geräte bleiben offene Zellen.
### P4.6.7 — P4-Gesamtabnahme und Übergabe abschließen

- Verträge: [P4-Abnahme](tasks.md#p4--oberfläche-und-plattformabnahme), [UI](ui.md), [Prüfmatrix](testing.md).
- Abnahme: Keine P4-Abnahmelücke verdeckt; Gesamtabschluss nur bei erfüllten Kriterien; fehlende Plattformprüfungen konkret als Einschränkung oder Blockade gemäß tasks.md benannt.
- Prüfungen: pnpm check:ci und Nachweismatrix mit Commit, Plattform/Browser, Testgruppe, Ergebnis und verbleibender Grenze; P5 erst nach P4-Abnahme.
## P5.1 — Parserauswahl und normalisierte Zwischenform

- Verträge: [Dateiformate](formats.md), [Architektur](architecture.md), [Parserfixtures](testing.md#zugriff-und-parser).
- Abnahme: etablierte Parser, keine Eigenparser; Datei maximal 25 MiB und 100.000 Buchungen; kein Netzwerkzugriff/Dateiupload im Parser; exakte Centnormalisierung.
- Prüfungen: Lizenz-/Versions-/Paketgrenzenprüfung, Grenzdateien, Abbruch und fehlerhafte Zwischenwerte.
## P5.2 — CSV-Mapping und Vorschau

- Verträge: [CSV](formats.md#csv), [Importablauf](product.md), [Parserfälle](testing.md).
- Abnahme: UTF-8/BOM/Windows-1252, Quotes und Mehrzeilen korrekt; 1.234,56 exakt; gleichzeitig gefülltes Soll/Haben Fehler; ungültige Zeilen nur nach Korrektur oder ausdrücklichem Ausschluss übernehmbar.
- Prüfungen: CSV-Fixtures, Vorlagenwiederverwendung, Datum-/Signfehler und Vorschau-/Korrekturablauf per Tastatur/Touch.
## P5.3 — CAMT.053 und OFX/QFX

- Verträge: [CAMT/OFX/QFX](formats.md#camt053-und-ofxqfx), [Finanzdatum](domain.md), [Parserfehlfälle](testing.md).
- Abnahme: keine DTD/externen Entitäten; Nicht-EUR abgewiesen; Detailbeträge nur bei exakter Entrysumme vereinzelt; Kontosalden erzeugen keine automatische Korrektur, Konten keine automatische Neuanlage.
- Prüfungen: Namespacevarianten, mehrere Details, fehlerhafte Summen, FITID, OFX-Datumsnormalisierung, DTD/Entitäten und Nicht-EUR.
## P5.4 — Dubletten, gruppierte Übernahme und Wiederaufnahme

- Verträge: [Dubletten und Importablauf](formats.md), ImportBatch/ImportFingerprint in [Datenmodell](data-model.md), [StorageAdapter](architecture.md).
- Abnahme: echte gleiche Zahlungen ausdrücklich getrennt möglich; gleiche ID mit anderem Inhalt Prüfkonflikt; Wiederaufnahme ohne Doppelbuchung; Teilübernahme klar angezeigt; kein Gesamtabbruch mit behauptetem Vollrollback.
- Prüfungen: Wiederimport, bewusst zugelassene Dublette, Abbruch vor/nach Gruppencommit, Quota/Disk-full und Großimport ohne blockierenden UI-Thread.
## P5.5 — Deterministische Buchungsregeln

- Verträge: [Regeln](domain.md), Rule in [Datenmodell](data-model.md), [Fachbefehle](api.md#fachbefehle).
- Abnahme: feste Reihenfolge, Stop beendet Folgeauswertung; nur erlaubte Felder/Aktionen; Ergebnis weiterhin fachvalidiert; Umordnung atomar und revisionsgeprüft.
- Prüfungen: Reihenfolge/Stop, kollidierende Regeln, fremde Kategorien, ungültige Aktionen, Replay derselben Vorschau und UI-Verwaltung.
## P5.6 — Dauerzahlungen und Gesamt-Abnahme

- Verträge: [Dauerzahlungen](domain.md), [Schedule-Befehle](api.md), [P5](tasks.md#p5--import-und-automatisierung), F14 in [Tests](testing.md).
- Abnahme: F14 und alle vier Formatfixtures bestanden; Vorschläge verändern keine Salden; wiederholte Bestätigung idempotent; Importzuordnung erzeugt keine zweite Fälligkeit/Buchung.
- Prüfungen: Monatsende/Schaltjahr/Intervall/Enddatum, Doppelbestätigung und Importzuordnung; Parser-/Dubletten-/Limit-/Abbruchsuite sowie UI-Abläufe und Fachregressionen.

## Zielergänzung

Fach-/Anwendungs-/Binding-/DAL-/Server-/Updateänderungen besitzen zusätzliche Kriterien in [Gesamtübersicht #114](https://github.com/mpwg/WiMM/issues/114). Neue Funktionen P6–P11 stehen in ihren eigenen Spezifikationen; kein implementierter Umfang wird durch diese Katalogübernahme behauptet.
