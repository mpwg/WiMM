# Rust-/WASM-/Swift-/Kotlin-Bindings

AGPL-3.0-or-later für eigene Quellen. Diese Bibliothek bindet den unabhängigen Rust-Kern über etablierte wasm-bindgen- und UniFFI-Generatoren an. Direktversionen und das vollständige Cargo-Lockfile sind gesperrt; ursprüngliche Drittanbieter-Lizenzen stehen im [Herkunftsregister](../../docs/dependency-provenance/rust-core.json). Generierte Fremdsprachenquellen werden unverändert unter test-results erzeugt und mit aktivem Compiler-Warnungsfehler geprüft.

`native` und `wasm` wählen die Bindings, nicht verschiedene Fachimplementierungen. Die vorhandenen K04-Bindings umfassen `execute_json`, `calculate_json`, `reverse_json`, `project_json` und `validate_json` für die implementierten Fachfunktionen. `contract-probe` ergänzt technische Transport-/Primitive-/Cachefälle. Produktintegration und gemeinsame Rust-Anwendungs-/Crypto-/DAL-Bindings bleiben eigene Zielaufgaben.

`pnpm test:core:bindings` erzeugt aus der echten nativen Bibliothek Swift-/Kotlin-Code, kompiliert die minimalen Harnesses und vergleicht denselben synthetischen Katalog mit nativer Rust-, tatsächlicher WASM-/Node- und Browserausführung. Swift benutzt die generierte C-Modulemap und dieselbe dynamische Bibliothek; Kotlin/JVM lädt sie tatsächlich über die geprüfte JNA-5.18.0-Testabhängigkeit. Deren gesperrter SHA256 wird vor Nutzung geprüft. Compiler werden nicht durch Mocks oder generierte Dateien allein ersetzt.

Der vollständige Sprachlauf benötigt vorhandene Swift-/Kotlin-/Java-Werkzeuge; WIMM_SWIFTC/WIMM_KOTLINC/WIMM_JAVA können Pfade setzen. Der Java-Standardpfad des macOS-arm64-Belegs ist die lokale Homebrew-JDK-21-Installation. Andere Zielumgebungen setzen WIMM_JAVA. `pnpm test:core:wasm` bezeichnet ausdrücklich den Rust-/WASM-/Browserteil und ist in regulärer Prüfkette/Ubuntu-CI aufgenommen; es behauptet keinen Swift-/Kotlin-CI-Lauf.

Generatorgrundlagen: [UniFFI-Procedural-Macros und Sprachcode](https://mozilla.github.io/uniffi-rs/latest/tutorial/foreign_language_bindings.html), [wasm-bindgen für wasm32-unknown-unknown](https://wasm-bindgen.github.io/wasm-bindgen/reference/rust-targets.html). Kein neuer eigener Kryptocode, keine neue native Produktoberfläche und keine echte Geräte-/GUI-/Screenreaderabnahme aus dem K03-Harness.

## Architekturstand vom 9. Oktober 2026

Bestand und Ziel sind getrennt: [gemeinsame Rust-Architektur](../../docs/architecture.md). Hier dokumentierte Funktionen und Arbeitsregeln beziehen sich auf den Bestand; neue Rust-Anwendungs-/DAL-/Serverumstellung ist noch nicht implementiert. Aktuelle Aufträge und Kriterien in tasks.md/GitHub; historische Belege ersetzen keine Zielabnahme.
