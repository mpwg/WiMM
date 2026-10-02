# Beiträge zu WhereIsMyMoney

Das Projekt befindet sich in der Dokumentationsphase. Der aktuelle Auftrag umfasst Spezifikation, Agentenhilfen und Editor-/GitHubvorlagen; Anwendungscode folgt nach ausdrücklicher Implementierungsfreigabe.

Vor Beiträgen [AGENTS.md](AGENTS.md), [Agentenleitfaden](docs/agent-guide.md), [Entscheidungen](docs/decisions.md) und relevantes [Arbeitspaket](docs/tasks.md) lesen. Eigene Beiträge stehen unter AGPL-3.0-or-later; Fremdherkunft und kompatible Lizenzhinweise erhalten. Keine zusätzlichen CLA-/Sign-off-Pflichten wurden vereinbart.

Zum Einstieg: [Kurzleitfaden](docs/getting-started.md), [Lesematrix](docs/agent-guide.md#lesematrix-nach-aufgabe), [P1-Teilaufgaben](docs/p1-foundation.md) und [Referenzhaushalt](docs/reference-household.md). Das [Hook-Konzept](docs/development.md#hooks-und-automatisierte-prüfungen-ab-p1) wird erst in P1 umgesetzt.

Bei Widersprüchen zwischen verbindlichen Quellen den Widerspruch benennen und betroffene Quellen vor abhängiger Implementierung gemeinsam korrigieren; bei unklarer Produktabsicht rückfragen. Dieser Dokumentationsauftrag autorisiert keine Commits, Pushes oder Veröffentlichungen.

## Einheitlicher Ablauf

1. Konkretes Paket/Problem nennen und betroffene Spezifikation lesen; vorhandene Änderungen bewahren.
2. Arbeit auf passendem Branch bzw. vorhandenem Arbeitsstand durchführen. Neue Branches standardmäßig `codex/<paket>-<thema>`.
3. Relevante Prüfungen aus [testing.md](docs/testing.md) durchführen und echte Ergebnisse dokumentieren.
4. Zusammenhängende Zwischencommits nur bei bestehender ausdrücklicher Autorisierung erstellen; neue Nachrichten mit Conventional-Commit-Typ und deutschem Inhalt.
5. Paketstatus/Docs aktualisieren und PR mit vorhandener Vorlage vorbereiten. Push/Merge/Release benötigt entsprechenden Auftrag.

GitHub-Issues verwenden [Aufgaben](.github/ISSUE_TEMPLATE/task.yml) oder [Fehler](.github/ISSUE_TEMPLATE/bug.yml). Nur synthetische Daten, keine Finanzdateien, Rettungscodes oder Schlüssel. Sicherheitslücken nicht in öffentliche Fehlerberichte einfügen; privaten GitHub-Meldeweg verwenden, sofern aktiviert, andernfalls erst einen privaten Kontaktweg klären.

## Entwicklung

Editor-/GitHubkonventionen stehen in [development.md](docs/development.md). PWA und Desktop werden gleichwertig berücksichtigt. Finanzlogik ist plattformfrei und clientseitig; der E2EE-Server enthält keine Finanzklartexte. Authentifizierte Clients benötigen keine Appsignatur oder Attestierung für Zugang.
