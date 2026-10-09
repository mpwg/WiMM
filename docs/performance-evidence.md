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
| Aktueller unabhängiger Ubuntu-Nachweis ohne gelockerte Grenze | erfüllt | [CI 37925825424, Leistungsjob 113804387690](https://github.com/mpwg/WiMM/actions/runs/37925825424/job/113804387690) auf 970b913 erfolgreich; beide tatsächlichen Chromium-/IndexedDB-Fälle und unveränderte Orakel bestanden |
| README, Matrix und Tracking aktuell; Clientgrenze klar | erfüllt für Abschnitt | [Prüf-README](../tests/acceptance/README.md), diese Matrix und #129/#57/#114; Desktop-Frontend ausdrücklich kein Tauri-Systemnachweis |

Lokale Logs: test-results/architecture-implementation/performance-129-local-after.log und performance-129-local-after-metrics.json. Synthetisch: 50.000 Buchungen, zehn Konten, 100 Kategorien, 36 Monate, 1.000 SharedExpenses. `pnpm typecheck`, `pnpm lint`, Dokumentationsvalidator, seine drei Tests und Whitespaceprüfung. Issue erst nach allen erfüllten Kriterien schließen; aktueller Commit und konkrete CI-/Umgebungswerte werden dort rückgelesen.


## Vollständige aktuelle Abnahme

Ubuntu x64, tatsächliches Chromium/IndexedDB, AMD EPYC 9V74, 16,77 GB gemeldeter RAM; [unabhängiger Leistungsjob](https://github.com/mpwg/WiMM/actions/runs/37925825424/job/113804387690) auf 970b913 erfolgreich. Artefakt leistungsbelege-50000 vollständig rückgelesen: beide Tests passed, exakter unveränderter Datensatz und alle vier Grenzwerte geprüft. Alle Issuekriterien erfüllt; #129 wird mit diesem Nachweis geschlossen. Der übergreifende Projektjob und die P4-Gesamtabnahme bleiben getrennt.

| Client | Kaltöffnung | Warme Öffnung | Filter-p95 | Scroll-p95 | Zusätzliche Testtreiberzeit |
| --- | --- | --- | --- | --- | --- |
| Web | 1.265,6 ms | 21,4 ms | 50,1 ms | 33,8 ms | 109,3 ms |
| Desktop-Frontend | 1.318,7 ms | 16,9 ms | 50,0 ms | 33,5 ms | 66,5 ms |

Die Browsermarker fehlen vor Öffnung und nach Reload; die tatsächliche vollständige sichtbare Liste wird vor Festhalten des Zeitpunkts geprüft. Kein Retry oder Warmwert-Ersatz. Gesicherte CI-Dateien unter test-results/architecture-implementation/performance-ci-970b913, ausgewertete Werte in performance-ci-970b913-metrics.json. Keine Aussage, dass der alte CI-Lauf die Appgrenze erfüllte, und kein nativer Tauri-/Gerätebeleg.
