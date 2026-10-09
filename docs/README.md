# Dokumentationsindex

## Status und Auftrag

Die Issuebehebung wird seit dem Fortsetzungsauftrag vom 8. Oktober 2026 wieder ausgeführt. [Historische Rechnerwechselübergabe mit Weiterarbeits-Prompt](handoffs/issues-2026-10-08-rechnerwechsel.md); aktuelle Einzelbelege stehen in GitHub, [aktuelle Speicherabnahme](handoffs/storage-2026-10-08-fortsetzung.md). Die vollständigen Paketabnahmen bleiben offen.

D0 ist die Spezifikationsübergabe, D1 ergänzt verpflichtende E2EE und Agenten-/GitHub-/Editorhilfen. D2 ergänzt Einstieg, Referenzhaushalt und P1-Teilaufgaben einschließlich Hook-Konzept. D3 legt externe Serveridentität und eigenständige Apps fest. D4 führt die Arbeitsregeln ohne VS-Code-DevContainer in der aktiven Arbeitskopie fort. D5 ergänzt schrittweise Teilaufgaben für P2–P11. P1 bis P3 sind nach der [aktuellen Nachprüfung](handoffs/p1-p3-review-2026-10-08.md) erneut in Arbeit; [Gesamtabnahme #87](https://github.com/mpwg/WiMM/issues/87) führt ihre 15 Einzelissues. P4 und P5 sind in Arbeit; P6 bis P11 bleiben offen. P5.1–P5.6 sind durch Nutzerauftrag vom 5. Oktober 2026 freigegeben und weitgehend implementiert; die [P5-Nachprüfung vom 8. Oktober](handoffs/p5-review-2026-10-08.md) belegt fünf Funktions- und acht Abnahmedeltas. [Gesamtabnahme #71](https://github.com/mpwg/WiMM/issues/71) führt den Bearbeitungsstand; P5.2–P5.4 sind erneut in Arbeit. Die [historische P5-Kriterienmatrix](handoffs/p5.md) bleibt erhalten. Windows-/Linux-Läufe folgen später; P4-Abnahmelücken bleiben offen. Der Lokalbetrieb benötigt keine Benutzerverwaltung; Serveranmeldung ist extern. Finanzschemas und JSON-Beispiele sind Verträge für zukünftigen Code, keine bereits vorhandenen Finanz-APIs.

Für den ersten Überblick: [Einstieg](getting-started.md). Für die schrittweise Umsetzung: [Teilaufgabenübersicht P1–P11](tasks.md#teilaufgaben-und-bearbeitungsfolge), mit laufender [P4.6-Gesamtabnahme](handoffs/p4-6.md), als verbleibende native Abnahme [P4.5.7](p4-ui.md#p457--native-systemintegration-je-zielsystem-prüfen). Die erneut geprüften [P1-Teilaufgaben](p1-foundation.md), [P2-Teilaufgaben](p2-domain.md), [P3-Teilaufgaben](p3-storage.md), [P4.1](p4-ui.md#p41--composition-root-und-lokaler-einstieg), [P4.2.1](p4-ui.md#p421--navigation-und-bereichstrennung-prüfen), [P4.2.2](p4-ui.md#p422--übersicht-und-kontostart-prüfen), [P4.2.3](p4-ui.md#p423--kontoarchivierung-mit-referenzen-abnehmen), [P4.2.4](p4-ui.md#p424--kategoriearchivierung-mit-referenzen-abnehmen), [P4.2.5](p4-ui.md#p425--empfänger-merge-mit-buchungsreferenz-abnehmen), [P4.2.6](p4-ui.md#p426--layout-und-farbschema-stabilisieren) [P4.2.7](p4-ui.md#p427--tastaturfokus-für-navigation-und-stammdaten-abnehmen) und [P4.3.1–P4.3.8](handoffs/p4-3.md) sowie [P4.4.1–P4.4.7](handoffs/p4-4.md) und [P4.5.1–P4.5.6](handoffs/p4-5.md) dokumentieren die Grundlage. Der [Referenzhaushalt](reference-household.md) verbindet Fachbeispiele mit dem Buchungs-/Syncablauf; er ist kein importierbarer Snapshot.

Die [UX-Neugestaltung](ux-redesign.md) ist durch ausdrücklichen Nutzerauftrag vom 5. Oktober 2026 für UX-01–UX-06 freigegeben; [aktuelle UX-Abnahme](handoffs/ux.md).

## Architekturziel: Rust und SQL-Portabilität

Das [Konzept für gemeinsamen Rust-Fachkern und austauschbare SQL-Datenbanken](core-and-sql-portability.md) beschreibt den am 8. Oktober 2026 bestätigten Zielzustand für Web und spätere native Oberflächen. Desktop bleibt lokal mit SQLite, PWA mit IndexedDB; der Server erhält künftig SQLite-/PostgreSQL-/MySQL-Adapter. K01–K11 sind seit dem anschließenden ausdrücklichen Nutzerauftrag zu #91 auch zur Implementierung freigegeben; [Auftrag und Status](tasks.md#k--rust-fachkern-und-sql-portabilität).

Die [vollständige K04-Fachmigration](handoffs/k04-2026-10-08.md) ist mit nativen Rust-Assertions und tatsächlichen Sprachbindings abgenommen; produktive Umschaltung bleibt K05. Die [K02-Anwendung samt Profil-/Composition-Endabnahme](handoffs/k02-2026-10-08.md) ist vollständig geprüft. Die [tatsächliche K03-Sprachbindingabnahme](handoffs/k03-2026-10-08.md) ergänzt die [K01-Abnahme vom 8. Oktober](handoffs/k01-2026-10-08.md) und [plattformfreien K01-Verträge](core-contracts.md) konkretisieren Engine-Bindings, Anwendungsabläufe und getrennte Speicher-/Sicherungs-/Servertransaktionen.

## Architekturvorschlag: gemeinsamer Rust-DAL

Das [Rust-DAL-Konzept](rust-dal.md) ergänzt am 9. Oktober 2026 den Vorschlag einer gemeinsamen ORM-Persistenzbasis mit Diesel als bevorzugtem Kandidaten und künftigem SQLite/WASM in der PWA. [ADR-049](decisions.md#adr-049--gemeinsamer-rust-dal-mit-orm-als-architekturvorschlag) ist vorgeschlagen; [Auftrag und Status](tasks.md#dal--gemeinsamer-rust-dal-konzept-und-issuetracking) erlauben ausschließlich Konzept- und Issueanlage. DAL01–DAL07 einschließlich Machbarkeitsprototypen sind offen, nicht zur Implementierung freigegeben. Die verbindliche Bestandsarchitektur mit IndexedDB in der PWA und die bisherigen K-/P3-Freigaben bleiben erhalten. [Gesamtübersicht #105](https://github.com/mpwg/WiMM/issues/105) führt die sieben DAL-Einzelissues #106–#112.

## Lesereihenfolge

| Schritt | Dokument | Zweck |
| --- | --- | --- |
| 1 | [Arbeitsregeln](../AGENTS.md), [Produkt](product.md) | Auftrag, Zielgruppe, Funktionen, Rollen und Abläufe |
| 2 | [Fachmodell](domain.md) | Begriffe, Geldregeln, Budget und Ausgleich |
| 3 | [Datenmodell](data-model.md) | Entitäten, Beziehungen, Aggregate und Indizes |
| 4 | [Architektur](architecture.md), [Entscheidungen](decisions.md) | Komponenten, Grenzen und verbindliche Defaults |
| 5 | [Synchronisierung](synchronization.md), [API](api.md) | Operationen, Revisionen, Identitäten und Fehler |
| 5a | [Ende-zu-Ende-Verschlüsselung](encryption.md), [Krypto-Testvektoren](crypto-test-vectors.md) | Pflichtschutz, Geräte-/Familienschlüssel, Rotation, Recovery und feste Binding-Vektoren |
| 6 | [Dateiformate](formats.md) | Import, Dubletten und vollständiger Export |
| 7 | [Oberfläche](ui.md), [Sicherheit](security.md) | Plattformbedienung, private Daten und Sitzungen |
| 8 | [Betrieb](operations.md), [Tests](testing.md) | Installation, Sicherung, Migration und Abnahme |
| 9 | [Aufgaben](tasks.md) | Geordnete Arbeitspakete mit Ergebnis und Nachweisen |
| 10 | [Agentenleitfaden](agent-guide.md), [Entwicklung](development.md) | Projektskills, GitHub, VS Code und einheitliche Vorlagen |

## Verbindlichkeit und Fortschritt

Das Konzept wurde mit dem Nutzer abgestimmt. Offene Implementierungsdetails werden in diesem Paket durch explizite Defaults festgelegt. Versionen konkreter Bibliotheken werden erst in P1 aus stabilen kompatiblen Releases gewählt und in Lockfiles festgeschrieben.

Produktanforderungen stehen in `product.md`, Fachinvarianten in `domain.md`, Typen in `data-model.md`, Transport in `api.md` und `synchronization.md`. `decisions.md` begründet diese Festlegungen. Bei Widersprüchen zwischen verbindlichen Quellen den Widerspruch benennen und betroffene Quellen vor abhängiger Implementierung gemeinsam korrigieren; bei unklarer Produktabsicht rückfragen.

## Bewusst spätere Funktionen

Bankabruf, Kinderrollen, Mehrwährung, Wertpapierkurse, Beleg-OCR, Steuerfunktionen, kommerzielles Hosting und iOS-/Android-Store-Apps gehören nicht zur ersten Veröffentlichung. Ende-zu-Ende-Verschlüsselung ist dagegen verpflichtend ab v1. Englische Übersetzungen sind nicht Voraussetzung; Übersetzbarkeit wird technisch vorbereitet.

[Gesicherte #82-Migrationsvorbereitung vom 8. Oktober](handoffs/migration-2026-10-08.md) dokumentiert Koordination und echten Browser-Chiffratspeicher; die vollständige native/Adapter-Migration bleibt offen.

[Nativer #82-Chiffratspeicher vom 9. Oktober](handoffs/migration-2026-10-09.md) ergänzt den tatsächlichen Rust-/SQLite-Prozessneustart und verschlüsselten P5-Roundtrip; die vollständige Adaptermigration bleibt offen.

[Gesicherte Indexmigration und tatsächliche Abfragebasis vom 9. Oktober](handoffs/storage-index-migration-2026-10-09.md) dokumentieren den registrierten V1→V2-Schritt, Originalvergleich, Journal, Prozessneustarts und 50.000-Buchungen-Abfragen für #82/#83.

[Haltepunkt und Wiederaufnahme vom 9. Oktober 2026](handoffs/issues-2026-10-09-haltepunkt.md): Auftrag auf Nutzerwunsch angehalten; #82/#83/#104 geschlossen, geprüfter #84-Teilabschnitt und offene Nachweise dokumentiert.
