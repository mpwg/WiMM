# TypeScript-Wrapper für den gemeinsamen Rust-Kern

AGPL-3.0-or-later. Der K03-Referenzwrapper validiert K01-Requests und Rust-Results, transportiert JSON zum injizierten tatsächlichen Binding und prüft die Rückbindung von Operations-ID, Bereich, Befehlsart und Zeitpunkt. Er enthält keine Finanzberechnung, React, DOM, Worker, Tauri, HTTP oder Datenbankabhängigkeit.

Die asynchrone Oberfläche gilt für WASM und native Aufrufe. Aktuell ist der K03-Referenzumfang implementiert; die vollständige produktive FinanceEnginePort-Anbindung folgt in K04/K05. `pnpm test:core:wrapper` prüft falsche/unsichere Eingaben und Bindingantworten; `pnpm test:core:bindings` und `pnpm test:core:wasm` liefern tatsächliche Sprach-/WASM-Nachweise. [K01-Vertrag](../../docs/core-contracts.md), [Rust-/Bindinggrundlage](../../crates/finance-bindings/README.md).
