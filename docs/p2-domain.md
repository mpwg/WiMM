# P2 — Teilaufgaben des Fachkerns

## Auftrag und Reihenfolge

Diese Teilaufgaben konkretisieren [P2](tasks.md#p2--fachkern) nach der [P1-Vorlage](p1-foundation.md). Der Nutzerauftrag vom 3. Oktober 2026 erlaubt P2.1; die weiteren Teilaufgaben benötigen jeweils eine ausdrückliche Implementierungsfreigabe. P2.1 bis P2.6 werden in Reihenfolge nach abgeschlossenem P1 bearbeitet. Die Fachquellen bleiben verbindlich; dieser Plan führt keine neuen Produktregeln ein.

Nach jedem abgeschlossenen Abschnitt Status und konkrete Prüfbelege hier sowie den Gesamtstatus in [tasks.md](tasks.md) pflegen, einen zusammengehörigen Zwischencommit erstellen und mit der [Übergabevorlage](templates/handoff.md) den nächsten Schritt nennen. P2 ist erst nach allen Teilabnahmen und der Gesamt-Abnahme erledigt; danach folgt [P3](p3-storage.md). Für die Umsetzung den Skill wimm-finance verwenden.

## P2.1 — Exakte Geld- und Kalenderprimitive

- Status: erledigt (3. Oktober 2026).
- Freigabe: Nutzerauftrag vom 3. Oktober 2026 („mach mit P2.1 weiter“).
- Voraussetzungen: P1 erledigt; Fachmodell und vorhandene Primitive aus contracts gelesen.
- Schritte: Dezimaltexte ohne Gleitkommaberechnung in Cent umwandeln; geprüfte Summen und Zwischenwerte bereitstellen; echte Kalenderdaten und Monatsschlüssel validieren; UUID-/Revisionsprimitive wiederverwenden.
- Ergebnis: plattformfreie, exportierte Parser für Dezimalgeld, Finanzdaten und Monatsschlüssel sowie überlaufsichere Summen- und gewichtete Rechenhilfen. Die Parser verwenden weder Gleitkommarechnung noch Zeitzonen.
- Verträge: [Geld und Datum](domain.md), [gemeinsame Typen](data-model.md), [Fachtests](testing.md).
- Abnahme: Vorzeichen und höchstens zwei Nachkommastellen korrekt; unsichere Zahlen, Zwischenwertüberlauf und ungültige Kalenderdaten abgewiesen; Finanzdatum unabhängig von Zeitzone.
- Prüfungen: Vitest mit Grenzwerten, Schaltjahren und ungültigen Texten; Eigenschaften für sichere Summen.
- Prüfbelege: `packages/domain/src/primitives.test.ts` enthält 26 Vitest-Fälle für Vorzeichen, eine und zwei Nachkommastellen, ungültige Texte, sichere Grenzen, unsichere Eingaben, Summen- und Multiplikationsüberlauf, gewichtete Ganzzahldivision, Schaltjahre, ungültige Kalenderdaten und zeitunabhängige Monatsschlüssel. Die vier Vitest-Suiten mit 39 Tests bestanden; TypeScript, Paketgraph sowie positive und negative Dokumentationsprüfung bestanden ebenfalls. Die anfängliche Prüfung lief wegen einer damals abweichenden lokalen Laufzeit direkt mit Node 24.19.0. Nach Aktualisierung der Toolchain bestanden am 3. Oktober 2026 auch `pnpm install --frozen-lockfile` und die vollständige lokale Serie `pnpm check:ci` mit Node 26.10.0 und pnpm 12.8.1.

## P2.2 — Fachaggregate und atomare Befehlsverträge

- Status: erledigt (3. Oktober 2026).
- Freigabe: Nutzerauftrag vom 3. Oktober 2026 („mach weiter mit P2.2“).
- Voraussetzungen: P2.1 erledigt.
- Schritte: P2-Aggregate und vollständige Befehlseingaben typisieren/validieren; Bereichsreferenzen, erwartete Revisionen und Änderungssets definieren; Zeit-/ID-Erzeugung injizieren; Fachschemas von öffentlichen Transporthüllen trennen.
- Ergebnis: pure Befehlsschnittstelle für vollständige P2-Aggregate und mehrere gemeinsam betroffene Revisionen. Die Schnittstelle erhält IDs und Zeitpunkte injiziert und erzeugt eine unveränderliche Änderungsmenge erst nach vollständiger Validierung.
- Verträge: [Datenmodell](data-model.md), [clientinterne Fachbefehle](api.md#fachbefehle), [Paketgrenzen](architecture.md).
- Abnahme: fehlende/veraltete Revisionen und fremde Referenzen ergeben kein Teiländerungsset; contracts importiert nicht domain; Server erhält keine Fachhandler.
- Prüfungen: gültige/ungültige Befehle, Mehraggregatrevisionen, Determinismus und Paketgraphprüfung.
- Prüfbelege: `packages/domain/src/commands.test.ts` prüft gültige deterministische Mehraggregatbefehle sowie fehlende, veraltete und überlaufende Revisionen, bereichsfremde Referenzen, doppelte Referenzen, unvollständige Aggregate, fehlende Teiländerungssets und fehlerhafte ID-/Zeitgeneratoren. Die Prüfung umfasst auch eine veraltete reine Leseabhängigkeit. Mit Node 26.10.0 und pnpm 12.8.1 bestanden die 34 Domänentests, TypeScript, Paketgraph und die vollständige Serie `pnpm check:ci` einschließlich Dokumentations-/Vertrag-/Crypto-/Servertests sowie Web- und Desktop-Build.

## P2.3 — Konten, Kategorien und Empfänger

- Status: offen.
- Freigabe: Implementierungsauftrag für P2 erforderlich.
- Voraussetzungen: P2.2 erledigt.
- Schritte: Konto-/Kategoriegruppen-/Kategorie-/Empfängerbefehle umsetzen; Systemkategorie unzugeordnet anlegen; Referenzarchivierung und Empfängerzusammenführung als vollständiges Änderungsset behandeln.
- Ergebnis: konsistente Stammdaten ohne gespeicherte mutable Kontosalden.
- Verträge: [Stammdaten](data-model.md), [Konten und Löschung](domain.md), account/category/payee-Befehle in [API](api.md).
- Abnahme: Kreditkonten bleiben off-budget; Systemkategorie nicht löschbar; referenzierte Daten archiviert; Merge prüft und ändert alle betroffenen Referenzen atomar.
- Prüfungen: Kontenarten, archivierte/fremde Referenzen, Systemschutz und Merge mit veralteter Buchungsrevision.
- Prüfbelege: noch keine.

## P2.4 — Buchungen, Splits und Anfangsbestand

- Status: offen.
- Freigabe: Implementierungsauftrag für P2 erforderlich.
- Voraussetzungen: P2.3 erledigt.
- Schritte: transaction.save/delete einschließlich vollständiger Splits und Anfangsbestand umsetzen; Erstattungszeichen und unzugeordnete Kategorie beachten; Tombstones sowie Sperre abgeglichener Buchungen prüfen.
- Ergebnis: vollständig validierte Buchungsänderungssets ohne Speicherzugriff.
- Verträge: [Buchungsregeln](domain.md), Transaction in [Datenmodell](data-model.md), F01/F02 in [Tests](testing.md).
- Abnahme: Splitsumme exakt gleich Betrag; Opening kein Einkommen; negative Guthaben zulässig; abgeglichene Buchung ohne Entsperrung unveränderbar; Fehler verändern kein Aggregat.
- Prüfungen: F01/F02, positive Ausgabenerstattung, Splitüberlauf, Löschung und Reconciled-Lock.
- Prüfbelege: noch keine.

## P2.5 — Umbuchungen und Kontenabgleich

- Status: offen.
- Freigabe: Implementierungsauftrag für P2 erforderlich.
- Voraussetzungen: P2.4 erledigt.
- Schritte: transfer.save/delete samt Gegenbuchungen und Abgleich confirm/unlock umsetzen; alle beteiligten Revisionen prüfen; Budgetgrenzübertritt mit erforderlicher Kategorie kennzeichnen; Differenzen ohne automatische Korrekturbuchung liefern.
- Ergebnis: atomare Transfer- und Abgleichsänderungssets.
- Verträge: [Transfer und Abgleich](domain.md), Transfer/Reconciliation in [Datenmodell](data-model.md), F03 in [Tests](testing.md).
- Abnahme: verschiedene Konten, Gegenbeträge und gemeinsames Datum; keine unabhängig änderbaren Transferseiten; Abgleichdifferenz sichtbar; Entsperrung aller betroffenen Buchungen atomar.
- Prüfungen: F03, Transfererhaltung, Budgetgrenzübertritt, fehlende Revisionen, unpassender Auszugssaldo und Entsperrung.
- Prüfbelege: noch keine.

## P2.6 — Projektionen und Gesamt-Abnahme

- Status: offen.
- Freigabe: Implementierungsauftrag für P2 erforderlich.
- Voraussetzungen: P2.5 erledigt.
- Schritte: Kontosalden und Einnahmen-/Ausgabenprojektionen aus Aggregaten ableiten; Vorzeichen/Opening/Transfer korrekt behandeln; P2-Fachsuite in Projektprüfungen aufnehmen und Paketabschluss dokumentieren.
- Ergebnis: reproduzierbarer Fachkern als Basis für Speicher und UI.
- Verträge: [Fachinvarianten](domain.md), [P2](tasks.md#p2--fachkern), [Teststrategie](testing.md).
- Abnahme: F01–F03 sowie Geld-/Datum-/Abgleichfehlfälle bestanden; Neuaufbau gleich inkrementellem Ergebnis; Summen sicher; keine UI-/HTTP-/Speicherabhängigkeit und keine Teiländerungssets.
- Prüfungen: vollständige P2-Fachsuite, Summen-/Transfer-/Überlaufeigenschaften, Vertrags-/Typ-/Paketgraph- und Dokumentationsprüfung.
- Prüfbelege: noch keine.
