# Dokumentationsindex

Stand: 9. Oktober 2026. Das bestätigte Ziel ist die [gemeinsame Rust-Architektur](architecture.md). Der [detaillierte Review](architecture-review.md) begründet Veränderungen und Alternativen; [ADR-050–052](decisions.md) dokumentieren Annahme, Migration und Prüfungen. [Gesamtübersicht #114](https://github.com/mpwg/WiMM/issues/114) führt alle Verbesserungen und die übernommenen K-/DAL-Kriterien. Frühere separate Konzepte und überholte Übergaben sind entfernt; ihre unveränderlichen Quellen stehen im [Belegindex](review-evidence.md).

## Auftrag und tatsächlicher Stand

Nutzerentscheidung vom 10. Oktober 2026: WiMM ist unveröffentlicht und benötigt keine Legacy-Kompatibilität oder Altdatenübernahme. [ADR-060](decisions.md#adr-060--zielimplementierung-ohne-legacy-komponenten) ersetzt frühere Übergangsanforderungen; [#146](https://github.com/mpwg/WiMM/issues/146) verfolgt die vollständige Entfernung. Aktuelle Finanz-, E2EE-, CAS-, Restore-, Versions- und Plattformprüfungen bleiben verbindlich.

[Aufgaben](tasks.md) ist die einzige Quelle für Implementierungsfreigaben und zusammengefassten Paketstatus. Review/Bereinigung sind abgeschlossen; anschließend ist die geordnete Architekturumsetzung aus #114 einschließlich Machbarkeitsprototypen ausdrücklich beauftragt. Erster Abschnitt ist DAL01/#106. Neue P6–P11-Produktfunktionen und Releases bleiben getrennt. Der Bestand verwendet noch TypeScript-Controller, IndexedDB/rusqlite und einen Fastify-Stub; das Ziel ist nicht als bereits umgesetzt zu lesen.

Aktuelle Abschnittsbelege: [DAL01-Machbarkeit](dal01-proof.md) und [AR01-Typisierung](ar01-typing.md), [AR03-Fehlergrenzen](ar03-errors.md), [AR11-Architekturgrenzen](architecture-checks/README.md), [AR08-Kryptoports](../crates/client-crypto/README.md), [DAL02-Vertragsreferenz](dal02-contracts.md), [AR04-Persistenzabschnitt](ar04-local-receipts.md), [AR05-Runtimegrundlage](ar05-runtime-foundation.md), [DAL03-Bestandszugriff](dal03-native.md). Sie unterscheiden geprüfte Teilumsetzung und noch offene Gesamtabnahme.

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
