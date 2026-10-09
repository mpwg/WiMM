# API-Vertrag v1

Architekturstand 9. Oktober 2026: [gemeinsames Rust-Ziel](architecture.md), [Review](architecture-review.md), [Freigaben](tasks.md). Diese funktionalen Verträge bleiben verbindlich; neue Zielkomponenten sind noch nicht implementiert.

## Allgemeine Regeln

Basis `/api/v1`, UTF-8 JSON, camelCase, keine stillschweigende Typkonvertierung. IDs sind UUIDs. Finanzpayloads einschließlich Geld/Datum ausschließlich Ende-zu-Ende-verschlüsselt; ihre fachlichen Typen gelten auf Clients, nicht als Klartext-HTTP-Body. Listen: `items`, `nextCursor`, `hasMore`, Standardgröße 50/maximal 200 außer Sync-Pull. Verwaltungsänderungen verlangen erwartete Revision bzw. signierte Rosterfolgeversion. [E2EE-Vertrag](encryption.md) ist verbindlich.

Antworten serialisieren ausschließlich ausdrücklich definierte Felder. Kein generisches ORM-Objekt darf Sessionhashes oder private Referenzen offenlegen. Sessionpflicht gilt außer Health, öffentlichen Metadaten und den ausdrücklich bezeichneten externen Authentifizierungswegen. Mutationen mit Cookie-Sitzung benötigen CSRF-Token und Originprüfung.

## Endpunkte

| Methode und Pfad | Eingabe | Ausgabe / Rechte |
| --- | --- | --- |
| GET `/health/live` | keine | Liveness ohne Datenbankdetails, öffentlich |
| GET `/health/ready` | keine | 200 bereit oder 503; keine persönlichen Daten |
| GET `/meta` | keine | App-/Protokollversion, externe Anmeldung verfügbar, Lizenz, Source-URL |
| POST `/auth/logout` | Session/CSRF | 204 und widerrufene Sitzung |
| GET `/auth/me` | Session | eigene externe Identität, aktive Haushaltsmitgliedschaften, CSRF-Token |
| GET `/auth/oidc/start` | erlaubtes Rückkehrziel, optional Invite-Kontext | Redirect; State/Nonce/PKCE serverseitig kurzzeitig |
| GET `/auth/oidc/callback` | code, state | OIDC-Prüfung, Server-Session und Zuordnung der providerseitigen issuer/subject-Identität; Zulassung gemäß Serverkonfiguration |
| POST `/auth/device/start` | deviceName, publicClientNonce | deviceCode, userCode, Bestätigungs-URL, expiresIn=600, interval=5 |
| POST `/auth/device/approve` | userCode, Session/CSRF | einmalige browserseitige Bestätigung für eingeloggte Person |
| POST `/auth/device/poll` | deviceCode, publicClientNonce | pending/denied/expired oder einmaliges Device-Token |
| GET/DELETE `/auth/sessions[/:id]` | eigene Session-ID | eigene Sitzungen auflisten/widerrufen |
| POST `/crypto/identity` | eigene öffentliche Identitätsschlüssel, Besitznachweis | Erstregistrierung öffentlicher Identitätsschlüssel; Austausch nur nach alter Identitätssignatur bzw. ausdrücklich getrenntem externen Identitätswechsel ohne Zugriff auf alte Finanzen |
| GET/PUT `/crypto/vault` | verschlüsselter UserVault, Keywrap-/KDFmetadaten, erwartete Vaultversion | eigener Tresor ausschließlich als Chiffrat; externe Anmeldung liefert keine Entschlüsselung |
| GET/POST `/crypto/devices` | öffentliche Geräteschlüssel und Identitätszertifikat | eigene zertifizierte Geräte; Anmeldung plus gültiges Zertifikat, keine App-/Binaryattestierung |
| POST `/crypto/devices/:id/revoke` | signierter Identitätswiderruf | eigenes Gerät widerrufen; möglicher Schlüsselabfluss zusätzlich Bereichsrotation |
| GET `/spaces/:id/keys` | Session | signierte Rosterkette/KeyGrants ausschließlich für eigene berechtigte Identität |
| POST `/spaces/:id/keys/grant` | neues signiertes Roster, signierter Empfänger-KeyGrant | owner/admin-Client; Mitglied noch pending bis Empfängerbestätigung |
| POST `/spaces/:id/keys/accept` | bestätigter Rosterhash/K-Version, Empfängersignatur | eigene Schlüsselannahme; keine Passphrase/privater Schlüssel im Body |
| POST `/spaces/:id/keys/rotate` | expectedRosterHash, neues Roster, KeyGrants, verschlüsselter signierter Snapshot | owner/admin; Rollen-/Widerrufsänderung und K-Rotation atomar, Konflikt bei veraltetem Roster |
| GET `/spaces` | Session | ausschließlich eigene private/zugängliche gemeinsame Bereiche |
| POST `/spaces/from-snapshot` | Typ, verschlüsselter signierter Snapshot/Genesis/KeyGrants, Upload-ID, adoptEmptyPrivate? | neues servergebundenes Chiffrat; Name/Teilnehmer innerhalb verschlüsselter Daten |
| GET `/spaces/:id/snapshot` | optional Epoche | verschlüsselter signierter Snapshot + gebundener snapshotCursor; berechtigte Leser mit eigenem KeyGrant |
| POST `/spaces/:id/restore` | verschlüsselter signierter Snapshot, expectedEpoch, neue signierte Epoche, confirm=true | owner/admin; Server prüft keine Fachklartexte |
| DELETE `/spaces/:id` | expectedRevision, confirm=true | Haushalts-admin/owner; privater Bereich nicht allein löschbar, dafür eigener Datenlöschablauf |
| POST `/spaces/:id/sync/push` | EncryptedOperation[] | Receipts/CAS-Stände und Chiffrate; member/admin oder privater owner mit gültiger Nachrichtensignatur |
| GET `/spaces/:id/sync/pull` | epoch, cursor, limit bis 500 | verschlüsselte Changes/nextCursor/hasMore; aktive Leser |
| POST `/households` | verschlüsselter Initialsnapshot, signierte Genesis/Grants | Verwaltungs-ID, verschlüsselter Space und admin-Membership; keinerlei Finanzklartext |
| PATCH `/households/:id` | signiertes admin-Settings-Bundle, expectedRevision | Name/Zeitzone verschlüsselt; keine Serverprojektion |
| GET `/households/:id/memberships` | Session | aktive Mitgliedschaften; Haushaltsmitglieder |
| PATCH/DELETE `/households/:id/memberships/:membershipId` | signierte Rosteränderung, expectedRevision; bei Entfernung neuer verschlüsselter Snapshot und Grants | admin; atomare Rotation bei Entfernung, letzter admin bleibt |
| POST `/households/:id/invitations` | role, optionale E-Mail-Bindung | Link/Code einmal angezeigt; admin |
| DELETE `/households/:id/invitations/:invitationId` | expectedRevision | admin, widerrufen |
| POST `/invitations/accept` | Code und externe Sitzung | atomare Zuordnung der bereits extern authentifizierten Identität als pending_key_grant-Mitglied; Finanzzugriff erst nach Fingerprint-/Schlüsselfreigabe |
| POST `/households/:id/participants/:participantId/link` | Zielidentität aus aktiver Membership, erwartete Revision | admin bereitet Zuordnung vor; noch keine wirksame Änderung der Identitätszuordnung |
| POST `/households/:id/participants/:participantId/link/accept` | eigene externe Identität, erwartete Revision | eingeladener Benutzer bestätigt vorbereitete eigene Zuordnung |

Ein Finanzsnapshot ersetzt keine externe Identitäts- oder Rollenverwaltung. Das Löschen eines Kontos/Haushalts benötigt einen ausdrücklich bestätigten Verwaltungsablauf; Rollen können nicht durch importierte Finanzdateien erlangt werden. Eine neue externe Identität erhält nach erfolgreicher Provideranmeldung einen leeren privaten Initialbereich. Kontoanlage, Sperrung und Passwortverwaltung bleiben vollständig beim externen Identitätsanbieter; Finanz- und Rollenrechte werden nicht aus importierten Snapshots abgeleitet. `adoptEmptyPrivate=true` nutzt ausschließlich diesen nachweislich leeren eigenen Bereich und aktualisiert seine Epoche; bei bestehenden Finanzdaten ist expliziter Restore mit Backup nötig, nie automatisches Zusammenführen.

## Fachbefehle

Die folgende Tabelle beschreibt ausschließlich clientintern entschlüsselte Fachbefehle. Payloads enthalten ID und Felder aus dem Datenmodell; vollständige saves ersetzen ein Aggregat. Clients prüfen Pflichtreferenzen und erzeugen Änderungssets. commandType, aggregateType, Finanzfelder und Referenzen werden nicht im Klartext an den Server gesendet. Schreibnachrichten benötigen member/admin bzw. privates Eigentum laut signiertem Roster; Appcodesignatur ist unerheblich.

| commandType | Payload / atomarer Umfang |
| --- | --- |
| `account.save`, `account.archive` | Konto bzw. id/archived |
| `categoryGroup.save`, `category.save`, `category.archive` | Gruppe/Kategorie bzw. Archivstatus |
| `payee.save`, `payee.merge` | Empfänger bzw. sourceIds/targetId; alle Referenzen atomar |
| `transaction.save`, `transaction.delete` | volle Buchung mit Splits bzw. id; abgeglichene Änderung gesperrt |
| `transfer.save`, `transfer.delete` | Transfer samt beiden Seiten, alle zugehörigen Revisionen; Budgetabgang mit Ausgabenkategorie, Budgeteintritt mit bestätigtem budgetRelease |
| `reconciliation.confirm`, `reconciliation.unlock` | Kontoauszug und ausgewählte offene IDs, bestätigte Ausgangsbuchungen zusätzlich mit CAS; Bestätigung nur bei Differenz null; Entsperrung umfasst verbundene Abgleiche und vollständige Transferpaare |
| `budget.method.set`, `budget.month.save`, `budget.move` | Methode/Monat, volle Zeilen bzw. month/from/to/amount |
| `participant.save`, `participant.archive` | Teilnehmer ohne Rechtefelder; Zuordnung zur externen Identität separat Verwaltungs-API |
| `allocationPolicy.save` | Gültigkeitsdatum und explizite Grundlagen |
| `sharedExpense.save`, `sharedExpense.delete` | Ausgabe samt eingefrorenen Anteilen; private Felder verboten |
| `expenseRefund.save`, `expenseRefund.delete` | Rückerstattung samt öffentlicher Zahlung/Zuordnung |
| `contribution.save`, `contribution.delete` | Einlage und gemeinsame Kontobuchung |
| `settlement.save`, `settlement.delete` | Zahlung, Anwendungen auf Vorleistungen und gegebenenfalls gemeinsame Kontobuchung |
| `advanceOffset.save`, `advanceOffset.delete` | Eigenanteilsverrechnung mit Begründung; Ausgabenrevision mitprüfen |
| `importMapping.save` | bereichseigene, validierte CSV-Mappingvorlage |
| `importBatch.save` | bestätigte Vorschauentscheidungen; kein Finanzcommit, bereits bearbeitete Quellzeilen unveränderlich |
| `import.commit` | höchstens 100 Quellzeilen: fachvalidierte normale Buchungen, Empfänger, Fingerprints, Konto-CAS und Fortschritt atomar |
| `schedule.save`, `schedule.confirm`, `schedule.skip` | Schedule bzw. Fälligkeit und Buchung; Occurrence-ID eindeutig |
| `rule.save`, `rule.delete`, `rule.reorder` | Regel bzw. gesamte neue Reihenfolge mit Revisionen |
| `savingsGoal.save`, `savingsGoal.archive` | Ziel bzw. Archivstatus |

`undo` ist kein privilegierter Serverbefehl. Die UI erzeugt denselben passenden Gegenbefehl mit der seit der eigenen Aktion erwarteten Revision und prüft sämtliche betroffenen Aggregate und Referenzen erneut. Die Historie umfasst nur erfolgreiche Buchungs-, Transfer- und Abgleichaktionen des aktiven Bereichs und bleibt flüchtig; neue Aktionen verwerfen den Redozweig, Bereichswechsel und andere Stammdatenaktionen leeren die Historie. Revisionen sinken niemals, neue Aggregate werden beim Rückgängigmachen als Tombstones erhalten. Import validiert normale Buchungen mit demselben `transaction.save`-Fachvertrag und bündelt sie innerhalb von `import.commit`; Batch-/Dublettenmetadaten bleiben bereichseigene Daten. Noch nicht gespeicherte Entscheidungen dürfen keinen Gruppencommit auslösen. Die maximale Batchgröße bedeutet keine Atomizität eines kompletten Großimports; Vorschau bestätigt dies vor Übernahme.

## Push-Antwort

```json
{
  "epoch": "00000000-0000-4000-8000-000000000401",
  "results": [{
    "operationId": "00000000-0000-4000-8000-000000000101",
    "status": "accepted",
    "cursor": "42",
    "revisions": [{ "handle": "00000000-0000-4000-8000-000000000501", "revision": 1 }],
    "encryptedBundles": []
  }]
}
```

Das Beispiel kürzt `encryptedBundles`; eine reale Antwort enthält unveränderte verschlüsselte signierte Hüllen, niemals entschlüsselte Aggregate. Konfliktstände sind ebenfalls Chiffrate und nur bei gültigem Leserecht erhältlich. Ein nicht zugänglicher Bereich erzeugt keinen teilweise erfolgreichen Batch.

## Fehler

```json
{
  "error": {
    "code": "INVALID_ENVELOPE",
    "message": "Die verschlüsselte Nachricht ist ungültig.",
    "fields": [{ "path": "header.keyVersion", "code": "KEY_VERSION_MISMATCH" }],
    "requestId": "req-opaque"
  }
}
```

| HTTP | Codes | Wirkung |
| --- | --- | --- |
| 400 | INVALID_ENVELOPE, INVALID_SIGNATURE, UNSUPPORTED_CRYPTO_SUITE | Keine Änderung; Hülle/Schlüssel prüfen |
| 401 | AUTH_REQUIRED, SESSION_EXPIRED | Erneut anmelden; Entwürfe erhalten |
| 403 | FORBIDDEN, CSRF_FAILED | Kein Schreibrecht bzw. ungültiger Anmeldekontext |
| 404 | NOT_FOUND | Auch nicht zugängliche Ressourcen; keine Existenzoffenlegung |
| 409 | REVISION_CONFLICT, EPOCH_MISMATCH, KEY_VERSION_MISMATCH, ROSTER_MISMATCH, OPERATION_ID_REUSED, LAST_ADMIN, DEPENDENCY_NOT_ACCEPTED | Konflikt/Schlüsselstand sichtbar auflösen |
| 413 | PAYLOAD_TOO_LARGE | Batch reduzieren, keine abgeschnittene Übernahme |
| 429 | RATE_LIMITED | Retry-After beachten |
| 426 | UPDATE_REQUIRED | Protokoll/Client aktualisieren |
| 500/503 | INTERNAL_ERROR, STORAGE_UNAVAILABLE | Request-ID; keine internen Details, sichere Wiederholung |

Serverergebnisse betreffen nur Hülle, Signatur, Autorisierung und CAS; Finanzfehler entstehen ausschließlich auf entschlüsselnden Clients. HTTP 400 betrifft einen ungültigen Batchumschlag; Auth-/Bereichsfehler den gesamten Request. Nach Entschlüsselung ungültiger Inhalt wird quarantänisiert und nicht automatisch angewandt. Uploadgrenzen und Sitzungsregeln stehen in Betrieb/Sicherheit.

## Atomarer lokaler Kontoeinstieg

`createAccountWithOpening` erzeugt unter `account.save` eine vollständige Änderungsmenge für ein neues Konto und optional eine validierte Anfangsbuchung. Beide neuen IDs benötigen erwartete Revision 0; bestehende Konten sind ausgeschlossen. Die Anfangsbuchung zählt nicht als Konsum. Dies ist ein Clientfachbefehl, kein neuer Serverendpunkt. `parseDirectedMoney` normalisiert die gewählte Ausgabe-/Einnahmerichtung im Fachkern; ausdrücklich vorzeichenbehaftete Splits erlauben weiterhin Gegenposten.

## Lokaler Finanzbestandsport

`AggregateHeadReader.list(spaceId)` liefert für Finanzbefehle einen vollständigen unveränderlichen entschlüsselten Bereichsbestand aus derselben Lesesicht wie `get(id)`. Ein reiner Kopfstandsport genügt hierfür nicht; bei fehlendem Bestandsport wird eine Finanzmutation abgewiesen. Änderungsmengen können zusätzlich zu ihren fachlichen Zielaggregaten vollständige Konto-CAS-Anker enthalten. Der lokale Adapter speichert sie gemeinsam mit allen übrigen Änderungen; dies ergänzt keine Finanzprüfung auf dem E2EE-Server und ändert keine Transporthülle.

`PayeeTransactionReference` enthält zusätzlich den verpflichtenden `clearance`-Status. `payee.merge` lehnt abgeglichene Quellen vor Erzeugung einer Änderungsmenge ab. Die ausdrückliche atomare Entsperrung des vollständigen Abgleichs bleibt ein separater bestätigter Fachbefehl.

Der lokale Batch führt zusätzlich die technische `financialRevision` des Bereichs als CAS-Anker mit. Sie wird auch bei Neuanlagen atomar erwartet/erhöht und bleibt vom späteren Sync-/Servertransport getrennt (ADR-039). Lokale Änderungsmengen und verschlüsselte lokale Wiederherstellungssnapshots dürfen sie enthalten; gemeinsame Finanzoperationshüllen dürfen diese lokale Koordinationsrevision nicht als globalen Syncanker verwenden.
