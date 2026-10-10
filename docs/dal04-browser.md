# DAL04 — Aktueller Browser-SQLite-Abschnitt

Stand: 10. Oktober 2026. [#109](https://github.com/mpwg/WiMM/issues/109), [#146](https://github.com/mpwg/WiMM/issues/146), [#114](https://github.com/mpwg/WiMM/issues/114). Keine historische Datenübernahme nach ADR-060. Native Grundlage auf 2ee0cdf; #108/#147 nach erfolgreicher vollständiger Ubuntu-CI auf c4a0844 wieder als COMPLETED geschlossen.

## Implementierter Abschnitt

[Browser-Rust-Laufzeit](../crates/browser-runtime/README.md) übernimmt dieselbe aktuelle Diesel-Verbindung, denselben vollständigen Schema-/CAS-/Snapshot-/Sync-/Index-/Commit-/Receiptcode und denselben Rust-Fachkernvalidator wie Tauri. Explizite leere Initialisierung ist von der schemaerhaltenden Verbindungskonstruktion getrennt. OPFS-VFS wird ohne Rücksetzen installiert; echte Dateiexistenz entscheidet über frische Initialisierung. Keine andere Datenbankimplementierung, Kopie von Finanzregeln, SQL-/Pfadparameter oder stiller Speicherfallback.

Rust-basierte typisierte WASM-Einstiege sind über den produktiven Dedicated Worker erreichbar. Web Lock schützt die gesamte Verbindungslebensdauer, einschließlich tatsächlich freigegebener OPFS-Handles. Zweiter Tab wartet, bis der vorherige Besitzer schließt. Keine automatischen Wiederholungen bei verlorenem Ergebnis; Ressourcen und Nachrichtenfristen begrenzt. Worker liefert ausschließlich sichere strukturierte Fehlerhüllen. Die Testseite konsumiert diesen produktiven Worker, kein separates Probe-Speicherbackend.

## Kriterienmatrix

| #109-Kriterium | Aktueller Stand |
| --- | --- |
| Tatsächlicher gemeinsamer Rust-ORM-/OPFS-DAL | Typisierter Worker auf aktuellem physischem Schema fünf implementiert und in Chromium/Firefox/WebKit geprüft. PWA-Composition-Root verwendet jetzt den gemeinsamen Rust-/OPFS-DAL; weitergehende Rust-Controllerumschaltung bleibt offen. |
| Offline und vollständiger Browserneustart | Vollständiger Neustart aller drei Browserprozesse mit persistentem Profil erhält synthetische P5-Aggregate, Bestätigungen, Originalentwürfe, Projektionen und Cursor. Offline-Produktionsassets noch offen. |
| Zwei Tabs und Führungswechsel | Tatsächlicher Web Lock hält zweiten Tab zurück; Close gibt OPFS-Handles frei, neuer Besitzer öffnet identischen Zustand. Dauerhafte Receipts, gleiche Operationsidentität/Inhaltsabweichung und stale CAS nach tatsächlicher Tabübergabe/Neuöffnen zusätzlich geprüft. Absturz-/Commitunklarheitsmatrix noch offen. |
| Persistenzablehnung, Quota und Fehler | Sichere Rust-/Workerfehler und begrenzte Pending-RPCs implementiert; tatsächliche Persistenz-/Quota-/Draft-/Oberflächenmatrix noch offen. |
| Drei Browser, Rust-Anwendung/Ports/Views | Native Rust-Assertion auf echter SQLite und tatsächlicher Portgrenze bestanden. Chromium/Firefox/WebKit je fünf tatsächliche Fälle bestanden. Private WebKit-Standardkontexte verweigern OPFS; separat tatsächliche Ressourcenabweisung vor Write geprüft. Reguläre Persistenzfälle laufen auf echten persistenten Browserprofilen, nicht auf einem Ersatzspeicher. Kein physischer iOS-Nachweis. Gemeinsame vollständige Anwendungs-/Views-/Katalogintegration noch offen. |
| 50.000 Buchungen und vorhandene Grenzen | Native Grundlage geprüft; neue Browser-Kaltöffnung/Listen-/Filter-/Scrollprobe noch offen. Keine Grenzlockerung. |

## Prüfbelege und Befehle

Aktive Linux-x86_64-Arbeitskopie mit gesperrten Bibliotheken. Native Browserhost-Assertion prüft aktuelle reale SQLite-Datei, explizite vollständige Initialisierung, profilgebundenes Neuöffnen, fremde Profile und Versionsabweisung vor Write. Tauri-Suite nach Auslagerung des identischen Validators: 14 erfolgreich, ein absichtlich ignorierter Prozesstreiber. Root-Typecheck, Lint, native/WASM-Clippy und Architektur-/Paketgraphprüfung erfolgreich. Gemeinsame DAL-Regressionsprüfung nach Verbindungsfactory-/Validatorauslagerung ebenfalls erfolgreich: 40 aktuelle native Adapter-, fünf Backup-, elf Memory- und zehn frühe Probe-Testeinträge. Rust-abgeleitete Worker-Signaturen ohne Umschreiben geprüft; absichtlich veränderte Signatur in isoliertem Testverzeichnis ohne Überschreiben abgewiesen.

```sh
cargo test --locked -p wimm-browser-runtime
pnpm build:browser:runtime
env -u NO_COLOR pnpm exec playwright test --config tests/browser-storage/config.ts
cargo test --locked -p wimm-local-dal --all-features
cargo test --locked --manifest-path apps/desktop/src-tauri/Cargo.toml
pnpm typecheck
pnpm lint
pnpm check:target:architecture
pnpm check:package-graph
```

Keine gesamte DAL04-/Produkt-/Legacy-/Plattformabnahme aus diesem Abschnitt. Produktive Entfernung des IndexedDB-Vorgängers gehört zur vollständigen #109-Integration; Rust-Commitumschaltung bleibt #119. Frühere optionalen Probes und alte Binding-/Vertrags-/KDFformen bleiben #146.

## Aktuelle Drei-Browser-Prüfung

Je fünf reguläre Fälle auf tatsächlicher Chromium-/Firefox-/WebKit-OPFS: leere Bereichsepoche über Worker-/Seitenneustart, tatsächliche Tabwartephase und Handlefreigabe, vollständiger synthetischer P5-Bestand einschließlich bestätigter Daten/Originalentwürfe/Cursor, vollständiger Browserprozess-Neustart mit demselben persistenten Profil sowie Originalreceipt/Idempotenz/Inhaltsabweichung/stale CAS nach Tabübergabe und erneutem Neuöffnen. Alle 15 bestanden. Separater echter WebKit-Privatmodusfall: OPFS-Öffnung RESOURCE_UNAVAILABLE/notCommitted, verständlicher Status failed, kein Write oder Ersatzbackend. Bestanden. Aktuelle Root-Typecheck-/Lint-/Whitespaceprüfungen erfolgreich.

Die neuen typisierten Clientmethoden delegieren ausschließlich an die Rust-Commit-/Receipt-/Indexports; keine zweite JS-Speicher-/Finanzlogik. Die Feld-/Versions-/CAS-/Originalguards sind unverändert. Gesamt-#109 bleibt offen; #108/#147 sind nach bestätigter vollständiger CI geschlossen.

## Gemeinsamer verschlüsselter Backupstore

Der bestehende native `SqliteBackupStore` verwendet jetzt dieselbe explizite Initialisierung und schemaerhaltende Verbindungskonstruktion auf nativer SQLite und WASM/OPFS. Der Browserworker hält eine getrennte feste Chiffratdatei im selben OPFS-VFS. Typisierte Rust-abgeleitete `persist_backup`-/`read_backup`-Einstiege prüfen das aktive Profil vor dem Zugriff; vollständiger Receipt-Scope und Duplikatverbot bleiben im gemeinsamen DAL. Close gibt beide SQLite-Verbindungen vor dem VFS frei. Schlüssel und Entschlüsselung gelangen nicht in den DAL-Worker.

Aktuelle native Assertions prüfen zusätzlich direkte gemeinsame Verbindungskonstruktion, Ablehnung erneuter Initialisierung und unveränderte Chiffrate nach Wiederöffnung. In Chromium, Firefox und WebKit wird ein ausschließlich synthetischer Prüfsnapshot mit dem bestehenden libsodium-XChaCha20-Poly1305-Protector verschlüsselt, über den produktiven Worker gespeichert, nach Seiten-/Workerneustart bytegleich gelesen und im Client entschlüsselt. Fremdes Profil und überschreibendes Duplikat werden abgewiesen; Originalbytes bleiben erhalten. Diese drei Fälle bestanden. Der anschließende vollständige aktuelle Browserlauf bestand mit 19 erfolgreichen Fällen (18 reguläre Fälle, ein echter WebKit-Privatmodusfall); die nur für WebKit geltende Privatmodusprüfung ist in den zwei anderen Browserprojekten bewusst übersprungen. Native Backup-Suite: sechs erfolgreiche Assertions. Typecheck, Lint, native/WASM-Clippy, positive WASM-Signaturdriftprüfung, Architektur-/Paketgraph-/Dokumentations- und Whitespaceprüfung ebenfalls bestanden. Der Protector ist der bestehende Clientadapter, kein neuer kryptografischer Algorithmus. Ein vollständiger Rust-Restore-/Anwendungsnachweis folgt weiterhin im offenen Integrationsumfang.

```sh
cargo test --locked -p wimm-local-dal --all-features --test sqlite_backup
pnpm exec playwright test --config tests/browser-storage/config.ts --grep 'Verschlüsseltes Backup'
```

## Gemeinsame Rust-Sitzung im produktiven Worker

`crates/local-runtime` übernimmt die bisherigen Tauri-Runtimeports und deren native Assertions als gemeinsame native/WASM-Implementierung. Tauri reexportiert die gemeinsamen Ports; die alte Implementierung und die alte Testkopie sind entfernt. Der Browserhost teilt dieselbe einzelne profilgebundene SQL-Verbindung zwischen elf Speicherports, indizierten Abfragen, Rust-ClientRuntime, Commitreceipts und Originaljournal. Sitzungsschutz verwendet die vorhandenen Rust-libsodium-Primitive, Recovery-AAD und Snapshotformate. Schlüsselbesitz wird bei Sitzungsschluss gelöscht; kein neuer Kryptofallback.

Typisierte Workeraktionen öffnen/schließen eine Rust-Sitzung, führen Load/Execute/History/Resolve aus und liefern auf 100 Aggregate begrenzte Seiten. Seitenparameter durchlaufen die strikte Rust-Datengrenze einschließlich Ganzzahlprüfung. Falsche Versionen, zu große/gebrochene/NaN-Seitengrenzen werden abgewiesen. Nachrichtenhandler wird vor den asynchron geladenen Kryptomodulen registriert; dadurch geht die erste Öffnungsnachricht nicht während ihrer Initialisierung verloren. Build übernimmt die originalen Rust-generierten libsodium-Snippets reproduzierbar; versionierte Signaturen bleiben driftgeprüft.

Aktuelle native Prüfung: acht Runtime-Testeinträge einschließlich echtem Prozesswiederanlauf, falschem Schlüssel bei Originaljournal, verlorenem Ergebnis/Receiptlookup, lokaler Restoreepoche, Undo/Redo und zusätzlichem direkten Sitzungstest. Eine native Browserhost-Assertion sowie verbleibende sieben Tauri-Tests erfolgreich, ein bewusst ignorierter Tauri-Prozesstreiber. Keine native GUI-Abnahme hieraus ableiten.

```sh
cargo test --locked -p wimm-local-runtime -p wimm-browser-runtime
cargo test --locked --manifest-path apps/desktop/src-tauri/Cargo.toml
pnpm exec playwright test --config tests/browser-storage/config.ts --grep 'Gemeinsame Rust-Anwendung'
```

Aktueller vollständiger Drei-Browserlauf: 22 erfolgreich (je sieben reguläre Fälle und ein echter WebKit-Privatmodusfall), zwei bewusst übersprungene Privatmodusfälle außerhalb WebKit. Rust-Befehls-/Undo-/Redo-/Neuladefall in jedem Browser bestanden, einschließlich falscher Bindingversion und zu großer/gebrochener/NaN-Seitengrenzen. Typecheck, Lint, native/WASM-Clippy, Architektur-/Paketgraph-/Dokumentationsprüfung sowie absichtlicher negativer Signaturdrift ohne Überschreiben erfolgreich.

React-Controller/Composition-Root, vollständige Rust-Restore-/Recoverymatrix im Browser, Offline-Produktionsassets, Quota, gemeinsame Gesamtkataloge, indizierte begrenzte UI-Views und 50.000-Buchungen-Grenzen bleiben offen. Die laufende Sitzung lädt derzeit vollständigen Mutationsbestand; diese Abschnittsprüfung ist kein Leistungsnachweis. #109/#119/#146 bleiben offen.

## Produktiver PWA-Speicherpfad

Der reguläre PWA-Einstieg in `apps/web/src/app.tsx` verwendet `BrowserSqliteStorageAdapter`; der bisherige IndexedDB-Finanzpfad wird dort nicht mehr konstruiert. Der Adapter delegiert elf lokale Speicherports und drei indizierte Abfragen an die versionierte Rust-Grenze. Profilbezogene Referenzzählung teilt einen Worker zwischen Finanzansicht und temporärem Export; nur letzter Close beendet Verbindungen/Web Lock. Keine zweite JS-Datenbank, Dual-Writes oder Ersatzpersistenz. Geschlossene Adapter sind nicht wiederverwendbar. Optionale DTO-Felder werden zur Datenleitung ausgelassen; unzulässige opake Originalwerte, NaN, Zyklen und Getter werden vor dem Write abgewiesen, kein stilles Umformen von Entwürfen.

Projektionsneuaufbau liest den tatsächlichen Snapshot, lässt Centwerte ausschließlich durch den vorhandenen Rust-Fachkern berechnen und schreibt vollständigen Projektionsersatz mit Originalaggregat-CAS im DAL. Keine Erzeugung historischer numerischer Balancecacheformen. Native Rust-Assertion vergleicht gegen den unveränderten gesperrten Fachprojektionskatalog und prüft Originalerhaltung. Tatsächlicher Drei-Browser-Adapterfall teilt Finanz-/Exportverbindung, erhält Bestand/Originalentwürfe/Cursor und liest Rust-Projektionen nach vollständiger Worker-Wiederöffnung identisch. Vollständiger Browserlauf: 25 erfolgreich (je acht reguläre Fälle und WebKit-Privatmodus), zwei passende Überspringungen außerhalb WebKit.

Produktive Chromium-UI: neues lokales Profil anlegen/entsperren, Konto mit Anfangsbestand speichern, Seite neu starten/entsperren und dasselbe Konto wieder öffnen. OPFS-Verzeichnis tatsächlich vorhanden; keine `wimm-ui-`-IndexedDB-Finanzdatenbank entstanden. Ebenfalls Profilsperre/falsche Passphrase/Neustartprüfung bestanden. Produktionsbuild einschließlich Rust-WASM/Kryptosnippets und ES-Modul-Worker erfolgreich; keine Buildwarnung unterdrückt. Gemeinsame Rust-Sitzung ist weiterhin getrennt vom noch vorhandenen TS-Finanzcontroller; dessen tatsächliche Entfernung bleibt verpflichtend in #119/#120/#146.

Bei dieser Anbindung gefundener Generierungsdefekt [#148](https://github.com/mpwg/WiMM/issues/148): Tsify erzeugte ein Interface mit Union-Vererbung. Rustquelle verwendet nun explizite Intersection für das Serde-flache StoredAggregate. Drei tatsächliche generierte WASM-Deklarationen ohne skipLibCheck positiv geprüft, absichtlich alte Interfaceformen negativ abgewiesen; zwei native Rust-Assertions prüfen unveränderte flache Datenform, Handlepflicht und Tsify-Form. Generierte Dateien ausdrücklich aus Rust neu erzeugt; kein handgepflegter ABI-/Legacyadapter.

```sh
pnpm check:contracts:generated
cargo test --locked -p wimm-local-contracts --features wasm-bindings --test stored_aggregate_declaration
cargo test --locked -p wimm-client-application --lib
pnpm exec playwright test tests/ui/dal04-current-storage.spec.ts tests/ui/p4-1-3.spec.ts
pnpm --filter @wimm/web build
```

Vollständige Network-off-/Quota-/Recovery-/Checkpoint-/50.000-UI-/Gesamtkatalog-/Geräteabnahme weiter offen. Die aktuell erzeugte Debug-WASM-Größe ist kein bestandener Kaltöffnungsnachweis. Verbleibender IndexedDB-Code/Altprüfungen außerhalb des regulären PWA-Einstiegs gehören zur vollständigen Entfernung #146, nicht zu einer erlaubten Kompatibilitätsphase.

CI baut die ignorierten Rust-Workerassets vor produktiven Browserprüfungen. `test:storage:browser:rust` prüft zusätzlich Browserhost, gemeinsame Runtime, Clientanwendung und lokale Vertragsquelle nativ in `target/dal04-native`; dessen einheitliche Features vermeiden die Kollision unversionierter rlib-Buildprodukte mit den zuvor ausgeführten UniFFI-/WASM-Generatoren. Anschließend derselbe echte Drei-Browserkatalog. Ein im parallelen lokalen Generator-/Testlauf beobachteter rustdoc-Artefaktfehler wurde nach gezielter Artefakterneuerung vollständig ohne übersprungene Doctests geprüft; alle Tests bestanden.

## Echte Offline- und Quotaabschnitte

Gebauter regulärer PWA-Client in Chromium und Firefox: tatsächliches persistentes Profil, neues Konto mit Anfangsbestand, vollständiger Browserprozessneustart und vor erster Navigation ausgeschaltetes Netzwerk. Cache enthält den produktiven Worker und tatsächliche Rust-WASM-Datei; PWA startet gesperrt unter Service-Worker-Kontrolle, liest vollständige identische SQL-Snapshots und erlaubt neue lokale Kontoanlage offline. Ein getrennter ausschließlich synthetischer verbundener Testbereich enthält vollständigen P5-Bestand/Bestätigungen/Originalentwürfe/Projektionen/Cursor; byteidentischer Originalstand nach Offline-Neustart über unveränderten produktiven Buildworker geprüft. Kein Outboxeintrag im privaten Standalone-Produktbereich. Beide Fälle bestanden.

WebKit: derselbe Prozess-/Offlinefall scheitert bei erster Navigation trotz vorheriger Cache-/Kontrollbestätigung. Keine erfolgreiche Oberfläche im neuen Offlineprozess; erfolgreiche Traceantworten gehören zum vorherigen Prozess. Ursache Produkt-/SW-Lebensdauer oder Browser-/Playwright-Netzwerkemulation noch nicht entschieden. Zusätzliche erfolgreiche Antwort-/DOM-/Kontrollprüfung erfüllte den Nachweis ebenfalls nicht. [Delta #149](https://github.com/mpwg/WiMM/issues/149), kein physischer iOS-/Drei-Browser-Offlineabschluss.

Tatsächliche Chromium-Originquota über den Browser-QuotaManager (CDP Storage.overrideQuotaForOrigin) auf aktuelle Nutzung plus 4.096 Byte begrenzt. Reale OPFS-Speicherung eines gültigen synthetischen Zwei-MiB-Originalentwurfs wird mit sicherem Ressourcen-/Writefehler abgewiesen. Quota zurückgesetzt, Worker/Seite neu geöffnet: vollständiger vorheriger Snapshot unverändert. Derselbe unveränderte vergrößerte Auftrag anschließend erfolgreich; damit kein bloßer Form-/Fachfehler als Quotanachweis. Kein Mock-DAL, künstlich geworfener JS-Quotafehler oder Fehlerklassifikationswechsel. UI-Entwurfserhaltung und Firefox-/WebKit-Quota-/Persistenzmatrix weiter offen.

```sh
pnpm --filter @wimm/web build
pnpm exec playwright test --config tests/browser-storage/offline.config.ts --project chromium --project firefox
pnpm exec playwright test --config tests/browser-storage/offline.config.ts --project webkit
pnpm exec playwright test --config tests/browser-storage/config.ts --project chromium --grep 'Originquota'
```

Die neue vollständige Ubuntu-CI auf fcbef65 scheitert unabhängig an einer frühen AR05-Probeassertion für Abbruch/Writefehler. [#150](https://github.com/mpwg/WiMM/issues/150) führt Ursachen-/Umstellungsprüfung; die betroffene Probe ist ohnehin vollständig nach #146 zu entfernen. #148 bleibt bis aktueller gesamter CI offen. DAL01-/Receipt-/bisheriger Leistungsjob erfolgreich, keine Gesamtabnahme hieraus. Neue lokale Typecheck-/Lintprüfung bestanden; bei diesen reinen zusätzlichen Browsernachweisen blieb Rust-Produktcode unverändert.

## AR05-Prüfpfad auf dem aktuellen DAL und unabhängige Netzabschaltung

Der in #150 betroffene frühere sqlite_commit-Probetreiber wird von sämtlichen Clientanwendungs-Integrationstests nicht mehr importiert. Clientanwendung dev-dep verlangt nur sqlite, kein receipt-probe. Gemeinsamer Testconsumer delegiert Erzeugung/Öffnen/Lesen/Schreiben/Receiptlookup an denselben aktuellen SqliteWriter<CoreSnapshotValidator> wie die Plattformhosts. Keine eigene Schema-/SQLimplementierung oder Datenhaltung. Leere Erzeugung und bestehende Wiederöffnung sind explizit getrennt, einschließlich des zweiten Recoveryprozesses.

Die bestehenden Abnahmefälle bleiben erhalten: Abbruch, CAS, Originalhash/Replay, Scopewechsel vor/nach tatsächlichen Writes und nach COMMIT, verlorene Antwort, gesicherte Wiederaufnahme, Historie und alle Fach-/Gegenbefehlsorakel. Testseitige Fehlerinjektion fügt dem kopierten Auftrag einen ungültigen letzten Handle hinzu; vorherige echte SQL-Aggregatwrites müssen im aktuellen DAL vollständig zurückrollen. Ein physischer Datenträgerfehler wird daraus nicht behauptet. Scopewechsel an der zweiten tatsächlichen Abbruchgrenze verlangt zusätzlich ein angelegtes nichtleeres SQLite-Rollbackjournal vor dem Callback. Antwortverlust wird ausschließlich nach einem tatsächlichen erfolgreichen ORM-Commit erzeugt. Keine produktiven Sonderports, neue Legacysperre oder Änderung der Commitgewissheit.

Aktuell 38 native Clientanwendungs-Testeinträge einschließlich echter zusätzlicher Recovery-Childprozesse und Doctests erfolgreich; Clippy unverändert mit -D warnings. Vollständiger Application-Bindingpfad ebenfalls erfolgreich: Rust/WASM-Node, 387 gemeinsame Fälle, 382 tatsächliche Vorbereitungscalls, 140 vorbereitete Fälle und alle 22 Befehlsarten. Native SQLite-Assertions liegen im selben Pfad; sprachseitige Callbackfälle sind ergänzende synthetische Belege. Der frühere sporadische CI-Fehler ließ sich in 40 lokalen Wiederholungen nicht reproduzieren; daraus keinen bestandenen neuen CI-Lauf ableiten. #150/#148 bis neuer vollständiger CI offen.

Unabhängiger Linux-Netztest: eigener Vite-Previewprozess für jeden Browser, vollständige Cache-/Datenvorbereitung, Ende des ersten Browserprozesses; anschließend den eigenen Previewprozess tatsächlich beenden und Nichterreichbarkeit der Origin bestätigen, bevor ein neuer Browserprozess mit identischem persistentem Profil startet. Keine Playwright-Offlineemulation, kein erfolgreicher Live-Serverzugriff. Chromium/Firefox/WebKit starten aus dem Cache mit Service-Worker-Kontrolle, identischem produktivem Konto und vollständig identischen synthetischen Originalentwürfen/Bestätigungen/Cursor; lokale Writes weiterhin erfolgreich. Alle drei bestanden.

```sh
node scripts/test-application-bindings.mjs
WIMM_OFFLINE_STOP_SERVER=1 pnpm exec playwright test --config tests/browser-storage/offline.config.ts
```

Dieser zusätzliche Nachweis grenzt #149 ein: echte Servernichtereichbarkeit funktioniert auch in WebKit, dessen Playwright-Offlineemulation scheitert weiter. Navigator-onLine/echte physische Flugmodus-/iOS-/Safariabnahme bleiben davon getrennt; Ursache der Emulationsabweichung noch nicht abschließend belegt, Issue bleibt offen. Die ursprüngliche fehlgeschlagene Reproduktion bleibt erhalten; kein ersetzter Backendpfad oder Online-Warmstart als Kaltstart. Aktuelle Typecheck-/Lint-/Architekturprüfung grün; zwei Typfehler des nachträglich verschärften Quotatestfixtures (Readonly-Draft und DTO-Mutabilität) korrigiert, keine Speichersperre gelockert.

## Gemeinsamer Snapshotkatalog und direkte Rust-Negativgrenze

Die vier bestehenden gemeinsamen Snapshotfälle laufen mit aktueller logischer Version zwei auf dem regulären Rust-/OPFS-Adapter: leerer Bereich, verschlüsselter P5-/Originalentwurfsroundtrip mit tatsächlicher Wiederöffnung, 26 unveränderte Negativformen mit Originalerhaltung und Profil-/Bereichs-/Handletrennung. Ein Profilwechsel schließt den tatsächlichen Besitzer und öffnet den nächsten profilgebundenen Writer; kein zweiter Testbackend oder stiller Ersatzspeicher. Je vier Fälle in Chromium/Firefox/WebKit erfolgreich.

Dieselben 26 Negativvarianten sind als unveränderte gemeinsame Datenfunktion aus dem Katalog extrahiert und zusätzlich unmittelbar an den Rust-WASM-Port geschickt, ohne LocalAreaService/TS-Snapshotvalidator. Jede Variante wurde in jedem Browser mit sicherer Fehlerhülle abgewiesen; vollständiger Originalsnapshot blieb nach jedem Versuch unverändert. 78 tatsächliche Rust-Grenzablehnungen. Keine financial Goldenumschreibung oder abgesenkte Kriterien.

Bei weiterer F01-Neuaufbaukonformität gefundener [Fehler #151](https://github.com/mpwg/WiMM/issues/151): leere historische Monatscaches wurden gegen einen bereits um Monatsbuchungen gefilterten Bestand geprüft, sodass gültige Transferreferenzen fehlten. Der Fachkern bietet nun einen typisierten Monatsprojektionsschritt: vollständigen Originalbestand und Monat zuerst prüfen, erst danach Transaktionen für die Konsumprojektion auswählen. Alle Cent-/Summen-/Referenzregeln bleiben im Kern; Clientanwendung filtert keine Fachtransaktionen mehr.

Native Regression verwendet tatsächlichen gesperrten Transferprojektionsfall: leerer Monat liefert null Cent und keine Kategorien, unverändertes Original bleibt erhalten, beschädigter vollständiger Transferbestand und ungültiger Monat werden weiter abgewiesen. Gesamte Rust-Fachkern- und relevante Clientanwendungsassertions sowie Clippy mit -D warnings erfolgreich. Worker-WASM aus korrigierter Rustquelle ohne Signaturdrift erzeugt. F01-/Transfer-/Erstattungs-/Tombstone-/Monatscentwerte werden im Browser gegen die unveränderten bisherigen Zahlen geprüft; ausschließlich aktuelle accountBalance-/consumption-Adressen erwartet, keine neue Legacy-Balanceerzeugung.

```sh
cargo test --locked -p wimm-finance-core
cargo test --locked -p wimm-finance-core --test month_projection
pnpm exec playwright test --config tests/browser-storage/config.ts --grep 'Rust-Cachewerte|Snapshotkatalog|Negativsnapshots'
```

Die laufende vollständige CI auf 47e2497 gehört zum vorherigen Abschnitt und ist keine Prüfung dieses neuen Kernfixes. #109/#148/#149/#150/#151/Gesamtabnahmen bleiben bis jeweiligem vollständigem Nachweis offen.

Aktueller kombinierter Kataloglauf: 18 erfolgreich (je vier gemeinsame Snapshotfälle, ein direkter 26-Varianten-Grenzfall und ein F01-Neuaufbau-/Idempotenz-/Wiederöffnungsfall pro Browser). Typecheck einschließlich neuer Testconsumer, Lint, Dokumentation und Whitespace ebenfalls erfolgreich.

## Optimierter regulärer Workerbuild

Buildscript erzeugt den Browserworker jetzt aus dem Rust-Releaseprofil statt aus Debug-WASM. Öffentliche typisierte API unverändert; interne wasm-bindgen-Symbolhashes/ungenutzte Debugexports verändert und nach Diffprüfung ausdrücklich aus Rust neu erzeugt. Positive und absichtlich negative Driftprüfung ohne Überschreiben bestehen weiter. Aktuelle WASM-Datei 7.556.231 Byte statt vorher rund 19,95 MB; vollständiger warnungsfreier PWA-Produktionsbuild erfolgreich. Das ist keine neue Version, Veröffentlichung oder bestandene 50.000-UI-Leistungsabnahme.

Vollständiger aktueller Drei-Browserkatalog mit optimierter tatsächlicher WASM: 44 erfolgreich, vier ausdrücklich browserabhängige Überspringungen (WebKit-Privatmodus nur WebKit, Chromium-CDP-Originquota nur Chromium). Gebauter Client mit tatsächlich beendetem eigenen Previewserver und kaltem Browserprozess ebenfalls in allen drei Browsern erfolgreich, drei weitere Fälle. Native Rust-Fachkerntests zusätzlich im Releaseprofil bestanden; keine debug_assert-abhängigen Finanz-/Anwendungs-/DALguards. Typecheck und Gesamt-Lint nach Umbenennung des als React-Hook erkannten Testconsumernamens getOwner erfolgreich; die frühere Lintaussage des lokalen vorherigen Abschnitts war verfrüht.

Vorherige Ubuntu-CI auf 47e2497 scheitert jetzt unabhängig an dem bereits offenen CAMT-Leistungsfall #113; AR05-Umstellung läuft darin erfolgreich durch, ebenso DAL01-/Receipt-/bisheriger Leistungsjob und CodeQL. Vollständige aktuelle neue CI bleibt erforderlich.

## Aktueller Workspace- und 50.000-Buchungen-Prüfpfad

Die Workspace-Prüfseite verwendet jetzt ausschließlich denselben BrowserSqliteStorageAdapter wie die produktive PWA. IndexedDB-Erzeugung und direkte IndexedDB-Fixtureabfrage entfernt, kein Backendselektor oder Memoryersatz. Bestehende 50.000 Buchungen/10 Konten/100 Kategorien/36 Monate und sämtliche Beträge, Notizen, Split-, Treffer-, Virtualisierungs- und Scrollorakel unverändert. Die 1.000 ausschließlich synthetischen Zusatzlastdatensätze behalten ihre vollständigen bisherigen 100-Cent-/50+50-/Quell-/Kategorie-/Teilnehmerpayloads und werden als blockierte Originaldaten im isolierten Testbereich persistiert; keine untypisierte Projektionsart und keine neue P6–P11-Funktion. Anzahl über tatsächlichen Rust-DAL rückgelesen, kein konstanter Erfolgszähler.

Einmalige Fixtureerzeugung erwartet das vorhandene Bereitschaftssignal innerhalb des unveränderten 120-Sekunden-Testrahmens. Kaltöffnung weiterhin ab echtem Reload/Navigation bis vollständig dargestellter Liste nach zwei Browserframes, nicht erst ab Datenladung. Zugriff auf noch nicht eingerichteten asynchronen Testconsumer liefert ausdrücklich keinen Messwert; vor Messung tatsächlichen Wert verlangen. Unveränderte Grenzen: Kaltöffnung/warme Öffnung unter 2.000 ms, Filter-/Scroll-p95 unter 100 ms, fünf Vorläufe/30 Messungen und identische Datenorakel.

Aktuelle Chromium-Prüfung auf realer Rust-/SQLite-/OPFS: Web kalt 1.393,5 ms, warm 19,1 ms, Filter-p95 34,2 ms, Scroll-p95 33,7 ms; Desktopfrontend kalt 1.754,8 ms, warm 27,7 ms, Filter-p95 34,0 ms, Scroll-p95 33,6 ms. Beide Fälle bestanden. Desktopfrontend ist hier weiterhin Browser-/OPFS-Probe, keine native Tauri-/GUI-/SQLiteabnahme oder Drei-Browser-Leistungsabnahme.

Breite Workspace-Regressionsprüfung: zunächst 116 erfolgreich, acht Importfälle scheitern am übergebenen Parserfeld currency. [#152](https://github.com/mpwg/WiMM/issues/152): AutomationModel bildet den Fachkandidaten jetzt explizit aus Vertragsfeldern; Parser-/Originalvorschau bleibt erhalten, Rust-Unknownfieldguard unverändert. Zusätzliche Anwendungsassertion prüft Feldtrennung/Originalerhaltung; 26 Anwendungsfälle, Typecheck/Lint erfolgreich. Gezielter P5-Lauf danach 25 erfolgreich, drei offen: zwei Mehrtabfälle am tatsächlich einzigen Writer [#153](https://github.com/mpwg/WiMM/issues/153) und Web-Großimport mit 99.999 gespeicherten Zeilen [#154](https://github.com/mpwg/WiMM/issues/154). Desktop-Großimport besteht; keine Ursache oder stabile Abnahme aus dem einzelnen Gegenlauf behaupten. Keine Assertions/Fristen abgewählt oder finanziellen Orakel umgeschrieben.

Diese Paket-/Regressionsdeltas verhindern vollständige #109-/#152-Abnahme; der Abschnitt bleibt zunächst lokal, damit aktive vollständige CI fertigläuft und vor erneutem Push die tatsächlichen Integrationsdeltas bearbeitet werden.

## Persistenz-Prüfleser und robuste kontrollierte Testfreigabe

[#155](https://github.com/mpwg/WiMM/issues/155): Persistenztests lesen den aktuellen Konto-Bestand über denselben produktiven BrowserSqliteStorageAdapter wie die App. Dynamischer Testimport benutzt das vorhandene Modul und damit dieselbe profilgebundene Verbindung; temporärer Reader erhöht Referenzbesitz und schließt ihn anschließend. Kein neuer Worker hinter dem eigenen gehaltenen Lock, keine erzeugte Legacydatenbank oder echte Finanzdaten in Diagnosen. Vier tatsächliche Chromium-Fälle erfolgreich: StorageManager-Ablehnung/Freigabe sowie ausdrücklich getrennte Simulation fehlender/fehlerhafter API. Alle bisherigen Callcounts, UIzustände und Originaldatenassertionen unverändert.

[#154](https://github.com/mpwg/WiMM/issues/154) eingegrenzt: isolierter vorhandener 99.999-Zeilen-Fall bereits erfolgreich; die kontrollierte Testfreigabe konnte unter paralleler Last vor Registrierung des Verzögerungscallbacks eintreffen und verlorengehen. Testgate merkt nun eine frühe Freigabe bis zur tatsächlichen Pause. Keine Änderung produktiver Import-/SQL-/Commitlogik, kein vorgezogener Erfolg, Datensatzverkleinerung oder verlängerte Frist. Derselbe echte Worker-/Rust-OPFS-/Bedienbarkeits-/100er-Gruppen-/Fortschrittsfall anschließend sechsfach (Web/Desktopfrontend je drei, zwei parallele Testprozesse) erfolgreich. Das ist keine allgemeine Importleistungsabnahme oder native Desktopprüfung.

```sh
pnpm test:storage:persistence
pnpm exec playwright test --config tests/workspace/config.ts tests/workspace/p5.spec.ts --grep 'Großimport' --repeat-each 3 --workers 2
```

Aktuelle Typecheck-/Lintprüfung erfolgreich. CI-Nachprüfung steht für beide Deltas weiter aus; #109/#153 produktive Mehrtabintegration unverändert offen, keine abgeschwächte gleichzeitige Gruppenassertion oder alternative Datenbank.

## Produktive begrenzte Mehrtabdelegation

[ADR-061](decisions.md#adr-061--begrenzte-tabdelegation-an-einen-tatsächlichen-opfs-writer) konkretisiert den bestehenden tatsächlichen Dedicated-Worker-/Web-Lock-Pfad. Gleichprofiliger Follower wird bedienbar, indem begrenzte RPCs an denselben wirklichen SQLbesitzer delegiert werden. Keine zusätzliche OPFS-Verbindung, DBkopie, Finanz-/Commitlogik oder Backendwahl. Nur Besitzer kann Workerkommandos ausführen; Request-/Replykorrelation wird zwischen Peer und Owner übersetzt. Besitzerwechsel verwirft ausstehende Peerantworten konservativ unknown, ohne Wiederholung finanzieller Writes.

Lokale IPC-Payloads werden mit bestehenden libsodium-Sealed-Boxes empfängerbezogen geschützt; Peerkanal führt keine Finanzklartexte oder Runtime-Schlüssel im Routing. Routingkontext ist zusätzlich innerhalb des Payloads geprüft. Kurzlebiger geheimer IPCschlüssel wird beim Close gelöscht. Native Rust-Registry begrenzt clientgebundene Sitzungen auf 16, getrennte Historien/Schlüssel bei gemeinsamer SQL-Verbindung. Peerclose entfernt dessen Rust-Sitzung; SQLbesitzerclose beendet alle zugehörigen Sitzungen vor Freigabe. Bekannte Peers/Ausstehende RPCs begrenzt auf 64, bestehende 30-Sekunden-Frist unverändert. Trusted Same-Origin-Modell und offene reale Crash-/Suspendierungsfälle ausdrücklich in ADR dokumentiert.

Neun native Runtime-Testeinträge einschließlich neuem tatsächlichem SQLite-Mehrsessionfall erfolgreich: 16 angenommen, Duplicate/17. Sitzung abgewiesen, Historie getrennt, einzelne Entfernung erhält andere Sitzung, neue Sitzung nach Freigabe möglich, Clear entfernt alle. Node-/WASM-Werkersignaturen ausdrücklich aus Rust neu erzeugt, keine Kompatibilitätskomponente. Native/WASM-Clippy mit -D warnings und Typecheck/Lint erfolgreich.

Vorhandene gleichzeitige 200-Zeilen-Importübernahme in zwei wirklichen Tabs besteht für Web-/Desktopfrontend: genau 100 Buchungen und 100 Fingerprints, beide Statusantworten mit derselben bestätigten Gruppe. Drei-Browser-Mehrtab-/Privatheitstest liest komplette Originaldaten beim Follower, beobachtet tatsächliche Broadcasts ohne Originalnotiz/Klartextentwurf, öffnet beide Rust-Sitzungen und schließt den Follower ohne Verlust der anderen Sitzung. Originalreceipts/Replay/stale CAS und vollständige Bestandserhaltung nach tatsächlichem Besitzwechsel in allen drei Browsern erneut erfolgreich.

Breiter Workspace-Lauf aktuell 123/124 erfolgreich: nur Web-Großimportfall #154 unter paralleler Last erneut nicht stabil; die frühe Testfreigabekorrektur beseitigt damit nicht den gesamten verbleibenden Aufwand. Kein Zeit-/Daten-/Ergebnisguard abgewählt. #153/#109/#152/#154 und Gesamt-CI bleiben bis vollständiger jeweiliger Abnahme offen.

Aktueller vollständiger Drei-Browserlauf nach endgültiger verschlüsselter Tabdelegation: 47 erfolgreich, vier unveränderte ausdrücklich browserabhängige Überspringungen. Separate sechs tatsächliche Receipt-/CAS-/Followerprivatheit-/Mehrsessionfälle ebenfalls grün. Ein zwischenzeitlicher WebKit-Execution-Context-Abbruch trat während laufender Vite-Quelländerungen auf; unveränderter finaler Prüfstand danach vollständig erfolgreich. Native neun Runtimefälle, native/WASM-Clippy, positive/negative Signaturdriftprüfung, Typecheck und Lint erfolgreich. Keine Stilllegung fehlgeschlagener fachlicher Assertions.
