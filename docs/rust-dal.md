# Gemeinsamer Rust-DAL mit typisiertem ORM

## Auftrag und Status

Nutzerauftrag vom 9. Oktober 2026: ausschließlich Konzept, Architekturvorschlag und GitHub-Tracking anlegen. Die Konzeptanlage ist freigegeben; DAL01–DAL07 sind **offen, nicht zur Implementierung freigegeben**. Auch Machbarkeitscode, Prototypen, Installationen und Datenmigrationen benötigen einen gesonderten Implementierungsauftrag. Bestehende Freigaben für K01–K11 und lokale Speicherdeltas bleiben in ihrem bisherigen Umfang erhalten; sie erteilen keine Freigabe für den neuen DAL-Strang.

[Aufgaben](tasks.md#dal--gemeinsamer-rust-dal-konzept-und-issuetracking) führt Auftrag und zusammengefassten Status. [ADR-049](decisions.md#adr-049--gemeinsamer-rust-dal-mit-orm-als-architekturvorschlag) ist vorgeschlagen, nicht angenommen. Das [bisherige Portabilitätskonzept](core-and-sql-portability.md) bleibt für den freigegebenen K-Auftrag verbindlich: lokal SQLite im Desktop, IndexedDB in der PWA. Dieses Dokument beschreibt einen zusätzlichen Vorschlag, keine bereits erfolgte Umschaltung.

## Bestand und Ziel

Aktuelle Einbindungen und Manifeste wurden am 9. Oktober 2026 in der aktiven Arbeitskopie geprüft:

| Umgebung | Bestand | Vorgeschlagenes Ziel |
| --- | --- | --- |
| Web/PWA | `IndexedDbStorageAdapter` in `@wimm/storage`, Dexie 4.4.6 | Gemeinsamer Rust-DAL als WASM im Worker, SQLite mit dauerhaftem Browserspeicher |
| Native Desktop-App | `DesktopStorageAdapter`, katalogisierte Tauri-Kommandos, Rust/rusqlite 0.40.2 | Derselbe lokale Rust-DAL mit nativem SQLite-ORM-Backend |
| Desktopfrontend ohne Tauri | IndexedDB für Frontendtests | Browser-DAL für Frontendtests; keine native Abnahme dadurch |
| Server | Fastify mit Health-/Metadatenrouten, noch kein produktiver Datenbankspeicher | Native Rust-Anbindung an Fastify, ORM-basierte Serveradapter für SQLite, PostgreSQL und MySQL/InnoDB |
| Unit-Tests | Memoryadapter und isolierte Speicherfixtures | Memoryadapter hinter denselben Ports; echte DBs für Persistenzabnahme |

Belege: [Web-Composition](../apps/web/src/app.tsx), [Desktop-Composition](../apps/desktop/src/app.tsx), [Speicherverträge](../packages/storage/src/contracts.ts), [Dexie-Adapter](../packages/storage/src/indexeddb-adapter.ts), [native SQLite-Implementierung](../apps/desktop/src-tauri/src/storage.rs), [Rust-Abhängigkeiten](../apps/desktop/src-tauri/Cargo.toml), [Server](../apps/server/src/index.ts).

Ziel ist eine gemeinsame Rust-Persistenzbasis mit typisierten Modellen, Beziehungen, Abfragen, Transaktionen und nummerierten Migrationen. Der Anwendungscode muss keine SQL-Statements formulieren oder frei ausführen. Der gemeinsame DAL bedeutet gemeinsame lokale Implementierung auf Desktop und PWA sowie wiederverwendbare technische Infrastruktur auf dem Server. Er bedeutet weder identische Datenmodelle auf Client und Server noch einen universellen Finanzzugriff im Server.

## ORM und Migrationen

Diesel ist der bevorzugte Kandidat, weil sein dokumentierter SQLite-Pfad seit 2.3 auch `wasm32-unknown-unknown` unterstützt. Typisierte Query-DSL und Modellabbildung ersetzen reguläres handgeschriebenes SQL. Die [Diesel-WASM-Dokumentation](https://diesel.rs/news/2_3_0_release) benennt einen zusätzlichen VFS für dauerhafte Browserdaten; ein erfolgreicher WASM-Build allein beweist keine Persistenz.

SeaORM ist die untersuchte Alternative mit Entitäten, Beziehungen und Rust-Migrations-DSL. Dessen [Treiber-/Laufzeitkonfiguration](https://www.sea-ql.org/SeaORM/docs/install-and-config/database-and-async-runtime/) und [Migrationen](https://www.sea-ql.org/SeaORM/docs/migration/writing-migration/) sind relevante Vergleichsgrundlagen; ein für WiMM tragfähiger direkter Browserpfad wurde hier nicht praktisch nachgewiesen. Diesel wird aufgrund der Priorität „gemeinsamer Browserpfad“ zuerst geprüft. Scheitert DAL01, bleibt der Bestand aktiv; kein automatischer Wechsel zu SeaORM.

Für Schemaänderungen wird eine etablierte Rust-Schema-DSL, vorzugsweise SeaQuery, geprüft. Sie soll Tabellen, Constraints und Indizes ausdrücken und das jeweilige SQL erzeugen. Die konkrete Kombination aus Diesel, Schema-DSL, Ausführung und Journal ist erst in DAL01 nachzuweisen; Diesels übliche SQL-Migrationsdateien erfüllen die gewünschte Rust-DSL nicht von selbst. Reife stabile Versionen, Lizenz, Toolchain und Bindings werden dann geprüft und exakt gesperrt. Im Konzept werden keine Produktabhängigkeiten hinzugefügt.

Handgeschriebenes SQL ist nur für konkret nachgewiesene technische Lücken erlaubt, gekapselt innerhalb des zuständigen Adapters. Jede Ausnahme braucht Zweck, fehlende ORM-/DSL-Funktion, betroffene Backends und Integrationsnachweise. Werte bleiben gebunden; kein frei übergebener SQL-Text oder Datenpfad aus UI, HTTP oder Sprachbinding. ORM-/DSL-generiertes SQL und treiberinterne Statements sind keine solche Ausnahme.

Die Nähe zu Entity Framework betrifft typisierte Datenzugriffe und Schemaentwicklung. Ein eigener LINQ-/DbContext-Nachbau, automatisches Lazy Loading oder implizites Speichern veränderter Objektgraphen ist nicht vorgesehen. Der Fachkern erzeugt weiterhin vollständige geprüfte Änderungsmengen; deren Speicherung hat einen expliziten Transaktionsabschluss.

## Bibliotheksgrenzen und Bindings

| Grenze | Verantwortung |
| --- | --- |
| Rust-Fachkern | Geld, Fachvalidierung und Projektionen; keine ORM-, Datenbank-, HTTP-, UI- oder Tauri-Abhängigkeit |
| Plattformfreie Speicherverträge | Typisierte lokale Operationen, Migration-/Sicherungsports und getrennte öffentliche Servertransaktionen; keine Verbindung oder ORM-Entity im öffentlichen Vertrag |
| Lokaler Rust-DAL | Profile/Bereiche, Aggregate, bestätigte Daten, Pending/Originalentwürfe, Outbox, Projektionen, Indizes und konsistente Snapshots |
| Server-Rust-DAL | Chiffrate, öffentliche Hüllen/Verwaltung, Manifeste, Receipts, Revisionen und Änderungslog; kein Finanzfachkern und keine privaten Schlüssel |
| Technische Persistenzbasis | Backendkonfiguration, typisierte Query-/Schemaoperationen, Verbindungsbesitz, Migrationjournal und strukturierte Fehler; keine Fachregeln |
| Bindings und Plattformadapter | Tauri, WASM/Worker und native Fastify-Anbindung; Lebensdauer, Scheduling, Ressourcenlimits und Fehlerübertragung |

Bestehende `LocalFinancialStoragePort`, `ServerPersistencePort` und `CommitOutcome` aus [K01](core-contracts.md) sind die Ausgangsverträge. DAL02 beschreibt ihre Rust-Abbildung und erforderliche versionierte Ergänzungen, ohne fachliche oder öffentliche Cryptoformate still zu ändern. ORM-Entities sind interne Persistenzmodelle, keine UI-/Transportmodelle. Profilpersistenz und sichere Schlüsselablage bleiben eigene Plattformports.

Desktop ruft den lokalen DAL über katalogisierte Tauri-Kommandos auf. Die PWA ruft dieselben Operationen über Rust/WASM in einem Worker auf; JavaScript übernimmt die erforderliche Browseranbindung. Verbindungsbesitz und tabübergreifende Schreibkoordination werden vor Produktintegration nachgewiesen. Fastify bleibt HTTP-Hülle und erhält eine etablierte native Rust-Anbindung, deren konkrete Bibliothek erst nach Safe-Code-/Toolchain-/Lebensdauernachweis gewählt wird. Kein neuer lokaler HTTP-Speicherdienst und keine freie SQL-Schnittstelle.

Alle eigenen Rust-Crates, Buildscripts, Werkzeuge und eigenen Bindingquellen erfüllen die bestehenden `#![forbid(unsafe_code)]`-/Cargo-Lintregeln. Ein Binding, das eine Abschwächung dieser Regeln benötigt, ist keine akzeptierte Lösung. Fremdabhängigkeiten werden hinsichtlich Herkunft, Lizenz und Sicherheit geprüft; sie werden nicht als eigener unsafe-freier Code ausgegeben.

## Atomare Speicherung und Fehler

Lokale Batches speichern erwartete Revisionen, Aggregate, Outbox und Projektionen gemeinsam. Konten-/Finanzrevisionsanker bleiben erhalten. Syncseiten speichern Bestätigungen, entfernte Pending-Einträge und Cursor atomar. Snapshotersatz prüft Profil, Bereich, Epoche, Version und Fachbestand vor destruktiven Änderungen; Projektionsneuaufbau benutzt ausschließlich den Fachkern und prüft den unveränderten Ausgangsstand.

Serveroperationen speichern zusammengehörige öffentliche Verwaltungsdaten, Manifeste, Chiffrate, Receipts und Cursor in derselben Transaktion. Gleiche Operations-ID mit gleichem Inhalt ist idempotent; abweichender Inhalt wird abgewiesen. Kein Import des lokalen Finanz-DAL oder Fachkerns im Server, keine Entschlüsselung und keine serverseitigen Finanzprojektionen. [E2EE](encryption.md), Bereichstrennung und Privatdatenschutz gelten unverändert.

CAS-Konflikt, Quota, Schreibfehler, unbekannte Version, Epochenwechsel und wiederverwendete Operations-ID bleiben unterscheidbar. Bestätigter, sicher nicht erfolgter und unklarer Commit werden nicht zusammengefasst. Technische Wiederholungen betreffen ausschließlich vollständige Transaktionen mit derselben Operations-ID; kein blindes Neuanlegen nach verlorener Antwort. Busy-/Deadlock-/Isolationsverhalten wird backendintern behandelt und gegen parallele echte Verbindungen geprüft. Abbruch nach bestätigtem Commit darf diesen nicht als gescheitert melden.

Die gemeinsame Infrastruktur garantiert nicht automatisch identische DDL-Transaktionen in allen SQL-Systemen. Nummerierte Migrationen müssen backendgeeignete Sicherungs-, Journal-, Wiederanlauf- und Restoregarantien erfüllen; insbesondere keine Behauptung atomaren MySQL-DDL ohne Nachweis. Schema-Synchronisierung aus Entities beim produktiven Öffnen ist kein Ersatz für registrierte geprüfte Migrationen.

## PWA und gesicherter Übergang

SQLite im Browser braucht einen nachgewiesenen dauerhaften VFS, vorzugsweise OPFS. Die [SQLite-Persistenzdokumentation](https://www.sqlite.org/wasm/doc/trunk/persistence.md) beschreibt mehrere Varianten mit unterschiedlichen Worker-, Nebenläufigkeits- und Laufzeitanforderungen. DAL01 muss die tatsächlich mit Diesel verwendete Variante und sämtliche nötigen Browser-/Headeranforderungen benennen. Dokumentation der allgemeinen SQLite-WASM-Lösung ist kein Nachweis ihrer Verbindung mit dem gewählten Rust-Treiber.

Browserdaten unterliegen weiterhin Quota, Persistenzfreigabe und möglicher Löschung durch Browser oder Nutzer. Persistenzablehnung wird sichtbar; Unit-Memory oder unbemerkter IndexedDB-Fallback darf keine erfolgreiche SQL-Umstellung vortäuschen. WASM-/Workerassets gehören in den Offlinecache. Freigegebene Browser müssen Start, Neustart, Worker-/Tabwechsel und Ressourcenfehler tatsächlich bestehen; fehlende physische iOS-PWA-Belege bleiben offen.

DAL05 liest den IndexedDB-Ausgangsbestand konsistent, erstellt eine verschlüsselte Sicherung mit dauerhaft bestätigtem Beleg, importiert in ein separates SQLite-Ziel und vergleicht den vollständigen logischen Bestand. IDs, Revisionen, Tombstones, Pending/Originalentwürfe, Bestätigungen, Epochen, Cursor und Cryptoformate bleiben erhalten. Ein dokumentiertes Migrationsjournal macht Abbruch und Neustart wiederaufnehmbar.

Während der Übernahme müssen Ausgangsänderungen ausgeschlossen oder vor Aktivierung vollständig erkannt und der Versuch abgewiesen werden. Die Umschaltung erfolgt erst nach vollständigem Vergleich; vorher bleibt IndexedDB maßgeblich. Ein Absturz an der Aktivierungsgrenze darf keine zwei aktiven Schreibspeicher erzeugen. Kein dauerhafter Dual-Write. Ein alter IndexedDB-Bestand darf nach neuen SQLite-Writes nicht als automatischer Rückfall verwendet werden; Wiederherstellung benötigt einen aktuellen gesicherten Stand und ausdrückliche Bestätigung. Die Quelle wird nicht beim ersten erfolgreichen Start gelöscht.

Desktop soll bestehende SQLite-Bestände zunächst ohne Fachformatwechsel öffnen. Notwendige physische Schemaänderungen folgen den vorhandenen gesicherten Migrationsverträgen und dürfen nicht als Nebeneffekt einer ORM-Verbindungsöffnung erfolgen.

## Tracking und bestehende Zuständigkeiten

GitHub führt Reihenfolge, Voraussetzungen, Fortschritt und Prüfbelege. Die Einzelissueverweise werden nach Anlage hier ergänzt; sie sind Einstieg, keine zweite laufende Deltaliste.

| Bestehendes Paket | Abgrenzung zum DAL-Vorschlag |
| --- | --- |
| [K #91](https://github.com/mpwg/WiMM/issues/91), [K05 #96](https://github.com/mpwg/WiMM/issues/96) | Freigegebene Fachkern-/Produktumschaltung; enthält keine automatische ORM-/PWA-SQLite-Freigabe |
| [#77](https://github.com/mpwg/WiMM/issues/77) | Vollständiger vorhandener nativer SQLite-Speichervertrag; DAL03 betrifft dessen spätere technische ORM-Umstellung |
| [#82](https://github.com/mpwg/WiMM/issues/82) | Bestehende lokale Versionierung/Sicherung/Migration; DAL05 ergänzt den Wechsel des Browser-Speichersystems |
| [#83](https://github.com/mpwg/WiMM/issues/83) | Fachlich erforderliche Indizes; der DAL erhält dieselbe Abfragewirkung und Leistungsgrenzen |
| [#84](https://github.com/mpwg/WiMM/issues/84) | Browserpersistenz und sichtbare Ablehnung; bleibt auch bei künftigem OPFS maßgeblich |
| [#85](https://github.com/mpwg/WiMM/issues/85) | Tatsächliche Bestandskonformität SQLite/IndexedDB; DAL07 ergänzt die künftigen ORM-/WASM-Backends |
| [K06 #97](https://github.com/mpwg/WiMM/issues/97) | Bestehende SQL-neutrale Servertransaktionen; DAL02/DAL06 binden diese in Rust an |
| [K07 #98](https://github.com/mpwg/WiMM/issues/98), [K08 #99](https://github.com/mpwg/WiMM/issues/99), [K09 #100](https://github.com/mpwg/WiMM/issues/100) | Serveradapter und echte DB-Abnahme verbleiben dort; DAL06 ergänzt ausschließlich gemeinsame Rust-/ORM-Basis und Fastify-Anbindung |
| [K10 #101](https://github.com/mpwg/WiMM/issues/101), [K11 #102](https://github.com/mpwg/WiMM/issues/102) | Server-SQL-Wechsel und K-Gesamtabnahme; weder doppelte Servermigration noch Ersatz durch DAL-Abnahme |

Bestehende Issues werden durch diesen Konzeptauftrag weder geschlossen noch umgeschrieben oder pauschal blockiert. Eine spätere angenommene Architekturänderung muss betroffene K-/P3-Kriterien gemeinsam und nachvollziehbar aktualisieren, bevor abhängige Implementierung beginnt. Kein zusätzlicher P6–P11-Produktablauf, kein Wechsel des HTTP-Frameworks, keine native Produkt-App, kein Clusterbetrieb und kein Releaseauftrag.

## Abnahme und offene Nachweise

Konzeptabnahme verlangt korrekte Quellen/Links, eindeutige Trennung zwischen Bestand und Vorschlag, widerspruchsfreie Freigaben, vorgeschlagene ADR und rückgelesene GitHub-Issues. Dieser Auftrag liefert keine praktischen ORM-/Browser-/Bindingnachweise.

DAL01 benötigt nach gesonderter Freigabe dieselbe kleine lokale DAL-Implementierung nativ und im Browser: dauerhaftes Schreiben/Neustart, typisierte Abfrage, atomarer Batch, stale CAS, Fehlerrollback, Schema-/Indexschritt über Rust-DSL, tabübergreifende Koordination und geeignete Fastify-Bindinggrundlage. Native Rust-Assertions, tatsächliche WASM-Ausführung, PostgreSQL-/MySQL-Buildpfade, Lizenz/Versionen und Safe-Code-Regeln sind Pflicht. Bei fehlendem Nachweis keine Produktumschaltung.

DAL07 verlangt einen gemeinsamen katalogisierten lokalen Contractbestand auf echter nativer SQLite und echter persistenter Browser-SQLite sowie eine getrennte Serversuite auf echter SQLite/PostgreSQL/MySQL. Memory und Mockbindings genügen nur für Unit-Tests. Pflichtfälle: atomarer Rollback, CAS/Parallelität, Idempotenz, konsistente Snapshots/Cursor, Profil-/Bereichstrennung, Migrationabbruch, Restore, dauerhafter Prozessneustart, Offlinecache und Quota/Disk-full; Simulation und tatsächliche Ressourcenfehler ausdrücklich unterscheiden.

Browsermatrix: Chromium, Firefox, WebKit sowie physische iOS-PWA im Rahmen der bestehenden Geräteabnahme. Native Desktopmatrix: macOS arm64/x86_64, Windows und Linux; fehlende Systeme bleiben offene Kriterien. 50.000-Buchungen-Fälle behalten die bestehenden Grenzen, insbesondere Kaltöffnen unter 2.000 ms und Filter-/Scroll-p95 unter 100 ms. Maßgeblich sind aktuelle [Prüfstrategie](testing.md), [Datenmodell](data-model.md), [Fachmodell](domain.md) und die verlinkten Einzelissues; historische grüne Läufe ersetzen keine neuen Nachweise.
