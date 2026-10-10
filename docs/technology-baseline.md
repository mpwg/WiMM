# Versions- und Lizenzbasis

Stand: 9. Oktober 2026, aus tatsächlichen Manifesten dieses Checkouts. Exakte aufgelöste Versionen/Integrität sind in pnpm-lock.yaml und den Cargo-Lockfiles verbindlich; historische Auswahlversionen werden nicht parallel gepflegt. Dieser Abgleich installiert oder aktualisiert nichts. [Herkunftsregister #72](https://github.com/mpwg/WiMM/issues/72) bleibt offen, vollständige Fremdhinweise sind vor Distribution Pflicht.

## Toolchain und Auswahlregeln

- packageManager: `pnpm@12.8.1`; Nodeengine `>=26.10.0 <28`, pnpmengine `>=12.8.1 <14`.
- Rusttoolchain gemäß rust-toolchain.toml; eigene Crates/Bindings/Buildscripts forbid(unsafe_code), globale Cargo-Lints und direkte Rust-Assertions.
- Stabile kompatible Releases, exakte Sperren, Reifezeit gemäß pnpm-workspace.yaml; keine automatisch gewählte Beta/Alpha oder Lizenzumstellung.
- AGPL-3.0-or-later für eigene Inhalte; Fremdhinweise/Herkunft unverändert erhalten. Neue ORM/VFS/Generator/Axum-/Crypto-Bindings erst nach praktischer Eignungs-/Lizenz-/Toolchainprüfung aufnehmen.

## Manifestabhängigkeiten

| Manifest | Abhängigkeit | Deklarierte Version |
| --- | --- | --- |
| `package.json` | `@babel/parser` | `8.0.6` |
| `package.json` | `@playwright/test` | `1.63.0` |
| `package.json` | `@types/node` | `26.6.3` |
| `package.json` | `@types/react` | `19.3.0` |
| `package.json` | `@types/react-dom` | `19.3.0` |
| `package.json` | `markdown-it` | `15.0.2` |
| `package.json` | `oxlint` | `1.86.0` |
| `package.json` | `oxlint-tsgolint` | `7.0.2003` |
| `package.json` | `tsx` | `4.23.15` |
| `package.json` | `typescript` | `7.0.2` |
| `package.json` | `vitest` | `5.0.3` |
| `package.json` | `yaml` | `2.9.1` |
| `packages/contracts/package.json` | `zod` | `4.6.5` |
| `packages/crypto/package.json` | `canonicalize` | `5.1.0` |
| `packages/crypto/package.json` | `libsodium-wrappers-sumo` | `0.8.4` |
| `packages/importers/package.json` | `ofx-js` | `1.1.2` |
| `packages/importers/package.json` | `papaparse` | `5.7.0` |
| `packages/importers/package.json` | `saxes` | `6.0.0` |
| `packages/importers/package.json` | `@types/papaparse` | `5.5.2` |
| `packages/storage/package.json` | `dexie` | `4.4.6` |
| `packages/storage/package.json` | `fake-indexeddb` | `6.2.5` |
| `packages/ui/package.json` | `lucide-react` | `1.49.0` |
| `packages/ui/package.json` | `react` | `19.3.0` |
| `packages/ui/package.json` | `vitest` | `5.0.3` |
| `apps/desktop/package.json` | `@tauri-apps/api` | `2.12.0` |
| `apps/desktop/package.json` | `react` | `19.3.0` |
| `apps/desktop/package.json` | `react-dom` | `19.3.0` |
| `apps/desktop/package.json` | `@tauri-apps/cli` | `2.12.0` |
| `apps/desktop/package.json` | `@vitejs/plugin-react` | `6.1.1` |
| `apps/desktop/package.json` | `vite` | `8.3.1` |
| `apps/server/package.json` | `fastify` | `5.12.5` |
| `apps/web/package.json` | `react` | `19.3.0` |
| `apps/web/package.json` | `react-dom` | `19.3.0` |
| `apps/web/package.json` | `@vitejs/plugin-react` | `6.1.1` |
| `apps/web/package.json` | `vite` | `8.3.1` |
| `Cargo.toml workspace` | `serde` | `=1.0.229` |
| `Cargo.toml workspace` | `serde_json` | `=1.0.151` |
| `Cargo.toml workspace` | `uuid` | `=1.27.0` |
| `Cargo.toml workspace` | `uniffi` | `=0.32.2` |
| `Cargo.toml workspace` | `wasm-bindgen` | `=0.2.129` |
| `crates/finance-types` / `crates/finance-bindings` | `tsify` (optional, json-Feature) | `=0.5.8` |
| `crates/finance-bindings` | `js-sys` (optional) | `=0.3.106` |
| `Tauri Cargo.toml` | `tauri` | `=2.12.1` |
| `Tauri Cargo.toml` | `rusqlite` | `=0.40.2` |
| `Tauri Cargo.toml` | `serde` | `=1.0.229` |
| `Tauri Cargo.toml` | `serde_json` | `=1.0.151` |
| `Tauri Cargo.toml` | `sha2` | `=0.11.0` |
| `Tauri Cargo.toml` | `base64` | `=0.23.1` |
| `Tauri Cargo.toml` | `tauri-plugin-dialog` | `=2.8.1` |
| `Tauri Cargo.toml` | `tauri-plugin-opener` | `=2.7.0` |
| `Tauri Cargo.toml` | `url` | `=2.5.8` |
| `Tauri Cargo.toml` | `tempfile` | `=3.27.0` |
| `Tauri Cargo.toml` | `wimm-finance-core` | `../../../crates/finance-core` |
| `Tauri Cargo.toml` | `wimm-finance-types` | `../../../crates/finance-types` |
| `Tauri Cargo.toml` | `wimm-client-application` | `../../../crates/client-application` |
| `Tauri Cargo.toml` | `wimm-client-crypto` | `../../../crates/client-crypto` |
| `Tauri Cargo.toml` | `wimm-local-dal` (sqlite) | `../../../crates/local-dal` |
| `Tauri build` | `tauri-build` | `=2.7.1` |

## Zielbibliotheken und offene Nachweise

Diesel ist bevorzugter ORM-Kandidat, SeaQuery zuerst zu prüfende Schema-DSL, Axum/Tokio bestätigtes Serverziel. Sie sind noch keine Produktabhängigkeiten dieses Auftrags. Dokumentation zu SQLite/WASM belegt kein konkretes dauerhaftes WiMM-VFS. Generatoren und native/WASM-libsodium-Bindings benötigen Safe-Code-/Interop-/Herkunftsprüfung. Der Serverstub enthält noch Fastify; der lokale Bestand Dexie/rusqlite. [Review](architecture-review.md), [Architektur](architecture.md), [Freigaben](tasks.md).

Vollständiges maschinenlesbares Herkunftsregister muss direkte/transitive Auflösung, SPDX/Lizenztexte, NOTICE, Upstream/Commit und lokale Fremdcodeänderungen erfassen. Keine unbewiesene vollständige Lizenz- oder Sicherheitsabnahme aus dieser Manifesttabelle ableiten.
