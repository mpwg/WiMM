# Generierte lokale Verträge — Binding V2

Eigene Rust-Quelle AGPL-3.0-or-later, Generatorhinweise und Fremdlizenzen unverändert. [Lokale Rust-Quelle](../../../../crates/local-contracts/README.md): bestehende Port-/Migrationsmetadaten, strukturierte lokale Formfehler und formValid-Ausgabe. Kein Speicherbackend oder bereits migrierter Produktbestand.

Native Modelle in WiMMLocalTypes/org.wimm.localcontracts; TypeScript entsteht aus einem unabhängigen lokalen WASM-Build. 30 Struktur-/Fehlerschemas und Manifest verweisen ausdrücklich auf ergänzende relationale Rust-Validierung. Die normale Generierung vergleicht private/public/local Dateien getrennt und ohne Umschreiben. Bei einem privaten Ausgabeverzeichnis verwenden public-v2 und local-v2 dessen Geschwisterverzeichnisse.

`pnpm test:contracts:local` und `pnpm test:contracts:local:native` prüfen denselben synthetischen Migrationskatalog und echte Laufzeiten. Der lokale Source-Drifttest stellt die Quelle automatisch wieder her und prüft unveränderte versionierte Hashes. Vollständige lokale Snapshot-/Entwurfs-/Projektions-/Port-/Kompatibilitätsformen sind ergänzt und in der AR02-Kriterienmatrix belegt; produktive Speicheradapter und Clientumschaltung gehören zu späteren Paketen.

AR03 ergänzt die Rust-abgeleitete sichere StorageFailure-Hülle und roundtrip_storage_failure_v2 ohne ausgeführten Write. Versions-/Statusrelation durch Rust-Guard; unbekannte Fehlercodes werden am Client konservativ behandelt.
