# @wimm/ui

Gemeinsame React-Oberfläche für den lokalen Einstieg von WhereIsMyMoney. Web und Desktop verwenden denselben Composition Root; die Speicher- und Plattformports werden jeweils von der App injiziert.

Die Oberfläche zeigt zunächst einen leeren Bereich ohne erfundene Guthaben. Nach dem Anlegen eines Kontos wird sein Anfangsbestand als fachliche Anfangsbuchung dauerhaft gespeichert. Er erhöht den Kontostand, zählt jedoch weder als Konsumeinnahme noch als Monatsausgabe.

Archivierte Konten bleiben mit ihrem fortgeschriebenen Saldo in einem eigenen historischen Abschnitt sichtbar. Ihre Buchungen bleiben lesbar; in neuen Buchungen, Umbuchungen und Abgleichen werden sie nicht mehr angeboten.

Archivierte Kategorien bleiben in der Kategorienreferenz vorhandener Buchungen lesbar. Sie werden weder in der Kategorie- noch in der Split-Kategorieauswahl für neue Buchungen angeboten.

Beim Zusammenführen von Empfängern werden die gespeicherten Buchungsreferenzen atomar auf den Ziel-Empfänger umgestellt. Die Quelle bleibt archiviert erhalten und wird für neue Buchungen nicht mehr angeboten. Konto, Betrag, Datum und Kategorie bleiben gleich; der zusammengeführte Stand bleibt nach einem vollständigen Chromium-Neustart erhalten.

Navigation und Stammdaten verwenden gemeinsame Layout- und Farbregeln für Web und Desktop-Frontend. Bei 320 CSS-Pixeln umbrechen Navigation und lange Namen; von 768 bis 1023 Pixeln steht eine kompakte Seitenleiste neben einspaltigen Formularen, ab 1024 Pixeln die volle Seitenleiste. Breite Tabellen scrollen ausschließlich in ihrem beschrifteten Arbeitsbereich; Beträge bleiben vollständig und einzeilig. Bedienelemente sind mindestens 44 × 44 CSS-Pixel groß, die Schrift ist die Systemschrift.

Die Auswahl „Farbschema“ in der Seitenleiste bietet „System“, „Hell“ und „Dunkel“. „System“ folgt auch laufenden Änderungen des Betriebssystemfarbschemas. Eine manuelle Auswahl überschreibt das System in den Finanzansichten und bleibt lokal über ein erneutes Laden und Entsperren hinweg erhalten. Bei nicht verfügbarem Browserspeicher gilt sie für die aktuelle Sitzung.

## Prüfung

Im Repository ausführen:

```sh
pnpm --filter @wimm/ui test
pnpm exec playwright test tests/ui/p4-2-6.spec.ts
WIMM_CLIENT=desktop pnpm exec playwright test tests/ui/p4-2-6.spec.ts --config tests/ui/desktop.config.ts
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
