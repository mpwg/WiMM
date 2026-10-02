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

`.wimm` ist verpflichtend ein verschlüsselter Container um ein internes ZIP-Archiv mit UTF-8 JSON. Export enthält einen Finanzbereich; mehrere Bereiche getrennt. Keine standardmäßigen Klartext-Finanzexports. Der Client fragt eine unabhängige Exportpassphrase ab; Server erhält sie nicht. Administrative Vollserversicherung speichert vorhandene E2EE-Chiffrate und ist davon verschieden.

Äußerer Container: ASCII-Magic `WIMMENC1` (acht Bytes), vier Bytes Headerlänge unsigned big-endian, UTF-8 JSON-Header, dann XChaCha20-Poly1305-Chiffrat des inneren ZIP. Header: containerVersion=1, suite, KDF=argon2id13, salt/nonce base64url, KDF-Parameter und innerFormat=`wimm` oder `wimm-drafts`; Magic/Länge/exakter Header sind AAD. Keine Finanznamen/Beträge im Header. Argon2id 64 MiB/drei Durchläufe, KDF-Limits vor Ausführung prüfen, frische Salt/Nonce. Falsche Passphrase/Manipulation lehnt vor ZIP-Verarbeitung ab. Details siehe [Verschlüsselung](encryption.md).

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

Nutzerexport verwendet konsistenten lokalen sichtbaren Stand; bei unbestätigten Änderungen inneres Manifest `containsUnconfirmedChanges=true`. Restore erzeugt unabhängige Daten, keine bestätigten Serveroperationen. Entwurfsexport verwendet ebenfalls verschlüsselten Container mit innerFormat `wimm-drafts`, enthält Originalbasis/Befehle und ist keine vollständige Sicherung. Exportpassphrase und Schlüssel liegen nie in derselben Datei unverschlüsselt. Bereichsexport enthält keine privaten Identitäts-/Geräteschlüssel; Rettungscode/Tresorsicherung sind gesondert.

## Validierung und Wiederherstellung

Äußerer Header maximal 16 KiB, Container maximal 101 MiB, inneres ZIP maximal 100 MiB. Passphrase/KDF und AEAD werden vor Entpacken clientseitig geprüft. ZIP-Pfade nur bekannte relative Pfade, keine absoluten Pfade, `..`, Symlinks oder verschachtelten Archive. Maximal 500 MiB entpackt und 100 Einträge; Limits während Dekompression prüfen. Prüfsummen, Typen, Referenzen und Fachinvarianten vor Änderung clientseitig validieren; kein Klartextrestore auf Server.

Unbekannte höhere Format-/Schemasversion ablehnen. Für bekannte ältere Versionen existiert erst mit einer späteren Version eine getestete Vorwärtsmigration. In v1 keine Vermutung, ein Actual-/YNAB-Export sei WIMM-kompatibel; eine direkte Actual-Budgetmigration ist spätere Erweiterung, Dateiimporte sind bereits verfügbar.

Standardrestore legt einen unabhängigen lokalen Bereich mit neuen IDs/Schlüsseln an. Fremde Veröffentlichungshinweise bleiben nicht aufgelöst. Serverrestore prüft Finanzdaten auf dem Client, erhält Verwaltung/Eigentum, verschlüsselt/signiert neu und setzt bestätigte neue Epoche. Der Server empfängt keinen entschlüsselten WIMM-Inhalt. Ein Import darf niemals Mitgliedschaften/Schlüsselrechte anlegen.
