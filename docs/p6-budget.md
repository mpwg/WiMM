# P6 — Spezifikation für Budget, Ziele und Berichte

## Ziel und Verantwortung

Diese funktionale Spezifikation bleibt verbindlich; aktueller Auftrag/Freigabe ausschließlich in [Aufgaben](tasks.md), Fortschritt und Blockaden in GitHub. Die gemeinsame Rust-Architektur ist Ziel, keine behauptete Implementierung. Fachregeln im Rust-Kern, Clientabläufe in Rust-Anwendung, Serverabläufe im öffentlichen Rust-Server; Plattformen bleiben Adapter. Neue Produktfeatures dieses Pakets benötigen weiterhin ihren gesonderten Auftrag. [Architektur](architecture.md), [Prüfstrategie](testing.md).

## P6.1 — Budgetmethodenhistorie und Monatsverträge

- Voraussetzungen: P5 erledigt.
- Schritte: BudgetMethodPeriod/BudgetMonth und budget.method.set/month.save validieren; Gültigkeit zum Monatsanfang, vollständige Monatszeilen und Revisionen umsetzen; Abhängigkeit späterer Monatsprojektionen erfassen.
- Ergebnis: chronologische Methoden-/Monatsgrundlage ohne Änderung realer Buchungen.
- Verträge: [Budgetmethoden](domain.md), [Datenmodell](data-model.md), [Budgetbefehle](api.md), F15 in [Tests](testing.md).
- Abnahme: ein Methodenstand pro Bereich/Monat; historische Plan-/Zuweisungswerte erhalten; erster Umschlagvortrag null; keine Umrechnung von Prognosen in Geld.
- Prüfungen: F15, doppelte/ungültige Monate, Methodenwechsel hin/zurück und Revisionenkonflikte.

## P6.2 — Planbudget und Plan/Ist-Oberfläche

- Voraussetzungen: P6.1 erledigt.
- Schritte: Plan-/Ist-Einnahmen und -Ausgaben, Abweichungen und reine Vortragsdarstellung projizieren; Monatswechsel und Planwerteingabe anbinden; Vorschlagsprognosen sichtbar getrennt darstellen.
- Ergebnis: Planbudget mit nachvollziehbaren Vorzeichen und unveränderten Kontosalden.
- Verträge: [Planbudget](domain.md#planbudget), [Budgetansicht](ui.md), F06 in [Tests](testing.md).
- Abnahme: Ausgabeabweichung Plan minus Ist, Einnahmeabweichung Ist minus Plan; Erstattungen mindern Nettoausgaben; Pläne/Vortragsdarstellung schaffen kein echtes Guthaben.
- Prüfungen: F06, positive Ausgabensplits, Monatswechsel, Planänderung und Saldenvergleich vor/nach Planung.

## P6.3 — Umschläge, Zuweisung und Umschichtung

- Voraussetzungen: P6.2 erledigt.
- Schritte: available/budgetEquity/unassigned im Fachkern ableiten; Zuweisung und budget.move atomar validieren; negative Vorträge sowie on-/off-budget Transfers berücksichtigen; Folge-Neuberechnung bei Historienänderung umsetzen.
- Ergebnis: Umschlagbudget aus realem vorhandenem Geld und Kategorievorträgen.
- Verträge: [Umschlagbudget](domain.md#umschlagbudget), [Transferregeln](domain.md), F04/F05/F15 in [Tests](testing.md).
- Abnahme: kein doppelt zuweisbarer Vortrag, keine künftige Einnahme als Geld; Zuweisung über verfügbare Mittel abgewiesen; tatsächliche Defizite bleiben sichtbar/vorgetragen; Umschichtung summenneutral.
- Prüfungen: F04/F05/F15, negative Konten/Kategorien, sichere Summen, Budgetgrenztransfers und historische Neuberechnung.

## P6.4 — Sparziele und Dauerzahlungsprognosen

- Voraussetzungen: P6.3 erledigt.
- Schritte: savingsGoal.save/archive und Fortschritts-/Monatsratenprojektion implementieren; offene Schedulevorschläge in Prognosen einbeziehen; Ziel-/Prognoseansichten anbinden.
- Ergebnis: Sparziele und Vorschau mit klarer Trennung vom vorhandenen Budgetgeld.
- Verträge: [Ziele und Dauerzahlungen](domain.md), SavingsGoal in [Datenmodell](data-model.md), [Berichtsansichten](ui.md).
- Abnahme: Zielbetrag positiv; Rate aufgerundet über verbleibende Monate einschließlich Zielmonat, mindestens ein Monat; Vorschläge verändern weder Salden noch unassigned.
- Prüfungen: erreichtes/überfälliges Ziel, fehlendes Zieldatum, Rundungs-/Grenzfälle, Bestätigung einer Fälligkeit und Trennung Plan/Prognose/Ist.

## P6.5 — Berichte, Workerprojektion und Detailnavigation

- Voraussetzungen: P6.4 erledigt.
- Schritte: Monats-/Kategorie-/Vermögensberichte und Perspektivfilter anbinden; große Projektionen im Worker ausführen; Berichtsposten auf Einzelbuchungen zurückführen; Budgetaktionen einschließlich Gegenbefehlen in UI abschließen.
- Ergebnis: reproduzierbare Berichte und interaktive Budgetarbeit.
- Verträge: [Berichtsperspektiven](domain.md), [Workerarchitektur](architecture.md), [UI](ui.md), [Leistungsziele](testing.md).
- Abnahme: Opening/Transfer/Beiträge/Ausgleich nicht als Konsum zählen; keine unberechtigten Bereiche einbeziehen; Summen aus Detailbuchungen nachvollziehbar; Historienänderung aktualisiert alle Folgemonate.
- Prüfungen: Berichtssummen gegen Einzelbuchungen, Methodenwechsel/Undo/Monatsnavigation, Worker-/Hauptthreadgleichheit und Leistungsdatensatz.

## P6.6 — Budgetinvarianten und Gesamt-Abnahme

- Voraussetzungen: P6.5 erledigt.
- Schritte: Plan-/Umschlag-/Ziel-/Berichtssuiten zusammenführen; Adapterneuaufbau prüfen; Fortschritt und Messungen dokumentieren; Erweiterungspunkte für die verbindlichen P7-Reserve-/Veröffentlichungsregeln abgleichen.
- Ergebnis: beide Budgetmethoden abgenommen, Familienerweiterungen eindeutig P7 zugeordnet.
- Verträge: [P6](tasks.md#p6--budget-ziele-und-berichte), [Fachmodell](domain.md), [Tests](testing.md).
- Abnahme: F04–F06/F15, negative Vorträge, Überbudgetierungsablehnung und Folge-Neuberechnung bestanden; keine doppelte Kontoführung; rein clientseitige Berechnungen.
- Prüfungen: Fach-/Budgetregressionen, Berichtssummen, Adapterprojektionen, UI-Monatswechsel/Undo/Prognose und Leistung mit dokumentiertem Gerät/Build.
