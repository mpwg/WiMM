---
name: wimm-ui
description: "Gestalte oder prüfe WhereIsMyMoney-Oberflächen für Desktop, Web und mobile PWA mit nativer Anmutung. Nutze bei Navigation, Finanzformularen, Plattformintegration oder visueller Abnahme."
license: AGPL-3.0-or-later
---

# Oberfläche und native Bedienung

Lies [UI-Spezifikation](../../../docs/ui.md), den betreffenden Ablauf in [Produkt](../../../docs/product.md) und die [Screenshot-/Plattformmatrix](../../../docs/testing.md). Die durch Nutzerauftrag freigegebene Designsprache aus [UX-Konzept](../../../docs/ux-redesign.md) verwenden; keine Marketingseite aus einer Arbeitsansicht machen.

- Desktop und Touch als eigene Kompositionen; gemeinsame Fachkomponenten/Plattformtokens nutzen.
- Desktopfenster, Menüs, Dialoge, Shortcuts und Fokus plattformgerecht; mobile Listen/Details statt gequetschter Desktoptabellen.
- Privat-/Haushaltsbereich sichtbar; Beträge tabellarisch, rechtsbündig und deutsch formatiert. Keine Geldberechnung im Formularwidget.
- Toolicons beschriften, Zustände leer/Fehler/offline/ausstehend/Konflikt/gesperrter Tresor vollständig gestalten.
- Tresorentsperrung nicht als zweiten Serverlogin darstellen; keine Forderung nach signierten Clients. Veröffentlichung zeigt ausschließlich freigegebene Daten.
- Fokus, Screenreader, Zoom, Kontrast, Touchziele und lange deutsche Texte prüfen. Native Checks nicht durch Webscreenshots als bestanden ausgeben.

Übergabe nennt geänderte Ansicht, betroffene Plattformen, Screenshot-/Interaktionsbelege und verfügbare/nicht verfügbare native Prüfungen. Bei vorhandener Gestaltung deren Komponenten verbessern, statt globale Tokens für einen Einzelfall neu zu erfinden.

## Architekturstand vom 9. Oktober 2026

Bestand und Ziel sind getrennt: [gemeinsame Rust-Architektur](../../../docs/architecture.md). Hier dokumentierte Funktionen und Arbeitsregeln beziehen sich auf den Bestand; neue Rust-Anwendungs-/DAL-/Serverumstellung ist noch nicht implementiert. Aktuelle Aufträge und Kriterien in tasks.md/GitHub; historische Belege ersetzen keine Zielabnahme.
