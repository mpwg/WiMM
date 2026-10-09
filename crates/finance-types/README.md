# Gemeinsame private Rust-Fachtypen

SPDX-License-Identifier: AGPL-3.0-or-later

`wimm-finance-types` enthält die gemeinsame private Typquelle des Fachkerns: alle 14 bestehenden Aggregate, 22 Befehlsformen, Request-/Kontext-/Erwartungs-/Änderungsmengenformen sowie geschützte Cent-/Revisions-/UUID-/Datum-/Text-/Listentypen. Technische Konstruktoren und sichere Wertoperationen sind Teil derselben Fachkerngrundlage; fachliche Handler, Projektionen, CAS-/Referenzregeln und Gegenbefehle bleiben in `wimm-finance-core`. Keine UI, HTTP, ORM, Speicherung, globale Uhr oder Zufallsquelle.

Das optionale Feature `contract-schema` erzeugt unveränderte Schemars-Formschemas. Der Kern reexportiert die bisherigen Modulpfade; bisherige JSON-Einstiege und Fach-/Bindingversionen bleiben erhalten. Die Quelltrennung ist keine Produktumschaltung oder Datenmigration. Öffentliche Server- und lokale Speicherverträge bleiben separate Grenzen; ihre getrennten Quellen folgen innerhalb [#116](https://github.com/mpwg/WiMM/issues/116).

`native-bindings` ist eine ausdrücklich optionale Ableitung derselben Modelle mit dem vorhandenen UniFFI 0.32.2; die Standardkonfiguration des Fachkerns enthält keine UniFFI-Runtime. Records/Enums haben keine zweite Feldliste. Custom-Type-Konvertierungen verwenden die vorhandenen geschützten Konstruktoren für sichere Cent, Revisionen, UUID, Datum/UTC, Texte und Listen. Unbekannte native V2-Binding-/Fachversionen werden bereits beim Lesen der ersten Headerfelder als `UPDATE_REQUIRED` abgewiesen, bevor spätere Payloadfelder geprüft werden. Die V1-Serde-/Schemaformen bleiben u32 und bytegenau erhalten.

Formfehler werden als typisierter `ContractError` mit `code` und deutscher `detail` übertragen, ohne Originalpayload. `detail` vermeidet die Kollision mit Kotlins geerbter Throwable.message; die V1-Ausgabeadapter serialisieren weiterhin error.message. Das bereits vorhandene Importmapping bleibt als ausdrücklich opakes JSON-Fremdpayload die einzige String-Transportausnahme; Finanzaggregate und Befehle sind echte native Records/Enums.

```sh
cargo test --locked -p wimm-finance-types --features contract-schema
cargo test --locked -p wimm-finance-types --features native-bindings
cargo test --locked -p wimm-finance-core
pnpm check:core
pnpm test:contracts:bindings:v2:all
pnpm test:contracts:commands:native
```

Direkte native Wert-/Schemaassertions liegen hier. Der vollständige Fach-/Formdifferenzialkatalog bleibt im Kern und verwendet genau diese Typen, einschließlich des unveränderten historischen Vergleichs. Vor der Quelltrennung exportierte Schemas wurden danach bytegenau im Werkzeugprüfmodus verglichen: alle drei unverändert. Keine neue Fremdabhängigkeit; vorhandene Serde-/UUID-/Schemars-Versionen und Lizenzen bleiben gesperrt. Eigener Code bleibt global unsafe-frei.
