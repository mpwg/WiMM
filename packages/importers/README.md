# Lokale Importgrundlage

`@wimm/importers` stellt seit P5.1 CSV-, XML- und OFX-/QFX-Parseradapter, eine normalisierte Zwischenform und einen abbrechbaren Workerport bereit. Eigener Code steht unter AGPL-3.0-or-later. Die Pipeline hat keine Speicher-, HTTP-, UI- oder Serverabhängigkeit; sie erzeugt Vorschläge, keine Buchungen.

## Nutzung und Grenzen

Die App stellt `createImportWorkerPort` eine Factory für einen Dedicated Module Worker mit dem Export `@wimm/importers/worker` bereit. Der Bundler muss den Worker lokal bündeln. Je Auftrag wird ein neuer Worker erzeugt und nach Erfolg, Fehler oder Abbruch beendet. `AbortSignal` beendet auch einen bereits rechnenden Parser sofort; eine Abbruchnachricht müsste dagegen auf dessen Ereignisschleife warten. Dateiauswahl und die Prüfung der Dateigröße vor dem Lesen bleiben Aufgabe des Plattformports.

`port.parse({ bytes, format: 'csv', encoding: 'utf-8', separator: ';' }, signal)` nimmt ausschließlich lokale `Uint8Array`-Dateibytes an. Kein URL-/Dateipfadargument und kein Downloadmodus. Die Vorlage [worker-harness.ts](tests/worker-harness.ts) zeigt die Bundlereinbindung. `parseImport` ist für Adaptertests und die Workerimplementierung exportiert; Clientoberflächen verwenden den Workerport.

25 MiB werden vor Decodierung sowohl im Port als auch im Parser geprüft. CSV zählt höchstens 100.000 logische Datensätze einschließlich einer eventuell vorhandenen Kopfzeile; eine abschließende Leerzeile durch den letzten Zeilenumbruch zählt nicht zusätzlich. XML zählt während SAX-Ereignissen höchstens 100.000 `Ntry` und 100.000 `TxDtls`, begrenzt die Tiefe auf 128 und verwirft DTD, externe/unbekannte Entitäten und ungültige Syntax. OFX/QFX prüft die Zahl der `STMTTRN`-Starttags vor dem Bibliotheksparser und nochmals während der Ergebnistraversierung. DTD-/Entitätsdeklarationen und reservierte Objektfeldnamen werden abgewiesen. Bei einem Dateifehler gibt es kein erfolgreiches Teilergebnis.

`SourceRecord.sourceRow` ist eine stabile 1-basierte Datensatznummer. CSV liefert zusätzlich die physische Startzeile; XML nennt die Zeile des öffnenden Entrytags. OFX liefert eine Datensatznummer ohne vorgetäuschte physische Zeilengenauigkeit. CSV-Zellen, XML-Nodes mit Namespace/Attributen und OFX-Felder behalten Betragstexte. Parserfehler werden in deutsche strukturierte Meldungen übersetzt, ohne Bibliotheksfehler mit Originalfinanztext weiterzugeben.

`normalizeImportRecord` validiert einen bereits gemappten `CanonicalImportRecord`: ISO-Finanzdatum, EUR und Dezimalbetrag ohne Tausendertrennzeichen. Geld und Kalender werden ausschließlich im Fachkern geprüft. Beispiel: `amount: '-1234.56'` ergibt exakt `-123456` Cent; `90071992547409.92` wird abgewiesen. Ungültige Vorschläge haben `record: null` und Feld-/Quellzeilenfehler. `createImportPreview` ergänzt die korrigierbare Zwischenform. `CsvMapping` legt Encoding, Separator, Kopfzeile, 0-basierte Spalten, ISO-/DACH-Datum, Dezimal-/Tausenderzeichen und Vorzeichen ausdrücklich fest; `validateCsvMapping` verwirft widersprüchliche Vorlagen. Soll/Haben benötigt nichtnegative Werte und erlaubt höchstens eine gefüllte Seite. Die App speichert Vorlagen lokal im aktuellen Bereich.

`port.parse({ bytes, format, preview: true, mapping }, signal)` führt Parsing und Vorschau gemeinsam im Worker aus. Originalzellen bleiben neben dem normalisierten Ergebnis erhalten. Die Vorschau nummeriert normalisierte Zeilen eindeutig; `originalSourceRow` und `line` erhalten die Herkunft auch bei CAMT-Vereinzelung. CAMT verwendet Buchungsdatum, CRDT/DBIT und EUR; Details werden ausschließlich bei exakter Entrysumme vereinzelt, sonst bleibt eine bezeichnete Sammelbuchung. OFX/QFX bewahrt Währungskontext, NAME/MEMO und FITID; DTPOSTED wird ohne Zeitzonenverschiebung auf seinen Finanztag abgebildet. Kontoangaben sind Zuordnungshinweise; weder Konten noch Saldo-Korrekturen werden erzeugt. Bestätigung, Dubletten und Dauerzahlungen verwenden den Fachkern und den lokalen atomaren Speicherport.

## Auswahl und Herkunft

Die offiziellen Repositories und die tatsächlich installierten Paketmetadaten wurden am 5. Oktober 2026 geprüft. Exakte Versionen und Registry-Integritätswerte stehen im [Workspace-Lockfile](../../pnpm-lock.yaml); Bibliothekscode wurde unverändert als Abhängigkeit eingebunden, kein Actual-Code übernommen.

| Bibliothek | Version | Lizenz | Herkunft / Entscheidung |
| --- | --- | --- | --- |
| [Papa Parse](https://github.com/mholt/PapaParse) | 5.7.0 | MIT | Commit `555c1c1b6175e7a043adf8694983776a1e6fdeeb`; etablierter CSV-Parser mit Step-/Abbruchschnittstelle, Quotes/Mehrzeilen; `dynamicTyping` und Download ausdrücklich aus |
| [saxes](https://github.com/lddubeau/saxes) | 6.0.0 | ISC | Commit `211fa0ebec9b628affc09219199639887174bfc3`; stabiler SAX-Parser mit Namespace- und Syntaxprüfung, erlaubt Limits während Verarbeitung statt vollständigem XML-Baum |
| [ofx-js](https://github.com/bradenmacdonald/ofx-js) | 1.1.1 | MIT | Commit `04c6fb23a2db8080bc77aea3b15f6ca00808bc35`; browserfähiger etablierter SGML/XML-OFX-Parser, reine synchrone Verarbeitung im terminierbaren Worker; 1.1.2 erfüllt beim Auftrag die siebentägige Releasealtersregel noch nicht |
| [xmlchars](https://github.com/lddubeau/xmlchars) | 2.2.0 | MIT | Transitive SAX-Zeichenklassifikation; Registry veröffentlicht keinen `gitHead`, Herkunft über Version und Lockfile-Integrität |
| [@types/papaparse](https://github.com/DefinitelyTyped/DefinitelyTyped/tree/master/types/papaparse) | 5.5.2 | MIT | Nur Entwicklungs-Typdefinitionen |

Ursprüngliche Hinweise sind vollständig unter [licenses](licenses/papaparse.txt) erhalten: [saxes](licenses/saxes.txt), [ofx-js](licenses/ofx-js.txt), [xmlchars](licenses/xmlchars.txt), [Typdefinitionen](licenses/types-papaparse.txt). Das saxes-NPM-Paket liefert keine Lizenzdatei mit; dessen unveränderte Datei wurde deshalb aus dem oben genannten Herkunftscommit übernommen. Diese Fremdhinweise müssen mit einer späteren Distribution ausgeliefert werden.

## Prüfungen

`pnpm test:importers` prüft Parserfixtures, echte Byte-/Datensatzgrenzen, Syntax-/Entitätsfehler, Abbruch und sichere Centnormalisierung. `pnpm test:importers:worker` verwendet einen echten Chromium-Worker: lokale Bytes, Startmeldung mit anschließendem Abbruch, strukturierter Fehler und erfolgreicher neuer Auftrag; keine XHR-/Fetch-/Uploadanfrage. Beide Prüfungen gehören zur zentralen Prüfserie. Testdaten sind synthetisch.

Aktuelle Kriterien und Plattformgrenzen stehen in der [P5.1-Übergabe](../../docs/handoffs/p5-1.md). Windows-/Linux-Ausführung folgt gemäß Nutzerauftrag später; dieser Stand behauptet keine neue native Plattformabnahme von P4.
