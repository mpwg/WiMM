# Lokaler Rust-DAL — Vertragsreferenz DAL02

SPDX-License-Identifier: AGPL-3.0-or-later

`MemoryStorage<V>` implementiert dieselben elf `LocalStoragePort`-Methoden aus wimm-local-contracts, zusätzlich die begrenzten `LocalIndexQueryPort`-Abfragen und den versionierten `LocalCommitPort`. Profile und sichere Schlüsselablage bleiben eigene Plattformports. Die Produktionsabhängigkeiten enthalten ausschließlich Datenformen, Serde und SHA-256; Finanzhandler werden nur im Test als Snapshotvalidator injiziert. Eine Instanz gehört genau einem Profil, Bereichsdaten werden getrennt gehalten.

Atomare Änderungen entstehen auf einer Kopie des Zustands und werden erst nach sämtlichen Guards veröffentlicht. CAS vergleicht erwartete Revisionen; Doppelhandles innerhalb eines Batches, fremde Bereiche/Epochen, ungültige Cursor und ungültige Snapshotformen werden abgewiesen. Bestätigungen, ursprüngliche opake Entwürfe, Outbox, Projektionen und Cursor bleiben eigenständige Speicherteile. Projektionen werden aus bereits im Fachkern berechneten Daten ersetzt; der DAL berechnet keine Geldwerte. Der Neuaufbau vergleicht den vollständigen Ausgangsbestand vor dem atomaren Ersatz.

Snapshotersatz benötigt zwingend `SnapshotValidationPort`: die gemeinsame Clientanwendung muss darüber Fach- und Cacheprüfung im Fachkern ausführen. Lokale strukturelle Guards ersetzen diese Prüfung nicht. Der native Testadapter führt die tatsächlichen Fachkern-/Cacheprüfungen aus. Logische Storageversionen eins und zwei bleiben beim Rundlauf erhalten; Memory führt keine physische Migration aus. Migrationsplan, Originalsnapshot und bestätigtes verschlüsseltes Backup sind weiterhin über die getrennten Vertragsports modelliert.

`LocalOperationIdentity` bindet Operationsvertragsversion eins, Profil, Bereich, Epoche und Operations-ID. Der Memoryadapter bindet dazu den vollständigen typisierten Request: SHA-256 über dessen Serde-JSONbytes, inklusive CAS, Aggregate, Originalentwürfe und Projektionen. Identischer Request liefert das ursprüngliche Receipt; abweichender Inhalt derselben Identität liefert `OPERATION_ID_REUSED`. Diese lokale Hashrepräsentation ist kein öffentliches Signatur-/JCSformat. Ein Receipt enthält den tatsächlichen Hash und die geschriebenen Revisionen.

Die ausdrücklich benannten Memory-Fehlerinjektionen prüfen Fehler vor Veröffentlichung und Antwortverlust nach erfolgreichem Commit. Bei Antwortverlust meldet `commit` unknown; `lookup_result` findet dasselbe Receipt. Eine neue Instanz besitzt keinen alten Zustand und kein Receipt. Dauerhafte SQLite-/OPFS-Receipts, Prozessabsturz, Wiederanlauf und reale Datenbankfehler müssen die folgenden Pakete nachweisen; Memory ist dafür kein Ersatzadapter und kein stiller Produktfallback.

Die drei Referenzabfragen scannen Memorydaten, erhalten Tombstone-, Bereichs-, Datums-/Handlecursor-, Pendingstatus- und Importquellensemantik und begrenzen Ergebnisse auf 1–1.000. Daraus folgt kein SQLindex- oder Leistungsnachweis.

```sh
cargo test --locked -p wimm-local-dal -p wimm-local-contracts -p wimm-persistence-contracts
cargo clippy --locked -p wimm-local-dal -p wimm-local-contracts -p wimm-public-contracts -p wimm-persistence-contracts --all-targets --all-features -- -D warnings
cargo check --locked -p wimm-local-dal --target wasm32-unknown-unknown
pnpm check:core
pnpm test:target:architecture
pnpm test:contracts:local
pnpm test:contracts:public
pnpm test:contracts:ports:native
pnpm test:contracts:public:native
```

[Kriterienmatrix und aktueller Beleg](../../docs/dal02-contracts.md), [DAL02 #107](https://github.com/mpwg/WiMM/issues/107). Physische lokale Persistenz und Anwendungen folgen der unveränderten Reihenfolge in [#114](https://github.com/mpwg/WiMM/issues/114).
