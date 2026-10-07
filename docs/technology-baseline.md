# Versions- und Lizenzbasis

Stand: 7. Oktober 2026. Dieses Dokument hält den Auswahlstand aus P1.1 und die aktuellen Abweichungen der tatsächlichen Manifeste fest. Paketmanifeste und Lockfiles sperren die installierten Versionen; vollständige Fremdhinweise bleiben vor einer Distribution erforderlich. Die Auswahlübersichten nach dem T1-Abschnitt sind historische P1.1-Belege.

## Tatsächlicher Manifeststand und Toolmodernisierung T1

Die Auswahlübersichten unten dokumentieren P1.1; die tatsächlichen Installationen werden durch Paketmanifeste und Lockfiles festgelegt. Folgende Abweichungen wurden bei T1 festgestellt und mit Ausnahme der notwendigen CLI-Kompatibilitätskorrektur dokumentiert:

| Bestandteil | Auswahlübersicht P1.1 | Tatsächlich gesperrt |
| --- | --- | --- |
| Tauri-CLI | 2.11.5 | 2.12.0; notwendige Korrektur der veralteten STATIC_VCRUNTIME-Übergabe |
| tauri-build | 2.6.3 | 2.7.1 |
| Dexie | 4.4.6 | 4.2.1 |
| rusqlite | 0.40.2 | 0.40.2 |
| better-sqlite3 | 13.0.3 für den späteren Server | Noch keine Abhängigkeit des aktuellen Servers |

T1 ergänzt [Oxlint 1.85.0](https://registry.npmjs.org/oxlint/1.85.0) und [oxlint-tsgolint 7.0.2003](https://registry.npmjs.org/oxlint-tsgolint/7.0.2003), beide MIT. Registry-Veröffentlichungen: 21. beziehungsweise 24. September 2026; beide erfüllen am 4. Oktober die sieben Tage Reifezeit. Oxlint verlangt Node `^20.19.0 || >=22.12.0` und oxlint-tsgolint mindestens 7.0.2001; die gewählten Versionen erfüllen dies. Tauri-CLI [2.12.0](https://registry.npmjs.org/@tauri-apps%2fcli/2.12.0) erschien am 26. September 2026 und erfüllt ebenfalls die Reifezeit; Rust-Core und JS-API bleiben unverändert. Neue plattformspezifische Pakete sind einschließlich Integrität im pnpm-Lockfile gesperrt. TypeScript bleibt 7.0.2, das Sprachziel wird ES2025. Rust bleibt 1.99.0 und ist nun einschließlich Clippy/rustfmt versioniert festgelegt.

`skipLibCheck` bleibt wegen TS1540 in Dexie 4.2.1 und TS2694 in thread-stream 4.2.0 nötig. Das ist eine dokumentierte Fremddeklarationsgrenze, keine Abschaltung eigener Typprüfungen. Die [Entwicklungsanleitung](development.md#aktuelle-toolprüfungen) beschreibt die verbindlichen Warnungsregeln. Die vorhandenen pnpm-Regeln für Installationsskripte, exakte Versionen, Peers und Reifezeit bleiben erhalten.

## Auswahlregeln

- Es werden ausschließlich stabile Releases verwendet; Vorabversionen, insbesondere Tauri 3-Alpha, sind ausgeschlossen.
- Node 26 ist die aktuelle stabile Laufzeitlinie. Das Projekt verlangt mindestens Node 26.10.0 und akzeptiert bis vor Node 28 auch die nächste Hauptlinie; so bleiben zeitnahe Sicherheits- und Patchupdates ohne Konfigurationsänderung nutzbar.
- Alle hier gewählten Laufzeiten erfüllen ihre dokumentierten Mindestversionen mit Node 26.10.0. Tatsächliche Installation, Typprüfung und Builds sind ausdrücklich erst P1.2 beziehungsweise P1.5. Tauri 2.12.1 wurde nicht übernommen, weil die Veröffentlichung am 30. September 2026 die festgelegte Reifezeit von sieben Tagen noch nicht erfüllt; die neueste reife kompatible 2.11-Kombination ist festgelegt.
- MIT, ISC und Apache-2.0 sind mit der Projektlizenz AGPL-3.0-or-later vereinbar. Vollständige Lizenztexte und Copyright-Hinweise der tatsächlich aufgelösten transitiven Abhängigkeiten werden vor einer Distribution aus dem Lockfile in Fremdhinweise übernommen.

## Toolchain

| Bestandteil | Gewählte Version | Offizielle Quelle und Lizenz | Kompatibilitätsgrund |
| --- | --- | --- | --- |
| Node.js | 26.10.0, Engine `>=26.10.0 <28` | [Node-Release](https://nodejs.org/en/download/current), [Releaseplan](https://github.com/nodejs/Release); MIT | Aktuelle stabile Linie; der Bereich lässt die nächste Hauptlinie zu, ohne beliebig unbekannte Hauptversionen freizugeben. |
| pnpm | 12.8.1, Engine `>=12.8.1 <14` | [npm-Metadaten](https://registry.npmjs.org/pnpm/12.8.1); MIT | Aktuelle stabile Version; `packageManager` bleibt für reproduzierbare Installationen bei 12.8.1, während der Engine-Bereich kompatible neuere Versionen bis vor 14 zulässt. |
| Rust | 1.99.0 | [Rust-Releaseankündigungen](https://blog.rust-lang.org/releases/); Apache-2.0 oder MIT | Aktuelle stabile Toolchain; über der Mindestversion Rust 1.90 von Tauri 2.12.1. |
| Tauri | CLI 2.11.5; JS-API 2.11.1; Rust-Core 2.11.6; Rust-Build 2.6.3 | [CLI-Metadaten](https://registry.npmjs.org/@tauri-apps%2fcli/2.11.5), [API-Metadaten](https://registry.npmjs.org/@tauri-apps%2fapi/2.11.1), [Rust-Core](https://crates.io/api/v1/crates/tauri/2.11.6), [Rust-Build](https://crates.io/api/v1/crates/tauri-build/2.6.3); Apache-2.0 oder MIT | Neueste reife stabile Tauri-2-Kombination gemäß sieben Tagen Reifezeit, passend zur Architektur. Rust-Core und Rust-Build folgen eigenständigen Versionslinien; keine 3.x-Alpha. |

## JavaScript- und Laufzeitbibliotheken

| Bereich | Gewählte Versionen | Offizielle Quelle und Lizenz | Kompatibilitätsgrund |
| --- | --- | --- | --- |
| Sprache | TypeScript 7.0.2 | [npm-Metadaten](https://registry.npmjs.org/typescript/7.0.2); Apache-2.0 | TypeScript strict/ESM gemäß Architektur; Node-Mindestversion 16.20.0. Die Projektquellen bleiben strikt; `skipLibCheck` übergeht ausschließlich die oben dokumentierten inkompatiblen Fremddeklarationen von Dexie und `thread-stream`. |
| Weboberfläche | React und React DOM 19.3.0, Vite 8.3.1, `@vitejs/plugin-react` 6.1.1 | [React](https://registry.npmjs.org/react/19.3.0), [Vite](https://registry.npmjs.org/vite/8.3.1), [Plugin](https://registry.npmjs.org/@vitejs/plugin-react/6.1.1); jeweils MIT | Vite und Plugin verlangen Node 20.19.0 oder mindestens 22.12.0; Node 26 erfüllt beides. Vite 8.3.1 erfüllt zusätzlich die gewählte Reifezeitpolicy. |
| Server | Fastify 5.12.5 | [npm-Metadaten](https://registry.npmjs.org/fastify/5.12.5); MIT | Stabile Fastify-Hauptlinie für die später isolierte öffentliche Serverhülle. |
| Browserdatenbank | Dexie 4.4.6 | [npm-Metadaten](https://registry.npmjs.org/dexie/4.4.6); Apache-2.0 | Entspricht dem vorgesehenen IndexedDB-Adapter; Browserintegration erst ab P3. |
| Verträge | Zod 4.6.5 | [npm-Metadaten](https://registry.npmjs.org/zod/4.6.5); MIT | Plattformfreie Schema-Bibliothek für `packages/contracts`. |
| Server-SQLite | better-sqlite3 13.0.3 | [npm-Metadaten](https://registry.npmjs.org/better-sqlite3/13.0.3), [Release](https://github.com/WiseLibs/better-sqlite3/releases/tag/v13.0.3); MIT | Dokumentierte Node-Mindestversion 22; Version 13 verwendet N-API und entfernt den Installations-Compile-Schritt. |
| Desktop-SQLite | rusqlite 0.40.2 mit gebündeltem SQLite | [Crate-Metadaten](https://crates.io/api/v1/crates/rusqlite/0.40.2); MIT, SQLite Public Domain | Rust-Brücke gemäß Architektur; konkrete Features und Lizenzkette werden bei der Cargo-Auflösung in P1.2 festgeschrieben. |
| Tests | Vitest 5.0.2, Playwright 1.63.0 | [Vitest](https://registry.npmjs.org/vitest/5.0.2); MIT, [Playwright](https://registry.npmjs.org/playwright/1.63.0); Apache-2.0 | Vitest unterstützt Node 26, Playwright verlangt mindestens Node 20. Vitest 5.0.2 erfüllt zusätzlich die gewählte Reifezeitpolicy. |
| Dokumentationsprüfung | markdown-it 15.0.2, yaml 2.9.1 | [markdown-it](https://registry.npmjs.org/markdown-it/15.0.2); MIT, [yaml](https://registry.npmjs.org/yaml/2.9.1); ISC | Etablierte Markdown- und YAML-Parser für `check:docs`; relative Links und Anker werden gegen die gemeinsam geparsten Dokumente geprüft. |

## Kryptografie und Kanonisierung

| Bestandteil | Gewählte Version | Offizielle Quelle und Lizenz | Kompatibilitätsgrund |
| --- | --- | --- | --- |
| libsodium-WASM | libsodium-wrappers-sumo 0.8.4 | [npm-Metadaten](https://registry.npmjs.org/libsodium-wrappers-sumo/0.8.4), [Upstream](https://github.com/jedisct1/libsodium.js); ISC | Sumo stellt die in der E2EE-Spezifikation benötigten XChaCha20-Poly1305-, Ed25519-, sealed-box- und Argon2id-Primitive bereit. Die Kapselung und Vektoren folgen erst in P1.4. |
| RFC-8785-Kanonisierung | canonicalize 5.1.0 | [npm-Metadaten](https://registry.npmjs.org/canonicalize/5.1.0), [Upstream](https://github.com/erdtman/canonicalize); Apache-2.0 | Etablierte JCS-Kanonisierung, Node-Mindestversion 22. Der konkrete API-Einsatz wird in P1.4 gegen RFC 8785 und feste Vektoren geprüft. |

`json-canonicalize` wird nicht ausgewählt: Sein Upstream dokumentiert für die Standardfunktion eine von RFC 8785 abweichende Behandlung von `undefined` in Arrays. Dadurch wäre der beabsichtigte Standard nur über eine fehleranfällige Optionsvorgabe erreichbar.

Vite und `tsx` verwenden transitiv `esbuild` für ihre Build- beziehungsweise TypeScript-Transformation. Das versionierte `allowBuilds` erlaubt ausschließlich dessen Installationsskript; andere Installationsskripte bleiben gesperrt. `esbuild` ist MIT-lizenziert und wird nur als Entwicklungswerkzeug eingesetzt.

## Paketmanagerentscheidung

pnpm 12.8.1 bleibt der einzige Paketmanager dieses Repositories. `packageManager` sperrt diese aktuelle stabile Version für reproduzierbare Installationen; die Engine akzeptiert kompatible pnpm-Versionen bis vor 14. Seine [Workspaceunterstützung](https://pnpm.io/workspaces) verbindet interne Pakete ausschließlich über `workspace:`; fehlende lokale Ziele werden dadurch nicht unbemerkt aus einer Registry geladen. Ein gemeinsames `pnpm-lock.yaml` und der isolierte Linker verhindern undeclared beziehungsweise zufällig erreichbare Abhängigkeiten. Die versionierte [`allowBuilds`-Policy](https://pnpm.io/cli/approve-builds) verlangt für Installationsskripte eine explizite Entscheidung. `minimumReleaseAge: 10080` hält neue Registry-Releases für sieben Tage zurück.

npm erfüllt Workspace-Grundfunktionen, liefert aber diese projektweit versionierte Freigabepolicy nicht. Bun ist für Installationen schnell und unterstützt Workspaces, bleibt hier jedoch nur eine mögliche spätere Laufzeitprüfung: Node 26, pnpm und der pnpm-Lockfile sind die verbindliche Entwicklungsbasis. Yarn wird nicht zusätzlich eingeführt, weil sein PnP-/Linkermodell für die gewählte Tauri-/Native-Binding-Toolchain keinen zusätzlichen Nutzen bietet.

## Plattformstatus

| Zielsystem | Voraussetzung laut Quelle | Stand dieses Pakets |
| --- | --- | --- |
| macOS arm64 | Xcode oder Command Line Tools, Rust und Node; [Tauri-Voraussetzungen](https://v2.tauri.app/start/prerequisites/) | Entwicklungsrechner: macOS 27.0.1 arm64, Xcode vorhanden, Node 26.10.0 und pnpm 12.8.1 vorhanden; Rust 1.99.0 über Homebrew installiert. P1.5 hat Tauri-Build und -Start ausgeführt. |
| macOS x64 | Xcode oder Command Line Tools, Rust und Node | Nicht geprüft. |
| Windows x64 | Rust MSVC-Toolchain, Microsoft C++ Build Tools, WebView2 und Node | Nicht geprüft. |
| Linux x64 | distributionsabhängige WebKitGTK-/Build-Abhängigkeiten, Rust und Node | Nicht geprüft. |
| Browser-PWA | Aktueller Chromium, Firefox und WebKit | Nicht geprüft; Playwright-Browser werden erst mit P1.2 installiert und ab P4 für Verhalten verwendet. |

Die Tauri-Dokumentation nennt zielsystemabhängige Voraussetzungen und keinen Ersatz durch Cross-Compilation. P1.5 führt deshalb tatsächliche Start-/Build-Smokechecks getrennt für verfügbare Zielsysteme aus.

## Herkunftsregister ab P1.2

Für jede aufgelöste direkte oder transitive Abhängigkeit werden mindestens Name, exakte Version, Registry-Integrität aus dem Lockfile, SPDX-Lizenz, Upstream-URL, Copyright-/NOTICE-Datei und erforderliche Weitergabe in einer maschinenlesbar auswertbaren Liste festgehalten. Übernommener Quellcode erhält zusätzlich Herkunftscommit, lokale Änderungen und ursprüngliche Hinweise. Diese Grundlage ersetzt weder die Lizenzprüfung des Lockfiles noch eine Sicherheitsprüfung der Pakete.

## P4.5 — Native Systemports

Zusätzlich exakt gesperrt: `tauri-plugin-dialog` 2.7.3 und `tauri-plugin-opener` 2.5.5, jeweils Apache-2.0 oder MIT; `url` 2.5.8 (MIT oder Apache-2.0) und `tempfile` 3.27.0 (MIT oder Apache-2.0). Die offiziellen [Dialog-](https://v2.tauri.app/plugin/dialog/) und [Opener-APIs](https://v2.tauri.app/plugin/opener/) werden ausschließlich innerhalb der begrenzten Rust-Appcommands verwendet. Diese tatsächlich gesperrte Kombination ist mit Core 2.11.6 gebaut und geprüft; die frühere Versionsbehauptung wird nicht als aktueller Kompatibilitätsbeleg weitergeführt. Es wurde kein Upstreamquellcode kopiert. Checksummen und transitive Auflösung stehen in `apps/desktop/src-tauri/Cargo.lock`; vollständige Distributionhinweise bleiben P11.

## Auditbehebung: AST-Paketgraphprüfung

Für die Entwicklungsprüfung wird `@babel/parser` exakt auf 8.0.6 gesperrt (MIT, Veröffentlichung 18. September 2026; sieben Tage Reifezeit erfüllt). [Offizielle Parserdokumentation](https://babeljs.io/docs/babel-parser) beschreibt TS/JSX und dynamische Imports. Die vorhandene TypeScript-7-Installation stellt keine `createSourceFile`-JavaScript-API bereit. Der Parser ergänzt ausschließlich das Entwicklungswerkzeug; keine neue Produktabhängigkeit oder Änderung erlaubter Paketrichtungen.

## Auditbehebung: Entwicklungsabhängigkeiten

`source-map-js` wird bei Versionen unter 1.2.2 durch einen eng begrenzten Override auf 1.2.2 korrigiert (BSD-3-Clause, Veröffentlichung 30. September 2026). [GHSA-68fv-2mgg-jv7q](https://github.com/advisories/GHSA-68fv-2mgg-jv7q) nennt 1.2.2 als korrigierte Version. `pnpm audit` meldet am 7. Oktober nach Aktualisierung keinen Treffer; Typecheck, Toolchainnegativtests, Vite- und Tauri-Build bestehen.
