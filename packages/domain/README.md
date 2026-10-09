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

## Import und Automatisierung P5

`automation.ts` enthält die reinen Regel-, Importgruppen- und Schedulebefehle. Geld, Referenzen und Revisionen werden vor Rückgabe einer vollständigen Änderungsmenge geprüft. `commitImportGroup` erzeugt höchstens 100 Buchungen zusammen mit Fingerprints und Fortschritt; der Aufrufer speichert alles atomar. Wiederaufnahme verwendet Import-ID und normalisierte Quellzeile. Identische Quell-IDs mit anderem Inhalt sind Prüfkonflikte; echte gleiche Zahlungen benötigen `separate`. Fingerprints verwenden NFC, zusammengefasste Whitespaces und deutsche Kleinschreibung ohne Ziffernverlust.

Regeln unterstützen Datum/Betrag mit equals/gte/lte sowie Empfänger/Verwendungszweck mit equals/contains. Aktionen setzen Kategorie, Empfänger oder uncleared/cleared. Reihenfolge und Stop sind deterministisch; fremde Referenzen und beliebige Aktionen werden abgewiesen. `rule.reorder` erwartet die vollständige Reihenfolge mit Revisionen.

`dueDates` erzeugt reine Vorschläge für weekly/monthly/yearly mit positivem Intervall und optionalem Enddatum. Monats-/Jahresrhythmen behalten den ursprünglichen Fälligkeitstag (F14). `resolveOccurrence` bestätigt oder überspringt atomar und idempotent. Eine ausdrücklich zugeordnete importierte Buchung wird verknüpft, ohne eine weitere Zahlung anzulegen. Konto-/Schedulerevisionen verhindern konkurrierende Doppelübernahmen. Eigener Code bleibt AGPL-3.0-or-later.

Prüfung: `pnpm test:domain`; synthetische F14-, Regel-, Dubletten-, Referenz-, Überlauf- und Wiederaufnahmefälle in `automation.test.ts`. Importierte Empfänger werden anhand eindeutiger Namen/Aliasse wiederverwendet oder atomar mit der Gruppe angelegt; Quellfingerprints bleiben vor Regelanwendung festgehalten. Neue Dauerzahlungsbuchungen prüfen zusätzlich die sichere Kontosumme. UI-/Speicherintegration und Plattformgrenzen stehen in der [P5-Übergabe](https://github.com/mpwg/WiMM/blob/84d730cc6e10d70cf6ac6ff9bc28c4a9c4376e92/docs/handoffs/p5.md).

## Architekturstand vom 9. Oktober 2026

Bestand und Ziel sind getrennt: [gemeinsame Rust-Architektur](../../docs/architecture.md). Hier dokumentierte Funktionen und Arbeitsregeln beziehen sich auf den Bestand; neue Rust-Anwendungs-/DAL-/Serverumstellung ist noch nicht implementiert. Aktuelle Aufträge und Kriterien in tasks.md/GitHub; historische Belege ersetzen keine Zielabnahme.
