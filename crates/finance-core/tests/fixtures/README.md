# Gesperrter synthetischer Fachkatalog

SPDX-License-Identifier: AGPL-3.0-or-later

contract-catalog.json enthält ausschließlich synthetische Ein-/Ausgaben der vorhandenen TypeScript-Fachreferenz. Native Rust-Integrationstests vergleichen Werte, vollständige Änderungsmengen, Projektionen und Fehler selbst, ohne Node/Browser oder erwartete Antworten eines externen Prozesses. Der technische Primitive-/Roundtripteil läuft zusätzlich mit contract-probe; direkte Rust-Geld-/Kalendertests laufen auch ohne dieses Feature.

Der bestehende TypeScript-Generator prüft die Gleichheit mit diesem gesperrten Katalog. Änderungen verlangen ausdrücklich `pnpm exec tsx tests/core-bindings/generate-cases.ts --update-rust-fixtures`, eine Prüfung des Golden-Diffs und erneute Rust-/Bindingabnahme. Reguläre Prüfungen schreiben keine Sollfixtures um. Herkunft: eigener freigegebener K04-Auftrag, bestehender TypeScript-Fachkern und F01/F02/F03-/P5-/CAS-Sollfälle. Keine realen Finanzdaten, Schlüssel oder Codekopien.

`generator-context-regression.json` ist der eigenständige synthetische Defektkatalog für [#128](https://github.com/mpwg/WiMM/issues/128): acht ungültige UTC-Generatorzeiten ohne Änderungsmenge und zwei gültige Zeitpunkte mit exakter Rückgabe einschließlich Sekundenbruchteilen. Ein eigener nativer Rust-Integrationstest und alle fünf tatsächlichen Sprach-/Browserlaufzeiten verwenden dieselben zehn Fälle. Der Generator ergänzt sie erst nach erfolgreichem Vergleich des unveränderten historischen K04-Katalogs; dessen Sollfälle bleiben getrennt und werden nicht überschrieben.

Die negativen Requests sind rohe JSON-Zeichenketten und rufen auch im Browser das Rust-WASM-Binding direkt auf. Eine vorherige Zod-Ablehnung würde keinen Rust-Nachweis liefern. Die gültigen Browserfälle verwenden weiterhin den vorhandenen geprüften TypeScript-Bindingadapter; dessen Eingabevalidierung bleibt unverändert.

## Architekturstand vom 9. Oktober 2026

Bestand und Ziel sind getrennt: [gemeinsame Rust-Architektur](../../../../docs/architecture.md). Hier dokumentierte Funktionen und Arbeitsregeln beziehen sich auf den Bestand; neue Rust-Anwendungs-/DAL-/Serverumstellung ist noch nicht implementiert. Aktuelle Aufträge und Kriterien in tasks.md/GitHub; historische Belege ersetzen keine Zielabnahme.
