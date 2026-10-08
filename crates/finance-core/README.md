# Plattformfreier Rust-Fachkern

AGPL-3.0-or-later. Die Bibliothek liegt unabhängig vom Tauri-Appcrate und enthält keine UI, Datenbank, HTTP, Systemzeit oder Zufallsquelle. Unsicherer eigener Rust-Code ist per Compiler verboten. K03 weist zunächst den vorhandenen Fachbefehl `rule.reorder` sowie exakte Dezimaltext-/Centverarbeitung nach; die vollständige Migration der vorhandenen Finanzregeln bleibt K04.

Native Rust-, WASM-, Swift- und Kotlin-Aufrufe verwenden dieselbe Bibliothek und den [K01-JSON-Vertrag](../../docs/core-contracts.md). Es gibt keine neue produktive Engineaktivierung; die bisherige TypeScript-Engine bleibt bis K05 im Produkt. `contract-probe` ergänzt ausschließlich den technischen Feldtransporttest und ist kein Produktport.

`pnpm check:core` prüft Architektur, Rustformat, Clippy mit Warnungen als Fehler und Kern-/Workspace-Tests. `pnpm test:core:wasm` baut tatsächliches WASM, vergleicht es und native Rust-Ausführung mit den vorhandenen TypeScript-Sollfällen und prüft denselben Katalog in Chromium. `pnpm test:core:bindings` erzeugt und kompiliert zusätzlich echte Swift-/Kotlin-Bindings und führt sie aus. Voraussetzung: Swift 6, Kotlin/JDK 21 und die Rusttoolchain mit wasm32-unknown-unknown. Die optionalen Variablen WIMM_SWIFTC, WIMM_KOTLINC und WIMM_JAVA wählen vorhandene Werkzeuge; fehlende Werkzeuge führen zu Fehler statt einer Ersatzabnahme.

[Bindingwrapper und Sprachnachweis](../finance-bindings/README.md), [gesperrte Herkunfts-/Lizenzdaten](../../docs/dependency-provenance/rust-core.json), [K03-Issue #94](https://github.com/mpwg/WiMM/issues/94). Neue P6–P11-Funktionen und Cryptoformatänderungen gehören nicht zu dieser technischen Grundlage.
