# @wimm/desktop

Native WhereIsMyMoney-App mit Tauri 2 und gebündelter React-Finanzansicht. Der lokale Betrieb benötigt keinen Server. Fachbefehle kommen aus dem gemeinsamen Fachkern; SQLite schreibt vollständige Batches atomar.

## Bedienung und Systemports

Datei, Bearbeiten, Ansicht und Hilfe sind Systemmenüs; macOS ergänzt Appaktionen. Neue Buchung und Suche verwenden Cmd/Ctrl+N/F. Cmd/Ctrl+Z und Umschalt+Cmd/Ctrl+Z bedienen außerhalb von Textfeldern die revisionsgeprüfte Finanzhistorie; Ctrl+Y ergänzt Redo. In Textfeldern bleibt die Bearbeitung einschließlich Undo/Redo im WebKit-/Systemtexteditor. Neue Buchung und Navigation beachten ungespeicherte Eingaben und offene Dialoge. Gesperrte Tresore bieten keine Finanzmenüaktionen.

„Datei importieren …“ im Dateimenü beziehungsweise Cmd/Ctrl+I öffnet die P5-Importansicht. „Importdatei auswählen“ verwendet den nativen Öffnendialog; CSV/CAMT.053/OFX/QFX laufen im gebündelten Worker, bestätigte Gruppen werden in SQLite gespeichert. Speichern bleibt ein vorbereiteter Port für die P10-Sicherung. Die Rust-Brücke zeigt selbst den Systemdialog und verarbeitet ausschließlich die bestätigte Datei. Sie akzeptiert keinen Pfad aus JavaScript. Abbruch liefert keine Dateien beziehungsweise schreibt nichts. Importgrenzen sind 25 MiB je Datei, höchstens zehn Dateien und 50 MiB insgesamt; die native Ausgabegrenze beträgt 32 MiB. Speichern schreibt zunächst eine temporäre Datei im bestätigten Verzeichnis und ersetzt das Ziel erst nach erfolgreichem Schreiben und Synchronisieren; Fehler werden an den Aufrufer zurückgegeben. Pfade verlassen die Rust-Brücke nicht. Browseralternativen stehen in `@wimm/ui` bereit.

Hilfe und Lizenz öffnen HTTP-/HTTPS-Links ohne eingebettete Zugangsdaten im Systembrowser. Andere Schemata, entfernte Navigation und zusätzliche Webviewfenster sind gesperrt. Produktion lädt nur Appassets; die Entwicklungsorigin ist ausschließlich im Entwicklungsbuild erlaubt. Die Hauptfenster-Capability erlaubt nur Ereignisabonnement sowie katalogisierte Speicher-/Plattformkommandos. Es gibt keine allgemeine Datei-, SQL-, Shell-, Dialogplugin- oder Openerplugin-Berechtigung. OS-Tokenspeicherung folgt P8; Tokens bleiben aktuell flüchtig.

Verschlüsselte lokale Migrationssicherungen verwenden eine separate SQLite-Datei wimm-backups.sqlite3. Der native Port bestätigt FULL-Commit und Rücklesen und bindet unveränderliche Backup-IDs an Profil, Bereich, Epoche und Snapshot-Hash. Finanzbestand und Verschlüsselung bleiben getrennt; der Aufrufer liefert bereits verschlüsselten Inhalt. [Speicherports und Prüfungen](../../packages/storage/README.md), [historischer #82-Abnahmesnapshot](https://github.com/mpwg/WiMM/blob/84d730cc6e10d70cf6ac6ff9bc28c4a9c4376e92/docs/handoffs/migration-2026-10-09.md). Der registrierte Indexschritt samt Originalvergleich und Journal ist inzwischen [gemeinsam abgenommen](https://github.com/mpwg/WiMM/blob/84d730cc6e10d70cf6ac6ff9bc28c4a9c4376e92/docs/handoffs/storage-index-migration-2026-10-09.md). Die produktive Startkoordination folgt mit K05. Native Migration läuft als abbrechbarer Hintergrundjob; ein bestätigter Commit bleibt bei verspätetem Abbruch erfolgreich.

## Entwicklung und Prüfung

Aus der aktiven Repository-Arbeitskopie:

```sh
pnpm --filter @wimm/desktop dev
pnpm --filter @wimm/desktop build
pnpm check:rust
WIMM_CLIENT=desktop pnpm exec playwright test tests/ui/p4-5.spec.ts --config tests/ui/desktop.config.ts
```

Die Browserprüfung verwendet den ausdrücklich vorgesehenen IndexedDB-Testfallback. Die echte native Abnahme ist in der [P4.5-Kriterienmatrix](https://github.com/mpwg/WiMM/blob/84d730cc6e10d70cf6ac6ff9bc28c4a9c4376e92/docs/handoffs/p4-5.md) getrennt dokumentiert.

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

Der ergänzende AX-Treiber füllt synthetische Textfelder mit Systemtastatureingaben und wählt echte WebKit-Auswahlfelder. Er verändert keine Fachdaten direkt. Die beobachteten Offline-Neustart- und Disk-full-Läufe stehen mit Plattform, Testvolume und Grenzen in der [P4.6-Übergabe](https://github.com/mpwg/WiMM/blob/84d730cc6e10d70cf6ac6ff9bc28c4a9c4376e92/docs/handoffs/p4-6.md). Ein begrenztes Testvolume muss ausschließlich den getrennten Testdatensatz aufnehmen; produktive Appdaten dürfen dafür nicht verwendet werden. Nach dem Lauf App beenden, Testprofilpfad wiederherstellen und Testvolume aushängen. Abschließend ohne Testvariablen bauen.

## Importabnahme P5

Die [native P5-Teilmatrix](https://github.com/mpwg/WiMM/blob/84d730cc6e10d70cf6ac6ff9bc28c4a9c4376e92/docs/handoffs/p5-native.md) belegt Systemmenü, echten Öffnendialog, Worker unter unveränderter Produktions-CSP, SQLite-Gruppencommit, erhaltene Empfängernamen sowie echten Offline-Neustart und Sperrprüfung auf macOS arm64. Der Prüf-Identifier und Profilstore trennen synthetische Daten vom Produktprofil. Zusätzlich sind 10.000-Zeilen-Vorschau, Teilübernahme, tatsächliche Disk-full mit unverändertem gesamten SQLite-Stand und Wiederaufnahme nach Offline-Neustart geprüft. Weitere Plattformen und physische Geräte bleiben in der [Gesamtmatrix](https://github.com/mpwg/WiMM/blob/84d730cc6e10d70cf6ac6ff9bc28c4a9c4376e92/docs/handoffs/p5.md) offen; Browserprüfungen ersetzen diese Belege nicht.

## Oberfläche nach dem UX-Flow

Die gemeinsame Oberfläche übernimmt Grünakzent, warme Flächen, die Wortmarke „WiMM.“ und ruhige Listen aus dem freigegebenen klickbaren Konzept. „Alles im Blick.“ zeigt den echten **Kontostand gesamt**, letzte Buchungen, fällige Zahlungsvorschläge und Monatswerte. Desktop verwendet eine Seitenleiste mit separatem Bereichskopf; mobil bleiben Übersicht, Buchungen und die eigene Mehr-Ansicht erreichbar. Einstellungen enthalten Verwaltung und Farbschema. Tresor, Rettungscode und erstes Konto bilden den geführten lokalen Einstieg.

Buchungen und Konten werden über geschützte Dialoge bearbeitet; mobil füllen diese den Bildschirm. Import führt durch vier ausdrücklich bestätigte Schritte. Budget, Teilen und Familienausgleich sind weiterhin spätere Fachpakete. Es werden keine simulierten Konzeptdaten übernommen. Prüfung: `pnpm test:ux`; aktuelle Belege und offene Plattformprüfungen stehen in der UX-Übergabe.

Historische UX-Abnahme vom 5. Oktober 2026: [Kriterien und Prüfbelege](https://github.com/mpwg/WiMM/blob/84d730cc6e10d70cf6ac6ff9bc28c4a9c4376e92/docs/handoffs/ux.md). Die Oberfläche ist implementiert; aktuelle Gesamtabnahme bleibt offen; vollständige Geräte-/Screenreader- und weitere native Plattformbelege sowie die gesamte Zoommatrix sind noch offen.

## Architekturstand vom 9. Oktober 2026

Bestand und Ziel sind getrennt: [gemeinsame Rust-Architektur](../../docs/architecture.md). Hier dokumentierte Funktionen und Arbeitsregeln beziehen sich auf den Bestand; neue Rust-Anwendungs-/DAL-/Serverumstellung ist noch nicht implementiert. Aktuelle Aufträge und Kriterien in tasks.md/GitHub; historische Belege ersetzen keine Zielabnahme.

## DAL03 — Native Runtimeports

Die konkrete Rust-Plattformanbindung in `src-tauri/src/runtime_storage.rs` verbindet dieselbe gemeinsame `ClientRuntime` mit dem vollständigen profilgebundenen ORM-DAL, dauerhaften Originalreceipts und echtem privatem SQLite-RecoveryTicket. Mutationlesestand und lokale Schreibepoche werden konsistent gelesen; Serverepoche und Cursor werden nicht als lokale Scopewerte verwendet. Bereits entsperrte Schlüssel kommen vom Client-Keyport. Öffnen verlangt aktiviertes physisches Schema vier und migriert nicht automatisch.

Sechs native Integrationsfälle plus tatsächlicher Child-Probe prüfen Commit/Undo/Redo, simulierter Antwortverlust nach echtem Commit, echter Prozesswiederanlauf mit Originalentschlüsselung ohne Finanzreplay, falscher Schlüssel/Writesperre, Profil-/Ticketnegativfälle und getrennte lokale/Serverepochen. [Aktuelle Matrix und Befehle](../../docs/dal03-native.md). Die normale Tauri-Compilation enthält die Ports; der produktive Kommandokatalog/Startpfad wird damit noch nicht aktiviert. Vollständige Umschaltung/Konformität bleibt [#108](https://github.com/mpwg/WiMM/issues/108), Entfernung produktiver TS-Commitduplikate [#119](https://github.com/mpwg/WiMM/issues/119).

## DAL03 — ORM-Finanzcommands

Die elf katalogisierten Finanzspeichercommands verwenden jetzt den gemeinsamen ORM-DAL. Die bisherigen IPC-Namen und V1-Bestandsformen bleiben erhalten; bestehende Dateien werden nicht automatisch umgebaut. Ausschließlich frische leere Dateien erhalten den registrierten DSL-Initialstand. Historische Originalentwürfe mit flachen Handles und obsolete technische Cachearten bleiben im gekapselten V1-Kompatibilitätspfad erhalten; typisierte Snapshot-/Restoreguards bleiben streng.

18 unveränderte gemeinsame Snapshot-/Neuaufbau-/Merge-/Versionsfälle laufen gegen echte SQLite über einen ausdrücklich ausgewählten ORM-Driver. `pnpm test:storage:native` enthält diesen Zielkatalog zusätzlich zu den bestehenden Fällen. Vollständige Schema-/Indexcommand- und Chiffratspeicherablösung sowie #108-Gesamtabnahme bleiben offen; die TS-Commitkoordination wird erst gemäß #119 umgestellt. [Aktueller Snapshot](../../docs/dal03-native.md).
