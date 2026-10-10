# Gemeinsame lokale Rust-Laufzeitports

SPDX-License-Identifier: AGPL-3.0-or-later

Plattformhost für die gemeinsame Rust-Clientanwendung auf tatsächlicher nativer/WASM-SQLite. `RuntimeStorage` übernimmt genau einen profilgebundenen `SqliteWriter<CoreSnapshotValidator>`. Klone sind Portansichten derselben Verbindung, keine zweite Datenbank oder Commitimplementierung. Native Dateieröffnung und WASM-Verbindungsübernahme bleiben explizite Plattformaufgaben. Finanzvalidierung liegt weiterhin ausschließlich im Fachkern; der technische DAL erhält keinen Fachkernimport.

Die elf lokalen Speicherports, indizierten Abfragen, MutationReadPort, Commit-/Receiptport und das persistente private Originaljournal delegieren an denselben vollständigen DAL. `RuntimeProtection` verwendet den vorhandenen Rust-libsodium-Clientschutz; derselbe Recovery-AAD und Snapshotprotector gelten auf beiden Plattformen. Kein Kryptofallback oder Kompatibilitätsadapter. Drop löscht den vorhandenen SecretKey über dessen Zeroizing-Besitz.

`RuntimeSession` koordiniert die bestehenden versionierten Aktionen Load, Execute, History und Resolve ausschließlich über ClientRuntime. Der aktuelle lokale Schreibepochenscope wird vor dem Aufruf aus dem tatsächlichen DAL gelesen. Finanz-/Undo-/Redo-/Receipt-/Recoverylogik ist nicht im Plattformhost dupliziert. Views sind auf maximal 100 Aggregate begrenzt; falsche Versionen werden vor Writes abgewiesen.

```sh
cargo test --locked -p wimm-local-runtime
cargo clippy --locked -p wimm-local-runtime --all-targets -- -D warnings
cargo build --locked -p wimm-local-runtime --target wasm32-unknown-unknown
```

Die früher im Tauri-Crate enthaltenen nativen Assertions wurden mit der Implementierung hierher verschoben, einschließlich echtem Prozessneustart. Ein zusätzlicher Sitzungstest prüft Version, tatsächliches Receipt, Originaljournal und begrenzte Seite auf realer SQLite. Tauri importiert diesen gemeinsamen Crate. Browserbindungen verwenden dieselben Ports innerhalb des produktiven OPFS-Workers; vollständige PWA-Umschaltung und weitere #109-/#119-Kriterien bleiben offen. [DAL04-Matrix](../../docs/dal04-browser.md).

`RuntimeSessions` begrenzt clientgebundene Sitzungen auf 16, weist Duplicate-IDs/Überfüllung ab und entfernt Schlüssel-/Historienbesitz einzeln oder vollständig. Native echte SQLite-Assertion prüft getrennte Historien, Freigabe und Wiederbelegung; kein gemeinsamer History-/Finanzschlüsselzustand zwischen Peerclients.
