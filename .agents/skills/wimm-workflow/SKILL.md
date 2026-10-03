---
name: wimm-workflow
description: "Bearbeite WhereIsMyMoney-Arbeitspakete oder Dokumentationsänderungen mit konsistenter Agentenübergabe, Prüfbelegen und GitHub-PR-Format. Nutze diesen Skill für Paketabschluss und Zusammenarbeit im Projekt."
license: AGPL-3.0-or-later
---

# WhereIsMyMoney-Arbeitsablauf

Lies [AGENTS.md](../../../AGENTS.md), [Agentenleitfaden](../../../docs/agent-guide.md) und den aktuellen [Paketstatus](../../../docs/tasks.md). Regeln und Spezifikation stehen dort; dupliziere sie nicht in einem zweiten Plan.

1. Prüfe den tatsächlichen Auftrag und vorhandene Änderungen. Dokumentation/Skills/Editorvorlagen sind derzeit freigegeben; P1–P11 benötigen einen späteren ausdrücklichen Implementierungsauftrag.
2. Wähle das erste freigegebene offene Paket mit erfüllten Voraussetzungen. Lies nur die für den Auftrag nötigen Fachreferenzen.
3. Nutze die [Aufgabenvorlage](../../../docs/templates/task.md) für neue Teilaufgaben; bestehende Paketfelder beibehalten. Architekturänderungen mit [ADR-Vorlage](../../../docs/templates/decision.md) und betroffenen Verträgen gleichzeitig festhalten.
4. Skaliere Prüfungen nach Risiko; dokumentiere ausgeführte und nicht verfügbare Prüfungen getrennt. Keine fingierten Test-/Auditbelege oder bloß aus einer Checkliste behauptete Freigaben.
5. Erstelle nach abgeschlossenen Abschnitten nur bei bestehender ausdrücklicher Autorisierung Zwischencommits mit zusammengehörigen Dateien. Niemals fremde Änderungen einbeziehen oder eigenständig pushen/mergen.
6. Halte Paketstatus aktuell und übergib den nächsten konkreten Schritt mit [Übergabevorlage](../../../docs/templates/handoff.md). Für PRs die vorhandene GitHub-Vorlage verwenden.

Versionskontrolle ist die Quelle; GitHub-Issues verlinken auf Paket/ADR, ersetzen aber nicht die Fachspezifikation. Ein Issue oder dieses Skill verleiht keine zusätzlichen Veröffentlichungsrechte.
