# Gemeinsame Oberflächen-Testhelfer

Die Helfer bedienen die tatsächliche Finanzoberfläche mit synthetischen Daten. ui.ts bestimmt den mobilen Bedienweg erst nach der sichtbaren Arbeitsansicht; eine noch nicht gerenderte Navigation wird nicht als Desktoplayout behandelt. Mobile Konten/Verwaltung bleiben über „Mehr“ erreichbar, Desktopnavigation verwendet die bestehenden Befehle.

Prüfung aus der aktiven Arbeitskopie: `pnpm test:ui:integration`. Die unveränderte Serie umfasst Web- und Desktop-Frontend-Speicherintegration; sie ersetzt keine native Plattformabnahme. Keine verlängerten Zeitgrenzen, Wiederholschleifen oder übersprungenen Fälle. [Datierter Abnahmesnapshot für #104](../../docs/handoffs/ui-navigation-2026-10-09.md).
