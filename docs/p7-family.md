# P7 — Spezifikation für lokale Familienfinanzen

## Ziel und Verantwortung

Diese funktionale Spezifikation bleibt verbindlich; aktueller Auftrag/Freigabe ausschließlich in [Aufgaben](tasks.md), Fortschritt und Blockaden in GitHub. Die gemeinsame Rust-Architektur ist Ziel, keine behauptete Implementierung. Fachregeln im Rust-Kern, Clientabläufe in Rust-Anwendung, Serverabläufe im öffentlichen Rust-Server; Plattformen bleiben Adapter. Neue Produktfeatures dieses Pakets benötigen weiterhin ihren gesonderten Auftrag. [Architektur](architecture.md), [Prüfstrategie](testing.md).

## P7.1 — Haushalte, Teilnehmer und Verteilungspolicies

- Voraussetzungen: P6 erledigt.
- Schritte: lokale Haushaltsanlage mit genau einem gemeinsamen Bereich/technischen Teilnehmer ermöglichen; Teilnehmer-/Policybefehle, Archivierung und explizit erklärte Einkommen/Gewichte umsetzen; Verwaltung anbinden.
- Ergebnis: lokale Familiengrundlage ohne Anmeldung oder Ableitung privater Einkommensdaten.
- Verträge: [Familienkosten und Verteilung](domain.md), [Datenmodell](data-model.md), [Produktrollen](product.md).
- Abnahme: technischer Haushalt nicht entfernbar; Archivierte nicht für neue Verteilungen vorausgewählt; Einkommen freiwillig und ausdrücklich angegeben; Policyhistorie erhalten.
- Prüfungen: Haushalts-/Teilnehmerreferenzen, Archive, positive/Nullbasis, Policygültigkeit und keine privaten Datenquellen.

## P7.2 — Geteilte Ausgaben und eingefrorene Restcentanteile

- Voraussetzungen: P7.1 erledigt.
- Schritte: equal/weights/income im Fachkern berechnen; SharedExpense mit household_transaction/private_advance, Policy-Snapshot und Anteilen umsetzen; Referenz und Mehrfachzuweisung von Buchungssplits prüfen.
- Ergebnis: deterministische Verteilung mit Finanzierer-/Kostenposten ohne zweite Kontobelastung.
- Verträge: [Verteilung und Historie](domain.md), SharedExpense in [Datenmodell](data-model.md), F07–F09 in [Tests](testing.md).
- Abnahme: Anteile exakt gleich Betrag; Restcent nach Rest und UUID; Nullbasis abgewiesen; spätere Policies ändern alte Ausgaben nicht; kein Split doppelt verteilt.
- Prüfungen: F07–F09, gewichtete BigInt-Zwischenwerte, Permutations-/Summeneigenschaften und gemeinsame Quellreferenzen.

## P7.3 — Beiträge, Ausgleich und Guthaben

- Voraussetzungen: P7.2 erledigt.
- Schritte: contribution-/settlement-Befehle einschließlich gemeinsamer Kontobuchungen/Zuordnungen atomar umsetzen; Teilnehmerguthaben und deterministische Zahlungsvorschläge projizieren; Teilzahlungen und Haushaltszahlungswege berücksichtigen.
- Ergebnis: tatsächliche Zahlungen und reproduzierbarer Ausgleich getrennt von unverbindlichen Vorschlägen.
- Verträge: [Familienausgleich](domain.md), Contribution/Settlement in [Datenmodell](data-model.md), F10/F12 in [Tests](testing.md).
- Abnahme: Summe aller Guthaben einschließlich H null; Vorschlag bucht nichts; Beitrag kein Konsumeinkommen und keine automatische Reserve; Kontobuchung und Ausgleich gemeinsam.
- Prüfungen: F10/F12, Teilbeträge, payer=recipient, überhöhte Anwendungen und Fehler zwischen Zahlung/Kindbuchung.

## P7.4 — Vorleistungsreserve und Eigenanteilsverrechnung

- Voraussetzungen: P7.3 erledigt.
- Schritte: household-/participants-Erstattungswege, verbleibende Reserve und advanceOffset umsetzen; P6-Budgetprojektionen um private Finanzierung erweitern; explizite Zuordnung direkter Personenzahlungen zu Vorleistungen prüfen.
- Ergebnis: Budgetreserve unabhängig vom Beitragssaldo und ohne fiktiven Kontogeldabgang.
- Verträge: [Vorleistungen und Budgetreserve](domain.md#vorleistungen-und-budgetreserve), [Budget](domain.md#umschlagbudget), F11/F16 in [Tests](testing.md).
- Abnahme: household mindert Reserve/Equity und Kategorie einmal; Erstattung mindert Konto/Reserve ohne erneuten Verbrauch; participants kein gemeinsamer Umschlagverbrauch; Offset auf ursprünglichen Eigenanteil begrenzt.
- Prüfungen: F11/F16, direkte/teilweise Erstattung, überhöhte Offsets/Anwendungen und sichere Budget-/Reservesummen.

## P7.5 — Kumulative Rückerstattungen und historische Korrekturen

- Voraussetzungen: P7.4 erledigt.
- Schritte: expenseRefund.save/delete aus kumulativen Originalanteilen berechnen; tatsächlichen Empfänger und gemeinsame Erstattungsbuchung berücksichtigen; Ausgabenkorrektur/Löschung mit Zahlungszuordnungen prüfen.
- Ergebnis: genaue Teilrückerstattungen und nachvollziehbare Korrektur bereits ausgeglichener Kosten.
- Verträge: [Rückerstattungen](domain.md#rückerstattungen), [Verteilungshistorie](domain.md), F13 in [Tests](testing.md).
- Abnahme: Refundsumme höchstens Original; volle Rückerstattung hebt Originalanteile exakt auf; erledigte Zahlungen bleiben historisch; Kürzung/Löschung mit ungültigen offenen Zuordnungen gesperrt.
- Prüfungen: F13, viele Teilrefunds/Restcent, privater/gemeinsamer Empfang, Refund nach Ausgleich und korrigierte Zahlungszuordnungen.

## P7.6 — Bestätigte Veröffentlichung und Privatheitsgrenzen

- Voraussetzungen: P7.5 erledigt.
- Schritte: gemeinsame Kopie und privaten PublicationLink lokal atomar anlegen; Vorschau erlaubter Felder, ausdrückliche Bestätigung und Digesthinweise implementieren; berechtigte zusammengeführte Berichte über lokalen Link deduplizieren.
- Ergebnis: bestätigte Veröffentlichung ohne private Quellen-IDs/Notizen/Summen im Haushalt.
- Verträge: [Private Verknüpfungen](data-model.md#nur-privatelokale-verknüpfungen), [Veröffentlichungsdialog](ui.md), [Referenzhaushalt](reference-household.md).
- Abnahme: private Notiz nicht vorausgefüllt; erst „Ausgabe teilen“ veröffentlicht; Privatänderung löst nur Hinweis aus; gemeinsame Snapshots enthalten keinen PublicationLink oder private Referenz; Kosten je Perspektive einmal.
- Prüfungen: R02/R03, erlaubte/verbotene Felder, atomarer lokaler Fehler und berechtigte/unberechtigte Berichtssichten; serverseitiger S13-Ablauf folgt in P9.

## P7.7 — Familienoberfläche und Gesamt-Abnahme

- Voraussetzungen: P7.6 erledigt.
- Schritte: Ausgleichs-/Reserveberichte, Anteilskorrektur, Beiträge/Zahlungen/Offsets/Refunds und Erstattungswegdialoge abschließen; Fach-/Adapter-/UI-Belege zusammenführen.
- Ergebnis: vollständiger lokaler Familienalltag auf beiden Clients.
- Verträge: [P7](tasks.md#p7--familienfinanzen-lokal), [UI](ui.md), F07–F13/F16 in [Tests](testing.md).
- Abnahme: alle P7-Referenzen bestanden; Guthabensumme null; Reserve unabhängig von Beitragssaldo; Verbrauch genau einmal; Privatheitsgrenzen und eingefrorene Policies erhalten.
- Prüfungen: vollständige Familienfachsuite, Restcent-/Refund-Eigenschaften, Adapterrollback, Haushaltsabläufe per Tastatur/Touch, Screenshots und Budget-/Berichtsregressionen.
