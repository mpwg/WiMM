# #104 — Testnavigation nach sichtbarer Arbeitsansicht

Abnahmesnapshot vom 9. Oktober 2026, Ausgangsstand `2746134`. Fortschritt und CI-Nachprüfung stehen in [#104](https://github.com/mpwg/WiMM/issues/104), Gesamtstand in #57/#87/#91.

## Befund und Umsetzung

CI [37885431561](https://github.com/mpwg/WiMM/actions/runs/37885431561) auf f89ebfa scheiterte nach 123 erfolgreichen Fällen beim Touch-Abgleich. Der heruntergeladene Trace belegt: call@1217 fragt mobile-navigation.isVisible vor dem gerenderten Arbeitsbereich ab und erhält false; call@1219 wartet anschließend auf den mobilen, erst über „Mehr“ erreichbaren Kontenbefehl. Der Test wählte damit den falschen Bedienweg beim asynchronen Fixture-/Speicherstart.

navigate wartet jetzt zuerst auf die tatsächliche sichtbare app-shell und bestimmt dann die Sichtbarkeit der mobilen Navigation. Bestehende Befehle und Wartefristen bleiben erhalten. Kein Produktablauf, kein pauschaler Retry und kein Skip geändert. Die [Testhelfer-README](../../tests/helpers/README.md) erklärt den Rahmen.

## Kriterienmatrix

| Kriterium | Status | Beleg |
| --- | --- | --- |
| Layoutentscheidung nach sichtbarem Arbeitsbereich | erfüllt | Explizite sichtbare app-shell-Assertion vor isVisible |
| Tatsächlicher betroffener Touch-Abgleich | erfüllt | Beide Web-/Desktop-Frontendfälle in derselben Serie bestanden |
| Gemeinsame Arbeitsbereichsserie | erfüllt | env -u NO_COLOR pnpm test:ui:integration: 124 bestanden in 34,2 s, unveränderte Zeitgrenzen |
| Passender abschließender CI-Beleg | offen | Exakter CI-Stand wird direkt im Issue nach dem Commit ergänzt |

Aktive Arbeitskopie macOS 27.0.1 arm64, Chromium aus Playwright 1.63.0, Node 26.10.0/pnpm 12.8.1. Artefakt test-results/ui-navigation-104.log. Ausschließlich synthetische Daten. Browserfrontendbelege werden nicht als native Tauri-/Geräte-/Screenreaderabnahme ausgegeben.
