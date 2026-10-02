# API-Vertrag v1

## Allgemeine Regeln

Basis `/api/v1`, UTF-8 JSON, camelCase, keine stillschweigende Typkonvertierung. IDs sind UUIDs, Geldbeträge sichere ganze Cent; Datums-/Versionsregeln siehe [Datenmodell](data-model.md). Listen verwenden `items`, `nextCursor` und `hasMore`; Standardgröße 50, maximal 200, außer Sync-Pull. Alle Verwaltungsänderungen verlangen bei bestehenden Ressourcen eine erwartete Revision.

Antworten serialisieren ausschließlich ausdrücklich definierte Felder. Kein generisches ORM-Objekt darf Sessionhashes oder private Referenzen offenlegen. Sessionpflicht gilt außer Health, öffentlichen Metadaten und den jeweils bezeichneten Einrichtungs-/Anmeldewegen. Mutationen mit Cookie-Sitzung benötigen CSRF-Token und Originprüfung.

## Endpunkte

| Methode und Pfad | Eingabe | Ausgabe / Rechte |
|---|---|---|
| GET `/health/live` | keine | Liveness ohne Datenbankdetails, öffentlich |
| GET `/health/ready` | keine | 200 bereit oder 503; keine persönlichen Daten |
| GET `/meta` | keine | App-/Protokollversion, setupRequired, OIDC verfügbar, Lizenz, Source-URL |
| POST `/setup` | einmaliges Setupgeheimnis, displayName, email, password | Erstbenutzer und Session; nur vor Bootstrap, atomar |
| POST `/auth/login` | email, password | Cookie, Benutzer und CSRF-Token; Rate-Limit, generischer Fehler |
| POST `/auth/logout` | Session/CSRF | 204 und widerrufene Sitzung |
| GET `/auth/me` | Session | eigener Benutzer, aktive Haushaltsmitgliedschaften, CSRF-Token |
| POST `/auth/password/change` | altes/neues Passwort | 204, andere eigene Sessions widerrufen |
| POST `/auth/account/delete` | frische Anmeldung, confirm=true | eigener privater Bereich/Sessions entfernen; letzte admin-Rollen vorher übergeben |
| GET `/auth/oidc/start` | erlaubtes Rückkehrziel, optional Invite-Kontext | Redirect; State/Nonce/PKCE serverseitig kurzzeitig |
| GET `/auth/oidc/callback` | code, state | OIDC-Prüfung, Session; Kontoanlage nur über Einladung |
| POST `/auth/device/start` | deviceName, publicClientNonce | deviceCode, userCode, Bestätigungs-URL, expiresIn=600, interval=5 |
| POST `/auth/device/approve` | userCode, Session/CSRF | einmalige browserseitige Bestätigung für eingeloggte Person |
| POST `/auth/device/poll` | deviceCode, publicClientNonce | pending/denied/expired oder einmaliges Device-Token |
| GET/DELETE `/auth/sessions[/:id]` | eigene Session-ID | eigene Sitzungen auflisten/widerrufen |
| GET `/spaces` | Session | ausschließlich eigene private/zugängliche gemeinsame Bereiche |
| POST `/spaces/from-snapshot` | Name, Typ, validierter Snapshot, neue Upload-ID, adoptEmptyPrivate? | neuer Haushalt inklusive Teilnehmern; private Anlage nur ohne Privatbereich oder explizite Übernahme eines leeren eigenen Initialbereichs |
| GET `/spaces/:id/snapshot` | optional Epoche | konsistenter Snapshot + snapshotCursor; alle berechtigten Leser |
| POST `/spaces/:id/restore` | Snapshot, expectedEpoch, confirm=true | neue Epoche; private owner oder Haushalts-admin |
| DELETE `/spaces/:id` | expectedRevision, confirm=true | Haushalts-admin/owner; privater Bereich nicht allein löschbar, dafür Konto-/Datenlöschablauf |
| POST `/spaces/:id/sync/push` | operations[] | Ergebnisse pro Operation; member/admin oder privater owner |
| GET `/spaces/:id/sync/pull` | epoch, cursor, limit bis 500 | Changes/nextCursor/hasMore; jeder berechtigte Leser |
| POST `/households` | name, timezone | neuer Haushalt, Space, Haushaltsteilnehmer und admin-Membership atomar |
| PATCH `/households/:id` | name?, timezone?, expectedRevision | admin; keine Rückwirkung auf Buchungsdaten |
| GET `/households/:id/memberships` | Session | aktive Mitgliedschaften; Haushaltsmitglieder |
| PATCH/DELETE `/households/:id/memberships/:membershipId` | role oder expectedRevision | admin; kein Entfernen letzten admin |
| POST `/households/:id/invitations` | role, optionale E-Mail-Bindung | Link/Code einmal angezeigt; admin |
| DELETE `/households/:id/invitations/:invitationId` | expectedRevision | admin, widerrufen |
| POST `/invitations/accept` | Code, bei neuem Konto email/displayName/password | atomare Konto-/Mitgliedschaftsanlage, einmalige Verwendung |
| POST `/households/:id/participants/:participantId/link` | Zielbenutzer aus aktiver Membership, erwartete Revision | admin bereitet Zuordnung vor; noch keine wirksame Änderung von userId |
| POST `/households/:id/participants/:participantId/link/accept` | eigener Benutzer, erwartete Revision | eingeladener Benutzer bestätigt vorbereitete eigene Zuordnung |

Ein Finanzsnapshot ersetzt keine Benutzer-/Rollenverwaltung. Das Löschen eines Kontos/Haushalts benötigt einen ausdrücklich bestätigten Verwaltungsablauf; Rollen können nicht durch importierte Finanzdateien erlangt werden. OIDC-Verknüpfung bestehender Konten erfordert eine bestehende Sitzung und frische OIDC-Authentifizierung. Ein neuer User erhält einen leeren privaten Initialbereich. `adoptEmptyPrivate=true` nutzt ausschließlich diesen nachweislich leeren eigenen Bereich und aktualisiert seine Epoche; bei bestehenden Finanzdaten ist expliziter Restore mit Backup nötig, nie automatisches Zusammenführen.

## Fachbefehle

Payloads enthalten ID und sämtliche notwendigen Felder des jeweiligen Aggregats aus dem [Datenmodell](data-model.md), keine UI-Projektionen. Vollständige saves ersetzen ein Aggregat; Pflichtreferenzen werden gegen den aktuellen Bereich geprüft. Alle schreibenden Befehle verlangen member/admin bzw. privates Eigentum.

| commandType | Payload / atomarer Umfang |
|---|---|
| `account.save`, `account.archive` | Konto bzw. id/archived |
| `categoryGroup.save`, `category.save`, `category.archive` | Gruppe/Kategorie bzw. Archivstatus |
| `payee.save`, `payee.merge` | Empfänger bzw. sourceIds/targetId; alle Referenzen atomar |
| `transaction.save`, `transaction.delete` | volle Buchung mit Splits bzw. id; abgeglichene Änderung gesperrt |
| `transfer.save`, `transfer.delete` | Transfer samt beiden Seiten, alle zugehörigen Revisionen |
| `reconciliation.confirm`, `reconciliation.unlock` | Kontoauszug und IDs bzw. Abgleich-ID und betroffene Buchungen |
| `budget.method.set`, `budget.month.save`, `budget.move` | Methode/Monat, volle Zeilen bzw. month/from/to/amount |
| `participant.save`, `participant.archive` | Teilnehmer ohne Rechtefelder; Benutzerlink separat Verwaltungs-API |
| `allocationPolicy.save` | Gültigkeitsdatum und explizite Grundlagen |
| `sharedExpense.save`, `sharedExpense.delete` | Ausgabe samt eingefrorenen Anteilen; private Felder verboten |
| `expenseRefund.save`, `expenseRefund.delete` | Rückerstattung samt öffentlicher Zahlung/Zuordnung |
| `contribution.save`, `contribution.delete` | Einlage und gemeinsame Kontobuchung |
| `settlement.save`, `settlement.delete` | Zahlung, Anwendungen auf Vorleistungen und gegebenenfalls gemeinsame Kontobuchung |
| `advanceOffset.save`, `advanceOffset.delete` | Eigenanteilsverrechnung mit Begründung; Ausgabenrevision mitprüfen |
| `schedule.save`, `schedule.confirm`, `schedule.skip` | Schedule bzw. Fälligkeit und Buchung; Occurrence-ID eindeutig |
| `rule.save`, `rule.delete`, `rule.reorder` | Regel bzw. gesamte neue Reihenfolge mit Revisionen |
| `savingsGoal.save`, `savingsGoal.archive` | Ziel bzw. Archivstatus |

`undo` ist kein privilegierter Serverbefehl. Die UI erzeugt denselben passenden Gegenbefehl mit aktueller Revision. Import übernimmt normale `transaction.save`-Operationen; Batch-/Dublettenmetadaten bleiben bereichseigene Daten. Die maximale Batchgröße bedeutet keine Atomizität eines kompletten Großimports; Vorschau bestätigt dies vor Übernahme.

## Push-Antwort

```json
{
  "epoch": "00000000-0000-4000-8000-000000000401",
  "results": [{
    "operationId": "00000000-0000-4000-8000-000000000101",
    "status": "accepted",
    "cursor": "42",
    "revisions": [{ "aggregateType": "transaction", "id": "00000000-0000-4000-8000-000000000501", "revision": 1 }],
    "aggregates": []
  }]
}
```

Das Beispiel kürzt `aggregates` aus Platzgründen; eine reale Antwort enthält den vollständigen bestätigten Stand der betroffenen Aggregate. Operationsergebnisse können Konfliktstände nur bei weiterhin gültigem Leserecht enthalten. Ein nicht zugänglicher Bereich erzeugt keinen teilweisen erfolgreichen Batch.

## Fehler

```json
{
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "Die Aufteilung entspricht nicht dem Buchungsbetrag.",
    "fields": [{ "path": "payload.splits", "code": "SUM_MISMATCH" }],
    "requestId": "req-opaque"
  }
}
```

| HTTP | Codes | Wirkung |
|---|---|---|
| 400 | VALIDATION_FAILED, UNKNOWN_COMMAND, UNSUPPORTED_FORMAT | Keine Änderung; Felder korrigieren |
| 401 | AUTH_REQUIRED, SESSION_EXPIRED | Erneut anmelden; Entwürfe erhalten |
| 403 | FORBIDDEN, CSRF_FAILED | Kein Schreibrecht bzw. ungültiger Anmeldekontext |
| 404 | NOT_FOUND | Auch nicht zugängliche Ressourcen; keine Existenzoffenlegung |
| 409 | REVISION_CONFLICT, EPOCH_MISMATCH, OPERATION_ID_REUSED, LAST_ADMIN, DEPENDENCY_NOT_ACCEPTED | Konflikt/Verwaltungsproblem sichtbar auflösen |
| 413 | PAYLOAD_TOO_LARGE | Batch reduzieren, keine abgeschnittene Übernahme |
| 429 | RATE_LIMITED | Retry-After beachten |
| 426 | UPDATE_REQUIRED | Protokoll/Client aktualisieren |
| 500/503 | INTERNAL_ERROR, STORAGE_UNAVAILABLE | Request-ID; keine internen Details, sichere Wiederholung |

Fachfehler innerhalb eines gültigen Pushbatches erscheinen im jeweiligen Operationsergebnis; HTTP 400 betrifft den ungültigen Batchumschlag. Auth-/Bereichsfehler gelten für den gesamten Request. Uploadgrenzen und Sitzungsregeln stehen in [Betrieb](operations.md) und [Sicherheit](security.md).
