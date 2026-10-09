# Neutrale Vertragsprimitive

SPDX-License-Identifier: AGPL-3.0-or-later

Dieses Modul enthält ausschließlich gemeinsame UUID- und sichere JSON-Ganzzahlgrenzen. Keine privaten Fachmodelle, Finanzberechnungen, Speicherung, UI oder HTTP. `wimm-finance-types` reexportiert seine bisherigen Konstanten/UUID-Prüfung und verwendet denselben IntegerVisitor unverändert. Öffentliche Revisionen verwenden dieselbe sichere Zahlsemantik.

Die bestehende öffentliche Zod-Form akzeptiert die Max-UUID ausschließlich kleingeschrieben; der private V1-Rust-Vertrag akzeptiert auch Großbuchstaben. Zwei ausdrücklich benannte Policies erhalten diese bisherigen Grenzen, ohne UUIDs zu normalisieren. Parser bleibt die gesperrte uuid-Bibliothek; Schemapatterns kommen aus derselben neutralen Quelle.

`pnpm check:core` prüft native Wert-/Fach-/Formassertions und die globale unsafe-Sperre. Kein neuer Fremdparser oder neue Fremdversion.
