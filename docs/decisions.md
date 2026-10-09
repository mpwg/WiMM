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

## ADR-053 — Typisierte UniFFI-/WASM-Bindings mit V1-Kompatibilität

- Datum: 9. Oktober 2026. Status: angenommen; vollständige Umsetzung/Abnahme in AR02 noch offen.
- Herkunft: ausdrückliche Nutzerwahl „B – Typisierte APIs jetzt einführen“ im Fortsetzungsauftrag zu #116.
- Problem: Stringbasierte APIs lassen Sprachmodelle und tatsächliche Grenzformen auseinanderlaufen. Die Entscheidung zwischen Beibehaltung der JSON-ABI und neuer typisierter API war offen.
- Entscheidung: Jetzt typisierte UniFFI-/WASM-Einstiege aus Rust mit expliziter Bindingversion 2 und V1-Kompatibilitätsadapter einführen. Etablierte, gesperrte Generatoren verwenden; Fachkern bleibt plattformfrei, eigener Code unsafe-frei. Sprachsignaturen und maschinenlesbare Schemas reproduzierbar erzeugen und negativ auf Drift prüfen.
- Alternative: V1 als einzige ABI behalten und nur Sprachdatenmodelle generieren (Variante A). Der Nutzer hat Variante B gewählt.
- Folgen: Records/Enums, Versions-/Ergebnis-/Fehlerformen und sämtliche vorhandenen Aktionen müssen nachgewiesen werden. Öffentliche, lokale und private Module bleiben getrennt; öffentliche Module erhalten keine privaten Fachabhängigkeiten.
- Betroffene Verträge/Pakete: [Fach-/Anwendungsverträge](core-contracts.md), [AR02 #116](https://github.com/mpwg/WiMM/issues/116), Bindings und Vertragsgenerierung.
- Migration und Kompatibilität: Kein globales Ersetzen von V1 durch V2 und keine Datenmigration aus diesem Bindingwechsel. Bestehende JSON-Einstiege bleiben bis nachgewiesener Parität erhalten. Finanzschema eins und vorhandene Crypto-/Transport-/Storage-/Exportversionen bleiben unabhängig.
- Prüfung: Direkte native Rust-Assertions, identische positive/negative Fälle in tatsächlichen Swift-/Kotlin-/WASM-/Browserläufen, versionierte generierte Dateien und negative CI-Driftprüfung. Generierung allein ist keine Sprachlaufzeitabnahme.
