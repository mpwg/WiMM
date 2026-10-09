# Beiträge zu WiMM

Das Projekt besitzt bereits Produktcode und eine bestätigte gemeinsame Rust-Zielarchitektur. Aktueller Auftrag und Implementierungsfreigaben ausschließlich in [Aufgaben](docs/tasks.md); dieses Architekturreview implementiert keine neuen Produktpakete. Vor Beiträgen [AGENTS.md](AGENTS.md), [Agentenleitfaden](docs/agent-guide.md), [Review](docs/architecture-review.md), [Architektur](docs/architecture.md) und [Entscheidungen](docs/decisions.md) lesen.

Eigene Inhalte AGPL-3.0-or-later; fremde Herkunft/Lizenzen erhalten. Keine zusätzliche CLA-/Sign-off-Pflicht. Keine realen Finanzdaten, Schlüssel oder Rettungscodes in Beispielen/Logs/Issues. Sicherheitsmeldungen über einen vorhandenen privaten Meldeweg; falls keiner besteht erst privaten Kontaktweg klären.

## Arbeitsablauf

1. Aktive Arbeitskopie, Branch, Gitstatus, konkrete Issues und Voraussetzungen prüfen; fremde Änderungen bewahren.
2. Verbindliche Fach-/Crypto-/Speicher-/APIverträge lesen. Bei Widerspruch gemeinsam korrigieren, bei offener Produkt-/Ersatzarchitekturentscheidung rückfragen.
3. Im ausdrücklich freigegebenen Umfang arbeiten; passende Skills und risikogerechte [Prüfungen](docs/testing.md) nutzen.
4. Aktuelle Ergebnisse/Blockaden im Issue, zusammengefassten Status in tasks.md und betroffene Spezifikation/README aktualisieren.
5. Eigene abgeschlossene Abschnitte mit deutschen Conventional Commits festhalten; Gitfreigabe aus AGENTS.md, bestehender Schutz und kein Force-Push. Neue optionale Branches heißen codex/<paket>-<thema>. Pull Requests verwenden die vorhandene Vorlage; Release/Deployment braucht eigenen Auftrag.

[Einstieg](docs/getting-started.md), [Entwicklung](docs/development.md), [Abnahmekatalog](docs/acceptance-catalog.md), [historische Belege](docs/review-evidence.md). Vorhandener optionaler Dokumentationshook ersetzt weder Fachabnahme noch CI. Gemeinsame Regeln statt Kopien pro Agent pflegen.
