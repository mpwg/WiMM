# Einstieg für Mitwirkende und Agenten

## In zehn Minuten orientieren

WhereIsMyMoney besitzt die abgeschlossene Projektgrundlage P1 mit Workspace, Verträgen, Crypto-Binding, minimalen Apphüllen und lokalen/CI-Prüfwerkzeugen. Finanzfunktionen sind noch nicht implementiert. D5 ergänzt [62 offene Teilaufgaben für P2–P11](tasks.md#teilaufgaben-und-bearbeitungsfolge). Der aktuelle Auftrag erlaubt ihre Planung; die Implementierung von P2–P11 benötigt weiterhin einen ausdrücklichen Auftrag. Diese Anleitung erteilt ihn nicht.

1. [Arbeitsregeln](../AGENTS.md) und [Dokumentationsindex](README.md) lesen, danach die dort vorgeschriebenen Grundlagen: Fachmodell, Architektur, Entscheidungen und Aufgaben.
2. Den tatsächlichen Nutzerauftrag mit dem [Paketstatus](tasks.md) abgleichen. Vorhandene Änderungen prüfen und bewahren; keinen Branch ungefragt wechseln.
3. Über die [Lesematrix](agent-guide.md#lesematrix-nach-aufgabe) die aufgabenspezifischen Abschnitte und den passenden Projektskill wählen.
4. Das konkrete Ergebnis, betroffene Verträge und Abnahmekriterien benennen. Nach Implementierungsfreigabe für P2 ist [P2.1](p2-domain.md#p21--exakte-geld--und-kalenderprimitive) der erste Schritt; die weiteren Pakete besitzen eigene verlinkte Teilpläne in der Aufgabenübersicht.
5. Erst den begrenzten Arbeitsschritt bearbeiten, dann passende Prüfungen ausführen und die Nachweise im Paket festhalten. Nicht ausgeführte Prüfungen ausdrücklich nennen.

Für den Zusammenhang der Komponenten anschließend das [durchgängige Buchungsbeispiel](reference-household.md#durchgängiger-ablauf-einer-buchung) lesen. Für die vollständige Lesereihenfolge bleibt der Dokumentationsindex maßgeblich.

## Quellen und typische Stolperfallen

| Frage | Verbindliche Quelle |
| --- | --- |
| Was soll das Produkt leisten? | [Produkt](product.md) |
| Wie werden Geld, Budget und Ausgleich berechnet? | [Fachmodell](domain.md) und [Testreferenzen](testing.md) |
| Welche Daten und Grenzen gibt es? | [Datenmodell](data-model.md), [Architektur](architecture.md) |
| Was verlässt den Client? | [Verschlüsselung](encryption.md), [Synchronisierung](synchronization.md), [API](api.md) |
| Was ist entschieden und freigegeben? | [Entscheidungen](decisions.md), [Aufgaben](tasks.md), tatsächlicher Nutzerauftrag |

Finanzbefehle in der API-Dokumentation sind clientinterne Verträge, keine Klartext-HTTP-Endpunkte. Serverbestätigung ersetzt keine fachliche Prüfung durch Clients. Lokaler Speichererfolg und bestätigte Synchronisierung sind getrennte Zustände. Geteilte Ausgaben sind keine zusätzliche Kontobelastung; private Veröffentlichungen benötigen eine bestätigte Kopie. Geplante Befehle, Tests und Hooks sind erst verfügbar, wenn das betreffende Paket sie tatsächlich angelegt und geprüft hat.

## Entscheidung oder Rückfrage?

| Situation | Vorgehen |
| --- | --- |
| Lizenz, Plattformen, E2EE, Budgetmethoden oder Rollen bereits entschieden | Festlegungen aus den ADRs anwenden, keine erneute Grundsatzentscheidung verlangen |
| Versionskombination, Binding oder SDK-Verfügbarkeit noch zu ermitteln | Im zuständigen Paket offizielle Quellen prüfen und Ergebnis mit Datum, Herkunft und Prüfnachweis festhalten |
| Routineentscheidung innerhalb bestehender Verträge | Selbstständig lösen und relevante Begründung dokumentieren |
| Widerspruch zwischen verbindlichen Quellen | Widerspruch benennen und betroffene Quellen vor abhängiger Implementierung gemeinsam korrigieren; bei unklarer Produktabsicht rückfragen |
| Änderung von Produktumfang, Fachregeln oder Vertrauensmodell | Konkrete Änderung und Folgen vorlegen, Nutzerentscheidung einholen und ADR sowie Verträge gemeinsam aktualisieren |
| Fehlende Plattform oder Signierungsgeheimnisse | Tatsächlich mögliche Arbeit fortsetzen; nur betroffene Prüfung/Distribution als ausstehend ausweisen |
| Zwischencommit | Nach jedem abgeschlossenen Abschnitt mit zusammengehörigen Änderungen erstellen; keine fremden Dateien einschließen |
| Push oder Veröffentlichung | Bestehende ausdrückliche Autorisierung prüfen; ein Paketabschluss allein erteilt keine Freigabe |

## Abschluss und Übergabe

Ein Arbeitsschritt ist abgeschlossen, wenn sein Ergebnis überprüfbar vorliegt, relevante Verträge konsistent sind und die Abnahme nachgewiesen ist. In [tasks.md](tasks.md) Ergebnis, ausgeführte Prüfungen, Plattform und Einschränkungen eintragen. Für die Übergabe die [vorhandene Vorlage](templates/handoff.md) verwenden und den nächsten konkreten freigegebenen Schritt nennen. Nach jedem abgeschlossenen Abschnitt einen Zwischencommit mit zusammengehörigen Änderungen erstellen und niemals fremde Änderungen einschließen. Pushes und Veröffentlichungen benötigen weiterhin eine ausdrückliche Autorisierung.
