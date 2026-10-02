# GitHub und VS Code

## Stand

Dieses Repository enthält Spezifikation, Agentenhilfen und Editor-/GitHubvorlagen. Es enthält noch keine installierbare App, Entwicklungsserver, pnpm-Workspace oder CI-Workflows. Die Befehle `dev:web`, `dev:server`, `dev:desktop`, `test` und `build` werden erst in P1 angelegt. Nicht so tun, als ließen sie sich bereits ausführen.

## VS-Code-Arbeitsbereich

Projektordner in VS Code öffnen. Die versionierten `.vscode/settings.json`-Einstellungen verwenden UTF-8, LF, zwei Leerzeichen und Markdown-Softwrap; Rust später vier Leerzeichen. `.editorconfig` hält dieselben Formatregeln für andere Editoren fest. Autoformat beim Speichern bleibt zunächst aus, damit bestehende Absätze nicht ungefragt umgeschrieben werden; explizite Formatierung wird später über die Projekttoolchain vereinheitlicht.

[Erweiterungsempfehlungen](../.vscode/extensions.json): EditorConfig, markdownlint, YAML und GitHub Pull Requests. Sie sind Empfehlungen im Workspace und nicht heimlich global installiert. Die ersten drei unterstützen direkt die aktuelle Dokumentation; GitHubintegration wird mit dem echten Repositorykonto nutzbar. TypeScript/JSON/Markdown-Unterstützung liefert VS Code selbst. Rust-analyzer, ESLint, Formatter und Playwrightintegration erst passend zu P1/P4 konfigurieren.

Keine VS-Code-Task/Debugkonfiguration mit nicht existierenden Appbefehlen. Keine globale Änderung von Benutzerprefs, Authkonten oder Workspace-Trust. [Workspace-Einstellungen](https://code.visualstudio.com/docs/configure/settings), [Erweiterungsempfehlungen](https://code.visualstudio.com/docs/configure/extensions/extension-marketplace).

## Agenten im Editor

Die [Agentenregeln](../AGENTS.md) gelten für Codex und andere beteiligte Agenten. Repository-Skills liegen in `.agents/skills`, Copilot liest zusätzlich den knappen Verweis in `.github/copilot-instructions.md`. [Agentenleitfaden](agent-guide.md) beschreibt Auswahl und Formate. Falls eine Umgebung Discovery nicht unterstützt, die passende SKILL.md ausdrücklich mitgeben; kein weiterer globaler Installationsschritt ist nötig.

## GitHubvorlagen

Bereits angelegt: [PR-Vorlage](../.github/pull_request_template.md), [Aufgabenformular](../.github/ISSUE_TEMPLATE/task.yml) und [Fehlerformular](../.github/ISSUE_TEMPLATE/bug.yml). Keine Labels/Assignees/Owners voraussetzen, die erst auf GitHub existieren müssten. Die Formulare nutzen deutsche Inhalte und dieselben Paket-/Vertrags-/Prüfbelegfelder wie die lokale Dokumentation.

GitHub-Remote ist derzeit nicht konfiguriert. Kein Repository erstellen, pushen oder veröffentlichen, nur weil hier sein Hosting beschrieben ist. Nach tatsächlicher Einrichtung Owner/URL, Branchschutz und private Sicherheitsmeldungen dokumentieren. CI ab P1; Checks erst als verpflichtend konfigurieren, wenn sie existieren und funktionieren. [GitHub-Templates](https://docs.github.com/en/communities/using-templates-to-encourage-useful-issues-and-pull-requests/about-issue-and-pull-request-templates).

## Späterer Start

Nach ausdrücklicher Implementierungsfreigabe mit P1 beginnen. Stabile Bibliotheks-/SDKversionen aus offiziellen Quellen prüfen, Lockfiles anlegen und konkrete Installations-/Startbefehle hier ergänzen. Finanzen bleiben clientseitig; Backend transportiert Chiffrate. E2EE benötigt keine Appattestierung. Deploymentsecrets, Bankdateien, Rettungscodes und persönliche Beispiele niemals einchecken.
