# Gemeinsame Rust-Clientanwendung — frühe Commitgrundlage

SPDX-License-Identifier: AGPL-3.0-or-later

Erster Aufbauabschnitt [#139](https://github.com/mpwg/WiMM/issues/139), Voraussetzung der vom Nutzer vorgezogenen produktiven [AR05-Umschaltung #119](https://github.com/mpwg/WiMM/issues/119). Reiner Rust-Crate ohne UI/HTTP/ORM/Speicherimplementierung, eigene und Cargo-unsafe-Sperren erhalten. Finanzregeln und sichere Summen/Projektionen ausschließlich über bestehende typisierte Methoden im wimm-finance-core; die Anwendung besitzt keine zweite Geldberechnung.

`prepare_command` prüft Profil-/Bereichs-/Epochen-/Profilrevisions-/Sitzungs-/Laufzeitgeneration und ruft den typisierten Kern auf. Geänderte Aggregate und CAS-Erwartungen erhalten einen einzigen versionierten LocalCommitRequest. Projektionen berechnet der Kern gegen den vollständigen kombinierten Bestand. Standalone bildet keine Outbox; der bestehende verbundene Modus bereitet genau eine private unveränderte Originalfassung vor. Dieser Entwurf ist keine Transporthülle und wird hier weder gesendet noch automatisch veröffentlicht. Der Kern behält die lokale Finanzrevisionssemantik.

Drei native Assertions vergleichen alle 176 unveränderten K04-Befehlsorakel mit tatsächlichem Kernaufruf und Vorbereitung aller 22 Befehlsarten, Scopewechsel sowie vollständigen Abgleichbestand mit verbundenem Originalentwurf. Ein vorhandenes Kern-Golden „Abgleich bestätigten Ausgangssaldo verwenden“ ist eine gezielt partielle Handlerfixture: reconciled-Anfangsbuchung ohne zugehörigen gespeicherten Abgleich. Der Anwendungs-Vollbestand wird durch die bestehende Kernprojektion abgewiesen. Das Golden bleibt unverändert; eine eigene zusätzlich vervollständigte Fixture beweist den gültigen Anwendungsweg. Keine still übersprungenen Fälle oder gelockerten Finanzregeln.

```sh
cargo test --locked -p wimm-client-application
cargo clippy --locked -p wimm-client-application --all-targets -- -D warnings
cargo check --locked -p wimm-client-application --target wasm32-unknown-unknown
pnpm check:target:architecture
```

`CommitPipeline` führt vorbereitete, von außen unveränderliche Aufträge über den injizierten `CancellableLocalCommitPort`. Der injizierte Scopeport wird vor Dispatch, an den Abbruchgrenzen des DAL und nach der Antwort geprüft. Ein später Scopewechsel ändert einen tatsächlich bestätigten Commit nicht in einen Rollback: das Ergebnis enthält den ursprünglichen Kontext und `current: false` für die Ansicht. Eine unbekannte oder ungültige Antwort sperrt weitere Writes; `resolve` liest ausschließlich das Receipt der ursprünglichen Identität. Fehlendes Receipt, Lesefehler oder abweichende Identität/Inhalt/Revisionen erhalten die Sperre. Keine Wiederholung mit neuer Operations-ID und kein automatischer Write beim Auflösen.

Elf native Tests bestehen: die bisherigen drei Vorbereitungsprüfungen sowie acht Dispatchprüfungen mit tatsächlich lokalem SQLite (synthetische Daten), Neustart und unverändertem Replay, Antwortverlust/Receiptabfrage nach Profilwechsel, allen sechs Scopefeldern, Scopewechsel nach Writes mit vollständigem Rollback und nach COMMIT mit bestätigtem ursprünglichem Kontext, Abbruch/Schreibfehler sowie CAS-Konflikt. Zusätzlich prüft ein bewusst fehlerhafter Testport fremde/abweichende Receipts und die dauernde Sperre bei fehlendem Ergebnis; das ist kein Persistenzbeleg. SQLite/Diesel sind ausschließlich Dev-Abhängigkeiten, keine produktive Abhängigkeitskante. SHA-256 nutzt unverändert `sha2 =0.11.0` mit [bestehender Herkunft/Lizenz](../../docs/dependency-provenance/dal02-contracts.json); keine zusätzliche Fremdversion.

Dies ist ein nativer Dispatchabschnitt, keine abgeschlossene Pipeline-/Sprach-/WASM-Laufzeit-/Produktabnahme. Gegenbefehle/Historienkoordination, versionierte Laufzeit-/Binding-/Ansichtsports und Wiederaufnahme einer unklaren Operation nach Anwendungsneustart werden in #139 weitergeführt. Der belegte Neustart betrifft die tatsächliche SQLite-Verbindung; der Pipeline-Originalauftrag bleibt dabei im Speicher. Kein daraus abgeleiteter vollständiger Anwendungsneustartbeleg und keine Oberfläche umgeschaltet. #119 bleibt bis tatsächlicher produktiver Umschaltung offen; DAL-/Bestands-/Aktivierungsabnahmen folgen der neu geordneten #114/ADR-056.
