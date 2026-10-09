# Plattformfreier Rust-Fachkern

AGPL-3.0-or-later. Die Bibliothek implementiert sämtliche bestehenden Finanzregeln und K01-Fachengineaktionen unabhängig von UI, Datenbank, HTTP, Systemzeit und Zufall. Geld und Zwischenwerte verwenden geprüfte ganze Cent. Uhr/IDs werden explizit übergeben; Speicherung bleibt getrennt. Globales unsafe-Verbot gilt zusätzlich an jedem eigenen Einstieg.

`execute_json`, `reverse_json`, `calculate_json`, `project_json` und `validate_json` bilden die vollständigen K01-Verträge ab. Native Rust-, WASM-, Swift- und Kotlin-Aufrufe verwenden dieselbe Bibliothek. `contract-probe` ergänzt ausschließlich technische Primitive-, Transport- und Cacheprüfungen. Die bisherige TypeScript-Produktengine bleibt bis zur K05-Abnahme aktiv; sie dient auch als gesperrte Vergleichsreferenz.

`pnpm check:core` prüft Architektur, globale unsafe-Sperren, Format, Clippy und native Rusttests. `cargo test --locked -p wimm-finance-core` prüft die produktiven Verträge ohne Node/Browser. Der Workspace prüft den gesamten statischen synthetischen Katalog mit Rust-Assertions. `pnpm test:core:wasm` ergänzt echte WASM-/Chromium-Aufrufe; `pnpm test:core:bindings` erzeugt/kompiliert/ruft auch Swift und Kotlin tatsächlich auf. Fehlende Werkzeuge sind kein Ersatzbeleg. Golden-Änderungen verlangen ausdrückliche Regeneration und erneute Abnahme.

[Abnahme und Testfamilienmatrix](https://github.com/mpwg/WiMM/blob/84d730cc6e10d70cf6ac6ff9bc28c4a9c4376e92/docs/handoffs/k04-2026-10-08.md), [K01-Verträge](../../docs/core-contracts.md), [Herkunft/Lizenzen](../../docs/dependency-provenance/rust-core.json), [#95](https://github.com/mpwg/WiMM/issues/95). Keine zusätzliche P6–P11-Funktion, Cryptoänderung oder Produktoberfläche.

## Architekturstand vom 9. Oktober 2026

Bestand und Ziel sind getrennt: [gemeinsame Rust-Architektur](../../docs/architecture.md). Hier dokumentierte Funktionen und Arbeitsregeln beziehen sich auf den Bestand; neue Rust-Anwendungs-/DAL-/Serverumstellung ist noch nicht implementiert. Aktuelle Aufträge und Kriterien in tasks.md/GitHub; historische Belege ersetzen keine Zielabnahme.


## AR01 — schrittweise Typisierung

`scalars` enthält geschützte Cent-, Erwartungs-/Speicherrevisionen, UUIDs, Kalenderdaten, UTC-Zeitpunkte, nichtleere Texte, Hashes, Ordinalwerte und begrenzte Listen. Konstruktoren und Deserialisierung prüfen dieselben Grenzen. `Revision` erlaubt null als Neuanlageerwartung; `StoredRevision` beginnt bei eins. UUID-Schreibweise und Zeitstempelpräzision bleiben erhalten. JSON-Zahlformen `1.0`/`1e3` bleiben als Grenzkonvertierung kompatibel, ohne Gleitkomma-Geldarithmetik.

`models` beschreibt alle 14 bestehenden Aggregatarten und 22 Fachbefehle samt Splits, Importzeilen, Regeln und Dauerzahlungsvorlagen. Der Laufzeit-Formvalidator des Bestands verwendet diese Modelle; die frühere stringbasierte Feldliste wird ausschließlich als gesperrte Testreferenz mit Herkunftscommit unter `tests/support` gebaut. Optionale Felder weisen vorhandenes `null` ab; das erforderliche nullable Kandidatenfeld einer Importzeile behält dagegen `null`. Importmappings bleiben gemäß V1 ein opakes JSON-Payload. Es werden keine neuen Produktaggregate eingeführt.

Konto-/Verbrauchsprojektionen, ihre Ergebnisse und die Cacheprüfung sind intern typisiert. Die vollständige historische Bestandsprüfung arbeitet nach einer Grenzdeserialisierung mit Rust-Aggregaten: Bereich/Chronologie, Referenzarten, Transferseiten, Abgleiche, Importfingerprints, Regeln und Dauerzahlungsverknüpfungen. Buchungs-/Stammdatennormalisierung sowie Split-, Regelbedingungs- und Importzeilenprüfung verwenden typisierte Felder. Übergangsadapter konvertieren für die verbleibenden dynamischen Befehls- und Mutationshandler weiterhin JSON; der Abschnitt behauptet weder deren vollständige Umstellung noch optimierte Bereichslesevorgänge.

Direkte Rusttests vergleichen mehr als 1.000 Katalogformen plus Feldmutationen mit der gesperrten V1-Formreferenz und prüfen Feldrücktransport, Null-/Abwesenheitssemantik, sichere Grenzen, F01, Erstattungen, Tombstones und stabile Zwischenwertprüfung. Die vollständigen Sprachkataloge bleiben verpflichtend. [Aktueller Abnahmesnapshot](../../docs/ar01-typing.md), [Auftrag](../../docs/tasks.md), [AR01 #115](https://github.com/mpwg/WiMM/issues/115). AR01 bleibt bis zur vollständigen Handlerumstellung und erneuten Gesamtabnahme offen.
