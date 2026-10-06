# @wimm/web

## Lokaler Import P5

Die Importansicht verarbeitet CSV, CAMT.053, OFX und QFX lokal mit korrigierbarer Vorschau. Regeln und Dauerzahlungen verwenden denselben Fachkern wie Desktop. Der Produktionsbuild trägt sämtliche gebündelten Assets einschließlich beider Importworker in die Service-Worker-Liste ein und leitet den Cachenamen aus dieser Liste ab. Nach erfolgreichem Erstladen stehen damit auch noch nicht verwendete Importworker offline zur Verfügung. API-Antworten werden weiterhin nicht gecacht. Bestätigte Importgruppen und Fälligkeiten liegen dauerhaft in IndexedDB; gesperrte Tresore zeigen keine Import-/Finanzansicht.

## Oberfläche nach dem UX-Flow

Die gemeinsame Oberfläche übernimmt Grünakzent, warme Flächen, die Wortmarke „WiMM.“ und ruhige Listen aus dem freigegebenen klickbaren Konzept. „Alles im Blick.“ zeigt den echten **Kontostand gesamt**, letzte Buchungen, fällige Zahlungsvorschläge und Monatswerte. Desktop verwendet eine Seitenleiste mit separatem Bereichskopf; mobil bleiben Übersicht, Buchungen und die eigene Mehr-Ansicht erreichbar. Einstellungen enthalten Verwaltung und Farbschema. Tresor, Rettungscode und erstes Konto bilden den geführten lokalen Einstieg.

Buchungen und Konten werden über geschützte Dialoge bearbeitet; mobil füllen diese den Bildschirm. Import führt durch vier ausdrücklich bestätigte Schritte. Budget, Teilen und Familienausgleich sind weiterhin spätere Fachpakete. Es werden keine simulierten Konzeptdaten übernommen. Prüfung: `pnpm test:ux`; aktuelle Belege und offene Plattformprüfungen stehen in der UX-Übergabe.

Aktuelle UX-Abnahme vom 5. Oktober 2026: [Kriterien und Prüfbelege](../../docs/handoffs/ux.md). Die Umsetzung ist bereit zur Prüfung; Die Ubuntu-CI besteht einschließlich Firefox; vollständige Geräte-/Screenreader- und weitere native Plattformbelege sowie die gesamte Zoommatrix sind noch offen.
