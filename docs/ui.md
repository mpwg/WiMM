# Oberfläche und Plattformgestaltung

## Leitlinien

Die App ist ein Arbeitswerkzeug für Familienfinanzen. Erste Ansicht ist die nutzbare Finanzübersicht, keine Marketingseite. Klare Zahlen, kurze Wege und sichtbarer Bereich haben Vorrang. Gemeinsame und private Bereiche besitzen dieselbe Navigation, aber eine eindeutige Bereichskennzeichnung.

Desktop- und Touchansichten werden bewusst unterschiedlich komponiert; gemeinsame Komponenten gewährleisten konsistentes Verhalten. Native Anmutung ist Abnahmekriterium, nicht nur ein App-Icon um eine Website. Fensterdekoration, Systemschrift, Menü, Fokus, Tastatur und Dateidialoge werden an die jeweilige Plattform angepasst.

## Layout und Navigation

- Desktop: native Fensterleiste, schmale Seitenleiste mit Bereichswechsel, kompakter Inhaltskopf, zentrale Tabellen/Arbeitsansichten. Kein Browseradressfeld und keine Navigationsleiste wie auf einer Website.
- Tablet: kompakte Seitenleiste, bei Platzmangel ausblendbar; Inhaltsansichten behalten ausreichend lesbare Spalten.
- Mobil: Bereich im Kopf, untere Navigation Übersicht/Buchungen/Budget/Mehr; Konten, Ausgleich und Berichte unter Mehr. Listen mit Detailansichten statt zusammengeschobener Desktoptabellen.
- Mindestfenster Desktop 900 × 600; Touchlayout unter 768 CSS-Pixeln, mittleres Layout 768–1023, volle Seitenleiste ab 1024. Kein horizontaler Seitenüberlauf bei 320 Pixeln; Tabellen dürfen nur innerhalb ihres beschrifteten Arbeitsbereichs scrollen.

## Hauptansichten

| Ansicht | Inhalte | Primäre Aktionen |
| --- | --- | --- |
| Übersicht | verfügbares Geld, Monatsausgaben, kommende Zahlungen, Ziele; Haushalt zusätzlich Ausgleich | Buchung erfassen, fällige Zahlung bestätigen |
| Buchungen | Datum, Konto, Empfänger, Kategorie, Betrag, Abgleich-/Syncstatus; Filter und Suche | hinzufügen, importieren, bearbeiten, splitten, teilen |
| Konten | Guthaben, Budgetzugehörigkeit, Archivstatus und Kontodetails | Konto anlegen, Umbuchung, Abgleich |
| Budget | Monatswechsel, Methodenauswahl, Plan/Ist oder Zuweisung/Verfügbar | Werte ändern, Umschichten, Ziele öffnen |
| Ausgleich | Guthaben je Teilnehmer, Haushalt, Vorleistungen und Reserve, Zahlungshistorie | Anteil prüfen, Zahlung erfassen, Eigenanteil verrechnen |
| Berichte | Monatsvergleich, Kategorien, Budgetabweichungen, Vermögen, Prognose | Zeitraum/Perspektive wechseln, Detailbuchungen öffnen |
| Einstellungen | Kategorien, Empfänger, Regeln, Dauerzahlungen, Ziele, Sicherung; Haushalt Rollen | konkret benannte Verwaltungsvorgänge |
| Tresor und Geräte | lokales Entsperren, Rettungscode, Keyversionen, Fingerprints und Geräte | Schlüssel freigeben, Gerät widerrufen, Recovery starten |

## Bedienelemente

Systemschrift und feste Typografiestufen; keine viewportabhängige Schriftgröße. Tabellenbeträge rechtsbündig mit tabellarischen Ziffern, Währung und Vorzeichen. Rot bedeutet Problem/Ausgabeabweichung, Grün positiven Status; zusätzliche Symbole/Text verhindern reine Farbcodierung. Hell-/Dunkelmodus folgt zunächst dem System und ist überschreibbar.

Werkzeugaktionen mit Lucide-Icons und zugänglichem Namen/Tooltip; klare Befehle mit Icon und Text. Binäre Werte als Checkbox/Toggle, Methoden als Segmentsteuerung, Auswahlmengen als Menüs, Zahlen als Eingabe. Keine verschachtelten Karten; Tabellen und Seitenabschnitte ungerahmt, Modale und einzelne fachliche Einträge dürfen gerahmt sein. Stabile Spalten-/Buttonmaße verhindern Sprünge durch Status-/Ladetexte.

## Formulare und wichtige Dialoge

Buchung: Betrag prominent, Vorzeichenmodus Ausgabe/Einnahme, Konto, Datum, Empfänger, Kategorie und optionale Splits/Notiz. Datum öffnet plattformgerechte Auswahl; Betrag verwendet Dezimaltastatur und exakte Parserregeln. Speichern wartet auf dauerhaften lokalen Commit; bei Fehler bleiben sämtliche Eingaben erhalten.

Veröffentlichung: Vorschau ausschließlich gemeinsamer Felder; zahlende Person, Verteilung, Erstattungsquelle und deren Wirkung auf Haushaltsreserve. Private Notizen werden nicht vorausgefüllt. Ein gefüllter Dialog ist allein keine Zustimmung: erst der Befehl „Ausgabe teilen“ veröffentlicht.

Ausgleich: zahlende/empfangende Person, Betrag, Datum, Zahlungsweg, gegebenenfalls gemeinsames Konto und Vorleistungsanwendungen. Vorschlagsbeträge bleiben editierbar. Eigenanteilsverrechnung erhält gesonderten Dialog mit Erklärung ihres Finanzierungseffekts.

Konflikt: bestätigte und lokale Fassung, markierte Unterschiede, Optionen bestätigten Stand übernehmen/lokal neu speichern/Entwurf exportieren. Bei nicht mehr verfügbarem Leserecht keine neue Serverfassung anzeigen. Snapshotersatz nennt Bereich, Backup und Verlust des aktuellen Stands; explizite Bestätigung nötig.

## Tastatur und Systemintegration

Desktopmenüs: App/Datei mit Import/Export/Einstellungen/Beenden, Bearbeiten mit Undo/Redo/Standardtextaktionen, Ansicht und Hilfe mit Version/Lizenz/Quellcode. macOS verwendet Systemmenü und Cmd, Windows/Linux Fenstermenü und Ctrl. Ctrl/Cmd+N neue Buchung, Ctrl/Cmd+F Suche, Ctrl/Cmd+Z Undo, plattformübliches Redo; nicht global während Texteingaben umdeuten. Escape schließt einen Dialog nur ohne Verlust oder nach Rückfrage.

Dateiauswahl und Speichern sind Desktop-native, im Browser gewöhnliche Datei-/Downloadabläufe. Externe Links öffnen im Systembrowser und keine entfernte Seite in der privilegierten Tauri-Ansicht. Updates sichtbar anbieten, nicht mitten in Bearbeitung erzwingen. Appcodesignatur ist keine Zugangsvoraussetzung; Web/PWA/Desktop gelten nach Authentifizierung als vertrauenswürdig.

## Schlüsselbedienung

Anmeldung und Tresorentsperren sind getrennte Zustände: angemeldet/gesperrt zeigt keine Finanzdaten. Entsperrpassphrase bleibt lokal; Rettungscode beim Anlegen anzeigen und Sicherung bestätigen lassen. Passwortreset meldet ausdrücklich, dass er keine verlorenen Finanzschlüssel ersetzt. Neues Gerät kann über bereits entsperrtes Gerät oder Tresorpassphrase/Rettungscode aufgenommen werden; kein Hinweis auf erforderliche Appattestierung.

Familieneinladung zeigt bis KeyGrant `Schlüsselfreigabe ausstehend`. Fingerprint-/QR-Vergleich und bestätigte Freigabe erfolgen auf Clients; keine automatische private Freigabe. Entfernen nennt verbleibende alte Kopien und startet Rotation; Offlinealtversionen bleiben als Entwürfe erhalten. Export fragt separate Exportpassphrase ab. Ungültige Nachrichten, fehlende Keys und Recoveryverlust besitzen eigene Zustände statt stillen Klartextfallbacks.

## Zustände und Barrierefreiheit

Jede Hauptansicht besitzt Laden/leer/Fehler/offline/ausstehend/Konflikt. Lokal ohne Server ist kein Warnzustand. Serveroffline zeigt weiterhin reale lokale Daten mit letzter Synchronisierung; Platzhalter verändern keine Zahlen. Neue Mitglieder sehen nur freigegebene Bereiche.

Semantische Tabellen, beschriftete Formulare, Fokusreihenfolge, sichtbarer Fokus, Screenreader-Statusmeldungen und modaler Fokusfang. WCAG 2.2 AA als Ziel, Textkontrast mindestens 4,5:1, Touchziele mindestens 44 × 44 CSS-Pixel. Bei 200 % Zoom bleiben Funktionen erreichbar; reduced motion deaktiviert dekorative Bewegung. Fehler erhalten Text und Feldbezug, nicht nur Farbe.

## Visuelle Abnahme

Screenshotmatrix aus [Tests](testing.md), keine überlappenden Texte, gequetschten langen deutschen Wörter oder abgeschnittenen Beträge. Desktop-Menüs/Dialoge müssen auf echten Plattformen geprüft werden; Playwright allein bestätigt keine native Tauri-Integration. Screenshots enthalten nur synthetische Daten.
