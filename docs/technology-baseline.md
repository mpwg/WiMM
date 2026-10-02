# Versions- und Lizenzbasis

Stand: 2. Oktober 2026. Dieses Dokument ist der Prüfbeleg für P1.1 und die Herkunftsregistergrundlage für P1.2. Es legt noch keine Paketdatei, kein Lockfile und keine transitive Abhängigkeitsauflösung an. P1.2 übernimmt die gewählten Versionen exakt und ergänzt dann die vollständigen, aus dem Lockfile ermittelten Fremdhinweise.

## Auswahlregeln

- Es werden ausschließlich stabile Releases verwendet; Vorabversionen, insbesondere Tauri 3-Alpha, sind ausgeschlossen.
- Node 24 bleibt die Laufzeitbasis, weil sie eine aktive LTS-Linie ist. Node 26 war am Stichtag zwar aktuell, aber noch keine LTS-Linie.
- Alle hier gewählten Laufzeiten erfüllen ihre dokumentierten Mindestversionen mit Node 24.21.0. Tatsächliche Installation, Typprüfung und Builds sind ausdrücklich erst P1.2 beziehungsweise P1.5.
- MIT, ISC und Apache-2.0 sind mit der Projektlizenz AGPL-3.0-or-later vereinbar. Vollständige Lizenztexte und Copyright-Hinweise der tatsächlich aufgelösten transitiven Abhängigkeiten werden vor einer Distribution aus dem Lockfile in Fremdhinweise übernommen.

## Toolchain

| Bestandteil | Gewählte Version | Offizielle Quelle und Lizenz | Kompatibilitätsgrund |
| --- | --- | --- | --- |
| Node.js | 24.21.0 | [Node-Release](https://github.com/nodejs/node/releases/tag/v24.21.0), [Releaseplan](https://github.com/nodejs/Release); MIT | Aktive LTS-Linie zum Stichtag, unterstützt bis 30. April 2028. |
| pnpm | 12.8.1 | [npm-Metadaten](https://registry.npmjs.org/pnpm/12.8.1); MIT | Dokumentierte Mindestversion Node 18, daher mit Node 24 kompatibel. |
| Rust | 1.98.1 | [Rust-Releaseankündigungen](https://blog.rust-lang.org/releases/); Apache-2.0 oder MIT | Stabile Toolchain; über der Mindestversion Rust 1.90 von Tauri 2.12.1. |
| Tauri | 2.12.1 | [npm-Metadaten](https://registry.npmjs.org/@tauri-apps%2fcli/2.12.1), [Crate-Metadaten](https://crates.io/api/v1/crates/tauri/2.12.1); Apache-2.0 oder MIT | Stabiles Tauri-2-Release, passend zur Architektur; keine 3.x-Alpha. |

## JavaScript- und Laufzeitbibliotheken

| Bereich | Gewählte Versionen | Offizielle Quelle und Lizenz | Kompatibilitätsgrund |
| --- | --- | --- | --- |
| Sprache | TypeScript 7.0.2 | [npm-Metadaten](https://registry.npmjs.org/typescript/7.0.2); Apache-2.0 | TypeScript strict/ESM gemäß Architektur; Node-Mindestversion 16.20.0. |
| Weboberfläche | React und React DOM 19.3.0, Vite 8.3.2, `@vitejs/plugin-react` 6.1.1 | [React](https://registry.npmjs.org/react/19.3.0), [Vite](https://registry.npmjs.org/vite/8.3.2), [Plugin](https://registry.npmjs.org/@vitejs%2fplugin-react/6.1.1); jeweils MIT | Vite und Plugin verlangen Node 20.19.0 oder mindestens 22.12.0; Node 24 erfüllt beides. |
| Server | Fastify 5.12.5 | [npm-Metadaten](https://registry.npmjs.org/fastify/5.12.5); MIT | Stabile Fastify-Hauptlinie für die später isolierte öffentliche Serverhülle. |
| Browserdatenbank | Dexie 4.4.6 | [npm-Metadaten](https://registry.npmjs.org/dexie/4.4.6); Apache-2.0 | Entspricht dem vorgesehenen IndexedDB-Adapter; Browserintegration erst ab P3. |
| Verträge | Zod 4.6.5 | [npm-Metadaten](https://registry.npmjs.org/zod/4.6.5); MIT | Plattformfreie Schema-Bibliothek für `packages/contracts`. |
| Server-SQLite | better-sqlite3 13.0.3 | [npm-Metadaten](https://registry.npmjs.org/better-sqlite3/13.0.3), [Release](https://github.com/WiseLibs/better-sqlite3/releases/tag/v13.0.3); MIT | Dokumentierte Node-Mindestversion 22; Version 13 verwendet N-API und entfernt den Installations-Compile-Schritt. |
| Desktop-SQLite | rusqlite 0.40.2 mit gebündeltem SQLite | [Crate-Metadaten](https://crates.io/api/v1/crates/rusqlite/0.40.2); MIT, SQLite Public Domain | Rust-Brücke gemäß Architektur; konkrete Features und Lizenzkette werden bei der Cargo-Auflösung in P1.2 festgeschrieben. |
| Tests | Vitest 5.0.3, Playwright 1.63.0 | [Vitest](https://registry.npmjs.org/vitest/5.0.3); MIT, [Playwright](https://registry.npmjs.org/playwright/1.63.0); Apache-2.0 | Vitest unterstützt Node 24, Playwright verlangt mindestens Node 20. |

## Kryptografie und Kanonisierung

| Bestandteil | Gewählte Version | Offizielle Quelle und Lizenz | Kompatibilitätsgrund |
| --- | --- | --- | --- |
| libsodium-WASM | libsodium-wrappers-sumo 0.8.4 | [npm-Metadaten](https://registry.npmjs.org/libsodium-wrappers-sumo/0.8.4), [Upstream](https://github.com/jedisct1/libsodium.js); ISC | Sumo stellt die in der E2EE-Spezifikation benötigten XChaCha20-Poly1305-, Ed25519-, sealed-box- und Argon2id-Primitive bereit. Die Kapselung und Vektoren folgen erst in P1.4. |
| RFC-8785-Kanonisierung | canonicalize 5.1.0 | [npm-Metadaten](https://registry.npmjs.org/canonicalize/5.1.0), [Upstream](https://github.com/erdtman/canonicalize); Apache-2.0 | Etablierte JCS-Kanonisierung, Node-Mindestversion 22. Der konkrete API-Einsatz wird in P1.4 gegen RFC 8785 und feste Vektoren geprüft. |

`json-canonicalize` wird nicht ausgewählt: Sein Upstream dokumentiert für die Standardfunktion eine von RFC 8785 abweichende Behandlung von `undefined` in Arrays. Dadurch wäre der beabsichtigte Standard nur über eine fehleranfällige Optionsvorgabe erreichbar.

## Plattformstatus

| Zielsystem | Voraussetzung laut Quelle | Stand dieses Pakets |
| --- | --- | --- |
| macOS arm64 | Xcode oder Command Line Tools, Rust und Node; [Tauri-Voraussetzungen](https://v2.tauri.app/start/prerequisites/) | Entwicklungsrechner: macOS 27.0.1 arm64, Xcode vorhanden, Node 24.21.0 und pnpm 12.8.1 vorhanden; Rust fehlt. Kein Tauri-/Web-Build ausgeführt. |
| macOS x64 | Xcode oder Command Line Tools, Rust und Node | Nicht geprüft. |
| Windows x64 | Rust MSVC-Toolchain, Microsoft C++ Build Tools, WebView2 und Node | Nicht geprüft. |
| Linux x64 | distributionsabhängige WebKitGTK-/Build-Abhängigkeiten, Rust und Node | Nicht geprüft. |
| Browser-PWA | Aktueller Chromium, Firefox und WebKit | Nicht geprüft; Playwright-Browser werden erst mit P1.2 installiert und ab P4 für Verhalten verwendet. |

Die Tauri-Dokumentation nennt zielsystemabhängige Voraussetzungen und keinen Ersatz durch Cross-Compilation. P1.5 führt deshalb tatsächliche Start-/Build-Smokechecks getrennt für verfügbare Zielsysteme aus. Fehlendes Rust blockiert hier nur die lokale Tauri-Prüfung, nicht die abgeschlossene Quellen- und Lizenzprüfung von P1.1.

## Herkunftsregister ab P1.2

Für jede aufgelöste direkte oder transitive Abhängigkeit werden mindestens Name, exakte Version, Registry-Integrität aus dem Lockfile, SPDX-Lizenz, Upstream-URL, Copyright-/NOTICE-Datei und erforderliche Weitergabe in einer maschinenlesbar auswertbaren Liste festgehalten. Übernommener Quellcode erhält zusätzlich Herkunftscommit, lokale Änderungen und ursprüngliche Hinweise. Diese Grundlage ersetzt weder die Lizenzprüfung des Lockfiles noch eine Sicherheitsprüfung der Pakete.
