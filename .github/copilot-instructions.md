# WhereIsMyMoney: Repositoryregeln

Lies vor Arbeit die zentralen [Agentenregeln](../AGENTS.md) und den [Agentenleitfaden](../docs/agent-guide.md). Sie gelten auch in VS Code und GitHub Copilot; diese Datei enthält absichtlich keine zweite Regelkopie.

Arbeitsumgebung: Arbeite ausschließlich im aktiven VS-Code-DevContainer dieses Repositorys. Auch Builds, Tests, Linter, Typechecks und sonstige Prüfungen laufen ausschließlich dort. Einzelheiten und Vorgehen bei fehlendem Containerzugriff stehen in [AGENTS.md](../AGENTS.md).

Lade nach Aufgabe das passende SKILL.md unter `.agents/skills`: `wimm-workflow`, `wimm-finance`, `wimm-e2ee` oder `wimm-ui`. Wenn deine Umgebung Skills nicht automatisch entdeckt, öffne die passenden Dateien ausdrücklich. Dokumentation bleibt Fachquelle, nicht das Issue oder ein Copilotvorschlag.

Aktuell sind Dokumentation, Guides und Editor-/GitHubvorlagen freigegeben. Anwendungscode erst nach späterem ausdrücklichem Auftrag. Eigene Projektdateien AGPL-3.0-or-later, deutsche Texte mit Umlauten, verpflichtende E2EE ohne Codesignatur/Attestierung als Clientzugangsbedingung. Nach abgeschlossenen Abschnitten Zwischencommit mit zusammengehörigen Änderungen erstellen; kein automatisches Push/Merge.
