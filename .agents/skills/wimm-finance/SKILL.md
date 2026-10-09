---
name: wimm-finance
description: "Implementiere oder prüfe WhereIsMyMoney-Finanzlogik: Buchungen, Budgets, gemeinsame Kosten, Rundung, Vorleistungen und Ausgleich. Nutze bei Änderungen mit Einfluss auf Geldwerte oder Finanzprojektionen."
license: AGPL-3.0-or-later
---

# Finanzlogik

Lies [Fachmodell](../../../docs/domain.md), [Datenmodell](../../../docs/data-model.md) und die betroffenen [Referenzfälle](../../../docs/testing.md). Diese sind die Berechnungsquelle; keine parallelen Regeln im UI oder Server ergänzen.

- Centparser und sichere Ganzzahlgrenzen einschließlich Zwischenwerte verwenden; gewichtete Multiplikation exakt berechnen.
- Buchung/Splits, Transferpaare und vollständige Ausgabenverteilungen atomar halten. Referenzen und erwartete Revisionen vollständig prüfen.
- Konsumausgabe, Kontobewegung, Personenguthaben und Haushaltsreserve unterscheiden. Beiträge sind keine zweite Konsumeinnahme; Erstattung ist keine zweite Ausgabe.
- Verteilungsgrundlagen je Ausgabe einfrieren; Restcent und kumulative Rückerstattungen nach der dokumentierten Methode.
- Privatveröffentlichung als bestätigte Kopie behandeln; private Quellen-IDs/Notizen und Summen nie in den Haushalt übertragen.
- Fachlogik läuft auf autorisierten Clients. Der E2EE-Server kann sie nicht aus Finanzklartext erneut berechnen.

Für eine Änderung passende F-Referenzen und fachliche Fehlfälle wählen; bei gemeinsamen Aggregaten die Adapter-/Syncfälle einbeziehen. Ergebnis berichtet betroffene Invariante, Beispielrechnung, Prüfbeleg und etwaige Migration. Reine Text-/Darstellungsänderungen benötigen keine neue Budgetabstraktion.

## Architekturstand vom 9. Oktober 2026

Bestand und Ziel sind getrennt: [gemeinsame Rust-Architektur](../../../docs/architecture.md). Hier dokumentierte Funktionen und Arbeitsregeln beziehen sich auf den Bestand; neue Rust-Anwendungs-/DAL-/Serverumstellung ist noch nicht implementiert. Aktuelle Aufträge und Kriterien in tasks.md/GitHub; historische Belege ersetzen keine Zielabnahme.
