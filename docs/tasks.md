# Aufgaben und Freigaben

Stand: 10. Oktober 2026. Aktueller Auftrag, Implementierungsfreigaben und zusammengefasster Paketstatus stehen ausschließlich hier. GitHub führt die einzelnen Deltas, Fortschritt, Blockaden und Prüfbelege; Repositorydokumente enthalten Spezifikation und datierte Abnahmesnapshots. Arbeits-/Gitregeln stehen in [AGENTS.md](../AGENTS.md).

## Aktueller Auftrag — Architekturreview und Neuausrichtung

- Status: erledigt (9. Oktober 2026); aktuelle Abschlussbelege in [Reviewabnahme](review-evidence.md#reviewabnahme).
- Freigabe: ausdrücklicher Nutzerauftrag vom 9. Oktober 2026 zur Umsetzung des vollständig zitierten Plans. Er umfasst grundlegende Architekturentscheidungen, detailliertes Konzept, vollständige Dokumentations-/Issuebereinigung sowie eigene Zwischencommits und Veröffentlichung gemäß bestehender Gitfreigabe.
- Ergebnis: [Review](architecture-review.md), verbindliche [Architektur](architecture.md), ADR-050–052 in [Entscheidungen](decisions.md), [Gesamtübersicht #114](https://github.com/mpwg/WiMM/issues/114) und elf eigenständige Verbesserungsissues.
- Verträge: Fach-/Daten-/E2EE-/Transport-/Exportinvarianten erhalten; neue Rust-Anwendung, lokale Operationsreceipts, typisierte Bindings, gemeinsamer DAL und öffentlicher Axum/Tokio-Server als Ziel.
- Abnahme: alle Reviewbereiche bewertet, jede Verbesserung verfolgt, bestehende Kriterien vollständig zugeordnet, überflüssige Issues not_planned mit Nachfolger, veraltete Dokumente entfernt und sämtliche Links/Issuezustände rückgelesen.
- Prüfungen: Dokumentationsvalidator und Tests, Whitespace, Bestandsarchitekturprüfungen, Kriterien-/Issue-/Link-/Abhängigkeitsabgleich. Keine Zielproduktabnahme aus Dokumentationsprüfung ableiten.
- Grenze: neue oder wesentlich geänderte Produktpakete, DAL-Prototypen, Datenmigrationen, neue native Produktoberflächen, P6–P11-Features und Releases sind durch diesen Auftrag nicht implementierungsfreigegeben. Die Annahme des Architekturziels hebt diese Grenze nicht auf.

## Architekturpakete und Übergang

Die bisher getrennten Übersichten #91/#105 sind durch [#114](https://github.com/mpwg/WiMM/issues/114) ersetzt; die Node–Rust-DAL-Bindung #111 durch [Rust-Server #124](https://github.com/mpwg/WiMM/issues/124). **Implementierungsauftrag vom 9. Oktober 2026:** „ok, jetzt überlege dir eine richtige reihenfolge der umsetzungen. und setze die der reihe nach um“. Damit sind die Architekturpakete aus #114 einschließlich AR01–AR11, DAL-Machbarkeit/-Umstellung und weitergeführter K05–K11 zur schrittweisen Umsetzung freigegeben. Nutzerklärung: zunächst ausschließlich Architektur und Bestandskorrekturen. Neue Produktfunktionen P6–P11 und Releases sind nicht beauftragt.

## Laufende Architekturumsetzung

- Status: in Arbeit. [DAL01 #106](https://github.com/mpwg/WiMM/issues/106) und [AR01 #115](https://github.com/mpwg/WiMM/issues/115) sind vollständig abgenommen; alle bestehenden Fachhandler und Gegenbefehle typisiert. [AR01-Abnahmesnapshot](ar01-typing.md). [AR02 #116](https://github.com/mpwg/WiMM/issues/116) ist auf c2f982a vollständig abgenommen und als COMPLETED geschlossen: getrennte private/öffentliche/lokale Rust-/Sprachquellen, vollständige Snapshot-/Port-/V1-/V2-Formen und negative CI-Driftprüfung; [Abschnittssnapshot](ar02-contract-generation.md). Nutzerentscheidung vom 9. Oktober 2026: Variante B, jetzt typisierte UniFFI-/WASM-APIs mit expliziter Bindingversion 2 und V1-Kompatibilitätsadapter umsetzen (ADR-053). Die unabhängigen Defekte #128 und [#129](https://github.com/mpwg/WiMM/issues/129) sind vollständig abgenommen; [Ubuntu-Leistungsnachweis](performance-evidence.md). Bestandskorrektur [#130](https://github.com/mpwg/WiMM/issues/130) ebenfalls vollständig abgenommen und geschlossen. [AR03 #117](https://github.com/mpwg/WiMM/issues/117) ist auf 307e4e5 vollständig abgenommen und als COMPLETED geschlossen: strukturierte sichere Fehlercodes, echte native/Sprach-/WASM-/Tauri-IPC-Grenzen und Sperre bei unklarem Commit; [Abnahmesnapshot](ar03-errors.md). [AR11 #125](https://github.com/mpwg/WiMM/issues/125) ist auf 90dc570 vollständig abgenommen und als COMPLETED geschlossen: katalogisierte transitive Rollen-/Feature-/UI-Grenzen, 41 Negativ-/Positivfälle, echter CLI-Injektionslauf und tatsächlich ausgeführte native Assertions aller registrierten Pflichtcrates; [Abnahmesnapshot](architecture-checks/README.md). [AR08 #122](https://github.com/mpwg/WiMM/issues/122) ist auf 6e96199 vollständig portseitig abgenommen und als COMPLETED geschlossen: eigene sichere Rust-Client-/öffentliche Kryptoquellen, echte native/WASM-/TS-Interop, Legacy/Recovery/JSON-Export und Schlüssel-/Diagnosegrenzen; [Abnahme](../crates/client-crypto/README.md). Bestandsdelta [#132](https://github.com/mpwg/WiMM/issues/132) ebenfalls vollständig abgenommen und als COMPLETED geschlossen; korrigiert unbekannte JSON-Snapshot-Hüllen. [DAL02 #107](https://github.com/mpwg/WiMM/issues/107) ist auf eea3ae8 als Vertragsabschnitt abgenommen und als COMPLETED geschlossen: getrennte neutrale/lokale/öffentliche Rust-Persistenzports und Memoryreferenz mit CAS, strukturierten Commitzuständen, Operationsdimension eins und generierten Datenformen; [Kriterienmatrix](dal02-contracts.md). Keine dauerhafte Datenbankabnahme aus Memory. [AR04 #118](https://github.com/mpwg/WiMM/issues/118) ist auf 290f6e3 vollständig als Commit-/Receipt-/Sicherungsabschnitt abgenommen und als COMPLETED geschlossen: tatsächliche atomare native/OPFS-Receipts, geschützte Originalcheckpoint-Sicherung, Restore-CAS/Rollback und korrekte Commitgewissheit bei Abbruch. Unabhängiger Ubuntu-Job besteht elf Memory-/zehn SQLitefälle und alle 21 tatsächlichen Chromium-/Firefox-/WebKitfälle ohne Skips. [Abnahmesnapshot](ar04-local-receipts.md). #137 vollständige Typdeklarationsgenerierung ebenfalls abgenommen/COMPLETED; #136 Leistungsvariation separat offen, #138 Standalone-WASM-Reportpfad auf 43dccb3 korrigiert und als COMPLETED geschlossen. Keine Gesamt-CI-Freigabe. Nutzerentscheidung vom 10. Oktober 2026: Reihenfolge ändern, Produktumschaltung bereits in [AR05 #119](https://github.com/mpwg/WiMM/issues/119). Neue erste Voraussetzung [#139](https://github.com/mpwg/WiMM/issues/139) ist in Arbeit: auf 480aed9 reine Rust-Commitvorbereitung mit Scopeprüfung, Kernbefehlen und Kernprojektionen; drei native Assertions vergleichen 176 unveränderte Befehlsorakel und alle 22 Arten, WASM-Compile/Architektur/Clippy grün. Persistenzdispatch jetzt mit injiziertem Scope-/Abbruchport, gebundenen Receipts, unknown-Writesperre und ausschließlich lesender Auflösung implementiert; zwölf native Tests einschließlich echter SQLite-Neuöffnung, Antwortverlust, CAS und Rollback grün; alle 22 Befehlsarten und elf Gegenbefehlsorakel durch denselben Rust-Pfad, 71 tatsächliche Speicher-/Neuöffnungsdurchläufe mit vollständigem Datenvergleich. Native Historienkoordination jetzt mit sieben zusätzlichen tatsächlichen SQLiteprüfungen abgenommen (19 native Tests insgesamt): sitzungsgebundene Ziele, ausschließlich bestätigte Stapelbewegung, eigene Revisionsübergänge, Fremdkonflikte und unknown-Receiptauflösung. Dauerhafte Wiederanlaufgrundlage mit verschlüsseltem Original, privatem Journalport und sechs zusätzlichen nativen Prüfungen belegt (25 native Tests insgesamt), einschließlich zweier vollständig getrennter Prozesse mit realem SQLite und vorhandenem libsodium-Port. Produktiver Journaleinbau/CAS/Sicherung/Migration und tatsächliche Laufzeit-/Bindingabnahme bleiben offen; ADR-057. Sie baut Rust-Commit-/Laufzeit-/Ports vor nativer #108 und Browser #109; sichere Bestands-/Update-/Migrationsaktivierung vor produktiver #119-Umschaltung. #119 bleibt bis tatsächlicher Entfernung aller produktiven TS-Commitduplikate offen; #120 erweitert danach weitere Anwendungsabläufe. ADR-056 und aktualisierte nummerierte Folge #114 maßgeblich. Weitere Architektur-/Bestands-/Plattformissues bleiben offen.
- Reihenfolge: zuerst das unabhängige Diesel-/VFS-/DSL-Machbarkeitstor; danach Fachtypisierung → gemeinsame Verträge → Fehler-/Architekturgrenzen → Kryptografie und DAL-Ports → lokale Receipts/Commitdienst → native Persistenz und Rust-Anwendung → Browser-DAL/Ansichten → Export-/Bestandskonformität → sichere Updates/Speicheraktivierung/Produktumschaltung → öffentlicher Rust-Server/SQL-Adapter/Wechsel → Gesamtabnahme. Die konkrete nummerierte Issuefolge und Voraussetzungen stehen ausschließlich in #114.
- Begründung: Ein früher echter Browser-DAL-Nachweis verhindert umfangreiche abhängige Umsetzung auf einer ungeprüften technischen Basis. Er benötigt weder neue Finanzfunktionen noch Serveranmeldung. Bestehende Daten und Produktpfade bleiben bis zur geprüften Umschaltung maßgeblich.
- Abnahme: pro Paket aktuelle Kriterienmatrix, README, direkte Rust-Assertions und tatsächliche verlangte Laufzeiten; Zwischencommits nur abgeschlossener eigener Abschnitte. Kein pauschaler Gesamtabschluss aus Teilbelegen.
- Entscheidungstore: bei fehlender ORM-/VFS-/Bindingeignung vor Ersatzwahl rückfragen. Keine Abschwächung von unsafe-, Finanz-, E2EE-, Migrations- oder Leistungsgrenzen. Fehlende Systeme blockieren nur die betroffenen Nachweise, keine fingierte Abnahme.

Unveränderte frühere Fach-/Speicher-/Abnahmekorrekturen aus dem Auftrag vom 7./8. Oktober bleiben freigegeben, soweit sie dem neuen Ziel nicht widersprechen. Bereits sichere K01–K04-, Schema-/Index- und Fachgrundlagen bleiben erhalten. Keine zusätzlichen Alt-TS-/Node-Implementierungen bauen, die das bestätigte Ziel unmittelbar ersetzt. Bei widersprüchlichem Umfang rückfragen, vor Ersatztechnologien ebenfalls.

## P1 — Grundlage und Herkunft

Grundlage vorhanden; Gesamtabnahme bleibt wegen [Herkunftsregister #72](https://github.com/mpwg/WiMM/issues/72) und übergreifender [Nachprüfung #87](https://github.com/mpwg/WiMM/issues/87) offen. Manifeste/Lockfiles sind Versionsquelle. Historische P1-Abnahmen sind im [Belegindex](review-evidence.md) verlinkt, aktuelle Kriterien im [Abnahmekatalog](acceptance-catalog.md).

## P2 — Fachkern

TypeScript produktiv, Rust-K04-Grundlage mit tatsächlichen nativen/Sprachkatalogen historisch abgenommen. #73–#76 geschlossen; neue Typisierung/Generierung und produktive Umschaltung bleiben eigene offene Zielaufgaben. Kein vollständiger Abschluss des neuen Rustprodukts aus #95 ableiten. [Fachmodell](domain.md), [Fachverträge](core-contracts.md).

## P3 — Lokaler Speicher und Sicherung

In Arbeit. #80/#81/#82/#83 sind als Bestandsabschnitte geschlossen; #77/#78/#79/#84/#85/#86 und #87 führen verbleibende Kriterien. Gesicherte IndexedDB-/SQLite-V1→V2-Indexmigration ersetzt keine ORM-/Browser-SQLite-Migration. Standalone bleibt ohne Server/Outbox. Aktueller #84-Haltepunkt: reale Persistenzstatusfälle geprüft, tatsächlicher Quota-Writefehler noch offen. Neue Downloadoberfläche benötigt die weiterhin offene Nutzerentscheidung; bestehender P3-Bereichsexport enthält keinen Tresor und ist keine P10-Gesamtsicherung.

## P4 — Oberfläche und Plattformabnahme

Oberfläche implementiert, vollständige Abnahme offen. [Gesamtübersicht #57](https://github.com/mpwg/WiMM/issues/57) mit #49–#56; Linuxstart/-Abhängigkeiten #90/#41. Echte Browser-, Zoom-, Screenreader-, Geräte- und native Plattformbelege bleiben erforderlich. UI-/Plattformfunktionen durch Nutzeraufträge vom 4./5. Oktober freigegeben; Zielanwendungs-/DAL-Umbau bleibt getrennt. [UI](ui.md), [Abnahmekatalog](acceptance-catalog.md), [Tests](testing.md).

## P5 — Import und Automatisierung

P5.1–P5.6 und UX-Neugestaltung durch Nutzerauftrag vom 5. Oktober freigegeben; Kernabläufe weitgehend implementiert, Gesamtabschluss offen. [Gesamtabnahme #71](https://github.com/mpwg/WiMM/issues/71) mit Funktionsdeltas #58–#62 und Abnahmen #63–#70; zusätzlicher CAMT-Leistungsbefund [#113](https://github.com/mpwg/WiMM/issues/113). Fristen/Ressourcen-/Finanzgrenzen nicht zur Abnahme lockern. Etablierte Parser bleiben, neue Rust-Anwendungskoordination wird separat freigegeben. [Formate](formats.md), [Abnahmekatalog](acceptance-catalog.md).

## P6 — Budget, Ziele und Berichte

Spezifiziert, nicht implementierungsfreigegeben. [P6-Spezifikation](p6-budget.md); Geld-/Projektionsregeln ausschließlich im Rust-Fachkern, Anwendungsaktionen in gemeinsamer Rust-Anwendung. Voraussetzung P5 und geprüfte relevante Zielverträge; keine zusätzlichen Features aus Architekturauftrag ableiten.

## P7 — Familienfinanzen lokal

Spezifiziert, nicht implementierungsfreigegeben. [P7-Spezifikation](p7-family.md); lokale Teilnehmer keine Serverkonten, freiwillige private Angaben, Reserve/Refunds/PublicationLink mit verbindlicher Bereichstrennung. Voraussetzung P6 und relevante Zielgrundlage.

## P8 — Öffentlicher Rust-Server und Identitäten

Produktabläufe spezifiziert, nicht implementierungsfreigegeben. [P8-Spezifikation](p8-server.md); K06–K10/AR10 beschreiben die separate technische Basis, keine automatische Auth-/Geräte-/Rotationsfreigabe. Externes OIDC, Sitzung, signierte Roster/Geräte und CiphertextStore; kein Finanzfachkern im Server.

## P9 — Zusammenarbeit und Synchronisierung

Spezifiziert, nicht implementierungsfreigegeben. [P9-Spezifikation](p9-sync.md); Clientzustandsautomaten in Rust-Anwendung, HTTP auf öffentlichem Rust-Server. Bestätigungen, Entwürfe und Konflikte getrennt, Hüllen vor Sendversuch fixieren, Cursor atomar. Voraussetzung relevante P8-Abnahme.

## P10 — Sicherung, Restore und Betrieb

Spezifiziert, nicht implementierungsfreigegeben. [P10-Spezifikation](p10-backup.md); separate Nutzer-/Serverbackups, gesicherter Wiederanlauf und clientbestätigte Finanzepochen. Lokale Migrationsbackups bleiben bestehender P3-/DAL-Vertrag, keine vorgezogene P10-Gesamtabnahme.

## P11 — Veröffentlichung

Spezifiziert, nicht implementierungsfreigegeben. [P11-Spezifikation](p11-release.md); AGPL-Quellcode, Fremdhinweise, native Plattformen, Signierung und unabhängige Prüfung. Fehlende Secrets blockieren nur betroffene Distribution. Kein Release-/Deploymentauftrag durch Paketabschluss.

## VS-Code-Erweiterungen — Zusatzauftrag vom 9. Oktober 2026

- Auftrag: WiMM-Empfehlungen ergänzen, unnötige Erweiterungen nur im Workspace deaktivieren; keine globale Deinstallation und kein neues Profil.
- Status: Konfiguration und Workspace-Deaktivierungen umgesetzt; vollständige manuelle Editorabnahme noch offen.
- Ergebnis: Rust Analyzer erfasst Root-Workspace und separaten Tauri-Crate; Even Better TOML installiert; Erweiterungsempfehlungen und unerwünschte Empfehlungen sowie [Einrichtung](development.md#vs-code-arbeitsbereich) ergänzt. Der im Editor reproduzierte doppelte Clippy-Parameter `--all-targets` wird durch `rust-analyzer.check.allTargets` ersetzt; `--locked`/`-D warnings` bleiben erhalten. Bestehende Playwright-Empfehlung und fremde Rust-Änderungen bleiben erhalten.
- Prüfungen: 17 Empfehlungen und 13 unerwünschte Empfehlungen ohne Duplikate/Überschneidungen; alle 39 Erweiterungen einschließlich der 38 vorher vorhandenen installiert. Nach Nutzer-Deaktivierung und erneutem Laden gespeicherten WiMM-Status rückgelesen: genau die 13 vorgesehenen Erweiterungen deaktiviert, keine global deaktiviert. Editorprotokolle bestätigen beide Rust-Manifeste sowie den Start von Oxc 1.86.0 und Vitest 5.0.3 mit Projektkonfiguration. JSON-/Konfigurationsprüfung einschließlich des installierten Rust-Analyzer-Schemas, `pnpm check:docs`, `pnpm test:docs` und Whitespaceprüfung bestanden.
- Offene Abnahme: tatsächliche Rust-/TypeScript-/Oxc-Diagnosen nach Clippy-Korrektur, Vitest-/Playwright-Testentdeckung, TOML und Mermaid im Editor noch nicht vollständig bestätigt. Erweiterungsstart ist kein vollständiger Funktionsnachweis.

## Fortsetzung und Abschlussregeln

Der frühere Haltepunkt ist durch den jetzigen ausdrücklichen Architektur-Implementierungsauftrag überwunden. Die neuen Pakete werden nach #114 geordnet bearbeitet. Fehlende Windows-/Linux-/Intel-Mac-/physische iOS-Nachweise bleiben offen; verfügbare unabhängige Arbeit wird innerhalb des freigegebenen Umfangs fortgesetzt.

Jede Abnahme nennt Commit, Befehl, synthetische Daten, Plattform und tatsächlichen Client/Adapter. Ein offenes/nicht prüfbares Kriterium verhindert Gesamtabschluss. Native Rust-Assertions sind Pflicht. READMEs/Spezifikation und Issuebelege gleichzeitig aktualisieren; keine zweite Deltaliste im Repository pflegen. [Belegindex](review-evidence.md).
