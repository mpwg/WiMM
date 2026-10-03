# P6 — Teilaufgaben für Budget, Ziele und Berichte

## Auftrag und Reihenfolge

Diese Teilaufgaben konkretisieren [P6](tasks.md#p6--budget-ziele-und-berichte). Der Nutzerauftrag vom 3. Oktober 2026 erlaubt ihre Planung; die Implementierungsfreigabe für P6 steht aus. P6.1 bis P6.6 werden in Reihenfolge nach abgeschlossenem [P5](p5-import.md) bearbeitet. Berechnungen entstehen ausschließlich im Fachkern.

Status und konkrete Prüfbelege hier sowie den Gesamtstatus in [tasks.md](tasks.md) pflegen; nach jedem abgeschlossenen Abschnitt einen zusammengehörigen Zwischencommit und eine [Übergabe](templates/handoff.md) erstellen. P6 ist erst nach allen Teilabnahmen und der Gesamt-Abnahme erledigt; danach folgt [P7](p7-family.md). Für die Umsetzung wimm-finance und wimm-ui verwenden. Reserve, private Vorleistungen und bereichsübergreifende Deduplizierung werden in P7 ergänzt und mit F11/F16 sowie Privatheitsfällen geprüft; P6 ändert ihre bereits spezifizierten Verträge nicht.

## P6.1 — Budgetmethodenhistorie und Monatsverträge

- Status: offen.
- Freigabe: Implementierungsauftrag für P6 erforderlich.
- Voraussetzungen: P5 erledigt.
- Schritte: BudgetMethodPeriod/BudgetMonth und budget.method.set/month.save validieren; Gültigkeit zum Monatsanfang, vollständige Monatszeilen und Revisionen umsetzen; Abhängigkeit späterer Monatsprojektionen erfassen.
- Ergebnis: chronologische Methoden-/Monatsgrundlage ohne Änderung realer Buchungen.
- Verträge: [Budgetmethoden](domain.md), [Datenmodell](data-model.md), [Budgetbefehle](api.md), F15 in [Tests](testing.md).
- Abnahme: ein Methodenstand pro Bereich/Monat; historische Plan-/Zuweisungswerte erhalten; erster Umschlagvortrag null; keine Umrechnung von Prognosen in Geld.
- Prüfungen: F15, doppelte/ungültige Monate, Methodenwechsel hin/zurück und Revisionenkonflikte.
- Prüfbelege: noch keine.

## P6.2 — Planbudget und Plan/Ist-Oberfläche

- Status: offen.
- Freigabe: Implementierungsauftrag für P6 erforderlich.
- Voraussetzungen: P6.1 erledigt.
- Schritte: Plan-/Ist-Einnahmen und -Ausgaben, Abweichungen und reine Vortragsdarstellung projizieren; Monatswechsel und Planwerteingabe anbinden; Vorschlagsprognosen sichtbar getrennt darstellen.
- Ergebnis: Planbudget mit nachvollziehbaren Vorzeichen und unveränderten Kontosalden.
- Verträge: [Planbudget](domain.md#planbudget), [Budgetansicht](ui.md), F06 in [Tests](testing.md).
- Abnahme: Ausgabeabweichung Plan minus Ist, Einnahmeabweichung Ist minus Plan; Erstattungen mindern Nettoausgaben; Pläne/Vortragsdarstellung schaffen kein echtes Guthaben.
- Prüfungen: F06, positive Ausgabensplits, Monatswechsel, Planänderung und Saldenvergleich vor/nach Planung.
- Prüfbelege: noch keine.

## P6.3 — Umschläge, Zuweisung und Umschichtung

- Status: offen.
- Freigabe: Implementierungsauftrag für P6 erforderlich.
- Voraussetzungen: P6.2 erledigt.
- Schritte: available/budgetEquity/unassigned im Fachkern ableiten; Zuweisung und budget.move atomar validieren; negative Vorträge sowie on-/off-budget Transfers berücksichtigen; Folge-Neuberechnung bei Historienänderung umsetzen.
- Ergebnis: Umschlagbudget aus realem vorhandenem Geld und Kategorievorträgen.
- Verträge: [Umschlagbudget](domain.md#umschlagbudget), [Transferregeln](domain.md), F04/F05/F15 in [Tests](testing.md).
- Abnahme: kein doppelt zuweisbarer Vortrag, keine künftige Einnahme als Geld; Zuweisung über verfügbare Mittel abgewiesen; tatsächliche Defizite bleiben sichtbar/vorgetragen; Umschichtung summenneutral.
- Prüfungen: F04/F05/F15, negative Konten/Kategorien, sichere Summen, Budgetgrenztransfers und historische Neuberechnung.
- Prüfbelege: noch keine.

## P6.4 — Sparziele und Dauerzahlungsprognosen

- Status: offen.
- Freigabe: Implementierungsauftrag für P6 erforderlich.
- Voraussetzungen: P6.3 erledigt.
- Schritte: savingsGoal.save/archive und Fortschritts-/Monatsratenprojektion implementieren; offene Schedulevorschläge in Prognosen einbeziehen; Ziel-/Prognoseansichten anbinden.
- Ergebnis: Sparziele und Vorschau mit klarer Trennung vom vorhandenen Budgetgeld.
- Verträge: [Ziele und Dauerzahlungen](domain.md), SavingsGoal in [Datenmodell](data-model.md), [Berichtsansichten](ui.md).
- Abnahme: Zielbetrag positiv; Rate aufgerundet über verbleibende Monate einschließlich Zielmonat, mindestens ein Monat; Vorschläge verändern weder Salden noch unassigned.
- Prüfungen: erreichtes/überfälliges Ziel, fehlendes Zieldatum, Rundungs-/Grenzfälle, Bestätigung einer Fälligkeit und Trennung Plan/Prognose/Ist.
- Prüfbelege: noch keine.

## P6.5 — Berichte, Workerprojektion und Detailnavigation

- Status: offen.
- Freigabe: Implementierungsauftrag für P6 erforderlich.
- Voraussetzungen: P6.4 erledigt.
- Schritte: Monats-/Kategorie-/Vermögensberichte und Perspektivfilter anbinden; große Projektionen im Worker ausführen; Berichtsposten auf Einzelbuchungen zurückführen; Budgetaktionen einschließlich Gegenbefehlen in UI abschließen.
- Ergebnis: reproduzierbare Berichte und interaktive Budgetarbeit.
- Verträge: [Berichtsperspektiven](domain.md), [Workerarchitektur](architecture.md), [UI](ui.md), [Leistungsziele](testing.md).
- Abnahme: Opening/Transfer/Beiträge/Ausgleich nicht als Konsum zählen; keine unberechtigten Bereiche einbeziehen; Summen aus Detailbuchungen nachvollziehbar; Historienänderung aktualisiert alle Folgemonate.
- Prüfungen: Berichtssummen gegen Einzelbuchungen, Methodenwechsel/Undo/Monatsnavigation, Worker-/Hauptthreadgleichheit und Leistungsdatensatz.
- Prüfbelege: noch keine.

## P6.6 — Budgetinvarianten und Gesamt-Abnahme

- Status: offen.
- Freigabe: Implementierungsauftrag für P6 erforderlich.
- Voraussetzungen: P6.5 erledigt.
- Schritte: Plan-/Umschlag-/Ziel-/Berichtssuiten zusammenführen; Adapterneuaufbau prüfen; Fortschritt und Messungen dokumentieren; Erweiterungspunkte für die verbindlichen P7-Reserve-/Veröffentlichungsregeln abgleichen.
- Ergebnis: beide Budgetmethoden abgenommen, Familienerweiterungen eindeutig P7 zugeordnet.
- Verträge: [P6](tasks.md#p6--budget-ziele-und-berichte), [Fachmodell](domain.md), [Tests](testing.md).
- Abnahme: F04–F06/F15, negative Vorträge, Überbudgetierungsablehnung und Folge-Neuberechnung bestanden; keine doppelte Kontoführung; rein clientseitige Berechnungen.
- Prüfungen: Fach-/Budgetregressionen, Berichtssummen, Adapterprojektionen, UI-Monatswechsel/Undo/Prognose und Leistung mit dokumentiertem Gerät/Build.
- Prüfbelege: noch keine.
