# Übergabe der Issuebehebung zum Rechnerwechsel

Stand: 8. Oktober 2026. Die Arbeit wurde auf ausdrücklichen Nutzerwunsch an einem geprüften Zwischenstand angehalten. Dieser Text ist ein Abnahmesnapshot; GitHub führt den aktuellen Bearbeitungsstand.

## Ergebnis und Auftrag

- Nutzerauftrag: offene GitHub-Issues systematisch beheben, erfüllte Issues schließen; direkte Arbeit auf `main`, eigene Zwischencommits und Pushes sind erlaubt. GitHub-Connector wurde für die Nachweisführung verwendet.
- In diesem Auftrag geschlossen: [#73](https://github.com/mpwg/WiMM/issues/73), [#74](https://github.com/mpwg/WiMM/issues/74), [#76](https://github.com/mpwg/WiMM/issues/76).
- Die Fachkorrektur für [#75](https://github.com/mpwg/WiMM/issues/75) besitzt echte IndexedDB-Belege; der gemeinsame SQLite-Mergebeleg fehlt noch.
- Die Grundlagen für [#77](https://github.com/mpwg/WiMM/issues/77), [#78](https://github.com/mpwg/WiMM/issues/78), [#79](https://github.com/mpwg/WiMM/issues/79) und [#80](https://github.com/mpwg/WiMM/issues/80) sind implementiert. Diese Issues bleiben wegen ihrer ausstehenden Integrationskriterien offen. Die Voraussetzungen und verbleibenden Kriterien stehen im jeweiligen Issue und in [Gesamtabnahme #87](https://github.com/mpwg/WiMM/issues/87).
- P1/P2/P3 sowie P4/P5 sind weiterhin in Arbeit; keine vollständige Paket- oder native Plattformabnahme behauptet. P6–P11 wurden nicht begonnen.

## Commits und Vertragsstand

| Commit | Ergebnis |
| --- | --- |
| `149ea1f` | gespeicherten Abgleichstatus vor Buchungs-/Transferänderung prüfen; #73 |
| `b47465a` | Systemkategorie vor Umwidmung, Archivierung und Tombstone schützen; #74 |
| `6d9c463` | vollständige Quellreferenzen beim Empfänger-Merge prüfen und Finanz-CAS lesen; #75 |
| `40c044a` | neue Finanzreferenzen auf Tombstones abweisen; echte IndexedDB-Belege; #76 |
| `917d350` | vollständiger DesktopStorageAdapter, native Kommandos und ACL; #77 |
| `04672e7` | dauerhafte lokale Epoche, verschlüsselte Standalone-Exporte; #78/ADR-040 |
| `46a0230` | atomarer Snapshotlesestand und konkurrierende Exportbelege; #79 |
| `cc7b90f` | Snapshotform, Kontext, Fachbestand und Cachewerte vor Ersatz prüfen; #80/ADR-041 |

Letzter geprüfter Laufzeitstand: `cc7b90fb61b0ced3e5d0d8ca04cbfaf9d65972b9`. Der anschließende Dokumentationscommit enthält diese Übergabe und den angehaltenen Auftrag in tasks.md. Alle eigenen Änderungen werden auf `main` veröffentlicht.

Relevante Verträge: [ADR-040/ADR-041](../decisions.md), [Speicherports](../architecture.md#speicherports), [Datenmodell](../data-model.md), [P2](../p2-domain.md), [P3](../p3-storage.md). Es wurden keine neuen Abhängigkeiten oder Kryptoprimitiven eingeführt.

## Prüfbelege

- Aktive Arbeitskopie: Linux x86_64, Node 26.10.0, Vitest 5.0.3, Chromium 153.0.8010.12; Repositorypin pnpm 12.8.1. Die Umgebungsdaten am nächsten PC neu erfassen.
- Abschließende gezielte Unitserie: **123 Tests bestanden**, 18 Suites. Enthält contracts/domain/storage sowie tests/storage/local-snapshot.test.ts mit tatsächlicher libsodium-Verschlüsselung. Das IndexedDB-Modell ist ausdrücklich fake-indexeddb; es ersetzt keinen Browser- oder SQLite-Beleg.
- Abschließende Browserserie: **22 Fälle bestanden** in tests/workspace/domain-references.spec.ts. Elf gemeinsame IndexedDB-Szenarien werden in beiden vorhandenen Browserprojekten ausgeführt; diese Testseite verwendet denselben echten Chromium-/IndexedDB-Adapter, keine native SQLite-Komposition. Enthält verschlüsselte leere/befüllte Exporte, falschen Schlüssel ohne Write, Versionen-/Metadaten-/Cacheablehnung und 30 konkurrierende vollständige Commit-/Exportphasen.
- Rust: **zwölf Tests bestanden**, einschließlich echter SQLite-Dateineustarts, Syncseiten-/Snapshotrollback, Profil-/Bereichstrennung und 30 synchronisierter Interleavings mit zwei WAL-Verbindungen. Clippy mit `-D warnings` und Rustformat bestanden.
- Typecheck, gezielter Oxlint mit Warnungen als Fehler, Paketgraph, Dokumentationsvalidator und Whitespaceprüfung bestanden.
- Früherer Beleg auf `40c044a`: alle 28 P4.4-IndexedDB-Integrationen einschließlich Abgleich/Transfer/CAS/Rollback/Undo/Redo sowie separater GUI-Empfänger-Merge mit vollständigem Chromium-Prozessneustart bestanden.
- Die neue Schutzportserie ist über `pnpm test:storage` in die reguläre Prüfkette aufgenommen. Für Browser-/pnpm-Läufe `NO_COLOR` entfernen, wenn `FORCE_COLOR` geerbt ist; die Projektregel warnings-as-errors aktiv halten.

## Einschränkungen und Fortsetzungspunkt

Die vollständige gemeinsame Konformität gegen den **echten DesktopStorageAdapter mit SQLite und dem tatsächlichen SnapshotProtector** ist noch nicht geliefert. Insbesondere die nativen verschlüsselten Roundtrips schließen #75/#77/#78/#80 noch nicht ab. Weitere P5-/Originalentwurf-Roundtrips im vollständigen Snapshotvertrag prüfen; das Datum einer importierten Dauerzahlung darf von ihrer Fälligkeit abweichen, und ein Importfingerprint behält sein ursprüngliches Quellkonto nach späterem Buchungskontowechsel. Beide Fälle besitzen bereits Fachregressionen.

`rebuildProjections` löscht weiterhin nur Cachezeilen: [#81](https://github.com/mpwg/WiMM/issues/81) muss den tatsächlichen Fachneuaufbau liefern. Die Vor-Migrationssicherung ist in [#82](https://github.com/mpwg/WiMM/issues/82) umzusetzen und muss die neue atomare Exportbasis verwenden; danach die letzte Zelle von #79 abschließen. Die weiteren Speicher-/Index-/Persistenz-/Referenzkriterien und die gemeinsame Abschlussprüfung stehen in #83–#86. Der native Speicher liegt jetzt in apps/desktop/src-tauri/src/storage.rs; main.rs registriert ausschließlich den begrenzten Kommandokatalog.

Kein kompletter check:ci-Lauf oder neuer Produktions-/Tauri-Releasebuild für diesen letzten Abschnitt ausgeführt. Native GUI, Wayland, Screenreader, Disk-full und physische Geräte wurden durch diese Tests nicht abgenommen. [#90](https://github.com/mpwg/WiMM/issues/90) fordert weiterhin echtes Wayland; [#41](https://github.com/mpwg/WiMM/issues/41) bleibt bis zur nativen Linuxabnahme offen. Weitere P4/P5-Arbeit über [#57](https://github.com/mpwg/WiMM/issues/57) und [#71](https://github.com/mpwg/WiMM/issues/71) fortsetzen.

## Weiterarbeits-Prompt

```text
Setze die systematische Behebung der offenen GitHub-Issues von mpwg/WiMM fort. Die Pause zum Rechnerwechsel ist damit beendet. Du darfst direkt auf main arbeiten, eigene abgeschlossene Abschnitte committen und pushen. Schließe jedes Issue erst nach erfüllten Abnahmekriterien und aktuellen Belegen. Nutze den GitHub-Connector, wo sinnvoll.

Lies zuerst AGENTS.md, die dort vorgeschriebenen Dokumente und docs/handoffs/issues-2026-10-08-rechnerwechsel.md. Prüfe die aktive Arbeitskopie, den Gitstatus und den aktuellen Remote-/Issue-Stand. Arbeite ausschließlich dort und bewahre vorhandene fremde Änderungen. Letzter geprüfter Laufzeitstand der Übergabe ist cc7b90f; der anschließende Dokumentationscommit enthält den Weiterarbeits-Prompt.

Fortsetzungspunkt ist #80: die gemeinsame Snapshotprüfung ist eingebunden, ihre vollständige native und P5-/Entwurf-Kompatibilität muss noch abgenommen werden. Führe danach die offenen Speichervoraussetzungen in der Reihenfolge von #87 weiter: tatsächlicher Projektionsneuaufbau #81, gesicherte vorwärtsgerichtete Migration #82, Indizes/Persistenz/Referenzprüfung #83/#84/#86 und vollständige gemeinsame Konformität #85 gegen echte IndexedDB und SQLite. Mit diesen Belegen die Kriterien von #75/#77/#78/#79/#80 erneut prüfen und erfüllte Issues schließen; nicht bloß den vorhandenen Code als Abnahme werten.

Nach der Speicherbasis die übrigen offenen Issues einschließlich #72 und der P4-/P5-Übersichten systematisch weiterbearbeiten. Echte Plattform-, Screenreader- und Geräteanforderungen nur mit tatsächlich verfügbarem Zielsystem abnehmen. Neue Produktpakete P6–P11 nicht aus Issuebeschreibungen ableiten. Fortschritt und Blockaden direkt im jeweiligen GitHub-Issue führen; Repositorydokumente als datierte Abnahmesnapshots und zusammengefassten Paketstatus pflegen.
```
