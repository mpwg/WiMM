# WhereIsMyMoney

WhereIsMyMoney ist ein geplanter Open-Source-Finanzmanager für Familien. Gemeinsame Haushaltsfinanzen, persönliche Finanzbereiche, Budgetplanung und ein nachvollziehbarer Ausgleich zwischen Erwachsenen stehen im Mittelpunkt.

**Projektstatus: P1 bis P5 in Arbeit.** Die [P1–P3-Nachprüfung vom 8. Oktober 2026](docs/handoffs/p1-p3-review-2026-10-08.md) bestätigt die vorhandenen Grundlagen, weist aber ein Herkunftsregisterdelta, vier Fachkernfehler und zehn Speicherdeltas nach. [Gesamtabnahme #87](https://github.com/mpwg/WiMM/issues/87) führt die 15 Einzelissues; P1, P2 und P3 sind aktuell nicht vollständig umgesetzt und abgenommen. Der lokale Einstieg und P4.2.1 bis P4.2.7 sind einzeln abgenommen. Navigation und Stammdaten sind bei 320, 768, 900 und 1024 CSS-Pixeln geprüft; „System / Hell / Dunkel“ ist lokal wählbar. Bereichswechsel, Stammdaten und der Merge-Dialog sind per Tastatur bedienbar. P4.3 und P4.4 sind ebenfalls vollständig einzeln abgenommen: Buchungspflege, Transfers, Auswahlabgleich, bestätigte Korrektur/Entsperrung, Undo/Redo und Entwurfsschutz. Die [P4.4-Kriterienmatrix](docs/handoffs/p4-4.md) nennt Belege und Grenzen. P5.1–P5.6 sind weitgehend implementiert: CSV/CAMT.053/OFX/QFX mit korrigierbarer Vorschau, gruppierter Übernahme/Wiederaufnahme, Regeln und Dauerzahlungen. Die [aktuelle P5-Nachprüfung](docs/handoffs/p5-review-2026-10-08.md) bestätigt die Kernabläufe, belegt aber fünf Funktions- und acht Abnahmelücken; [Gesamtabnahme #71](https://github.com/mpwg/WiMM/issues/71) bündelt alle Einzelissues. P5 ist weder vollständig umgesetzt noch vollständig abgenommen. Budget, gemeinsame Kosten, Synchronisierung und die vollständige Plattformabnahme bleiben offen.

Die [P4-Nachprüfung vom 8. Oktober 2026](docs/handoffs/p4-review-2026-10-08.md) bestätigt die vorhandenen Funktionen mit aktuellen Browser-/Speicher-/Layoutprüfungen. Für die vollständige Abnahme fehlen die separate Firefox-Kernablaufprüfung, Screenreader-Ansagen, die vollständige echte Zoommatrix sowie aktuelle native und physische Gerätenachweise. Eine grüne CI allein schließt P4 nicht ab.

Offene Deltas werden ab sofort in GitHub-Issues verfolgt: [P4-Übersicht #57 mit acht Einzelissues](https://github.com/mpwg/WiMM/issues/57). Die Projektdokumente bleiben die Quelle für Spezifikation, Freigaben und zusammengefassten Paketstatus.

## Geplantes Produkt

- Webanwendung und installierbare, offlinefähige PWA.
- Desktop-Apps für macOS, Windows und Linux mit plattformgerechter Gestaltung und nativen Menüs und Dialogen.
- Vollständiger lokaler Betrieb ohne Benutzerkonto oder Backend.
- Optional selbst gehosteter Server für persönliche Konten, Familienrollen und Synchronisierung.
- Mehrere getrennte Familien pro Server und mehrere Haushalte pro Person.
- Persönliche Bereiche ohne automatische Freigabe von Konten, Buchungen oder Summen.
- Verpflichtende Ende-zu-Ende-Verschlüsselung aller Finanzdaten; der Finanzserver erhält keine Entschlüsselungsschlüssel.
- Konten, Buchungen, Dateiimporte, Regeln, Dauerzahlungen, beide Budgetmethoden, Sparziele und Berichte.
- Geteilte Ausgaben, flexible Kostenverteilung, Beiträge und Ausgleichszahlungen.

Die erste Version richtet sich an Erwachsene im deutschsprachigen Raum, verwendet EUR und benötigt keine externen Finanzdienste. Bankanbindung, Kinderrollen, weitere Währungen und mobile Store-Apps folgen später.

## Einstieg für einen implementierenden Agenten

Für einen kompakten Start: [Einstiegsleitfaden](docs/getting-started.md), [Teilaufgabenübersicht P1–P11](docs/tasks.md#teilaufgaben-und-bearbeitungsfolge) und [synthetischer Referenzhaushalt mit Buchungsablauf](docs/reference-household.md). P4–P11 besitzen einzeln abnehmbare Teilaufgaben; [P5.1](docs/handoffs/p5-1.md) ist durch ausdrücklichen Auftrag umgesetzt und auf macOS arm64 abgenommen. Windows-/Linux-Läufe folgen später; offene P4-Abnahmen bleiben bestehen. P5.1–P5.6 wurden am 5. Oktober freigegeben; P5.2–P5.4 sind nach der aktuellen Nachprüfung erneut in Arbeit. Der nächste Schritt richtet sich nach [P5-Gesamtabnahme #71](https://github.com/mpwg/WiMM/issues/71) und dem aktuellen Implementierungsauftrag.

1. [Arbeitsregeln](AGENTS.md) lesen.
2. Im [Dokumentationsindex](docs/README.md) die Lesereihenfolge beachten.
3. [Fachliche Architektur](docs/domain.md), [technische Architektur](docs/architecture.md) und [Entscheidungen](docs/decisions.md) verstehen.
   Zusätzlich [Verschlüsselung und Schlüsselverwaltung](docs/encryption.md) vor Speicher-/Syncarbeit lesen.
4. Bei einem ausdrücklichen Implementierungsauftrag das erste offene, freigegebene [Arbeitspaket](docs/tasks.md) mit erfüllten Voraussetzungen übernehmen.
5. Paket anhand der [Test- und Abnahmeregeln](docs/testing.md) abschließen und seinen Status aktualisieren.

## Verhältnis zu Actual Budget

Für Zusammenarbeit auf GitHub und Entwicklung in VS Code: [Beitragsleitfaden](CONTRIBUTING.md), [Entwicklungsumgebung](docs/development.md) und [Agentenleitfaden mit vier Projektskills](docs/agent-guide.md). Die Hilfen sind versioniert, nicht global in anderen Projekten installiert.

[Actual Budget](https://github.com/actualbudget/actual) ist Funktionsreferenz und mögliche Quelle ausgewählter Importer, Berechnungen und Tests. WhereIsMyMoney wird überwiegend eigenständig entwickelt. Ein vollständiger Fork, dessen Oberflächendesign oder dessen Synchronisierungsprotokoll sind nicht vorgesehen.

WhereIsMyMoney einschließlich seiner eigenen Dokumentation und des späteren eigenen Anwendungscodes steht unter **GNU Affero General Public License, Version 3 oder neuer (AGPL-3.0-or-later)**. Der vollständige Lizenztext steht in [LICENSE](LICENSE.md); die Wahl einer späteren Version ergibt sich aus diesem ausdrücklichen Projektlizenzhinweis.

Übernommene Bestandteile behalten ihre tatsächlichen Lizenz- und Copyright-Hinweise; Paket- und Abhängigkeitslizenzen werden einzeln auf Kompatibilität geprüft. Die AGPL-Projektlizenz entfernt keine Hinweise fremder MIT-/ISC-Komponenten. Veröffentlichungen und Serveroberflächen stellen den zur betriebenen Version gehörenden Quellcode samt Buildanleitungen bereit; Einzelheiten stehen in [Betrieb](docs/operations.md).

## Verbindlichkeit

Dieses Dokumentationspaket ist die Umsetzungsspezifikation vom 2. Oktober 2026. Bei Widersprüchen zwischen verbindlichen Quellen den Widerspruch benennen und betroffene Quellen vor abhängiger Implementierung gemeinsam korrigieren; bei unklarer Produktabsicht rückfragen. Die [Entscheidungen](docs/decisions.md) begründen Festlegungen, die spezifischen Fach- und Schnittstellendokumente beschreiben ihre Verträge. Produktänderungen müssen dort vor Umsetzung nachvollziehbar dokumentiert werden.

## Gemeinsame dauerhafte Speicherprüfung

`pnpm test:storage:native` baut das gesperrte Rust-Testbinary und führt den echten `DesktopStorageAdapter` über den katalogisierten JSON-Testtransport gegen eine SQLite-Datei aus. Derselbe Snapshotkatalog läuft mit `pnpm exec playwright test --config tests/workspace/config.ts tests/workspace/domain-references.spec.ts` gegen echte Browser-IndexedDB. P5-Aggregate, Originalentwürfe, verschlüsselte Negativroundtrips und Profil-/Bereichstrennung gehören zum Katalog. Der SQLite-Neustart beendet den Rust-Prozess vollständig und öffnet dieselbe Datei erneut. Browserfälle schließen und öffnen den Adapter; die vorhandenen Browserprojektlabels belegen hier beide IndexedDB, keine native Oberfläche.

Der Treiber existiert ausschließlich im Rust-Testbinary, erweitert weder Tauri-Kommandos noch Produktrechte und führt keine Finanzberechnung aus. Ergebnisse liegen unter `test-results/storage-contract`; synthetische Daten. Native GUI, tatsächliches Disk-full, Screenreader und physische Geräte benötigen eigene Abnahmen. [Historischer Fortsetzungspunkt](docs/handoffs/issues-2026-10-08-rechnerwechsel.md), [gemeinsame vollständige Konformität #85](https://github.com/mpwg/WiMM/issues/85).

Der gemeinsame Speicherkatalog prüft außerdem den tatsächlichen Projektionsneuaufbau: Saldo, Gesamt- und Monatsverbrauch kommen aus dem vorhandenen Fachkern, der Cacheersatz ist atomar. SQLite verwirft den Commit bei zwischenzeitlichen Aggregatänderungen. `pnpm test:storage` prüft zusätzlich den Memory-Rollback. [Abnahme und Grenzen](docs/handoffs/storage-2026-10-08-fortsetzung.md).

Der gemeinsame Katalog enthält acht Empfänger-Mergefälle gegen beide echten Speicheradapter, einschließlich vollständigem Merge, unvollständigen/ungültigen Referenzen, stale CAS und atomarem Rollback. Diese Fälle dienen als verbindliche Vergleichsbasis der freigegebenen Rust-Migration [#91](https://github.com/mpwg/WiMM/issues/91).

SQLite und IndexedDB prüfen gespeicherte Storage-/Fachversionen getrennt von Sync-Epochen. Unbekannte Versionen verhindern den Zugriff und erhalten den vorhandenen Stand. Bekannte V1-Legacybestände werden ausschließlich um additive Versionsmetadaten ergänzt. Das ersetzt noch nicht die vollständige gesicherte Migrationsabnahme aus [#82](https://github.com/mpwg/WiMM/issues/82).
