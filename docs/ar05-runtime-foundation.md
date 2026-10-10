# AR05-Voraussetzung — gemeinsame Rust-Runtime (#139)

SPDX-License-Identifier: AGPL-3.0-or-later

Dieser Snapshot nimmt die frühe Grundlage [#139](https://github.com/mpwg/WiMM/issues/139) ab. Die produktive Umschaltung bleibt [#119](https://github.com/mpwg/WiMM/issues/119); vollständiger nativer/Browser-DAL und physischer Journaleinbau bleiben #108/#109. Die vom Nutzer festgelegte Reihenfolge aus #114/ADR-056 bleibt unverändert.

## Implementierung

ClientRuntime koordiniert den vollständigen MutationReadPort, Fachkern, Scope-/Abbruch-/Krypto-/Journal-/Commitports, lokal gespeicherte Seiten und Sitzungshistorie. Normalbefehle, Importgruppen und Dauerzahlungen verwenden dieselbe Vorbereitung/Commitpipeline. Gegenbefehle kommen aus dem Kern. Finanzregeln, Summen und sichere Zwischenwerte werden ausschließlich dort berechnet.

RuntimeSessionV2 besitzt diese Runtime tatsächlich über mehrere Bindingaufrufe. Native Instanzen besitzen die Runtime unter Mutex und typisierten UniFFI-Callbacks; WASM besitzt dieselbe Session unter RefCell und typisierten synchronen Worker-/Plattformports. invoke, page und shutdown sind echte Zustands-/Lebensdaueraufrufe. Schließen entfernt Runtime und Portreferenzen; weitere Aktionen bestätigen nichts. Reentrante native Aufrufe erhalten einen sicheren BUSY-Fehler, WASM verweigert eine zweite mutable Ausleihe. Keine unsafe-Umgehung, UI/HTTP/ORM oder zweite Finanzengine im Dienst.

Die Commitports erhalten ursprünglichen Kontext und initialen Abbruchstatus. Der konkrete Adapter muss Scope-/Abbruchwechsel auch an seinen tatsächlichen Transaktionsgrenzen beobachten; die unveränderten CancellableLocalCommitPort-/AR04-Regeln gelten. Ein Callbackfehler liefert ausschließlich einen sicheren unbekannten Zustand ohne ursprüngliche Diagnosen. Bekannte Speicherfehler werden über RuntimeCommitResultV2 und StorageFailure übertragen. Der eigene native RuntimePortError vermeidet den nachgewiesenen UniFFI-Kotlin-Fehler bei externen Callback-Fehlerbuffern; generierter Code wird nicht von Hand verändert.

## Kriterienmatrix

| Kriterium aus #139 | Aktueller Beleg |
| --- | --- |
| 22 Befehlsarten, Importgruppen, Dauerzahlungen, Gegenbefehle im gemeinsamen Kern-/Commitpfad | 176 unveränderte Befehlsorakel und elf Gegenbefehlsorakel nativ; 71 tatsächliche SQLite-Speicher-/Neuöffnungsdurchläufe; alle 22 Arten zusätzlich in zustandsbehafteten Sprach-/WASM-Instanzen. |
| Scope/Epoche/Generation, Inhalt, CAS, Fehler/Abbruch/unknown/Replay ohne Teilerfolg oder neuen Write | Native Dispatch-, Historien-, Wiederanlauf- und Runtimeassertions mit tatsächlichem SQLite, Rollback und separaten Prozessen; aktuelle Bindingmatrix für Antwortverlust, manipuliertes Receipt, Callbackfehler, kaputtes Journal, Lesefehler, Abbruch und späten Kontext. |
| Standalone/verbunden, Outbox, Projektionen, lokale Finanzrevision und Privatheit | Native Speicher-/Original-/Projektionsvergleiche; beide Modi in allen Sprachinstanzen. Vollständige Finanzrevision bleibt lokal, privater Originalauftrag im Journal verschlüsselt über vorhandenen AR08-Port. Kein Server-/Transport-/Logport im Dienst. |
| Gleiche positive/negative Verträge in tatsächlichem WASM und nativen Bindings; Sperren/Drift erhalten | Je 148 Instanzen mit 504 Runtimeaktionen in Rust, Swift/UniFFI, Kotlin/UniFFI, Node-WASM und Chromium-WASM; sieben eigene Runtime-/Vorbereitungsformschemas und versioniertes SDK. Negativer Runtimequellendrift ohne Überschreiben, Quelle/Hashes wiederhergestellt. Allfeature-/Alltarget-Clippy, Cargo-/Source-unsafe und transitive Rollen geprüft. |
| Konsistente Voraussetzungen und ausstehende Produktumschaltung | #109/#119/#120 vollständig aktuell gelesen; alle drei verweisen auf #139. #119 behält ausdrücklich die produktive Entfernung sämtlicher TS-Commitduplikate. Keine Kriterien gestrichen oder Produktabnahme vorgezogen. |

## Tatsächlicher Prüfumfang und Grenzen

37 native Anwendungsassertions und zwei zusätzliche native Bindinginstanzassertions gegen tatsächlich SQLite und vorhandene libsodium-Primitive bestehen. Die Bindinginstanz benutzt für SQLite einen eigenen Testworker; keine unsafe-Send-/Sync-Umgehung des Connectionbesitzes. Die vorhandenen echten Receipt-/OPFS-/Restore-/Abbruchnachweise aus AR04 bleiben getrennte Abnahmen.

Die Sprach-/WASM-Matrix ruft echte Rust-Runtimeinstanzen auf. Ihre Speichercallbacks sind ausdrücklich synthetische I/O-Vertragsadapter, keine Datenbank-/Geräte-/GUI-/Persistenzbelege. Verschlüsseln/Entschlüsseln benutzt den tatsächlich kompilierten Rust-/AR08-libsodium-Port mit Zufallsnonce und ausschließlich synthetischem Testschlüssel. Native SQLite-/Dateijournal-/Prozessnachweise kommen aus den separaten Rustassertions; Sprachcallbacks ersetzen sie nicht.

Große Importgruppen werden vollständig über Seiten von höchstens 100 Aggregaten gegen unveränderte Goldens verglichen. Das ist keine indizierte AR07-/50.000-Buchungen-Leistungsabnahme. Sitzungshistorie bleibt nach Neustart flüchtig; die ursprüngliche Operation wird über verschlüsseltes Original und Receipt aufgelöst. Produktintegration, dauerhafte native/Browserjournal-CAS, Sicherung/Migration, Native-/PWA-/Geräteabnahmen und sämtliche weiteren #114-Issues bleiben offen.

## Reproduzierbare Prüfungen

```sh
cargo test --locked -p wimm-client-application -p wimm-core-bindings
cargo clippy --locked -p wimm-client-application -p wimm-core-bindings --all-features --all-targets -- -D warnings
pnpm test:contracts:runtime:all
node scripts/generate-contract-bindings.mjs --check
pnpm check:target:architecture
pnpm test:target:architecture
```

Die reguläre V2-Kette/CI führt Rust-/Node-WASM-/Browser-Runtimeprüfungen und negative Quelldrift aus; die All-Variante ergänzt tatsächliches Swift/Kotlin. Lokale Logs: test-results/ar05-stateful-*.log; Fälle und Resultate unter test-results/stateful-runtime. Keine erneute Gesamt-CI-Freigabe oder Abschluss von #114 aus diesem Grundlagenabschluss.
