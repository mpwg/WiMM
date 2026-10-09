---
name: wimm-workflow
description: "Bearbeite WhereIsMyMoney-Arbeitspakete oder Dokumentationsänderungen mit konsistenter Agentenübergabe, Prüfbelegen und GitHub-PR-Format. Nutze diesen Skill für Paketabschluss und Zusammenarbeit im Projekt."
license: AGPL-3.0-or-later
---

# WhereIsMyMoney-Arbeitsablauf

Führe Dateisuche, Lesen, Bearbeiten, Git-Befehle, Builds, Tests, Linter, Typechecks und sonstige Prüfungen in der aktiven Arbeitskopie des Repositorys aus. Bearbeite keine andere lokale Kopie oder externe Arbeitsumgebung. Der frühere VS-Code-DevContainer wird nicht mehr verwendet. Die verbindliche Regel steht in [AGENTS.md](../../../AGENTS.md).

Lies [AGENTS.md](../../../AGENTS.md), [Agentenleitfaden](../../../docs/agent-guide.md) und den aktuellen [Paketstatus](../../../docs/tasks.md). Regeln und Spezifikation stehen dort; dupliziere sie nicht in einem zweiten Plan.

1. Prüfe den tatsächlichen Auftrag und vorhandene Änderungen. Aktuelle Freigaben ausschließlich aus `docs/tasks.md` und dem Nutzerauftrag ableiten.
2. Wähle das erste freigegebene offene Paket mit erfüllten Voraussetzungen. Lies nur die für den Auftrag nötigen Fachreferenzen.
3. Nutze die [Aufgabenvorlage](../../../docs/templates/task.md) für neue Teilaufgaben; bestehende Paketfelder beibehalten. Architekturänderungen mit [ADR-Vorlage](../../../docs/templates/decision.md) und betroffenen Verträgen gleichzeitig festhalten.
4. Skaliere Prüfungen nach Risiko; dokumentiere ausgeführte und nicht verfügbare Prüfungen getrennt. Keine fingierten Test-/Auditbelege oder bloß aus einer Checkliste behauptete Freigaben.
5. Erstelle nach jedem abgeschlossenen Abschnitt einen Zwischencommit mit zusammengehörigen eigenen Dateien gemäß der aktuellen Gitfreigabe in `AGENTS.md`. Niemals fremde Änderungen einbeziehen; einen bestehenden Branch nicht ungefragt wechseln.
6. Halte Paketstatus aktuell und übergib den nächsten konkreten Schritt mit [Übergabevorlage](../../../docs/templates/handoff.md). Für jeden Pull Request die vorhandene GitHub-Vorlage verwenden.

Versionskontrolle ist die Quelle; GitHub-Issues verlinken auf Paket/ADR, ersetzen aber nicht die Fachspezifikation. Ein Issue oder dieses Skill verleiht keine zusätzlichen Veröffentlichungsrechte.

## Architekturstand vom 9. Oktober 2026

Bestand und Ziel sind getrennt: [gemeinsame Rust-Architektur](../../../docs/architecture.md). Hier dokumentierte Funktionen und Arbeitsregeln beziehen sich auf den Bestand; neue Rust-Anwendungs-/DAL-/Serverumstellung ist noch nicht implementiert. Aktuelle Aufträge und Kriterien in tasks.md/GitHub; historische Belege ersetzen keine Zielabnahme.
