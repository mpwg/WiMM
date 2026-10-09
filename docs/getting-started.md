# Einstieg in WiMM

## Aktueller Stand

WiMM besitzt lokale React/PWA-/Tauri-Oberflächen, eine produktive TypeScript-Fachengine, eine geprüfte eigenständige Rust-Fachgrundlage und IndexedDB-/SQLite-Bestandsadapter. Der Server besitzt bislang Health-/Metadatenrouten. Das [gemeinsame Rust-Ziel](architecture.md) mit Rust-Anwendung/DAL/Axum ist bestätigt, aber noch umzusetzen. [Review](architecture-review.md), [Aufgaben](tasks.md) und [Gesamtübersicht #114](https://github.com/mpwg/WiMM/issues/114) trennen Ziel, Freigabe und Umsetzung.

## Erste Schritte

1. [AGENTS.md](../AGENTS.md), [Dokumentationsindex](README.md), [Fachmodell](domain.md), [Architektur](architecture.md), [Entscheidungen](decisions.md), [Aufgaben](tasks.md) lesen.
2. Aktive Arbeitskopie, Branch, Gitstatus und betroffene aktuelle Issues prüfen. Keine andere lokale Kopie und kein früherer DevContainer.
3. Tatsächliche Toolchain/Manifeste und Befehle aus [Entwicklung](development.md) prüfen; keine geplanten Rust-Server-/ORM-Kommandos erfinden.
4. Für Fachbeispiele [Referenzhaushalt](reference-household.md), für Abschluss [Tests](testing.md) und [Abnahmekatalog](acceptance-catalog.md) verwenden. Reale Finanz-/Schlüsseldaten nicht in Fixtures/Logs/Issues.

## Entscheidung oder Rückfrage

| Situation | Vorgehen |
| --- | --- |
| Verbindlicher Vertrag und erfüllte Voraussetzungen | Im ausdrücklich freigegebenen Umfang umsetzen |
| Technische Tatsachen wie Importpfad oder Manifestversion | In aktiver Arbeitskopie ermitteln |
| Fehlender ORM/VFS/Bindingnachweis | Bestand erhalten; vor Ersatzarchitektur rückfragen |
| Neue Produktfunktion, neuer Prototyp, wesentlich geänderter Paketumfang | Gesonderten Auftrag gemäß tasks.md benötigen |
| Widersprüchliche Spezifikation | Benennen und betroffene Quellen gemeinsam vor abhängiger Implementierung korrigieren |
| Fehlende Plattform/Secret | Nur betroffene Abnahme/Distribution offen halten, keine Nachweise fingieren |

## Erfolg und Historie

UI-Speichererfolg bedeutet dauerhaft bestätigten lokalen Commit, nicht Serversync. Outbox/Entwürfe/Bestätigungen bleiben getrennt. Native Rusttests und tatsächliche DB-/Binding-/Geräteabnahmen ergänzen sich. [Belegindex](review-evidence.md) verlinkt frühere unveränderliche Abnahmen; diese sind kein Beleg neu implementierter Zielkomponenten.
