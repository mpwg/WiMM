# Dokumentationsindex

## Status und Auftrag

D0 ist die reine Spezifikations- und Dokumentationsübergabe. Es existiert noch keine Anwendung. P1 bis P11 sind geplant und benötigen einen späteren Implementierungsauftrag. Datenschemata und JSON-Beispiele sind Verträge für zukünftigen Code, keine bereits vorhandenen APIs.

## Lesereihenfolge

| Schritt | Dokument | Zweck |
|---|---|---|
| 1 | [Arbeitsregeln](../AGENTS.md), [Produkt](product.md) | Auftrag, Zielgruppe, Funktionen, Rollen und Abläufe |
| 2 | [Fachmodell](domain.md) | Begriffe, Geldregeln, Budget und Ausgleich |
| 3 | [Datenmodell](data-model.md) | Entitäten, Beziehungen, Aggregate und Indizes |
| 4 | [Architektur](architecture.md), [Entscheidungen](decisions.md) | Komponenten, Grenzen und verbindliche Defaults |
| 5 | [Synchronisierung](synchronization.md), [API](api.md) | Operationen, Revisionen, Identitäten und Fehler |
| 6 | [Dateiformate](formats.md) | Import, Dubletten und vollständiger Export |
| 7 | [Oberfläche](ui.md), [Sicherheit](security.md) | Plattformbedienung, private Daten und Sitzungen |
| 8 | [Betrieb](operations.md), [Tests](testing.md) | Installation, Sicherung, Migration und Abnahme |
| 9 | [Aufgaben](tasks.md) | Geordnete Arbeitspakete mit Ergebnis und Nachweisen |

## Verbindlichkeit und Fortschritt

Das Konzept wurde mit dem Nutzer abgestimmt. Offene Implementierungsdetails werden in diesem Paket durch explizite Defaults festgelegt. Versionen konkreter Bibliotheken werden erst in P1 aus stabilen kompatiblen Releases gewählt und in Lockfiles festgeschrieben.

Produktanforderungen stehen in `product.md`, Fachinvarianten in `domain.md`, Typen in `data-model.md`, Transport in `api.md` und `synchronization.md`. `decisions.md` begründet diese Festlegungen. Bei einem echten Widerspruch sind betroffene Dokumente vor Codeänderungen gemeinsam zu korrigieren; nicht stillschweigend den bequemeren Text auswählen.

## Bewusst spätere Funktionen

Bankabruf, Ende-zu-Ende-Verschlüsselung, Kinderrollen, Mehrwährung, Wertpapierkurse, Beleg-OCR, Steuerfunktionen, kommerzielles Hosting und iOS-/Android-Store-Apps gehören nicht zur ersten Veröffentlichung. Englische Übersetzungen sind nicht Voraussetzung; Übersetzbarkeit wird technisch vorbereitet.
