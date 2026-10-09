# Entwicklung und tatsächliche Prüfwerkzeuge

## Stand

Alle Arbeiten in der aktiven Arbeitskopie, kein DevContainer. Node/pnpm/Rust und Bibliotheken gemäß [Versionsbasis](technology-baseline.md) und gesperrten Manifesten. [AGENTS.md](../AGENTS.md), [Aufgaben](tasks.md), [Architektur](architecture.md) und [Prüfstrategie](testing.md) vor Änderungen lesen. Neue Rust-Anwendungs-/ORM-/Axum-Befehle existieren noch nicht; geplante Kommandos nicht als vorhandene Anleitung angeben.

Einrichtung bei freigegebener Implementierung: `pnpm install --frozen-lockfile`. Rust-Toolchain in rust-toolchain.toml; native Desktopbuilds benötigen plattformspezifische Tauri-Abhängigkeiten. `dev:server` startet den bestehenden Fastify-Health-/Metadatenstub bis zur geprüften Rustparität.

## Vorhandene Befehle

Die folgenden Einträge wurden mit package.json abgeglichen; Tabelle ist kein neuer Testlauf.

| Befehl | Tatsächlicher Skriptinhalt |
| --- | --- |
| `pnpm dev:web` | `pnpm --filter @wimm/web dev` |
| `pnpm dev:desktop` | `pnpm --filter @wimm/desktop dev` |
| `pnpm dev:server` | `pnpm --filter @wimm/server dev` |
| `pnpm check:docs` | `node scripts/check-documentation.mjs` |
| `pnpm test:docs` | `node --test scripts/check-documentation.test.mjs` |
| `pnpm check:package-graph` | `node scripts/check-package-graph.mjs` |
| `pnpm check:application` | `node scripts/check-application.mjs` |
| `pnpm check:core:architecture` | `node scripts/check-core-architecture.mjs` |
| `pnpm typecheck` | `tsc --project tsconfig.json --noEmit` |
| `pnpm lint` | `oxlint --type-aware --deny-warnings` |
| `pnpm check:rust` | `pnpm check:rust-toolchain && pnpm check:rust-format && pnpm lint:rust && pnpm test:rust` |
| `pnpm check:core` | `pnpm check:core:architecture && node scripts/check-core.mjs` |
| `pnpm test:application` | `pnpm --filter @wimm/application test` |
| `pnpm test:storage:native` | `node scripts/test-storage-native.mjs` |
| `pnpm test:storage:migrations` | `pnpm exec playwright test --config tests/storage/backups.config.ts && pnpm exec playwright test --config tests/storage/migrations.config.ts` |
| `pnpm test:core:bindings` | `node scripts/test-core-bindings.mjs` |
| `pnpm test:core:wasm` | `node scripts/test-core-bindings.mjs --wasm-only` |
| `pnpm test:ui` | `node scripts/test-ui.mjs` |
| `pnpm test:ui:integration` | `pnpm exec playwright test --config tests/workspace/config.ts` |
| `pnpm test:ui:matrix` | `node scripts/test-ui-acceptance.mjs --matrix` |
| `pnpm test:ui:acceptance` | `node scripts/test-ui-acceptance.mjs` |
| `pnpm test:ui:zoom` | `node scripts/test-ui-acceptance.mjs --zoom` |
| `pnpm test:ux` | `pnpm exec playwright test --config tests/ux/config.ts` |
| `pnpm test:importers:worker` | `pnpm exec playwright test --config tests/importers/config.ts` |
| `pnpm test:ui:offline` | `node scripts/test-ui-offline.mjs` |
| `pnpm build` | `pnpm check:rust-toolchain && pnpm -r --if-present build` |
| `pnpm check:ci` | `node scripts/check-ci.mjs` |

## Aktuelle Toolprüfungen

check:ci führt die zentrale check:all-Serie aus. Dokumentations-/Graph-/Generator-/Typ-/Lint-/Rust-/Paket-/Binding-/Speicher-/Browser-/Buildprüfungen bleiben streng. Node/Cargo-/Build-/Lintwarnungen sind Fehler; keine Lockerung von Finanz-/Performancegrenzen. Zusätzliche Zielprüfungen entstehen erst mit den neuen Komponenten und dürfen nicht als bereits implementiert beschrieben werden.

TypeScript strict, ES2025; Vite baseline-widely-available. skipLibCheck bleibt eine explizite Fremddeklarationsgrenze für saxes/thread-stream gemäß letzter Nachprüfung, keine Aussetzung eigener Typprüfung. Vitest/Playwright erlauben keine exklusiven Tests. Vitechunks behalten die 500-kB-Grenze. Rust fmt prüft ohne Umschreiben; Clippy mit -D warnings, gesperrte native Tests und direkte Rust-Assertions. Eigene Crates/Bindings/Buildscripts bleiben global unsafe-frei.

## Native und Browsernachweise

test:storage:native führt echten Rust/SQLite-Testtransport gegen Datei und vollständigen Prozessneustart aus. test:storage:migrations prüft Browser-Chiffratspeicher/IndexedDB-Migration. Frontendfälle ohne Tauri nutzen einen ausdrücklich gekennzeichneten IndexedDB-Testadapter; keine native Abnahme daraus ableiten. Native WASM/Swift/Kotlin-Finanzbindings werden im Bindingkatalog geprüft, neue Anwendungs-/Crypto-/ORMbindings noch nicht.

Die Ubuntu-CI installiert Chromium, Firefox und WebKit sowie Tauri-Systempakete und führt check:ci aus; aktueller Umfang in .github/workflows/ci.yml. Rust/Cargo/pnpm-Artefakte werden gecacht. Echte Systemzoom-/Screenreader-/Geräte-/native Plattformabnahmen bleiben getrennte Kriterien. Historische Laufbelege in [Belegindex](review-evidence.md), aktueller Fortschritt in GitHub.

## VS-Code-Arbeitsbereich

Versionierte Tasks unter .vscode/tasks.json starten Web, Server und Desktop; launch.json ergänzt Browser-/Serverdebugging. Rust Analyzer/Oxlint und die lokale TypeScriptinstallation verwenden die Projektkonfiguration. Keine globalen Editor-/Gitänderungen. Projektagenten lesen die gemeinsamen Skills; [Leitfaden](agent-guide.md).

Die [Erweiterungsempfehlungen](../.vscode/extensions.json) decken Rust/Tauri/LLVM-Debugging, TypeScript/Oxc, Vitest/Playwright, EditorConfig/TOML/YAML, Markdown/Mermaid, Git/GitHub sowie SQLite-/CSV-Inspektion ab. Fehlende Empfehlungen über die Erweiterungsansicht installieren; Even Better TOML ergänzt Cargo-, Toolchain- und Tauri-Konfigurationen. Rust Analyzer lädt sowohl den Workspace in `Cargo.toml` als auch den separaten Tauri-Crate. Unter macOS findet die installierte LLVM-DAP-Erweiterung den Debugadapter über `xcrun`; ein zusätzlicher CodeLLDB-Debugger ist nicht nötig.

Clippy prüft alle Targets über `rust-analyzer.check.allTargets`; `--all-targets` nicht zusätzlich in `check.extraArgs` eintragen, sonst lehnt Cargo das doppelte Argument ab. `--locked` und `-D warnings` bleiben verbindlich.

ESLint, Prettier, Git History, npm Intellisense, Edit CSV, Astro, MDX, Codespaces, Dev Containers, Container Tools, Edge DevTools, PowerShell und Web Search for Copilot sind für diesen Workspace nicht vorgesehen. In der Erweiterungsansicht jeweils **Disable (Workspace)** verwenden, danach den Erweiterungshost neu starten. `unwantedRecommendations` unterdrückt Empfehlungen, deaktiviert aber keine installierte Erweiterung. Globale Installationen und andere Projekte bleiben erhalten. WiMM verwendet Oxc, GitLens und Rainbow CSV; automatisches Formatieren beim Speichern bleibt ausgeschaltet.

Dependi, XML Tools, Markdown All in One, PDF Viewer, Flexoki, VSCode Icons, Codex mit Codex Audio sowie Context7 bleiben persönliche Extras. Keine automatischen Dependencyupdates aktivieren. Installationslisten belegen keine Aktivierung oder Editorfunktion: beide Rust-Projekte, TypeScript-/Oxc-Diagnosen, Vitest-/Playwright-Testentdeckung, TOML-Validierung und Mermaid-Vorschau im geöffneten WiMM prüfen; Workspace-Deaktivierungen nach erneutem Öffnen kontrollieren.

## Hooks und automatisierte Prüfungen ab P1

Der optionale .githooks/pre-commit prüft vorgemerkte Dokumentations-/JSON-/YAML-/Linkänderungen aus dem Git-Index, auch entfernte Ziele. Er schreibt nichts um und erzeugt weder Commit noch Push. Erst `git config --local --get core.hooksPath` lesen; einen bestehenden anderen Hook nicht überschreiben. Nur bei fehlendem Wert und gewünschter Aktivierung `git config --local core.hooksPath .githooks`; Deaktivierung nur dieses Werts mit `git config --local --unset core.hooksPath`. Keine globale Änderung.

Validator und Negativtests laufen ebenfalls manuell/CI; Hookerfolg ersetzt keine Fachabnahme. Dateien mit Leerzeichen/Unicode bleiben unterstützt. Zusammengehörige eigene Zwischencommits gemäß AGENTS.md, aktuelle Repo-/PRschutzregeln erhalten und kein Force-Push.

## Workspace aufräumen

Vor Bereinigung laufende Prozesse beenden und benötigte test-results außerhalb sichern. `pnpm clean:preview` oder `pnpm clean --dry-run` zeigt Ziele ohne Löschung. `pnpm clean` entfernt Buildartefakte, `clean:tests` Testberichte, `clean:deps` lokale node_modules, `clean:all` alle diese Gruppen. Quellcode/Lockfiles/Git/Finanzdaten sind keine Löschziele. Der Starter verweigert versionierte Ziele/verlinkte Eltern. Nach Dependencybereinigung erneut gesperrt installieren.

## GitHubvorlagen

Issue-/PR-/Task-/ADR-/Übergabevorlagen sind verbindlich. Issues führen aktuelle Deltas; eine neue Datei oder Issueanlage ist kein Implementierungs-/Releaseauftrag. Fach-/Crypto-/APIänderungen aktualisieren die betroffenen Verträge gemeinsam. Für aktuelle Voraussetzungen ausschließlich tasks.md und GitHub verwenden.
