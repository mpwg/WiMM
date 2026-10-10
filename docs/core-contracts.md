# Gemeinsame Fach- und Anwendungsverträge

Nutzerentscheidung vom 10. Oktober 2026: WiMM ist unveröffentlicht und benötigt keine Legacy-Kompatibilität oder Altdatenübernahme. [ADR-060](decisions.md#adr-060--zielimplementierung-ohne-legacy-komponenten) ersetzt frühere Übergangsanforderungen; [#146](https://github.com/mpwg/WiMM/issues/146) verfolgt die vollständige Entfernung. Aktuelle Finanz-, E2EE-, CAS-, Restore-, Versions- und Plattformprüfungen bleiben verbindlich.

Stand: 9. Oktober 2026. Der bestehende K01-Vertrag ist die kompatible Ausgangsbasis, historisch in [#92](https://github.com/mpwg/WiMM/issues/92) abgenommen. Das bestätigte [Rust-Ziel](architecture.md) erweitert ihn durch typisierte gemeinsame Fach-/Anwendungsports, lokale Commitreceipts und begrenzte Ansichten. [Gesamtübersicht #114](https://github.com/mpwg/WiMM/issues/114), [Freigaben](tasks.md). Die derzeitigen TS-Formschemas und Stringbindings bleiben bis geprüfter Umstellung Bestand; neue Schnittstellen hier sind Zielverträge, noch kein implementierter APIumfang.

## Versionen und Darstellung

| Dimension | Vertrag |
| --- | --- |
| Engine-Binding | Bestehende JSON-ABI: `contractVersion: 1`. Neues typisiertes Binding gemäß ADR-053: `contractVersion: 2`, eigener versionierter Einstieg und V1-Kompatibilitätsadapter. Unbekannter Vertrag liefert `UPDATE_REQUIRED`, keine Berechnung oder Mutation |
| Finanzdaten | `domainSchemaVersion: 1`; bestehende P2-/P5-Aggregate, keine zusätzlichen P6–P11-Typen |
| Lokaler Speicher | gesonderte `storageSchemaVersion`; weder aus Bindingversion noch Epoche abgeleitet |
| Sync/Export | bestehende Protokoll-, Crypto- und Exportformate unabhängig erhalten |

Alle Requests und Results sind normale JSON-Daten mit festen discriminated unions und strikten Feldern. Finanzaggregate tragen Fach-ID, Bereich, Revision und UTC-Metadaten; lokale `handle`-Felder gehören ausschließlich in Speicherrecords. Die V1-Adapterabbildung ist Fach-ID gleich Handle gemäß ADR-041; der Adapter entfernt das zusätzliche Handle vor dem Engine-Aufruf und ergänzt es erst beim Speichern. Der Server erhält ausschließlich bestehende verschlüsselte Hüllen und öffentliche Metadaten.

ADR-053 ergänzt typisierte native Records/Enums und WASM-Objekte aus Rust für V2. Swift/Kotlin erhalten sichere Cent als 64-Bit-Integer, WASM/TypeScript als exakt darstellbare sichere Zahlen. Das ist eine getrennte Bindingversion; Fach-/Storage-/Crypto-/Transport-/Exportversionen und gespeicherte Daten bleiben unverändert. V1 bleibt während der geprüften schrittweisen Umstellung erreichbar. Neue V2-Einstiege dürfen bestehende V1-Exporte nicht still umdeuten; Formprüfung und Fehlerpriorität des V1-Adapters bleiben erhalten.

Geld, Revisionen, Reihenfolgen und Zähler bleiben sichere Ganzzahlen zwischen den bisherigen Grenzen einschließlich negativer Cent. Rust verwendet hinreichend breite exakte Zwischenwerte und lehnt Überläufe ab, bevor es Daten für den Commit liefert. JavaScript erhält keine erweiterten Rust-Integerwerte oder BigInt-JSON-Fallbacks. Kalenderdaten bleiben `YYYY-MM-DD`, technische Zeitpunkte UTC mit `Z`. Optionale Felder werden bei Abwesenheit ausgelassen; `null`, leerer Text und Abwesenheit dürfen nicht verwechselt werden. UTF-8, UUIDs und vorhandene Texte bleiben verlustfrei; fachliche Normalisierung folgt ausschließlich dem vorhandenen Fachmodell.

## Fachengine

`FinanceEnginePort` ist der identische logische Vertrag für Web/WASM, direkte Tauri-Aufrufe und spätere Swift-/Kotlin-Bindings. Der asynchrone TypeScript-Port kapselt die Ausführungsform, nicht eine weitere Finanzengine. Native Bindings dürfen denselben reinen Kern synchron aufrufen; das ändert keine Inhalte oder Fehler.

| Aktion | Eingabe | Ergebnis |
| --- | --- | --- |
| `execute` | vollständiger aktueller Bereichsbestand, typisierter Fachbefehl, ausdrückliche erwartete Revisionen, Kontext | `changed` mit vollständiger atomarer Änderungsmenge, `unchanged` oder `rejected` |
| `reverse` | vollständiger Bestand, gezielte historische Zielaggregate, erwartete aktuelle Revisionen, Kontext | reguläre Gegenänderung mit neuen Revisionen/Tombstones; kein Bereichssnapshotrestore |
| `project` | vollständiger Bestand desselben Bereichs | Kontosalden und Verbrauch mit Kategorien oder strukturierter Fachfehler |
| `validate` | `historical` mit vollständigem Wiederherstellungsbestand oder `mutation` mit vollständigem Vorher-/Nachherbestand | `valid` oder strukturierter Fehler; historische Tombstones und neue Referenzen getrennt prüfen |
| `calculate` | typisierte Geldtexte, Regel-/Importkandidaten, Dauerzahlung oder Dublettenbestand | Cent, Regelvorschlag, Fälligkeiten oder Dublettenklassifikation; keine Speicherung |

Alle Ergebnisse tragen die Bindingversion. IDs und Zeit liegen explizit im Kontext: Operations-ID, UTC-Zeitpunkt und geordneter Vorrat erzeugter UUIDs. Der Kern nutzt weder globale Uhr noch Zufall. Nicht verfügbare oder unzulässige IDs liefern `INVALID_GENERATOR`; Wiederholungen mit identischen Requests verwenden denselben Vorrat und müssen identische Ergebnisse liefern. Sortierung, Restcent und Summenreihenfolge folgen `docs/domain.md`; Datenbankrückgabereihenfolgen sind keine Entscheidungsgrundlage.

Die Befehlsformen decken ausschließlich die vorhandenen 22 Befehle ab. Save-Befehle erhalten vollständige vorgeschlagene Aggregate; Archivierung/Löschung ein Ziel. Merge nennt Ziel, Quellen und die ausdrücklich bestätigte Buchungsmenge. Abgleich nennt Konto, Auszugsdatum/-saldo und ausgewählte Buchungen; Entsperren den bestätigten Abgleich. Importcommit nennt die zuvor gespeicherte Importgruppe; Regelnreihenfolge die vollständige gewünschte ID-Reihenfolge. Dauerzahlungsbestätigung nennt Schedule/Fälligkeit und optional eine gespeicherte importierte Zahlung. `unchanged` behandelt bereits erledigte Fälligkeiten oder Importgruppen ohne neue Operation.

Formprüfung ist keine Fachabnahme: Der Kern prüft zusätzlich Bereichszugehörigkeit, vollständige Referenzen/Transferpaare, Revisionen, Abgleichsperren, Tombstones, Automatisierung und Summen einschließlich Zwischenwerten. Neue Referenzen und Snapshotreferenzen erhalten die bereits verbindlichen unterschiedlichen Regeln. Kein Ergebnis darf implizit gespeichert werden. Bekannte Fachfehler liefern die gemeinsamen zentralen Fehlercodes; Formfehler liefern `INVALID_COMMAND`, unbekannte Versionen `UPDATE_REQUIRED`. Fehlermeldungen enthalten keine Original-Finanzpayloads und werden nicht als Klartext zum E2EE-Server gesendet.

## Anwendung und lokaler Speicher

Im Bestand hat K02 die TypeScript-Anwendung aus React herausgelöst. Im Ziel lebt derselbe Ablauf in der gemeinsamen Rust-Anwendung. Sie injiziert Engine, Profil-/Finanzspeicher, IDs/Uhr, Profilkoordination, Hintergrundausführung, Abbruch und Plattformdienste. Die Ports enthalten keine DOM-/React-/Worker-/Web-Lock-/Tauri-/SQL-Typen. Der Historienstapel ist Anwendungssitzungszustand; seine Gegenbefehle kommen aus der Engine. Etablierte Datei-/XML-/CSV-Parser bleiben hinter Adaptergrenzen.

Ein Finanzwrite hat folgenden Ablauf:

1. Aktuellen Profil-/Bereichs- und Sitzungskontext unter derselben Profilkoordination prüfen; bei Sperre oder Wechsel keine Fortsetzung einer veralteten Sitzung.
2. Vollständigen aktuellen Fachbestand lesen; bestätigte Bestände und Originalentwürfe getrennt halten. Ein fehlendes Profil darf angelegt werden, ein beschädigtes/nicht lesbares Profil erhält keinen Neuanlagefallback.
3. Engine mit festem Kontext aufrufen. Bei Ablehnung bleiben Eingaben/Entwürfe erhalten; `unchanged` erzeugt keinen Write.
4. Änderung und fachlich berechnete Projektionen mit allen erwarteten Revisionen atomar speichern. Lokaler Standalonebetrieb erzeugt keine Outbox; verbundene Bereiche speichern die zugehörige Operation mit Originalentwurf im selben Batch.
5. Erst der dauerhaft bestätigte Commit ergibt lokalen Erfolg. Ein nachfolgender Lese-/Renderfehler darf den bereits gespeicherten Befehl nicht erneut schreiben. Bei unklarem Commitausgang Originaloperation prüfen, keine neue Operations-ID erzeugen.

`ProfileStorePort` bewahrt die bisherigen Loadzustände und den unter Koordination/CAS ausgeführten Änderungscallback. Profilrevision, Finanzrevision und Sitzungsgeneration bleiben getrennt. `LocalFinancialStoragePort` bewahrt sämtliche vorhandenen atomaren Speicherports einschließlich lokaler Epochengrundlage, Syncseiten/Cursor, Snapshot und Projektionsneuaufbau. Speicherfehler unterscheiden Revisionskonflikt, Quota, Schreibfehler, unbekannte Version und Epoche. Rust-Brücke und IndexedDB müssen dieselbe Bestandskonformität erfüllen; die vollständige Restabnahme führen #77/#85; Browserfallback ist kein SQLite-Beleg.

`CancellationPort` enthält ausschließlich Beobachtung/Abonnement. Abbruch vor Commit verhindert neue Writes und erhält den Entwurf. Nach bestätigt abgeschlossenem Commit muss das Ergebnis als committed behandelt werden; spätes Abbruchsignal oder Workerantwort erzeugt weder zweiten Write noch vermeintlichen Rollback. Hintergrundausführung und Zeitlimit werden injiziert, statt einen Browser-Worker in der Anwendung vorauszusetzen.

## DAL02 — Rust-Persistenzports und Operationsdimension

Die ausgeführte Vertragsreferenz trennt `wimm-persistence-contracts` (neutrale Commit-/Migrationscheckpointdaten), `wimm-local-contracts` (private lokale Daten-/Index-/Commitports), `wimm-public-contracts::storage_port` (öffentliche Ciphertext-/Verwaltungstransaktion) und `wimm-local-dal` (Memoryreferenz). Die normale Abhängigkeit des lokalen DAL enthält Datenformen, keine Finanzhandler. Snapshotersatz benötigt einen injizierten `SnapshotValidationPort`, der Fach- und Cacheprüfung im Fachkern ausführt; vorbereitete Projektionen werden lediglich atomar gespeichert. Profile, Schlüsselablage, Backup und Migration bleiben eigene Ports.

`LocalOperationIdentity.operationContractVersion` ist die neue getrennte Dimension **eins**. Profil-ID, Bereichs-ID, Epoche und Operations-ID bilden die Identität; der vollständige typisierte Request bindet zusätzlich den Inhalt einschließlich CAS, Entwürfen und Projektionen. `LocalCommitReceipt` enthält diese Identität, SHA-256-Inhaltshash und die tatsächlich geschriebenen Revisionen. Der private Memory-Referenzhash verwendet die Serde-JSONbytes des Requests; keine Umdeutung öffentlicher JCS-/Signatur-/Cryptoformate. Identischer Request liefert das ursprüngliche Receipt, abweichender Inhalt `OPERATION_ID_REUSED`. Unklarer Commit trägt die ursprüngliche Identität und verlangt zuerst `lookup_result`. Die dauerhafte Umsetzung und Wiederanlaufprüfung folgen in AR04/#118.

Der neutrale `CommitOutcome<T,E,K>` wird mit konkreten getrennten lokalen oder öffentlichen Wert-/Fehler-/Identitätstypen eingesetzt. Servertransaktionen stellen ausschließlich Datenmethoden über `ServerPersistenceTransaction` bereit; kein Verbindungs-/SQL-/Treiberzugriff aus dem Callback. Bindingversion zwei und sämtliche bisherigen Methoden/Storage-/Fach-/Crypto-/Transport-/Exportdimensionen bleiben erhalten; die neue Operationsdimension migriert keinen Bestandsdatensatz. Begrenzte lokale Sekundärreferenzabfragen besitzen typisierte Datum-/Handlecursor und Seitengröße 1–1.000. Standardschemas benötigen weiterhin die relationalen Rust-Guards.

[Kriterienmatrix und tatsächliche Belege](dal02-contracts.md). Die flüchtige Memoryreferenz beweist keine dauerhaften Receipts, physische Schemajournal-/SQLmigration, Browserpersistenz oder Serverdatenbank.

## Migration und Sicherung

`StorageMigrationPlan` nennt die erwartete letzte Migrationsnummer, getrennte Ausgangsversionen und lückenlos nummerierte registrierte Schritte. Jede Versionsdimension bleibt gleich oder steigt, mindestens eine steigt pro Schritt; Rückwärtsmigration ist unzulässig. Die Formprüfung beweist keine vorhandene Implementierung eines Zielschemas. Der Adapter darf ausschließlich registrierte, unterstützte Schritte ausführen; unbekannte Ziele werden vor Mutation abgewiesen.

`LocalMigrationPort` erhält den vollständigen konsistenten Ausgangssnapshot und gegebenenfalls einen dauerhaft bestätigten verschlüsselten Backupbeleg. Vor destruktiven Schritten ist dieser Beleg zwingend: Profil, Bereich, Epoche und Hash des originalen Lesestands müssen übereinstimmen. Ein flüchtig erzeugtes Chiffrat oder bloß gestarteter Download genügt nicht. Der Adapter vergleicht den Ausgangsstand vor Commit atomar erneut; konkurrierende Änderungen verlangen einen neuen Snapshot und neuen Backupbeleg. Fehlender Schlüssel, Backupfehler, Abbruch oder Migrationfehler erhält den Originalbestand. Backup verwendet dieselbe geprüfte atomare Exportbasis aus #79 und SnapshotProtectionPort; keine Klartextdatei und keine automatische Entwurfsübernahme. Konkrete Umsetzung und echte Fehler-/Neustartbelege bleiben #82.

## Öffentliche Serverpersistenz

`ServerPersistencePort.runAtomic` bietet CiphertextStore und öffentliche Verwaltung über denselben Transaktionskontext. Beide werden zusammen committed oder zusammen verworfen. SQL, Treiber, Tabellen, Pools, Dialekte und Sperren verlassen den Adapter nicht. Der Server importiert keinen Finanzfachkern und entschlüsselt nichts.

Operationsschlüssel bindet Bereich, Epoche und Operations-ID. Gleiche ID mit gleichem Hülleninhalt liefert dasselbe Receipt; abweichender Inhalt liefert `OPERATION_ID_REUSED`. Opaque Heads, Chiffrathash und erwartete Revisionen werden per CAS geprüft. Operationsinhalt, Verwaltungs-/Rosterdaten, Receipt und Folgekursor dürfen keinen getrennten Teilcommit erhalten. Snapshot-/Seitenlesen erfolgt aus einem konsistenten Lesestand; stabile Cursorsortierung und Seitenlimit gehören zum Vertrag, die technische Isolation zum Adapter.

`CommitOutcome` unterscheidet `committed`, sicher `notCommitted` und `unknown`. Nur kontrolliert wiederholbare technische Fehler erlauben die begrenzte Wiederholung der gesamten Transaktion mit unveränderter Operations-ID; ein fachlicher Konflikt oder unklarer Commit erlaubt keinen neuen unabhängigen Write. Nach unklarem Commit wird zuerst das Receipt derselben Operation ermittelt. Rechte und signierte Manifestketten werden anhand Sitzung und öffentlicher E2EE-Verträge geprüft, niemals aus einer beliebigen vom Client angegebenen Serveridentität abgeleitet.

K06 konkretisiert diese Portgrundlage für die vollständige öffentliche Verwaltung und P8-/P9-Persistenz; K07–K09 implementieren echte SQL-Adapter. Dies implementiert keine weiteren Authentifizierungs-/Aufnahme-/Rotations-/Syncabläufe aus P8/P9. Lokale Migration #82 und Betreiberwechsel #101 bleiben verschiedene Verfahren; Serverexports bewahren ausschließlich vorhandene Chiffrate/öffentliche Metadaten.

## Abnahmegrenzen

#92/K01 ist ein historischer Vertragsbeleg; die tatsächlich ausgeführte K03/K04-Finanzbindinggrundlage ist zusätzlich vorhanden. Neue typisierte Verträge, Rust-Anwendung, DAL und Server benötigen eigene aktuelle native/Binding-/Datenbankbelege. [Gesamtübersicht #114](https://github.com/mpwg/WiMM/issues/114) bleibt bis zur vollständigen Zielabnahme offen.

## Gemeinsame Vertragsquelle und Zustandsports

Typisierte Rust-Newtypes/tagged unions sind Quelle für Fach-, Anwendungs- und generierte Sprachtypen/Formschemas. Private Fachverträge, öffentliche Serverhüllen und ORMmodels bleiben getrennt. Die etablierte Generierung muss safe nutzbar, reproduzierbar und auf Drift prüfbar sein. Unbekannte Version/Format scheitert vor Mutation; historische V1-Bindingverträge werden gemäß ADR-060 entfernt.

Die vollständige bestehende private Rust-Formquelle liegt in `wimm-finance-types`, unabhängig von Fachhandlern und Plattformadaptern. Der Kern reexportiert die bisherigen Modulpfade. Geschützte Werte und Serde-/Schemaformen bleiben unverändert; fachliche CAS-/Referenz-/Projektions-/Befehlsregeln verbleiben im Kern. Öffentliche Server- und lokale Speicherquellen bleiben getrennt von diesen privaten Finanzformen.

Die Rust-Anwendung besitzt Profil-/Bereichskontext, Historie und Commitpipeline; Bindings rufen Anwendungsaktionen auf und abonnieren versionierte Zustandsereignisse. Native Runtime bzw. Browserworker hält den vollständigen aktuellen Mutationsbestand. Ansichtsports liefern begrenzte stabile Seiten und fachlich berechnete Summen; keine UI-/SQL-Fachberechnung. Projektionscache bindet Ausgangsrevision und Projektionsversion; stale Cache wird kontrolliert neu aufgebaut.

## Lokale Commitidentität und strukturierte Ergebnisse

Der neue lokale Commitvertrag bindet Profil, Bereich, Epoche, Operations-ID und unveränderten Inhalt. Er ergänzt den bisherigen void-AtomicBatch-Port durch dauerhaftes Receipt und Ergebnisabfrage. Aggregate, Finanzrevision, Outbox/Originalentwurf, Projektionen und Receipt werden gemeinsam committed. Standalone erzeugt keine Serveroutbox; lokales Receipt bestätigt nur lokalen Erfolg.

`committed`, sicher `notCommitted` und `unknown` sind unterscheidbar. Bei verlorener Antwort zuerst dieselbe ursprüngliche Operation abfragen; gleiche ID/Inhalt idempotent, anderer Inhalt abweisen. Kein neuer Write mit neuer ID als Antwort auf unklaren Ausgang. Abbruch nach Commit bleibt committed. Codes sind stabil und unabhängig von deutschen Meldungen; Fehler enthalten keine Finanzpayloads oder Schlüssel. Aufbewahrung, Restore und Epochenbindung lokaler Receipts sind Bestandteil AR04 und einer registrierten gesicherten Storageversion.

## Kryptografie-, Laufzeit- und Backendgrenzen

Clientcryptoports kapseln etablierte libsodium-Primitive nativ/WASM und bewahren aktuelle Suite/KDF/AAD/Domain-Separatoren/Recovery/Export. Private Schlüssel bleiben clientseitig; öffentliche Server-Signaturprüfung unabhängig. Kein eigener unsafe-FFI-Wrapper. ORM-/VFS-/DSL-/Bindingeignung muss praktisch nachgewiesen sein; bei fehlendem Nachweis Rückfrage vor Ersatzwahl.

Lokale und öffentliche Servermigrationen verwenden getrennte Modelle/Journale auf gemeinsamem technischem Unterbau. API und Serverports sind unabhängig von Axum/SQL. Blockierende ORM-Arbeit wird begrenzt ausgeführt; Worker-/Tab-/HTTP-Abbruch darf kein tatsächliches Commitresultat erfinden. Build-/Binding-/Fach-/Storage-/Crypto-/Protokollkompatibilität wird vor Assetupdates/Migration geprüft, Epoche bleibt separate Dimension.

## Strukturierte Speicherfehler — AR03

[AR03 #117](ar03-errors.md) überträgt StorageFailure mit Bindingversion 2, stabilem Code und Commitstatus notCommitted/unknown über Rust/Tauri/WASM und native Sprachbindings. Keine Nutzdaten/Secrets/Diagnosetexte in der Hülle; deutsche Meldungen ausschließlich im Client. Unbekannte/manipulierte Antworten gelten als unklar, sperren Wiederholungswrites und bestätigen weder Entwurf noch Historie. Durable Operationsreceipts bleiben AR04.

## AR04 — Private DAL-Checkpoints und Abbruch

`LocalCommitCheckpoint` mit expliziter Checkpointversion eins und physischer Schemaversion eins ergänzt den vollständigen konsistenten Datenstand um ursprüngliche Request-/Receipteinträge. Dies erweitert weder den alten `LocalSnapshot` noch Nutzerexporte oder Serverreceipts. Das initiale Commitstore-Schema eins besitzt noch keine bestätigten/Syncdaten und weist solche Checkpoints ab. Bei vollständigem DAL-Ausbau ist eine ausdrücklich neue unterstützte Form erforderlich; kein stilles Weglassen.

`SnapshotProtectionPort<S = LocalSnapshot>` erhält sein altes Defaultverhalten und schützt zusätzlich die neue Checkpointform über die vorhandene AR08-Primitive. `BackupReadPort` ergänzt den vorhandenen BackupPort um das tatsächliche Rücklesen. Vor destruktivem Restore: Originalcheckpoint unter konsistentem Lesestand erfassen, verschlüsseln, dauerhaft speichern und bytegleich rücklesen; Receipt muss Profil/Bereich/Epoche und Hash des gesamten ursprünglichen Checkpoints binden. Vor Ersatz wird dieser Checkpoint unter SQLite-Transaktion erneut vollständig verglichen. Fehlende Sicherung/Schlüssel, falscher Kontext, Validierungs-/Backupfehler, Abbruch oder CAS-Konflikt erhält den Originalbestand. Neue Restoreepoche wird vom autorisierten Client vorbereitet; kein Backend-Epochenwechsel ohne Auftrag. Historische Receipts bleiben unverändert abfragbar, kollidierende Inhalte werden abgewiesen.

`CancellableLocalCommitPort` beobachtet Abbruch vor einem neuen Write und vor COMMIT. Bekannte Receipts werden zuerst als ursprüngliche Ergebnisse ermittelt. Nach tatsächlichem COMMIT bleibt das Ergebnis committed; verlorene Zustellung bleibt unknown und verlangt Ergebnisabfrage. Das DAL erfindet keinen Rollback aus verspätetem Abbruch. ADR-055, [Abnahme](ar04-local-receipts.md).

## AR05 — Verbindliche produktive Umschaltung

ADR-056 übernimmt die ausdrückliche Nutzerwahl: #119 muss bereits produktiv alle bestehenden mutierenden Anwendungswege durch denselben Rust-Commitdienst führen. #139 liefert frühe gemeinsame typisierte Commit-/Laufzeitports, #108/#109 den geprüften vollständigen DAL und die Aktivierungspakete die sichere Zielinitialisierung und Updates. Bibliotheks-/Memoryprüfungen schließen #119 nicht ab. Die weitergehenden Profil-/Key-/Anwendungsabläufe in #120 verwenden diese geprüften Schreibpfade, statt eine zweite Orchestrierung zu bauen. Die aktuellen typisierten Finanz-/E2EE-/Speicherverträge sowie Update-/CAS-/Receipt-/Backup-/Leistungsgrenzen bleiben verbindlich; alte Binding-/Schemaadapter werden gemäß ADR-060 vollständig entfernt.

## AR05 — Private Anwendungswiederanlaufreferenz

ClientRuntime koordiniert den vollständigen konsistenten MutationReadPort, lebenden Kontext, Abbruch, Kryptografie-/Journal-/Commitports und Sitzungshistorie. Vor jeder Mutation prüft der Fachkern den vollständigen aktuellen Bestand. Lokal per Receipt gespeicherte Ansichtsstände und ausstehende unklare Aktion bleiben getrennt; ein lokales Receipt ist keine Serverbestätigung. Nur aktueller inhaltsgebundener Commit übernimmt Ansicht/Historie, ohne erneute Bestandsabfrage nach Commit. Späte Antworten bestätigen den ursprünglichen Write und liefern keine neue Ansichtsfreigabe. Seiten lesen ausschließlich unter passendem lebendem Kontext und sind auf 100 Aggregate begrenzt; Indizes/Filter/Leistung sind weitergehende AR07-Kriterien. Zustandsbehaftete Sprach-/WASM-/Produktbindung bleibt nach der nativen Runtimegrundlage separat offen.

Die frühe eigene Anwendungs-V2-Quelle `wimm-client-application::api` exportiert prepare_application_v2 mit genau einem Binding-/Fachheader, typisierten Normal-/Gegenbefehlsdaten, Kontext und Bereichsmodus. Kernrequests werden aus denselben typisierten Fachfeldern konstruiert; keine JSON-Befehlsrekonstruktion oder abgeschwächte Kernversionsprüfung. prepared/unchanged/rejected ist ausschließlich Vorbereitung, kein Commitresultat. Rust erzeugt das getrennte application-v2-SDK und dessen Formschemas. Runtime-/Bestands-/Ansichts-/Commit-/Receipt-/Historienports werden darauf aufbauend geprüft; diese Vorbereitungsgrenze ersetzt keine produktive Pipeline oder persistente Runtime.

ADR-057 ergänzt eine eigene private RecoveryTicket-Version eins mit ursprünglichem CommitContext, erwartetem LocalCommitReceipt und verschlüsseltem Originalauftrag. Sie erweitert keine bestehende Snapshot-/Export-/Checkpoint-/Serverform. Der vorhandene generische SnapshotProtectionPort schützt den LocalCommitRequest über etablierte Clientkryptografie; Anwendung und Journalport erhalten keine privaten Schlüssel.

RecoveryJournalPort speichert profilgebunden dauerhaft per save-if-absent, liest tatsächlich zurück und entfernt ausschließlich den exakt erwarteten Datensatz per CAS. Vor erstem Finanzwrite müssen authentifizierter Originalvergleich und Journalrücklesen bestehen. Wiederanlauf prüft dieselbe Inhalts-/Identitäts-/Revisionsbindung und liest ausschließlich das ursprüngliche Receipt. Fehlendes Receipt, Lesefehler, falscher Schlüssel oder abweichender Inhalt erhält Referenz und Writesperre. Cleanupfehler nach tatsächlichem Commit hebt dessen Bestätigung nicht auf. Sitzungshistorie bleibt flüchtig. Physischer Journaleinbau, Schlüssel-/Runtimelaufzeit und Sicherungs-/Migrationsintegration werden im vollständigen DAL geprüft; keine automatische Produktumschaltung aus einer Datei-Testfixture.

## Erste native physische Receipterweiterung — historischer Stand

[ADR-058](decisions.md#adr-058--native-receipterweiterung-mit-sperre-älterer-writer) trennt die registrierte native Erweiterung eins und den physischen DB-Marker drei von der erhaltenen bisherigen logischen Snapshotform eins/zwei und Fachschema eins. Der tatsächliche rückgelesene verschlüsselte Originalvergleich aller betroffenen Bereiche geht der atomaren DDL-/Journalaktivierung voraus. Integrierte lokale Originalreceipts und profilgebundene Recoverybytes benutzen denselben Writer; Ticketinterpretation und Verschlüsselung bleiben Anwendungsports. Bestehende Nutzerexport-/Binding-/Cryptoformen werden nicht still erweitert. Vollständige receiptfähige Checkpoint-/Restore- und Produktintegration sind weiterhin offene [DAL03-Kriterien](dal03-native.md), kein Abschluss aus der Schemaerweiterung.

## Vollständiger Checkpoint und lokaler Restore

[ADR-059](decisions.md#adr-059--lokale-schreibepoche-getrennt-von-bestätigter-serverepoche) trennt lokale Schreibepoche und bestätigte Serverepoche. Gemäß [ADR-060](decisions.md#adr-060--zielimplementierung-ohne-legacy-komponenten) verwendet der native DAL ausschließlich den direkt vollständig initialisierten physischen Stand fünf. Die historische Drei-/Vier-Erweiterung und ihre Upgradepfade sind entfernt. `LocalCheckpointV2` enthält Checkpointversion zwei, ausschließlich physischen Stand fünf, aktuellen logischen Snapshot, lokale Schreibepoche, historische Originalreceipts und optionale nichtnullable Recoverybytes. Die alte Checkpointform eins ist kein Zieladapterformat und wird mit den übrigen alten Binding-/Probeformen unter #146 entfernt.

`backup_checkpoint_v2` liest den gesamten Checkpoint konsistent, prüft den tatsächlichen Fach-/Cacheport, verschlüsselt ihn und verlangt dauerhaftes bytegleiches Rücklesen samt tatsächlichem Entschlüsseln/Originalvergleich. `LocalCheckpointRestoreV2` bindet vollständigen Ausgangscheckpoint, bestätigtes Originalbackup, Zielchiffrat und eine ausdrücklich neue lokale Schreibepoche. Restore vergleicht den vollständigen Originalcheckpoint unter einer Schreibtransaktion einschließlich aller Receipts und der profilweiten Wiederanlaufreferenz. Historische Receipts werden erhalten beziehungsweise kollisionsfrei ergänzt; ein vorhandener ungelöster Originalauftrag bleibt erhalten und wird niemals durch einen anderen ersetzt.

Verbundener Restore erhält die aus der geschützten Sicherung stammenden Serverbestätigungen/Epoche/Cursor. Nur die lokale Writeidentität rotiert. Standalone bleibt ohne Servercursor. Native Runtime-/Bindinghosts müssen ihren `CommitContext` und die mutierende Scopeprüfung aus der lokalen Schreibepoche bilden, unabhängig vom Snapshot-/Syncbezug. Vollständige Runtime-/Tauri-/Browserintegration und Konformität bleiben die folgenden #108/#109/#119-Abnahmen.
