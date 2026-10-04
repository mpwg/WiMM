# GitHub und VS Code

## Stand

Dieses Repository enthält die abgeschlossenen Grundlagen P1–P3, den plattformunabhängigen Fachkern, verschlüsselte lokale Speicheradapter und bereits implementierte P4-Oberflächen. Die Serverhülle besitzt öffentliche Health-/Metadatenendpunkte; vollständige Synchronisierung folgt in P9. T1 modernisiert die Toolkonfigurationen und verbindlichen Prüfungen.

Die installierte lokale Toolchain benötigt Node `>=26.10.0 <28`, pnpm `>=12.8.1 <14` sowie für die Desktop-Hülle Rust und Xcode. Der entwickelte macOS-arm64-Rechner verwendet Node 26.10.0, pnpm 12.8.1 und Rust 1.99.0; die versionierte rustup-Toolchain enthält Clippy und rustfmt. Für reproduzierbare Installationen bleibt pnpm 12.8.1 in `packageManager` festgelegt. Vor der ersten Installation `pnpm install --frozen-lockfile` ausführen. Verfügbare Befehle:

| Zweck | Befehl |
| --- | --- |
| Webhülle starten | `pnpm dev:web` |
| Serverhülle starten | `pnpm dev:server` |
| Tauri-Entwicklung starten | `pnpm dev:desktop` |
| Alle vorhandenen Pakete bauen | `pnpm build` |
| Typen und Paketgrenzen prüfen | `pnpm typecheck` / `pnpm check:package-graph` |
| Alle vorhandenen Pakettests einschließlich Fachkern, Speicher und UI | `pnpm test` |
| JavaScript-/TypeScript-Linting | `pnpm lint` |
| Rust-Format, Clippy und Rust-Tests | `pnpm check:rust` |
| Toolchain-Fehlerproben | `pnpm test:toolchain` |
| Oberflächen im Entwicklungsmodus | `pnpm test:ui` |
| Gebaute Oberflächen nach Frontendbuilds | `pnpm test:ui:build` |
| Dokumentation prüfen | `pnpm check:docs` |
| Validator mit fehlerhaften Testdaten prüfen | `pnpm test:docs` |
| Lokale CI-Prüfserie | `pnpm check:ci` |

Der Server bindet für die lokale Entwicklung nur an `127.0.0.1:3000`. Er stellt ausschließlich `/api/v1/health/live`, `/api/v1/health/ready` und `/api/v1/meta` bereit. Finanz-HTTP-Endpunkte und `test:e2e` entstehen erst in späteren Paketen.

## VS-Code-Arbeitsbereich

Projektordner direkt in VS Code oder einem anderen Editor öffnen. Die benötigten Laufzeitversionen sind in der [Versions- und Lizenzbasis](technology-baseline.md) festgehalten; Einrichtung und Prüfungen erfolgen in der lokalen Entwicklungsumgebung. Keine Projektsecrets, Bankdateien, Rettungscodes oder persönlichen Beispiele einchecken.

Die versionierten `.vscode/settings.json`-Einstellungen verwenden UTF-8, LF, zwei Leerzeichen und Markdown-Softwrap; Rust verwendet vier Leerzeichen. `.editorconfig` hält dieselben Formatregeln für andere Editoren fest. Autoformat beim Speichern bleibt zunächst aus, damit bestehende Absätze nicht ungefragt umgeschrieben werden; explizite Formatierung wird später über die Projekttoolchain vereinheitlicht.

[Erweiterungsempfehlungen](../.vscode/extensions.json): EditorConfig, markdownlint, YAML, GitHub Pull Requests, Tauri, Oxlint, Rust Analyzer und TypeScript 7. Sie sind Empfehlungen im Workspace und werden nicht global installiert. GitHubintegration verwendet das echte Repositorykonto. Die Projektkonfiguration aktiviert die lokale TypeScript-7-Sprachunterstützung, typgestütztes Oxlint und Clippy mit Warnungen als Fehlern; die verbindliche vollständige Prüfung bleibt `pnpm check:ci`.

Keine VS-Code-Task/Debugkonfiguration mit nicht existierenden Appbefehlen. Keine globale Änderung von Benutzerprefs, Authkonten oder Workspace-Trust. [Workspace-Einstellungen](https://code.visualstudio.com/docs/configure/settings), [Erweiterungsempfehlungen](https://code.visualstudio.com/docs/configure/extensions/extension-marketplace).

## Agenten im Editor

Die [Agentenregeln](../AGENTS.md) gelten für Codex und andere beteiligte Agenten. Repository-Skills liegen in `.agents/skills`, Copilot liest zusätzlich den knappen Verweis in `.github/copilot-instructions.md`. [Agentenleitfaden](agent-guide.md) beschreibt Auswahl und Formate. Falls eine Umgebung Discovery nicht unterstützt, die passende SKILL.md ausdrücklich mitgeben; kein weiterer globaler Installationsschritt ist nötig.

## GitHubvorlagen

Bereits angelegt: [PR-Vorlage](../.github/pull_request_template.md), [Aufgabenformular](../.github/ISSUE_TEMPLATE/task.yml) und [Fehlerformular](../.github/ISSUE_TEMPLATE/bug.yml). Keine Labels/Assignees/Owners voraussetzen, die erst auf GitHub existieren müssten. Die Formulare nutzen deutsche Inhalte und dieselben Paket-/Vertrags-/Prüfbelegfelder wie die lokale Dokumentation.

Ein GitHub-Remote ist konfiguriert. Vor jedem Push muss die tatsächliche `git remote`-Konfiguration geprüft werden; diese Dokumentation autorisiert weder Push noch Veröffentlichung. Branchschutz und private Sicherheitsmeldungen werden erst nach einer autorisierten GitHub-Konfiguration dokumentiert. CI ab P1; Checks erst als verpflichtend konfigurieren, wenn sie existieren und funktionieren. [GitHub-Templates](https://docs.github.com/en/communities/using-templates-to-encourage-useful-issues-and-pull-requests/about-issue-and-pull-request-templates).

## Nächster Implementierungsschritt

P1.1 hat die stabilen Bibliotheks-/SDKversionen aus offiziellen Quellen geprüft; Details stehen in der [Versions- und Lizenzbasis](technology-baseline.md). P1.2 bis P1.6 legen darauf aufbauend Workspace, exakte Lockfiles, öffentliche Hüllen, Crypto-Binding und lokale Prüfungen an. Lokal `pnpm install --frozen-lockfile` und danach `pnpm check:ci` verwenden. Die CI-Prüfserie umfasst Dokumentation, Paketgraph, TypeScript, die vorhandenen Tests und alle Builds. Finanzen bleiben clientseitig; Backend transportiert später Chiffrate. E2EE benötigt keine Appattestierung. Deploymentsecrets, Bankdateien, Rettungscodes und persönliche Beispiele niemals einchecken.

Die abgeschlossenen [P1-Teilaufgaben](p1-foundation.md), [P2-Teilaufgaben](p2-domain.md), [P3-Teilaufgaben](p3-storage.md), [P4.1](p4-ui.md#p41--composition-root-und-lokaler-einstieg), [P4.2.1](p4-ui.md#p421--navigation-und-bereichstrennung-prüfen), [P4.2.2](p4-ui.md#p422--übersicht-und-kontostart-prüfen) und [P4.2.3](p4-ui.md#p423--kontoarchivierung-mit-referenzen-abnehmen) dokumentieren die Grundlage. Die [Teilaufgabenübersicht P4–P11](tasks.md#teilaufgaben-und-bearbeitungsfolge) legt die nächsten Schritte fest; mit [P4.2.4](p4-ui.md#p424--kategoriearchivierung-mit-referenzen-abnehmen) fortfahren. Für den ersten Einstieg den [Kurzleitfaden](getting-started.md) nutzen; [Referenzhaushalt](reference-household.md) und [Lesematrix](agent-guide.md#lesematrix-nach-aufgabe) helfen bei konkreten Aufgaben.

## Aktuelle Toolprüfungen

`pnpm check:ci` startet dieselbe vollständige Prüfserie lokal und in CI: Dokumentation und Validator-Tests, Paketgraph, TypeScript, Oxlint, Rust-Format/Clippy/Tests, Toolchain-Fehlerproben, alle vorhandenen Pakettests einschließlich `@wimm/ui`, UI-Tests und Builds. Node-Warnungen brechen die zentrale Serie ab; `NO_COLOR` wird für Kindprozesse in `FORCE_COLOR=0` übersetzt, um widersprüchliche Farbvariablen zu vermeiden. Die einzelnen Befehle bleiben für gezielte Prüfungen verfügbar.

TypeScript verwendet `ES2025`, die neueste feste Zielversion der installierten Version 7.0.2, und prüft explizit React-Dateien, Toolkonfigurationen und UI-Tests. Strict-, Index-, Unused-, Return-, Override-, Switch- und Side-Effect-Prüfungen sind verbindlich. Vite verwendet unabhängig davon `baseline-widely-available`; neue JavaScript-APIs benötigen weiterhin tatsächliche Unterstützung in den Zielbrowsern. `skipLibCheck` bleibt wegen zweier nachgewiesener Fremdfehler aktiv: Dexie 4.2.1 deklariert einen Namespace mit `module` (TS1540), und thread-stream 4.2.0 referenziert den entfernten Node-Typ `TransferListItem` (TS2694). Eigene Quellen werden weiterhin vollständig geprüft; keine Fremddeklarationen werden gepatcht.

`pnpm lint` prüft JavaScript mit den empfohlenen Korrektheitsregeln und TypeScript zusätzlich mit React-/Testregeln und Typinformationen für Promises und unsichere Typverwendungen. JavaScript erhält keine typgestützten Regeln, weil diese Dateien kein geprüftes TypeScriptprojekt bilden. Alle Lintwarnungen führen durch `--deny-warnings` zum Abbruch. Der Assertion-Helfer `expectDomainError` ist als solcher registriert. Die einzige lokale React-Ausnahme steht direkt am Speicherladeeffekt: Dieser synchronisiert den ausgewählten Bereich mit externem Speicher und benötigt den Ladezustand. Unbenutzte Ausnahmekommentare werden als Fehler gemeldet.

Beide Frontendbuilds verwenden den Vite-Logger und `build.rolldownOptions.onLog` zur Warnungsablehnung. Der Buildstarter weist außerdem Diagnoseausgaben auf stderr ab, weil Vites nativer Reporter diese Callbacks teilweise umgeht; Ausgaben werden nicht unterdrückt. libsodium-WASM und seine Bindings werden getrennt gebündelt; die unveränderte 500-kB-Grenze gilt für jeden Chunk. Exklusive Vitest-/Playwright-Tests sind auch lokal verboten, unbehandelte Vitest-Fehler werden nicht ignoriert.

Rust ist in `rust-toolchain.toml` auf 1.99.0 mit Clippy und rustfmt festgelegt. rustup richtet diese Toolchain automatisch ein; bei anderen Installationswegen prüft `pnpm check:rust-toolchain` die tatsächliche Version. `pnpm check:rust` führt Formatprüfung ohne Umschreiben, Clippy für alle Targets mit `-D warnings` und Rust-Tests mit gesperrtem Lockfile aus. `.cargo/config.toml` macht Compilerwarnungen auch beim Tauri-Build zu Fehlern. Die Rust-/Desktopstarter weisen zusätzlich Cargo-Buildskriptwarnungen ab. Die einzige notwendige Toolversionskorrektur ist Tauri-CLI 2.12.0: CLI 2.11.5 setzte die bei tauri-build 2.7.0 veraltete Variable `STATIC_VCRUNTIME`. Stattdessen ist nun `build.windows.staticVCRuntime: true` in der Tauri-Konfiguration explizit festgelegt; die bestehende Windows-Standardwahl bleibt erhalten.

`pnpm test:toolchain` prüft mit temporären synthetischen Dateien innerhalb der Arbeitskopie die vollständigen TypeScript-Prüfeingaben und echte Fehlerstatus bei Compiler-, JavaScript-/TypeScript-Lint-, Promise-/Unsafe-, Vite-Logger-/Rolldown-/Reporter-, Rust-, Cargo-Buildskript- und Node-Warnungen sowie exklusiven Tests. Die Dateien werden anschließend entfernt. `pnpm test:ui:build` prüft nach den Frontendbuilds die gebündelten Oberflächen über Vite Preview. Beide UI-Serien starten über einen portablen Node-Starter; der PWA-Offline-Test läuft ausschließlich im Webclient. Chromium-Desktop-Frontendtests ersetzen keine native Tauri-Abnahme.

VS Code empfiehlt Oxlint und Rust Analyzer. Oxlint verwendet die Projektkonfiguration mit Typinformationen, Rust Analyzer Clippy mit denselben Warnungsregeln und einem explizit verknüpften Cargo-Projekt. Die offizielle [TypeScript-7-Erweiterung](https://marketplace.visualstudio.com/items?itemName=TypeScriptTeam.native-preview) verwendet die lokale TypeScriptinstallation. Es werden keine globalen Editor- oder Git-Einstellungen geändert.

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

Der Workflow `.github/workflows/ci.yml` installiert auf `ubuntu-latest` die offiziellen Tauri-Systempakete für WebKitGTK und baut dort auch die Tauri-Hülle. pnpm-Store und Rust/Cargo-Buildartefakte werden gecacht; Playwright richtet beim Lauf nur den tatsächlich benötigten Chromium-Headless-Shell samt Systemabhängigkeiten ein. Der Browser wird nicht gecacht, da Playwright das Wiederherstellen der Browserarchive unter Linux nicht als Zeitgewinn empfiehlt. Rust-Artefakte werden durch `Swatinem/rust-cache` gecacht. Umfangreiche E2E-Tests und Plattformsmokechecks werden nicht bei jedem Commit erzwungen. Die vorhandenen Playwright-Suites prüfen Web und Desktopfrontend in Chromium; native Plattformprüfungen bleiben separat erforderlich. Änderungen am Workflow sind lokal durch `pnpm check:ci` geprüft; Laufzeitersparnis muss anhand eines Remote-Laufs gemessen werden. Erforderliche GitHubchecks erst festlegen, wenn sie existieren, funktionieren und Änderungen der Repositoryeinstellungen autorisiert sind.

### Agentenspezifische Automatik

Agenten verwenden dieselben Projektprüfungen wie menschliche Mitwirkende. Laufzeitspezifische Hooks erst bei einem konkreten Bedarf und nach Prüfung der unterstützten Umgebung ergänzen. Hooks erstellen keine Commits, Pushes, Veröffentlichungen oder Taskabschlüsse automatisch; nach jedem abgeschlossenen Abschnitt ist der verpflichtende Zwischencommit gemäß [AGENTS.md](../AGENTS.md) manuell zu erstellen. Hookerfolg entscheidet nicht über fachliche Abnahme. Auch spätere Automatik erhält die zentrale Spezifikation und ersetzt sie nicht durch pro Agent kopierte Regeln.
