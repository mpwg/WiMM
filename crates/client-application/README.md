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

Dies ist Commitvorbereitung, keine abgeschlossene Pipeline-/Sprach-/WASM-Laufzeit-/Produktabnahme. Persistenzdispatch, endgültiger Scopevergleich, Commit-/unknown-/Receiptabfrage, Gegenbefehle/Historienkoordination und versionierte Laufzeit-/Binding-/Ansichtsports werden in #139 weitergeführt. Nichts wird als tatsächlich gespeichert gemeldet und keine Oberfläche umgeschaltet. #119 bleibt bis tatsächlicher produktiver Umschaltung offen; DAL-/Bestands-/Aktivierungsabnahmen folgen der neu geordneten #114/ADR-056.
