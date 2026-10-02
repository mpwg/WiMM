# Prüfstrategie und Abnahmekriterien

## Aktueller Stand

D0 umfasst Dokumentationsprüfung. Es wurden keine Anwendungstests implementiert oder ausgeführt, weil es noch keine Anwendung gibt. Die folgenden Datensätze und Prüfungen sind verbindliche Spezifikation für P1–P11, keine bereits bestandene Testsuite.

## Testebenen und Werkzeuge

| Ebene | Werkzeug ab Paket | Prüfgegenstand |
|---|---|---|
| Dokumentation | Link-/Datei-/Konsistenzprüfung in D0 | vollständige Übergabe, Lizenz, Status, Querverweise |
| Fachkern | Vitest ab P2 | pure Berechnungen, fachliche Invarianten, negative Fälle |
| Speicher | Vitest + echte IndexedDB/SQLite ab P3 | gleiche Contract-Suite für beide Adapter |
| Web/Touch | Playwright ab P4 | Nutzerabläufe, Offline, Screenshots, Tastatur/Fokus |
| Native Desktop | Plattform-Smokechecks ab P4 | echte Menüs, Dialoge, Schlüsselablage, Offline-Start |
| API/Zugriff | Fastify-Testinjektion + HTTP ab P8 | Rechte, Auth, Serialization, Rate-Limits |
| Synchronisierung | simuliertes Netzwerk + echte DB ab P9 | mehrere Clients, Wiederholungen und Konflikte |
| Betrieb/Release | Integrationsprüfung ab P10 | Restore, Migration, Sicherung, Signatur/Source-Archiv |

Tests behaupten Verhalten, nicht private Implementierungsdetails. Referenzrechnungen werden mit derselben erwarteten Ausgabe auf Client und Server geprüft. Zufalls-/Eigenschaftstests ergänzen deterministische Beispiele für Summen, Rundung und Replays.

## Referenzdatensätze

Teilnehmer-IDs A vor B vor C lexikografisch festlegen. Technischer Haushalt H. Beträge in den Tabellen in EUR, intern Cent. Daten sind synthetisch. Jeder Fall beginnt mit seinem dokumentierten Ausgangsstand und wird unabhängig ausgeführt.

| ID | Eingabe | Erwartung |
|---|---|---|
| F01 Konten | Anfang 1.000, Ausgabe 100, Einnahme 200 | Saldo 1.100; Konsumausgabe 100, Konsumeinnahme 200, Anfang kein Einkommen |
| F02 Splits | Ausgabe -100, Splits -60/-40; Fehlfall -60/-39 | erster gültig, zweiter vollständig abgewiesen |
| F03 Transfer | Konto1 1.000, Konto2 0, Umbuchung 200 | 800/200; Gesamtvermögen 1.000; Einnahmen/Ausgaben null |
| F04 Umschläge | 1.000 Geld, Zuweisung 300/200, Ausgabe 100 in erster Kategorie | Geld 900; Kategorien 200/200; frei 500; Folgevorträge 200/200 |
| F05 Defizit | Kategorie 20 verfügbar, tatsächliche Ausgabe 30 | Kategorie -10, sichtbar und vorgetragen; keine automatische Buchungsverwerfung |
| F06 Plan | Ausgabeplan 300, Ist 250, Einnahmeplan 1.000, Ist 900 | Ausgabeabweichung +50, Einnahmeabweichung -100; Pläne verändern keinen Kontostand |
| F07 Gleiche Anteile | A bezahlt 10,01; A/B gleich | Anteile 5,01/5,00; Guthaben A +5,00, B -5,00, H 0 |
| F08 Einkommen | A 3.000, B 1.000; gemeinsame Ausgabe 100 | Anteile 75/25; ausschließlich erklärte Werte verwenden |
| F09 Nullbasis | A 0, B 0; Methode income | Fehlermeldung, keine Ausgabe gespeichert |
| F10 Gemeinsames Konto | A/B je Beitrag 100, H bezahlt Ausgabe 200, Anteile 100/100 | alle Guthaben 0; Kontoguthaben 0; Konsum genau 200 |
| F11 Private Vorleistung | A bezahlt 100, Anteile 50/50, household-Erstattung; B trägt 50 bei; A verrechnet 50 Eigenanteil; H zahlt A 50 | Reserve 100→100→50→0; alle Guthaben am Ende 0; Konsum genau 100; H-Konto 0 |
| F12 Direkter Ausgleich | A bezahlt 10,01, Erstattungsquelle participants, B zahlt A 5,00 | Guthaben A/B/H 0; Haushaltsreserve 0; gemeinsamer Kontostand unverändert |
| F13 Teilrückerstattung | Original 10,01 mit 5,01/5,00; Refunds 3,33 und 6,68 | kumulativ 1,67/1,66, dann 5,01/5,00; volle Rückerstattung hebt Kostenanteile exakt auf |
| F14 Monatsende | Schedule 31.01.2028 monatlich | 29.02., 31.03., 30.04.; keine Drift auf den 29. |
| F15 Methodenwechsel | Plan bis Oktober, Umschlag ab November, vorhandenes Geld 800 | Umschlagvortrag null, 800 real verfügbar; alte Planwerte erhalten |
| F16 Reserve/Budget | Haushaltsgeld 1.000, Kategorie 200 zugewiesen, private Ausgabe 100 mit household-Erstattung | Kategorie 100, Reserve 100, Equity 900, frei weiterhin 800; Erstattung 100 ändert frei/Kategorie nicht erneut |

Weitere Pflichtfälle: sichere Ganzzahlgrenzen und Zwischenwertüberlauf; ungültiges Datum; Reconciliation-Differenz; Änderung abgeglichener Buchung; Archivierung mit Referenzen; Mehrfachzuweisung desselben Buchungssplits; Refund über Original; Settlement/Offset über verbleibende Vorleistung; Regelreihenfolge und Stop; idempotente Schedulebestätigung; voller Privat-/Haushaltsbericht ohne Doppelzählung.

## Speicher- und Syncmatrix

| ID | Szenario | Erwartung |
|---|---|---|
| S01 | Fehler zwischen Transfertochterbuchungen | keine Teilbuchung/Projektion/Outbox gespeichert |
| S02 | Browser-/Desktop-Neustart offline | dieselben dauerhaft gespeicherten Finanzdaten und Entwürfe |
| S03 | Disk-full/Quota bei neuer Buchung | verständlicher Fehler; Eingaben erhalten; kein vermeintlicher Erfolg |
| S04 | Verbindung bricht nach Servercommit vor Antwort | Wiederholung liefert gleiches Receipt; keine Doppelbuchung |
| S05 | gleiche Operations-ID, anderer Payload | OPERATION_ID_REUSED, Originalzustand unverändert |
| S06 | zwei Geräte ändern dieselbe Buchung | eine bestätigt, eine sichtbarer Konflikt; kein stiller Verlust |
| S07 | zwei Änderungen lokal nacheinander am selben Aggregat | zweite sendet erst nach erster Bestätigung mit richtiger Revision |
| S08 | Änderung und Löschung parallel | expliziter Konflikt, kein halbes Aggregat |
| S09 | zwei unabhängige Konten offline geändert | beide konvergieren ohne globalen Konflikt |
| S10 | Pull-Seite nach Absturz erneut | Daten und Cursor konsistent, keine doppelte Wirkung |
| S11 | Mitglied zu viewer oder entfernt während Offlinephase | kein neuer Write; keine fremden Konfliktdaten; Entwurf exportierbar |
| S12 | Restore während alte Clients offline | EPOCH_MISMATCH, Entwürfe gesichert, kein automatisches Replay |
| S13 | private Veröffentlichung scheitert im Haushalt | Privatspeicher bleibt intakt, Link pending/rejected, keine privaten Payloads |
| S14 | zwei Browser-Tabs | ein Synclauf pro Bereich; keine verlorenen lokalen Writes |
| S15 | unbekannte Protokollversion | UPDATE_REQUIRED, lokale Daten erhalten |

In S04/S06 nach Wiederverbindung identische kanonische Snapshotdaten auf allen Clients prüfen. Zeitstempel/Sessiondaten können technisch abweichen, fachliche Aggregate und bestätigte Revisionen nicht. Offline-UI darf einen nicht bestätigten Stand nicht als serverbestätigt darstellen.

## Zugriff und Parser

Für jeden Endpoint mit Ressourcen-ID Tests als Eigentümer, anderer Haushaltsadmin, member, viewer, fremder Benutzer und anonym. Für jeden Fachbefehl member/viewer und fremde Referenz prüfen. Prüfen auch Snapshot, Restore, Push/Pull, Receipt, Such-/Berichtsprojektionen und Fehlerantworten. Serveradmin ohne Membership bekommt keinen automatischen API-Finanzzugriff.

Authfälle: paralleler Bootstrap, Setupreplay, Invite-Expiry/Replay, letzte admin-Entfernung, OIDC falscher State/Nonce/Issuer, E-Mail-Accountübernahme, CSRF, Session-/Devicerevocation, Rate-Limits und Device-Token-Einmalausgabe. Native Schlüsselablage auf macOS/Windows/Linux testen; unsicherer Linuxfallback verboten.

Parserfixtures: CSV BOM/Semikolon/Quotes/Mehrzeilen/Windows-1252, Zahl `1.234,56`, echte gleiche Zahlungen, FITID-Änderung mit gleicher ID, CAMT-Namespaces und mehrere TransactionDetails. Fehlfälle: DTD, externe Entität, Nicht-EUR, ZIP-Pfadtraversal, Zipbomb, falsche Checksummen, fehlende Datei, unsichere Zahl, unauflösbare Referenz, neuere Version. Kein Fehlfall darf vorhandene Daten teilweise verändern.

## Oberflächenmatrix und Leistung

Ansichten Übersicht, Buchungen, Budget, Ausgleich, Importvorschau und Konflikt mit den Zuständen leer/gefüllt/offline/Fehler. Screenshots bei 320×568, 390×844, 768×1024, 1440×900 und 1920×1080, Hell/Dunkel, 200 % Zoom. Lange deutsche Kategorien, siebenstellige EUR-Beträge, Bildschirmtastatur und sichere Flächen auf iOS einbeziehen. Kein Überlappen, abgeschnittene Texte oder unzugängliche Befehle.

Web: Chromium, Firefox und WebKit in Playwright; zusätzlich echtes iOS-Safari-Smokecheck. Desktop: macOS arm64/x64, Windows x64, Linux x64 soweit verfügbar; native Menüs, Datei-/Speicherdialog, OS-Shortcuts, externer Link und Offline-Neustart tatsächlich ausführen. Emulation ersetzt keine native Prüfung.

Referenzleistung: 50.000 Buchungen, zehn Konten, 100 Kategorien, 36 Monate, 1.000 SharedExpenses. Testgerät/Browser/Build dokumentieren. Ziele: sichtbare Buchungsliste innerhalb zwei Sekunden nach lokalem Öffnen, p95 Filter-/Scrollreaktion unter 100 ms bei warmem Datensatz; Importfortschritt ohne blockierenden UI-Thread. Ergebnisse messen, nicht aus Virtualisierung allein ableiten.

## Betrieb und Definition of Done

Nutzerexport nach Import/Restore mit kanonischem Snapshot vergleichen; Kontostände, Budgets, Ausgleich und Referenzen müssen erhalten sein. Vollserverrestore mit ungültiger Session/Epochen und Wiederanmeldung prüfen. Migration von jedem unterstützten Ausgangsschema mit Backup, Fehlerrollback und Neustart. Retention entfernt nie letzte funktionierende Sicherung nach fehlgeschlagener neuer Sicherung.

Ein Paket gilt erst als erledigt, wenn Ergebnis und seine Abnahmekriterien erfüllt sind, relevante Tests bestanden haben und Dokumentation/Verträge angepasst sind. Prüfbelege nennen Befehl/Testgruppe, Plattform, Ergebnis und Einschränkungen. Keine generelle hundertprozentige Coveragepflicht; Fachinvarianten, Autorisierung und Restore haben obligatorische Verhaltensabdeckung.

Vor P11 außerdem AGPL-Lizenzmetadaten, vollständiges zum Build passendes Quellarchiv, Fremdhinweise und Buildanleitungen prüfen. Fehlende Signierung oder Plattformtests verhindern entsprechende öffentliche Releasefreigabe, nicht vorherige Entwicklungspakete.
