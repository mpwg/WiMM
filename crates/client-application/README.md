# Gemeinsame Rust-Clientanwendung

SPDX-License-Identifier: AGPL-3.0-or-later

[Abnahmesnapshot und Kriterienmatrix #139](../../docs/ar05-runtime-foundation.md). Dieser Crate besitzt typisierte Commitvorbereitung, dauerhaften Operationswiederanlauf, Sitzungshistorie und zustandsbehaftete ClientRuntime. Finanzregeln, sichere Summen und Projektionen kommen ausschließlich aus dem Fachkern. Keine UI-/HTTP-/ORM-/Speicherimplementierung, eigene und globale Cargo-unsafe-Sperren erhalten.

`prepare_command` und `prepare_reverse` bilden denselben LocalCommitRequest aus vollständigem Bestand, Kernänderungen, CAS, Projektionen und optionalem privatem verbundenem Originalentwurf. Standalone erzeugt keine Outbox. Vorbereitete Aufträge sind nach außen unveränderlich. LocalCommitReceipt bestätigt ausschließlich lokalen Speichererfolg.

`DurableCommitPipeline` speichert profilgebunden eine RecoveryTicket-Version eins samt verschlüsseltem Original über vorhandene Krypto-/Journalports, prüft den tatsächlichen Rückleseinhalt vor Finanzwrite und löst unbekannte Ergebnisse ausschließlich am ursprünglichen Receipt auf. Falscher Schlüssel/Inhalt, fehlendes Receipt und technische Unklarheit erhalten Original und Writesperre. Bekannter Commit wird bei Cleanupfehler nicht als Rollback dargestellt. [ADR-057](../../docs/decisions.md).

ClientRuntime besitzt den vollständigen MutationReadPort, lebenden Kontext, Abbruch, Krypto-/Journal-/Commitports, lokale Ansichtsstände und Sitzungshistorie. Änderungen/Historienbewegungen werden ausschließlich nach aktuellem inhaltsgebundenem Receipt übernommen; keine zweite Abfrage oder Write nach Commit. Views sind kontextgebunden und auf 100 Aggregate pro Seite begrenzt; indizierte Queries und Leistungsabnahme bleiben #121.

RuntimeSessionV2 in wimm-core-bindings besitzt diese Runtime tatsächlich über mehrere Swift-/Kotlin-/WASM-Aufrufe und veröffentlicht versionierte Aktionen, Ereignisse, Seiten und Portformen. Schließen gibt Runtime/Portreferenzen frei; fremde/unerwartete Callbackfehler liefern sichere strukturierte Unklarheit ohne ursprüngliche Diagnosen. [Rust-abgeleitetes SDK](../../packages/contracts/generated/application-v2/generation.json), [Herkunft](../../docs/dependency-provenance/client-application-bindings.json). Keine neue Fremdversion oder von Hand geänderte Generatorausgabe.

## Prüfung

37 native Anwendungsassertions, zwei zusätzliche native SQLite-Bindinginstanzassertions, 71 tatsächliche Speicher-/Neuöffnungsdurchläufe, getrennte echte Prozess-/Dateijournal-/libsodium-Nachweise. Die vorhandenen 176 Befehls- und elf Gegenbefehlsorakel bleiben unverändert. Das gezielt partielle historische Abgleichorakel wird als ungültiger vollständiger Anwendungsbestand abgewiesen; eine eigene vervollständigte Fixture beweist den gültigen Weg.

Aktuelle zustandsbehaftete Sprachmatrix: je 148 Instanzen/504 Runtimeaktionen in Rust, Swift/UniFFI, Kotlin/UniFFI, Node-WASM und Chromium-WASM; alle 22 Befehlsarten, Undo/Redo, Antwortverlust, spätes Scope, Abbruch/Rollback, kaputtes Receipt/Journal, falscher Snapshot und Callbackfehler. Große Importgruppen werden über begrenzte Seiten vollständig gegen unveränderte Goldens verglichen. Die Sprach-Speichercallbacks sind synthetische I/O-Vertragsadapter, keine Persistenz-/Geräte-/GUI-Belege. Krypto benutzt den tatsächlichen vorhandenen Rust-/libsodium-Port mit Zufallsnonce und ausdrücklich synthetischem Testschlüssel. Native tatsächliche SQLite-/Prozessbelege kommen aus separaten Rustassertions.

```sh
cargo test --locked -p wimm-client-application -p wimm-core-bindings
cargo clippy --locked -p wimm-client-application -p wimm-core-bindings --all-features --all-targets -- -D warnings
pnpm test:contracts:runtime:all
node scripts/generate-contract-bindings.mjs --check
pnpm check:target:architecture
```

Negative Rust-Quelldrift wird ohne Überschreiben abgewiesen; Quelle und Schemahashes wiederhergestellt. Lokale Logs: test-results/ar05-stateful-*.log, test-results/stateful-runtime. Vorbereitungsbindingmatrix separat: 387 Eingaben/382 tatsächliche Aufrufe, fünf Formablehnungen, drei zusätzliche JS-Fehlformen. Historische Aufbauabschnitte in Git und im Issue.

#139 ist eine gemeinsame Runtime-/Portgrundlage. Vollständiger nativer/Browser-DAL, physischer Journal-/CAS-/Sicherungs-/Migrationseinbau und Produktumschaltung bleiben #108/#109/#119. Keine AR07-Leistungs-/P4-/P5-/Geräte-/Produkt-/Gesamtarchitekturabnahme aus diesem Crate; Gesamtfolge #114/ADR-056 bleibt verbindlich.
