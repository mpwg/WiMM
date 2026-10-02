# Produkt und Nutzung

## Ziel und Erfolg

Familien sollen wissen, welches Geld verfügbar ist, welche Zahlungen bevorstehen und wie gemeinsame Kosten verteilt sind. Private Finanzen bleiben persönlich. Die erste Veröffentlichung ist ein öffentliches Open-Source-Produkt für erwachsene Nutzer im DACH-Raum, ohne Pflichtkonto, externe Finanzdienste oder Telemetrie.

Erfolg bedeutet: Eine Familie kann ihr tägliches Haushaltsbuch, Monatsplanung und Ausgleich vollständig lokal führen und dieselben Daten anschließend über ihren Server auf mehreren Geräten verwenden. Kontostände, Kosten und Ausgleichsergebnisse stimmen auf allen Plattformen überein.

## Betriebsarten

| Betriebsart | Verfügbar | Voraussetzungen und Grenzen |
| --- | --- | --- |
| Lokal, Desktop | Alle Fachfunktionen, lokale Personen, Dateiimport, Export und automatische Sicherungen | Betriebssystemprofil schützt Dateien; lokale Personen sind keine getrennten Benutzerkonten |
| Lokal, PWA | Alle Fachfunktionen, lokale Personen, Import und Export | Erstes Laden/Installieren benötigt Zugriff auf statisch ausgelieferte App; Browserdaten können gelöscht werden |
| Serververbunden | Zusätzlich Konten, Einladungen, Rollen, Zusammenarbeit und Gerätesync | Finanzdaten verpflichtend Ende-zu-Ende-verschlüsselt; Anmeldung plus lokale Tresorentsperrung; temporär offline weiter nutzbar |

Eine PWA kann von einem statischen Host geladen werden, ohne ein Finanzbackend zu verwenden. Same-Origin-Self-Hosting ist regulärer Serverbetrieb. Authentifizierte Clients werden unabhängig von Codesignatur vertraut; E2EE benötigt zusätzlich lokal entsperrte Finanzschlüssel. Die [Verschlüsselungsspezifikation](encryption.md) trennt Clientvertrauen, Anmeldung und Nachrichtenintegrität.

## Umfang der ersten Version

Konten, Buchungen und Splits; Umbuchungen innerhalb eines Finanzbereichs; Kontenabgleich; Kategorien und Zahlungsempfänger; CSV/CAMT.053/OFX/QFX; Regeln; wiederkehrende Zahlungsvorschläge; Plan- und Umschlagbudget; Sparziele; Berichte; Teilnehmer, Einkommensangaben, gemeinsame Ausgaben, Beiträge und Ausgleich; Sicherung, Export, Wiederherstellung und optionaler Serverbetrieb.

## Rollenmatrix

| Aktion | Privat: Eigentümer | Haushalt: admin | Haushalt: member | Haushalt: viewer |
| --- | --- | --- | --- | --- |
| Finanzdaten lesen und berechtigten Bereich exportieren | Ja | Ja | Ja | Ja |
| Buchungen, Budget, Ziele, Regeln und Ausgleich bearbeiten | Ja | Ja | Ja | Nein |
| Teilnehmer als fachliche Personen verwalten | Nicht anwendbar | Ja | Ja | Nein |
| Mitglieder, Rollen, Einladungen und Haushaltseinstellungen ändern | Nicht anwendbar | Ja | Nein | Nein |
| Bereich durch Snapshot ersetzen oder Haushalt löschen | Ja | Ja | Nein | Nein |
| Privaten Bereich eines anderen Mitglieds sehen | Nein | Nein | Nein | Nein |

Jeder Benutzer kann mehrere Haushaltsmitgliedschaften haben. Der letzte Verwalter darf nicht entfernt oder herabgestuft werden. Ein Teilnehmer kann auch ohne Benutzerkonto existieren; Zuordnung zu einer angemeldeten Person erfordert deren Zustimmung. Fachliche Teilnehmer dürfen keine Anmeldeberechtigungen erhalten, nur weil sie im Haushaltsbuch angelegt wurden.

## Navigation

Bereichswechsel: Privat, Haushalte und deren Syncstatus. Innerhalb eines Bereichs: Übersicht, Buchungen, Konten, Budget, Berichte; im Haushalt zusätzlich Ausgleich. Einstellungen enthalten Kategorien, Regeln, Dauerzahlungen, Ziele, Sicherungen und gegebenenfalls Mitglieder. Die Oberfläche zeigt sichtbar, in welchem Bereich eine neue Buchung entsteht.

## Abläufe und Zustände

| Ablauf | Normalfall | Leerer Zustand | Fehler und Wiederaufnahme |
| --- | --- | --- | --- |
| Lokaler Einstieg | Ohne Anmeldung starten, Privatbereich oder Haushalt anlegen, Konto und Anfangsbestand erfassen | Erfassungsaktion für erstes Konto; keine erfundenen Guthaben | Speicherfehler erklärt, Eingaben bleiben erhalten; keine Erfolgsmeldung vor dauerhafter Speicherung |
| Servereinrichtung | Betreiber richtet Erstkonto ein; Benutzer meldet sich an und legt Haushalt an | Einrichtungsansicht nur vor abgeschlossenem Bootstrap | Ungültiges Setupgeheimnis/Parallelversuch ändern nichts; nach Einrichtung ist Bootstrap gesperrt |
| Buchung | Bereich/Konto wählen, Datum/Betrag/Kategorie eingeben, optional splitten, speichern | Liste bietet Buchung und Import an | Feldfehler inline; offline dauerhaft gespeichert und als ausstehend markiert |
| Import | Datei wählen, Konto und Zuordnung bestätigen, Vorschau/Dubletten prüfen, übernehmen | Vorschau meldet null Buchungen ohne Dateneingriff | Fehler pro Zeile; keine Übernahme vor Bestätigung; Wiederimport identifiziert vorhandene Einträge |
| Budget | Methode/Monat wählen, Planwerte oder Zuweisungen setzen, Abweichungen ansehen | Bestehende Kategorien ohne Vorgaben; gezielte Eingabeaktionen | Überbudgetierung angezeigt, erwartetes Einkommen nicht als Geld verwendet; Methodenwechsel nur am Monatsanfang |
| Ausgabe teilen | Private Buchung auswählen oder externe Ausgabe erfassen, öffentliche Felder und Anteile bestätigen | Teilnehmer und Verteilungsregel anlegen | Unpassende Summe verhindert Veröffentlichung; private Bearbeitung wird nicht automatisch veröffentlicht |
| Ausgleich | Guthaben, Herkunft und Erstattungsverpflichtungen prüfen; tatsächlichen Zahlungsweg erfassen | Keine offenen Beträge, vergangene Zahlungen bleiben auffindbar | Überschrittene Erstattung/fehlende Kontobuchung blockiert Abschluss; Saldo allein ist kein Zahlungsnachweis |
| Einladung | admin erstellt Link; Empfänger meldet sich an; Fingerprints vergleichen; entsperrter admin gibt verschlüsselten Bereichsschlüssel frei | Mitglied pending_key_grant bis bestätigter Freigabe | Abgelaufen/widerrufen/falscher Fingerprint: keine Freigabe; admin bestätigt neu |
| Offline/Sync | Lokale Erfassung, bei Verbindung push/pull; Änderungen als bestätigt markieren | Kein Server verbunden bedeutet regulären Lokalbetrieb | Authentifizierung erneuern, Konflikt entscheiden oder Entwürfe exportieren; keine automatische Verwerfung |
| Wiederherstellung | Export prüfen, Vorschau, neuen lokalen Bereich anlegen oder bestätigten Serverbereich ersetzen | Dateiauswahl | Unbekannte Version/kaputte Datei vor Änderungen ablehnen; vorhandene Daten vorher sichern |

## Private Angaben

Die gemeinsame App darf veröffentlichte Ausgaben und freiwillige Einkommensgrundlagen sehen. Die Veröffentlichungsvorschau nennt alle geteilten Felder. Freitextnotizen aus privaten Buchungen werden niemals vorausgefüllt. Es gibt in v1 keine automatische Freigabe privater Einkommen, Vermögens- oder Ausgabensummen.

## Veröffentlichungskriterien

P1 bis P11 sind abgeschlossen, kritische Fach-, Crypto- und Zugriffstests bestanden und Daten-/Schlüsselwiederherstellung nachgewiesen. E2EE ist ohne Abschaltmöglichkeit implementiert; Finanzserverdump und Backup enthalten keine Finanzklartexte. Die Apps wurden auf macOS, Windows, Linux sowie mobiler PWA geprüft. Fehlende Plattform-Signierung erlaubt interne Tests, aber keine als fertig bezeichnete öffentliche Distribution.
