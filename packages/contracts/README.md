# Gemeinsame Verträge

AGPL-3.0-or-later. Das Paket enthält plattformfreie Formschemas, Datentypen und Ports für öffentliche E2EE-Hüllen, vorhandene Finanzaggregate, Rust-/WASM-/native Fachbindings und getrennte Anwendungs-/Speichergrenzen. Es berechnet keine Finanzwerte, verwendet keine UI/HTTP/Datenbank und importiert keinen Fachkern.

Die K01-Verträge in `finance-engine.ts` beschreiben vorhandene Befehle, vollständige Ergebnisse, Gegenbefehle, Projektionen, historische/Mutationvalidierung und pure Import-/Regel-/Dauerzahlungsvorschläge. `application-ports.ts` trennt Profilpersistenz, lokale Finanzspeicherung, verschlüsselte Sicherung und gemeinsame öffentliche Servertransaktionen. Bestehende Produktports verwenden bereits dieselben generischen Profil-/Storage-/Snapshotverträge; eine produktive Rust-Engine folgt erst nach K03–K05.

`pnpm test:contracts`, `pnpm typecheck:contracts` (ES2025 ohne DOM-/Node-Typglobals), `pnpm typecheck` und `pnpm check:package-graph` prüfen Form-/Grenz-/Serialisierungsverträge und Abhängigkeiten. [Sprachübergreifende Spezifikation](../../docs/core-contracts.md), [Implementierungsauftrag und Voraussetzungen #91](https://github.com/mpwg/WiMM/issues/91). Bindingversion, Finanzschema, Storageversion, Sync-Epoche und Exportformat werden getrennt behandelt. Vertragsprüfungen ersetzen keine tatsächlichen Binding-, Datenbank- oder Plattformabnahmen.
