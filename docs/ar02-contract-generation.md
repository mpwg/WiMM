# AR02 — gemeinsame Vertragsgenerierung

Stand: 9. Oktober 2026. Abschnittssnapshot zu [#116](https://github.com/mpwg/WiMM/issues/116), nach abgeschlossener [AR01-Abnahme](ar01-typing.md). AR02 ist in Arbeit; keine vollständige Generierungs-/Binding-/Formvalidierungsabnahme. Umfang und Freigabe in [Aufgaben](tasks.md), Abhängigkeiten ausschließlich in [#114](https://github.com/mpwg/WiMM/issues/114).

## Geprüfter Schemaprototyp

Schemars 1.2.2 erzeugt private Aggregat-, Befehls- und Requestsformen aus den vorhandenen Rust-Modellen und ihren Serde-Attributen. Eigener Wrapper [wimm-contract-schema](../tools/contract-schema/README.md) verwendet den etablierten Generator; keine zweite Formfeldliste. Der Schemaprototyp selbst verändert die bestehende ABI nicht. Die inzwischen getroffene Nutzerentscheidung B ist in ADR-053 festgehalten; erster typisierter Bindingabschnitt unten. Schemars unterstützt Serde-Tags, unbekannte Felder und Schemaanpassungen. [Offizielle Attributdokumentation](https://graham.cool/schemars/deriving/attributes/).

Optionale present-Felder bleiben ohne null: Schemaattribute beschreiben ihren vorhandenen Werttyp und erhalten die bestehende Serde-Abwesenheit. Das erforderliche nullable Importkandidatenfeld verwendet einen separaten Schematyp, der eine nullable Kandidatenform beschreibt, ohne das Feld als optional zu markieren. Alle 14 Aggregatarten behalten ihre Tags und gesperrten Zusatzfelder. Sichere Zahlen verwenden gemeinsame Rust-Grenzen; Listenlimits kommen aus den tatsächlichen Const-Generics. Der unbeschränkte Listenname bleibt nativ/WASM-unabhängig. Konstruktoren und Geschäftsinvarianten bleiben im typisierten Kern.

`--write` erzeugt drei private Prototypdateien im benannten Verzeichnis. `--check` reproduziert exakte Inhalte und scheitert bei fehlenden/abweichenden Dateien ohne Umschreiben. Native Tests belegen deterministische Generierung, erforderliches nullable Kandidatenfeld, optionale nichtnullable Felder, Centgrenzen, gesperrte Zusatzfelder und absichtlich verursachte Drift ohne Reparatur. Dies ersetzt noch keinen vollständigen Schema-/Sprach-Negativkatalog oder eine CI-Gesamtabnahme.

## Kriterienmatrix

| Kriterium aus #116 | Status | Abschnittsnachweis |
| --- | --- | --- |
| TS-/Swift-/Kotlin-Verträge reproduzierbar, getrennte öffentliche/lokale/private Module, versionierte Fehler-/Exportformen | offen | Native private Schemaquelle und typisierte private money.parse-Sprachsignaturen vorhanden; vollständige Aktionen und lokale/öffentliche Module fehlen |
| Identische positive/negative Grenz-/Form-/Unicode-/Datums-/Null-/Zahlenfälle | offen | 17 gemeinsame Geldfälle in allen fünf tatsächlichen Laufzeiten, sechs zusätzliche WASM-Versionsfälle; vollständiger Schema-/Bindingvergleich noch auszuführen |
| Absichtlicher Vertragsdrift lässt CI scheitern | erfüllt für V2-Sprachabschnitt; gesamt offen | Versionierte Geldsignaturen, CI-Prüfmodus und tatsächlich injizierte Enumvariante mit Driftablehnung ohne Umschreiben. Vollständige Schema-/Modulabdeckung noch offen |
| README und Herkunft/Lizenzen | erfüllt für Prototyp | [Werkzeug-README](../tools/contract-schema/README.md), [Dependencyregister](dependency-provenance/contract-schema.json); sechs neue Fremdpakete mit Version, Datum, Lizenz und Lockfilechecksumme |

Geprüft in der aktiven Arbeitskopie auf macOS arm64: `cargo test --locked -p wimm-finance-core --features contract-schema schema::tests` (zwei Tests), `cargo test --locked -p wimm-contract-schema` (ein Negativtest), `pnpm check:core` mit nativen Workspace-/Architektur-/unsafe-/Rustfmt-/Clippyprüfungen. Dokumentationsvalidator, Tests und Whitespace. Keine echte Finanz-/Schlüsseldaten, kein Produktbestand oder Datenmigration. Lokaler Log ar02-schema-core.log unter test-results/architecture-implementation. Veröffentlichter Abschnittscommit und Rücklesebelege in #116.

## Kompatibilität und Fortsetzung

Schemars ist eine optionale, plattformfreie Entwicklungsabhängigkeit hinter contract-schema; reguläre Produktbindings benötigen dieses Feature nicht. Projektcode bleibt AGPL-3.0-or-later und unsafe-frei; Fremdlizenzen unverändert. Vor vollständiger AR02-Abnahme öffentliche/lokale/private Vertragsgrenzen, vollständige Versions-/Fehlerformen, alle drei Sprachen, Formsemantik und negativen CI-Drift gemeinsam belegen. Nutzerentscheidung B erlaubt jetzt die typisierte UniFFI-/WASM-Umstellung; Bindingversion 2 ergänzt die weiter erhaltene V1-JSON-ABI, keine stillen Fach-/Crypto-/Storageformatänderungen.

## Erster typisierter V2-Sprachabschnitt

9. Oktober 2026, aktive Arbeitskopie unter CachyOS Linux x86_64. Rust 1.99.0, Swift 6.4 (swift-bin 6.4.0-2), Kotlin 2.4.20, OpenJDK 21.0.12.1, Node 26.10.0, pnpm 12.8.1. Swift-/Kotlin-/Java-Systemwerkzeuge mit ausdrücklicher Nutzerfreigabe installiert; Generatoren und Bibliotheken gemäß vorhandenen Lockfiles unverändert.

`calculate_money_v2` verarbeitet einen generierten Rust-Request ohne JSON-Stringrequest. Native Records und WASM-Klassen entstehen aus derselben Rust-Bindingsquelle. Die Berechnung bleibt im Fachkern; sichere Cent werden nativ als i64 und in WASM ausschließlich nach erfolgreicher Prüfung exakt als number ausgegeben. Ergebnisse tragen Version 2 und eindeutig Geld oder Fehlercode/Meldung. Der explizite Rust-V1-Ausgabeadapter und die bestehenden V1-Einstiege erhalten Finanzschema eins. Keine Datenmigration oder Produktumschaltung.

`pnpm check:core` erfolgreich: native Workspace-/Katalog-/Schema-/DAL-/Bindingassertions, Architektur-/unsafe-Sperren, Rustfmt und Clippy mit Warnungen als Fehler. Zusätzliche WASM-Clippyprüfung erfolgreich. Der V2-Integrationstest prüft 17 positive/negative Geldtexte, beide sicheren Grenzen/Überschreitungen, UUID-Schreibweise/ungültige UUID, Unicode, leeren Text und unbekannte Binding-/Fachversion. Dasselbe unveränderte Orakel besteht über tatsächliche Swift-/Kotlin-UniFFI-Bibliothek, WASM/Node und Chromium/WASM. Sechs zusätzliche ungültige WASM-Versionen werden ohne Trunkierung abgewiesen, einschließlich NaN/Infinity; Node weist außerdem ein fremdes Requestobjekt ab. Native Compiler verwenden warnings-as-errors/-Werror. Typecheck/Lint und Browserlauf ebenfalls mit strikter Warnungsprüfung.

[Versionierte Dateien](../packages/contracts/generated/private-v2/README.md) entstehen durch UniFFI 0.32.2 und wasm-bindgen 0.2.129. Nur LF/Leerzeichen/Abschlussnewline nachbearbeitet; Fremdhinweise erhalten. `pnpm check:contracts:generated` vergleicht ohne Umschreiben. Tatsächlich eine zusätzliche Rust-Enumvariante injiziert: Prüfbefehl scheitert mit Vertragsdrift, alle versionierten Dateihashes unverändert. Originalquelle in finally wiederhergestellt; derselbe Prüfbefehl danach erfolgreich. CI/check:all führt den Generierungsvergleich und die nativen/WASM-/Browser-V2-Assertions aus; Swift/Kotlin verlangen ausdrücklich den vollständigen lokalen Sprachbefehl. Reproduzierbare Befehle im Binding-README, lokale Logs/Ergebnisse unter test-results/contract-bindings-generation, einschließlich drift-proof.log und money-v2-results.json.

Dies ist ein abgeschlossener Machbarkeitsabschnitt für money.parse, keine vollständige AR02-Abnahme. Private Aggregate/Befehle und weitere Aktionen, öffentliche/lokale Module sowie vollständige Form-/Schemavergleiche bleiben Voraussetzung für #116. Kein Issueabschluss und kein Beginn abhängiger Pakete aus diesem Teilbeleg.

## Gemeinsame vollständige private Rust-Typquelle

Der nächste abgeschlossene Quellabschnitt trennt `wimm-finance-types` von den Fachhandlern. Alle 14 Aggregatarten, 22 Befehlsformen, Request-/Kontext-/Erwartungs-/Änderungsmengenformen und geschützten Werttypen haben genau eine Rust-Quelle. Der Kern reexportiert seine bisherigen öffentlichen Modulpfade; fachliche Handler, Projektionen, Gegenbefehle und CAS-/Referenzregeln bleiben dort. Das Schemawerkzeug importiert unmittelbar diese Typquelle, ohne Fachhandlerabhängigkeit. Beide Crates sind ohne UI/HTTP/ORM/Speicher und global unsafe-frei. Keine neue Fremdabhängigkeit oder Finanz-/Binding-/Speicherformatänderung.

Vor dem Umbau erzeugte drei Schemas im tatsächlichen Werkzeugprüfmodus nach dem Umbau bytegenau identisch. `pnpm check:core` erfolgreich, einschließlich der jetzt im Typcrate liegenden direkten Rust-Wert-/Schemaassertions und der unveränderten Formdifferenzialtests im Kern. `pnpm test:contracts:bindings:v2:all` erneut erfolgreich: 17 gemeinsame Fälle in Rust/Swift/Kotlin/WASM/Chromium plus zusätzliche WASM-Versionsfälle. `WIMM_JAVA=/usr/lib/jvm/java-21-openjdk/bin/java pnpm test:core:bindings` erneut vollständig erfolgreich: je 489 unveränderte V1-Fälle in allen fünf tatsächlichen Laufzeiten, Browserlauf 1,9 Minuten. Dieselbe aktive CachyOS-Arbeitskopie und Toolchain wie oben. Logs shared-types-core.log/shared-types-v1.log/shared-types-v2.log und Schemas contracts-source-before unter ignoriertem test-results. Dokumentationsvalidator, drei Tests und Whitespace bestanden.

Die Quelltrennung bereitet die übrigen Sprachmodelle vor; sie behauptet noch keine vollständige Generierung dieser Formen oder öffentlicher/lokaler Vertragsmodule. #116 bleibt offen.
