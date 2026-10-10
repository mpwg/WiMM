# DAL02 — Getrennte Rust-Persistenzverträge und Memoryreferenz

Stand: 10. Oktober 2026. [DAL02 #107](https://github.com/mpwg/WiMM/issues/107), Voraussetzungen DAL01/#106, AR02/#116 und AR03/#117 erfüllt. Abnahmecommit [eea3ae8](https://github.com/mpwg/WiMM/commit/eea3ae8a2cf4b8410cc1c3c4f011c4134deb146a) auf main; #107 und #133 als COMPLETED geschlossen, vollständige Beschreibungen und Schließungsgründe rückgelesen. Geprüfter Abschnitt in der aktiven CachyOS-Arbeitskopie Linux x86_64, Rust 1.99.0. [Verträge](core-contracts.md), ADR-054 in [Entscheidungen](decisions.md), [Adapter-README](../crates/local-dal/README.md).

## Kriterienmatrix

| Abnahmekriterium #107 | Umsetzung und konkreter Nachweis |
| --- | --- |
| Keine ORM-Entities, Verbindungen, SQL, Treiber oder freie Ausführungspfade im öffentlichen Port | Öffentliche Ciphertext-/Verwaltungs-/Transaktionsports in wimm-public-contracts/storage_port.rs; ausschließlich öffentliche DTOs, strukturierte Fehler und typisierte Datenmethoden. Native Ablehnung zusätzlicher SQL-/Payloadfelder |
| Fachkern plattformfrei, Server ohne Fachkern/lokalen DAL | AR11 registriert beide neuen Crates mit Rollen-/Feature-/transitiver Closureprüfung. Öffentlicher Vertragsabschluss enthält nur neutrale Primitive/Persistenzverträge; Memory normal nur private/lokale Datenformen, keine Finanzhandler |
| Aggregate/Bestätigungen/Originalentwürfe/Outbox/Projektionen getrennt von öffentlichen Chiffraten/Verwaltung | Bestehende lokale DTOs und elf Ports erhalten, öffentliche Transactionports separat. Memorytests vergleichen unveränderte Originaldrafts und getrennte lokale/bestätigte Revisionen bei atomaren Syncseiten |
| Strukturierte Fehler, drei Commitzustände, CAS und Operations-ID | Generisches neutrales CommitOutcome, konkrete lokale/öffentliche Fehler-/Identitätstypen; CAS, Vorcommitfehler ohne Mutation/Receipt, Antwortverlust mit Receiptabfrage, identischer Wiederholungsrequest und Inhaltsabweichung nativ geprüft |
| Sichere Cent, Finanz-/Crypto-/Speicherformate, Versionierung | Dieselben bestehenden Scalar-/Aggregat-/Snapshottypen, native 14-Arten-/40-Snapshot-/15-Portorakel unverändert. Neue Operationsdimension eins, Bindings zwei/Storage eins und zwei/Fach eins/Crypto unverändert; keine Migration des Produktbestands |
| Memory implementiert dieselben lokalen Ports; native Assertions/Graph | Elf Storageports, drei begrenzte Sekundärreferenzports und Commit-/Lookupport. Zehn tatsächliche native Memorytests; zusätzliche native Vertrags-/Serde-/Fehlertests und WASM-Portabilitätsbuild |
| AR04-Identität/Receipt/Ergebnis versioniert, Module getrennt | Private lokale Identität mit Profil/Bereich/Epoche/ID, SHA-286-Inhaltsbindung und geschriebenen Revisionen; neue lokale Schemas/Swift-/Kotlin-/TSdaten aus Rust. Öffentliche ServerOperationKey bleibt eigene Form |
| Gemeinsame Technik importiert keine private Finanz-/Kryptofunktion in Server | wimm-persistence-contracts ausschließlich neutrale Commit-/Migrationscheckpointdaten. Adapterinterne ORM-/Treiber-/Journalimplementierung folgt später; technische Vertragsbasis benötigt keinen Finanzkern oder Entschlüsselungscrate |

## Ausgeführte Prüfungen

- `cargo test --locked -p wimm-local-dal -p wimm-local-contracts -p wimm-persistence-contracts`: tatsächliche native CAS-/Rollback-/Bereichs-/Epochentests, Receipt-/Antwortverlust-/Inhaltsbindung, Snapshot-/Cacheprüfung mit injiziertem Fachkern, begrenzte Referenzabfragen. 28 zusätzliche gemeinsame positive/negative Formorakel für Identität, Request, Receipt, alle Commitzustände und drei Abfragen; alte Kataloge unverändert.
- `cargo clippy --locked -p wimm-local-dal -p wimm-local-contracts -p wimm-public-contracts -p wimm-persistence-contracts --all-targets --all-features -- -D warnings`; native Rust-/unsafe-/Kernprüfung über `pnpm check:core`.
- `pnpm generate:contracts:bindings`, `pnpm test:contracts:local`, `pnpm test:contracts:public`: reproduzierbare Swift-/Kotlin-/WASM-/Schemas; 37 lokale und 16 öffentliche Formschemas. Neue 28 Formorakel vergleichen AJV2020 mit denselben nativen Rustfällen; vorhandene tatsächliche Node-/Chromiumprüfungen und negative Quelldrift ohne Überschreiben.
- `pnpm test:contracts:ports:native`, `pnpm test:contracts:public:native`: tatsächlich kompilierte/ausgeführte Swift 6.4 und Kotlin 2.4.20/Java 21.0.12.1 auf Linux. Je 15 lokale Portorakel und 14 typisierte native Aufrufe; je 42 öffentliche Orakel und 17 native Aufrufe. Zusätzliche direkt manipulierte Sprachobjekte abgewiesen. Die neuen DTOs werden dabei erzeugt/kompiliert; diese Läufe prüfen die vorhandenen API-Einstiege und führen keinen neuen Datenbankadapter aus.
- `pnpm test:target:architecture`: unveränderte negative Rollen-/Feature-/UI-/unsafe-Grenzen, tatsächliche CLI-Injektion und native Assertionen aller registrierten Pflichtcrates einschließlich neutraler Persistenzverträge und Memoryadapter.
- `cargo check --locked -p wimm-local-dal --target wasm32-unknown-unknown`: reine Referenzbibliothek auf WASM baubar, kein Persistenz-/Browser-VFS-Nachweis.

Der größere tatsächliche Cargo-Metadatenstrom überschritt nach Registrierung der neuen Crates das Node-Standardlimit. [#133](https://github.com/mpwg/WiMM/issues/133) begrenzt ausschließlich den stdout-Puffer des Kernprüfwerkzeugs auf 16 MiB, entsprechend dem vorhandenen AR11-Werkzeug; Architektur-/Fach-/Import-/Zeitlimits unverändert. Reale Kern- und negative Architekturprüfungen belegen die Korrektur.

## Geltungsgrenzen

Memory ist flüchtig, besitzt keine physische SQLmigration, kein Prozessneustart-/Crash-/Quota-/OPFS-/Gerätenachweis und wird nicht produktiv aktiviert. Profile, Schlüsselablage, Backup und Migration bleiben getrennte Ports. Erforderliche Snapshot-Fach-/Cachevalidierung wird vom Client injiziert; der DAL enthält keine Geldberechnung. Projektionen werden vom Fachkern vorbereitet. Lokale Hashbytes sind private Serde-Requestdaten und kein neuer E2EE-/Signaturstandard. Standardschemas ersetzen relationale Rust-Guards (Datumsfolge, UUIDabhängigkeit von Referenzart, Fehlerzustandsrelationen) nicht.

Die gemeinsame technische ORM-/DSL-/Journalbasis, dauerhafte lokale Receipts, native/browser SQLadapter, öffentliche Server-/SQLimplementierung und produktive Umschaltung benötigen ihre eigenen folgenden Nachweise. Keine P6–P11-/Release-/Gesamtarchitekturabnahme aus diesem Abschnitt. Nächster Abschnitt der unveränderten Folge: [AR04 #118](https://github.com/mpwg/WiMM/issues/118).
