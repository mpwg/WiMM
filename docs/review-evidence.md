# Belegindex und Architekturreviewabnahme

Stand: 9. Oktober 2026. Review-Ausgangsstand `84d730cc6e10d70cf6ac6ff9bc28c4a9c4376e92`. Historische Quellen bleiben im Gitverlauf und den damaligen Issues erhalten. Die folgenden Tests wurden in früheren Aufträgen ausgeführt, nicht während dieses Architekturreviews erneut. Sie beweisen keine neue Rust-Anwendungs-/DAL-/Serverumstellung.

## Aktueller Bestandsstand

- K01–K04/#92–#95 geschlossen; produktive TypeScript-Engine/Controller noch aktiv.
- #82/#83 gesicherte Bestandsindexmigration geschlossen; #104 Testnavigation geschlossen.
- #84: vier echte Browserpersistenzstatusfälle und 23 Anwendungstests im gesicherten Haltepunkt; realer Quota-Writefehler fehlt. Exportport vorhanden, Downloadpräferenz offen. Ausgangscommit 84d730c.
- #113: 100.000-CAMT-Vorschau überschritt in einem CI-Lauf 15.000 ms; Ursache/Behebung/Abnahme offen. Späteres CI-Grün ersetzt keinen Nachweis.
- #77/#78/#79/#85/#86 und Gesamtabnahmen #87/#57/#71 bleiben offen; #41/#90 Linux und native/Zoom/Screenreader/iOS-Einzelbelege separat.

## Historische Quellen nach Bereinigung

Überholte Konzept-/Teilplan-/Übergabedateien sind aus der aktiven Dokumentation entfernt. Noch gültige Anforderungen stehen im Abnahmekatalog und aktuellen Verträgen, Fortschritt in Issues. Die Links zeigen den unveränderlichen Stand vor Bereinigung; alte Weiterarbeitsaufträge sind nicht aktiv.

| Frühere Quelle | Unveränderlicher Beleg |
| --- | --- |
| `docs/core-and-sql-portability.md` | [Gitstand](https://github.com/mpwg/WiMM/blob/84d730cc6e10d70cf6ac6ff9bc28c4a9c4376e92/docs/core-and-sql-portability.md) |
| `docs/handoffs/audit-2026-10-07.md` | [Gitstand](https://github.com/mpwg/WiMM/blob/84d730cc6e10d70cf6ac6ff9bc28c4a9c4376e92/docs/handoffs/audit-2026-10-07.md) |
| `docs/handoffs/b01.md` | [Gitstand](https://github.com/mpwg/WiMM/blob/84d730cc6e10d70cf6ac6ff9bc28c4a9c4376e92/docs/handoffs/b01.md) |
| `docs/handoffs/issues-2026-10-08-rechnerwechsel.md` | [Gitstand](https://github.com/mpwg/WiMM/blob/84d730cc6e10d70cf6ac6ff9bc28c4a9c4376e92/docs/handoffs/issues-2026-10-08-rechnerwechsel.md) |
| `docs/handoffs/issues-2026-10-09-haltepunkt.md` | [Gitstand](https://github.com/mpwg/WiMM/blob/84d730cc6e10d70cf6ac6ff9bc28c4a9c4376e92/docs/handoffs/issues-2026-10-09-haltepunkt.md) |
| `docs/handoffs/k01-2026-10-08.md` | [Gitstand](https://github.com/mpwg/WiMM/blob/84d730cc6e10d70cf6ac6ff9bc28c4a9c4376e92/docs/handoffs/k01-2026-10-08.md) |
| `docs/handoffs/k02-2026-10-08.md` | [Gitstand](https://github.com/mpwg/WiMM/blob/84d730cc6e10d70cf6ac6ff9bc28c4a9c4376e92/docs/handoffs/k02-2026-10-08.md) |
| `docs/handoffs/k03-2026-10-08.md` | [Gitstand](https://github.com/mpwg/WiMM/blob/84d730cc6e10d70cf6ac6ff9bc28c4a9c4376e92/docs/handoffs/k03-2026-10-08.md) |
| `docs/handoffs/k04-2026-10-08.md` | [Gitstand](https://github.com/mpwg/WiMM/blob/84d730cc6e10d70cf6ac6ff9bc28c4a9c4376e92/docs/handoffs/k04-2026-10-08.md) |
| `docs/handoffs/migration-2026-10-08.md` | [Gitstand](https://github.com/mpwg/WiMM/blob/84d730cc6e10d70cf6ac6ff9bc28c4a9c4376e92/docs/handoffs/migration-2026-10-08.md) |
| `docs/handoffs/migration-2026-10-09.md` | [Gitstand](https://github.com/mpwg/WiMM/blob/84d730cc6e10d70cf6ac6ff9bc28c4a9c4376e92/docs/handoffs/migration-2026-10-09.md) |
| `docs/handoffs/p1-p3-review-2026-10-08.md` | [Gitstand](https://github.com/mpwg/WiMM/blob/84d730cc6e10d70cf6ac6ff9bc28c4a9c4376e92/docs/handoffs/p1-p3-review-2026-10-08.md) |
| `docs/handoffs/p4-1-1.md` | [Gitstand](https://github.com/mpwg/WiMM/blob/84d730cc6e10d70cf6ac6ff9bc28c4a9c4376e92/docs/handoffs/p4-1-1.md) |
| `docs/handoffs/p4-1-2.md` | [Gitstand](https://github.com/mpwg/WiMM/blob/84d730cc6e10d70cf6ac6ff9bc28c4a9c4376e92/docs/handoffs/p4-1-2.md) |
| `docs/handoffs/p4-1-3.md` | [Gitstand](https://github.com/mpwg/WiMM/blob/84d730cc6e10d70cf6ac6ff9bc28c4a9c4376e92/docs/handoffs/p4-1-3.md) |
| `docs/handoffs/p4-1-4.md` | [Gitstand](https://github.com/mpwg/WiMM/blob/84d730cc6e10d70cf6ac6ff9bc28c4a9c4376e92/docs/handoffs/p4-1-4.md) |
| `docs/handoffs/p4-1-5.md` | [Gitstand](https://github.com/mpwg/WiMM/blob/84d730cc6e10d70cf6ac6ff9bc28c4a9c4376e92/docs/handoffs/p4-1-5.md) |
| `docs/handoffs/p4-1-6.md` | [Gitstand](https://github.com/mpwg/WiMM/blob/84d730cc6e10d70cf6ac6ff9bc28c4a9c4376e92/docs/handoffs/p4-1-6.md) |
| `docs/handoffs/p4-1-7.md` | [Gitstand](https://github.com/mpwg/WiMM/blob/84d730cc6e10d70cf6ac6ff9bc28c4a9c4376e92/docs/handoffs/p4-1-7.md) |
| `docs/handoffs/p4-1-8.md` | [Gitstand](https://github.com/mpwg/WiMM/blob/84d730cc6e10d70cf6ac6ff9bc28c4a9c4376e92/docs/handoffs/p4-1-8.md) |
| `docs/handoffs/p4-1.md` | [Gitstand](https://github.com/mpwg/WiMM/blob/84d730cc6e10d70cf6ac6ff9bc28c4a9c4376e92/docs/handoffs/p4-1.md) |
| `docs/handoffs/p4-2-1.md` | [Gitstand](https://github.com/mpwg/WiMM/blob/84d730cc6e10d70cf6ac6ff9bc28c4a9c4376e92/docs/handoffs/p4-2-1.md) |
| `docs/handoffs/p4-2-2.md` | [Gitstand](https://github.com/mpwg/WiMM/blob/84d730cc6e10d70cf6ac6ff9bc28c4a9c4376e92/docs/handoffs/p4-2-2.md) |
| `docs/handoffs/p4-2-3.md` | [Gitstand](https://github.com/mpwg/WiMM/blob/84d730cc6e10d70cf6ac6ff9bc28c4a9c4376e92/docs/handoffs/p4-2-3.md) |
| `docs/handoffs/p4-2-4.md` | [Gitstand](https://github.com/mpwg/WiMM/blob/84d730cc6e10d70cf6ac6ff9bc28c4a9c4376e92/docs/handoffs/p4-2-4.md) |
| `docs/handoffs/p4-2-5.md` | [Gitstand](https://github.com/mpwg/WiMM/blob/84d730cc6e10d70cf6ac6ff9bc28c4a9c4376e92/docs/handoffs/p4-2-5.md) |
| `docs/handoffs/p4-2-6.md` | [Gitstand](https://github.com/mpwg/WiMM/blob/84d730cc6e10d70cf6ac6ff9bc28c4a9c4376e92/docs/handoffs/p4-2-6.md) |
| `docs/handoffs/p4-2-7.md` | [Gitstand](https://github.com/mpwg/WiMM/blob/84d730cc6e10d70cf6ac6ff9bc28c4a9c4376e92/docs/handoffs/p4-2-7.md) |
| `docs/handoffs/p4-2.md` | [Gitstand](https://github.com/mpwg/WiMM/blob/84d730cc6e10d70cf6ac6ff9bc28c4a9c4376e92/docs/handoffs/p4-2.md) |
| `docs/handoffs/p4-3-1.md` | [Gitstand](https://github.com/mpwg/WiMM/blob/84d730cc6e10d70cf6ac6ff9bc28c4a9c4376e92/docs/handoffs/p4-3-1.md) |
| `docs/handoffs/p4-3.md` | [Gitstand](https://github.com/mpwg/WiMM/blob/84d730cc6e10d70cf6ac6ff9bc28c4a9c4376e92/docs/handoffs/p4-3.md) |
| `docs/handoffs/p4-4.md` | [Gitstand](https://github.com/mpwg/WiMM/blob/84d730cc6e10d70cf6ac6ff9bc28c4a9c4376e92/docs/handoffs/p4-4.md) |
| `docs/handoffs/p4-5.md` | [Gitstand](https://github.com/mpwg/WiMM/blob/84d730cc6e10d70cf6ac6ff9bc28c4a9c4376e92/docs/handoffs/p4-5.md) |
| `docs/handoffs/p4-6.md` | [Gitstand](https://github.com/mpwg/WiMM/blob/84d730cc6e10d70cf6ac6ff9bc28c4a9c4376e92/docs/handoffs/p4-6.md) |
| `docs/handoffs/p4-planung.md` | [Gitstand](https://github.com/mpwg/WiMM/blob/84d730cc6e10d70cf6ac6ff9bc28c4a9c4376e92/docs/handoffs/p4-planung.md) |
| `docs/handoffs/p4-review-2026-10-08.md` | [Gitstand](https://github.com/mpwg/WiMM/blob/84d730cc6e10d70cf6ac6ff9bc28c4a9c4376e92/docs/handoffs/p4-review-2026-10-08.md) |
| `docs/handoffs/p5-1.md` | [Gitstand](https://github.com/mpwg/WiMM/blob/84d730cc6e10d70cf6ac6ff9bc28c4a9c4376e92/docs/handoffs/p5-1.md) |
| `docs/handoffs/p5-native.md` | [Gitstand](https://github.com/mpwg/WiMM/blob/84d730cc6e10d70cf6ac6ff9bc28c4a9c4376e92/docs/handoffs/p5-native.md) |
| `docs/handoffs/p5-review-2026-10-08.md` | [Gitstand](https://github.com/mpwg/WiMM/blob/84d730cc6e10d70cf6ac6ff9bc28c4a9c4376e92/docs/handoffs/p5-review-2026-10-08.md) |
| `docs/handoffs/p5.md` | [Gitstand](https://github.com/mpwg/WiMM/blob/84d730cc6e10d70cf6ac6ff9bc28c4a9c4376e92/docs/handoffs/p5.md) |
| `docs/handoffs/storage-2026-10-08-fortsetzung.md` | [Gitstand](https://github.com/mpwg/WiMM/blob/84d730cc6e10d70cf6ac6ff9bc28c4a9c4376e92/docs/handoffs/storage-2026-10-08-fortsetzung.md) |
| `docs/handoffs/storage-index-migration-2026-10-09.md` | [Gitstand](https://github.com/mpwg/WiMM/blob/84d730cc6e10d70cf6ac6ff9bc28c4a9c4376e92/docs/handoffs/storage-index-migration-2026-10-09.md) |
| `docs/handoffs/ui-navigation-2026-10-09.md` | [Gitstand](https://github.com/mpwg/WiMM/blob/84d730cc6e10d70cf6ac6ff9bc28c4a9c4376e92/docs/handoffs/ui-navigation-2026-10-09.md) |
| `docs/handoffs/ux.md` | [Gitstand](https://github.com/mpwg/WiMM/blob/84d730cc6e10d70cf6ac6ff9bc28c4a9c4376e92/docs/handoffs/ux.md) |
| `docs/p1-foundation.md` | [Gitstand](https://github.com/mpwg/WiMM/blob/84d730cc6e10d70cf6ac6ff9bc28c4a9c4376e92/docs/p1-foundation.md) |
| `docs/p2-domain.md` | [Gitstand](https://github.com/mpwg/WiMM/blob/84d730cc6e10d70cf6ac6ff9bc28c4a9c4376e92/docs/p2-domain.md) |
| `docs/p3-storage.md` | [Gitstand](https://github.com/mpwg/WiMM/blob/84d730cc6e10d70cf6ac6ff9bc28c4a9c4376e92/docs/p3-storage.md) |
| `docs/p4-ui.md` | [Gitstand](https://github.com/mpwg/WiMM/blob/84d730cc6e10d70cf6ac6ff9bc28c4a9c4376e92/docs/p4-ui.md) |
| `docs/p5-import.md` | [Gitstand](https://github.com/mpwg/WiMM/blob/84d730cc6e10d70cf6ac6ff9bc28c4a9c4376e92/docs/p5-import.md) |
| `docs/rust-dal.md` | [Gitstand](https://github.com/mpwg/WiMM/blob/84d730cc6e10d70cf6ac6ff9bc28c4a9c4376e92/docs/rust-dal.md) |

## Reviewabnahme

Status: laufende Dokumentations-/Issueprüfung. Konkrete Prüfergebnisse und abgeschlossene Kriterien werden nach vollständigem Rücklesen ergänzt. Dieser Abschnitt bewertet ausschließlich Review/Bereinigung, nicht Produktmigration oder Plattformabnahme.
