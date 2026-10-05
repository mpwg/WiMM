# P5 — native macOS-arm64-Prüfung

Die echte gebündelte Tauri-Release-Laufzeit wurde am 5. Oktober 2026 auf macOS 27.0.1 (26A434), arm64, mit SQLite geprüft. Die Empfängerkorrektur wurde anschließend mit einem neuen Import bis zur Buchungsdetailansicht geprüft. Der letzte Wiederanlaufbuild enthält diese Korrektur, ImportBatch-Härtungen und `cargo fmt`. SHA-256 des isoliert kopierten Binarys `.toolchain-checks/p5/wimm-desktop`: `9286cab3dc77bc8375dc1b70d01a05c968d6ebcf18b4afd9f8dcfcdcd52a21ea`; letzter Offline-Wiederanlauf geprüft um 14:13 Uhr MESZ. Keine Veröffentlichung.

## Kriterienmatrix

| Kriterium | Status | Konkreter Beleg |
| --- | --- | --- |
| Natives Importmenü | erfüllt | Die echte Menüaktion „Datei importieren …“ führt zur Importansicht. `menu-import.txt` wurde zunächst erfasst; nach letztem Build verhindert die Aktion bei gesperrtem Tresor weiterhin jede Finanzansicht (`final-menu-locked.txt`). |
| Tatsächlicher Öffnendialog und folgenloser Abbruch | erfüllt | Betriebssystemsheet „Datei auswählen“ mit Cancel/Open; Cancel lässt Importdatei und Vorschau leer. Bestätigte Auswahl ausschließlich der synthetischen CSV. AX-Hierarchie und Screenshot wurden während des Dialogs gelesen. |
| Importworker unter Produktions-CSP | erfüllt | Release-Assets enthalten eigene Import-/Commitworker. Der CSV-Worker der gebündelten Laufzeit zeigt Datum `2026-10-05`, Betrag exakt `-12,34 EUR`, Empfänger „Prüfladen“ und Notiz. Er funktioniert ebenfalls unter `(deny network*)`; die CSP wurde nicht gelockert. `current-reimport.txt` belegt Vorschau und Dublettenerkennung. |
| Ausdrückliche Vorschauentscheidung und SQLite-Übernahme | erfüllt | Erste Vorschau ohne Buchungsübernahme; nach Entscheidungen `Bereit · 0 / 1`, dann `Abgeschlossen · 1 / 1` und Saldo `-12,34 EUR`. `decisions.txt`, `committed.txt`, `balance.txt`. |
| Offline-Neustart mit dauerhaftem Importzustand | erfüllt | Prozess beendet und neuer Release-Prozess unter `sandbox-exec` mit `(deny network*)` gestartet. Zuerst ausschließlich Sperrbildschirm, nach Passphrase gleicher Saldo und abgeschlossener Batch. `offline-locked.txt`, `offline-balance.txt`, `offline-import.txt`. Nach letztem Build wurde derselbe echte Neustart erneut ausgeführt (`final-locked.txt`, `final-resume.txt`). |
| Wiederimport ohne unbeabsichtigte Doppelbuchung | erfüllt | Wiederimport derselben Quell-ID zeigt „Mögliche Dublette“. Bestätigung ohne Entscheidung meldet „Jede fehlerhafte Zeile und Dublette benötigt eine ausdrückliche Entscheidung.“ Danach ausdrücklich ausgeschlossen und Entscheidungen dauerhaft gespeichert (`duplicate-blocked.txt`). |
| Wiederaufnahme gespeicherter Entscheidung auf aktuellem Stand | erfüllt | Ausschlussbatch übersteht echten Offline-Neustart mit `Bereit · 0 / 1`. Der letzte Prüfbuild übernimmt die Gruppe mit dem Commitworker unter Produktions-CSP und zeigt beide Batches `Abgeschlossen · 1 / 1`; Saldo bleibt `-12,34 EUR`. `final-resume.txt`, `final-completed.txt`, `final-balance.txt`, `final-balance.png`. |
| Gesperrter Tresor verhindert Finanzansicht | erfüllt | Nach erneutem Sperren bleibt auch native Importmenüaktion auf „Tresor entsperren“; keine Importvorschau oder Geldwerte sichtbar (`final-relocked.txt`, `final-menu-locked.txt`). |
| Importierter Empfänger bleibt nach Commit und echtem Offline-Neustart erhalten | erfüllt | Neue CSV mit Quell-ID `p5-native-002`, Betrag `-7,89 EUR`, Empfänger „Neuer Pruefladen“, Notiz „Empfaengerbeleg“. Native Vorschau, Gruppenübernahme und danach Buchungsdetails zeigen denselben Empfänger; Saldo insgesamt `-20,23 EUR`. Neuer Prozess unter Netzwerksperre zeigt zunächst gesperrten Tresor und danach denselben Saldo und denselben Empfänger in Buchungsdetails. `recipient-preview.txt`, `recipient-completed.txt`, `recipient-detail.txt/png`, `recipient-restart-locked.txt`, `recipient-restart-balance.txt`, `recipient-restart-detail.txt`, `recipient-relocked.txt`. |
| Windows, Linux und macOS x86_64 | nicht prüfbar | Keine passenden nativen Laufzeiten in dieser Umgebung. Dieser Lauf ersetzt diese Plattformzellen nicht. |
| Native Großimport-/Disk-full-/Touchabnahme | offen | Dieser Lauf umfasst einen CSV-Einzeilenimport und Wiederimport. Native Großimport-/Disk-full- und physische Touchprüfungen wurden hier nicht ausgeführt; keine Ableitung aus Browserprüfungen. |

## Reproduktion und Grenzen

Der Identifier `at.mpwg.wimm.p5smoke` trennt die SQLite-Datei vom Produktprofil. Der Profilstore-Schlüssel `wimm/p5-native-profile/v1` trennt den WebKit-Tresor. Ausschließlich synthetische Daten und eine synthetische Passphrase wurden verwendet. Die SQLite-Datei wurde nur lesend auf vorhandene dauerhafte Aggregate geprüft; Finanzdaten wurden über echte UI-Befehle erzeugt. Alle GUI-Prozesse der Prüfung sind beendet.

```sh
VITE_WIMM_NATIVE_SMOKE=1 VITE_WIMM_NATIVE_SMOKE_PROFILE=wimm/p5-native-profile/v1 pnpm --dir apps/desktop exec tauri build --config '{"identifier":"at.mpwg.wimm.p5smoke"}'
swiftc tests/native/p5-ax.swift -o .toolchain-checks/p5/p5ax
swiftc tests/native/macos-acceptance.swift -o .toolchain-checks/p5/input
```

Der delegierte Device-Interaction-Skill wurde gelesen und sein Hierarchie-/Screenshotworkflow verwendet. Xcode konnte das Tauri-Repository nicht als Workspace öffnen; daher bedient `tests/native/p5-ax.swift` die tatsächliche macOS-Accessibility-Hierarchie. Er ergänzt den vorhandenen AX-Treiber um die Suche im Appwurzelelement und ScrollToVisible für echte WebKit-Auswahlmenüs. Die Tastatur wird über macOS-Systemereignisse bedient. Übergänge werden vor Folgeaktionen erneut gelesen; fehlende AX-Menüelemente während Animationen wurden nach erneuter Erfassung einmal wiederholt. Der Prüftreiber erzeugt keine Fachdaten außerhalb der Appbefehle.

Lokale Belege liegen unter `.toolchain-checks/p5/` und `test-results/p5-native/`. Frühere Dialog-/Previewbilder unter `test-results/native-p5/` wurden durch gleichzeitig laufende Browserprüfungen gelöscht; deren Beobachtung bleibt hier benannt, sie stehen nicht als dauerhaft erhaltenes Bildartefakt zur Verfügung. Der letzte Screenshots zeigt originale Fensterdekoration, dauerhaften Saldo und das ausschließlich im Prüfbuild eingeblendete Portpanel. Die Ansicht war gescrollt; das Testpanel überlagert den unteren Rand. Im betrachteten Finanzinhalt wurden keine neuen überlappenden oder unlesbaren Texte beobachtet. Dies ist keine vollständige visuelle P4-Abnahme.

README-Zweck, Importbedienung und Prüfbuildbeschreibung werden mit der P5-Gesamtübergabe durch den Hauptagenten aktualisiert. Die Gesamt-Abnahme muss diese native Teilmatrix zusammen mit Fach-, Parser-, Speicher- und UI-Belegen bewerten; sie meldet durch diesen Lauf allein keinen vollständigen P5-Abschluss.

## Nachprüfung der Empfängerkorrektur

Der erste Empfänger-Prüfbuild hatte Hash `4239028b5c3a7d24d78bb3b866e33272f5084d090d4d3a56a1e0b2d80171f312`; unter Netzwerksperre wurden damit Vorschau, neue Übernahme und Buchungsdetails geprüft. Vor dem anschließenden Neustart hatte die parallele Gesamtprüfung den gemeinsamen Releasepfad mit einem gewöhnlichen Build ersetzt. Dessen Aufruf wurde sofort ohne Entsperrung oder Fachaktion beendet. Der Prüfbuild wurde erneut mit isoliertem Identifier erstellt und sofort in die aktive Repository-Arbeitskopie kopiert; vor Aufruf wurde der Identifier im Binary bestätigt. Dieser letzte Wiederanlauf belegt die dauerhaft gespeicherten neuen Empfängerdaten. Es erfolgte keine Entsperrung oder Bearbeitung eines Produktprofils.
