# Kaltöffnungsnachweis — #129

Stand: 9. Oktober 2026. Datierter Abschnittsnachweis für [Leistungsdelta #129](https://github.com/mpwg/WiMM/issues/129), [P4-Gesamtabnahme #57](https://github.com/mpwg/WiMM/issues/57) und [Architekturfolge #114](https://github.com/mpwg/WiMM/issues/114). Keine native Desktop-/Geräteabnahme und keine vollständige P4-Freigabe.

## Befund und Messgrenze

[Ubuntu-CI 37919906675](https://github.com/mpwg/WiMM/actions/runs/37919906675) auf 80c3648 misst Desktop-Frontend-Kaltöffnung mit 50.000 Buchungen bei 2.065,6 ms statt unter 2.000 ms; 23 weitere Matrixfälle bestehen. Der bisherige Browserzeitpunkt wurde erst nach Playwrights Sichtbarkeitsprüfung zurückgelesen. Er enthält zusätzlich Poll-/Kommunikationszeit nach der tatsächlichen Darstellung; deren Anteil war im damaligen CI-Lauf nicht getrennt erfasst. Daraus wird keine rückwirkende Behauptung abgeleitet, dass die App damals innerhalb der Grenze lag.

Der aktualisierte Messpfad startet weiterhin bei Navigation/Reload und umfasst Module, echtes IndexedDB-Lesen, Appaufbau und Darstellung. Die synthetische Testseite erfasst die erste vollständige sichtbare Buchungsliste im Browser nach zwei Animationsframes. Der Wert ist danach unveränderlich; bis zum Öffnen der Buchungen fehlt er. Die spätere Testtreiberzeit wird separat ausgewiesen. Keine Änderung an Produktfinanzlogik, Datensatz, Cold-Startpunkt, Treffer-/Scrollorakel oder Grenzwerten. Kein Prewarming, Retry-as-success oder Warmwert-Ersatz.

## Kriterienmatrix

| Kriterium aus #129 | Status | Abschnittsbeleg |
| --- | --- | --- |
| Ursache/Messgrenze belegen, tatsächliche Kaltöffnung erhalten | erfüllt für Messgrenze | Vorhercode misst nach Testtreiberprüfung; Browsermarker jetzt nach sichtbarer vollständiger Liste und zwei Frames. Lokal separat gemessener zusätzlicher Testtreiberaufwand von 76/109 ms; damaliger CI-Anteil bleibt unbekannt |
| Beide Clients unter 2.000 ms, Filter-/Scroll-p95 unter 100 ms, Orakel erhalten | erfüllt lokal | Tatsächliche Chromium-/IndexedDB-Fälle auf macOS arm64: Web etwa 498 ms, Desktop-Frontend etwa 505 ms; warme Öffnung 32/19 ms, Filter-/Scroll-p95 etwa 35/34 ms. Wiederholter vollständiger Zweifalllauf bestanden |
| Aktueller unabhängiger Ubuntu-Nachweis ohne gelockerte Grenze | offen | Dedizierter CI-Job eingerichtet; erst nach tatsächlichem erfolgreichem Lauf erfüllen |
| README, Matrix und Tracking aktuell; Clientgrenze klar | erfüllt für Abschnitt | [Prüf-README](../tests/acceptance/README.md), diese Matrix und #129/#57/#114; Desktop-Frontend ausdrücklich kein Tauri-Systemnachweis |

Lokale Logs: test-results/architecture-implementation/performance-129-local-after.log und performance-129-local-after-metrics.json. Synthetisch: 50.000 Buchungen, zehn Konten, 100 Kategorien, 36 Monate, 1.000 SharedExpenses. `pnpm typecheck`, `pnpm lint`, Dokumentationsvalidator, seine drei Tests und Whitespaceprüfung. Issue erst nach allen erfüllten Kriterien schließen; aktueller Commit und konkrete CI-/Umgebungswerte werden dort rückgelesen.
