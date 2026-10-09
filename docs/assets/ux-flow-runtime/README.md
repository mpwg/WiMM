# Laufzeitbelege zum UX-Flow

Historische synthetische Prüfdaten vom 5. Oktober 2026, Implementierungsstand `430a4b0`, Chromium 153 auf macOS 27 arm64. Die Daten stammen aus dem isolierten Testclient, nicht aus dem Produktivbestand.

Für jede Größe 320×568, 390×844, 768×1024, 1440×900 und 1920×1080 liegen Übersicht, Buchungen, Details und Feldfehler in Hell/Dunkel vor. Diese vierzig Bilder zeigen den echten gemeinsamen UI-Code mit IndexedDB-Testdaten. Desktop-Frontendansichten wurden im selben Matrixlauf zusätzlich geprüft; vollständige lokale Laufbilder liegen unter `test-results/p4-6-matrix`.

- [Desktopübersicht](uebersicht-1440×900-light.png)
- [Mobile Übersicht](uebersicht-390×844-light.png)
- [Mobile Dunkelansicht](uebersicht-390×844-dark.png)
- [Echter Chromiumzoom 200 %](browserzoom-200.png): eigener GUI-Lauf, kein CSS-Zoom; noch keine vollständige Größen-/Farbschemamatrix bei 200 %.
- [Leistungsmessungen](messungen.json): echte 50.000 Buchungen, warme Wiederholungen, Treffer-/Scrollorakel und dokumentierte Laufzeit.

Die [Kriterienmatrix](https://github.com/mpwg/WiMM/blob/84d730cc6e10d70cf6ac6ff9bc28c4a9c4376e92/docs/handoffs/ux.md#umsetzung-des-freigegebenen-ux-flows-am-5-oktober-2026) benennt Abnahmegrenzen. Bilder belegen keine native Geräte- oder Screenreaderbedienung.
