# Dokumentationsindex

## Status und Auftrag

D0 ist die Spezifikationsübergabe, D1 ergänzt verpflichtende E2EE und Agenten-/GitHub-/Editorhilfen. D2 ergänzt Einstieg, Referenzhaushalt und P1-Teilaufgaben einschließlich Hook-Konzept. D3 legt externe Serveridentität und eigenständige Apps fest. D4 führt die Arbeitsregeln ohne VS-Code-DevContainer in der aktiven Arbeitskopie fort. D5 ergänzt schrittweise Teilaufgaben für P2–P11. P1 bis P3 sind abgeschlossen; P4 bis P11 bleiben offen. Der Lokalbetrieb benötigt keine Benutzerverwaltung; Serveranmeldung ist extern. Finanzschemas und JSON-Beispiele sind Verträge für zukünftigen Code, keine bereits vorhandenen Finanz-APIs.

Für den ersten Überblick: [Einstieg](getting-started.md). Für die schrittweise Umsetzung: [Teilaufgabenübersicht P1–P11](tasks.md#teilaufgaben-und-bearbeitungsfolge), als nächster Schritt nach Freigabe [P4.2.6](p4-ui.md#p426--layout-und-farbschema-stabilisieren). Die abgeschlossenen [P1-Teilaufgaben](p1-foundation.md), [P2-Teilaufgaben](p2-domain.md), [P3-Teilaufgaben](p3-storage.md), [P4.1](p4-ui.md#p41--composition-root-und-lokaler-einstieg), [P4.2.1](p4-ui.md#p421--navigation-und-bereichstrennung-prüfen), [P4.2.2](p4-ui.md#p422--übersicht-und-kontostart-prüfen), [P4.2.3](p4-ui.md#p423--kontoarchivierung-mit-referenzen-abnehmen), [P4.2.4](p4-ui.md#p424--kategoriearchivierung-mit-referenzen-abnehmen) und [P4.2.5](p4-ui.md#p425--empfänger-merge-mit-buchungsreferenz-abnehmen) dokumentieren die Grundlage. Der [Referenzhaushalt](reference-household.md) verbindet Fachbeispiele mit dem Buchungs-/Syncablauf; er ist kein importierbarer Snapshot.

## Lesereihenfolge

| Schritt | Dokument | Zweck |
| --- | --- | --- |
| 1 | [Arbeitsregeln](../AGENTS.md), [Produkt](product.md) | Auftrag, Zielgruppe, Funktionen, Rollen und Abläufe |
| 2 | [Fachmodell](domain.md) | Begriffe, Geldregeln, Budget und Ausgleich |
| 3 | [Datenmodell](data-model.md) | Entitäten, Beziehungen, Aggregate und Indizes |
| 4 | [Architektur](architecture.md), [Entscheidungen](decisions.md) | Komponenten, Grenzen und verbindliche Defaults |
| 5 | [Synchronisierung](synchronization.md), [API](api.md) | Operationen, Revisionen, Identitäten und Fehler |
| 5a | [Ende-zu-Ende-Verschlüsselung](encryption.md), [Krypto-Testvektoren](crypto-test-vectors.md) | Pflichtschutz, Geräte-/Familienschlüssel, Rotation, Recovery und feste Binding-Vektoren |
| 6 | [Dateiformate](formats.md) | Import, Dubletten und vollständiger Export |
| 7 | [Oberfläche](ui.md), [Sicherheit](security.md) | Plattformbedienung, private Daten und Sitzungen |
| 8 | [Betrieb](operations.md), [Tests](testing.md) | Installation, Sicherung, Migration und Abnahme |
| 9 | [Aufgaben](tasks.md) | Geordnete Arbeitspakete mit Ergebnis und Nachweisen |
| 10 | [Agentenleitfaden](agent-guide.md), [Entwicklung](development.md) | Projektskills, GitHub, VS Code und einheitliche Vorlagen |

## Verbindlichkeit und Fortschritt

Das Konzept wurde mit dem Nutzer abgestimmt. Offene Implementierungsdetails werden in diesem Paket durch explizite Defaults festgelegt. Versionen konkreter Bibliotheken werden erst in P1 aus stabilen kompatiblen Releases gewählt und in Lockfiles festgeschrieben.

Produktanforderungen stehen in `product.md`, Fachinvarianten in `domain.md`, Typen in `data-model.md`, Transport in `api.md` und `synchronization.md`. `decisions.md` begründet diese Festlegungen. Bei Widersprüchen zwischen verbindlichen Quellen den Widerspruch benennen und betroffene Quellen vor abhängiger Implementierung gemeinsam korrigieren; bei unklarer Produktabsicht rückfragen.

## Bewusst spätere Funktionen

Bankabruf, Kinderrollen, Mehrwährung, Wertpapierkurse, Beleg-OCR, Steuerfunktionen, kommerzielles Hosting und iOS-/Android-Store-Apps gehören nicht zur ersten Veröffentlichung. Ende-zu-Ende-Verschlüsselung ist dagegen verpflichtend ab v1. Englische Übersetzungen sind nicht Voraussetzung; Übersetzbarkeit wird technisch vorbereitet.
