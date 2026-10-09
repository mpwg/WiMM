# Dokumentationsindex

Stand: 9. Oktober 2026. Das bestätigte Ziel ist die [gemeinsame Rust-Architektur](architecture.md). Der [detaillierte Review](architecture-review.md) begründet Veränderungen und Alternativen; [ADR-050–052](decisions.md) dokumentieren Annahme, Migration und Prüfungen. [Gesamtübersicht #114](https://github.com/mpwg/WiMM/issues/114) führt alle Verbesserungen und die übernommenen K-/DAL-Kriterien. Frühere separate Konzepte und überholte Übergaben sind entfernt; ihre unveränderlichen Quellen stehen im [Belegindex](review-evidence.md).

## Auftrag und tatsächlicher Stand

[Aufgaben](tasks.md) ist die einzige Quelle für Implementierungsfreigaben und zusammengefassten Paketstatus. Jetzt beauftragt sind Review, Dokumentations-/Issuebereinigung und Architekturentscheidungen. Neue Produktdeltas/Prototypen/DBmigrationen sind nicht automatisch freigegeben. Der Bestand verwendet noch TypeScript-Controller, IndexedDB/rusqlite und einen Fastify-Stub; das Ziel ist nicht als bereits umgesetzt zu lesen.

## Lesereihenfolge

| Schritt | Quelle | Zweck |
| --- | --- | --- |
| 1 | [AGENTS.md](../AGENTS.md), [Aufgaben](tasks.md), [Einstieg](getting-started.md) | Arbeitskopie, Sprache, Auftrag und aktueller Umfang |
| 2 | [Produkt](product.md), [Fachmodell](domain.md), [Referenzhaushalt](reference-household.md) | Funktionen, sichere Geldregeln, private/gemeinsame Grenzen |
| 3 | [Review](architecture-review.md), [Architektur](architecture.md), [Entscheidungen](decisions.md) | Belege, Ziel, Alternativen, Migrations- und Machbarkeitstore |
| 4 | [Datenmodell](data-model.md), [Anwendungsverträge](core-contracts.md) | Aggregate, Versionen, Commit-/Ansichts-/Speicherports |
| 5 | [E2EE](encryption.md), [Crypto-Vektoren](crypto-test-vectors.md), [Sicherheit](security.md) | Schlüssel, Rollen, Client-/Serververtrauen und Recovery |
| 6 | [API](api.md), [Sync](synchronization.md), [Formate](formats.md) | Öffentliche Hüllen, CAS, Konflikte, Parser und Exporte |
| 7 | [UI](ui.md), [UX](ux-redesign.md) | Plattformbedienung, Formulardrafts, Fokus und Zustände |
| 8 | [Tests](testing.md), [P1–P5-Abnahmekatalog](acceptance-catalog.md), [Belegindex](review-evidence.md) | Verbindliche Kriterien, aktuelle Reviewprüfung, historische Quellen |
| 9 | [P6](p6-budget.md), [P7](p7-family.md), [P8](p8-server.md), [P9](p9-sync.md), [P10](p10-backup.md), [P11](p11-release.md) | Noch nicht freigegebene Produktspezifikationen |
| 10 | [Entwicklung](development.md), [Versionsbasis](technology-baseline.md), [Betrieb](operations.md), [Agentenleitfaden](agent-guide.md) | Tatsächliche Befehle/Manifeste, Zielbetrieb und Arbeitsvorlagen |

## Verbindlichkeit

Finanzsemantik bleibt im Fachmodell, Entitäten im Datenmodell, Transaktionen/Bindings in den Anwendungsverträgen, Transport in API/Sync und Vertrauensgrenzen in E2EE/Sicherheit. Bei Widerspruch Quellen gemeinsam korrigieren; offene Produkt-/Ersatzarchitekturentscheidungen mit dem Nutzer klären. GitHub führt Fortschritt, Dokumentation Spezifikation und datierte Belege.
