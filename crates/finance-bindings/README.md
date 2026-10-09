# Rust-/WASM-/Swift-/Kotlin-Bindings

AGPL-3.0-or-later für eigene Quellen. Diese Bibliothek bindet den unabhängigen Rust-Kern über etablierte wasm-bindgen- und UniFFI-Generatoren an. Direktversionen und das vollständige Cargo-Lockfile sind gesperrt; ursprüngliche Drittanbieter-Lizenzen stehen im [Herkunftsregister](../../docs/dependency-provenance/rust-core.json). Generierte Fremdsprachenquellen werden unverändert unter test-results erzeugt und mit aktivem Compiler-Warnungsfehler geprüft.

`native` und `wasm` wählen die Bindings, nicht verschiedene Fachimplementierungen. Die vorhandenen K04-Bindings umfassen `execute_json`, `calculate_json`, `reverse_json`, `project_json` und `validate_json` für die implementierten Fachfunktionen. `contract-probe` ergänzt technische Transport-/Primitive-/Cachefälle. Produktintegration und gemeinsame Rust-Anwendungs-/Crypto-/DAL-Bindings bleiben eigene Zielaufgaben.

`pnpm test:core:bindings` erzeugt aus der echten nativen Bibliothek Swift-/Kotlin-Code, kompiliert die minimalen Harnesses und vergleicht denselben synthetischen Katalog mit nativer Rust-, tatsächlicher WASM-/Node- und Browserausführung. Swift benutzt die generierte C-Modulemap und dieselbe dynamische Bibliothek; Kotlin/JVM lädt sie tatsächlich über die geprüfte JNA-5.18.0-Testabhängigkeit. Deren gesperrter SHA256 wird vor Nutzung geprüft. Compiler werden nicht durch Mocks oder generierte Dateien allein ersetzt.

Der vollständige Sprachlauf benötigt vorhandene Swift-/Kotlin-/Java-Werkzeuge; WIMM_SWIFTC/WIMM_KOTLINC/WIMM_JAVA können Pfade setzen. Der Java-Standardpfad des macOS-arm64-Belegs ist die lokale Homebrew-JDK-21-Installation. Andere Zielumgebungen setzen WIMM_JAVA. `pnpm test:core:wasm` bezeichnet ausdrücklich den Rust-/WASM-/Browserteil und ist in regulärer Prüfkette/Ubuntu-CI aufgenommen; es behauptet keinen Swift-/Kotlin-CI-Lauf.

Generatorgrundlagen: [UniFFI-Procedural-Macros und Sprachcode](https://mozilla.github.io/uniffi-rs/latest/tutorial/foreign_language_bindings.html), [wasm-bindgen für wasm32-unknown-unknown](https://wasm-bindgen.github.io/wasm-bindgen/reference/rust-targets.html). Kein neuer eigener Kryptocode, keine neue native Produktoberfläche und keine echte Geräte-/GUI-/Screenreaderabnahme aus dem K03-Harness.

## AR02 — typisiertes V2-Binding

Die Nutzerentscheidung B ist in ADR-053 festgehalten. `calculate_money_v2` nimmt einen generierten `MoneyRequestV2` und liefert einen `MoneyResultV2` mit Bindingversion 2, Status, sicheren Cent oder stabilem Fehlercode/deutscher Meldung. Rust/Swift/Kotlin verwenden ganze 64-Bit-Cent; der WASM-Getter stellt ausschließlich bereits geprüfte sichere Cent exakt als JavaScript-Zahl dar. Die WASM-Requestklasse wird beim Aufruf übernommen; die Ergebnisinstanz ist mit `free()` freizugeben. Ungültige Versionen werden vor Berechnung abgewiesen, einschließlich nichtganzzahliger/übergroßer WASM-Versionen ohne u32-Trunkierung.

Die V1-JSON-Einstiege bleiben unverändert. `MoneyResultV2::to_v1_json` ist ein expliziter Ausgabeadapter; er ändert weder Finanzschema noch Storage-/Crypto-/Transport-/Exportversionen. Der Test vergleicht zusätzlich V1 und V2 gegen dasselbe Geldorakel. Der Abschnitt deckt ausschließlich die bestehende Aktion `money.parse` ab; weitere Aktionen, vollständige Formschemas sowie lokale/öffentliche Module sind noch keine AR02-Abnahme.

```sh
pnpm generate:contracts:bindings
pnpm check:contracts:generated
pnpm test:contracts:bindings:v2
pnpm test:contracts:bindings:v2:all
```

Der letzte Befehl verlangt tatsächliche Swift-/Kotlin-/Java-Werkzeuge und führt alle 17 gemeinsamen synthetischen Fälle zusätzlich über beide nativen Sprachbindings aus. Kein automatisches Überspringen oder Ersatzlauf. Standardprüfung/Ubuntu-CI führen native Rust-Assertions, Sprachdriftvergleich, WASM/Node und Chromium/WASM aus. Beide WASM-Laufzeiten ergänzen sechs Versionstrunkierungsfälle; Node weist zusätzlich ein fremdes Requestobjekt ab. Generierte Definitionen liegen versioniert unter [private-v2](../../packages/contracts/generated/private-v2/README.md). Datierte Abnahme und genaue Grenzen in [AR02](../../docs/ar02-contract-generation.md).

`execute_v2` ergänzt den tatsächlichen nativen Befehlsaufruf für alle 22 Arten mit gemeinsamem `Request` und versionierter `CommandOutcomeV2`-Union. Er ruft den typisierten Kern ohne JSON-Rekonstruktion auf. Fachfehler und native Form-/Headerkonvertierungsfehler sind typisierte Exceptions mit code/detail; die CLI-/Frontenddarstellung benötigt keine Auswertung des Throwable.message-Texts. Der V1-Ergebnisadapter erhält die bisherigen JSON-Ergebnisformen. `contract-probe` ergänzt ausschließlich technische Form-/Ergebnisadapter für den gesperrten Testkatalog.

`pnpm test:contracts:commands:native` prüft 176 unveränderte Befehlsorakel mit direkter Rust-Assertion und echten Swift-/Kotlin-Records/Enums. Jeder Fremdsprachfall decodiert zunächst die synthetische V1-Fixture über den ausdrücklichen Formadapter, überträgt den erhaltenen Sprachrecord erneut an `execute_v2` und prüft das vollständige Ergebnis. Sieben zusätzliche Fälle ändern die Sprachobjekte direkt: Version, Version plus ungültige UUID, Fachversion plus ungültige UTC-Zeit, UUID, UTC-Zeit, leere Pflichtliste und unsicherer Centbetrag. Beide Laufzeiten müssen strukturierte Codes liefern. Der Befehl verlangt die zuvor mit Prüfsumme gesicherte JNA-Testabhängigkeit des Geldsprachlaufs. Generatoren erzeugen/kompilieren beide privaten nativen Module; kein Schemaersatz oder Sprachmock.

`execute_v2` ist jetzt auch ein tatsächlicher WASM-Objektaufruf mit generiertem TypeScript-Request/Ergebnis aus derselben Rust-Quelle. Die äußere Standard-JSON-/Serde-Grenze erhält strikte Felder, Zahlformen und Null/Abwesenheit; intern bleibt die Fachausführung vollständig typisiert. Stringify-Fehler wie Zyklen werden fallible abgefangen und als versionierter strukturierter Fehler geliefert. Der ungeprüfte gloo into_serde/unwrap_throw-Eingabepfad wird nicht verwendet. Native und WASM-Fehler enthalten Bindingversion 2, code/detail.

`pnpm test:contracts:commands:wasm` prüft 176 unveränderte Befehlsorakel plus dieselben sieben Sprachobjekt-Negativfixtures, acht Formnegativfixtures und zwei JavaScript-Datenfälle in echtem WASM/Node und Chromium/WASM. Direkte Rust-Assertions ergänzen den Formvergleich. Dieser Lauf ist in der regulären V2-Prüfkette/CI enthalten. `pnpm test:contracts:commands:native` prüft dieselben 176/sieben Fälle in tatsächlichem Swift/Kotlin; weitere Engineaktionen und öffentliche/lokale Module bleiben in #116 offen.

`project_v2` und `validate_v2` übertragen gemeinsame generierte Bestandsrequests und Ergebnisrecords mit Version 2/typisiertem Status. Projektion und Bestands-/Mutationsvalidierung bleiben vollständig im Kern. Die WASM-Objektgrenze verwendet denselben strikten falliblen Header-/Serdeadapter wie execute_v2.

`pnpm test:contracts:state:native` prüft alle 110 unveränderten Katalogorakel in Rust/Swift/Kotlin; 87 tatsächlich konstruierbare Fälle werden als native Records/Enums an die V2-Fachaktionen übertragen, 23 Formen bereits vorher abgewiesen. `pnpm test:contracts:state:wasm` prüft dieselben Orakel in echtem WASM/Node und Chromium: 109 Objektaufrufe und eine vorgeschaltete JSON-Syntaxablehnung. Die tatsächlichen Aufrufzahlen werden explizit geprüft; direkte Rust-Fachassertions ergänzen die Sprachvergleiche. Ergebnisse und Grenzen im AR02-Snapshot.

`reverse_v2` ergänzt die direkte Gegenbefehlsaktion mit gemeinsamen `ReverseRequest`-/`ReverseTarget`-Typen und demselben `CommandOutcomeV2` wie execute. previous bleibt optional/nichtnullable, targets nichtleer. Die beiden Bestandsprüfbefehle decken zusätzlich alle elf Gegenbefehlsorakel als tatsächliche typisierte Aufrufe ab: insgesamt 121 Orakel, 98 native Fachaufrufe und 23 vorgeschaltete Formablehnungen bzw. 120 WASM-Objektgrenzenaufrufe und eine JSON-Syntaxablehnung. Direkte native Kernassertions prüfen die elf vollständigen Gegenbefehlsresultate.

`calculate_v2` ergänzt den gemeinsamen typisierten Request/Ergebnisvertrag für money.parse/rule.apply/import.classify/schedule.dueDates. Alle vier Berechnungen und ihre Klassifizierungs-/Fälligkeitsformen bleiben im Kern bzw. der gemeinsamen privaten Rust-Typquelle. Die Aktionsprüfbefehle decken jetzt 204 Orakel ab: 178 native typisierte Fachaufrufe/26 Formablehnungen bzw. 203 WASM-Objektgrenzenaufrufe/eine JSON-Syntaxablehnung. Zusammen mit den 176 execute-Fällen sind alle 380 produktiven Katalogorakel abgedeckt; Vollständige Schema-/Modul-/Negativabnahme ist im abschließenden AR02-Snapshot belegt.

`pnpm test:contracts:schema` ergänzt den echten Rust-/Ajv2020-/WASM-Vergleich für 380 produktive Katalogformen plus 44 Formgrenzfälle, vollständige private V2-Ergebnis-/Fehlerschemas und eine tatsächliche negative CI-Quellendriftprüfung. Die Ergebnisse liegen zusammen mit den Sprachdateien versioniert im privaten generierten Modul. Die gemeinsame CommandOutcomeV2-Quelle liegt nun in WiMMPrivateTypes; bestehende native Funktionssignaturen importieren diese Quelle automatisch. Die abschließende AR02-Abnahme ergänzt sämtliche Kompatibilitäts-/lokalen/öffentlichen Formen; siehe Abschlussabschnitt unten.

## Architekturstand vom 9. Oktober 2026

Bestand und Ziel sind getrennt: [gemeinsame Rust-Architektur](../../docs/architecture.md). Hier dokumentierte Funktionen und Arbeitsregeln beziehen sich auf den Bestand; neue Rust-Anwendungs-/DAL-/Serverumstellung ist noch nicht implementiert. Aktuelle Aufträge und Kriterien in tasks.md/GitHub; historische Belege ersetzen keine Zielabnahme.

## Vollständige AR02-Vertragsabnahme

`pnpm test:contracts:acceptance` führt die reguläre generierte Schema-/Sprachdriftprüfung, native Rust-Assertions, tatsächliches Swift/Kotlin, drei WASM-Module/Node und Chromium für private/public/local Formen aus. Ergänzend V1-Regression über test:core:bindings. Alle 14 lokalen Snapshotaggregate bleiben flach, Originalentwürfe opak und unverändert; elf Portanfragen haben eigene Version-/Resultat-/Fehlerformen. Genehmigte Modul-/Kompatibilitätsabnahme und genaue Grenzen im AR02-Snapshot. Keine Backend-/Crypto-/Produkt-/Geräteabnahme aus Formannahme.
