# Gemeinsame Clientanwendung

AGPL-3.0-or-later. K02 trennt Clientabläufe von React. Der bisherige Teilabschnitt enthält FinanceModel, FinanceHistory, AutomationModel und FinanceApplication für atomaren Commit, Konfliktlesen und bestätigten Zustand. Uhr/IDs und Importvorbereitung/Abbruch werden injiziert; die Modelle verwenden keine React-, DOM-, localStorage-, Web-Lock- oder Worker-Globals.

`FinanceApplication` veröffentlicht beobachtbaren Zustand. Ein bestätigter Commit wird direkt übernommen und erzeugt keinen nachgelagerten Wiederholungswrite; Schreibfehler erhalten Eingaben, stale CAS lädt kontrolliert den aktuellen Bestand. Gegenbefehle bleiben im Fachkern und verwenden neue Revisionen/Tombstones. Importvorbereitung kommt aus einem BackgroundExecutionPort; eine späte Antwort nach Abbruch wird nicht angewandt.

`pnpm --filter @wimm/application test` prüft browserfreie Aktionen, Abbruch/Late-Reply, bestätigten Commit bei späterem Lesefehler und Profil-/Schreibkonflikte. [K02-Teilbelege](../../docs/handoffs/k02-2026-10-08.md), [K01-Verträge](../../docs/core-contracts.md), [K02-Issue #93](https://github.com/mpwg/WiMM/issues/93).

K02 ist noch nicht vollständig abgenommen: Profil-/Tresorabläufe und endgültige App-Composition werden im nächsten Abschnitt aus UI-Callbacks herausgelöst. Der vorläufige Browseradapter befindet sich noch in packages/ui; er enthält ausschließlich Laufzeitanbindung, keine Finanzberechnung. Die TypeScript-Fachengine bleibt bis K04/K05 aktiv.
