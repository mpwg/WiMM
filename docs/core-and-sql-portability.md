# Gemeinsamer Rust-Fachkern und austauschbare SQL-Datenbanken

## Auftrag, Ziel und Stand

Am 8. Oktober 2026 hat der Nutzer das Architekturziel und die Erstellung dieses Konzepts einschließlich GitHub-Issues bestätigt. Mit anschließendem ausdrücklichem Nutzerauftrag vom selben Tag ist auch die Produktimplementierung und Abnahme von #91/K01–K11 freigegeben; maßgeblich sind [Aufgaben](tasks.md). Die bisherigen Konzeptbelege bleiben historische Planungsbelege.

Ziel ist eine gemeinsame Finanzlogik für Web und vollständig native Oberflächen sowie austauschbare SQL-Serverdatenbanken: zunächst SQLite, PostgreSQL und MySQL, später weitere Adapter mit denselben Garantien. Desktop bleibt lokal mit SQLite, die PWA mit IndexedDB offlinefähig. Serverdatenbank und lokale Clientdatenbank sind getrennte Entscheidungen.

Der aktuelle Code enthält einen TypeScript-Fachkern, Clientkomposition und Anwendungsabläufe in `packages/ui`, IndexedDB-Speicher sowie eine begrenzte Rust-/SQLite-Brücke. Der Server stellt bisher nur Health-/Metadatenrouten bereit. Die [K03-Grundlage](handoffs/k03-2026-10-08.md) liefert inzwischen einen eigenständigen Rust-Referenzkern mit tatsächlichen Rust-/WASM-/Swift-/Kotlin-Aufrufen. Vollständige Fachengine/Produktumschaltung und PostgreSQL-/MySQL-Adapter bleiben weitere offene Implementierung.

Die [Architektur](architecture.md) unterscheidet Bestand und Ziel; ADR-042–ADR-044 in den [Entscheidungen](decisions.md) begründen den Übergang. Eine vollständig native Produktoberfläche und neue mobile Store-Apps werden durch dieses Konzept nicht beauftragt.

Die [K01-Verträge](core-contracts.md) und `packages/contracts` bilden die konkrete plattformfreie Grundlage für die freigegebene Umsetzung. Sie ersetzen keine tatsächliche Rust-/WASM-/Bindingabnahme.

## Verantwortung und Abhängigkeitsrichtung

| Schicht | Verantwortung | Schnittstelle und Grenze |
| --- | --- | --- |
| Rust-Fachkern | Geld, Kalenderdaten, Finanzaggregate, Befehlsprüfung, Änderungsberechnung und Projektionen | Bestand, Befehl, IDs und Zeitpunkt hinein; geprüfte Änderungsmenge oder strukturierter Fachfehler heraus. Keine UI, Datenbank, HTTP oder Tauri. |
| Anwendungsschicht | Laden, Befehlsausführung, atomare Speicherung, Historie, Profil-/Bereichswechsel und Importkoordination | Eigenes Paket außerhalb der UI, zunächst TypeScript; injizierte Ports. Native Clients verwenden dieselben dokumentierten Abläufe. |
| Sprachbindungen | WebAssembly für Web, direkter Rust-Aufruf in Tauri, Swift-/Kotlin-Bindings für spätere native Clients | Etablierte Bindings mit typisierten Ein-/Ausgaben; keine zusätzliche Fachengine pro Sprache. |
| Speicherports | Lokaler Finanzspeicher, Profilpersistenz, serverseitiger CiphertextStore und öffentliche Verwaltung | Getrennte Verträge; atomare Operationen und strukturierte Fehler, keine SQL-/Treiber-/Tabellenobjekte. |
| Adapter | Lokales SQLite/IndexedDB, Server-SQLite/PostgreSQL/MySQL, Plattform- und Hintergrunddienste | Konkrete Treiber, SQL-Dialekte, Indizes, Migrationen, Dateizugriff, Schlüsselablage und Ausführung. |
| Oberfläche | Darstellung, Navigation, Fokus, Eingabeentwürfe und verständliche Meldungen | Anwendungsaktionen aufrufen und Ergebnisse/Status darstellen; keine verbindlichen Finanzberechnungen oder Persistenzdetails. |

Apps bilden den Composition Root und injizieren Anwendung, Speicher- und Plattformdienste. Die Anwendung nutzt Fachkern und Ports; Adapter erfüllen diese Ports. Die Clientkomposition wird aus `packages/ui` herausgelöst. Finanzberechnung und dauerhafte Speicherung bleiben getrennt; Erfolg einer Schreibaktion bedeutet bestätigten lokalen Commit, keine implizite Serverbestätigung.

`FinanceModel`, Speicherung/Konfliktbehandlung in React-Callbacks, `FinanceHistory`, Profiltypen/-abläufe und Importkoordination gehören außerhalb der UI. Browser-Worker, `localStorage`, Web Locks, Tauri-Aufrufe, Uhr und ID-Generator werden über Adapter beziehungsweise injizierte Abhängigkeiten angebunden. Fachliche Regeln für Gegenbefehle bleiben im Rust-Fachkern; der Historienstapel ist Anwendungssitzungszustand.

Die Anwendungsschicht bleibt zunächst TypeScript. Rust-Wiederverwendung spart die erneute Finanzimplementierung in nativen Clients; native Ablaufkoordination muss anhand derselben Ablaufverträge integriert und geprüft werden. Die TypeScript-Anwendung wird nicht als automatisch in Swift/Kotlin nutzbar bezeichnet.

## Rust-Migration und sprachübergreifende Verträge

Der Rust-Fachkern liegt als eigenständige Bibliothek außerhalb des Tauri-Appcrates. Er verarbeitet vollständige Befehle und Bestände und liefert vollständige atomare Änderungsmengen. IDs und Zeit werden injiziert; identische Eingaben erzeugen identische Ergebnisse auf allen Clients.

Geld bleibt ganzzahliger Cent innerhalb der bisherigen sicheren Ganzzahlgrenzen. Rust prüft auch Summen und gewichtete Zwischenwerte und verwendet ausreichend breite exakte Ganzzahlrechnung. Der größere Wertebereich nativer Integer erweitert nicht still den Fachvertrag. Kalenderdaten, Monate, Rundung, Restcent und stabile Reihenfolgen folgen unverändert dem [Fachmodell](domain.md).

Bestehende Daten-, Snapshot-, Export- und Cryptoformate bleiben kompatibel. Bindings übertragen optionale Felder, IDs und Fehler ohne Rundungs-/Präzisionsverlust. Ein nötiger Vertragswechsel verlangt eine eigene dokumentierte Migration vor Umschaltung.

Zuerst werden ein Referenzbefehl und Fehlerfälle nativ, über WASM und in Swift-/Kotlin-Testharnesses nachgewiesen. Anschließend werden ausschließlich vorhandene Fachfunktionen portiert, einschließlich Importgruppenvorbereitung, Regeln, Dauerzahlungen und Gegenbefehlen. Etablierte Dateiparser bleiben hinter Adaptergrenzen; der Auftrag erteilt keine Freigabe für eigene Parser oder bislang nicht implementierte P6–P11-Funktionen.

TypeScript dient während der Migration als Vergleichsreferenz, ergänzt durch die verbindlichen Sollfälle und behobenen Fachfehler. Nach bestandener Fach-/Integrationsabnahme werden Web und Tauri umgestellt und die produktive TypeScript-Fachengine entfernt. Typisierte Wrapper bleiben erlaubt; zwei dauerhaft parallel gepflegte Finanzengines sind ausgeschlossen.

## SQL-Unabhängigkeit auf dem Server

Der gemeinsame `CiphertextStore` und ein separater öffentlicher Verwaltungsport teilen für zusammengehörige Vorgänge dieselbe Transaktion. Verwaltungsdaten, signierte Manifeste, Chiffrate, Receipts, Änderungslog und Folgekursor dürfen nicht unabhängig teilcommittet werden. Aufnahme-/Rotationsvorgänge folgen weiterhin [P8](p8-server.md), Transport und Mehrgeräteabläufe [P9](p9-sync.md); deren weitergehende Produktabläufe bleiben gesondert freizugeben; der K-Auftrag umfasst die beschriebenen Persistenzgrundlagen.

Alle Adapter garantieren atomare Speicherung, CAS-Revisionsprüfung, eindeutige Operations-IDs, konsistente Leseseiten/Snapshots und dauerhafte bestätigte Commits. Technische Wiederholungen betreffen vollständige Transaktionen und dieselbe Operations-ID. Fachliche Konflikte, abweichender Inhalt unter derselben Operations-ID und unklarer Commitausgang werden ausdrücklich behandelt; kein stilles Überschreiben oder blindes erneutes Neuanlegen.

SQL, Tabellen, Treiber, Pools, Sperren, Isolation, Deadlock-/Busy-Behandlung und Indizes bleiben adapterintern. Gemeinsame Verträge hängen weder von herstellerspezifischen JSON-Abfragen noch von Default-Collations oder automatisch vergebenen Finanz-IDs ab. MySQL verwendet ausschließlich transaktionsfähige InnoDB-Tabellen für diese Vorgänge. Datenbankversionen und Bibliotheken werden bei der Implementierung anhand Reifezeit, Lizenz und Kompatibilität geprüft und exakt festgelegt.

SQLite bleibt Standard und Referenzadapter; PostgreSQL und MySQL erfüllen dieselbe Serverkonformitätssuite gegen echte Datenbanken und parallele Verbindungen. Weitere SQL-Datenbanken benötigen einen eigenen Adapter und dieselben bestandenen Prüfungen. MariaDB ist nicht allein aufgrund von MySQL-Kompatibilität automatisch unterstützt. Die Wahl einer SQL-Serverdatenbank erteilt keine Cluster-/Mehrinstanzfreigabe.

Die Transaktionsstrategien können sich unterscheiden. Maßgeblich sind gemeinsame beobachtbare Garantien, nicht identische SQL-Anweisungen. Grundlagen: [SQLite-Transaktionen](https://www.sqlite.org/lang_transaction.html), [PostgreSQL-Isolation](https://www.postgresql.org/docs/18/transaction-iso.html), [MySQL-/InnoDB-Transaktionen](https://dev.mysql.com/doc/refman/8.0/en/innodb-autocommit-commit-rollback.html).

## Datenbankwechsel, Sicherheit und E2EE

Ein Wechsel erfolgt bei angehaltenen Schreibzugriffen über ein versioniertes Betreiberexportformat. Nach Sicherung wird ein leeres, kompatibles Ziel vorbereitet. Öffentliche Verwaltung und verschlüsselte Serverbestände werden übertragen und auf Vollständigkeit und Integrität geprüft; erst danach wird umgeschaltet. Die Quelle bleibt bei Abbruch erhalten. Betriebsanleitung und geprüfter Restore beschreiben den Rückkehrpfad.

Chiffrate, signierte Hüllen/Manifeste, IDs, Revisionen, Operations-IDs, Receipts, Epochen und Cursor bleiben byte-/wertgetreu erhalten. Der Betreiberexport ersetzt weder Nutzerexport noch lokale SQLite-/IndexedDB-Migration. Alle sechs gerichteten Wechsel zwischen SQLite, PostgreSQL und MySQL werden geprüft.

Finanzregeln laufen ausschließlich auf autorisierten Clients. Der Server importiert keinen Finanzfachkern und speichert keine Finanzklartexte, privaten Schlüssel oder Finanzprojektionen. SQL-Adapter prüfen Persistenzgarantien sowie öffentliche Hüllen/Rechte/CAS gemäß [E2EE](encryption.md), [API](api.md) und [Synchronisierung](synchronization.md); sie entschlüsseln keine Inhalte.

Die Rust-Migration ändert weder libsodium-Primitiven noch Cryptosuites oder kanonisierte/signierte Formate automatisch. Native Cryptoanbindung ist gesondert anhand bestehender Testvektoren nachzuweisen, bevor eine native Produkt-App angeschlossen wird. Datenbankzugangsdaten werden außerhalb des Repositorys konfiguriert und nicht in Logs, Fehlermeldungen oder Betreiberexporten offengelegt.

## Tracking und Abnahme

GitHub führt Voraussetzungen, Einzelstatus, Fortschritt, Blockaden und Prüfbelege für K01–K11 in der [Gesamtübersicht #91](https://github.com/mpwg/WiMM/issues/91). Dieses Dokument enthält die Spezifikation, keine zweite laufend gepflegte Deltaliste. Die folgende Zuordnung dient ausschließlich als Einstieg in die Issues; Bearbeitungsstand und Abhängigkeiten werden dort gepflegt.

| ID | GitHub-Arbeitspaket |
| --- | --- |
| K01 | [Plattformfreie Anwendungs- und Speicherverträge festlegen #92](https://github.com/mpwg/WiMM/issues/92) |
| K02 | [Clientabläufe aus der React-UI herauslösen #93](https://github.com/mpwg/WiMM/issues/93) |
| K03 | [Rust-Fachkern und Sprachbindungen nachweisen #94](https://github.com/mpwg/WiMM/issues/94) |
| K04 | [Implementierte Finanzregeln nach Rust migrieren #95](https://github.com/mpwg/WiMM/issues/95) |
| K05 | [Web und Tauri auf die gemeinsame Rust-Fachengine umstellen #96](https://github.com/mpwg/WiMM/issues/96) |
| K06 | [SQL-neutrale Serverpersistenz und Transaktionsverträge bereitstellen #97](https://github.com/mpwg/WiMM/issues/97) |
| K07 | [Server-SQLite-Adapter bereitstellen #98](https://github.com/mpwg/WiMM/issues/98) |
| K08 | [Server-PostgreSQL-Adapter bereitstellen #99](https://github.com/mpwg/WiMM/issues/99) |
| K09 | [Server-MySQL-Adapter bereitstellen #100](https://github.com/mpwg/WiMM/issues/100) |
| K10 | [Datenbankwahl und gesicherte Migration zwischen SQL-Systemen ermöglichen #101](https://github.com/mpwg/WiMM/issues/101) |
| K11 | [Architektur- und Kompatibilitätsabnahme abschließen #102](https://github.com/mpwg/WiMM/issues/102) |

Bestehende [#77](https://github.com/mpwg/WiMM/issues/77), [#82](https://github.com/mpwg/WiMM/issues/82) und [#85](https://github.com/mpwg/WiMM/issues/85) bleiben zuständig für den vollständigen lokalen SQLite-Adapter, lokale Migrationen und lokale Adapterkonformität. Bekannte Fachfehler [#73–#76](https://github.com/mpwg/WiMM/issues/87) werden nicht als Sollverhalten in Rust übernommen. Neue Serveradapterissues duplizieren keine lokalen Speicherdeltas.

Abnahme verlangt aktuelle Fachvergleichs-/Grenztests für Rust/WASM, tatsächliche Swift-/Kotlin-Bindings, gemeinsame lokale und Serveradapterprüfungen, alle SQL-Wechsel sowie Web-/Tauri-/Offline-Regressionsnachweise. CAS-Parallelität, Operations-ID-Idempotenz, Fehlerrollback, konsistente Snapshots/Cursor, Neustart und Restore sind verpflichtend. Browserfallback ersetzt keinen nativen SQLite-Nachweis. Fehlende Plattform-/Toolchainnachweise bleiben konkrete offene Kriterien.

Die historische Konzeptabnahme umfasst Dokumentations-/Link-/Konsistenzprüfung und verifizierte Issueverweise. Es liegen noch keine Rust-Migrations-, zusätzlichen SQL-Adapter- oder nativen Bindingnachweise vor. Produkt-, Deployment- und Releasefreigaben ergeben sich daraus nicht.

## Freigegebene Bearbeitungsfolge am 8. Oktober 2026

Nach ergänztem SQLite-Sollbeleg für #75 und minimaler sicherer Versionsabweisung aus #82 folgt zuerst K01. K02 und K03 können danach unabhängig erfolgen; K04 portiert die vorhandenen geprüften Regeln. K05 verbindet die gemeinsame Rust-Engine mit Web und Tauri und benötigt die echte lokale Adapterkonformität #85 sowie den vollständigen Port #77. Finanzreferenzprüfung #86 wird mit der Rust-Validierung umgesetzt und in den echten Adaptern abgenommen; ein zusätzlicher großer TypeScript-Fachausbau wird vermieden.

Die übrige lokale Migrations-/Indexarbeit #82/#83 bleibt verbindlich, wird aber an den K01-Verträgen und tatsächlichen Schemaänderungen ausgerichtet. Browserpersistenz #84 und P4-/P5-Bedienungs-/Parserdeltas bleiben eigenständige Anforderungen. Aufwendige abschließende Plattform-/Screenreader-/Geräteabnahmen werden möglichst auf dem umgestellten Produktstand ausgeführt. K06–K10 zur Server-SQL-Portabilität folgen als eigener Strang und sind keine Voraussetzung für den lokalen Rust-Kern; K11 bleibt der Abschluss aller K-Kriterien.
