# AR01 — Typisierung des bestehenden Fachkerns

Stand: 9. Oktober 2026. Datierter Abschnittsnachweis für [AR01 #115](https://github.com/mpwg/WiMM/issues/115); Gesamtfolge in [#114](https://github.com/mpwg/WiMM/issues/114), Freigabe in [Aufgaben](tasks.md). AR01 ist vollständig typisiert und mit dem aktuellen Fach-/Bindingkatalog abgenommen. Dieser Abschnitt ersetzt keine Abnahme der Rust-Clientanwendung oder Produktumschaltung.

## Geprüfter Abschnitt

Der bestehende V1-Formvertrag wird aus typisierten Rust-Modellen gelesen: 14 Aggregatarten und 22 Befehle, einschließlich Splits, Importkandidaten/-zeilen, Regelbedingungen/-aktionen und Dauerzahlungsvorlagen. Geschützte skalare Typen prüfen UUIDs, Kalenderdaten, UTC-Zeitpunkte, sichere ganze Cent, Erwartungs-/Speicherrevisionen, Ordinalwerte, nichtleere Texte, Hashes und Listengrenzen. Gespeicherte Revisionen beginnen bei eins; die Erwartungsrevision null bleibt für Neuanlagen gültig.

Die stringbasierte Formfeldliste ist aus dem Laufzeitvalidator entfernt. Ihre gesperrte Version liegt mit unveränderlichem Herkunftslink ausschließlich unter `crates/finance-core/tests/support/v1_shape_reference.rs`. Der native Differenzialtest vergleicht mehr als 1.000 Formen des unveränderten K04-Katalogs plus gezieltes Entfernen, Ersetzen und Ergänzen von Feldern. Akzeptierte Formen werden mit allen Feldern zurückserialisiert. Der produktive Fachkatalog bleibt unabhängig davon die verbindliche positive/negative Ergebnisreferenz.

Konto- und Verbrauchsprojektionen verwenden intern ausschließlich typisierte Aggregate, Ergebnisse und Centoperationen. Stabile Buchungs-/Kategorie-/Kontoreihenfolge und Fehlertexte bleiben erhalten. Stammdaten-/Buchungsnormalisierung und Prüfungen für Splits, Regelbedingungen und Importzeilen verwenden die neuen Typen. Buchungen und Dauerzahlungsvorlagen teilen dieselbe Prüfung ihrer Buchungsfelder, ohne fiktive Aggregate zu konstruieren.

Ein weiterer geprüfter Abschnitt stellt die vollständige historische Bestandsvalidierung und Cacheprüfung um. Nach der Grenzdeserialisierung verwenden Bereich/Chronologie, Referenzarten, Transferpaare, Abgleiche, Importfingerprints, Regeln und Dauerzahlungsverknüpfungen direkt Rust-Felder. Konto-, Verbrauchs- und Monatssummen verwenden dieselben typisierten Projektionen und sicheren Centtypen. Die Cacheprüfung deserialisiert bestehende Payloads in typisierte Werte; sie erhält die optionalen Konto-IDs und die von der Reihenfolge unabhängige Kategorieprüfung.

Der Befehlsabschnitt ergänzt typisierte Request-/Kontext-/Erwartungs-/Änderungsmengenverträge. Stammdatenanlage/-archivierung, Kontoeinstieg, Buchungsanlage/-änderung/-löschung, Transferanlage/-löschung und Regelreihenfolge verwenden sie direkt. Revisionsübergänge, Finanzvorbereitung mit CAS-Ankern und Mutationsreferenzprüfungen laufen auf denselben typisierten Modellen. Die frühere dynamische Finanzvorbereitungslogik ist entfernt; verbleibende Aufrufer verwenden Übergangsadapter.

## Kompatibilität und Grenzen

Binding- und Fachschemaversion bleiben eins. UUID-Schreibweise, Zeitstempelpräzision, Tombstones sowie Unterschied zwischen fehlenden Feldern und vorhandenem `null` bleiben erhalten. Nur das erforderliche Kandidatenfeld der Importzeile darf ausdrücklich `null` sein. Importmappings bleiben gemäß bestehendem Vertrag opake JSON-Payloads; ihre Struktur wird hier nicht verschärft. Äquivalente JSON-Zahlformen werden an der Grenze in sichere Ganzzahlen umgewandelt; Geldberechnungen verwenden ausschließlich Integer.

Alle verbleibenden Handler einschließlich Abgleich, Empfängermerge, Regelanwendung, Importklassifizierung, Import-/Dauerzahlungsbefehlen, Fälligkeiten und Gegenbefehlen sind jetzt umgestellt. Undo/Redo ruft die typisierten Handler direkt auf; die bisherigen Übergangsadapter und internen JSON-Befehlsrekonstruktionen sind entfernt. JSON wird ausschließlich an der kompatiblen äußeren Ein-/Ausgabegrenze verarbeitet. Einzige formatgebundene Ausnahme bleibt die kanonische V1-Fingerprintserialisierung eines festen typisierten Tupels. Insbesondere ist noch kein begrenzter Ansichtsport oder optimierter Bereichslesevorgang aus AR07 umgesetzt. Neue Funktionalität und Datenmigrationen sind nicht Bestandteil dieses Abschnitts.

## Kriterienmatrix

| Kriterium aus #115 | Status | Aktueller Beleg |
| --- | --- | --- |
| Alle Handler arbeiten typisiert; unmögliche Feldkombinationen nicht frei konstruierbar | erfüllt | Alle 22 Befehle, Berechnungen, Projektionen und Gegenbefehle arbeiten auf geprüften Rust-Feldtypen; keine dynamischen Feldzugriffe in interner Fachlogik. Typisierte Regelaktionen und skalare Konstruktoren verhindern strukturwidrige Feldwerte; bestandsabhängige Invarianten werden kontrolliert geprüft |
| Bestehender positiver/negativer K04-Katalog nativ, WASM, Swift und Kotlin unverändert | erfüllt | `pnpm test:core:bindings`: je 479 unveränderte K04-Fälle plus zehn UTC-Generatorregressionen in Rust nativ, Swift/UniFFI, Kotlin/UniFFI, WASM/Node und tatsächlichem Chromium/WASM |
| Kein ORM/UI/HTTP/Storage im Kern; unsafe-Verbot unverändert | erfüllt | `pnpm check:core`: Paket-/Root-/Workspace-Grenzen, Rustfmt, Clippy mit Warnungen als Fehler, native Workspace-Assertions |
| README des Abschnitts aktuell | erfüllt | [Rust-Fachkern-README](../crates/finance-core/README.md): neue Modelle, native Prüfungen und verbleibende Übergangsgrenze beschrieben |

Prüfumgebung: aktive Arbeitskopie auf macOS arm64; synthetischer gesperrter Fachkatalog ohne echte Finanz-/Schlüsseldaten. Eigene native Rust-Assertions prüfen zusätzlich skalare Grenzen, Formmutationen, Nullable-/Abwesenheitssemantik, F01 (110.000 Cent Kontostand, 20.000 Einnahmen/10.000 Ausgaben), Teilrückerstattung, Tombstones, stabile Reihenfolge, Zwischenwertüberlauf und Splitfehler. Die Befehle verändern keine Sollfixtures.

Lokale Abschnittslogs: `test-results/architecture-implementation/ar01-model-core.log` und `ar01-model-bindings.log`; erneute vollständige Prüfung nach der Bestands-/Cacheumstellung in `ar01-state-core.log` und `ar01-state-bindings.log`. Zwei zusätzliche direkte Rusttests prüfen am typisierten Bestand fremde Bereiche, fehlende Kategorien, doppelte Abgleichreferenzen und ein beschädigtes Transferpaar. Veröffentlichte Commits und rückgelesene Belege stehen in #115. Keine native Tauri-GUI-, Firefox-, WebKit-, physische Geräte- oder neue Persistenzabnahme wird aus diesem Fachbindingabschnitt abgeleitet.

## Fortsetzung

Nächstes freigegebenes Architekturpaket ist die gemeinsame Vertragsgenerierung AR02/#116. Die bestehende JSON-Kompatibilitätsgrenze bleibt verbindlich. Die eigentliche Rust-Clientanwendung, Produktumschaltung und Datenmigrationen folgen der Abhängigkeitsfolge in #114.

## #128 — UTC-Generatorprüfung der Regelreihenfolge

Die tatsächliche native Vorherreproduktion liefert mit `2026-10-09T25:00:00Z` eine erfolgreiche Änderungsmenge mit ungültigen `updatedAt`-Werten. Der Kontext des Reorderhandlers wurde zuvor nur auf `T` und abschließendes `Z` geprüft. Das verletzt den bestehenden UTC-/Aggregatvertrag und ist als eigenständiger Bestandsdefekt erfasst. Die vollständige UTC-Prüfung weist diese Eingabe nun mit `INVALID_GENERATOR` ohne Änderungsmenge ab; gültige Zeitpunkte bleiben exakt erhalten. Finanz- und Bindingversion bleiben eins.

| Kriterium aus #128 | Status | Beleg |
| --- | --- | --- |
| Ungültige Stunden/Minuten/Sekunden, Datum, Sekundenformat und UTC-Kennung abweisen | erfüllt | Acht negative Fälle im eigenen nativen Integrationstest und demselben tatsächlichen Bindingkatalog; jeweils kein ChangeSet |
| Gültige UTC-Zeitpunkte und Sekundenbruchteile unverändert | erfüllt | Zwei positive Fälle; native Assertion des zurückgegebenen typisierten Aggregatzeitpunkts |
| Fünf tatsächliche Laufzeiten und unveränderter K04-Katalog | erfüllt | Je 489 Fälle: 479 historische plus zehn neue Regressionen; Golden unverändert |
| Kern-/Architektur-/unsafe-/Clippy-Prüfung, README und Matrix | erfüllt | `pnpm check:core`, Paket- und Fixture-README, diese datierte Matrix; zusätzliche TS-Typecheck-/Lint- und Dokumentationsprüfungen |

Aktuelle lokale Logs: `test-results/architecture-implementation/ar01-command-core.log` und `ar01-command-bindings.log`. Vorherreproduktion in `reorder-invalid-time-before-result.jsonl`. Veröffentlichung, rückgelesene Belege und Schließungsgrund stehen in #128. Der Abschluss dieses begrenzten Defekts schließt AR01 nicht.

Die acht negativen Browserfälle rufen das echte Rust-WASM-Binding mit rohem JSON direkt auf; sie werden dadurch nicht vor dem Rustaufruf von Zod abgefangen. Die zwei gültigen Browserfälle laufen über den unveränderten TypeScript-Bindingadapter. Dessen Eingabeprüfung wurde nicht abgeschwächt.


## Aktuelle vollständige AR01-Abnahme

9. Oktober 2026, aktive Arbeitskopie, macOS arm64, unveränderter synthetischer K04-Katalog plus getrennte UTC-Generatorregressionen. `pnpm check:core` vollständig erfolgreich: native Workspace-Assertions, 16 direkte Kernunittests, vier Katalogtests und ein UTC-Integrationstest mit zehn Fällen; Paket-/unsafe-Grenzen, Rustfmt und Clippy mit Warnungen als Fehler. `pnpm test:core:bindings` erneut erfolgreich: je 489 tatsächliche Fälle in Rust, Swift/UniFFI, Kotlin/UniFFI, WASM/Node und Chromium/WASM. Dokumentationsvalidator, seine drei Tests und Whitespaceprüfung bestanden. Paket-README aktualisiert. Logs ar01-complete-core.log/ar01-complete-bindings.log unter test-results/architecture-implementation; veröffentlichter Commit und Schließung in #115. Alle drei Issuekriterien erfüllt.

Die übergreifende Produkt-CI auf 80c3648 bleibt wegen des unabhängigen [Leistungsbefunds #129](https://github.com/mpwg/WiMM/issues/129) fehlgeschlagen: Desktop-Frontend-Kaltöffnung 2.065,6 ms bei 50.000 Buchungen, verbindliche Grenze unter 2.000 ms. Das ist kein offenes Fachtypisierungs- oder Bindingkriterium und wird nicht durch AR01 geschlossen. Keine native Tauri-/Geräte-/Leistungsabnahme aus dem Fachkatalog ableiten.
