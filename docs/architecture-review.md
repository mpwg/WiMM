# Architekturreview und gemeinsames Rust-Ziel

## Auftrag, Methode und Aussagegrenzen

Review vom 9. Oktober 2026 auf `84d730cc6e10d70cf6ac6ff9bc28c4a9c4376e92` in der aktiven Arbeitskopie. Nutzerauftrag: detailliertes Review einschließlich Rust-DAL, auch grundlegende Änderungen, langfristige Vereinheitlichung, Rust-Server bevorzugen, bestehende Issues vollständig anpassen und veraltete Dokumente entfernen. [Architektur](architecture.md) legt das bestätigte Ziel fest; [Aufgaben](tasks.md) unterscheidet Dokumentationsauftrag und Produktfreigaben. [Gesamtübersicht #114](https://github.com/mpwg/WiMM/issues/114) ersetzt #91/#105.

Geprüft wurden Fach-/Daten-/Crypto-/Sync-/APIverträge, K-/DAL-Pläne, Anwendungs- und UI-Composition, Rust-Kern und Bindings, Speicherports/Adapter/Migrationen, Fastify-Stub, Service Worker, Paketgraph/Architekturprüfungen und sämtliche 84 bestehenden GitHub-Issues einschließlich vollständiger Beschreibungen und Kriterien. Dokumentationsinventar umfasst Projekt-/Paket-READMEs, Teilpläne, Übergaben und Skills. Befunde verwenden unveränderliche Codebezüge des Reviewstands; Issuezustände werden nach der Pflege rückgelesen.

Dieses statische Architekturreview reproduziert keine neue finanzielle Sicherheitslücke und misst keine neue Leistungsregression. **B** bezeichnet belegte strukturelle Eigenschaften, **V** konstruktive Verbesserung, **R** noch zu validierendes Risiko. Priorität 1: Vertrags-/Datenintegrität oder Voraussetzung des Zielumbaus; 2: Laufzeit-/Wartungsverbesserung; 3: Vereinfachung/Abschluss. Aufwand S/M/L ist relativ, keine Terminzusage. Historische Tests bleiben historische Belege; neue Zielkomponenten besitzen noch keine Implementierungsabnahme.

## Gesamtbewertung

Die tragenden Entscheidungen sind geeignet: Offlinebetrieb, reiner deterministischer Fachkern, sichere Cent einschließlich Zwischenwerten, vollständige Aggregate, CAS, Originalentwürfe, atomare Speicherung und E2EE mit getrennten öffentlichen Serverdaten. Sie werden erhalten. Die K04-Portierung und K02-Auslagerung sind nützliche Grundlagen, aber Rust-Fachkern plus Rust-DAL allein liefern noch keine gemeinsame Anwendung. Der Aufwand würde teilweise in mehreren Ablaufimplementierungen und Sprachgrenzen verbleiben.

Empfohlen und als Ziel angenommen wird ein modularer Rust-Aufbau für Fachkern, Clientanwendung und Persistenz sowie ein eigenständiger öffentlicher Rust-Server. TypeScript bleibt für UI und Browseradapter; etablierte Parser bleiben hinter Ports. Der wesentliche Gewinn ist gemeinsame Ablaufsemantik und weniger Integrationsgrenzen. Kosten sind zusätzliche Rust-Typisierung, native/WASM-Kryptografie, Browser-VFS-/Writerkoordination und gesicherte Speicherübernahme. Diese Kosten werden durch explizite Nachweise begrenzt, nicht als bereits gelöst ausgegeben.

## Bestandsaufnahme je Baustein

| Baustein | Aktueller Befund | Ziel / Bewertung |
| --- | --- | --- |
| Finanzen | TypeScript produktiv; eigenständige Rust-Engine und Sprachkatalog vorhanden | Eine produktive Rust-Engine; vorhandene Semantik erhalten |
| Fachformen | Zod/TS und manuelle Rust-Value-Feldtabellen | Typisierte Rust-Modelle mit generierten Grenzverträgen |
| Anwendung | React-unabhängige TypeScript-Controller, injizierte Dienste | Dieselben Rust-Abläufe in allen Clients |
| Lokale Speicherung | Dexie/IndexedDB bzw. rusqlite/Tauri; gemeinsame Konformitätsgrundlage | Gemeinsamer lokaler ORM-DAL; separate sichere Migration |
| Ansicht/Projektionen | Gesamter Bereich im FinanceModel; indizierte Ports vorhanden | Begrenzte Rust-Ansichtsports; vollständige Mutationsprüfung |
| Kryptografie | Gepflegte TS/libsodium-WASM-Kapselung, Profile/Cryptoformate | Interoperable native/WASM-Ports; gleicher Protokollschutz |
| Sync | Spezifikation, Entwürfe/Speicherbasis; kein produktives Syncpaket | Gemeinsame Clientzustandsautomaten; P9 bleibt eigener Auftrag |
| Server | Health-/Metadatenstub in Fastify; keine produktive DB | Axum/Tokio und öffentlicher Server-DAL |
| Betrieb | Single-Instance-/Backup-/Restoreverträge spezifiziert | Backendgerechte Migration, Receiptprüfung, Readiness/Shutdown |
| PWA | Buildgebundener Assetcache, Browserprofile/Locks | Buildgebundene kompatible Asset-/DB-Aktivierung |
| Prüfung | Strenge Bestandsgraph-/Rustprüfungen; Plattformlücken | Negative Zielgrenzen, Generator-/Binding-/DB-Konformität |
| Dokumentation | Parallele K-/DAL-Konzepte und zahlreiche überholte Snapshots | Ein Zielbild, Issuefortschritt, unveränderliche historische Quellen |

## Befundmatrix

| ID | Art / Priorität / Aufwand | Kernbefund | Umsetzung |
| --- | --- | --- | --- |
| F01 | B/V · 1 · M | Dynamische Rust-Fachmodelle und manuelle Formregeln | [AR01 #115](https://github.com/mpwg/WiMM/issues/115) |
| F02 | B/R · 1 · M | Mehrere unabhängig gepflegte Sprachverträge | [AR02 #116](https://github.com/mpwg/WiMM/issues/116) |
| F03 | B/R · 1 · S | Fehlererkennung anhand Meldungstext/Regex | [AR03 #117](https://github.com/mpwg/WiMM/issues/117) |
| F04 | B/R · 1 · M | Lokaler Batch ohne dauerhafte Operationsidentität | [AR04 #118](https://github.com/mpwg/WiMM/issues/118) |
| F05 | B/R · 1 · M | Zwei lokale Commit-/Moduspfade | [AR05 #119](https://github.com/mpwg/WiMM/issues/119) |
| F06 | B/V · 1 · L | Rust-Kern/DAL ohne gemeinsame Anwendung | [AR06 #120](https://github.com/mpwg/WiMM/issues/120) |
| F07 | B/R · 2 · M | Gesamter Bereich für Darstellung, unversionierte Caches | [AR07 #121](https://github.com/mpwg/WiMM/issues/121) |
| F08 | R · 1 · M | Native/WASM-Cryptoanbindung noch nicht nachgewiesen | [AR08 #122](https://github.com/mpwg/WiMM/issues/122) |
| F09 | B/R · 1 · M | Asset-, Worker-, Binding- und DB-Update nicht koordiniert | [AR09 #123](https://github.com/mpwg/WiMM/issues/123) |
| F10 | V · 2 · L | Fastify–Rust-DAL würde neue Integrationsgrenze erzeugen | [AR10 #124](https://github.com/mpwg/WiMM/issues/124) |
| F11 | B/R · 1 · M | Bestandsgraph erlaubt künftig unzulässige Abhängigkeiten | [AR11 #125](https://github.com/mpwg/WiMM/issues/125) |
| F12 | R · 1 · L | Diesel/WASM ist noch kein persistenter Browser-DAL | [DAL01 #106](https://github.com/mpwg/WiMM/issues/106), [DAL04 #109](https://github.com/mpwg/WiMM/issues/109) |
| F13 | R · 1 · L | Gesicherte Backendübernahme und DDL-Portabilität | [DAL05 #110](https://github.com/mpwg/WiMM/issues/110), [SQL-Wechsel #101](https://github.com/mpwg/WiMM/issues/101) |
| F14 | V · 2 · M | Budget/Familie erweitern den Fachkern, nicht Server/ORM | [Fachmodell](domain.md), [P6](p6-budget.md), [P7](p7-family.md) |
| F15 | B · 2 · S | Browser-/Plattform-/Ressourcenbelege teilweise offen | [P1–P3 #87](https://github.com/mpwg/WiMM/issues/87), [P4 #57](https://github.com/mpwg/WiMM/issues/57), [P5 #71](https://github.com/mpwg/WiMM/issues/71) |
| F16 | B/V · 3 · S | Widersprüchliche Ziele und historische Statuskopien | Dieser Konzept-/Bereinigungsauftrag |

## F01/F02 — Typisierte Fachmodelle und eine Vertragsquelle

Beleg: [aggregate_schema::shape](https://github.com/mpwg/WiMM/blob/84d730cc6e10d70cf6ac6ff9bc28c4a9c4376e92/crates/finance-core/src/aggregate_schema.rs#L60) validiert Feldnamen über Stringtabellen; [Rust-Request](https://github.com/mpwg/WiMM/blob/84d730cc6e10d70cf6ac6ff9bc28c4a9c4376e92/crates/finance-core/src/lib.rs#L200) trägt `Vec<Value>`, während [TypeScript-Verträge](https://github.com/mpwg/WiMM/blob/84d730cc6e10d70cf6ac6ff9bc28c4a9c4376e92/packages/contracts/src/finance-engine.ts#L1) eigene Formschemas besitzen. Die vorhandenen Negativkataloge sind wertvoll, verhindern aber nicht jede künftige Drift und ermöglichen intern weiterhin beliebige JSON-Kombinationen.

Empfehlung: sichere Rust-Newtypes und tagged unions für Aggregate/Befehle; Deserialisierung/Formprüfung an der Grenze, danach typisierte Handler. Rust-Fachverträge werden gemeinsame Quelle für Sprachtypen und Formschemas. Fachinvarianten bleiben explizite Rust-Assertions, sie werden nicht aus ORM-FKs oder JSON-Schema abgeleitet. Öffentliche Serververträge und private Fachtypen sind getrennte Module. Generierung muss reproduzierbar und auf Drift prüfbar sein.

Alternative: handgepflegte TS-/Rust-Modelle mit größerem Vergleichskatalog. Das vermeidet Generatorintegration, erhöht aber jede Vertragsänderung um manuelle Parallelpflege. Generierte Typen allein reichen ebenfalls nicht: Runtimeform-/Versionsprüfung und sichere Integerregeln bleiben nötig. Voraussetzungen sind bestehende K01/K04-Kataloge und geprüfte Generatoren; Kriterien stehen getrennt in AR01/AR02. Kein Finanz-/Cryptoformatwechsel durch diese interne Typisierung.

## F03/F04 — Fehler und lokale Commitidentität

Beleg: [Desktopfehlerabbildung](https://github.com/mpwg/WiMM/blob/84d730cc6e10d70cf6ac6ff9bc28c4a9c4376e92/packages/storage/src/desktop-bridge.ts#L45) vergleicht einen deutschen Text, [FinanceApplication](https://github.com/mpwg/WiMM/blob/84d730cc6e10d70cf6ac6ff9bc28c4a9c4376e92/packages/application/src/finance-application.ts#L53) nutzt `/revision|stale/i`. [AtomicBatch](https://github.com/mpwg/WiMM/blob/84d730cc6e10d70cf6ac6ff9bc28c4a9c4376e92/packages/contracts/src/ports.ts#L15) hat weder Operations-ID noch lokale Receiptabfrage; der lokale Write liefert `Promise<void>`. Der Server-CommitOutcome-Vertrag allein schließt diese lokale Lücke nicht.

Empfehlung: strukturierte persistenz-/bindingspezifische Codes und ein lokaler Commitvertrag mit identitäts-/inhaltsgebundenem dauerhaftem Receipt. Antwortverlust nach Commit wird durch Ergebnissuche derselben Operation aufgelöst. Sichere Ablehnung, bestätigter Erfolg und unklarer Ausgang bleiben verschieden. Meldungen sind deutsche UI-Darstellung; Log-/Fehlerkontext enthält keine Finanzpayloads oder Secrets. Lokale Receipts und Serverreceipts haben unterschiedliche Bedeutungen und Lebenszyklen.

Alternative: ausschließlich CAS plus nachfolgender Vergleich. Das ist für Konfliktabwehr nützlich, beweist aber nicht allgemein, ob eine unbekannt bestätigte Originaloperation vollständig committed wurde. AR04 muss Receiptaufbewahrung, Restore-/Epochenbindung und sichere Metadatenmigration festlegen. Pflichtfälle sind Antwortverlust, tatsächlicher Prozessneustart, gleiche ID/derselbe Inhalt, abweichender Inhalt, Abbruch vor/nach Commit und vollständiger Rollback.

## F05/F06 — Eine Commitpipeline und gemeinsame Anwendung

Beleg: [FinanceApplication.execute](https://github.com/mpwg/WiMM/blob/84d730cc6e10d70cf6ac6ff9bc28c4a9c4376e92/packages/application/src/finance-application.ts#L50) schreibt direkt mit leerer Outbox/Projektionen; [LocalAreaService.applyChangeSet](https://github.com/mpwg/WiMM/blob/84d730cc6e10d70cf6ac6ff9bc28c4a9c4376e92/packages/storage/src/orchestrator.ts#L25) besitzt eine zweite Modus-/Outboxpipeline. Das ist kein Nachweis fehlerhaften heutigen Standalonebetriebs. Es erhöht jedoch das Risiko, dass spätere verbundene Bereiche oder neue Mutationswege verschiedene Regeln verwenden. [Profilcontroller](https://github.com/mpwg/WiMM/blob/84d730cc6e10d70cf6ac6ff9bc28c4a9c4376e92/packages/application/src/profile-application.ts#L1) und [Historie](https://github.com/mpwg/WiMM/blob/84d730cc6e10d70cf6ac6ff9bc28c4a9c4376e92/packages/application/src/history.ts#L1) sind weiterhin TypeScript.

Empfehlung: gemeinsamer Rust-Commitdienst als Grundlage einer Rust-Clientanwendung. Profil-/Sitzungsgeneration, Finanz-CAS, Originalentwürfe, Abbruch und Bestätigung werden einmal implementiert. Jeder Ablauf nutzt injizierte Ports; Browser-/OS-Funktionen bleiben Adapter. Native und WASM-Runtimes besitzen Zustand; UIabonnements erhalten sichere Zustandsereignisse. Importparser bleiben etabliert und injiziert.

Alternative: TS-Anwendung für Web/Tauri und separate Swift-/Kotlin-Koordination. Das wäre weniger sofortiger Umbau, passt aber schwächer zur gewählten langfristigen Vereinheitlichung. Ein großer Rust-Monolith wäre ebenfalls ungünstig: Fachkern, Anwendung und DAL bleiben separate Abhängigkeitsrollen. AR05 prüft alle Commitwege, AR06 zusätzliche Profil-/Historien-/Importabläufe einschließlich tatsächlicher nativer Harnesses. Produktive Altpfade erst nach Parität entfernen.

## F07 — Datenfluss, Ansichten und Projektionen

Beleg: [FinanceApplication.load](https://github.com/mpwg/WiMM/blob/84d730cc6e10d70cf6ac6ff9bc28c4a9c4376e92/packages/application/src/finance-application.ts#L38) liest den gesamten Bereich. [FinanceModel](https://github.com/mpwg/WiMM/blob/84d730cc6e10d70cf6ac6ff9bc28c4a9c4376e92/packages/application/src/finance-model.ts#L17) filtert/sortiert den Bestand und berechnet Ansichtsprojektionen. [Indexports](https://github.com/mpwg/WiMM/blob/84d730cc6e10d70cf6ac6ff9bc28c4a9c4376e92/packages/storage/src/index-queries.ts#L1) existieren; ihr Vorhandensein macht die UIabfrage nicht automatisch begrenzt. [StoredProjection](https://github.com/mpwg/WiMM/blob/84d730cc6e10d70cf6ac6ff9bc28c4a9c4376e92/packages/storage/src/contracts.ts#L32) besitzt generisches Payload und keine verpflichtende Ausgangs-/Projektionsversion. Noch keine neue Laufzeitregression gemessen.

Empfehlung: vollständigen Mutationsbestand in der Rust-Runtime halten; paginierte Ansichten und fachlich berechnete Summen über Anwendungsports liefern. Caches binden Ausgangsrevision/Projektionsversion und werden atomar invalidiert/neu aufgebaut. Vollständige Überlaufprüfung und stabile Summenreihenfolge bleiben unverändert, keine SQL-SUM-Ersatzfachlogik. Große Komplettvalidierungen bleiben für Restore/Migration erforderlich; inkrementelle Optimierung nur bei nachgewiesen gleichwertiger Invariante.

Alternative: weiter vollständige JSON-Snapshots pro Aufruf übertragen. Einfachere Bindings, aber höhere Kopier-/Parsekosten; bei 50.000 Buchungen messen statt nur DBzeiten zitieren. AR07 misst End-to-End-Kaltöffnen, Filter/Scroll, Payloadgrößen und Speicher, bewahrt Seiten-/Auswahl-/Fokusverhalten und prüft stale Projektionen. Vorhandene Grenzwerte werden nicht erhöht.

## F08/F11 — Kryptografie- und Abhängigkeitsgrenzen

Beleg: [Crypto-Kapselung](https://github.com/mpwg/WiMM/blob/84d730cc6e10d70cf6ac6ff9bc28c4a9c4376e92/packages/crypto/src/index.ts#L1) liegt im TS-Paket, [Finanzbindings](https://github.com/mpwg/WiMM/blob/84d730cc6e10d70cf6ac6ff9bc28c4a9c4376e92/crates/finance-bindings/src/lib.rs#L1) transportieren derzeit JSON. [Paketgraph](https://github.com/mpwg/WiMM/blob/84d730cc6e10d70cf6ac6ff9bc28c4a9c4376e92/scripts/check-package-graph.mjs#L21) erlaubt UIabhängigkeiten zu domain/storage/browser-adapters. [Rust-Prüfung](https://github.com/mpwg/WiMM/blob/84d730cc6e10d70cf6ac6ff9bc28c4a9c4376e92/scripts/check-core-architecture.mjs#L1) schützt aktuellen Kern und unsafe-Regeln, aber enthält noch keine Zielserver-/Privatkrypto-/DAL-Abschlussregeln. Die heutigen drei Architekturprüfungen bestehen; das ist Bestandskonformität.

Empfehlung: gemeinsame Cryptoports für bestehende libsodium-Verträge nativ/WASM und klar getrennte öffentliche Server-Signaturprüfung. Keine eigenen Primitive/unsicheren Eigen-FFI-Wrapper. Private Schlüssel werden nur clientseitig gehalten; lokale Klartextdaten bleiben nach bestehender Vertrauensannahme zulässig. Serverfeatures dürfen weder Finanzkern noch private Cryptoimplementierung hereinziehen. Architekturprüfungen umfassen Features und transitive Abschlüsse sowie absichtlich verbotene Abhängigkeiten. Runtimeimports und Typimports werden bewusst unterschieden.

Alternative: JS-Crypto als dauerhafter Universaladapter würde native Oberflächen erneut von JS abhängig machen. Ein anderer Cipher ist kein Integrationsersatz. Rust-Crypto ist erst akzeptiert, wenn bestehende C-Vektoren/Legacy/Recovery/Exports interoperabel bestehen und Safe-Code-Regeln erhalten sind. AR08 und AR11 liefern getrennte Nachweise. Dies ist keine Behauptung extern geprüfter Kryptoprotokollsicherheit.

## F09/F12 — PWA-DAL, Writer und Updates

Beleg: [Service Worker](https://github.com/mpwg/WiMM/blob/84d730cc6e10d70cf6ac6ff9bc28c4a9c4376e92/apps/web/public/service-worker.js#L3) verwendet im Quelltext einen Cache-first-Platzhalter. Der bestehende Vite-Buildplugin ersetzt ihn bereits durch einen Assetlistenhash und erzeugt das vollständige appShell-Manifest; main.tsx meldet updatefound. Der Review hatte diese vorhandene Buildfunktion zunächst übersehen. Offen ist die explizite Aktivierungs-/Entwurfs-/Mehrtab-/Rust-/DB-Kompatibilitätskoordination. Neue WASM-/DB-Komponenten führen zusätzliche Kompatibilitätsdimensionen ein. Diesel dokumentiert WASM-Unterstützung, aber einen VFSbedarf für Browserspeicherung; SQLite dokumentiert unterschiedliche VFS-Nebenläufigkeits-/Headerbedingungen. Das belegt die notwendigen Auswahlkriterien, nicht die konkrete WiMM-Integration. [Diesel](https://diesel.rs/news/2_3_0_release), [SQLite-Persistenz](https://www.sqlite.org/wasm/doc/trunk/persistence.md).

Empfehlung: expliziter Runtime-/DBbesitz und tabübergreifende Writerführung, begrenzte Workerports und buildgebundene vollständige Offlineassets. Die konkrete VFSauswahl muss mit derselben Diesel-SQLite-Instanz funktionieren; allgemeine sqlite3.js-Dokumentation allein genügt nicht. Hostingheader, OIDC-Rückkehr, Tab-/Workerwechsel, Quota und physische iOS-PWA werden tatsächlich geprüft. Assetaktivierung und Schemawechsel beachten aktive Entwürfe sowie alte Tabs.

Alternativen: IndexedDB hinter Rust-Ports bleibt mögliche neue Entscheidung, falls Machbarkeit scheitert; es wird nicht als erfolgreich umgestellter gemeinsamer SQL-DAL ausgegeben. SeaORM ist Vergleichskandidat, ohne hier nachgewiesenen direkten WiMM-Browserpfad. SharedWorker oder spezifischer VFS werden nicht ungeprüft festgeschrieben. DAL01/DAL04 führen konkrete Machbarkeit/Integration, AR09 die eigenständige Build-/Updatekompatibilität. Fehlender Nachweis erhält den aktiven Bestand und verlangt Rückfrage vor Ersatzwahl.

## F10 — Eigenständiger Rust-Server

Beleg: [Fastify-Stub](https://github.com/mpwg/WiMM/blob/84d730cc6e10d70cf6ac6ff9bc28c4a9c4376e92/apps/server/src/index.ts#L1) besitzt nur live/ready/meta. DAL06 plante eine native Nodeanbindung. Deren zusätzlicher FFI-/Lebensdauer-/Schedulingaufwand ist eine Architekturprognose, kein reproduzierter Fehler. Axum bietet typisierte HTTP-Verarbeitung im Tower-/Tokio-Umfeld. [Axum](https://docs.rs/axum/latest/axum/).

Empfehlung: eigener Axum/Tokio-Server mit öffentlichen Serverports und direktem Rust-DAL. Bestehende API-/OIDC-/Device-/CSRF-/Konfigurationsverträge erhalten; Rust-HTTP ist keine automatische Freigabe für noch nicht implementiertes P8/P9. SQLite bleibt Standard, PostgreSQL/MySQL bleiben eigene echte Adapterabnahmen. Blockierende Dieselarbeit läuft begrenzt außerhalb des Async-Executors. Bereits gestartetes spawn_blocking wird durch abort nicht automatisch beendet; Commit-/Receiptlogik muss Antwortverlust und Shutdown korrekt behandeln. [Tokio-Scheduling](https://docs.rs/tokio/latest/tokio/task/fn.spawn_blocking.html).

Alternative: Fastify mit Rust-DAL bewahrt vorhandene JS-Werkzeuge, benötigt aber eine zusätzliche native Produktbindung. Da der Server bisher ein kleiner Stub ist und Vereinheitlichung priorisiert wurde, ist Rust-HTTP das günstigere langfristige Ziel. Keine Mikroservices, Cluster oder lokale Zusatzdienste. AR10 ersetzt #111; K06–K10 bewahren SQL-/Transaktions-/Wechselkriterien.

## F13 — Schema, Sicherung und Migration

Die bestehende gesicherte V1→V2-Indexmigration ist nützlicher Beleg, aber kein IndexedDB→SQLite- oder ORMwechselnachweis. JSON-Aggregate können weiter kanonische Fachpayloads sein; relationale Index-/Referenzmodelle dürfen sie nicht still ersetzen. ORMtypen und Migrations-DSL müssen dieselbe physische Schemaerwartung beschreiben. Schema-/Indexänderung, Journal und Receipt dürfen nicht unabhängig fortschreiten.

Empfehlung: getrennte registrierte lokale und öffentliche Servermigrationen; technisches Ausführen teilen, Vertrauens-/Fachmodelle nicht teilen. Lokale Quelle konsistent sichern, Ziel separat importieren, vollständigen logischen Stand vergleichen und genau einen Writer aktivieren. Änderungen anderer Profile, Pending/Originalentwürfe und Cursor prüfen. Server-DDL nach realem Backend garantieren; ORM/DSL bedeutet keine atomare MySQL-DDL. DSL-Kandidat SeaQuery ist nachzuweisen, keine Eigenimplementierung. [Rust-Migrationsbeispiel](https://www.sea-ql.org/SeaORM/docs/migration/writing-migration/).

Alternative: Dual-Write oder automatischer Altbackendfallback würde zwei maßgebliche Stände und Rücksetzrisiken schaffen; nicht akzeptiert. DAL01–DAL05 und #101/#112 decken Machbarkeit, Zielübernahme, alle SQLwechsel und Konformität ab; kein weiteres Duplikatissue für dieselben Anforderungen. Fehlende sichere Binding-/VFS-/DSL-Eignung verlangt Nutzerentscheidung.

## F14/F15 — Erweiterung und realistische Abnahme

Budget, Familienausgleich, Vorleistungsreserve und Rückerstattung bleiben clientseitige Fachmodule. P6/P7 sind spezifiziert, noch nicht implementierungsfreigegeben. Keine Ableitung privater Einkommen aus Privatbuchungen, keine gemeinsame Speicherung privater Links, keine zweite Kontobelastung durch SharedExpense. Historische Budgetänderungen berechnen betroffene Folgemonate neu; Restcent bleiben deterministisch. Die neue Architektur vereinfacht Wiederverwendung, löst diese Fachpakete aber nicht automatisch.

Bestehende P4-/P5-/Ressourcenlücken werden unabhängig erhalten. Neuester Haltepunkt: #84 hat echte Persistenzstatusfälle, aber noch keinen tatsächlich erzwungenen Quota-Writefehler; #113 beschreibt einen CAMT-100.000-Zeilen-Zeitbefund. Ein späterer grüner CI-Lauf widerlegt diesen nicht. Screenreader, echter Zoom, physische iOS-PWA und native Zielsysteme bleiben echte Nachweise. Zusätzliche Architektur-CI ersetzt diese Kriterien nicht. [Belegindex](review-evidence.md), [Prüfstrategie](testing.md).

## Zielbild, Alternativen und Schnittstellen

[Architektur](architecture.md#komponenten-und-abhängigkeiten) enthält das verbindliche Komponentendiagramm. Fachkern → Fachverträge; Anwendung → Fachkern/Ports; Adapter → Ports; UI → Anwendungsbinding; Server → öffentliche Verträge/DAL. Kein zyklisches geteiltes Universalpaket. Ein technischer ORMunterbau darf client-/serverintern wiederverwendet werden, aber keine Finanzfunktion im Server aktivieren.

| Entscheidung | Gewählt | Alternative / Tradeoff |
| --- | --- | --- |
| Wiederverwendung | Gemeinsame Rust-Anwendung zusätzlich zu Kern/DAL | TS plus native Ablaufkopien: weniger Erstumbau, höhere Parallelpflege |
| Server | Axum/Tokio und öffentlicher Rust-DAL | Fastify/Rust-FFI: bestehende JS-Werkzeuge, zusätzliche native Integrationsgrenze |
| Lokaler DAL | Diesel zuerst, SQLite nativ/WASM | IndexedDB-Rust-Port oder SeaORM nur nach neuer Entscheidung bei fehlendem Nachweis |
| Migration | Gesichertes separates Ziel und einmalige Aktivierung | Dual-Write/stale Rückfall verletzt eindeutigen maßgeblichen Bestand |
| Modellierung | Typisierte Fachmodelle, getrennte ORM-/öffentliche Modelle | Universalentity verkoppelt UI/Server/DB und Privatheit |
| Ansichten | Begrenzte Seiten mit Fachprojektionen | Vollsnapshots einfach, aber Kopier-/Parse-/Speicherkosten |
| Infrastruktur | Modularer Einzelserver und lokale Runtimes | Cluster/Mikroservices erhöhen Betriebs-/Transaktionskomplexität ohne Auftrag |

Neue Schnittstellen: generierte typisierte Fach-/Anwendungsverträge; lokale Operations-ID/Receipt-/CommitOutcome-Ports; stabile Fehlercodes; begrenzte Views und versionierte Caches; gemeinsame Clientcryptoports und öffentliche Serverprüfung; Runtimezustands-/Updatekompatibilität. Bestehende Datenformate bleiben kompatibel; notwendige Binding-/Storageänderungen werden unabhängig versioniert, gesichert und vor Aktivierung geprüft. Kein automatischer großer Rust-Integerbereich, kein JSON-BigInt-Fallback.

## Migrationsfolge und Entscheidungstore

1. Typisierte Kernmodelle und generierte Verträge auf vorhandenem K04-Katalog; Runtimegrenzen und Fehlercodes festlegen.
2. Native/WASM-Crypto und Diesel/VFS/DSL praktisch nachweisen, erst nach gesonderter Freigabe. Ohne Pflichtbeleg Bestand erhalten und Rückfrage; keine automatische Ersatzwahl.
3. Lokale Receipts/Commitdienst und Rust-Anwendung integrieren; bestehende Profile/Historie/Importformen erhalten. Den vorhandenen Finanzkern nicht neu fachlich erfinden.
4. Native/WASM-DAL, begrenzte Views und Anwendungsintegration bereitstellen; Altpfade nur nach Parität entfernen. Browserübernahme separat sichern/prüfen/aktivieren; Assetupdates und alte Writer koordinieren.
5. Servercontracts/Axum und SQLite/PostgreSQL/MySQL getrennt implementieren; alle sechs SQLwechsel und Wiederanlauf prüfen. Lokale Umstellung benötigt keine noch offenen P8/P9-Produktfeatures.
6. Zielkonformität, E2EE-/Privatheits-/Kompatibilitätsregression und reale Plattformabnahmen. Architekturgesamtabschluss erst bei allen erfüllten Kriterien.

Auftragstore und aktueller Fortschritt stehen in GitHub/tasks.md. Bibliotheksversionen werden erst bei tatsächlicher Machbarkeit nach Reifezeit-/Lizenz-/Toolchainprüfung gesperrt. Keine Schätzung wird zum Nachweis. Die offene Exportdownloadpräferenz aus #84 bleibt vor einer neuen UIentscheidung zu klären; dieses Review aktiviert keinen Download und keine P10-Gesamtsicherung.

## Bereinigung, Tracking und Reviewabnahme

K-/DAL-Konzepte wurden zusammengeführt, aktuelle Arbeits-/Test-/Betriebsquellen neu ausgerichtet, überholte Teilpläne P1–P5 und Übergaben nach Sicherung ihrer Git-Referenzen entfernt. P6–P11 behalten funktionale Spezifikation mit dem neuen Rustziel, keine kopierte Fortschrittsliste. Frühere Abnahmen sind über [Belegindex](review-evidence.md) erreichbar, nicht als aktuelle Zielabnahme dargestellt. Alle bestehenden Issuekriterien werden bewahrt oder explizit ersetzt; #91/#105/#111 werden erst nach Anlage/Verlinkung ihrer Nachfolger als not_planned geschlossen.

Dieser Review ist abgeschlossen, wenn alle Befunde einem Issue/Vertrag zugeordnet, aktuelle Dokumentations-/Vertragsquellen widerspruchsfrei, entfernte Ziele ohne aktive lokale Verweise und sämtliche Issueänderungen vollständig rückgelesen sind. Tatsächliche Prüfbelege und Bereinigungszählungen werden im [Belegindex](review-evidence.md#reviewabnahme) ergänzt. Produktumsetzung/DBmigration/Native-/Kryptografieabnahme sind ausdrücklich nicht durch den Review erfüllt.
