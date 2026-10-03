# GitHub und VS Code

## Stand

Dieses Repository enthält die abgeschlossenen P1.1–P1.6: Workspace, öffentliche Verträge, Crypto-Binding, minimale Web-, Desktop- und Serverhüllen sowie reproduzierbare Prüfungen. Es gibt noch keine Finanzfunktion, Speicher- oder Sync-Implementierung. P2 ergänzt den plattformunabhängigen Fachkern.

Die installierte lokale Toolchain benötigt Node `>=26.10.0 <28`, pnpm `>=12.8.1 <14` sowie für die Desktop-Hülle Rust und Xcode. Der entwickelte macOS-arm64-Rechner verwendet Node 26.10.0, pnpm 12.8.1 und Rust 1.99.0 aus Homebrew. Für reproduzierbare Installationen bleibt pnpm 12.8.1 in `packageManager` festgelegt. Vor der ersten Installation `pnpm install --frozen-lockfile` ausführen. Verfügbare Befehle:

| Zweck | Befehl |
| --- | --- |
| Webhülle starten | `pnpm dev:web` |
| Serverhülle starten | `pnpm dev:server` |
| Tauri-Entwicklung starten | `pnpm dev:desktop` |
| Alle vorhandenen Pakete bauen | `pnpm build` |
| Typen und Paketgrenzen prüfen | `pnpm typecheck` / `pnpm check:package-graph` |
| Vertrags-, Crypto- und Servertests | `pnpm test` |
| Dokumentation prüfen | `pnpm check:docs` |
| Validator mit fehlerhaften Testdaten prüfen | `pnpm test:docs` |
| Lokale CI-Prüfserie | `pnpm check:ci` |

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

P1.1 hat die stabilen Bibliotheks-/SDKversionen aus offiziellen Quellen geprüft; Details stehen in der [Versions- und Lizenzbasis](technology-baseline.md). P1.2 bis P1.6 legen darauf aufbauend Workspace, exakte Lockfiles, öffentliche Hüllen, Crypto-Binding und lokale Prüfungen an. Lokal `pnpm install --frozen-lockfile` und danach `pnpm check:ci` verwenden. Die CI-Prüfserie umfasst Dokumentation, Paketgraph, TypeScript, die vorhandenen Tests und alle Builds. Finanzen bleiben clientseitig; Backend transportiert später Chiffrate. E2EE benötigt keine Appattestierung. Deploymentsecrets, Bankdateien, Rettungscodes und persönliche Beispiele niemals einchecken.

Die abgeschlossenen [P1-Teilaufgaben](p1-foundation.md) dokumentieren die Grundlage. Die [Teilaufgabenübersicht P2–P11](tasks.md#teilaufgaben-und-bearbeitungsfolge) legt die nächsten Schritte fest; nach ausdrücklicher Implementierungsfreigabe mit [P2.1](p2-domain.md#p21--exakte-geld--und-kalenderprimitive) beginnen. Für den ersten Einstieg den [Kurzleitfaden](getting-started.md) nutzen; [Referenzhaushalt](reference-household.md) und [Lesematrix](agent-guide.md#lesematrix-nach-aufgabe) helfen bei konkreten Aufgaben.

## Hooks und automatisierte Prüfungen ab P1

P1.6 stellt `pnpm check:docs` und den optionalen Hook in `.githooks/pre-commit` bereit. Beide verwenden `markdown-it` für Markdown-Links und `yaml` für YAML; JSON verarbeitet die Node-Standardbibliothek. Sie prüfen gültiges UTF-8 mit LF, Abschlusszeile und fehlenden Zeilenendleerraum sowie JSON, YAML und relative Markdown-Links mit lokalen Ankern. Externe URLs werden dabei nicht über das Netz aufgerufen.

### Gemeinsame Prüfwerkzeuge

`pnpm check:docs` prüft den Checkout. `pnpm test:docs` enthält absichtlich ungültige Link-, JSON- und YAML-Fixtures, um Fehlerpfade des Validators zu prüfen. Derselbe Validator läuft im Hook gegen den Git-Index und in CI gegen den Checkout. Platzhalter in Vorlagen werden als solche berücksichtigt.

### Optionaler pre-commit-Hook

Der Hook prüft kurze Format-/JSON-/YAML-/Linkprüfungen für vorgemerkte Änderungen einschließlich Löschungen und Umbenennungen. Bei entfernten Zielen auch unveränderte Dokumente auf eingehende Verweise prüfen. Inhalte und Linkziele stammen aus dem Git-Index; eine teilweise vorgemerkte Datei darf nicht über die abweichende Arbeitskopie geprüft werden. Dateinamen mit Leerzeichen und Unicode sicher behandeln. Der Hook schreibt keine Dateien um und übernimmt keine Änderungen automatisch.

Aktivierung ist eine bewusste, checkoutlokale Entscheidung. Zuerst `git config --local --get core.hooksPath` ausführen. Gibt der Befehl keinen Wert aus, aktiviert `git config --local core.hooksPath .githooks` den Hook. Zeigt er einen anderen Wert, diesen nicht überschreiben. Zur Deaktivierung ausschließlich bei dem Wert `.githooks` `git config --local --unset core.hooksPath` ausführen. Keine globalen Git-/Editoränderungen. Ohne Aktivierung bleiben die gemeinsamen Prüfungen manuell und in CI verfügbar. Lokale Hooks können umgangen werden und ersetzen weder Review noch CI. Fehlende Werkzeuge erzeugen eine verständliche Meldung mit dem dokumentierten Einrichtungsschritt, keine automatische Installation.

### CI und Umfang

| Zeitpunkt | Prüfung |
| --- | --- |
| Vor Commit, optional | Kurze Dokumentations-/Formatprüfungen auf den vorgemerkten Inhalten |
| Lokal vor Paketabschluss | Risikogerechte Prüfungen nach testing.md, einschließlich betroffener Fach-/Crypto-/Adapterfälle |
| CI ab P1.6 | Dokumentation, Paketgraph, Typprüfung, vorhandene Tests und Build mit gesperrten Abhängigkeiten auf `ubuntu-latest` |
| CI ab späteren Paketen | Tatsächlich implementierte Fach-, Adapter-, Zugriffs- und E2E-Suites passend zum betroffenen Verhalten |

Der Workflow `.github/workflows/ci.yml` installiert auf `ubuntu-latest` die offiziellen Tauri-Systempakete für WebKitGTK und baut dort auch die Tauri-Hülle. Umfangreiche E2E-Tests und Plattformsmokechecks werden nicht bei jedem Commit erzwungen. Es gibt noch keine E2E-Suite; ihr Fehlen ist kein Verhaltensnachweis. Die Workflowdatei wurde lokal als YAML und durch `pnpm check:ci` geprüft; einen Remote-Lauf gibt es erst nach einem autorisierten Push. Erforderliche GitHubchecks erst festlegen, wenn sie existieren, funktionieren und Änderungen der Repositoryeinstellungen autorisiert sind.

### Agentenspezifische Automatik

Agenten verwenden dieselben Projektprüfungen wie menschliche Mitwirkende. Laufzeitspezifische Hooks erst bei einem konkreten Bedarf und nach Prüfung der unterstützten Umgebung ergänzen. Hooks erstellen keine Commits, Pushes, Veröffentlichungen oder Taskabschlüsse automatisch; nach jedem abgeschlossenen Abschnitt ist der verpflichtende Zwischencommit gemäß [AGENTS.md](../AGENTS.md) manuell zu erstellen. Hookerfolg entscheidet nicht über fachliche Abnahme. Auch spätere Automatik erhält die zentrale Spezifikation und ersetzt sie nicht durch pro Agent kopierte Regeln.
