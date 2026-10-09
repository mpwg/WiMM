# Lokale Rust-Verträge

SPDX-License-Identifier: AGPL-3.0-or-later

Lokale AR02-Vertragsquelle: StorageVersions, StorageMigrationStep/-Plan, ApplicationScope und EncryptedBackupReceipt. Kein ORM-Entity, keine Finanzregel, kein Speicherzugriff und keine ausgeführte Migration. Private/lokale/öffentliche Bindings und Storage-/Fach-/Crypto-/Exportdimensionen bleiben getrennt. Vollständige Snapshot-/Aggregat-/Entwurfs-/Projektions-/Portformen in storage.rs, ports.rs und storage_port.rs; deren bisherigen Wire-/Storageformate bleiben maßgeblich und unverändert.

Die neutrale Recorddeklaration in wimm-contract-primitives erzeugt eine einzige Feldliste für Serde/Schemars/UniFFI/Tsify. Dieselbe Validate-Schnittstelle führt bei Deserialisierung und typisierten Formeinstiegen die vorhandenen Vorwärts-/Lückenlosigkeitsprüfungen aus. Nummern und Zwischenwerte werden über i128 verglichen; sichere Zahlgrenzen stammen aus denselben neutralen Konstanten/Visitoren. Lokale Scalarbrands liefern an nativen Grenzen ausdrücklich LocalContractError mit Bindingversion zwei und code/detail; keine Meldungsanalyse oder untypisierte Laufzeitfehler.

`validate_local_migration_form_v2` liefert formValid oder INVALID_LOCAL_CONTRACT. Es prüft ausschließlich die Form und Relationen eines Migrationsplans, weder registrierte SQL-Schritte noch Backup-/Commit-/Persistenzzustände. Profile/Finanzrevision/Sitzungsgeneration haben getrennte Felder. Standardschemas können arithmetische Vorwärts-/Folgenrelationen nicht allein ausdrücken; der Manifest verlangt ergänzende Rust-Validierung, die Serde und native/WASM-API automatisch ausführen. Vier strukturkonforme Negativfälle belegen diese Grenze.

```sh
cargo test --locked -p wimm-local-contracts
pnpm test:contracts:local
pnpm test:contracts:local:native
pnpm check:core
```

20 gemeinsame synthetische Migrationsorakel vergleichen Zod-Bestand, native Rust-Assertions, tatsächliches unabhängiges lokales WASM/Node und Chromium. Swift/Kotlin: vier gültige native API-Aufrufe, 16 vorgeschaltete Formablehnungen und acht zusätzliche direkt veränderte Sprachobjekte; insgesamt zwölf tatsächliche native API-Aufrufe. Obere sichere Grenzen, Lücken, falsche Ausgangsversionen, Rückwärts-/No-op-Schritte, null/Strings/Brüche/Überläufe, Zusatzfelder und leere Schritte geprüft. Neue negative CI-Quellendriftprüfung verändert vorübergehend eine lokale Statusvariante und verlangt Ablehnung ohne Überschreiben; Quelle in finally wiederhergestellt.

Die Default-Abhängigkeit enthält Serde, neutrale Primitive und öffentliche/private Rust-Datenformen; keine Finanzhandler, Plattformruntime oder ORM. Optionale vorhandene Generatoren unverändert gesperrt; eigene compilerseitige und Cargo-unsafe-Sperren gelten. [Versionierte lokale Dateien](../../packages/contracts/generated/local-v2/README.md), [AR02 #116](https://github.com/mpwg/WiMM/issues/116). Vollständige Vertragsabnahme und Grenzen im AR02-Snapshot; produktive Adapter/DAO-/Rust-Anwendungsumschaltung folgen in den abhängigen Paketen.

`roundtrip_local_snapshot_v2` liefert unveränderten Snapshot mit versionierter Hülle; Native und Serde erhalten flache gespeicherte Aggregate. LegacyJson ist bewusst opak (WASM unknown, nativ JSONstring), keine JSON-Fachbefehlsausführung. `validate_local_port_form_v2` nimmt elf vollständig typisierte Portanfragen ohne Backendausführung an. 40 Snapshotorakel plus sieben direkte Native-Negativfälle, 15 Portorakel plus zwei direkte Native-Negativfälle; echte Laufzeiten über `pnpm test:contracts:snapshot:native` / `:ports:native`, Gesamtprüfung `pnpm test:contracts:acceptance`.
