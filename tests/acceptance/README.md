# Plattform- und Leistungsabnahme

SPDX-License-Identifier: AGPL-3.0-or-later

Die vorhandenen Matrix-, Browser-, Zoom- und Geräteprüfungen belegen jeweils ihren tatsächlich ausgeführten Client; Desktop-Frontend bleibt ein Browserfixture und ersetzt keine native Tauri-Abnahme. Voraussetzungen und Grenzen in [Prüfstrategie](../../docs/testing.md), Tracking in [P4 #57](https://github.com/mpwg/WiMM/issues/57).

`pnpm test:ui:performance` führt die zwei bestehenden 50.000-Buchungen-Fälle getrennt aus, mit derselben Chromium-/Rust-SQLite-/OPFS-Testseite und unveränderten Schwellen: Kaltöffnung und warme Listenöffnung jeweils unter 2.000 ms, Filter-/Scroll-p95 unter 100 ms. Die vollständige Matrix `pnpm test:ui:matrix` enthält beide Fälle weiterhin. Der separate Ubuntu-Job sichert Messungen und Traces als leistungsbelege-50000; der Gesamtjob bleibt bestehen.

Kaltöffnung läuft ab tatsächlicher Navigation/Reload mit tatsächlich im gemeinsamen Rust-/OPFS-DAL gespeichertem Bestand. Ein Observer der ausschließlich synthetischen Testseite erfasst die erste vollständige sichtbare Liste nach zwei Animationsframes. Der Wert bleibt für diese Seiteninstanz eingefroren; bei frischem Reload und vor Öffnung der Buchungen muss er fehlen. Messung wartet auf den bestehenden Datenzähler und eine dargestellte Buchungszeile. Keine zweite Vollabfrage, kein Prewarming und kein früheres Startsignal nach Datenladung. Der Zeitpunkt nach Playwright-Prüfung sowie dessen zusätzlicher Aufwand werden separat gespeichert, statt sie als Appzeit zu interpretieren. Trefferzahl, virtuelle Zeilenzahl und Scrollorakel bleiben verpflichtend.

[Leistungsdelta #129](https://github.com/mpwg/WiMM/issues/129) dokumentiert den ursprünglichen Ubuntu-Befund von 2.065,6 ms und die konkrete Messkorrektur. Lokale erfolgreiche Fälle ersetzen den erforderlichen aktuellen Ubuntu-Nachweis nicht. Alle Messungen verwenden synthetische Datensätze: zehn Konten, 100 Kategorien, 36 Monate und 1.000 synthetische SharedExpenses zusätzlich zu 50.000 echten gespeicherten Buchungen.

Aktuelle vollständige #129-Abnahme: [Ubuntu-Leistungsjob auf 970b913](https://github.com/mpwg/WiMM/actions/runs/37925825424/job/113804387690) erfolgreich und Artefakt rückgelesen. Web/Frontend kalt 1.265,6/1.318,7 ms, warm 21,4/16,9 ms, Filter-p95 50,1/50,0 ms, Scroll-p95 33,8/33,5 ms. [Datierte Matrix](../../docs/performance-evidence.md). Diese begrenzte Abnahme schließt keine anderen P4-/nativen Plattformkriterien.

Der einmalige Fixtureaufbau wartet auf die vorhandene Test-API innerhalb des unveränderten 120-Sekunden-Testrahmens; Kaltzeit wird erst im separaten tatsächlichen Reload gemessen, weiterhin ab Navigation. 1.000 synthetische Zusatzlastpayloads liegen vollständig in blockierten Originaldatensätzen statt in untypisierten Finanzprojektionen; Zähler liest tatsächliche Rows über Rust. Desktopfrontend bleibt Browser-/OPFS-Nachweis, keine native GUI-Abnahme. Neue Integrationsdeltas #152/#153/#154 bleiben offen.
