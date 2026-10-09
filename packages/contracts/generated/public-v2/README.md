# Generierte öffentliche Verträge — Binding V2 / Protokoll V1

Eigene Rust-Quelle AGPL-3.0-or-later, eingebettete Generatorhinweise/Lizenzen unverändert. [Öffentliche Rust-Typquelle](../../../../crates/public-contracts/README.md) und vorhandene gesperrte Schemars-/UniFFI-/Tsify-/wasm-bindgen-Generatoren; keine neue Fremdversion. Keine privaten Fach-/Schlüsselmodelle.

Native Modelle liegen in WiMMPublicTypes bzw. org.wimm.publiccontracts und werden gemeinsam mit der tatsächlichen Clientbibliothek kompiliert. Die TypeScript-Formen entstehen zusätzlich aus einer eigenständigen öffentlichen WASM-Bibliothek ohne Fachkernabhängigkeit. schema/manifest.json benennt die öffentlichen Formeinstiege, Protokoll-/Bindingdimensionen sowie erforderliche zusätzliche relationale Rust-Validierung. Standard-JSON-Schema allein ersetzt diesen Guard nicht.

`pnpm generate:contracts:bindings`/`pnpm check:contracts:generated` erzeugen/vergleichen private und öffentliche Module getrennt. Ein ausdrücklich benanntes privates Ausgabeverzeichnis verwendet public-v2 als Geschwisterverzeichnis. Es wird ausschließlich Editorformat normalisiert; keine zweite Feldliste, kein eigener Fremdsprachgenerator und keine Produktumschaltung. Tatsächliche Nachweise: `pnpm test:contracts:public` und `pnpm test:contracts:public:native`; Grenzen im Rust-README und [AR02-Snapshot](../../../../docs/ar02-contract-generation.md).

Öffentliche Serverportdaten (Ciphertextheads, Receipts, verschlüsselte Snapshot-/Change-Records und Identitäten) ergänzen die vollständige gemeinsame öffentliche Typquelle. 13 Formschemas; weiterhin kein privater Fach-/Schlüsseltyp im öffentlichen Defaultgraph.
