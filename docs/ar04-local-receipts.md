# AR04 — Dauerhafte lokale Commitreceipts

Stand: 10. Oktober 2026. [AR04 #118](https://github.com/mpwg/WiMM/issues/118) ist in Arbeit; Voraussetzungen #116/#117/#107 erfüllt. Dieser Snapshot beschreibt den geprüften ersten Persistenzabschnitt, keine vollständige AR04- oder Produktabnahme.

## Implementierter Abschnitt

`wimm-local-dal::sqlite_commit::SqliteCommitStore` implementiert den versionierten Rust-LocalCommitPort mit SQLite/Diesel. Aggregate, unveränderte Originaloutbox, vorbereitete Projektionen und Receipt werden in derselben unmittelbaren SQLite-Transaktion geschrieben. Diesel 2.3.13, SeaQuery 1.0.2, native libsqlite3-sys 0.38.2, sqlite-wasm-rs 0.5.5 und OPFS-SAH-Pool 0.2.0 sind exakt die bereits geprüften gesperrten DAL01-Versionen; keine neue Fremdversion. Standardfeature bleibt die plattformfreie Memoryreferenz; `sqlite` aktiviert denselben echten SQLite-Code nativ und WASM. Es gibt keinen stillen Persistenzfallback.

Öffnen erzeugt kein Schema. `initialize_area` erzeugt ausdrücklich nur das registrierte initiale Schema eins in einer leeren Datenbank, mit Profilbindung und Bereichsepoche. Fremde vorhandene Tabellen werden nicht übernommen oder überschrieben. Das Journal akzeptiert ausschließlich die bekannte Nummer/Profilbindung; unbekannte Versionen verhindern Writes. Es wird keine bestehende IndexedDB-/rusqlite-Datenbank migriert oder produktiv umgeschaltet. Destruktive Bestandsmigration/Sicherung bleibt gesondert nachzuweisen.

Die vollständige Operationsidentität und der unveränderte typisierte Request binden das Receipt; gleiche Identität/Inhalt liefert das ursprüngliche Ergebnis, Inhaltsabweichung wird abgewiesen. CAS, Bereichs-/Profil-/Epochenbindung, doppelte Einträge und atomare Fehler sind getrennte Guards. Datenbank-/Commit-/Rollbackfehler werden konservativ als unknown behandelt; kein Text-/Regexvergleich oder SQL-/Pfad-/Payloaddetail im Fehler. Die tatsächliche Ergebnisabfrage läuft auch nach einer neuen nativen Verbindung oder einem neuen Prozess.

## Aufbewahrung und Epochen

Receipts werden nicht automatisch gelöscht. Bekannte historische Receipts bleiben unter ursprünglichem Profil/Bereich/Epoche/ID abfragbar. Eine unveränderte Wiederholung einer bekannten Operation liefert das ursprüngliche committed-Ergebnis auch nach geändertem Epochencheckpoint und schreibt nichts erneut; eine neue unbekannte Operation mit veralteter Epoche wird abgewiesen. Dieses Verhalten wurde während AR04 in der Memoryreferenz korrigiert, [Bestandsdelta #135](https://github.com/mpwg/WiMM/issues/135).

Ein zukünftiger gesicherter Restore muss Receiptbestand und Inhaltsbindung zusammen mit dem atomaren Datenstand erhalten. Fremde Profil-/Bereichsreceipts dürfen nicht übernommen werden; neue Writes verwenden ausschließlich die autorisierte aktuelle Epoche. Alte Snapshot-/Exportformen enthalten noch keinen dauerhaften Receiptbestand und dürfen nicht still als vollständige neue DB-Sicherung verwendet werden. Der native Test verändert allein den technischen Epochencheckpoint und beweist Receiptaufbewahrung; er ist ausdrücklich keine vollständige Restore-/E2EE-/Backupabnahme.

## Tatsächliche Prüfungen

Aktive CachyOS-Arbeitskopie, Linux x86_64, Rust 1.99.0. Synthetische gemeinsame Eingabe in `crates/local-dal/tests/fixtures/receipt-request.json`.

```sh
cargo test --locked -p wimm-local-dal --all-features
cargo clippy --locked -p wimm-local-dal --all-targets --all-features -- -D warnings
pnpm test:storage:receipts
pnpm test:target:architecture
pnpm check:rust-format
```

- Elf tatsächliche native Memorytests und sechs echte native SQLitefälle: vollständiger Transaktionsrollback vor Receiptschreiben, Antwortverlust mit Wiedereröffnung, tatsächlicher Prozessneustart, Idempotenz/Inhaltsabweichung, Scope-/CAS-/Versionsguards, Öffnen ohne Schemaänderung und erhaltene historische Receipts nach Epochencheckpointwechsel. Beschädigte bekannte Receipts ergeben unknown und verhindern sowohl einen zweiten Write als auch eine falsche notCommitted-Antwort.
- Derselbe Rust-DAL wurde tatsächlich für WASM gebaut und über einen ausdrücklich synthetischen Prüfadapter mit echter OPFS-/SQLite-Verbindung in einem Worker ausgeführt. Keine produktive neue JSON-ABI aus diesem Prüfadapter; die Anwendung verwendet den typisierten Rust-Port.
- Chromium und Firefox: je vier tatsächliche Fälle mit dauerhaften Browserprofilen, Antwortverlust/gleiches Receipt, vierteiliger Rollback, Scope/CAS und vollständiger Browserprozessneustart. Acht Fälle erfolgreich, keine Skips.
- WebKit: vier Fälle vor der Testseite wegen fehlender Hostbibliotheken nicht ausgeführt. ICU 74.2 wurde aus dem SHA256-geprüften AUR-Paket gebaut; das signaturgeprüfte Arch-Flite 2.2 enthält nicht alle von diesem Playwright-WebKit erwarteten Sprachbibliotheken. Die isolierte Laufzeitprüfung mit beiden Paketen behebt ICU, lässt WebKit konkret weiterhin offen. Keine Majorversionssymlinks, Prüfgrenzenlockerung oder umetikettierte Firefoxfälle. Der unabhängige [Ubuntu-DAL-Job auf 34094b4](https://github.com/mpwg/WiMM/actions/runs/38031346187/job/114152813736) ist tatsächlich erfolgreich: sechs native SQLitefälle und zwölf echte OPFS-/Receiptfälle in Chromium/Firefox/WebKit, einschließlich vollständiger Browserprozessneustarts. Jobzustand und vollständiges Joblog rückgelesen; derselbe Job besteht zusätzlich die unveränderten fünf nativen/15 Browser-DAL01-Fälle. Die lokale WebKit-Umgebungsgrenze bleibt lokal bestehen. Beim ersten erfolgreichen Lauf entstehen wegen retain-on-failure keine Browsertraceartefakte; die Folgekonfiguration speichert deshalb einen maschinenlesbaren JSONreport auch für erfolgreiche Läufe.
- Zielabhängigkeitsprüfung, strenges Allfeature-Clippy, Vertrags-Typecheck, Oxc und Whitespaceprüfung bestanden. Die native AR11-Prüfkette aktiviert nun das registrierte `receipt-probe`-Feature, damit echte SQLtests nicht hinter Default-Memorytests verschwinden.

Ein breiter zusätzlicher `pnpm check:ci`-Versuch scheiterte am bestehenden separaten Tauri-Rustfmt-Befund [#134](https://github.com/mpwg/WiMM/issues/134); kein vollständiges grünes CI daraus behauptet. Ausschließlich Zeilenumbrüche auf 233d1a0 korrigiert, strenge Formatprüfung anschließend erfolgreich.

## Abschlussgrenze

#118 bleibt offen für vollständige gesicherte Schema-/Receiptbackup-/Restore-Kompatibilität und den verlangten Nachweis der Abbruchsemantik. Keine Produktumschaltung, keine vollständige Implementierung aller SQLite-Storage-/Index-/Migrationsports und keine #108/#109-/Gesamtarchitektur-/P6–P11-/Releaseabnahme aus diesem Abschnitt. Fortschritt und alle verbleibenden Kriterien ausschließlich in #118.

Der separate [Ubuntu-Leistungsjob desselben Commits](https://github.com/mpwg/WiMM/actions/runs/38031346187/job/114152813867) ist fehlgeschlagen: Web kalt 2.463,0 ms statt unter 2.000 ms, Desktop-Frontend kalt 1.429,8 ms. Warme Reaktionen innerhalb Grenzen. Neuer aktueller Befund [#136](https://github.com/mpwg/WiMM/issues/136); keine Ursachenzuordnung zum nicht produktiv angeschlossenen Rust-DAL aus diesem Einzelvergleich und keine Gesamt-CI-Freigabe aus dem erfolgreichen DAL-Job.

## Vollständiger Folgeabschnitt — lokale Abnahme am 10. Oktober 2026

Neue private `LocalCommitCheckpoint`-Form eins mit physischer Schemaversion eins bewahrt konsistenten Datenstand und ursprüngliche Request-/Receipteinträge. Bestehende Snapshot-/Export-/Crypto-/Bindingdimensionen bleiben unverändert. Der erste Commitstore weist bestätigte/Syncdaten ausdrücklich ab; diese werden bis zum vollständigen DAL-Ausbau nicht still verworfen. ADR-055 beschreibt die technische Konkretisierung.

`backup_checkpoint` prüft den tatsächlichen Fach-/Cachestand über den injizierten Fachkern, verschlüsselt über den vorhandenen SnapshotProtectionPort und verlangt dauerhaftes Speichern und bytegleiches Rücklesen durch BackupReadPort. Vor destruktivem Restore müssen Receiptmetadaten und gesamter Checkpointhash zum Original passen. Der aktuelle SQLite-Stand wird einschließlich Receiptbestand unter derselben Transaktion erneut verglichen. Restore verwendet ausschließlich die vorbereitete Clientepoche, erhält bekannte historische Receipts und weist Inhaltskollisionen/fremde Bereiche ab. Fehler und Abbruch rollen alle Datenänderungen zurück. Keine Klartext-Sicherungsdatei oder produktive Speicherumschaltung.

Tatsächliche native Abnahme: elf Memorytests, sechs SQLite-Receiptfälle und vier zusätzliche SQLite-Abbruch-/Backup-/Restore-/Schemafälle. Darin mehrere negative Unterfälle: fehlende Ausgangssicherung, Backupfehler, falscher Schlüssel, manipuliertes Chiffrat, fremdes Profil, ungültiger Finanzcache, Abbruch, Fehler nach tatsächlichem Datenersatz, konkurrierender Write zwischen Sicherung/Restore und unsupported/fremdes Schema. Native Tests verschlüsseln mit der tatsächlichen bestehenden Rust/libsodium-Implementierung, speichern Chiffrat in einer echten Datei und rufen sync_all vor Rücklesen auf. Finanzvalidierung bleibt ausschließlich im tatsächlich injizierten Rust-Fachkern.

Chromium/Firefox lokal: je sieben echte SQLite/WASM-/OPFS-Fälle mit dauerhaften Browserprofilen, unabhängigem Rust-Cryptomodul und tatsächlichem OPFS-SyncAccessHandle für verschlüsselte Ausgangssicherung (write/flush/read). Nach Restore wird die Verbindung neu geöffnet; ursprüngliche Receipts bleiben unverändert auffindbar. Vor COMMIT beobachteter Abbruch erzeugt notCommitted/CANCELLED und Rollback; nach tatsächlichem COMMIT beobachteter Abbruch bleibt committed. Verspäteter Abbruch bei bekannter Wiederholung deutet das ursprüngliche Ergebnis nicht um. Ein unabhängiger vollständiger Drei-Browser-Lauf folgt nach Veröffentlichung, bis dahin kein neuer lokaler WebKitbeleg.

Native Checkpoint-Serde-/Versions-/Scope-/Receiptkorrelationsguards und ein ergänzender AJV-Schematest bestehen. Neue drei Formschemas und Swift-/Kotlin-/TS-Datenmodelle aus Rust generiert; vorhandene Swift/Kotlin-Portorakel tatsächlich erneut ausgeführt. Relationale Guards und Inhaltshashprüfung bleiben zusätzlich zum Standardschema Pflicht.

Reproduktion:

```sh
cargo test --locked -p wimm-local-dal --all-features
cargo test --locked -p wimm-local-contracts
pnpm test:storage:receipts
pnpm test:contracts:ports:native
pnpm test:contracts:local
pnpm check:contracts:generated
```

Zusätzlicher CI-Befund [#137](https://github.com/mpwg/WiMM/issues/137): Tsify-Deklarationscustomsections wurden abhängig von der Codegen-Aufteilung teilweise verworfen. Der Vertragsgenerator baut WASM nun ausdrücklich mit einem gemeinsamen Codegen-Unit, erfasst vollständige unveränderte Rust-Deklarationen und erhält die strenge byteweise/negative Driftprüfung. Kein Entfernen zusätzlicher Typen, Abschwächen von unsafe/Warnungen oder Ändern von Golden-Katalogen. Lokale Generierung und Checkmodus bestanden; unabhängiger Ubuntu-Nachweis folgt. Die normale Produkt-Runtime-Buildkonfiguration wird dadurch nicht global geändert.
