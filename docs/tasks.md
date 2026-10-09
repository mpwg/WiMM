# Aufgaben und Freigaben

Stand: 9. Oktober 2026. Aktueller Auftrag, Implementierungsfreigaben und zusammengefasster Paketstatus stehen ausschließlich hier. GitHub führt die einzelnen Deltas, Fortschritt, Blockaden und Prüfbelege; Repositorydokumente enthalten Spezifikation und datierte Abnahmesnapshots. Arbeits-/Gitregeln stehen in [AGENTS.md](../AGENTS.md).

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

- Status: in Arbeit. [DAL01 #106](https://github.com/mpwg/WiMM/issues/106) ist mit vollständigem eigenem CI-Job abgenommen. [AR01 #115](https://github.com/mpwg/WiMM/issues/115) enthält geschützte Skalartypen, vollständige V1-Formmodelle, typisierte Basisprojektionen/Cacheprüfung und historische Bestandsvalidierung; verbleibende Befehlsabläufe, Gegenbefehle und Mutationsreferenzprüfungen werden noch umgestellt. [Abnahmesnapshot](ar01-typing.md). Alle weiteren Architekturpakete bleiben offen.
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

## Fortsetzung und Abschlussregeln

Der frühere Haltepunkt ist durch den jetzigen ausdrücklichen Architektur-Implementierungsauftrag überwunden. Die neuen Pakete werden nach #114 geordnet bearbeitet. Fehlende Windows-/Linux-/Intel-Mac-/physische iOS-Nachweise bleiben offen; verfügbare unabhängige Arbeit wird innerhalb des freigegebenen Umfangs fortgesetzt.

Jede Abnahme nennt Commit, Befehl, synthetische Daten, Plattform und tatsächlichen Client/Adapter. Ein offenes/nicht prüfbares Kriterium verhindert Gesamtabschluss. Native Rust-Assertions sind Pflicht. READMEs/Spezifikation und Issuebelege gleichzeitig aktualisieren; keine zweite Deltaliste im Repository pflegen. [Belegindex](review-evidence.md).
