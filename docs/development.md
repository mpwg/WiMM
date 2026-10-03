# GitHub und VS Code

## Stand

Dieses Repository enthält die abgeschlossenen P1.1–P1.5: Workspace, öffentliche Verträge, Crypto-Binding sowie minimale Web-, Desktop- und Serverhüllen. Es gibt noch keine Finanzfunktion, Speicher- oder Sync-Implementierung und keine CI-Workflows. P1.6 ergänzt CI, Dokumentationsprüfungen und Hook-Aktivierung.

Die installierte lokale Toolchain muss Node 24.21.0, pnpm 12.8.1 sowie für die Desktop-Hülle Rust und Xcode enthalten. Der entwickelte macOS-arm64-Rechner verwendet Rust 1.99.0 aus Homebrew. Vor der ersten Installation `pnpm install --frozen-lockfile` ausführen. Verfügbare Befehle:

| Zweck | Befehl |
| --- | --- |
| Webhülle starten | `pnpm dev:web` |
| Serverhülle starten | `pnpm dev:server` |
| Tauri-Entwicklung starten | `pnpm dev:desktop` |
| Alle vorhandenen Pakete bauen | `pnpm build` |
| Typen und Paketgrenzen prüfen | `pnpm typecheck` / `pnpm check:package-graph` |
| Vertrags-, Crypto- und Servertests | `pnpm test` |

Der Server bindet für die lokale Entwicklung nur an `127.0.0.1:3000`. Er stellt ausschließlich `/api/v1/health/live`, `/api/v1/health/ready` und `/api/v1/meta` bereit. Finanz-HTTP-Endpunkte und `test:e2e` entstehen erst in späteren Paketen.

## VS-Code-Arbeitsbereich

Projektordner direkt in VS Code oder einem anderen Editor öffnen. Die benötigten Laufzeitversionen sind in der [Versions- und Lizenzbasis](technology-baseline.md) festgehalten; Einrichtung und Prüfungen erfolgen in der lokalen Entwicklungsumgebung. Keine Projektsecrets, Bankdateien, Rettungscodes oder persönlichen Beispiele einchecken.

Die versionierten `.vscode/settings.json`-Einstellungen verwenden UTF-8, LF, zwei Leerzeichen und Markdown-Softwrap; Rust verwendet vier Leerzeichen. `.editorconfig` hält dieselben Formatregeln für andere Editoren fest. Autoformat beim Speichern bleibt zunächst aus, damit bestehende Absätze nicht ungefragt umgeschrieben werden; explizite Formatierung wird später über die Projekttoolchain vereinheitlicht.

[Erweiterungsempfehlungen](../.vscode/extensions.json): EditorConfig, markdownlint, YAML, GitHub Pull Requests und Tauri. Sie sind Empfehlungen im Workspace und nicht heimlich global installiert. GitHubintegration wird mit dem echten Repositorykonto nutzbar. TypeScript/JSON/Markdown-Unterstützung liefert VS Code selbst. Rust-analyzer, ESLint und Formatter können passend zur lokalen Toolchain eingerichtet werden; Playwrightintegration folgt passend zu P4.

Keine VS-Code-Task/Debugkonfiguration mit nicht existierenden Appbefehlen. Keine globale Änderung von Benutzerprefs, Authkonten oder Workspace-Trust. [Workspace-Einstellungen](https://code.visualstudio.com/docs/configure/settings), [Erweiterungsempfehlungen](https://code.visualstudio.com/docs/configure/extensions/extension-marketplace).

## Agenten im Editor

Die [Agentenregeln](../AGENTS.md) gelten für Codex und andere beteiligte Agenten. Repository-Skills liegen in `.agents/skills`, Copilot liest zusätzlich den knappen Verweis in `.github/copilot-instructions.md`. [Agentenleitfaden](agent-guide.md) beschreibt Auswahl und Formate. Falls eine Umgebung Discovery nicht unterstützt, die passende SKILL.md ausdrücklich mitgeben; kein weiterer globaler Installationsschritt ist nötig.

## GitHubvorlagen

Bereits angelegt: [PR-Vorlage](../.github/pull_request_template.md), [Aufgabenformular](../.github/ISSUE_TEMPLATE/task.yml) und [Fehlerformular](../.github/ISSUE_TEMPLATE/bug.yml). Keine Labels/Assignees/Owners voraussetzen, die erst auf GitHub existieren müssten. Die Formulare nutzen deutsche Inhalte und dieselben Paket-/Vertrags-/Prüfbelegfelder wie die lokale Dokumentation.

Ein GitHub-Remote ist konfiguriert. Vor jedem Push muss die tatsächliche `git remote`-Konfiguration geprüft werden; diese Dokumentation autorisiert weder Push noch Veröffentlichung. Branchschutz und private Sicherheitsmeldungen werden erst nach einer autorisierten GitHub-Konfiguration dokumentiert. CI ab P1; Checks erst als verpflichtend konfigurieren, wenn sie existieren und funktionieren. [GitHub-Templates](https://docs.github.com/en/communities/using-templates-to-encourage-useful-issues-and-pull-requests/about-issue-and-pull-request-templates).

## Nächster Implementierungsschritt

P1.1 hat die stabilen Bibliotheks-/SDKversionen aus offiziellen Quellen geprüft; Details stehen in der [Versions- und Lizenzbasis](technology-baseline.md). P1.2 bis P1.5 legen darauf aufbauend Workspace, exakte Lockfiles, öffentliche Hüllen, Crypto-Binding und lokale Prüfungen an. Lokal `pnpm install --frozen-lockfile`, `pnpm test`, `pnpm typecheck`, `pnpm check:package-graph` und `pnpm build` verwenden. Finanzen bleiben clientseitig; Backend transportiert später Chiffrate. E2EE benötigt keine Appattestierung. Deploymentsecrets, Bankdateien, Rettungscodes und persönliche Beispiele niemals einchecken.

Die [P1-Teilaufgaben](p1-foundation.md) legen Reihenfolge und Abnahme fest. Für den ersten Einstieg den [Kurzleitfaden](getting-started.md) nutzen; [Referenzhaushalt](reference-household.md) und [Lesematrix](agent-guide.md#lesematrix-nach-aufgabe) helfen bei konkreten Aufgaben.

## Hooks und automatisierte Prüfungen ab P1

Dies ist ein Konzept für P1. Es gibt noch keinen projektspezifischen Hook, keine Aktivierungsroutine und keinen ausführbaren Dokumentationsprüfbefehl. In D2 werden weder Werkzeuge installiert noch Gitkonfigurationen geändert.

### Gemeinsame Prüfwerkzeuge

P1.6 legt einen dokumentierten Projektbefehl für Dokumentationsprüfungen an: Markdown-/Whitespace-/UTF-8-/LF-Prüfung, JSON-/YAML-Parsing mit etablierten Parsern und relative Links einschließlich lokaler Anker. Externe URLs werden nicht bei jedem Commit über das Netz geprüft. Platzhalter in Vorlagen werden als solche berücksichtigt. Dieselben Validatoren laufen lokal, im Hook und in CI; die zu prüfende Datenquelle ist explizit (Git-Index im Hook, Checkout in CI).

### Optionaler pre-commit-Hook

Der Hook prüft kurze Format-/JSON-/YAML-/Linkprüfungen für vorgemerkte Änderungen einschließlich Löschungen und Umbenennungen. Bei entfernten Zielen auch unveränderte Dokumente auf eingehende Verweise prüfen. Inhalte und Linkziele stammen aus dem Git-Index; eine teilweise vorgemerkte Datei darf nicht über die abweichende Arbeitskopie geprüft werden. Dateinamen mit Leerzeichen und Unicode sicher behandeln. Der Hook schreibt keine Dateien um und übernimmt keine Änderungen automatisch.

Aktivierung ist eine bewusste, checkoutlokale Entscheidung. P1.6 dokumentiert die echten Aktivierungs-/Deaktivierungsbefehle sowie den vorherigen hooksPath; eine vorhandene abweichende Konfiguration wird nicht automatisch ersetzt. Keine globalen Git-/Editoränderungen. Ohne Aktivierung bleiben die gemeinsamen Prüfungen manuell und in CI verfügbar. Lokale Hooks können umgangen werden und ersetzen weder Review noch CI. Fehlende Werkzeuge erzeugen eine verständliche Meldung mit dem dokumentierten Einrichtungsschritt, keine automatische Installation.

### CI und Umfang

| Zeitpunkt | Prüfung |
| --- | --- |
| Vor Commit, optional | Kurze Dokumentations-/Formatprüfungen auf den vorgemerkten Inhalten |
| Lokal vor Paketabschluss | Risikogerechte Prüfungen nach testing.md, einschließlich betroffener Fach-/Crypto-/Adapterfälle |
| CI ab P1 | Dokumentation, Paketgraph, Typprüfung, Build und vorhandene Vertragstests mit gesperrten Abhängigkeiten |
| CI ab späteren Paketen | Tatsächlich implementierte Fach-, Adapter-, Zugriffs- und E2E-Suites passend zum betroffenen Verhalten |

Umfangreiche Builds, E2E-Tests und Plattformsmokechecks werden nicht bei jedem Commit erzwungen. Vorhandene Rootbefehle und tatsächliche CI-Ergebnisse werden nach Einrichtung hier dokumentiert; eine leere Suite gilt nicht als Verhaltensnachweis. Erforderliche GitHubchecks erst festlegen, wenn sie existieren, funktionieren und Änderungen der Repositoryeinstellungen autorisiert sind.

### Agentenspezifische Automatik

Agenten verwenden dieselben Projektprüfungen wie menschliche Mitwirkende. Laufzeitspezifische Hooks erst bei einem konkreten Bedarf und nach Prüfung der unterstützten Umgebung ergänzen. Hooks erstellen keine Commits, Pushes, Veröffentlichungen oder Taskabschlüsse automatisch; nach jedem abgeschlossenen Abschnitt ist der verpflichtende Zwischencommit gemäß [AGENTS.md](../AGENTS.md) manuell zu erstellen. Hookerfolg entscheidet nicht über fachliche Abnahme. Auch spätere Automatik erhält die zentrale Spezifikation und ersetzt sie nicht durch pro Agent kopierte Regeln.
