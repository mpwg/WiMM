# Haltepunkt der systematischen Issuebehebung

Stand: 9. Oktober 2026. Auf ausdrücklichen Nutzerwunsch „komm an einem geeigneten punkt zum stopp“ wird der Auftrag nach einem geprüften Abschnitt angehalten. GitHub führt den aktuellen Issuefortschritt; dieser Text ist ein datierter Abnahmesnapshot und Wiederaufnahmepunkt.

## Abgeschlossener Stand

- #95/K04 bleibt vollständig abgenommen; Engineumschaltung #96 bleibt offen.
- [#82](https://github.com/mpwg/WiMM/issues/82), [#83](https://github.com/mpwg/WiMM/issues/83) und [#104](https://github.com/mpwg/WiMM/issues/104) sind mit aktuellen lokalen Belegen und passender grüner CI geschlossen.
- `2746134`: gesicherte registrierte Indexmigration V1→V2, Originalsnapshot-/Backupprüfung, vollständiger atomarer CAS, Journal, Pflichtindizes und typisierte tatsächliche Abfragen. 26 direkte native Rust-Tests, 30 echte SQLite-Vertragsfälle, zwei Browser-Sicherungsfälle und elf echte IndexedDB-Migrations-/Indexfälle bestanden. 50.000 aktive Buchungen, zehn Konten, 100 Kategorien und 36 Monate tatsächlich gesichert/migriert/abgefragt; Abfragegrenzen unverändert erfüllt. [Kriterienmatrix](storage-index-migration-2026-10-09.md).
- `fed5426`: Navigationstest entscheidet erst nach sichtbarer app-shell über das Layout. CI-Trace bestätigt das frühere Race; anschließend 124 tatsächliche Web-/Desktop-Frontend-Speicherintegrationsfälle in 34,2 s bestanden. Kein Retry, Skip oder höheres Zeitlimit. [Kriterienmatrix](ui-navigation-2026-10-09.md).
- Fremde Dokumentationscommits `0d6afc7` und `b1899bf` zum Rust-DAL sind erhalten. DAL01–DAL07/#105–#112 bleiben laut ausdrücklicher neuer Freigabegrenze in tasks.md ausschließlich Konzept/Tracking und nicht zur Implementierung freigegeben. Die bestehende K-/P3-Umsetzung bleibt freigegeben.
- Letzter vollständig grüner CI-Stand: `b1899bfe6d7367ce3427c666bb409f2ed3481d18`; [Prüfung 37891458821](https://github.com/mpwg/WiMM/actions/runs/37891458821), [CodeQL 37891458521](https://github.com/mpwg/WiMM/actions/runs/37891458521). Der nachfolgende Persistenzabschnitt wird mit eigenen lokalen Belegen und separat startender CI gesichert.

## Geprüfter erster Abschnitt von #84

StoragePersistenceApplication trennt requesting/unsupported/granted/denied/error, dedupliziert Anfragen und erlaubt ausdrücklichen Wiederholversuch. Die Webcomposition fragt beim entsperrten lokalen Einstieg die tatsächliche StorageManager-Persistenz an. Die Oberfläche zeigt Ablehnung, fehlende API oder Fehler verständlich; die Einstellungen zeigen den tatsächlichen Status. Desktopcomposition hat diesen Browserport nicht und behauptet keine native Persistenzfreigabe. Keine neue Abhängigkeit oder Änderung von Finanz-/Cryptoformaten.

Vier echte Chromium-/Webfälle bestanden in 6,1 s: tatsächliche Ablehnung mit erhaltenem Bestand; tatsächliche Zusage über die begrenzte CDP-DurableStorage-Berechtigung samt navigator.storage.persisted=true; kontrollierte fehlende-API- und API-Fehler-Simulationen in der echten Oberfläche. Die letzteren sind ausdrücklich Simulationen, keine Behauptung einer tatsächlich fehlenden API in diesem Chromium. Befehl: env -u NO_COLOR pnpm exec playwright test --config tests/storage/persistence.config.ts. Log: test-results/persistence-84-checkpoint-browser.log.

23 Anwendungstests bestanden in 1,59 s, einschließlich sechs Persistenzzustands-/Wiederholungs-/Deduplizierungsfällen und drei neuen Export-/Sitzungsschutzfällen mit tatsächlicher bestehender libsodium-Verschlüsselung und Restore-Roundtrip. exportLocalAreaSnapshot ist als gebundener Anwendungsport vorhanden: aktuell entsperrter ausgewählter Bereich, gemeinsamer Finanz-/Profilgate, validierter Snapshot, temporäre Schlüsselkopie mit Aufräumen, späte Sitzungsergebnisse abgewiesen. Es wurde keine neue Downloadoberfläche oder P10-Dateistruktur aktiviert. Typecheck, vollständiger Lint, Anwendungsarchitektur und Paketgraph bestanden.

## Offene Abnahme und Entscheidungen

[#84](https://github.com/mpwg/WiMM/issues/84) bleibt offen. Der kontrollierte CDP-Quota-Versuch mit overrideQuotaForOrigin=0 hat noch keinen tatsächlichen Schreibfehler erzwungen; daher kein positiver Quota-/Originaleingaben-/Wiederholungsbeleg. Die roten Versuchslogs und der vollständige eigene Versuch sind unter test-results/persistence-84-quota.log, test-results/storage-persistence und test-results/persistence-84-quota-diagnostic.spec.ts erhalten. Dieser Diagnoseversuch ist nicht als bestandener Test, neuer Skip oder vollständige Abnahme in die vier grüne Statusfälle aufgenommen. Quota-Fehlererkennung des produktiven Adapters wurde für diesen Haltepunkt nicht unbewiesen verändert.

Noch offene Nutzerfrage: bestehenden verschlüsselten P3-Bereichsexport mit klarer Grenze jetzt als Download anbieten oder Download erst mit P10 einführen? Der Bereichsexport enthält keinen Tresor; Wiederherstellung benötigt den separat erhaltenen passenden Tresor. Bis zur Entscheidung bleibt die Downloadoberfläche unverändert. Keine P10-Gesamtsicherung aus #84 ableiten.

[#113](https://github.com/mpwg/WiMM/issues/113) führt den zusätzlichen aktuellen CI-Befund: im Lauf 37890656786 auf fed5426 überschritt der vorhandene 100.000-CAMT-/Vorschaufall 15.000 ms mit 16.660 ms. Der spätere grüne Lauf auf b1899bf repariert diese gemessene Instabilität nicht. Ursache profilieren und bestehenden Parser/Fristen/Ressourcenlimits erhalten; kein pauschales Timeoutupdate. Umsetzung wurde am Haltepunkt nicht begonnen.

Verbleibende Speicherkriterien und Folgearbeiten bleiben in #84/#86/#85/#77 und #87, Produktumschaltung in #96, P5-Deltas in #58–#62/#71, Herkunftsregister in #72 und Serverpersistenz/Wechsel in #97–#102. Keine vollständige P1–P5-/Native-/Geräteabnahme behauptet. Nutzerantwort vom 9. Oktober: zunächst alle freigegebenen Arbeiten auf diesem Mac erledigen; fehlende Windows-/Linux-/Intel-Mac-/physische iOS-Belege offen halten. Globale eigene Rust-Unsafe-Sperre und direkte Rust-Assertions bleiben verbindlich.

## Wiederaufnahme

Zuerst AGENTS.md, aktuelle Aufgaben und diesen Snapshot lesen, Arbeitskopie/Gitstatus/Remote/Issues prüfen und fremde Änderungen erhalten. Erst bei erneutem Fortsetzungsauftrag arbeiten. Nächster konkreter Abschnitt: #84 Quota tatsächlich erzwingen und Originaleingaben/Bestand/retry belegen; offene Downloadpräferenz klären. Danach #86 verbindliche gemeinsame Rust-Validierung, #85/#77 vollständige echte Adapterkonformität und aktuelle #75/#78/#79/#80/#81-Nachprüfung, anschließend K05/#96 in der freigegebenen Reihenfolge. #113 in den P5-/CI-Belegen nacharbeiten. DAL01–DAL07 ohne gesonderte Implementierungsfreigabe nicht beginnen.
