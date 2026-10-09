# Browseradapter für die Clientanwendung

AGPL-3.0-or-later. Dieses Paket bindet die plattformfreie Anwendung an Browseruhr/UUIDs, localStorage mit Web Locks und die vorhandenen Importworker an. Web-/Desktop-Einstiegspunkte injizieren den konkreten Finanzspeicher; die Desktop-App verwendet weiterhin ihren SQLite-Port.

Workeradapter begrenzen die Laufzeit auf 30 Sekunden und entfernen Listener und Worker bei Ergebnis, Fehler, Abbruch oder Zeitlimit. Sie berechnen keine verbindlichen Finanzänderungen. Die vorhandenen Dateiparser und Cryptoports bleiben unverändert. UI-Kompatibilitätsbarrels delegieren hierher. [K02-Abnahme](https://github.com/mpwg/WiMM/blob/84d730cc6e10d70cf6ac6ff9bc28c4a9c4376e92/docs/handoffs/k02-2026-10-08.md).

createBrowserStoragePersistence fragt die tatsächliche StorageManager-Persistenz an und unterscheidet Zusage, Ablehnung, fehlende API und API-Fehler. Die Webcomposition aktiviert diesen Port beim lokalen Einstieg; die Desktopcomposition bleibt davon getrennt. Prüfung: `pnpm exec playwright test --config tests/storage/persistence.config.ts`. [Teilabnahme und offene #84-Kriterien](https://github.com/mpwg/WiMM/blob/84d730cc6e10d70cf6ac6ff9bc28c4a9c4376e92/docs/handoffs/issues-2026-10-09-haltepunkt.md).

## Architekturstand vom 9. Oktober 2026

Bestand und Ziel sind getrennt: [gemeinsame Rust-Architektur](../../docs/architecture.md). Hier dokumentierte Funktionen und Arbeitsregeln beziehen sich auf den Bestand; neue Rust-Anwendungs-/DAL-/Serverumstellung ist noch nicht implementiert. Aktuelle Aufträge und Kriterien in tasks.md/GitHub; historische Belege ersetzen keine Zielabnahme.
