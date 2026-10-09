# AR02 — gemeinsame Vertragsgenerierung

Stand: 9. Oktober 2026. Abschnittssnapshot zu [#116](https://github.com/mpwg/WiMM/issues/116), nach abgeschlossener [AR01-Abnahme](ar01-typing.md). AR02 ist in Arbeit; keine vollständige Generierungs-/Binding-/Formvalidierungsabnahme. Umfang und Freigabe in [Aufgaben](tasks.md), Abhängigkeiten ausschließlich in [#114](https://github.com/mpwg/WiMM/issues/114).

## Geprüfter Schemaprototyp

Schemars 1.2.2 erzeugt private Aggregat-, Befehls- und Requestsformen aus den vorhandenen Rust-Modellen und ihren Serde-Attributen. Eigener Wrapper [wimm-contract-schema](../tools/contract-schema/README.md) verwendet den etablierten Generator; keine zweite Formfeldliste. Die Sprach-/Bindingsentscheidung bleibt offen, der Prototyp verändert die bestehende JSON-/UniFFI-/WASM-ABI nicht. Schemars unterstützt Serde-Tags, unbekannte Felder und Schemaanpassungen. [Offizielle Attributdokumentation](https://graham.cool/schemars/deriving/attributes/).

Optionale present-Felder bleiben ohne null: Schemaattribute beschreiben ihren vorhandenen Werttyp und erhalten die bestehende Serde-Abwesenheit. Das erforderliche nullable Importkandidatenfeld verwendet einen separaten Schematyp, der eine nullable Kandidatenform beschreibt, ohne das Feld als optional zu markieren. Alle 14 Aggregatarten behalten ihre Tags und gesperrten Zusatzfelder. Sichere Zahlen verwenden gemeinsame Rust-Grenzen; Listenlimits kommen aus den tatsächlichen Const-Generics. Der unbeschränkte Listenname bleibt nativ/WASM-unabhängig. Konstruktoren und Geschäftsinvarianten bleiben im typisierten Kern.

`--write` erzeugt drei private Prototypdateien im benannten Verzeichnis. `--check` reproduziert exakte Inhalte und scheitert bei fehlenden/abweichenden Dateien ohne Umschreiben. Native Tests belegen deterministische Generierung, erforderliches nullable Kandidatenfeld, optionale nichtnullable Felder, Centgrenzen, gesperrte Zusatzfelder und absichtlich verursachte Drift ohne Reparatur. Dies ersetzt noch keinen vollständigen Schema-/Sprach-Negativkatalog oder eine CI-Gesamtabnahme.

## Kriterienmatrix

| Kriterium aus #116 | Status | Abschnittsnachweis |
| --- | --- | --- |
| TS-/Swift-/Kotlin-Verträge reproduzierbar, getrennte öffentliche/lokale/private Module, versionierte Fehler-/Exportformen | offen | Native private Schemaquelle geprüft; weitere Module, Sprachgenerator und vollständige Versions-/Ergebnisformen folgen nach Bindingentscheidung |
| Identische positive/negative Grenz-/Form-/Unicode-/Datums-/Null-/Zahlenfälle | offen | Native strukturelle Assertions bestanden; vollständiger Schema-/Bindingvergleich noch auszuführen |
| Absichtlicher Vertragsdrift lässt CI scheitern | offen | Werkzeugprüfmodus und negativer nativer Test vorhanden; versionierte Ausgabe und CI-Integration noch offen |
| README und Herkunft/Lizenzen | erfüllt für Prototyp | [Werkzeug-README](../tools/contract-schema/README.md), [Dependencyregister](dependency-provenance/contract-schema.json); sechs neue Fremdpakete mit Version, Datum, Lizenz und Lockfilechecksumme |

Geprüft in der aktiven Arbeitskopie auf macOS arm64: `cargo test --locked -p wimm-finance-core --features contract-schema schema::tests` (zwei Tests), `cargo test --locked -p wimm-contract-schema` (ein Negativtest), `pnpm check:core` mit nativen Workspace-/Architektur-/unsafe-/Rustfmt-/Clippyprüfungen. Dokumentationsvalidator, Tests und Whitespace. Keine echte Finanz-/Schlüsseldaten, kein Produktbestand oder Datenmigration. Lokaler Log ar02-schema-core.log unter test-results/architecture-implementation. Veröffentlichter Abschnittscommit und Rücklesebelege in #116.

## Kompatibilität und Fortsetzung

Schemars ist eine optionale, plattformfreie Entwicklungsabhängigkeit hinter contract-schema; reguläre Produktbindings benötigen dieses Feature nicht. Projektcode bleibt AGPL-3.0-or-later und unsafe-frei; Fremdlizenzen unverändert. Vor vollständiger AR02-Abnahme öffentliche/lokale/private Vertragsgrenzen, Versions-/Fehlerformen, alle drei Sprachen, Formsemantik und negativen CI-Drift gemeinsam belegen. Die Nutzerentscheidung betrifft Beibehaltung der JSON-ABI mit generierten Datenmodellen gegenüber einer neuen typisierten UniFFI-/WASM-API samt expliziter Bindingversion und Kompatibilitätsadapter; bis dahin keine abhängige Umstellung.
