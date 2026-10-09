# Plattform- und Leistungsabnahme

SPDX-License-Identifier: AGPL-3.0-or-later

Die vorhandenen Matrix-, Browser-, Zoom- und Geräteprüfungen belegen jeweils ihren tatsächlich ausgeführten Client; Desktop-Frontend bleibt ein Browserfixture und ersetzt keine native Tauri-Abnahme. Voraussetzungen und Grenzen in [Prüfstrategie](../../docs/testing.md), Tracking in [P4 #57](https://github.com/mpwg/WiMM/issues/57).

`pnpm test:ui:performance` führt die zwei bestehenden 50.000-Buchungen-Fälle getrennt aus, mit derselben Chromium-/IndexedDB-Testseite und unveränderten Schwellen: Kaltöffnung und warme Listenöffnung jeweils unter 2.000 ms, Filter-/Scroll-p95 unter 100 ms. Die vollständige Matrix `pnpm test:ui:matrix` enthält beide Fälle weiterhin. Der separate Ubuntu-Job sichert Messungen und Traces als leistungsbelege-50000; der Gesamtjob bleibt bestehen.

Kaltöffnung läuft ab tatsächlicher Navigation/Reload mit gespeichertem Bestand. Ein Observer der ausschließlich synthetischen Testseite erfasst die erste vollständige sichtbare Liste nach zwei Animationsframes. Der Wert bleibt für diese Seiteninstanz eingefroren; bei frischem Reload und vor Öffnung der Buchungen muss er fehlen. Messung wartet auf den bestehenden Datenzähler und eine dargestellte Buchungszeile. Keine zweite Vollabfrage, kein Prewarming und kein früheres Startsignal nach Datenladung. Der Zeitpunkt nach Playwright-Prüfung sowie dessen zusätzlicher Aufwand werden separat gespeichert, statt sie als Appzeit zu interpretieren. Trefferzahl, virtuelle Zeilenzahl und Scrollorakel bleiben verpflichtend.

[Leistungsdelta #129](https://github.com/mpwg/WiMM/issues/129) dokumentiert den ursprünglichen Ubuntu-Befund von 2.065,6 ms und die konkrete Messkorrektur. Lokale erfolgreiche Fälle ersetzen den erforderlichen aktuellen Ubuntu-Nachweis nicht. Alle Messungen verwenden synthetische Datensätze: zehn Konten, 100 Kategorien, 36 Monate und 1.000 synthetische SharedExpenses zusätzlich zu 50.000 echten gespeicherten Buchungen.
