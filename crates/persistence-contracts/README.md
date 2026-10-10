# Neutrale Persistenzverträge

SPDX-License-Identifier: AGPL-3.0-or-later

DAL02 trennt generische technische Daten von privaten lokalen und öffentlichen Serverdaten. `CommitOutcome<T,E,K>` unterscheidet bestätigten Wert, sicher nicht erfolgten Commit mit strukturiertem Fehler und unklaren Commit mit ursprünglicher Identität. Konkrete Typen werden in wimm-local-contracts beziehungsweise wimm-public-contracts eingesetzt. Keine Finanztypen, privaten Schlüssel, SQLstrings, Pfade, Verbindungen, Treiber oder Runtimeabhängigkeiten.

`MigrationCheckpoint` besitzt getrennte Operations-/Storage-/Fachdimensionen und eine sichere Migrationsnummer. Serde weist unbekannte Operationsdimensionen, Nummern oberhalb der sicheren Ganzzahlgrenze und Version null ab. Diese technischen Checkpointdaten sind keine physische Migration, Registrierung von SQLschritten oder Freigabe eines Backups. Konkrete Ausgangs-/Ziel-/Schritt-/Backupverträge bleiben getrennt lokal/öffentlich.

```sh
cargo test --locked -p wimm-persistence-contracts
pnpm check:target:architecture
```

Die tatsächliche gemeinsame Diesel-/Schema-DSL-/Treiberbasis wird in den Adapterpaketen aufgebaut. Dieser reine Vertragscrate zieht weder ORM noch Clientkrypto in den öffentlichen Abhängigkeitsabschluss. [DAL02-Abnahme](../../docs/dal02-contracts.md).
