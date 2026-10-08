# Browseradapter für die Clientanwendung

AGPL-3.0-or-later. Dieses Paket bindet die plattformfreie Anwendung an Browseruhr/UUIDs, localStorage mit Web Locks und die vorhandenen Importworker an. Web-/Desktop-Einstiegspunkte injizieren den konkreten Finanzspeicher; die Desktop-App verwendet weiterhin ihren SQLite-Port.

Workeradapter begrenzen die Laufzeit auf 30 Sekunden und entfernen Listener und Worker bei Ergebnis, Fehler, Abbruch oder Zeitlimit. Sie berechnen keine verbindlichen Finanzänderungen. Die vorhandenen Dateiparser und Cryptoports bleiben unverändert. UI-Kompatibilitätsbarrels delegieren hierher. [K02-Abnahme](../../docs/handoffs/k02-2026-10-08.md).
