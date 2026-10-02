---
name: wimm-ui
description: "Gestalte oder prüfe WhereIsMyMoney-Oberflächen für Desktop, Web und mobile PWA mit nativer Anmutung. Nutze bei Navigation, Finanzformularen, Plattformintegration oder visueller Abnahme."
license: AGPL-3.0-or-later
---

# Oberfläche und native Bedienung

Lies [UI-Spezifikation](../../../docs/ui.md), den betreffenden Ablauf in [Produkt](../../../docs/product.md) und die [Screenshot-/Plattformmatrix](../../../docs/testing.md). Keine neue Designsprache oder Marketingseite aus einer Arbeitsansicht machen.

- Desktop und Touch als eigene Kompositionen; gemeinsame Fachkomponenten/Plattformtokens nutzen.
- Desktopfenster, Menüs, Dialoge, Shortcuts und Fokus plattformgerecht; mobile Listen/Details statt gequetschter Desktoptabellen.
- Privat-/Haushaltsbereich sichtbar; Beträge tabellarisch, rechtsbündig und deutsch formatiert. Keine Geldberechnung im Formularwidget.
- Toolicons beschriften, Zustände leer/Fehler/offline/ausstehend/Konflikt/gesperrter Tresor vollständig gestalten.
- Tresorentsperrung nicht als zweiten Serverlogin darstellen; keine Forderung nach signierten Clients. Veröffentlichung zeigt ausschließlich freigegebene Daten.
- Fokus, Screenreader, Zoom, Kontrast, Touchziele und lange deutsche Texte prüfen. Native Checks nicht durch Webscreenshots als bestanden ausgeben.

Übergabe nennt geänderte Ansicht, betroffene Plattformen, Screenshot-/Interaktionsbelege und verfügbare/nicht verfügbare native Prüfungen. Bei vorhandener Gestaltung deren Komponenten verbessern, statt globale Tokens für einen Einzelfall neu zu erfinden.
