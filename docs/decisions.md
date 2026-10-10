# Architekturentscheidungen

Stand: 9. Oktober 2026. Aktive Entscheidungen und Übergangsregeln für das [gemeinsame Rust-Ziel](architecture.md). Auftrag/Freigaben ausschließlich in [Aufgaben](tasks.md). Alte Entscheidungstexte und ihre Herkunft bleiben über die [unveränderliche ADR-Historie](https://github.com/mpwg/WiMM/blob/84d730cc6e10d70cf6ac6ff9bc28c4a9c4376e92/docs/decisions.md) erhalten; sie sind keine zweite aktive Zielspezifikation. Nummern werden nicht wiederverwendet.

## Weitergeltende Produkt- und Sicherheitsentscheidungen

| IDs | Aktive Festlegung | Quelle |
| --- | --- | --- |
| ADR-001/003/006/007/010 | Familien/DACH, PWA/Desktop, EUR/Dateiimport zuerst, Plan-/Umschlagbudget, mehrere Haushalte | [Produkt](product.md), [Fachmodell](domain.md) |
| ADR-002/009/015/017/018/020/022 | Bereichstrennung, freiwillige private Angaben, Fachbefehle/CAS, Originalentwürfe, Tombstones/Epochen, getrennte Nutzer-/Betreiberexports | [Fachmodell](domain.md), [Sync](synchronization.md), [Formate](formats.md) |
| ADR-004/005/035 | React/PWA und Tauri mit nativer Integration, kein Actual-Fork, markante ruhige UI | [UI](ui.md), [UX](ux-redesign.md) |
| ADR-012/025/026/027/030 | AGPL-3.0-or-later, verpflichtende E2EE, libsodium/Recovery, vertrauenswürdige Clients ohne Attestierung, externe Serveridentitäten | [Verschlüsselung](encryption.md), [Sicherheit](security.md) |
| ADR-028/029/038 | Gemeinsame Projektskills/Prüfungen, aktive Arbeitskopie, direkte main-Arbeit ohne Force-Push | [AGENTS.md](../AGENTS.md), [Leitfaden](agent-guide.md) |
| ADR-032/033/036/037/039 | Abgleich/Gegenbefehle, Importgruppen/Dauerzahlungen, atomare Profilrevision, KDF-Legacyhärtung, lokale Finanzrevision | [Fachmodell](domain.md), [Datenmodell](data-model.md), [Verschlüsselung](encryption.md) |
| ADR-040/041/045/048 | Lokale Epoche, geprüfter Snapshotersatz, CAS-gebundener Projektionsneuaufbau, registrierte gesicherte Indexmigration | [Speicherkontext](data-model.md), [Verträge](core-contracts.md) |

ADR-008/011/024/031/034 sind ersetzt. Frühere D0-Auftragsbegrenzungen ADR-013, Bibliotheksdefaults ADR-014/016/019 und SQLite-only-Anteil von ADR-021 gelten nicht als neues Ziel. ADR-042/044/046 bleiben in ihrem Fachkern-/Portabilitäts-/Versionierungszweck erhalten und werden durch ADR-050–052 erweitert. ADR-043/047 beschreiben die geprüfte TS-Anwendung als Übergang; ihr dauerhafter TS-Anteil ist ersetzt. ADR-049 ist als separates vorgeschlagenes DAL-Konzept durch ADR-050–052 konsolidiert. Historische Belege behaupten keine neue Abnahme.

## ADR-050 — Gemeinsame typisierte Rust-Clientanwendung

- Datum: 9. Oktober 2026. Status: angenommen als Architekturziel, Produktdeltas noch nicht implementiert.
- Herkunft: ausdrücklicher Review-/Umbauauftrag und Nutzerwahl „Langfristige Vereinheitlichung“.
- Problem: Gemeinsamer Rust-Kern und DAL lassen TS-/native Profil-, Historien-, Konflikt- und Commitkoordination doppelt zurück; manuelle JSONformen erschweren Vertragsänderungen.
- Entscheidung: Rust-Fachmodelle/Befehle typisieren, Grenzverträge aus gemeinsamer Rustquelle generieren, Clientabläufe in gemeinsamer Rust-Anwendung mit injizierten Ports ausführen. UI erhält begrenzte Views/Zustand; ORMtypen sind intern. Fachkern bleibt UI/HTTP/DBfrei. Eigene Crates/Bindings/Buildscripts bleiben global unsafe-frei.
- Alternativen: TS-Anwendung plus native Ablaufkopien spart Erstumbau, widerspricht aber der priorisierten Wiederverwendung. Ein Rust-Monolith vermischt Fach-, Speicher- und Plattformverantwortung.
- Folgen: Zusätzliche Krypto-/Binding-/Runtimearbeit; langfristig eine Ablaufsemantik. React/Tauri bleiben, neue native Produktoberflächen weiterhin eigene Aufträge.
- Betroffene Verträge/Pakete: [Anwendungsports](core-contracts.md), [Architektur](architecture.md), AR01–AR08/AR11 in [Gesamtübersicht](https://github.com/mpwg/WiMM/issues/114); erweitert ADR-042/046 und ersetzt TS-Zielanteile ADR-043/047.
- Migration und Kompatibilität: vorhandene Daten/Cent-/Cryptoformate erhalten; Altpfade erst nach Parität entfernen. Binding-/Storagewechsel explizit versionieren. K02 bleibt gültiger historischer Auslagerungsbeleg, nicht neue Rust-Anwendungsabnahme.
- Prüfung: Native Rust-Assertions, reale WASM-/Swift-/Kotlin-Abläufe, Form-/Integer-/Unicode-/null-Negativkatalog, Sitzung/CAS/Abbruch/Historie und negative Abhängigkeiten.

## ADR-051 — Gemeinsamer lokaler Rust-DAL mit gesicherter Aktivierung

- Datum: 9. Oktober 2026. Status: angenommen als Ziel mit zwingenden Machbarkeitstoren; Produktmigration offen.
- Herkunft: bestätigtes DAL-Ziel und Neuausrichtungsauftrag; konsolidiert ADR-049.
- Problem: Dexie/IndexedDB und rusqlite teilen Verträge, aber keine Implementierung; lokaler void-Batch ohne Operationsreceipt kann Antwortverlust nicht dauerhaft auflösen.
- Entscheidung: Diesel zuerst als lokalen nativen/WASM-ORM prüfen; SQLite nativ und dauerhaftes Browser-SQLite mit VFS/OPFS. Etablierte Rust-Schema-DSL, zunächst SeaQuery prüfen. Lokale Operationsidentität, Receipt/CommitOutcome, strukturierte Fehler, CAS, Caches/Outbox teilen den Commit. Servermodelle bleiben getrennt; nur technische Infrastruktur teilen.
- Alternativen: IndexedDB hinter Rust-Port oder SeaORM brauchen bei fehlendem Nachweis eine neue Nutzerentscheidung; keine automatische Ersatzwahl. Keine eigene LINQ-/DbContext-/VFS-/Kryptografieimplementierung.
- Folgen: VFS/Writer/Hosting/Browsernachweise und backendgerechte DDL/Restore nötig. Öffnen führt keinen automatischen Schemaabgleich aus. Fachbeträge werden ausschließlich im Kern berechnet.
- Betroffene Verträge/Pakete: [Speicher-/Migrationsports](core-contracts.md), [Datenmodell](data-model.md), DAL01–DAL05/DAL07 und AR04/AR07/AR09; bestehende #77–#86 behalten gültige Bestandskriterien.
- Migration und Kompatibilität: verschlüsselter konsistenter Originalsnapshot, bestätigter Sicherungsbeleg, separates Ziel, vollständiger Vergleich und absturzsichere Single-Writer-Aktivierung. Alle IDs/Revisionen/Tombstones/Pending/Bestätigungen/Epochen/Cursor erhalten; kein Dual-Write oder stale Rückfall. IndexedDB bleibt bis geprüfter Aktivierung maßgeblicher Bestand.
- Prüfung: dieselbe kleine DAL-Implementierung nativ/WASM mit echter Persistenz/Neustart, CAS/Rollback/Tabführung, DSLmigration/Journal, Quota und globalem unsafe-Verbot. Fehlender Pflichtnachweis verhindert Umstellung; neue Produktarbeit benötigt gesonderte Freigabe.

## ADR-052 — Eigenständiger öffentlicher Rust-Server

- Datum: 9. Oktober 2026. Status: angenommen als Architekturziel; Fastify-Stub bleibt bis geprüfter Parität Bestand.
- Herkunft: Nutzerwahl „Rust-Server bevorzugen“ und Auftrag, Dokumente/Issues entsprechend neu auszurichten.
- Problem: Fastify ist bislang ein kleiner Health-/Metadatenstub; Node–Rust-DAL würde vor Produktserveraufbau eine zusätzliche FFI-/Scheduling-/Lebensdauergrenze schaffen.
- Entscheidung: Axum/Tokio-HTTP-Hülle, öffentliche Rust-Serveranwendung und eigener Server-DAL für SQLite/PostgreSQL/MySQL. Kein Import des Finanzkerns/lokalen Finanz-DAL/privater Entschlüsselungsfunktionen. OIDC/Sessions/Geräte/Roster/Receipts/Chiffrate folgen bestehenden API-/E2EE-Verträgen; Identität ausschließlich aus Sitzung.
- Alternativen: Fastify mit Rustbindung erhält JS-Werkzeuge, erhöht Integrationsaufwand. Kein Frameworkwechsel im Client und keine Mikroservices/Cluster.
- Folgen: Rust-HTTP-/Autorisierungs-/Konfigurationsprüfungen ersetzen spätere Fastify-Injektionstests. Blockierende DBarbeit begrenzen, Antwortverlust/Commitstatus und kontrollierten Shutdown berücksichtigen. SQLite bleibt Single-Instance-Default.
- Betroffene Verträge/Pakete: [API](api.md), [Sync](synchronization.md), [Betrieb](operations.md), K06–K11 und [AR10 #124](https://github.com/mpwg/WiMM/issues/124); #111 wird not_planned mit Nachfolger geschlossen, ADR-014/044 entsprechend präzisiert.
- Migration und Kompatibilität: vorhandene Health/Meta/Pfade/WIMM-Konfiguration erhalten; Fastify erst nach Parität entfernen. Server-SQL-Wechsel und Wiederanlauf bleiben gesicherte Betreiberverfahren. P8/P9-Features und Releases benötigen ihre eigene Freigabe.
- Prüfung: native Rust-Assertions und echter HTTPserver, getrennte echte Server-DB-Contracts, sechs SQLwechsel, OIDC/CSRF/Rollen-/Signaturmatrix nach Featurefreigabe sowie negative Serverabhängigkeiten.

## ADR-053 — Typisierte UniFFI-/WASM-Bindings

- Datum: 9. Oktober 2026. Status: Typisierung angenommen; Kompatibilitätsanteil am 10. Oktober 2026 durch ADR-060 ersetzt. AR02-Abnahme ist historischer Beleg, vollständige Legacyentfernung folgt #146.
- Herkunft: ausdrückliche Nutzerwahl „B – Typisierte APIs jetzt einführen“ im Fortsetzungsauftrag zu #116.
- Problem: Stringbasierte APIs lassen Sprachmodelle und tatsächliche Grenzformen auseinanderlaufen. Die Entscheidung zwischen Beibehaltung der JSON-ABI und neuer typisierter API war offen.
- Entscheidung: Jetzt typisierte UniFFI-/WASM-Einstiege aus Rust mit expliziter Bindingversion 2 einführen. Der ursprünglich geforderte V1-Kompatibilitätsadapter entfällt durch ADR-060. Etablierte, gesperrte Generatoren verwenden; Fachkern bleibt plattformfrei, eigener Code unsafe-frei. Sprachsignaturen und maschinenlesbare Schemas reproduzierbar erzeugen und negativ auf Drift prüfen.
- Alternative: V1 als einzige ABI behalten und nur Sprachdatenmodelle generieren (Variante A). Der Nutzer hat Variante B gewählt.
- Folgen: Records/Enums, Versions-/Ergebnis-/Fehlerformen und sämtliche vorhandenen Aktionen müssen nachgewiesen werden. Öffentliche, lokale und private Module bleiben getrennt; öffentliche Module erhalten keine privaten Fachabhängigkeiten.
- Betroffene Verträge/Pakete: [Fach-/Anwendungsverträge](core-contracts.md), [AR02 #116](https://github.com/mpwg/WiMM/issues/116), Bindings und Vertragsgenerierung.
- Migration und Kompatibilität: Gemäß ADR-060 keine historische V1-ABI unterstützen und keine Altdatenmigration implementieren. Bestehende JSON-Einstiege und Kompatibilitätsmodelle vollständig entfernen. Finanzschema eins und vorhandene Crypto-/Transport-/Storage-/Exportversionen bleiben unabhängig.
- Prüfung: Direkte native Rust-Assertions, identische positive/negative Fälle in tatsächlichen Swift-/Kotlin-/WASM-/Browserläufen, versionierte generierte Dateien und negative CI-Driftprüfung. Generierung allein ist keine Sprachlaufzeitabnahme.

- Historischer Zwischenstand der Quellaufteilung in AR02: wimm-finance-types privat, wimm-public-contracts öffentlich, wimm-contract-primitives neutral. Öffentliche Schema-/Sprachmodule getrennt, öffentliche Default-Abhängigkeitsclosure ohne Fachmodelle/Plattform/ORM negativ geprüft. Generische Recorddeklarationen vermeiden eine zweite Deserialisierungsfeldliste; öffentliche arithmetische CAS-/Rosterprüfungen bleiben ergänzende Rust-Guards neben Standard-Formschemas. Native Clientbrücken und unabhängige öffentliche WASM-Formprüfung verwenden dieselben Modelle; keine Transport-/Suite-/Produktumschaltung. Lokale Quellen und weitere Kompatibilitätsformen bleiben offen.

- Historischer lokaler Metadatenabschnitt: wimm-local-contracts mit eigener Namespace-/Fehlerform; gemeinsame Recorddeklaration/Validate-Trait neutral, keine zweite Deserialisierungsfeldliste. Vorwärts-/Folgenprüfung ebenfalls als verpflichtender Rust-Guard; keine Speicherung/Migration aus Formbindings. Vollständige lokale Snapshot-/Kompatibilitäts-/Portabnahme bleibt offen.

- Historische abschließende AR02-Aufteilung (Kompatibilitätsanteile durch ADR-060 ersetzt): komplette lokale Daten-/Portformen einschließlich flacher Snapshotkompatibilität und explizit opaker Legacy-JSONdaten; nominale Serde-UUIDpolicy ohne kopierte Feldlisten. Versionierte manifeste V1/V2-Requests/Resultate/Fehler einschließlich Geldkomfortrepräsentation. Nichtfinite/nicht darstellbare JS-Daten werden vor Standard-JSON abgewiesen. Standardschema ergänzt die erforderlichen Rust-Guards, ersetzt sie nicht. Schemawerkzeug nutzt auch Rust-Bindingdaten für Komfortschemas; keine Fachhandlerausführung oder Produkt-/Storageformatumschaltung.

## ADR-054 — Getrennte Persistenzports und lokale Operationsdimension

- Datum: 10. Oktober 2026. Status: angenommen als technische Konkretisierung von ADR-050–052 im freigegebenen DAL02-Auftrag; keine neue Produktentscheidung.
- Herkunft: bestätigte Trennung von lokalem Finanz-DAL und öffentlichem Server-DAL, versionierte lokale Identität/Receipts aus #107/#118.
- Problem: Gemeinsame technische Transaktionszustände dürfen weder private Datenmodelle noch ORM-/Verbindungsobjekte in öffentliche Ports ziehen. Lokale Idempotenz benötigt eine eigenständige Inhalts-/Profil-/Bereichs-/Epochendimension.
- Entscheidung: Neutraler wimm-persistence-contracts für generische Commitzustände und Migrationscheckpointdaten; getrennte konkrete lokale/öffentliche Ports. Neue Operationsvertragsversion eins für lokale Identität, Request und Receipt. Pure Rust-Memoryreferenz implementiert vorhandene lokale Datenports; Fach-/Cachevalidierung wird zwingend injiziert und im Fachkern ausgeführt.
- Alternativen: Gemeinsame Client-/Serverentities würden die bestätigte Vertrauensgrenze verletzen; ORM-/SQLcallbacks würden Adapterdetails in Anwendungsports tragen. Der technische ORM-/Journalunterbau bleibt adapterintern.
- Folgen: Zusätzliche generierte lokale/öffentliche Datenformen mit derselben Rust-Quelle; SHA-256 über private typisierte Serde-Requestbytes in der Memoryreferenz. Unveränderte lokale Operationsidentität/Inhalt liefern dasselbe Receipt, Inhaltsabweichung einen strukturierten Fehler; unklarer Commit benötigt Ergebnisabfrage.
- Betroffene Verträge/Pakete: [Anwendungsverträge](core-contracts.md), [DAL02 #107](https://github.com/mpwg/WiMM/issues/107), AR04/#118 und nachfolgende Adapter.
- Migration und Kompatibilität: Neue unabhängige Operationsdimension eins; Binding zwei und bestehende V1-/Storage-/Fach-/Crypto-/Transport-/Exportformen bleiben erhalten. Keine Produktdatenmigration oder Umschaltung. Dauerhafte Receipts/Crash-/Wiederanlauf folgen AR04; Memory wird nicht als Persistenzfallback verwendet.
- Prüfung: [DAL02-Matrix](dal02-contracts.md), native Memory-/Serde-/Versions-/CAS-/Rollback-/Antwortverlusttests, unveränderte Altgoldens, Sprach-/Schemas und transitive positive/negative Architekturprüfungen.

## ADR-055 — Vollständige lokale Receiptsicherung und Commitabbruch

- Datum: 10. Oktober 2026. Status: angenommen als technische Konkretisierung des freigegebenen AR04-Auftrags.
- Herkunft: #118 verlangt gesicherte kompatible Schema-/Restoreverfahren und unveränderte Commitgewissheit nach Abbruch.
- Problem: Die bestehende Snapshotform enthält keine Receipts. Eine Wiederherstellung allein dieser Form würde dauerhafte Ergebnissuche verlieren; ein spätes Abbruchsignal darf abgeschlossene Writes nicht als Rollback darstellen.
- Entscheidung: Neue private DAL-Checkpointform eins enthält den konsistenten Datenstand und ursprüngliche Request-/Receipteinträge. Bestehende Snapshot-/Nutzerexport-/Cryptoformen bleiben unverändert. Dieselbe SnapshotProtectionPort-Schnittstelle wird mit einem Default-Typparameter erweitert; etablierte AR08-Verschlüsselung schützt die neue versionierte Klartextform. Backup muss dauerhaft gespeichert und rückgelesen sein, bevor Ausgangsdaten ersetzt werden. Restore vergleicht den vollständigen ursprünglichen Checkpoint atomar und erhält bekannte historische Receipts. Neue Writes sind an die vom Client vorbereitete aktuelle Epoche gebunden.
- Alternativen: Stille Erweiterung alter Snapshot-/Exportformen würde deren Versionsvertrag verletzen; nur Memory-/Metadatenbestätigung eines Backups wäre kein dauerhafter Nachweis.
- Folgen: Typisierte lokale Checkpoint-/Receipteinträge, reproduzierbare Sprach-/Schemaquellen und zusätzliche native/Browserfälle. Dieser erste Commitstore weist bestätigte/Syncdaten ab, bis die vollständigen Storageports umgesetzt sind; keine stille Auslassung. Finanz-/Cacheprüfung wird vom Client/Fachkern injiziert.
- Betroffene Verträge/Pakete: [Anwendungsverträge](core-contracts.md), [AR04 #118](https://github.com/mpwg/WiMM/issues/118), nachfolgende DAL-/Clientpakete.
- Migration und Kompatibilität: Checkpointversion eins und registriertes initiales physisches Schema eins; alte Snapshot-/Export-/Binding-/Crypto-/Transportdimensionen unverändert. Keine Produktaktivierung, IndexedDB-Migration oder P10-Gesamtsicherung. Destruktiver Restore benötigt dauerhaftes verschlüsseltes Original und CAS; neue Restoreepoche wird vom autorisierten Client vorbereitet, nicht vom Backend erfunden.
- Prüfung: tatsächliche native SQLite und persistente Browser-SQLite mit fehlendem/fehlerhaftem Backup, falschem Schlüssel/Scope, konkurrierendem Write, Restorefehler, Receiptaufbewahrung und vor-/nach-Commit-Abbruch.

## ADR-056 — Produktive Commitumschaltung bereits in AR05

- Datum: 10. Oktober 2026. Status: angenommen.
- Herkunft: ausdrückliche Nutzerwahl „Reihenfolge ändern, Produktumschaltung bereits in #119“ als Antwort auf den Widerspruch zwischen #119 und #120.
- Problem: Frühere Folge #119 → #108 → #120 verlangte in #119 bereits die Entfernung produktiver TS-Commitduplikate, ließ den geprüften DAL und die Rust-Anwendungsgrundlage jedoch erst danach entstehen.
- Entscheidung: #119 behält die vollständige produktive Umschaltung. Neue Voraussetzung [#139](https://github.com/mpwg/WiMM/issues/139) baut gemeinsame Rust-Commit-/Laufzeit-/Portgrundlagen vor nativer #108 und Browser #109. #109 setzt diese frühe Grundlage statt abgeschlossenen #120 voraus. Sichere Updates, Bestands-/Export-/Migrations-/Aktivierungskriterien werden vor produktiver #119-Umschaltung erfüllt. #120 erweitert danach Profil-/Key-/Anwendungsabläufe; #121 die weitergehenden Views/Projektionen. Konkrete Folge ausschließlich #114.
- Alternative: #119 allein als Bibliothek abnehmen und Produktumschaltung #120 zuordnen. Der Nutzer hat diese Alternative ausdrücklich nicht gewählt.
- Folgen: Keine Teilbibliotheks-/Memoryabnahme als #119-Abschluss; keine Zwischenlösung mit neuen Legacy-Receipts, Dual-Write oder stale Backendfallback. Bereits geprüfte Rust-Schreibpfade werden in #120 nicht dupliziert.
- Betroffene Verträge/Pakete: [Aufgaben](tasks.md), [Architektur](architecture.md), [Anwendungsverträge](core-contracts.md), #114/#139/#108/#109/#119/#120.
- Migration und Kompatibilität: Alle bestehenden Daten-/Finanz-/E2EE-/CAS-/Backup-/Update-/Leistungs-/Plattformkriterien bleiben erhalten. Neue Produktfunktionen P6–P11 und Releases nicht beauftragt. Umschaltung erst nach tatsächlichem Nachweis und gesicherter Bestandsaktivierung.
- Prüfung: Native Rust-Assertions und tatsächliche native/Browser-/Sprach-/Bestands-/Migrationskonformität pro Voraussetzung; #119 schließt erst nach tatsächlicher produktiver Entfernung der Commitduplikate.

## ADR-057 — Privater dauerhafter Anwendungswiederanlauf vor Finanzwrite

- Datum: 10. Oktober 2026. Status: angenommen als technischer Default für #139; produktive Journal-/Runtimeintegration und Sprachabnahme separat offen.
- Herkunft: freigegebene Anforderung aus #139, unknown nach vollständigem Anwendungsneustart am ursprünglichen Auftrag aufzulösen und Originalentwürfe zu bewahren.
- Problem: Ein flüchtiger Pipelineauftrag geht beim Prozessabbruch verloren. Ein fehlendes Receipt beweist anschließend keinen Rollback; ein neuer unabhängiger Write würde Doppelwirkungen riskieren.
- Entscheidung: RecoveryTicket mit eigener Version eins bindet ursprünglichen Kontext, Operationsidentität, SHA-256 und geschriebene Revisionen. Der vollständige ursprüngliche LocalCommitRequest bleibt über den bestehenden injizierten SnapshotProtectionPort verschlüsselt erhalten. Vor Finanzwrite: authentifizierter Originalvergleich, dauerhafte profilgebundene save-if-absent-Speicherung und tatsächliches Rücklesen. Wiederanlauf entschlüsselt/prüft Original und liest ausschließlich dessen Receipt. Fehlender Nachweis, falscher Schlüssel oder manipulierter Inhalt erhält Referenz und Writesperre. Keine automatische neue Operations-ID oder Wiederholung.
- Alternativen: Nur flüchtiger Auftrag verliert den Originalbezug; nur Hashmetadaten verlieren den Originalinhalt vor einem Finanzwrite. Finanzklartext im Wiederanlaufjournal wird nicht benötigt.
- Folgen: Ein bekannter Commit bleibt auch bei Journalcleanupfehler committed; die verbliebene Referenz blockiert weitere Writes bis erneuter Originalauflösung. Sitzungshistorie wird nach Neustart nicht restauriert. Journalport verlangt dauerhafte CAS-Operationen, profilgebundenen Zugriff und Schutz über vorhandene AR08-Primitive; keine eigene Kryptografie.
- Betroffene Verträge/Pakete: [Anwendungsverträge](core-contracts.md), [Rust-Anwendung](../crates/client-application/README.md), #139/#108/#109/#119.
- Migration und Kompatibilität: Separate private Wiederanlaufversion eins; bestehende Snapshot-/Checkpoint-/Binding-/Finanz-/Crypto-/Transportversionen unverändert. Kein Server-/Export-/Logdatensatz und kein zweiter Finanzwriter. Physischer Journaleinbau samt Sicherung/Migration folgt im vollständigen DAL; native Datei-Testfixture ersetzt diese Integration nicht.
- Prüfung: Native Assertions mit zwei tatsächlich getrennten Prozessen, realem SQLite und vorhandenem libsodium-Port; Antwortverlust, Abbruch vor Finanzwrite, Originalvergleich, falscher Schlüssel/manipulierter Chiffratinhalt, Journalfehler und Commitgewissheit trotz Cleanupfehler. Tatsächliche WASM-/Sprach-/Produktintegration bleibt eigene Voraussetzung.

## ADR-058 — Native Receipterweiterung mit Sperre älterer Writer

- Datum: 10. Oktober 2026. Status: angenommen als technischer Default des freigegebenen DAL03-Auftrags.
- Herkunft: #108/#118/#139 verlangen dauerhafte lokale Receipts, geschützten Wiederanlauf und gesicherte Schemaänderung ohne stale Rückfall.
- Problem: Neue Tabellen bei unverändertem altem physischen Versionsmarker würden älteren Tauri-Apps weitere Writes erlauben. Eine profilgebundene Einzelsicherung reicht nicht als Originalvergleich für eine datenbankweite Schemaerweiterung mit mehreren Profil-/Bereichsbeständen.
- Entscheidung: Registrierte native Erweiterung eins über SeaQuery erzeugt eigene Schema-/Sicherungsjournal-, Receipt- und Recoverytabellen sowie einen Bereichsindex. Alle betroffenen Profil-/Bereichssnapshots werden über vorhandene Krypto-/Backupports tatsächlich verschlüsselt gespeichert, rückgelesen und mit den Originalen verglichen. Unter unmittelbarer SQLite-Schreibtransaktion wird der vollständige aktuelle Bestand erneut verglichen. DDL, Journal und physischer `storage_meta.storageSchemaVersion`-Marker drei werden atomar aktiviert. `wimm_native_schema.original_version` bewahrt das bisherige Snapshotformat eins oder zwei; Fachschema eins bleibt erhalten.
- Alternativen: Zusätzliche Tabellen ohne alten Versionsmarker zu ändern lassen alte Writer weiterlaufen. Ein Finanz-/Bindingversionswechsel würde unabhängige Vertragsdimensionen vermischen. Ein automatischer Schemaabgleich oder eine Sicherung ohne tatsächliches Rücklesen erfüllt die bestehenden Kriterien nicht.
- Folgen: Ältere native Apps weisen physischen Stand drei bereits mit ihren vorhandenen Guards ab. Der gemeinsame DAL versteht die neue physische Form und exportiert weiterhin die bisherige logische Snapshotform. Unvollständige oder widersprüchliche Header werden nicht repariert. Integrierte Receipts binden Originalauftrag, Profil, Bereich, Epoche, Operations-ID, Hash und geschriebene Revisionen; historische Receipts bleiben nach autorisiertem Epochenwechsel abfragbar. Recoverybytes bleiben privat und profilgebunden, mit save-if-absent und vollständigem Byte-CAS beim Entfernen. Schutz und Ticketprüfung liegen weiterhin im Rust-Anwendungs-/Kryptoport; keine DAL-Kryptografie.
- Betroffene Verträge/Pakete: [Lokale Ports](core-contracts.md), [DAL03-Matrix](dal03-native.md), [Rust-DAL](../crates/local-dal/README.md), #108/#109/#119 und ADR-051/055/057.
- Migration und Kompatibilität: Kein Finanz-, Binding-, Crypto- oder Nutzerexportformatwechsel. Keine Produktaktivierung, Dual-Writes oder Änderung fremder Bestandsdaten; aktuelle Tauri-Composition bleibt bis vollständiger Abnahme unverändert. Vollständige Receipt-/Recoverycheckpoint-/Restore- und Aktivierungsintegration bleiben Pflicht vor Produktumschaltung.
- Prüfung: Native SQLite 3.53.2, tatsächliche verschlüsselte Dateisicherung/Originalvergleich über mehrere Profile, stale Ausgangsstand, falscher Schlüssel/Manipulation/fehlendes Backup, Abbruch nach DDL mit Rollback, Receiptfehler nach Finanzwrites, drei Abbruchgrenzen, Neustart in separatem Prozess mit Receipt und tatsächlich entschlüsseltem Original, Header-/Profil-/CAS-Negativfälle sowie tatsächlicher Tauri-Altversionsguard.

## ADR-059 — Lokale Schreibepoche getrennt von bestätigter Serverepoche

- Datum: 10. Oktober 2026. Status: angenommen durch ausdrückliche Nutzerentscheidung.
- Herkunft: Nutzerwahl „Lokale Schreibepoche und Serverepoche trennen (empfohlen)“ bei der DAL03-Restoreumsetzung.
- Problem: ADR-055 verlangt eine neue lokale Restoreepoche, während die bestehende Snapshotepoche zugleich bestätigte Serverdaten und den Synccursor bindet. Ein Backend darf diese Serverdaten beim lokalen Restore nicht als neu bestätigt umetikettieren.
- Entscheidung: Lokale Operationsidentität und CommitContext beziehen sich auf eine eigene persistente lokale Schreibepoche. Die vorhandene Snapshot-/Bestätigungs-/Syncepoche behält ihre bisherige Herkunft. Verbundener Restore erhält die aus der geschützten Sicherung stammenden bestätigten Serverdaten, Epoche und Cursor unverändert; nur die lokale Schreibepoche wird auf den vom Client ausdrücklich vorbereiteten neuen Wert gesetzt. Standalone darf seine lokale Snapshotepoche ebenfalls auf den neuen lokalen Wert setzen, ohne einen Synccursor zu erzeugen.
- Alternativen: Verbundenen Restore an einen serverautorisierten Epochenwechsel binden. Diese Variante hätte spätere Syncfunktionalität vorausgesetzt; der Nutzer hat die lokale Trennung gewählt.
- Folgen: Neue private vollständige Checkpointform zwei mit eigener lokaler Schreibepoche, vorhandener Snapshotform, sämtlichen historischen Originalreceipts und profilweiten Recoverybytes. Restore verlangt rückgelesene verschlüsselte Originalsicherung und vollständigen Checkpoint-CAS. Bestehende historische Receipts bleiben erhalten; ein aktueller ungelöster Originalauftrag wird nicht durch einen anderen oder durch eine leere historische Referenz ersetzt. Kollisionen, Abbruch und Fehler rollen den gesamten Ersatz zurück. Der DAL erzeugt keine Serverbestätigung und berechnet keine Finanzregeln.
- Betroffene Verträge/Pakete: [Speichermodell](data-model.md), [Ports](core-contracts.md), [DAL03-Matrix](dal03-native.md), #108/#109/#119/#120; präzisiert ADR-055/057/058.
- Migration und Kompatibilität: Physischer Stand vier und native Erweiterung zwei sperren sowohl frühere Tauri-Writer als auch den früheren DAL-Stand drei. Der physische Stand drei bleibt ausschließlich lesbar; expliziter Vorwärtsschritt verlangt vollständige geschützte Checkpoints aller Bereiche einschließlich Receipts und Recoverybytes. Ursprüngliches Sicherungsjournal bleibt erhalten, neue Sicherungsbelege werden zusätzlich registriert. Öffnen migriert nicht. Logische Snapshotformen eins/zwei, Fachschema eins, Binding-/Crypto-/Nutzerexportformen bleiben erhalten. Neue Checkpointform zwei ersetzt die eingeschränkte Checkpointform eins nicht still. Keine Produktaktivierung aus diesem Abschnitt.
- Prüfung: Native verbundene/Standalone-Restores mit realer SQLite und AR08-Verschlüsselung, getrennte Server-/lokale Epochen, stale Writes und ursprüngliche Receipts, vollständiger Original-/Recovery-CAS, Rollback nach Snapshotlöschung, Abbruch, tatsächliches Dateineuöffnen, gesicherter Drei-nach-vier-Schritt sowie generierte Sprach-/Schemaformen und negative Driftprüfungen. Runtime-/Tauri-/gemeinsame Konformitätsabnahme bleibt #108.

## ADR-060 — Zielimplementierung ohne Legacy-Komponenten

- Datum: 10. Oktober 2026.
- Status: angenommen; ersetzt die Kompatibilitäts-/Altdatenübernahmeanteile von ADR-051/053/058/059. Typisierte APIs, Epochentrennung und Sicherheitsregeln bleiben erhalten.
- Herkunft: ausdrückliche Nutzerentscheidung: WiMM ist unveröffentlicht, es gibt keine Altdaten zu übernehmen; „Hinterlass keine Legacy Komponenten“.
- Problem: Frühere Übergangsanforderungen halten alte JSON-Bindings, Schema-Upgrades, doppelte Speicherimplementierungen und Referenzbackends im Projekt, obwohl keine Releasekompatibilität benötigt wird.
- Entscheidung: Ausschließlich die gemeinsame Rust-Zielimplementierung unterstützen. Ersetzte produktive Komponenten, test-only Altimplementierungen, Kompatibilitätsadapter und alte Datenübernahmepfade vollständig entfernen. Aktuelle Dateiformen unmittelbar vollständig initialisieren; unbekannte oder nicht unterstützte Dateien kontrolliert ablehnen, niemals still löschen, reparieren oder auf ein anderes Backend zurückfallen.
- Folgen: Rust-Fachorakel und relevante Konformitätsfälle bleiben erhalten; sie prüfen die Zielimplementierung und keine zweite alte Finanzengine. Binding-/Schema-/Runtimeversionen bleiben eindeutig. Verschlüsselte Sicherung, aktueller Checkpoint/Restore, CAS, Abbruch, Recovery und getrennte lokale/Serverepochen bleiben erforderlich. Updates sowie die sechs Server-SQL-Wechsel sind keine Legacyübernahme und bleiben im Auftrag.
- Betroffene Verträge/Pakete: [Architektur](architecture.md), [Anwendungsverträge](core-contracts.md), [Aufgaben](tasks.md), [Bereinigung #146](https://github.com/mpwg/WiMM/issues/146), #108/#109/#114/#119/#120/#123/#124. Die ausschließlich alte IndexedDB-Datenübernahme betreffende #110 entfällt.
- Migration und Kompatibilität: Keine Unterstützung historischer unveröffentlichter Daten- oder Bindingformen. Der aktuelle native physische Stand fünf wird unmittelbar vollständig erzeugt; logische Snapshotversion zwei und Fachversion eins bleiben eigene Dimensionen. `LocalCheckpointV2` akzeptiert ausschließlich physischen Stand fünf. Historische Abnahmebelege stehen in Git; sie sind keine aktuelle Kompatibilitätsanforderung.
- Prüfung: Native Rust-Assertions und gemeinsame Konformität gegen tatsächliche Zielpersistenz, aktuelle Sprach-/Browserbindings, negative Generatordrift und Architekturgrenzen. Alte Treiber, Fallbacks und Kompatibilitätszweige dürfen nach Abschluss nicht verbleiben. Geräte-/GUI-Nachweise weiterhin separat belegen.

## ADR-061 — Begrenzte Tabdelegation an einen tatsächlichen OPFS-Writer

- Datum: 10. Oktober 2026
- Status: Technische Konkretisierung der freigegebenen Rust-/Worker-/Einwriterarchitektur, implementierter Abschnitt; vollständige #109-/#153-Abnahme offen.
- Kontext: Ein dauerhaft gehaltener Web Lock schützt die tatsächliche SQL-/OPFS-Verbindung. Ohne Delegation wartet ein zweiter Tab bis zum Close und kann den vorhandenen P5-Mehrtabablauf nicht bedienen. OPFS-SAHPool bleibt im Dedicated Worker, kein neuer DAL/VFS/Backendselektor.
- Entscheidung: Ein Besitzer hält genau einen tatsächlichen Dedicated Worker unter dem bestehenden globalen Web Lock. Gleichprofilige Tabs delegieren ausschließlich begrenzte typisierte RPCs über BroadcastChannel an diesen Besitzer. Andere Profile bleiben durch ihre getrennten Kanäle und den Workerprofilguard getrennt. Keine zweite DBimplementierung oder JS-Finanz-/Commitlogik.
- Privatheit: Routing enthält Version/Profile/Client/Target/Korrelation und öffentliche kurzlebige Schlüssel. RPC-Nutzdaten einschließlich Finanzwerte/Runtime-Schlüssel werden mit vorhandenen libsodium-Sealed-Box-Primitiven pro Empfänger geschützt; Routingkontext wird innerhalb des geschützten Payloads nochmals geprüft. Dies ist lokale IPC innerhalb derselben vertrauenswürdigen Apporigin, kein neuer Server-/Sync-/E2EEvertrag oder Schutz vor manipuliertem gleichoriginigem Clientcode. Keine eigenen Kryptoprimitive. Kurzlebige geheime IPC-Schlüssel werden beim Close gelöscht.
- Ressourcen/Sitzungen: Höchstens 64 ausstehende RPCs je Client/Owner, 64 bekannte Peers, 16 native Rust-Sitzungen. Sitzungen/Historie/Finanzschlüssel clientgebunden auf derselben SQL-Verbindung; Peerclose entfernt nur dessen Sitzung. SQLwriter und Runtime-/Receipt-/Journalimplementierung bleiben gemeinsam.
- Fehler/Wechsel: Kein automatisches Wiederholen finanzieller Requests. Ausstehende Peerantworten bei Besitzerverlust/-wechsel bleiben unknown; neue Führung öffnet ausschließlich tatsächliche persistierte Daten. Replay/Receiptlookup verwenden ursprüngliche Identität. Close/Pagenavigation gibt Worker/Handles und danach Web Lock frei.
- Grenzen: Lokale Same-Origin-Clients bleiben gemäß vorhandener Clientvertrauensannahme vertrauenswürdig. Hartcrash-/Suspendierungs-/fehlende API-/physische iOS-/gesamte Recoverymatrix getrennt nachweisen; gute Einzelprüfungen sind keine vollständige Abnahme. #153/#109/#114/#146.
