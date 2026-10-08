# Plattformfreier Rust-Fachkern

AGPL-3.0-or-later. Die Bibliothek implementiert sämtliche bestehenden Finanzregeln und K01-Fachengineaktionen unabhängig von UI, Datenbank, HTTP, Systemzeit und Zufall. Geld und Zwischenwerte verwenden geprüfte ganze Cent. Uhr/IDs werden explizit übergeben; Speicherung bleibt getrennt. Globales unsafe-Verbot gilt zusätzlich an jedem eigenen Einstieg.

`execute_json`, `reverse_json`, `calculate_json`, `project_json` und `validate_json` bilden die vollständigen K01-Verträge ab. Native Rust-, WASM-, Swift- und Kotlin-Aufrufe verwenden dieselbe Bibliothek. `contract-probe` ergänzt ausschließlich technische Primitive-, Transport- und Cacheprüfungen. Die bisherige TypeScript-Produktengine bleibt bis zur K05-Abnahme aktiv; sie dient auch als gesperrte Vergleichsreferenz.

`pnpm check:core` prüft Architektur, globale unsafe-Sperren, Format, Clippy und native Rusttests. `cargo test --locked -p wimm-finance-core` prüft die produktiven Verträge ohne Node/Browser. Der Workspace prüft den gesamten statischen synthetischen Katalog mit Rust-Assertions. `pnpm test:core:wasm` ergänzt echte WASM-/Chromium-Aufrufe; `pnpm test:core:bindings` erzeugt/kompiliert/ruft auch Swift und Kotlin tatsächlich auf. Fehlende Werkzeuge sind kein Ersatzbeleg. Golden-Änderungen verlangen ausdrückliche Regeneration und erneute Abnahme.

[Abnahme und Testfamilienmatrix](../../docs/handoffs/k04-2026-10-08.md), [K01-Verträge](../../docs/core-contracts.md), [Herkunft/Lizenzen](../../docs/dependency-provenance/rust-core.json), [#95](https://github.com/mpwg/WiMM/issues/95). Keine zusätzliche P6–P11-Funktion, Cryptoänderung oder Produktoberfläche.
