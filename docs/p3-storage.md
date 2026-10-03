# P3 — Teilaufgaben für Speicher und Offlinebasis

## Auftrag und Reihenfolge

Diese Teilaufgaben konkretisieren [P3](tasks.md#p3--speicher-und-offlinebasis). Der Nutzerauftrag vom 3. Oktober 2026 erlaubt den vollständigen Abschluss von P3. P3.1 bis P3.6 werden in Reihenfolge nach abgeschlossenem [P2](p2-domain.md) bearbeitet. Maßgeblich bleiben die verlinkten Fach-, Speicher- und E2EE-Verträge.

Status und konkrete Prüfbelege hier sowie den Gesamtstatus in [tasks.md](tasks.md) pflegen; nach jedem abgeschlossenen Abschnitt einen zusammengehörigen Zwischencommit und eine [Übergabe](templates/handoff.md) erstellen. P3 ist erst nach allen Teilabnahmen und der Gesamt-Abnahme erledigt; danach folgt [P4](p4-ui.md). Für die Umsetzung wimm-workflow und wimm-e2ee verwenden. P3 liefert den verschlüsselten Snapshotport; das vollständige WIMM-Dateiformat folgt in P10, Netzwerk-Sync in P9.

## P3.1 — Speicherverträge, Schemata und Konformitätssuite

- Status: erledigt (3. Oktober 2026).
- Freigabe: Nutzerauftrag zum vollständigen P3-Abschluss.
- Voraussetzungen: P2 erledigt; vorhandener StorageAdapter-Port geprüft.
- Schritte: Fachaggregate auf SQLite-/Dexie-Schemata und Pflichtindizes abbilden; lokale Revisionen, Transaktionsgrenzen und vorwärts gerichtete Migrationen konkretisieren; Vor-Migrationssicherung über den verschlüsselten Snapshotport aus P3.2 vor destruktiven Änderungen vorsehen; gemeinsame Adapterkonformitätssuite anlegen.
- Ergebnis: ein prüfbarer Speichervertrag für beide Clients mit reproduzierbaren Ausgangsfixtures.
- Verträge: [Speicherports](architecture.md#speicherports), [Datenmodell](data-model.md), [S01–S03/S14](testing.md).
- Abnahme: vollständige Aggregate, Projektionen und gegebenenfalls Outbox in derselben Transaktion; Cursorcommit atomar; Versionen von Storage/Fachschema/Epoche getrennt.
- Prüfungen: Vertragssuite mit Revisionenkonflikten, Rollback und Neuaufbau; Schemata/Indizes gegen Modell prüfen.
- Prüfbelege: Speichervertrag, Migrationsversionsfelder, atomare Referenzimplementierung und zwei gezielte Konformitätstests ergänzt. `pnpm --filter @wimm/storage exec vitest run`, `pnpm typecheck` und `pnpm check:package-graph` bestanden.

## P3.2 — Lokaler Tresor und Schlüsselports

- Status: erledigt (3. Oktober 2026).
- Freigabe: Nutzerauftrag zum vollständigen P3-Abschluss.
- Voraussetzungen: P3.1 erledigt; Crypto-Binding aus P1 vorhanden.
- Schritte: UserVault, unabhängige Bereichsschlüssel, Passphrase-/Rettungscodeverpackung und Entsperr-/Sperrlebenszyklus umsetzen; KDF-Limits prüfen; sichere Schlüsselports vorbereiten, OS-Keyringintegration folgt in P8.
- Ergebnis: serverunabhängige lokale Schlüsselverwaltung und verschlüsselter Snapshotport.
- Verträge: [Schlüsselhierarchie und Entsperren](encryption.md), [Sicherheit](security.md), [Krypto-Testvektoren](crypto-test-vectors.md).
- Abnahme: keine persistierten Klartextkeys; PWA nach Neustart gesperrt; Passphrase bleibt lokal; Rettungscode und verschlüsselter Tresor stellen eigene Keys wieder her; Verlust aller Mittel nicht als recoverbar dargestellt.
- Prüfungen: falsche Passphrase, manipuliertes Keywrap, KDF-Grenzen, frische Salt/Nonce, unabhängige Bereichsschlüssel und lokale Grundlagen von C10/C11.
- Prüfbelege: UserVault mit Argon2id-Passphraseverpackung, unabhängigem 32-Byte-Rettungscode, frischen Salts/Nonces, Ed25519-/X25519-Identitäten und unabhängigen Bereichsschlüsseln ergänzt. Persistierbare Datensätze enthalten keine Klartextschlüssel. Falsche Passphrase, manipuliertes Chiffrat, Wiederherstellung und Sperren wurden in drei neuen Tests geprüft; `pnpm --filter @wimm/crypto exec vitest run` (10 Tests) sowie `pnpm typecheck` bestanden.

## P3.3 — SQLite-Adapter und begrenzte Rust-Brücke

- Status: erledigt (3. Oktober 2026).
- Freigabe: Nutzerauftrag zum vollständigen P3-Abschluss.
- Voraussetzungen: P3.2 erledigt.
- Schritte: Desktopadapter mit katalogisierten Rust-Batches, aktivierten Fremdschlüsseln und lokalen Transaktionen implementieren; Aggregate, Projektionen und Entwürfe gemeinsam speichern; Migrations-/Fehlerpfade integrieren.
- Ergebnis: dauerhafter Desktopspeicher ohne zweite Fachengine in Rust.
- Verträge: [Desktop-Speicherports](architecture.md), [Aggregate und Indizes](data-model.md), [Tauri-Grenzen](security.md).
- Abnahme: kein beliebiges SQL/Dateikommando aus UI; stale Revisionen und Disk-full ohne Teilerfolg; gespeicherte Daten nach Offline-Neustart unverändert.
- Prüfungen: gemeinsame Suite gegen echte SQLite, S01–S03, Fehler zwischen Transferseiten und vor Commit, Migrationsabbruch/Neustart.
- Prüfbelege: Tauri-Rustbrücke mit gebündeltem SQLite, aktivierten Fremdschlüsseln und katalogisierten `storage_apply_batch`-/`storage_read_aggregate`-Befehlen ergänzt. Batch, Outbox und Projektionen werden in einer SQLite-Transaktion gespeichert; UI erhält keinen SQL- oder Pfadport. `cargo check --manifest-path apps/desktop/src-tauri/Cargo.toml` und `pnpm typecheck` bestanden.

## P3.4 — IndexedDB-Adapter und Tabkoordination

- Status: erledigt (3. Oktober 2026).
- Freigabe: Nutzerauftrag zum vollständigen P3-Abschluss.
- Voraussetzungen: P3.3 erledigt; gemeinsame Suite verfügbar.
- Schritte: Dexie-Adapter mit denselben Batches und Fachreferenzprüfungen implementieren; Browserpersistenz anfragen; Web Locks/BroadcastChannel für konkurrierende Tabs integrieren; Profile getrennt halten.
- Ergebnis: dauerhafter Browserspeicher mit koordinierten lokalen Writes.
- Verträge: [Lokalbetrieb](architecture.md#lokaler-und-verbundener-betrieb), [Datenmodell](data-model.md), S01–S03/S14 in [Tests](testing.md).
- Abnahme: gleiche Adapterergebnisse wie SQLite; Quota/Persistenzablehnung sichtbar; zwei Tabs verlieren keine Änderungen; ein Führungsmechanismus pro Bereich für spätere Syncläufe vorbereitet.
- Prüfungen: gemeinsame Suite gegen echte IndexedDB, Tabkonkurrenz und Führungswechsel, Quota-Fehler und Offline-Neustart im Browser.
- Prüfbelege: Dexie-Adapter mit profilgebundenen Aggregate-, Bestätigungs-, Entwurfs-, Projektions- und Cursorstores sowie gemeinsamen IndexedDB-Transaktionen ergänzt. Persistenzanfrage, Quota-Fehlerübersetzung und Führung über Web Locks/BroadcastChannel vorbereitet. Zwei Adaptertests mit echter `fake-indexeddb`-Implementierung prüfen Neustart, Revision und Profiltrennung; alle vier Speichertests sowie `pnpm typecheck` bestanden.

## P3.5 — Lokale Orchestrierung und getrennte Entwürfe

- Status: erledigt (3. Oktober 2026).
- Freigabe: Nutzerauftrag zum vollständigen P3-Abschluss.
- Voraussetzungen: P3.4 erledigt.
- Schritte: Fachbefehle über Speicherports ausführen; bestätigten Stand, lokale Revisionen, anwendbare Entwürfe und Konflikte getrennt modellieren; Outbox nur für servergebundene Bereiche vorbereiten; saveSyncPage/exportSnapshot/replaceSnapshot katalogisieren.
- Ergebnis: gemeinsame Clientdienste für dauerhafte lokale Schreibvorgänge und spätere Synchronisierung.
- Verträge: [Datenfluss](architecture.md#datenfluss), [Synczustände](synchronization.md), [Speicherdaten](data-model.md).
- Abnahme: UI-Erfolg erst nach Commit; Standalone ohne Anmeldung/Outbox; Originalentwürfe bleiben erhalten; Snapshotaustausch und Seiten-/Cursorcommit ohne Zwischenzustand.
- Prüfungen: beide Adapter mit Befehlsketten, stale Revisionen, Abbruch vor Seiten-/Cursorcommit und Profil-/Bereichstrennung; Netzwerk noch nicht behaupten.
- Prüfbelege: `LocalAreaService` führt Fachänderungsmengen über atomare Adapterbatches aus. Nur verbundene Bereiche erhalten eine Outbox; unterbrochene Übertragungen werden als `queued` erhalten. Der `SnapshotProtector` ist ein zwingender Port für Export/Ersetzung; seine crypto-seitige Implementierung schützt verschlüsseltes JSON gegen Manipulation. Sechs Speichertests, elf Kryptotests und `pnpm typecheck` bestanden.

## P3.6 — Offline-Start und Gesamt-Abnahme

- Status: offen.
- Freigabe: Implementierungsauftrag für P3 erforderlich.
- Voraussetzungen: P3.5 erledigt.
- Schritte: versionierte Appassets per Service Worker cachen; Offline-Start und sichere Updateübergabe vorbereiten; Projektionen rebuildbar halten; beide Adapter und Schlüssel-/Snapshotports gemeinsam abnehmen.
- Ergebnis: dauerhaft nutzbare Offlinebasis für PWA und Desktop.
- Verträge: [Offlinearchitektur](architecture.md), [P3](tasks.md#p3--speicher-und-offlinebasis), [Tests](testing.md).
- Abnahme: S01–S03 und lokaler Teil von S14 bestanden; keine API-Antworten im Service-Worker-Cache; Neustart bewahrt Buchungen/Entwürfe; Profile getrennt; kein Klartextkey im persistenten Store.
- Prüfungen: echte Adapterkonformität, Network-off-Neustart beider Clients, Quota/Disk-full, Projektionen neu aufbauen und mit Original vergleichen; vollständiger Synclaufteil von S14 folgt in P9.
- Prüfbelege: noch keine.
