# Browser-Rust-Laufzeit — DAL04-Grundlage

SPDX-License-Identifier: AGPL-3.0-or-later

Plattformadapter auf demselben vollständigen SQLite-DAL wie Tauri. `StorageHost` nimmt bereits tatsächlich geöffnete Diesel-Verbindungen und die gemeinsamen typisierten V2-Portrequests an; keine eigene Finanz- oder Speicherimplementierung. Der gemeinsame `CoreSnapshotValidator` liegt in der Rust-Clientanwendung und delegiert Finanz-/Cacheprüfungen ausschließlich an den Fachkern.

WASM installiert den gesperrten OPFS-SAHPool-VFS ohne clear_on_init. Eine echte VFS-Existenzprüfung trennt ausschließlich frische Initialisierung und Wiederöffnung. Der Datenbankname und das OPFS-Verzeichnis sind fest, Benutzerparameter enthalten keine Pfade oder SQL. Unbekannte bestehende Dateien werden kontrolliert abgewiesen; kein Memory-/IndexedDB-Fallback. Alle elf lokalen Ports und die begrenzten Index-/Commit-/Receiptlookup-Einstiege sind typisiert aus Rust abgeleitet. Kein V1-JSON-ABI-Adapter.

Der Dedicated Worker in browser-adapters hält genau eine profilgebundene Verbindung. Ein tabübergreifender Web Lock umfasst deren gesamte tatsächliche Lebensdauer; wartende Tabs bekommen Status waiting. Schließen gibt zuerst SQLite, dann tatsächliche OPFS-Handles und schließlich den Web Lock frei. Worker-/Antwortverlust bleibt unknown; keine automatische Wiederholung finanzieller Writes. Maximal 64 gleichzeitig wartende RPCs; Nachrichtenfrist 30 Sekunden, anschließend Workerabbruch und Freigabe.

```sh
cargo test --locked -p wimm-browser-runtime
cargo clippy --locked -p wimm-browser-runtime --all-targets -- -D warnings
cargo clippy --locked -p wimm-browser-runtime --target wasm32-unknown-unknown -- -D warnings
pnpm build:browser:runtime
node scripts/test-browser-runtime-drift.mjs
pnpm test:storage:browser:rust
```

Rust-generierte d.ts-Signaturen werden versioniert und vor jeder normalen Erzeugung ohne Umschreiben verglichen; explizite Neuerzeugung nur mit --write. JS/WASM sind ignorierte reproduzierbare Buildprodukte. Die Rolle platform im Architekturvalidator erhält keine Ausnahme von Kern-/Server-/unsafe-Grenzen. Native Assertions benutzen tatsächliche SQLite-Dateien und Neuöffnen, keinen Memoryersatz.

Aktuelle Abnahme ist ein Abschnitt in [#109](https://github.com/mpwg/WiMM/issues/109), keine vollständige Produktumschaltung. Die produktiven React-Controller sind noch nicht auf diesen Worker umgestellt. Rust-Anwendungs-/Recovery-/Checkpoint-/Sicherungs-/Offline-/Persistenz-/Quota-/Leistungsintegration und sämtliche verlangten Browserbelege bleiben offen. [Aktuelle Matrix](../../docs/dal04-browser.md), [Legacybereinigung #146](https://github.com/mpwg/WiMM/issues/146).
