# @wimm/domain

Plattformfreier Fachkern von WhereIsMyMoney. Geld wird ausschließlich als sichere ganze Cent verarbeitet; Kalenderdaten werden unabhängig von Tageszeiten validiert. Der Kern besitzt keine UI-, HTTP- oder Speicherabhängigkeiten. Lizenz: AGPL-3.0-or-later.

Fachbefehle liefern vollständige Änderungsmengen mit erwarteten Revisionen. Der aufrufende Client speichert jede Menge atomar über seinen Speicherport. `saveTransaction`/`deleteTransaction`, `saveTransfer`/`deleteTransfer` und `confirmReconciliation`/`unlockReconciliation` prüfen ihre Fachaggregate und Referenzen; Projektionen berechnen Salden und Konsum reproduzierbar.

Transfers enthalten beide kategoriefreien Gegenbuchungen. Beim Budgetabgang werden die vollständige Ausgabenkategorie und ihre Gruppe mitgeprüft; beim Eintritt ist die ausdrücklich bestätigte Freigabe `budgetRelease=true` erforderlich. Datum und Betrag werden exakt validiert.

`reconciliationDifference` ermittelt die Differenz aus Auszugssaldo, bestätigten Ausgangsbuchungen bis zum Auszugsdatum und ausgewählten offenen Bewegungen. `confirmReconciliation` akzeptiert ausschließlich null und speichert nur die neue Auswahl; die Ausgangsbuchungen werden mit CAS gelesen. Eine Korrektur wird separat als normale Buchung bestätigt.

`unlockFinanceSelection` hebt alle transitiv verbundenen Abgleiche einschließlich vollständiger Transferpaare in einem Batch auf. Bereits freie Gegenbuchungen behalten ihren Status. `reverseFinanceAction` erzeugt gezielte reguläre Gegenbefehle für die flüchtige Clienthistorie. Erwartete Revisionen, Referenzen und fachliche Regeln werden erneut geprüft; Finanzfelder und vorherige Abgleichstatus werden wiederhergestellt, während Revisionen steigen und Tombstones erhalten bleiben. Der Kern ersetzt dabei keinen Bereichssnapshot.

Prüfung in der aktiven Repository-Arbeitskopie:

```sh
pnpm --filter @wimm/domain test
pnpm --filter @wimm/ui test
pnpm test:ui:integration
```

Die UI-Pakettests prüfen vollständige Gegenbefehlsfolgen mit einem atomaren Speicheradapter. Die Browserintegration ergänzt echtes IndexedDB, UI-Bestätigungen und Fehlrollback. Native Plattformprüfungen bleiben der zugehörigen P4-Abnahme zugeordnet. Verbindliche Regeln stehen in [Fachmodell](../../docs/domain.md), [Datenmodell](../../docs/data-model.md) und [API](../../docs/api.md).
