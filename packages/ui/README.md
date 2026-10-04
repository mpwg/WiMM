# @wimm/ui

Gemeinsame React-Oberfläche für den lokalen Einstieg von WhereIsMyMoney. Web und Desktop verwenden denselben Composition Root; die Speicher- und Plattformports werden jeweils von der App injiziert.

Die Oberfläche zeigt zunächst einen leeren Bereich ohne erfundene Guthaben. Nach dem Anlegen eines Kontos wird sein Anfangsbestand als fachliche Anfangsbuchung dauerhaft gespeichert. Er erhöht den Kontostand, zählt jedoch weder als Konsumeinnahme noch als Monatsausgabe.

Archivierte Konten bleiben mit ihrem fortgeschriebenen Saldo in einem eigenen historischen Abschnitt sichtbar. Ihre Buchungen bleiben lesbar; in neuen Buchungen, Umbuchungen und Abgleichen werden sie nicht mehr angeboten.

Archivierte Kategorien bleiben in der Kategorienreferenz vorhandener Buchungen lesbar. Sie werden weder in der Kategorie- noch in der Split-Kategorieauswahl für neue Buchungen angeboten.

Beim Zusammenführen von Empfängern werden die gespeicherten Buchungsreferenzen atomar auf den Ziel-Empfänger umgestellt. Die Quelle bleibt archiviert erhalten und wird für neue Buchungen nicht mehr angeboten. Konto, Betrag, Datum und Kategorie bleiben gleich; der zusammengeführte Stand bleibt nach einem vollständigen Chromium-Neustart erhalten.

Navigation und Stammdaten verwenden gemeinsame Layout- und Farbregeln für Web und Desktop-Frontend. Bei 320 CSS-Pixeln umbrechen Navigation und lange Namen; von 768 bis 1023 Pixeln steht eine kompakte Seitenleiste neben einspaltigen Formularen, ab 1024 Pixeln die volle Seitenleiste. Breite Tabellen scrollen ausschließlich in ihrem beschrifteten Arbeitsbereich; Beträge bleiben vollständig und einzeilig. Bedienelemente sind mindestens 44 × 44 CSS-Pixel groß, die Schrift ist die Systemschrift.

Die Auswahl „Farbschema“ in der Seitenleiste bietet „System“, „Hell“ und „Dunkel“. „System“ folgt auch laufenden Änderungen des Betriebssystemfarbschemas. Eine manuelle Auswahl überschreibt das System in den Finanzansichten und bleibt lokal über ein erneutes Laden und Entsperren hinweg erhalten. Bei nicht verfügbarem Browserspeicher gilt sie für die aktuelle Sitzung.

Navigation, Bereichswechsel sowie das Anlegen von Konten, Kategorien und Empfängern sind vollständig per Tabulator, Umschalt+Tabulator, Enter und Escape erreichbar. Der sichtbare Fokus bleibt auf jedem fokussierten Bedienelement erhalten. Das Zusammenführen von Empfängern verlangt eine bestätigende Rückfrage; Escape oder „Abbrechen“ schließen sie ohne Änderung und geben den Fokus an „Zusammenführen und archivieren“ zurück.

Einzelbuchungen erfassen Konto, Kalenderdatum, Kategorie sowie optional Empfänger und Notiz. Negative Beträge sind Ausgaben, positive Beträge Einnahmen; Punkt oder Komma sind als Dezimaltrennzeichen erlaubt, höchstens zwei Nachkommastellen und keine Tausendertrennzeichen. Die native Datumsauswahl bleibt erhalten. Ungültige beziehungsweise fehlende Beträge und unvollständige Kalenderwerte zeigen direkt am Feld einen zugänglich zugeordneten Fehler; sämtliche übrigen Eingaben bleiben erhalten. Erst nach dem dauerhaften lokalen Commit wird das Formular geleert.

Die Übersicht zeigt Monatsausgaben und Monatseinnahmen aus der gemeinsamen Fachprojektion für den aktuellen Kalendermonat in `Europe/Vienna`. Anfangsbestände und Umbuchungen zählen nicht als Konsum. F01 mit Anfangsbestand 1.000 EUR, Ausgabe 100 EUR und Einnahme 200 EUR ergibt 1.100 EUR Guthaben, 100 EUR Monatsausgaben und 200 EUR Monatseinnahmen.

## Buchungsabläufe P4.3

Splits werden mit expliziten Beträgen erfasst: Die erste Kategorie und „Split-Kategorie (optional)“ eröffnen zwei Zeilen; „Split hinzufügen“ ergänzt weitere Zeilen, deren Entfernen die übrigen Werte erhält. Die Splitsumme muss exakt dem Buchungsbetrag entsprechen. F02 mit -100 EUR und -60/-40 EUR ist gültig; -60/-39 EUR verändert keine gespeicherten Daten.

„Details“ öffnet eine vollständige Buchung einschließlich Notiz, Empfänger, Splitbeträgen und Abgleichstatus. „Bearbeiten“ ändert dieselbe Buchung mit der beim Öffnen festgehaltenen Revision. Ein zwischenzeitlich geänderter Stand wird abgewiesen und nachgeladen; der eigene Entwurf bleibt erhalten. „Löschen“ verlangt eine eigene Bestätigung; Abbrechen oder Escape verändert nichts. Löschmarkierungen bleiben im Speicher, während Liste und Fachprojektionen die gelöschten Buchungen ausschließen. Abgeglichene Buchungen bieten keine Bearbeitungs-/Löschaktion; Umbuchungsseiten bleiben dem atomaren Umbuchungsvorgang vorbehalten.

Die Liste kombiniert Notiz-/Empfängersuche mit Konto- und inklusiven Datumsfiltern. „Filter zurücksetzen“ entfernt alle Einschränkungen. Ohne Daten und ohne passende Treffer erscheinen unterschiedliche Leerzustände. Unter 768 Pixeln werden Buchungen als kompakte Listeneinträge mit vollständigem Betrag und Detailaktion dargestellt. Die Detailansicht zeigt lange Inhalte vollständig.

Die scrollbare Liste rendert höchstens 16 Buchungszeilen plus zwei unsichtbare Abstandshalter. Auch bei 50.000 Buchungen sind Anfang, Mitte und Ende erreichbar; IDs und Rückkehrfokus bleiben beim Bearbeiten erhalten. Das ist ein Funktionsnachweis für P4.3.6; die gesonderten Zeitziele und der vollständige Leistungsdatensatz bleiben P4.6.5.

Während eines Speicherbefehls sind die Formularfelder gesperrt und ein Wartezustand sichtbar. Ein Fehler erhält sämtliche Werte; ein Wiederholversuch speichert genau einmal. Nach dem Commit wird der bestätigte Batch direkt in die Ansicht übernommen, damit ein nachgelagerter Lesefehler keine zweite Neuanlage auslöst. Die Tests injizieren Verzögerung, Quota und Disk-full ausschließlich über eine separate Testseite mit echtem IndexedDB-Adapter; die Produktionsapp enthält keine Fehlersteuerung. Native Disk-full-Prüfung folgt in P4.6.6.

## Prüfung

Im Repository ausführen:

```sh
pnpm --filter @wimm/ui test
pnpm exec playwright test tests/ui/p4-3.spec.ts
WIMM_CLIENT=desktop pnpm exec playwright test tests/ui/p4-3.spec.ts --config tests/ui/desktop.config.ts
pnpm test:ui:integration
pnpm exec playwright test tests/ui/p4-3-1.spec.ts
WIMM_CLIENT=desktop pnpm exec playwright test tests/ui/p4-3-1.spec.ts --config tests/ui/desktop.config.ts
pnpm exec playwright test tests/ui/p4-2-6.spec.ts
WIMM_CLIENT=desktop pnpm exec playwright test tests/ui/p4-2-6.spec.ts --config tests/ui/desktop.config.ts
pnpm exec playwright test tests/ui/p4-2-7.spec.ts
WIMM_CLIENT=desktop pnpm exec playwright test tests/ui/p4-2-7.spec.ts --config tests/ui/desktop.config.ts
pnpm exec playwright test tests/ui/p4-2-2.spec.ts
WIMM_CLIENT=desktop pnpm exec playwright test tests/ui/p4-2-2.spec.ts --config tests/ui/desktop.config.ts
pnpm exec playwright test tests/ui/p4-2-3.spec.ts
WIMM_CLIENT=desktop pnpm exec playwright test tests/ui/p4-2-3.spec.ts --config tests/ui/desktop.config.ts
pnpm exec playwright test tests/ui/p4-2-4.spec.ts
WIMM_CLIENT=desktop pnpm exec playwright test tests/ui/p4-2-4.spec.ts --config tests/ui/desktop.config.ts
pnpm exec playwright test tests/ui/p4-2-5.spec.ts
WIMM_CLIENT=desktop pnpm exec playwright test tests/ui/p4-2-5.spec.ts --config tests/ui/desktop.config.ts
```

Der Merge-Test beendet Chromium vollständig und startet es mit demselben dauerhaften Profil erneut; er verwendet keinen kopierten Speicherzustand.

Der Desktop-Frontend-Test verwendet absichtlich den dokumentierten IndexedDB-Testadapter. Er ersetzt keinen nativen Tauri-Nachweis.

Die Layoutprüfung erstellt je Client 32 Screenshots unter `test-results/`: Konten, Kategorien, Empfänger einschließlich Merge-Auswahl und Übersicht bei 320, 768, 900 und 1024 CSS-Pixeln, jeweils in Hell und Dunkel. Die Testdaten sind synthetisch und enthalten lange deutsche Namen sowie einen siebenstelligen EUR-Betrag. Sie prüft Seitenüberlauf, Mindestmaße, ungekürzte Beträge, Systemschrift und den gespeicherten Farbschemawechsel.

P4.3.1 prüft F01 und Feldfehler jeweils mit Tastatur und Touch (390 × 844) in Chromium auf beiden Frontends. Der Kalendertest löscht ein Kalendersegment im nativen Datumsfeld; unmögliche vollständige Datumsstrings prüft ergänzend der Fachkern. Die Screenshots `f01-übersicht.png` und `datumsfeldfehler.png` entstehen unter `test-results/`. Touch ist Browseremulation und kein echter Gerätenachweis.

P4.3 prüft F02, Ergänzen/Entfernen einer dritten Zeile, normale und Splitbearbeitung, Löschabbruch/-bestätigung sowie die kombinierten Filter. Die Bestätigungsaktionen werden mit tatsächlichem Tabulator/Enter beziehungsweise Touch bei 320 × 568 ausgeführt. Die Speicherintegration prüft den gesamten unveränderten Datenstand bei Fehlern und eine veraltete Revision; die separate Vite-Testseite wird nicht in den Produktionsbuild aufgenommen.

Der Neustarttest beendet Chromium vollständig und verwendet dasselbe dauerhafte Profil erneut. Web/PWA startet dabei mit bereits vor dem Neuaufruf abgeschaltetem Netzwerk aus dem Service Worker. Das Desktop-Frontend lädt seine Assets vom lokalen Testserver und prüft anschließend denselben fachlichen Datenstand ohne Netzwerk; es ersetzt keinen Offline-Neustart der installierten Tauri-App. Die native Wiederholung bleibt P4.6.6 zugeordnet.
