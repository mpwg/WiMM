# Rust-Vertragsschemas

SPDX-License-Identifier: AGPL-3.0-or-later

AR02-Prototyp für [#116](https://github.com/mpwg/WiMM/issues/116). Schemars 1.2.2 erzeugt die privaten Aggregat-/Befehls-/Requestschemaformen direkt aus den vorhandenen Rust-Modellen und Serde-Metadaten. Das optionale Kernfeature `contract-schema` ist eine plattformfreie Entwicklungsabhängigkeit; die vorhandenen produktiven nativen/WASM-Bindings benötigen es nicht. Eigener Werkzeugcode bleibt unsafe-frei und erbt die Workspace-Sperre.

```sh
cargo run --locked -p wimm-contract-schema -- --write test-results/architecture-implementation/schema-proof
cargo run --locked -p wimm-contract-schema -- --check test-results/architecture-implementation/schema-proof
cargo test --locked -p wimm-contract-schema
cargo test --locked -p wimm-finance-core --features contract-schema schema::tests
```

`--write` erzeugt die drei Dateien im ausdrücklich benannten Verzeichnis. `--check` vergleicht exakte reproduzierte Inhalte ohne Dateien zu überschreiben; fehlende oder geänderte Dateien führen zu einem Fehlerstatus. Ohne Argumente wird der Export auf stdout angezeigt. Es wird kein Produktbestand geöffnet, geschrieben oder migriert.

Geprüft: deterministische Generierung, bestehende Serde-Feldnamen/Tags, ausgeschlossene Zusatzfelder, sichere Ganzzahlgrenzen, optionale nichtnullable Felder und erforderliches nullable Importkandidatenfeld. Der Werkzeugtest verändert ausschließlich eine eigene synthetische Schemafixture und belegt Driftablehnung ohne Reparatur. Kriterien sind noch kein vollständiger Sprach-/Formvalidierungsnachweis: TypeScript-/Swift-/Kotlin-Generierung, öffentliche/lokale Vertragsmodule, Versions-/Fehlerformen, CI-Integration und der vollständige positive/negative Schema-/Bindingkatalog folgen innerhalb #116. Die native Bindingvariante wird mit dem Nutzer geklärt; bisherige ABI bleibt bis dahin unverändert.

Schemars berücksichtigt Serde-Tags und Feldattribute; Formgrenzen für geprüfte Skalare bleiben aus Rusttypen und gemeinsamen Konstanten beschrieben. [Offizielle Schemars-Attribute](https://graham.cool/schemars/deriving/attributes/). [Auftrag](../../docs/tasks.md), [Architektur](../../docs/architecture.md). Projektlizenz bleibt AGPL-3.0-or-later; Schemars und Fremdhinweise behalten ihre ursprünglichen Lizenzen.
