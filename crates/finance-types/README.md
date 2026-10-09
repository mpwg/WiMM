# Gemeinsame private Rust-Fachtypen

SPDX-License-Identifier: AGPL-3.0-or-later

`wimm-finance-types` enthält die gemeinsame private Typquelle des Fachkerns: alle 14 bestehenden Aggregate, 22 Befehlsformen, Request-/Kontext-/Erwartungs-/Änderungsmengenformen sowie geschützte Cent-/Revisions-/UUID-/Datum-/Text-/Listentypen. Technische Konstruktoren und sichere Wertoperationen sind Teil derselben Fachkerngrundlage; fachliche Handler, Projektionen, CAS-/Referenzregeln und Gegenbefehle bleiben in `wimm-finance-core`. Keine UI, HTTP, ORM, Speicherung, globale Uhr oder Zufallsquelle.

Das optionale Feature `contract-schema` erzeugt unveränderte Schemars-Formschemas. Der Kern reexportiert die bisherigen Modulpfade; bisherige JSON-Einstiege und Fach-/Bindingversionen bleiben erhalten. Die Quelltrennung ist keine Produktumschaltung oder Datenmigration. Öffentliche Server- und lokale Speicherverträge bleiben separate Grenzen; ihre getrennten Quellen folgen innerhalb [#116](https://github.com/mpwg/WiMM/issues/116).

```sh
cargo test --locked -p wimm-finance-types --features contract-schema
cargo test --locked -p wimm-finance-core
pnpm check:core
pnpm test:contracts:bindings:v2:all
```

Direkte native Wert-/Schemaassertions liegen hier. Der vollständige Fach-/Formdifferenzialkatalog bleibt im Kern und verwendet genau diese Typen, einschließlich des unveränderten historischen Vergleichs. Vor der Quelltrennung exportierte Schemas wurden danach bytegenau im Werkzeugprüfmodus verglichen: alle drei unverändert. Keine neue Fremdabhängigkeit; vorhandene Serde-/UUID-/Schemars-Versionen und Lizenzen bleiben gesperrt. Eigener Code bleibt global unsafe-frei.
