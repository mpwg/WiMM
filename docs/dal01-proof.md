# DAL01 — aktueller Machbarkeitsnachweis

Stand: 9. Oktober 2026, macOS arm64, Rust 1.99.0. [Auftrag](tasks.md#laufende-architekturumsetzung), [DAL01 #106](https://github.com/mpwg/WiMM/issues/106), [Werkzeug und Ausführung](../tools/dal-proof/README.md). Dies ist ein datierter Abnahmesnapshot, keine zweite laufende Deltaliste. Fortschritt, verbleibende Blockaden und aktuelle Prüfbelege ausschließlich im Issue.

## Kriterienmatrix

| Kriterium | Status | Beleg / Grenze |
| --- | --- | --- |
| Dieselbe lokale Rust-/Dieselimplementierung nativ und im Browser | erfüllt | ProofDb in tools/dal-proof; echte native SQLite und SQLite-WASM mit OPFS-SAH-Pool, kein sqlite3.js-Ersatz |
| Typisierte Query und atomarer Aggregat-/Outbox-/Projektionsbatch | erfüllt | Drei native Rust-Assertions sowie tatsächliche Chromium-/WebKitfälle; stale CAS/Fehler erhalten vollständigen Originalsnapshot |
| Dauerhafter nativer Prozess-/Browserneustart | erfüllt | Eigene native Integration beendet Binary vollständig; Chromium/WebKit schließen persistenten Browserprozess und öffnen denselben Bereich erneut |
| Registrierte Rust-DSLmigration mit Journal/Rollback | erfüllt | SeaQuery-Tabellen/Index, expliziter Schritt 1→2, Fehler nach Index-/Journalschreiben und Wiederanlauf, kein Upgrade beim Öffnen |
| Native Parallelität und Worker-/Tabbesitz | erfüllt | Zwei reale native Verbindungen: genau ein Write; echte Tabs und tatsächlicher Workerfehler mit erhaltenem bestätigten Stand |
| Chromium und WebKit | erfüllt | Je fünf tatsächliche persistente Fälle, insgesamt zehn bestanden; keine native Desktop-/physische iOS-Abnahme daraus |
| Firefox | erfüllt | Tatsächliche Ubuntu-CI auf 0076450: alle fünf Firefoxfälle bestanden; [Jobbeleg](https://github.com/mpwg/WiMM/actions/runs/37907404750/job/113744097296). Lokaler Mac-Start bleibt als Umgebungsgrenze getrennt, keine Skips |
| PostgreSQL-/MySQL-Backendbuilds | erfüllt | Tatsächlicher nativer Dieselbuild mit pq-sys/libpq und mysqlclient-sys/libmysqlclient; CMake/OpenSSL explizit gewählt, keine echte Server-DB-Konformität daraus |
| Safe-Code-/Lizenz-/Versionsentscheidung | erfüllt | Eigene Rootquellen/Tests forbid(unsafe_code), Cargo-Lintvererbung, Clippy und Architekturprüfung; direct maturity/gesperrte Herkunft im DAL-Provenienzregister |
| Header-/Origin-Rückkehr | erfüllt | OPFS-SAH-Pool ohne COOP/COEP/SharedArrayBuffer-Isolation, actual localhost→127.0.0.1-Rückkehr mit Standserhalt; keine OIDC-Authentifizierungsbehauptung |
| README und reproduzierbarer Starter | erfüllt | tools/dal-proof/README.md, pnpm test:dal:proof; vollständige Serie verlangt weiterhin Firefox |

## Aktuelle Prüfungen

- cargo test --locked -p wimm-dal-proof: drei Unit- und zwei Prozess-/Verbindungsfälle bestanden.
- cargo build --locked -p wimm-dal-proof --features postgres-build,mysql-build mit explizitem CMake/OpenSSL-SDK: native Clientbibliotheken gebaut, 21,46 s im letzten vollständigen Build; kein SQLserver gestartet.
- cargo build --locked -p wimm-dal-proof --lib --target wasm32-unknown-unknown mit LLVM-Archivierer: tatsächliches WASM gebaut; vorhandener Gluegenerator erzeugt reale Bindings.
- env -u NO_COLOR node scripts/test-dal-proof.mjs --project chromium --project webkit: zehn reale Fälle bestanden, letzte verfügbare Serie 11,3 s.
- pnpm typecheck, pnpm lint, native Clippy, Dokumentationsvalidator und Rust-Architektur-/globale unsafe-Prüfung bestanden; abschließende Nachprüfung nach letzten Änderungen folgt im Issue.

Logs/Traces liegen unter test-results/architecture-implementation und test-results/dal-proof. Synthetische Werte ohne Geld-/Schlüsseldaten. Frühere rote Versuche bleiben als Diagnosebelege erhalten; kein positiver Firefox-/Privatmodus-/Gerätebeleg daraus.

## Ergebnis und nächster Schritt

Die gemeinsame native/WASM-ORM-/DSL-/OPFSbasis und die nativen Client-Driverbuilds sind praktisch nachgewiesen. DAL01 ist vollständig abgenommen: fünf native Fälle, tatsächliche native Driver-/WASM-Builds und alle 15 Chromium-/Firefox-/WebKitfälle im erfolgreichen Ubuntu-Job. Die vollständigen Joblogs wurden rückgelesen. Keine Produktumschaltung oder pauschale Architekturgesamtabnahme. Lokale Firefox-Umgebungsgrenze bleibt gesondert dokumentiert. Unabhängige Fachtypisierung AR01/#115 kann anschließend innerhalb der bereits freigegebenen Voraussetzungen bearbeitet werden; abhängige DAL-Aktivierung braucht die vollständige zugehörige Abnahme. Keine automatische Ersatzarchitektur.


## Ergänzende vollständige CI-Abnahme

[DAL01-Job](https://github.com/mpwg/WiMM/actions/runs/37907404750/job/113744097296) auf `00764504937e6419b123751fc89e4692f576196e` erfolgreich: native Tests 3+2, native PostgreSQL/MySQL-Driverbuild 55,46 s, WASM-Build 24,84 s, reale Bindinggenerierung und 15 Browserfälle in 34,0 s. Die normale Gesamtprojekt-CI desselben Runs ist ein separater Job und noch nicht als abgeschlossen behauptet. Alle DAL01-Kriterien und README erfüllt; #106 wird anhand dieses eigenen Jobbelegs geschlossen.
