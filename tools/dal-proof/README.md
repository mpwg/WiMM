# DAL01 — nativer und persistenter Browser-DAL-Nachweis

AGPL-3.0-or-later. Abgegrenzter Prototyp zu [#106](https://github.com/mpwg/WiMM/issues/106), keine produktive Speicherumschaltung. Derselbe Rust-Code verwendet Diesel für synthetische Aggregate, Outbox und Projektionen; SeaQuery erzeugt das Schema und eine ausdrückliche nummerierte Indexmigration. Keine Finanzregeln, private Daten oder Klartext-Finanzbackups im Werkzeug.

## Stand und Grenzen

Direkte native Rusttests und zwei echte Prozess-/Verbindungsfälle bestehen. Chromium und WebKit bestehen jeweils fünf tatsächliche OPFS-/Worker-/Tab-/Neustart-/Origin-Rückkehrfälle mit dauerhaften isolierten Browserbereichen. **DAL01 ist vollständig abgenommen:** Der tatsächliche Ubuntu-Job auf 0076450 besteht fünf native Fälle, native Driver-/WASM-Builds und alle 15 Chromium-/Firefox-/WebKitfälle. Firefox startet auf diesem Mac vor der Testseite weiterhin nicht (`Could not find profile folder`); diese lokale Umgebungsgrenze bleibt getrennt. Keine Skips oder Ersatzbrowser als Firefoxbeleg. Aktuelle Kriterien und Fortsetzung im Issue; [datierter Nachweis](../../docs/dal01-proof.md).

PostgreSQL-/MySQL-Features wurden einschließlich tatsächlicher nativer Clientbibliotheken mit Diesel gebaut. Das ist keine native Server-DB-Verbindungs- oder Konformitätsabnahme; diese folgt in #98–#100. Der Origin-Rückkehrtest navigiert zwischen localhost und 127.0.0.1 ohne COOP/COEP und erhält den Stand; er behauptet keine ausgeführte OIDC-Provideranmeldung. Physische iOS-PWA und native Desktop-GUI sind hier ebenfalls nicht geprüft.

## Versionen und Bibliotheksgrenzen

Diesel 2.3.13, SeaQuery 1.0.2, native libsqlite3-sys 0.38.2, SQLite-WASM 0.5.5 und kompatibler OPFS-SAH-Pool-VFS 0.2.0. Diesel 2.3.14 wurde wegen Veröffentlichung am 7. Oktober nicht als reifer Kandidat gewählt. [Herkunft, Versionen, Lizenzen und gesperrter Abschluss](../../docs/dependency-provenance/dal-proof.json). Eigene Bibliothek, Binary und Tests setzen forbid(unsafe_code) und erben die globale Cargo-Sperre; FFI verbleibt in gepflegten Fremdabhängigkeiten.

Auf macOS muss ein WASM-fähiger LLVM-Archivierer verwendet werden. Der Apple-Archivierer erzeugte im ersten Versuch eine leere C-Bibliothek; der vorhandene /opt/homebrew/opt/llvm/bin/llvm-ar behebt den tatsächlichen Linkfehler. Der Starter prüft diesen Kandidaten bzw. WIMM_WASM_AR. Andere Umgebungen können WIMM_WASM_AR ausdrücklich setzen. Keine Veränderung globaler Compiler-/Shellkonfiguration.

Native Driverbuilds benötigen CMake und eine passende OpenSSL-Installation. Auf diesem Mac ist CMake 4.1.3 isoliert unter test-results/dal-proof/cmake-tools installiert, OpenSSL 3.5 vorhanden. WIMM_DAL_CMAKE/WIMM_DAL_OPENSSL_DIR können explizite Pfade setzen. scripts/dal-cmake.mjs übergibt ausschließlich beim unveränderten MySQL-Fremdbuild den dokumentierten WITH_SSL-Parameter, weil dessen Systemsuche den generischen Homebrew-Link bevorzugt. Kein Fremdquellpatch und keine globale SDKänderung. CMake kann bei Bedarf mit `python3 -m venv test-results/dal-proof/cmake-tools` und anschließend dessen `bin/pip install cmake==4.1.3` im Repository eingerichtet werden.

## Ausführung

```sh
pnpm test:dal:proof
pnpm test:dal:proof --project chromium --project webkit
cargo test --locked -p wimm-dal-proof
cargo clippy --locked -p wimm-dal-proof --all-targets -- -D warnings
```

Der erste Befehl verlangt sämtliche Browser; der zweite ist ausdrücklich eine Teilprüfung verfügbarer Laufzeiten. Der Starter baut dieselbe Bibliothek nativ/WASM, erzeugt reale wasm-bindgen-Gluequellen und startet den isolierten Testassetserver. Er ist kein lokaler HTTP-Speicherdienst. Produkt-Composition-Roots/Adapter bleiben unverändert.

## Verhalten und technische Ausnahmen

Öffnen initialisiert/migriert nicht automatisch. initialize erzeugt ausschließlich den leeren synthetischen Testspeicher; migrate akzeptiert den registrierten Schritt 1→2 unter Journal-CAS. Fehler nach Aggregatschreiben bzw. Index-/Journalschreiben rollt vollständig zurück. Batches prüfen erwartete Revisionen in einer unmittelbaren SQLite-Transaktion; zwei reale native Verbindungen akzeptieren genau einen konkurrierenden Write.

Ein Worker besitzt seine SQLite-/OPFS-Verbindung. Web Locks koordinieren denselben validierten Bereich; Tab-/Workerfehler beendet den Besitzer und gibt die Verbindung frei. Der Bereichsbezeichner erlaubt ausschließlich begrenzte alphanumerische/Dashwerte; keine Datei-/SQLpfade aus JavaScript. Browserprofile/Bereiche werden explizit isoliert, weil WebKit-Persistenz nicht allein anhand eines neuen Testkontextes angenommen werden darf.

Einzige handgeschriebene technische SQLausnahme: feste SQLite-PRAGMAs busy_timeout, foreign_keys und synchronous für Verbindungseinstellungen ohne Diesel-Query-DSL. Schema/Index-DDL entsteht aus SeaQuery; Lesen/Schreiben/Katalogabfrage aus Diesel. Eingabewerte sind gebunden. Keine eigene Kryptografie, kein VFS-Eigenbau und keine zweite Finanzengine.
