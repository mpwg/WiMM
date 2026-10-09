# TypeScript-Wrapper für den gemeinsamen Rust-Kern

AGPL-3.0-or-later. Der vorhandene JSON-Wrapper validiert K01-Requests und Rust-Results, transportiert JSON zum injizierten tatsächlichen Binding und prüft die Rückbindung von Operations-ID, Bereich, Befehlsart und Zeitpunkt. Er enthält keine Finanzberechnung, React, DOM, Worker, Tauri, HTTP oder Datenbankabhängigkeit.

Die asynchrone Oberfläche gilt für WASM und native Aufrufe. createJsonReferenceEngine kapselt den kleinen Probeumfang, createJsonFinanceEngine den vollständigen execute/calculate/project/validate/reverse-Port. Die Wrapper sind vorhanden, produktive Anwendungsintegration und neue generierte Ports bleiben offen. `pnpm test:core:wrapper` prüft falsche/unsichere Eingaben und Bindingantworten; `pnpm test:core:bindings` und `pnpm test:core:wasm` liefern tatsächliche Sprach-/WASM-Nachweise. [K01-Vertrag](../../docs/core-contracts.md), [Rust-/Bindinggrundlage](../../crates/finance-bindings/README.md).

## Architekturstand vom 9. Oktober 2026

Bestand und Ziel sind getrennt: [gemeinsame Rust-Architektur](../../docs/architecture.md). Hier dokumentierte Funktionen und Arbeitsregeln beziehen sich auf den Bestand; neue Rust-Anwendungs-/DAL-/Serverumstellung ist noch nicht implementiert. Aktuelle Aufträge und Kriterien in tasks.md/GitHub; historische Belege ersetzen keine Zielabnahme.
