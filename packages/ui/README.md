# @wimm/ui

Gemeinsame React-Oberfläche für den lokalen Einstieg von WhereIsMyMoney. Web und Desktop verwenden denselben Composition Root; die Speicher- und Plattformports werden jeweils von der App injiziert.

Die Oberfläche zeigt zunächst einen leeren Bereich ohne erfundene Guthaben. Nach dem Anlegen eines Kontos wird sein Anfangsbestand als fachliche Anfangsbuchung dauerhaft gespeichert. Er erhöht den Kontostand, zählt jedoch weder als Konsumeinnahme noch als Monatsausgabe.

## Prüfung

Im Repository ausführen:

```sh
pnpm --filter @wimm/ui test
pnpm exec playwright test tests/ui/p4-2-2.spec.ts
WIMM_CLIENT=desktop pnpm exec playwright test tests/ui/p4-2-2.spec.ts --config tests/ui/desktop.config.ts
```

Der Desktop-Frontend-Test verwendet absichtlich den dokumentierten IndexedDB-Testadapter. Er ersetzt keinen nativen Tauri-Nachweis.
