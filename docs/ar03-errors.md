# AR03 — strukturierte Persistenz- und Bindingfehler

Stand: 9. Oktober 2026. Abnahmesnapshot zu [#117](https://github.com/mpwg/WiMM/issues/117); Voraussetzungen [AR02](ar02-contract-generation.md) erfüllt. Freigabe und Reihenfolge in [Aufgaben](tasks.md) und [#114](https://github.com/mpwg/WiMM/issues/114).

## Umsetzung und sichere Grenze

Die gemeinsame Rust-Quelle wimm-local-contracts definiert StorageFailure mit contractVersion 2, einem stabilen StorageFailureCode und commitState notCommitted/unknown. Zehn Codes unterscheiden REVISION_CONFLICT, QUOTA, RESOURCE_UNAVAILABLE, WRITE_FAILED, UPDATE_REQUIRED, EPOCH_MISMATCH, CANCELLED, COMMIT_UNKNOWN, INVALID_RESPONSE und OPERATION_ID_REUSED. Die Hülle enthält weder Meldungen noch Datenbanktexte, Pfade, Nutzdaten oder Schlüssel. Serde und der typisierte Formeinstieg prüfen Version, Zusatzfelder und widersprüchlichen COMMIT_UNKNOWN-Status. Das Standardschema allein ersetzt diesen relationalen Rust-Guard nicht.

Swift-/Kotlin-/TypeScript-Modelle und das zusätzliche lokale Standardschema entstehen aus derselben Rust-Quelle; AR02-Generator und negative Driftprüfung gelten weiterhin. Die native Desktopanwendung verwendet diesen tatsächlichen Rust-Datentyp als Tauri-Fehlerantwort. SQLite-Fehler werden anhand ihres Typs und numerischen Codes klassifiziert, ohne Fehlertexte auszuwerten. CAS-, Versions-, Epochen- und Abbruchguards setzen ihre Codes direkt an der Ursache. Ein fehlgeschlagener Commit oder verlorenes Workerresultat liefert einen unklaren Zustand und keinen Freibrief zur Wiederholung.

Die Desktopports für Speicher, Sicherungen, Migration und Indexabfragen dekodieren ausschließlich die katalogisierte Hülle. Unbekannte Codes/Versionen, Zusatzfelder, Textantworten und manipulierte Write-Erfolgswerte liefern INVALID_RESPONSE/unknown. Deutsche Meldungen entstehen im Client. Die Browser-Schreibgrenze klassifiziert DOM-/Dexie-Fehler nach Klassen und standardisierten Namen; fremde Diagnosetexte werden nicht übernommen.

FinanceApplication fragt nur bei strukturiertem REVISION_CONFLICT/notCommitted den Bestand erneut ab. Keine Regex oder deutsche Fehlermeldung entscheidet über Konflikte. Bei unknown werden weitere Schreibversuche in der aktiven Anwendung gesperrt; Entwurf, Ausgangsbestand und Historie werden nicht als bestätigt übernommen. Durable Operationsreceipts/Ergebnisabfrage gehören anschließend zu AR04, nicht zu dieser Abnahme. Keine automatischen Wiederholungswrites oder neue Operations-ID aus einer unklaren Antwort.

## Kriterienmatrix

| Kriterium | Nachweis |
| --- | --- |
| Textunabhängige Konfliktbehandlung | TS-Anwendungs-/Desktoptests und echte native CAS-/Projektionskonflikte |
| Codes über reale Bindinggrenzen, unbekannte Codes kontrolliert | Rust-Assertions, je zwölf native Swift-/Kotlinaufrufe, tatsächliches Node-/Chromium-WASM und Tauri-InvokeResponse-Serialisierung |
| Manipulation, Schreibfehler, stale CAS und Payload-/Secret-Leckage negativ | Strikte Rust-/TS-/WASM-Fehlerformen, manipulierte Writeantwort, Anwendungssperre, SQLite-Schreibfehler/CAS/Rollback, echte SQLITE_FULL-Grenze ohne Mutation |

## Aktuelle Prüfbelege und Grenzen

Aktive CachyOS Linux x86_64-Arbeitskopie; dokumentierte gesperrte Rust-/Swift-/Kotlin-/Node-/Tauriwerkzeuge. `pnpm check:core`, native Tauri-Tests/Clippy mit -D warnings, Typecheck/Lint; `pnpm test:storage`, `pnpm test:application`, `pnpm test:storage:native`, `pnpm test:contracts:storage-errors`, lokale Chromium-Bindingspecs und konkrete negative Rust-Quelldriftprüfung. Alle aufgeführten Prüfungen erfolgreich: native Tauri-Suite 29 bestanden/zwei bestehende ignoriert; gemeinsame tatsächliche SQLite-Suite 30 Fälle; Storage-Unit-/Snapshotprüfungen 21 und zwölf Fälle; Anwendungsprüfungen 25 Fälle; drei lokale Browser-Specs. Generierungsprüfmodus und tatsächlich injizierter lokaler Rust-Quelldrift ebenfalls erfolgreich, ohne Überschreiben. Abgenommen auf [307e4e5](https://github.com/mpwg/WiMM/commit/307e4e5); #117 als COMPLETED geschlossen, vollständige Beschreibung und Schließungsgrund rückgelesen.

Je zwölf tatsächliche native Swift-/Kotlinaufrufe: zehn unverändert zurückgegebene Codes/Commitzustände und zwei direkt konstruierte Negativobjekte. Node-/Chromium-WASM ergänzt unbekannte Codes, falsche Versionen, Zusatzdaten und widersprüchliche Commitstatus. Die native Tauri-IPC-Antwort wird über die echte InvokeResponse-Konvertierung geprüft; die gemeinsame SQLite-Suite verwendet den tatsächlichen nativen Rust-Prozess und DesktopStorageAdapter. Dies ist kein nativer GUI-/Gerätebeleg.

SQLITE_FULL entsteht tatsächlich durch eine auf zwei SQLite-Seiten begrenzte Datenbank und einen zu großen Write; leere Tabelle und QUOTA/notCommitted werden direkt nativ geprüft. Kein behaupteter physischer Datenträger-/Browser-Quota-Nachweis. Commitfehler mit privaten Diagnosetexten sind ausdrücklich synthetische SQLite-Fehlerobjekte; die Antwort enthält ausschließlich sichere Codes/Status. Keine Storage-/Fach-/Crypto-/Exportversionsänderung, keine Goldenumschreibung, keine neuen Fremdversionen oder abgeschwächten unsafe-Sperren.
