# Gemeinsame Verträge

AGPL-3.0-or-later. Das Paket enthält plattformfreie Formschemas, Datentypen und Ports für öffentliche E2EE-Hüllen, vorhandene Finanzaggregate, Rust-/WASM-/native Fachbindings und getrennte Anwendungs-/Speichergrenzen. Es berechnet keine Finanzwerte, verwendet keine UI/HTTP/Datenbank und importiert keinen Fachkern.

Die K01-Verträge in `finance-engine.ts` beschreiben vorhandene Befehle, vollständige Ergebnisse, Gegenbefehle, Projektionen, historische/Mutationvalidierung und pure Import-/Regel-/Dauerzahlungsvorschläge. `application-ports.ts` trennt Profilpersistenz, lokale Finanzspeicherung, verschlüsselte Sicherung und gemeinsame öffentliche Servertransaktionen. Bestehende Produktports verwenden bereits dieselben generischen Profil-/Storage-/Snapshotverträge; die Rust-Fachgrundlage aus K03/K04 ist vorhanden; produktive Umschaltung und neue gemeinsame Rust-Anwendungsports bleiben offen.

`pnpm test:contracts`, `pnpm typecheck:contracts` (ES2025 ohne DOM-/Node-Typglobals), `pnpm typecheck` und `pnpm check:package-graph` prüfen Form-/Grenz-/Serialisierungsverträge und Abhängigkeiten. [Sprachübergreifende Spezifikation](../../docs/core-contracts.md), [Implementierungsauftrag und Voraussetzungen #91](https://github.com/mpwg/WiMM/issues/91). Bindingversion, Finanzschema, Storageversion, Sync-Epoche und Exportformat werden getrennt behandelt. Vertragsprüfungen ersetzen keine tatsächlichen Binding-, Datenbank- oder Plattformabnahmen.

## Architekturstand vom 9. Oktober 2026

Bestand und Ziel sind getrennt: [gemeinsame Rust-Architektur](../../docs/architecture.md). Hier dokumentierte Funktionen und Arbeitsregeln beziehen sich auf den Bestand; neue Rust-Anwendungs-/DAL-/Serverumstellung ist noch nicht implementiert. Aktuelle Aufträge und Kriterien in tasks.md/GitHub; historische Belege ersetzen keine Zielabnahme.
