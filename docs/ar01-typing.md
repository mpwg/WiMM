# AR01 — Typisierung des bestehenden Fachkerns

Stand: 9. Oktober 2026. Datierter Abschnittsnachweis für [AR01 #115](https://github.com/mpwg/WiMM/issues/115); Gesamtfolge in [#114](https://github.com/mpwg/WiMM/issues/114), Freigabe in [Aufgaben](tasks.md). AR01 ist noch nicht vollständig umgesetzt. Dieser Abschnitt ersetzt keine Abnahme der Rust-Clientanwendung oder Produktumschaltung.

## Geprüfter Abschnitt

Der bestehende V1-Formvertrag wird aus typisierten Rust-Modellen gelesen: 14 Aggregatarten und 22 Befehle, einschließlich Splits, Importkandidaten/-zeilen, Regelbedingungen/-aktionen und Dauerzahlungsvorlagen. Geschützte skalare Typen prüfen UUIDs, Kalenderdaten, UTC-Zeitpunkte, sichere ganze Cent, Erwartungs-/Speicherrevisionen, Ordinalwerte, nichtleere Texte, Hashes und Listengrenzen. Gespeicherte Revisionen beginnen bei eins; die Erwartungsrevision null bleibt für Neuanlagen gültig.

Die stringbasierte Formfeldliste ist aus dem Laufzeitvalidator entfernt. Ihre gesperrte Version liegt mit unveränderlichem Herkunftslink ausschließlich unter `crates/finance-core/tests/support/v1_shape_reference.rs`. Der native Differenzialtest vergleicht mehr als 1.000 Formen des unveränderten K04-Katalogs plus gezieltes Entfernen, Ersetzen und Ergänzen von Feldern. Akzeptierte Formen werden mit allen Feldern zurückserialisiert. Der produktive Fachkatalog bleibt unabhängig davon die verbindliche positive/negative Ergebnisreferenz.

Konto- und Verbrauchsprojektionen verwenden intern ausschließlich typisierte Aggregate, Ergebnisse und Centoperationen. Stabile Buchungs-/Kategorie-/Kontoreihenfolge und Fehlertexte bleiben erhalten. Stammdaten-/Buchungsnormalisierung und Prüfungen für Splits, Regelbedingungen und Importzeilen verwenden die neuen Typen. Buchungen und Dauerzahlungsvorlagen teilen dieselbe Prüfung ihrer Buchungsfelder, ohne fiktive Aggregate zu konstruieren.

## Kompatibilität und Grenzen

Binding- und Fachschemaversion bleiben eins. UUID-Schreibweise, Zeitstempelpräzision, Tombstones sowie Unterschied zwischen fehlenden Feldern und vorhandenem `null` bleiben erhalten. Nur das erforderliche Kandidatenfeld der Importzeile darf ausdrücklich `null` sein. Importmappings bleiben gemäß bestehendem Vertrag opake JSON-Payloads; ihre Struktur wird hier nicht verschärft. Äquivalente JSON-Zahlformen werden an der Grenze in sichere Ganzzahlen umgewandelt; Geldberechnungen verwenden ausschließlich Integer.

Die verbleibenden Befehlsabläufe, Gegenbefehle, vollständigen Querreferenz-/Revisionsprüfungen und Teile der Automatisierung verwenden noch dynamische Daten. Ihre Übergangsadapter deserialisieren Modelle und serialisieren Ergebnisse; JSON ist dadurch noch nicht ausschließlich die äußere Bindinggrenze. Insbesondere ist noch kein begrenzter Ansichtsport oder optimierter Bereichslesevorgang aus AR07 umgesetzt. Neue Funktionalität und Datenmigrationen sind nicht Bestandteil dieses Abschnitts.

## Kriterienmatrix

| Kriterium aus #115 | Status | Aktueller Beleg |
| --- | --- | --- |
| Alle Handler arbeiten typisiert; unmögliche Feldkombinationen nicht frei konstruierbar | offen | Formmodelle, skalare Konstruktoren, Basisprojektionen und Teilprüfungen vorhanden; verbleibende dynamische Abläufe siehe Abschnittsgrenze |
| Bestehender positiver/negativer K04-Katalog nativ, WASM, Swift und Kotlin unverändert | erfüllt | `pnpm test:core:bindings`: je 479 Fälle in Rust nativ, Swift/UniFFI, Kotlin/UniFFI, WASM/Node und tatsächlichem Chromium/WASM |
| Kein ORM/UI/HTTP/Storage im Kern; unsafe-Verbot unverändert | erfüllt | `pnpm check:core`: Paket-/Root-/Workspace-Grenzen, Rustfmt, Clippy mit Warnungen als Fehler, native Workspace-Assertions |
| README des Abschnitts aktuell | erfüllt | [Rust-Fachkern-README](../crates/finance-core/README.md): neue Modelle, native Prüfungen und verbleibende Übergangsgrenze beschrieben |

Prüfumgebung: aktive Arbeitskopie auf macOS arm64; synthetischer gesperrter Fachkatalog ohne echte Finanz-/Schlüsseldaten. Eigene native Rust-Assertions prüfen zusätzlich skalare Grenzen, Formmutationen, Nullable-/Abwesenheitssemantik, F01 (110.000 Cent Kontostand, 20.000 Einnahmen/10.000 Ausgaben), Teilrückerstattung, Tombstones, stabile Reihenfolge, Zwischenwertüberlauf und Splitfehler. Die Befehle verändern keine Sollfixtures.

Lokale Logs: `test-results/architecture-implementation/ar01-model-core.log` und `ar01-model-bindings.log`. Veröffentlichter Commit und rückgelesene Belege stehen in #115. Keine native Tauri-GUI-, Firefox-, WebKit-, physische Geräte- oder neue Persistenzabnahme wird aus diesem Fachbindingabschnitt abgeleitet.

## Fortsetzung

Das erste offene freigegebene Paket bleibt AR01. Als Nächstes werden verbleibende Handler und Querreferenzprüfungen auf dieselben Modelle umgestellt. Erst danach folgt die vollständige erneute Paketabnahme und die gemeinsame Vertragsgenerierung aus AR02; die bestehende JSON-Kompatibilitätsgrenze bleibt bis dahin verbindlich.
