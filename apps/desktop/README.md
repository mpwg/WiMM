# @wimm/desktop

Native WhereIsMyMoney-App mit Tauri 2 und gebündelter React-Finanzansicht. Der lokale Betrieb benötigt keinen Server. Fachbefehle kommen aus dem gemeinsamen Fachkern; SQLite schreibt vollständige Batches atomar.

## Bedienung und Systemports

Datei, Bearbeiten, Ansicht und Hilfe sind Systemmenüs; macOS ergänzt Appaktionen. Neue Buchung und Suche verwenden Cmd/Ctrl+N/F. Cmd/Ctrl+Z und Umschalt+Cmd/Ctrl+Z bedienen außerhalb von Textfeldern die revisionsgeprüfte Finanzhistorie; Ctrl+Y ergänzt Redo. In Textfeldern bleibt die Bearbeitung einschließlich Undo/Redo im WebKit-/Systemtexteditor. Neue Buchung und Navigation beachten ungespeicherte Eingaben und offene Dialoge. Gesperrte Tresore bieten keine Finanzmenüaktionen.

„Datei importieren …“ im Dateimenü beziehungsweise Cmd/Ctrl+I öffnet die P5-Importansicht. „Importdatei auswählen“ verwendet den nativen Öffnendialog; CSV/CAMT.053/OFX/QFX laufen im gebündelten Worker, bestätigte Gruppen werden in SQLite gespeichert. Speichern bleibt ein vorbereiteter Port für die P10-Sicherung. Die Rust-Brücke zeigt selbst den Systemdialog und verarbeitet ausschließlich die bestätigte Datei. Sie akzeptiert keinen Pfad aus JavaScript. Abbruch liefert keine Dateien beziehungsweise schreibt nichts. Die aktuelle Portgrenze ist 32 MiB je Datei. Speichern schreibt zunächst eine temporäre Datei im bestätigten Verzeichnis und ersetzt das Ziel erst nach erfolgreichem Schreiben und Synchronisieren; Fehler werden an den Aufrufer zurückgegeben. Pfade verlassen die Rust-Brücke nicht. Browseralternativen stehen in `@wimm/ui` bereit.

Hilfe und Lizenz öffnen HTTP-/HTTPS-Links ohne eingebettete Zugangsdaten im Systembrowser. Andere Schemata, entfernte Navigation und zusätzliche Webviewfenster sind gesperrt. Produktion lädt nur Appassets; die Entwicklungsorigin ist ausschließlich im Entwicklungsbuild erlaubt. Die Hauptfenster-Capability erlaubt nur Ereignisabonnement sowie sieben benannte Appcommands. Es gibt keine allgemeine Datei-, SQL-, Shell-, Dialogplugin- oder Openerplugin-Berechtigung. OS-Tokenspeicherung folgt P8; Tokens bleiben aktuell flüchtig.

## Entwicklung und Prüfung

Aus der aktiven Repository-Arbeitskopie:

```sh
pnpm --filter @wimm/desktop dev
pnpm --filter @wimm/desktop build
pnpm check:rust
WIMM_CLIENT=desktop pnpm exec playwright test tests/ui/p4-5.spec.ts --config tests/ui/desktop.config.ts
```

Die Browserprüfung verwendet den ausdrücklich vorgesehenen IndexedDB-Testfallback. Die echte native Abnahme ist in der [P4.5-Kriterienmatrix](../../docs/handoffs/p4-5.md) getrennt dokumentiert.

Ein gesonderter Prüfbuild bindet über `VITE_WIMM_NATIVE_SMOKE=1` das synthetische Portpanel ein. Der gewöhnliche Build enthält es nicht. Ein separater Identifier und ein eigener Profilstore-Schlüssel halten diesen Test von Produktprofilen getrennt:

```sh
VITE_WIMM_NATIVE_SMOKE=1 pnpm --dir apps/desktop exec tauri build --config '{"identifier":"at.mpwg.wimm.p45smoke"}'
mkdir -p .toolchain-checks/p4-5
swiftc tests/native/macos-ax.swift -o .toolchain-checks/p4-5/ax
```

Der AX-Treiber benötigt macOS-Bedienungshilfenzugriff; er kann ausschließlich die laufende Test-App über ihre echten Oberflächenelemente bedienen. Nach der Prüfung erneut ohne die Testvariable bauen. Das Testpanel nutzt die tatsächlichen Datei-/Linkports und prüft zusätzliche abgewiesene IPC-Aufrufe; es importiert und exportiert keine Finanzdaten.

## Persistenzabnahme P4.6

Der native Prüfbuild kann zusätzlich einen ausdrücklich getrennten Profilstore-Schlüssel erhalten:

```sh
VITE_WIMM_NATIVE_SMOKE=1 VITE_WIMM_NATIVE_SMOKE_PROFILE=wimm/p4-6-native-profile/v1 pnpm --dir apps/desktop exec tauri build --config '{"identifier":"at.mpwg.wimm.p46smoke"}'
mkdir -p .toolchain-checks/p4-6
swiftc tests/native/macos-acceptance.swift -o .toolchain-checks/p4-6/input
```

Der ergänzende AX-Treiber füllt synthetische Textfelder mit Systemtastatureingaben und wählt echte WebKit-Auswahlfelder. Er verändert keine Fachdaten direkt. Die beobachteten Offline-Neustart- und Disk-full-Läufe stehen mit Plattform, Testvolume und Grenzen in der [P4.6-Übergabe](../../docs/handoffs/p4-6.md). Ein begrenztes Testvolume muss ausschließlich den getrennten Testdatensatz aufnehmen; produktive Appdaten dürfen dafür nicht verwendet werden. Nach dem Lauf App beenden, Testprofilpfad wiederherstellen und Testvolume aushängen. Abschließend ohne Testvariablen bauen.

## Importabnahme P5

Die [native P5-Teilmatrix](../../docs/handoffs/p5-native.md) belegt Systemmenü, echten Öffnendialog, Worker unter unveränderter Produktions-CSP, SQLite-Gruppencommit, erhaltene Empfängernamen sowie echten Offline-Neustart und Sperrprüfung auf macOS arm64. Der Prüf-Identifier und Profilstore trennen synthetische Daten vom Produktprofil. Zusätzlich sind 10.000-Zeilen-Vorschau, Teilübernahme, tatsächliche Disk-full mit unverändertem gesamten SQLite-Stand und Wiederaufnahme nach Offline-Neustart geprüft. Weitere Plattformen und physische Geräte bleiben in der [Gesamtmatrix](../../docs/handoffs/p5.md) offen; Browserprüfungen ersetzen diese Belege nicht.

## Oberfläche nach dem UX-Flow

Die gemeinsame Oberfläche übernimmt Grünakzent, warme Flächen, die Wortmarke „WiMM.“ und ruhige Listen aus dem freigegebenen klickbaren Konzept. „Alles im Blick.“ zeigt den echten **Kontostand gesamt**, letzte Buchungen, fällige Zahlungsvorschläge und Monatswerte. Desktop verwendet eine Seitenleiste mit separatem Bereichskopf; mobil bleiben Übersicht, Buchungen und die eigene Mehr-Ansicht erreichbar. Einstellungen enthalten Verwaltung und Farbschema. Tresor, Rettungscode und erstes Konto bilden den geführten lokalen Einstieg.

Buchungen und Konten werden über geschützte Dialoge bearbeitet; mobil füllen diese den Bildschirm. Import führt durch vier ausdrücklich bestätigte Schritte. Budget, Teilen und Familienausgleich sind weiterhin spätere Fachpakete. Es werden keine simulierten Konzeptdaten übernommen. Prüfung: `pnpm test:ux`; aktuelle Belege und offene Plattformprüfungen stehen in der UX-Übergabe.
