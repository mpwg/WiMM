# #82 — Native verschlüsselte Sicherung

Abnahmesnapshot vom 9. Oktober 2026 auf main, Ausgangscommit `3ce60d6`. Fortschritt und offene Kriterien stehen in [#82](https://github.com/mpwg/WiMM/issues/82). Die [Vorbereitung vom 8. Oktober](migration-2026-10-08.md) bleibt als historischer Beleg erhalten.

## Ergebnis

Der native Sicherungsport ergänzt den vorhandenen Browser-Chiffratspeicher. Rust schreibt Chiffrat und Belegmetadaten in eine eigene SQLite-Datei wimm-backups.sqlite3, getrennt vom Finanzbestand. Der feste Tauri-Port bietet nur Persistieren und Lesen anhand eines vollständigen Belegs; Pfade und SQL sind keine Clientparameter. Unbekannte Sicherungsversionen werden vor Initialisierung/Schreibzugriff abgewiesen.

Rust verlangt mindestens synchronous=FULL, einen erfolgreichen atomaren Commit und identisches Rücklesen. Die TypeScript-Brücke prüft zusätzlich vollständigen Belegkontext und Bytegleichheit der IPC-Rückgabe. Backup-IDs sind unveränderlich; Profil, Bereich, Epoche und Snapshot-Hash binden jede Sicherung. Ungültige Hüllen, falscher Kontext, Schreibfehler und abgeschwächte Durability erzeugen keinen bestätigten Beleg. Die bestehende libsodium-Verschlüsselung und ihre Formate bleiben unverändert; keine neue Abhängigkeit. Das globale Rust-Unsafe-Verbot bleibt wirksam.

## Kriterien und aktuelle Belege

| Abschnitt | Status | Beleg |
| --- | --- | --- |
| Nativer dauerhafter Chiffratspeicher | erfüllt | Native Rust-Assertions für Commit, Duplicate-ID ohne Überschreiben, alle fünf Kontextfelder und Bytegleichheit |
| Fehler vor Beleg und unveränderter Originalbestand | erfüllt | Ungültige Hüllen, SQLite-Triggerabbruch, synchronous=OFF, unbekanntes Schema einschließlich bytegleicher Datei nach Wiederöffnung |
| Tatsächlicher Prozessneustart | erfüllt | Rust-Test startet zwei getrennte Rust-Prozesse für Schreiben und Lesen derselben synthetischen SQLite-Datei |
| Authentifizierter P5-Roundtrip über Port und Rust/SQLite | erfüllt | Echter verschlüsselter P5-Snapshot, SHA-256 des kanonischen Ausgangsstands, Rust-Prozessneustart, vollständige Entschlüsselung, falscher Schlüssel/Kontext und Duplicate-ID; Finanzbestand bleibt identisch |
| Paketdokumentation | erfüllt | Neue Speicher-README und ergänzte Desktop-README erklären Ports, Prüfungen und Grenzen |
| Vollständige #82-Migration | offen | Registrierte nummerierte Schritte, atomarer Ausgangsstandsvergleich und dauerhafter Migrationsjournalstand in beiden Adaptern sind noch nicht angeschlossen |
| Tauri-GUI, physische Disk-full/Stromausfall | nicht prüfbar in diesem Abschnitt | Keine solche Bedienungs-/Geräteprüfung ausgeführt; SQLite-Triggerfehler ist ausdrücklich synthetisch |

Prüfbefehle: pnpm check:rust (20 bestanden; zwei gesondert aufgerufene Prozess-/Katalogtreiber), pnpm test:storage:native (21 bestanden), pnpm test:storage (17 Pakettests und 12 Snapshot-/Neuaufbautests), pnpm typecheck, pnpm lint, pnpm check:package-graph, pnpm check:core:architecture und pnpm check:docs. Native Prüflogs stehen unter test-results/migration-native-backups-rust.log und test-results/migration-native-backups-contract.log. Plattform: macOS 27.0.1 arm64, Node 26.10.0, pnpm 12.8.1, Rust 1.99; ausschließlich synthetische Daten und Schlüssel. Kein vollständiger CI-/Produktionsbuild oder nativer GUI-Lauf als Abnahme behauptet.

## Fortsetzung

#82 bleibt offen. Nächster Abschnitt: registrierte Vorwärtsschritte samt journalisiertem atomarem Vergleich des vollständigen Ausgangssnapshots in SQLite und IndexedDB mit Prüfung des tatsächlich gespeicherten Sicherungsbelegs. Danach die vereinbarten Index-/Persistenz-/Referenzkriterien und gemeinsame Adapterabnahme fortsetzen. Fortschritt weiterhin direkt im Issue führen.
