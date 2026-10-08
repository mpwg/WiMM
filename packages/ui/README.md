# @wimm/ui

Gemeinsame React-Oberfläche für den lokalen Einstieg von WhereIsMyMoney. Web und Desktop verwenden denselben Composition Root; die Speicher- und Plattformports werden jeweils von der App injiziert.

Die Oberfläche zeigt zunächst einen leeren Bereich ohne erfundene Guthaben. Nach dem Anlegen eines Kontos wird sein Anfangsbestand als fachliche Anfangsbuchung dauerhaft gespeichert. Er erhöht den Kontostand, zählt jedoch weder als Konsumeinnahme noch als Monatsausgabe.

Archivierte Konten bleiben mit ihrem fortgeschriebenen Saldo in einem eigenen historischen Abschnitt sichtbar. Ihre Buchungen bleiben lesbar; in neuen Buchungen, Umbuchungen und Abgleichen werden sie nicht mehr angeboten.

Archivierte Kategorien bleiben in der Kategorienreferenz vorhandener Buchungen lesbar. Sie werden weder in der Kategorie- noch in der Split-Kategorieauswahl für neue Buchungen angeboten.

Beim Zusammenführen von Empfängern werden die gespeicherten Buchungsreferenzen atomar auf den Ziel-Empfänger umgestellt. Die Quelle bleibt archiviert erhalten und wird für neue Buchungen nicht mehr angeboten. Konto, Betrag, Datum und Kategorie bleiben gleich; der zusammengeführte Stand bleibt nach einem vollständigen Chromium-Neustart erhalten.

Navigation und Stammdaten verwenden gemeinsame Layout- und Farbregeln für Web und Desktop-Frontend. Bei 320 CSS-Pixeln stehen Bereichskopf und untere Navigation neben einer eigenen Mehr-Ansicht; lange Namen umbrechen; von 768 bis 1023 Pixeln steht eine kompakte Seitenleiste neben einspaltigen Formularen, ab 1024 Pixeln die volle Seitenleiste. Breite Tabellen scrollen ausschließlich in ihrem beschrifteten Arbeitsbereich; Beträge bleiben vollständig und einzeilig. Bedienelemente sind mindestens 44 × 44 CSS-Pixel groß, die Schrift ist die Systemschrift.

Die Auswahl „Farbschema“ unter Einstellungen bietet „System“, „Hell“ und „Dunkel“. „System“ folgt auch laufenden Änderungen des Betriebssystemfarbschemas. Eine manuelle Auswahl überschreibt das System in den Finanzansichten und bleibt lokal über ein erneutes Laden und Entsperren hinweg erhalten. Bei nicht verfügbarem Browserspeicher gilt sie für die aktuelle Sitzung.

Navigation, Bereichswechsel sowie das Anlegen von Konten, Kategorien und Empfängern sind vollständig per Tabulator, Umschalt+Tabulator, Enter und Escape erreichbar. Der sichtbare Fokus bleibt auf jedem fokussierten Bedienelement erhalten. Das Zusammenführen von Empfängern verlangt eine bestätigende Rückfrage; Escape oder „Abbrechen“ schließen sie ohne Änderung und geben den Fokus an die auslösende Aktion zurück; geänderte Dialogeingaben werden vor Verwerfen geschützt.

Einzelbuchungen erfassen Konto, Kalenderdatum, Kategorie sowie optional Empfänger und Notiz. Negative Beträge sind Ausgaben, positive Beträge Einnahmen; Punkt oder Komma sind als Dezimaltrennzeichen erlaubt, höchstens zwei Nachkommastellen und keine Tausendertrennzeichen. Die native Datumsauswahl bleibt erhalten. Ungültige beziehungsweise fehlende Beträge und unvollständige Kalenderwerte zeigen direkt am Feld einen zugänglich zugeordneten Fehler; sämtliche übrigen Eingaben bleiben erhalten. Erst nach dem dauerhaften lokalen Commit schließt der Arbeitsdialog.

Die Übersicht zeigt Monatsausgaben und Monatseinnahmen aus der gemeinsamen Fachprojektion für den aktuellen Kalendermonat in `Europe/Vienna`. Anfangsbestände und Umbuchungen zählen nicht als Konsum. F01 mit Anfangsbestand 1.000 EUR, Ausgabe 100 EUR und Einnahme 200 EUR ergibt 1.100 EUR Guthaben, 100 EUR Monatsausgaben und 200 EUR Monatseinnahmen.

## Buchungsabläufe P4.3

Splits werden mit expliziten Beträgen erfasst: Die erste Kategorie und „Split-Kategorie (optional)“ eröffnen zwei Zeilen; „Split hinzufügen“ ergänzt weitere Zeilen, deren Entfernen die übrigen Werte erhält. Die Splitsumme muss exakt dem Buchungsbetrag entsprechen. F02 mit -100 EUR und -60/-40 EUR ist gültig; -60/-39 EUR verändert keine gespeicherten Daten.

„Details“ öffnet eine vollständige Buchung einschließlich Notiz, Empfänger, Splitbeträgen und Abgleichstatus. „Bearbeiten“ ändert dieselbe Buchung mit der beim Öffnen festgehaltenen Revision. Ein zwischenzeitlich geänderter Stand wird abgewiesen und nachgeladen; der eigene Entwurf bleibt erhalten. „Löschen“ verlangt eine eigene Bestätigung; Abbrechen oder Escape verändert nichts. Löschmarkierungen bleiben im Speicher, während Liste und Fachprojektionen die gelöschten Buchungen ausschließen. Abgeglichene Buchungen bieten erst nach bestätigter Entsperrung eine Bearbeitungs-/Löschaktion; Umbuchungen werden stets mit beiden Seiten gepflegt.

Die Liste kombiniert Notiz-/Empfängersuche mit Konto- und inklusiven Datumsfiltern. „Filter zurücksetzen“ entfernt alle Einschränkungen. Ohne Daten und ohne passende Treffer erscheinen unterschiedliche Leerzustände. Unter 768 Pixeln werden Buchungen als kompakte Listeneinträge mit vollständigem Betrag und Detailaktion dargestellt. Die Detailansicht zeigt lange Inhalte vollständig.

Die scrollbare Liste rendert höchstens 16 Buchungszeilen plus zwei unsichtbare Abstandshalter. Auch bei 50.000 Buchungen sind Anfang, Mitte und Ende erreichbar; IDs und Rückkehrfokus bleiben beim Bearbeiten erhalten. Das ist ein Funktionsnachweis für P4.3.6; die gesonderten Zeitziele und der vollständige Leistungsdatensatz bleiben P4.6.5.

Während eines Speicherbefehls sind Formularfelder, Navigation und Bereichswechsel gesperrt und ein Wartezustand sichtbar. Dadurch kann der ausstehende Commit nicht seine Daten in einen inzwischen gewechselten Bereich einblenden. Ein Fehler erhält sämtliche Werte; ein Wiederholversuch speichert genau einmal. Nach dem Commit wird der bestätigte Batch direkt in die Ansicht übernommen, damit ein nachgelagerter Lesefehler keine zweite Neuanlage auslöst. Die Tests injizieren Verzögerung, Quota und Disk-full ausschließlich über eine separate Testseite mit echtem IndexedDB-Adapter; die Produktionsapp enthält keine Fehlersteuerung. Native Disk-full-Prüfung folgt in P4.6.6.

## Umbuchung, Abgleich und Historie P4.4

Die Kontenansicht bietet „Umbuchung“ mit Quellkonto, Zielkonto, positivem Betrag und Kalenderdatum. F03 mit 1.000 EUR auf Giro und 0 EUR auf Bargeld, danach 200 EUR Umbuchung, ergibt 800/200 EUR und weiterhin 1.000 EUR Gesamtvermögen; Monatsverbrauch und Einnahmen bleiben null. Beim Budgetabgang ist eine Ausgabenkategorie erforderlich, beim Budgeteintritt die Checkbox „Vorhandenes Geld für das Budget freigeben“. Transferdetails erlauben die gemeinsame Änderung oder bestätigte Löschung beider Seiten.

„Abgleich“ enthält Konto, Auszugssaldo, Auszugsdatum und die ausdrückliche Auswahl offener Bewegungen bis zu diesem Datum. Bereits abgeglichene Buchungen bilden den Ausgangssaldo. Die sichtbare Differenz stammt aus dem Fachkern; nur null und eine nicht leere Auswahl erlauben die Bestätigung. Eine Differenz erzeugt keine Buchung. „Korrektur vorschlagen“ öffnet eine eigene Vorschau mit Betrag und Konto, editierbarem Datum und Kategorie. Erst „Korrekturbuchung anlegen“ speichert eine normale, noch nicht abgeglichene Buchung. Wählen Sie diese anschließend zusätzlich aus und prüfen Sie den Abgleich erneut.

Gesperrte Details bieten „Abgleich entsperren“. Erst „Entsperren bestätigen“ hebt den ganzen zugehörigen Abgleich auf. Bei Transferpaaren werden beide Seiten und transitiv verbundene Abgleiche atomar behandelt; eine bereits freie Gegenseite behält ihren Status. Escape oder „Abbrechen“ verändert keine gespeicherten Daten. Danach sind Bearbeitung und Löschung möglich.

„Rückgängig“ und „Wiederholen“ betreffen erfolgreiche Erfassungen, Änderungen, Löschungen, Umbuchungen, Korrekturbuchungen, Abgleiche und Entsperrungen. Die Fachgegenbefehle stellen Finanzfelder und vorherige Abgleichstatus wieder her, erhöhen Revisionen und bewahren Tombstones. Fremdänderungen oder fehlgeschlagene Commits verändern weder gespeicherte Daten noch die Historie. Neue Aktionen verwerfen den Redozweig; Bereichswechsel, Sperren und Stammdatenaktionen leeren die flüchtige Historie. Native Menü-/Shortcutanbindung ist in P4.5 umgesetzt.

Geänderte Buchungs-, Transfer- und Abgleichformulare bleiben bei Navigation, Bereichswechsel, Sperren, Abbrechen oder Escape erhalten, bis „Eingaben verwerfen“ ausdrücklich bestätigt wird. „Weiter bearbeiten“ beziehungsweise Escape in der Rückfrage bewahrt Werte und gibt den Fokus an den Auslöser zurück. Ein unverändertes Formular schließt ohne Rückfrage. Beim Browserneustart warnt die gewöhnliche `beforeunload`-Rückfrage vor dem Verlust offener Eingaben; Entwürfe werden durch P4.4 nicht dauerhaft gespeichert. Nach erfolgreichem Commit sind die verbleibenden Standardauswahlen ein sauberer Formularstand.

## Prüfung

Im Repository ausführen:

```sh
pnpm --filter @wimm/ui test
pnpm exec playwright test tests/ui/p4-4.spec.ts
WIMM_CLIENT=desktop pnpm exec playwright test tests/ui/p4-4.spec.ts --config tests/ui/desktop.config.ts
pnpm exec playwright test tests/workspace/p4-4.spec.ts --config tests/workspace/config.ts
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

P4.4 prüft F03 und Budgetgrenzen, explizite Buchungsauswahl, Differenz/Korrektur, Entsperrabbruch/-bestätigung, Transferpflege, Undo/Redo mit Fremdänderungen und Entwurfsschutz in Chromium. Die gemeinsame Speicherintegration nutzt echtes IndexedDB; ein ungültiger letzter Put lässt die vorangehenden Transfer-/Abgleichzeilen derselben Dexie-Transaktion zurückrollen. Der Auswahlabgleich wird zusätzlich nach vollständig beendetem und mit demselben Profil neu gestartetem Chromium geprüft. Das Desktop-Frontend der Produktionsapp und die separat bezeichnete Desktop-Komposition der Testseite sind Browserprüfungen, keine nativen Tauri-Belege. Touch ist Emulation bei 390 × 844. Native Menüs, Betriebssystem-Kurzbefehle und Geräteprüfungen bleiben P4.5/P4.6.

## Plattformbedienung P4.5

Cmd/Ctrl+N eröffnet eine neue Buchung, Cmd/Ctrl+F fokussiert die Suche. Neue Buchung schützt vorhandene Entwürfe mit der bestehenden Rückfrage. Fach-Undo/Redo greifen außerhalb von Textfeldern; fokussierte Textfelder behalten ihren gewöhnlichen Undo-/Redoverlauf. Native Menüereignisse verwenden dieselben Finanzaktionen und berücksichtigen offene Dialoge sowie laufende Speicherung. `PlatformServices.onMenuCommand` liefert ein abmeldbares Abonnement; beim Sperren werden Finanzbefehle deaktiviert.

Der Browserdateiport verwendet echte Dateiauswahl einschließlich folgenlosem Abbruch und gibt Name, MIME-Typ und Inhalt zurück. Der Speicherport erzeugt einen Browserdownload mit vorgegebenem Dateinamen. Diese Ports bereiten P5/P10 vor; sie führen keinen Finanzimport oder WIMM-Export aus. Hilfe-/Lizenzlinks öffnen mit `noopener,noreferrer` und akzeptieren nur HTTP/HTTPS ohne Zugangsdaten.

`p4-5.spec.ts` prüft Kurzbefehle, Entwürfe, gesperrten Tresor sowie Auswahl, Abbruch, Downloadinhalt und Fremdlink. Der Port-Harness benötigt den Entwicklungsserver; im Vorschau-Build wird nur dieser Harness ausgelassen. Native Menüs und Systemdialoge werden separat mit Plattformangabe in der [P4.5-Übergabe](../../docs/handoffs/p4-5.md) geprüft. Die Finanzansicht wird als eigenes Modul vor dem Einstieg vollständig geladen, damit beide Produktionsbuilds unter der bestehenden Chunkgrößengrenze bleiben.

Der separate Moduleinstieg `@wimm/ui/workspace` exportiert die Finanzansicht. Die App lädt ihn vollständig vor dem Einstieg, damit die Service-Worker-Kontrolle auch beim Neustart in den Sperrbildschirm alle benötigten Module cached.

## Gesamtprüfung P4.6

Die [Nachprüfung vom 8. Oktober 2026](../../docs/handoffs/p4-review-2026-10-08.md) trennt aktuelle Funktionsbelege von den verbleibenden Browser-, Screenreader-, Zoom-, Geräte- und nativen Plattformabnahmen. `check:all` führt die separate Produktionsbrowserabnahme `test:ui:acceptance` nicht aus; erfolgreiche Firefox-UX-Tests ersetzen deren Kernablauf-/Neustartnachweis nicht.

Die mobile Hauptnavigation bleibt am unteren Bildschirmrand erreichbar und bietet Übersicht, Buchungen und Mehr. Mehr führt mit sichtbarem Fokus zu Konten, Kategorien und Empfängern; Budget folgt erst in P6. Ein eigener scrollbarer Inhaltsbereich endet oberhalb der Navigation; die untere sichere Fläche wird berücksichtigt. Mobile Buchungslisten zeigen große negative Beträge vollständig in einer eigenen Zeile. Lange Kategorienamen umbrechen auch im Detaildialog. Modale Dialoge halten Tab und Umschalt+Tab im obersten geöffneten Dialog.

```sh
pnpm test:ui:matrix
pnpm test:ui:acceptance
pnpm test:ui:zoom
```

Die Matrix prüft beide Kompositionen bei 320×568, 390×844, 768×1024, 1440×900 und 1920×1080 in Hell und Dunkel: Übersicht, Konten, Kategorien, Empfänger, Buchungen, Details und Feldfehler. Sie misst berechnete Textkontraste und erzeugt 160 synthetische Screenshots. Die Leistungsprüfung verwendet 50.000 Buchungen, zehn Konten, 100 Kategorien und 36 Monate; 1.000 synthetische SharedExpense-Payloads liegen ausschließlich als Speicherlast in Testprojektionen, ohne vorgezogene P7-Funktion. Sie prüft die gespeicherten Mengen, Saldo, Filtertreffer und konkrete Scroll-IDs sowie kaltes Listenöffnen, warme Filter-/Scrollreaktion mit fünf Vorläufen und 30 Messungen. Die Matrix ist Teil von `pnpm check:ci`.

Die zusätzliche Browserabnahme verwendet Chromium, Firefox und WebKit gegen beide gebauten Frontends; zunächst beide Apps bauen und die drei Playwright-Browser installieren. Jeder Browser wird mit einem dauerhaften, getrennten Profil vollständig beendet und erneut gestartet. Chromium-Web startet dabei bereits ohne Netzwerk aus dem Service Worker; WebKit/Firefox und Desktop-Frontend laden die Appassets zunächst lokal und prüfen dann ohne Netzwerk. Der Zoomlauf benötigt macOS-Bedienungshilfenzugriff und das deutschsprachige echte Chromium-Systemmenü; er bestätigt 200 % über halbierte Inhaltsbreite und verdoppelte Pixeldichte bei unverändertem CSS-Zoom. Er gehört wegen seiner GUI-Voraussetzungen nicht zur allgemeinen CI-Serie.

JSON-Berichte, Screenshots und Traces liegen unter `test-results/p4-6-*`, dauerhafte synthetische Profile unter `.toolchain-checks/`. Ein Browserstartfehler bleibt ein fehlgeschlagener Lauf und wird nicht still ausgelassen. Echte Screenreader-, native Plattform- und Gerätenachweise stehen getrennt in der [P4.6-Kriterienmatrix](../../docs/handoffs/p4-6.md). P4.6 und P4 sind bei offenen Zellen nicht vollständig abgenommen.

## Dateiimport, Regeln und Dauerzahlungen P5

„Import“ öffnet CSV, CAMT.053, OFX oder QFX über den Plattformdateiport. Wählen Sie das Zielkonto und eine Kategorie ausdrücklich aus. CSV-Zuordnung umfasst Encoding, Trennzeichen, Kopfzeile, Spalten, Datums-/Zahlenformat und Vorzeichen. „Vorlage speichern“ hält die Zuordnung im aktuellen Bereich; eine gespeicherte Vorlage lässt sich später auswählen. Parsing und Vorschau laufen im abbrechbaren lokalen Worker. Die Originalzeile bleibt neben normalisiertem Datum, Betrag und Fehlern sichtbar. „Zeile korrigieren“ validiert editierte ISO-/Dezimaltexte erneut. Ungültige Zeilen benötigen eine Korrektur oder ausdrücklichen Ausschluss.

Empfängernamen bleiben in der Buchung erhalten; eindeutige aktive Namen/Aliasse werden wiederverwendet, neue Empfänger atomar mit der Gruppe angelegt. Empfängerregeln verändern den Quellfingerprint nicht. Gleiche Zahlungen innerhalb derselben Datei werden bereits in der Vorschau markiert. Mögliche Dubletten benötigen „Bewusst getrennte Zahlung“ oder „Ausdrücklich ausschließen“. Gleiche Quell-ID mit anderem Inhalt bleibt ein Prüfkonflikt. „Entscheidungen bestätigen“ speichert zunächst den Importplan; „Fortsetzen“ schreibt höchstens 100 Buchungen samt Fortschritt atomar. Die Gruppenvorbereitung läuft ebenfalls im Worker. Nach einem Speicherfehler oder Appneustart lässt sich derselbe Import fortsetzen. Zwischen Gruppen dürfen Sie aufhören; bereits übernommene Buchungen bleiben erhalten. Die Ansicht meldet ausdrücklich „Teilweise übernommen“ und verspricht keinen vollständigen Rollback. Offene Vorschauen sind vor Navigation/Sperren durch die Verwerfungsrückfrage geschützt.

„Regeln und Dauerzahlungen“ verwaltet katalogisierte Regeln mit Priorität, Stop und Aktivierung sowie normale Buchungsvorlagen für weekly/monthly/yearly. Regeln setzen Kategorie, Empfänger oder offenen/bestätigten Abgleichstatus und werden bereits in der Importvorschau angewendet. Fällige Vorschläge buchen nichts. Erst „Zahlung bestätigen“ erzeugt eine Buchung; „Fälligkeit überspringen“ erledigt sie ohne Kontobewegung. „Import zuordnen“ verknüpft eine ausgewählte importierte Zahlung desselben Kontos und erzeugt keine weitere Buchung. Bestätigte und übersprungene Fälligkeiten erscheinen nach Neustart nicht erneut.

Prüfungen: `tests/ui/p5.spec.ts` auf Web und Desktopfrontend (Tastatur/Touch), `tests/workspace/p5.spec.ts` mit echtem IndexedDB, beendetem Chromiumprozess, Speicherfehlern, 99.999-Zahlungen-Import und fünf Viewports in Hell/Dunkel. Native Laufzeitnachweise und offene Plattform-/Geräteprüfungen stehen in der [P5-Übergabe](../../docs/handoffs/p5.md). Die P5-Tests erweitern die zentralen vorhandenen Prüfserien.

Die ergänzende P5-Browserabnahme verwendet `tests/ui/p5-browsers.config.ts` gegen gebaute Frontends: je fünf WebKit-Fälle bestanden, Firefox scheitert bereits am Profilstart und bleibt ausdrücklich nicht abgenommen. `tests/acceptance/p5.config.ts` prüft mit `WIMM_REAL_ZOOM=1` den echten 200-%-Zoom über das macOS-Chromium-Systemmenü auf Web und Desktop-Frontend. Diese Läufe benötigen die jeweiligen Browser beziehungsweise macOS-Bedienungshilfen und sind von der allgemeinen CI-Serie getrennt. Native 10.000-Zeilen-Vorschau und tatsächlicher SQLite-Disk-full-Rollback mit Offline-Wiederaufnahme stehen in der [nativen P5-Teilmatrix](../../docs/handoffs/p5-native.md).

## UX-Neugestaltung

Die freigegebene Neugestaltung verwendet semantische Grün-/Hell-/Dunkeltokens, Systemschrift und gemeinsame Buttons, Arbeitsdialoge, Leer- und Statuszustände. Dekorative Trennlinien und zugängliche Eingabegrenzen sind getrennt. Lucide React 1.45.0 (ISC, Herkunft: npm-Paket `lucide-react`, unverändert) liefert Icons; [Fremdlizenz](licenses/lucide-react.txt) bleibt erhalten. Die bestehenden Abhängigkeits-Reifevorgaben werden eingehalten.

Buchungen zeigen zuerst die Liste. „Neue Buchung“ und Cmd/Ctrl+N öffnen denselben Arbeitsdialog mit Ausgabe-/Einnahmerichtung, optionaler Notiz und Aufteilung. Kontoanlage bietet einen optionalen Anfangsbestand; der Fachkern erstellt beide Aggregate in einem atomaren Batch. Kontodetails begrenzen die Buchungsliste auf das gewählte Konto und öffnen Umbuchung beziehungsweise geführten Abgleich.

## Verwaltung und Import nach UX-05

Einstellungen bündeln Kategorien, Empfänger, Regeln, Dauerzahlungen und Farbschema. Verwaltungsansichten zeigen zuerst Listen; Anlage und Bearbeitung öffnen geschützte Arbeitsdialoge. Regeln erscheinen als deutsche Wenn-dann-Sätze. Der lokale Import führt durch Datei, Zuordnung, Vorschau und Bestätigung; ungültige Zeilen und mögliche Dubletten verlangen ausdrückliche Entscheidungen. Bestätigte Gruppen werden mit „Fortsetzen“ übernommen und bleiben dauerhaft wiederaufnehmbar.

## Oberfläche nach dem UX-Flow

Die gemeinsame Oberfläche übernimmt Grünakzent, warme Flächen, die Wortmarke „WiMM.“ und ruhige Listen aus dem freigegebenen klickbaren Konzept. „Alles im Blick.“ zeigt den echten **Kontostand gesamt**, letzte Buchungen, fällige Zahlungsvorschläge und Monatswerte. Desktop verwendet eine Seitenleiste mit separatem Bereichskopf; mobil bleiben Übersicht, Buchungen und die eigene Mehr-Ansicht erreichbar. Einstellungen enthalten Verwaltung und Farbschema. Tresor, Rettungscode und erstes Konto bilden den geführten lokalen Einstieg.

Buchungen und Konten werden über geschützte Dialoge bearbeitet; mobil füllen diese den Bildschirm. Import führt durch vier ausdrücklich bestätigte Schritte. Budget, Teilen und Familienausgleich sind weiterhin spätere Fachpakete. Es werden keine simulierten Konzeptdaten übernommen. Prüfung: `pnpm test:ux`; aktuelle Belege und offene Plattformprüfungen stehen in der UX-Übergabe.

Aktuelle UX-Abnahme vom 5. Oktober 2026: [Kriterien und Prüfbelege](../../docs/handoffs/ux.md). Die Umsetzung ist bereit zur Prüfung; Die Ubuntu-CI besteht einschließlich Firefox; vollständige Geräte-/Screenreader- und weitere native Plattformbelege sowie die gesamte Zoommatrix sind noch offen.

## P5-Nachprüfung vom 8. Oktober 2026

Die [aktuelle Kriterienmatrix](../../docs/handoffs/p5-review-2026-10-08.md) bestätigt Parser-/Fach-/Browser-/Speicher-/Offline-Kernabläufe, belegt aber zusätzliche Funktions- und Abnahmelücken. [Gesamtabnahme #71](https://github.com/mpwg/WiMM/issues/71) verknüpft alle Einzelissues. P5 ist weder vollständig umgesetzt noch vollständig abgenommen; frühere native Belege bleiben historisch.
