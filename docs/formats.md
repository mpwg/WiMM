# Import- und Exportformate

## Importablauf

Dateiauswahl → lokales Parsing → Kontoauswahl/Mapping → normalisierte Vorschau → Dublettenentscheidung → bestätigte Übernahme in Batches. Parser laufen ohne Netzwerkzugriff im Worker; Desktop darf die Datei über nativen Dialog lesen. Die Originaldatei wird nicht automatisch an den Server übertragen.

v1-Grenzen: maximal 25 MiB Eingabedatei, 100.000 Zeilen/Buchungen; Grenze vor Parsing und während Normalisierung prüfen. Übernahmegruppen bis 100 Buchungen; Fortschritt speichert Import-ID und Quellzeilen. Abbruch lässt bereits bestätigte Gruppen erhalten und kennzeichnet den Import als teilweise übernommen. Wiederaufnahme erkennt sie anhand Import-ID/Zeile; keine Behauptung eines atomaren 100.000-Zeilen-Imports.

## CSV

Unterstützte Zeichensätze UTF-8 mit/ohne BOM und Windows-1252 nach expliziter Auswahl. Trennzeichen Komma, Semikolon oder Tab; Erkennung ist ein Vorschlag, in Vorschau korrigierbar. Standardmäßig Kopfzeile; ohne Kopfzeile Spaltenindizes zuordnen. Etablierte CSV-Bibliothek behandelt Quotes, Zeilenumbrüche und Escapezeichen.

Mapping: date, amount oder debit/credit, payee?, memo?, externalId?. Datumformat explizit ISO oder DACH `DD.MM.YYYY`; Betragformat Dezimalkomma bzw. Dezimalpunkt mit konfiguriertem Tausendertrennzeichen. Keine heuristische Betragskonvertierung nach Bestätigung. Bei debit/credit positive Sollwerte negieren, Habenwerte positiv; beide ungleich null in einer Zeile ist Fehler.

Mappingvorlagen enthalten Name, Encoding, Separator, Kopfzeilenmodus, Spalten, Datum-/Zahlenformat und Signregel. Sie enthalten keine Zugangsdaten. Vorschau zeigt Originalzeile, normalisierte Daten, Fehler und Dublettenstatus. Ungültige Zeilen müssen vor Übernahme korrigiert oder ausdrücklich ausgeschlossen werden.

## CAMT.053 und OFX/QFX

CAMT.053: Namespace unabhängig von Präfix behandeln; Datum aus Buchungsdatum, Vorzeichen aus CRDT/DBIT, Betrag nur EUR, Verwendungszweck aus RemittanceInformation, externe ID bevorzugt AccountServicerReference, dann eindeutige EntryReference. Bei mehreren TransactionDetails pro Entry nur Einzelbeträge übernehmen, wenn sie den Entrybetrag genau ergeben; sonst Sammelbuchung mit klarer Vorschau statt geratenen Einzelbeträgen. XML-DTD/externe Entitäten sind deaktiviert.

OFX/QFX: etablierter Parser für OFX SGML/XML und QFX verwenden; DTPOSTED auf Finanzdatum normalisieren, TRNAMT exakt als Cent einlesen, NAME/PAYEE und MEMO getrennt führen, FITID als bevorzugte externe ID. Accountangaben dienen nur Zuordnungsvorschlägen; keine unbestätigte Kontoanlage. Nicht-EUR-Daten ablehnen. Kontosalden sind Abgleichhinweise, keine automatisch erzeugten Korrekturbuchungen.

## Dubletten

Eindeutige Quell-ID wird innerhalb Konto + Parserquelle verglichen; identische ID mit anderen Beträgen/Daten ist ein Prüfkonflikt, nicht automatisch überspringen. Ohne ID: Fingerprint aus Konto, Datum, Centbetrag, normalisiertem Empfänger und Verwendungszweck. Fingerprinttreffer sind Kandidaten; identische echte Zahlungen am selben Tag dürfen ausdrücklich getrennt übernommen werden.

Fingerprintnormalisierung verwendet Unicode NFC, zusammengefasste Whitespaces und festgelegte casefold-/Kleinschreibung. Keine Entfernung von Ziffern. Hash und Entscheidung werden gespeichert. Eine Wiederholung desselben Importbatches erkennt bereits angewandte Quellzeilen unabhängig von einem bewusst zugelassenen Fingerprintduplikat.

## WIMM-Export v1

`.wimm` ist ein unverschlüsseltes ZIP-Archiv mit UTF-8 JSON. Export enthält genau einen Finanzbereich; mehrere Bereiche werden als getrennte Dateien exportiert. Administrative Vollserversicherung ist davon verschieden. Der Dialog nennt Bereich, enthaltene Daten und den unverschlüsselten Zustand.

```text
manifest.json
space.json
data/accounts.json
data/categoryGroups.json
data/categories.json
data/payees.json
data/transactions.json
data/transfers.json
data/reconciliations.json
data/budgetMethodPeriods.json
data/budgetMonths.json
data/participants.json
data/allocationPolicies.json
data/sharedExpenses.json
data/expenseRefunds.json
data/contributions.json
data/settlements.json
data/advanceOffsets.json
data/schedules.json
data/scheduleOccurrences.json
data/rules.json
data/savingsGoals.json
data/importMappings.json
data/importFingerprints.json
data/publicationLinks.json
```

Jede Datendatei enthält ein Array vollständiger Aggregate. Leere Arrays sind vorhanden, nicht fehlend. publicationLinks ist nur für Privatbereiche befüllt; Fremd-IDs darin sind unverbindliche Hinweise, keine Zugriffsrechte. Transfertochterbuchungen sind in transactions enthalten und referenzieren ihr Transferaggregat. Projektionen werden nicht als Quelle exportiert.

Manifestfelder: `format="wimm"`, `formatVersion=1`, `domainSchemaVersion=1`, `appVersion`, `createdAt`, `currency="EUR"`, `spaceKind`, `recordCounts` und `files[]` mit Pfad, Bytezahl und SHA-256. Checksummen erkennen Beschädigung, nicht die Vertrauenswürdigkeit einer fremden Datei. Keine Userpasswörter, Tokens, OIDC-Secrets, Serverrechte oder Loginzuordnungen enthalten.

Ein Nutzerexport verwendet einen konsistenten lokalen sichtbaren Stand; falls noch unbestätigt, manifest `containsUnconfirmedChanges=true`. Die Wiederherstellung erzeugt unabhängige Daten, keine bereits bestätigten Serveroperationen. Zusätzlicher Entwurfsexport verwendet eigenes Format `wimm-drafts`, enthält Originalbasis/Befehle und wird nicht als vollständige Sicherung angeboten.

## Validierung und Wiederherstellung

ZIP-Pfade erlauben ausschließlich bekannte relative Pfade, keine absoluten Pfade, `..`, Symlinks oder verschachtelten Archive. Maximal 100 MiB komprimiert, 500 MiB entpackt und 100 Einträge; Limits während Dekompression prüfen. Prüfsummen, Pflichtdateien, Typen, sichere Zahlen, Referenzen und Fachinvarianten werden vor Änderung validiert.

Unbekannte höhere Format-/Schemasversion ablehnen. Für bekannte ältere Versionen existiert erst mit einer späteren Version eine getestete Vorwärtsmigration. In v1 keine Vermutung, ein Actual-/YNAB-Export sei WIMM-kompatibel; eine direkte Actual-Budgetmigration ist spätere Erweiterung, Dateiimporte sind bereits verfügbar.

Standardrestore legt einen neuen unabhängigen lokalen Bereich an und erzeugt neue Bereichs-/Objekt-IDs über eine vollständige Referenzabbildung. Fremde private Veröffentlichungshinweise bleiben als nicht aufgelöst markiert. Restore in einen bestehenden Serverbereich ersetzt Daten nach Backup und Bestätigung, erhält Verwaltung/Eigentum und setzt neue Sync-Epoche. Ein gewöhnlicher Import darf niemals Haushaltsmitgliedschaften anlegen.
