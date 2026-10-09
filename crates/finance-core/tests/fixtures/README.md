# Gesperrter synthetischer Fachkatalog

SPDX-License-Identifier: AGPL-3.0-or-later

contract-catalog.json enthält ausschließlich synthetische Ein-/Ausgaben der vorhandenen TypeScript-Fachreferenz. Native Rust-Integrationstests vergleichen Werte, vollständige Änderungsmengen, Projektionen und Fehler selbst, ohne Node/Browser oder erwartete Antworten eines externen Prozesses. Der technische Primitive-/Roundtripteil läuft zusätzlich mit contract-probe; direkte Rust-Geld-/Kalendertests laufen auch ohne dieses Feature.

Der bestehende TypeScript-Generator prüft die Gleichheit mit diesem gesperrten Katalog. Änderungen verlangen ausdrücklich `pnpm exec tsx tests/core-bindings/generate-cases.ts --update-rust-fixtures`, eine Prüfung des Golden-Diffs und erneute Rust-/Bindingabnahme. Reguläre Prüfungen schreiben keine Sollfixtures um. Herkunft: eigener freigegebener K04-Auftrag, bestehender TypeScript-Fachkern und F01/F02/F03-/P5-/CAS-Sollfälle. Keine realen Finanzdaten, Schlüssel oder Codekopien.

## Architekturstand vom 9. Oktober 2026

Bestand und Ziel sind getrennt: [gemeinsame Rust-Architektur](../../../../docs/architecture.md). Hier dokumentierte Funktionen und Arbeitsregeln beziehen sich auf den Bestand; neue Rust-Anwendungs-/DAL-/Serverumstellung ist noch nicht implementiert. Aktuelle Aufträge und Kriterien in tasks.md/GitHub; historische Belege ersetzen keine Zielabnahme.
