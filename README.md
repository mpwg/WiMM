# WiMM — WhereIsMyMoney

Offlinefähige Finanzplanung für private Bereiche und gemeinsame Haushalte: Buchungen, Budgets und Familienausgleich mit sicheren Cent, expliziter Privatheit und verpflichtender Ende-zu-Ende-Verschlüsselung. Eigene Pakete und Quelldateien: **AGPL-3.0-or-later**; [Lizenz](LICENSE.md), Fremdhinweise erhalten.

## Architektur und Umsetzung

Das bestätigte Ziel ist eine gemeinsame Rust-Basis für Fachkern, Clientanwendung und lokalen DAL sowie ein eigenständiger öffentlicher Axum/Tokio-Server. React/PWA und Tauri bleiben Oberflächen; später native Oberflächen nutzen dieselben Abläufe. Lokal SQLite nativ/WASM, Server SQLite/PostgreSQL/MySQL. [Detaillierter Review](docs/architecture-review.md), [verbindliche Architektur](docs/architecture.md), [Entscheidungen](docs/decisions.md), [Gesamtübersicht #114](https://github.com/mpwg/WiMM/issues/114).

Der Bestand ist noch TypeScript/React mit Dexie/IndexedDB, katalogisierter Rust/rusqlite-Desktopbrücke und Fastify-Health-/Metadatenstub. Die unabhängige Rust-Fachengine und reale Sprachbindinggrundlage sind vorhanden; produktive Umschaltung, Rust-Anwendung, ORM-/Browser-SQLite und Rust-Server bleiben offen. P1–P5 sind nicht vollständig abgenommen. [Aufgaben/Freigaben](docs/tasks.md), [Belege](docs/review-evidence.md).

## Entwicklung

Alle Arbeiten in dieser aktiven Arbeitskopie. [AGENTS.md](AGENTS.md), [Einstieg](docs/getting-started.md), [Entwicklung](docs/development.md), [tatsächliche Versionsbasis](docs/technology-baseline.md) lesen. Keine Finanz-/Schlüssel-/Serverklartexte im Repository.

```sh
pnpm install --frozen-lockfile
pnpm dev:web
pnpm dev:desktop
pnpm dev:server
```

Die Entwicklungsstarts sind Alternativen; `dev:server` startet den vorhandenen Fastify-Stub, keinen bereits implementierten Rustserver. Voraussetzungen und Zielgrenzen stehen in den verlinkten Anleitungen.

## Prüfung

```sh
pnpm check:docs
pnpm test:docs
pnpm check:package-graph
pnpm check:application
pnpm check:core:architecture
pnpm check:ci
```

Gezielte native Rust-/SQLite-, Browser-, Migrations-, Binding-, Offline- und UIbefehle stehen in [Entwicklung](docs/development.md). Vollständige Kriterien in [Tests](docs/testing.md) und [Abnahmekatalog](docs/acceptance-catalog.md). Desktopfrontend-IndexedDB ist kein nativer Tauri-Nachweis; Memory/Mock und historische Greens ersetzen keine reale Plattformabnahme.

## Produkt und Dokumentation

[Dokumentationsindex](docs/README.md), [Produkt](docs/product.md), [Fachmodell](docs/domain.md), [E2EE](docs/encryption.md), [Formate](docs/formats.md), [UI](docs/ui.md), [Betrieb](docs/operations.md). Budget-/Familien-/Server-/Sync-/Backup-/Releasepakete sind spezifiziert; ihre Implementierungsfreigaben stehen ausschließlich in tasks.md. Fehlende Zielsysteme/Secrets blockieren nur die betroffene Abnahme/Distribution.

Releases und Serveroberflächen müssen den exakt zugehörigen Quellcode samt Buildskripten, gesperrten Abhängigkeiten und Lizenz-/Fremdhinweisen anbieten. Architektur-/Paketabschluss ist kein Releaseauftrag.
