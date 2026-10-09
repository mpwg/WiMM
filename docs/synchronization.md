# Synchronisierung und Konflikte

Architekturstand 9. Oktober 2026: [gemeinsames Rust-Ziel](architecture.md), [Review](architecture-review.md), [Freigaben](tasks.md). Diese funktionalen Verträge bleiben verbindlich; neue Zielkomponenten sind noch nicht implementiert.

## Grundprinzip

Lokale Speicherung ist der erste dauerhafte Schreibpunkt. Clients berechnen und prüfen Fachbefehle, verschlüsseln Ergebnisse und signieren Nachrichten. Der Server prüft Anmeldung, öffentliche Rechte/Signaturen und opake Revisionen, niemals Finanzinhalte. Optimistische Entwürfe bleiben getrennt. Sichtbarer Zustand = clientvalidierter bestätigter Stand plus anwendbare lokale Entwürfe. [E2EE ist verpflichtend](encryption.md).

Jeder Bereich besitzt eigene Epoche und Cursor. Ein Cursor ist eine dezimale Ganzzahl als JSON-String, nicht eine globale Anzahl fremder Haushaltsänderungen. Snapshot und Änderungen enthalten nur den autorisierten Bereich. Die Mitgliedschaftsliste wird separat über Verwaltungs-API aktualisiert.

## Entschlüsseltes Fachoperationsformat v1

Das folgende Beispiel ist ausschließlich Client-intern. Es wird nicht im Klartext übertragen. Auf dem Draht liegt die EncryptedOperation aus der Verschlüsselungsspezifikation mit opaken Handles statt aggregateType/Finanzreferenzen im öffentlichen Header.

```json
{
  "operationId": "00000000-0000-4000-8000-000000000101",
  "deviceId": "00000000-0000-4000-8000-000000000201",
  "spaceId": "00000000-0000-4000-8000-000000000301",
  "epoch": "00000000-0000-4000-8000-000000000401",
  "schemaVersion": 1,
  "commandType": "transaction.save",
  "expectedRevisions": [{ "aggregateType": "transaction", "id": "00000000-0000-4000-8000-000000000501", "revision": 0 }],
  "dependsOn": [],
  "payload": {
    "id": "00000000-0000-4000-8000-000000000501",
    "accountId": "00000000-0000-4000-8000-000000000601",
    "date": "2026-10-02",
    "amount": -1001,
    "kind": "normal",
    "clearance": "uncleared",
    "splits": [{ "id": "00000000-0000-4000-8000-000000000701", "categoryId": "00000000-0000-4000-8000-000000000801", "amount": -1001 }]
  }
}
```

Fachoperation samt vollständigem Änderungsset wird clientseitig validiert, verschlüsselt und mit zertifiziertem Geräteschlüssel signiert. Server prüft Sitzungszugehörigkeit, Manifest und deklarierte CAS-Revisionen; er setzt nur Transportcursor/-empfangszeit, keine signierten Finanzfelder. Vollständige Hülle einschließlich Nonce/Signatur bleibt nach erstem Sendversuch unverändert. Hash/RFC-8785-Kanonisierung gemäß E2EE-Vertrag; der Server hasht nur die verschlüsselte Hülle.

## Zustände und lokale Änderungen

Outboxzustände: `queued`, `sending`, `accepted`, `conflict`, `blocked`, `forbidden`, `invalid`. Vor Serverkontakt wird der Originalentwurf gespeichert. Ein Transportfehler setzt `sending` wieder auf `queued`; Neustart tut dasselbe für unterbrochene Vorgänge. `accepted` wird mit dem bestätigten Stand atomar entfernt bzw. als lokale Historie markiert.

Bei mehreren Entwürfen auf demselben Aggregat werden Vorgängeroperationen in `dependsOn` vermerkt. Vor dem ersten Sendversuch bindet der Client die erwartete Revision an das bestätigte Vorgängerergebnis. Bereits gesendete Operationen werden niemals umgeschrieben. Der Scheduler sendet nur Operationen mit bestätigten Vorgängern. Unabhängige Aggregate können gleichzeitig fortschreiten.

Wenn Pull einen ausstehenden Entwurf überholt, wird dessen Basis geprüft. Ändert sich das gleiche Aggregat außerhalb seiner bekannten Vorgängerkette, entsteht ein Konflikt. Keine automatische Feldverschmelzung für Buchungen, Splits, Budgetmonate oder Verteilungen. Ein Konflikt blockiert abhängige Entwürfe, nicht den gesamten Bereich.

## Push: Ablauf und Atomizität

1. Sitzung, Bereichszugriff und Protokoll prüfen; fremde Bereiche mit 404 beantworten.
2. Batchgrenzen und Operationsformat prüfen; pro Operation die aktuelle Schreibberechtigung prüfen.
3. Receipt anhand Bereich/Epoche/Operations-ID suchen. Identischer Hash liefert das gespeicherte Ergebnis; abweichender Hash ergibt `OPERATION_ID_REUSED`.
4. Erwartete Revisionen und bestätigte Vorgänger prüfen; stale Operation ergibt `conflict`, unbekannter Vorgänger `DEPENDENCY_NOT_ACCEPTED`.
5. Gerätezertifikat, Signatur, signiertes Rollenmanifest und aktuelle K-Version prüfen; Fachpayload bleibt opak.
6. Opake Aggregatheads, verschlüsseltes Änderungsbundle, Change und Receipt in einer SQLite-Transaktion committen. Fehler rollt vollständig zurück.
7. Ergebnis mit CAS-Revisionen und unverändert verschlüsselten Bundles liefern. Verbindungsabbruch nach Commit ist durch Wiederholung sicher. Empfänger prüfen/entschlüsseln/validieren Inhalte selbst.

Batch bis 100 Operationen und 2 MiB; jede Operation ist atomar, der Batch insgesamt nicht. Der Server verarbeitet in Eingabereihenfolge. Bereits akzeptierte Operationen werden bei nachfolgendem Fehler nicht zurückgerollt. Für Konflikte/Invalidität bleibt die ursprüngliche Operation abgeschlossen; Auflösung erhält neue ID. Temporäre Transport-/Storagefehler erzeugen kein endgültiges Receipt.

## Pull und Initialisierung

Pull liefert maximal 500 Changes mit `nextCursor`, `hasMore`, `epoch` und verschlüsselten signierten Bundles. Aggregate/Tombstones sind nur nach Cliententschlüsselung verfügbar. Ein Change bleibt atomar und wird nicht über Seiten geteilt. Initiales Laden verwendet einen clientgeprüften verschlüsselten Snapshot mit gebundenem `snapshotCursor`; anschließend Pull ab diesem Cursor.

Nach Signatur-/AAD-/AEAD-/Fachprüfung werden Seite und Cursor atomar gespeichert. Ungültige Nachrichten werden quarantänisiert, Cursor nicht still weitergesetzt. Ein vertraut gepinnter Hashstand darf nicht auf ältere/abweichende Historie zurückfallen. Absturz vor Commit lässt alten Cursor bestehen; identische bereits angewandte Operationen werden übersprungen, Entwürfe separat gehalten.

Sync bei Start, Fokus, Reconnect und spätestens alle 15 Sekunden bei sichtbarer App. Neue lokale Änderungen lösen einen debouncten Push nach 500 ms aus. Unsichtbare Tabs pollen nicht. Ein Bereich hat nur einen aktiven Synclauf; Browser-Tabs koordinieren dies über Web Locks. Retry exponentiell mit Jitter von 1 bis 60 Sekunden; 401 erfordert erneute Anmeldung beim externen Identitätsanbieter, 403/404 sperren den Bereich statt endloser Wiederholung.

## Konfliktauflösung

Die Oberfläche zeigt bestätigten Stand, lokale Fassung und Art der Abweichung. Optionen: bestätigten Stand übernehmen; lokale Änderungen prüfen und als neuen Befehl gegen aktuelle Revision senden; Entwurf exportieren. Löschen gegen Änderung verlangt dieselbe ausdrückliche Auswahl. Abhängige Entwürfe werden nach Auflösung einzeln neu validiert, nicht blind abgespielt.

Rückgängig/Redo erzeugt Gegenbefehle auf Basis der aktuellen Revision. Es darf keine anderen Personen betreffende Änderungen überschreiben. Mehrere betroffene Aggregate, etwa ein Transfer, werden gemeinsam aufgelöst.

## Rechte und private Veröffentlichung

Rollenänderungen invalidieren serverseitige Berechtigungs-Caches unmittelbar. Von member zu viewer gewechselte Nutzer können pullen, aber ausstehende Writes erhalten forbidden. Entfernte Mitglieder erhalten keine neuen Daten, auch keine Konfliktdetails. Lokal gespeicherte Entwürfe bleiben separat exportierbar. Bereits bekannte Daten können offline nicht ferngelöscht werden.

Private Veröffentlichung erzeugt einen freigegebenen SharedExpense-Datensatz im Haushalt und einen privaten PublicationLink. Kein Push enthält beide Bereiche. Scheitert Haushaltspush, bleibt der Link als rejected/pending und zeigt keine vermeintlich erfolgreiche Veröffentlichung. Der Digest warnt bei späteren privaten Änderungen; Veröffentlichung dieser Änderungen benötigt erneute Zustimmung.

## Snapshotersatz und Epochen

Ersetzen eines Bereichs ist owner/admin-Clientaktion mit Bestätigung, erwarteter Epoche und verschlüsseltem Backup. Der Client prüft Finanzdaten, erzeugt neue zufällige Epoche und signierten verschlüsselten Snapshot. Server prüft öffentliche Autorisierung/Signatur/Container/CAS, aktiviert atomar Epoche/Cursor 0 und startet neue Receipt-/Changehistorie. Alte Operationen erhalten `EPOCH_MISMATCH`. Mitgliedsentfernung rotiert zusätzlich Bereichsschlüssel und signiertes Manifest atomar mit neuem Snapshot.

Clients exportieren oder sichern ausstehende Entwürfe vor Übernahme des neuen Snapshots. Die Oberfläche führt durch die Entscheidung; ohne Platz für Sicherung keine destruktive lokale Übernahme. Fremde Alt-Epochen werden nicht automatisch auf die neue Epoche umgeschrieben. Bewusst übernommene Entwürfe werden neu referenziert und validiert.

## Versionskompatibilität

Server akzeptiert v1-Hüllen und bekannte Cryptosuites; unbekannte Transportversion liefert `UPDATE_REQUIRED`. Clients prüfen entschlüsselte schemaVersion/commandTypes und zeigen unbekannte/ungültige Inhalte ohne Anwendung an. Health/Meta enthält minimale Transportversion, keinen Finanzschema-Downgradefallback. Receipts/verschlüsselte Tombstones bleiben für die gesamte Epoche erhalten. KEY_VERSION_MISMATCH/ROSTER_MISMATCH erfordern aktuelle geprüfte Schlüssel-/Rollenstände, niemals Klartextsync.
