# API-Vertrag v1

## Allgemeine Regeln

Basis `/api/v1`, UTF-8 JSON, camelCase, keine stillschweigende Typkonvertierung. IDs sind UUIDs. Finanzpayloads einschließlich Geld/Datum ausschließlich Ende-zu-Ende-verschlüsselt; ihre fachlichen Typen gelten auf Clients, nicht als Klartext-HTTP-Body. Listen: `items`, `nextCursor`, `hasMore`, Standardgröße 50/maximal 200 außer Sync-Pull. Verwaltungsänderungen verlangen erwartete Revision bzw. signierte Rosterfolgeversion. [E2EE-Vertrag](encryption.md) ist verbindlich.

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
| POST `/crypto/identity` | eigene öffentliche Identitätsschlüssel, Besitznachweis | Erstregistrierung; Austausch nur nach alter Identitätssignatur bzw. ausdrücklich getrenntem Kontoneustart ohne Zugriff auf alte Finanzen |
| GET/PUT `/crypto/vault` | verschlüsselter UserVault, Keywrap-/KDFmetadaten, erwartete Vaultversion | eigener Tresor ausschließlich als Chiffrat; Loginreset liefert keine Entschlüsselung |
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
| DELETE `/spaces/:id` | expectedRevision, confirm=true | Haushalts-admin/owner; privater Bereich nicht allein löschbar, dafür Konto-/Datenlöschablauf |
| POST `/spaces/:id/sync/push` | EncryptedOperation[] | Receipts/CAS-Stände und Chiffrate; member/admin oder privater owner mit gültiger Nachrichtensignatur |
| GET `/spaces/:id/sync/pull` | epoch, cursor, limit bis 500 | verschlüsselte Changes/nextCursor/hasMore; aktive Leser |
| POST `/households` | verschlüsselter Initialsnapshot, signierte Genesis/Grants | Verwaltungs-ID, verschlüsselter Space und admin-Membership; keinerlei Finanzklartext |
| PATCH `/households/:id` | signiertes admin-Settings-Bundle, expectedRevision | Name/Zeitzone verschlüsselt; keine Serverprojektion |
| GET `/households/:id/memberships` | Session | aktive Mitgliedschaften; Haushaltsmitglieder |
| PATCH/DELETE `/households/:id/memberships/:membershipId` | signierte Rosteränderung, expectedRevision; bei Entfernung neuer verschlüsselter Snapshot und Grants | admin; atomare Rotation bei Entfernung, letzter admin bleibt |
| POST `/households/:id/invitations` | role, optionale E-Mail-Bindung | Link/Code einmal angezeigt; admin |
| DELETE `/households/:id/invitations/:invitationId` | expectedRevision | admin, widerrufen |
| POST `/invitations/accept` | Code, bei neuem Konto email/displayName/password | atomare Konto-/pending_key_grant-Mitgliedschaft; Finanzzugriff erst nach Fingerprint-/Schlüsselfreigabe |
| POST `/households/:id/participants/:participantId/link` | Zielbenutzer aus aktiver Membership, erwartete Revision | admin bereitet Zuordnung vor; noch keine wirksame Änderung von userId |
| POST `/households/:id/participants/:participantId/link/accept` | eigener Benutzer, erwartete Revision | eingeladener Benutzer bestätigt vorbereitete eigene Zuordnung |

Ein Finanzsnapshot ersetzt keine Benutzer-/Rollenverwaltung. Das Löschen eines Kontos/Haushalts benötigt einen ausdrücklich bestätigten Verwaltungsablauf; Rollen können nicht durch importierte Finanzdateien erlangt werden. OIDC-Verknüpfung bestehender Konten erfordert eine bestehende Sitzung und frische OIDC-Authentifizierung. Ein neuer User erhält einen leeren privaten Initialbereich. `adoptEmptyPrivate=true` nutzt ausschließlich diesen nachweislich leeren eigenen Bereich und aktualisiert seine Epoche; bei bestehenden Finanzdaten ist expliziter Restore mit Backup nötig, nie automatisches Zusammenführen.

## Fachbefehle

Die folgende Tabelle beschreibt ausschließlich clientintern entschlüsselte Fachbefehle. Payloads enthalten ID und Felder aus dem Datenmodell; vollständige saves ersetzen ein Aggregat. Clients prüfen Pflichtreferenzen und erzeugen Änderungssets. commandType, aggregateType, Finanzfelder und Referenzen werden nicht im Klartext an den Server gesendet. Schreibnachrichten benötigen member/admin bzw. privates Eigentum laut signiertem Roster; Appcodesignatur ist unerheblich.

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
|---|---|---|
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
