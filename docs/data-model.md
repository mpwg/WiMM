# Datenmodell und Aggregate

## Gemeinsame Typen

IDs sind UUIDs; technische IDs werden zufällig lokal erzeugt. Geld = sicherer ganzzahliger Centbetrag, Datum = validiertes `YYYY-MM-DD`, Monat = `YYYY-MM`, Zeitpunkt = ISO-8601 UTC. Revision ist eine nichtnegative sichere Ganzzahl; neue serverseitige Aggregate starten bei 1, erwartete Revision 0 bedeutet Neuanlage.

Finanzaggregate besitzen `id`, `spaceId`, `revision`, `createdAt`, `updatedAt`, `deletedAt?`. Kindzeilen verwenden die Revision des Elternaggregats. Finanzzeitpunkte und neue Aggregate werden clientseitig erstellt und authentifiziert verschlüsselt; der Server darf signierten Inhalt nicht verändern. Er bestätigt nur öffentliche erwartete/neue Revisionen per CAS. Zeitpunkte entscheiden nicht über Konflikte.

## Verwaltungsdaten

| Entität | Pflichtfelder neben ID/Zeitpunkten | Beziehungen und Regeln |
| --- | --- | --- |
| ExternalIdentity | issuer, subject, status, freigegebene Profilclaims? | issuer + subject eindeutig; providerverwaltet; lokale private Bereiche werden dieser Identität erst nach bestätigter Serververbindung zugeordnet |
| ServerSession | identityId, tokenHash, Ablauf, revokedAt? | Sitzung gehört genau einer externen Identität; keine lokalen Passwort-Credentials; E-Mail-Gleichheit verknüpft Identitäten nicht automatisch |
| Household | name, timezone, sharedSpaceId | Genau ein gemeinsamer Bereich; sharedSpaceId eindeutig |
| Space | kind, currency, syncEpoch, ownerIdentityId? / householdId? | kind `private` oder `household`; genau passende Eigentumsreferenz; lokal ownerLocalProfileId statt User möglich |
| Membership | householdId, identityId, role, status | Paar eindeutig; admin/member/viewer; keine Entfernung des letzten aktiven admin |
| Participant | spaceId, name, kind, archived, linkedIdentityId? | kind person/household; genau ein technischer Haushaltsteilnehmer; Zuordnung zu externer Identität nur mit Zustimmung |
| Invitation | householdId, role, tokenHash, expiresAt, createdBy, consumedAt? | Rohcode nur beim Erstellen; sieben Tage gültig, einmal nutzbar; nicht finanziell synchronisieren |
| ServerSession / Device | identityId, tokenHash, expiry, revokedAt? / name | Sessiondaten nie exportieren; Device-ID allein authentifiziert nicht |

## E2EE-Speicherebenen

Die Finanztabellen unten existieren ausschließlich auf Clients bzw. in entschlüsselten Exports. Server-Household enthält ID und Verwaltungsreferenzen, keinen Klartext-Familiennamen/Zeitzoneninhalt. Externe Identitätsreferenzen und notwendige Sitzungs-/Rollenmetadaten sind öffentliche Verwaltungsdaten; Finanzteilnehmernamen bleiben verschlüsselt. Profilattribute werden nur nach expliziter Zuordnung aus freigegebenen Providerclaims übernommen.

Serverobjekte: `EncryptedUserVault` (Ciphertext/Nonce und KDF-/Keywrapmetadaten), `IdentityPublicKeys`, `DeviceCertificate`, `KeyRoster` (signierte Rollen-/Identitätskette), `KeyGrant` (signierte sealed box pro Empfänger), `EncryptedOperation`, `EncryptedSnapshot`, `OpaqueAggregateHead` (Handle/Revision/Chiffrathash) und `OperationReceipt`. Kein Klartext-Finanzindex, keine Budgetprojektionen oder privaten Schlüssel. `Membership.status` ergänzt `pending_key_grant`; aktive kryptografische Rechte folgen dem geprüften Roster.

Clientobjekte zusätzlich: entsperrter UserVault nur zur Laufzeit, gepinnte Identitätsfingerprints/Manifeststände, K pro Bereich/Version, lokaler Device-Signaturschlüssel und Quarantäne für ungültige verschlüsselte Nachrichten. Verbindlicher Lebenszyklus siehe [Verschlüsselung](encryption.md).

## Finanzdaten

| Aggregat | Felder | Kinder und Grenzen |
| --- | --- | --- |
| Account | name, type, onBudget, archived | Keine mutable balance; Kontostand berechnet; credit immer off-budget |
| CategoryGroup | name, kind, sortOrder, archived | kind income/expense; Systemgruppe für unzugeordnet |
| Category | groupId, name, sortOrder, archived | Gruppe im selben Bereich |
| Payee | name, aliases[], archived | Aliasse normalisiert; Merge als expliziter Fachbefehl |
| Transaction | accountId, date, amount, kind, payeeId?, note?, clearance, importReference?, scheduleOccurrenceId? | splits[] mit id/categoryId/amount; normale Buchungen mindestens ein Split |
| Transfer | date, sourceAccountId, targetAccountId, sourceTransactionId, targetTransactionId, amount, budgetCategoryId?, budgetRelease? | Zwei Transaction-Kinder, vollständiges Aggregat; Betrag positiv, Konten verschieden; budgetCategoryId beim Verlassen des Budgets als Ausgabenkategorie verpflichtend; beim Eintritt stattdessen budgetRelease=true nach ausdrücklicher Geldfreigabe |
| Reconciliation | accountId, statementDate, statementBalance, transactionIds[] | Nur die ausgewählten offenen Bewegungen speichern; bestätigte Ausgangsbuchungen bis statementDate zusätzlich mit CAS prüfen; Differenz muss null sein; historische Bestätigung |
| BudgetMethodPeriod | effectiveMonth, method | Pro Bereich/Monat eindeutig, chronologische Historie |
| BudgetMonth | month, method, lines[] | lines: categoryId, planned?/assigned; vollständiger Monatsstand mit einer Revision |
| AllocationPolicy | effectiveDate, method, entries[], archived | entries: participantId, weight bzw. declaredIncome; keine Privatbereichsreferenzen |
| SharedExpense | date, amount, categoryId, payerId, fundingKind, reimbursementSource?, sourceTransactionId?, sourceSplitId?, policySnapshot, shares[] | Private Quellen besitzen keine privaten IDs im öffentlichen Datensatz; shares: participantId/amount |
| ExpenseRefund | sharedExpenseId, date, amount, receivedBy, sharedTransactionId? | Positiver Erstattungsbetrag; ursprüngliche Anteile abgeleitet |
| Contribution | date, participantId, amount, householdTransactionId | Positive Einlage; Kindbuchung auf gemeinsamem Konto |
| Settlement | date, payerId, recipientId, amount, householdTransactionId?, applications[] | applications: expenseId/amount; payer != recipient; tatsächlicher Zahlungsweg |
| AdvanceOffset | expenseId, participantId, date, amount, reason | Dokumentierte Eigenanteilsverrechnung, auf ursprünglichen Eigenanteil begrenzt |
| Schedule | startDate, frequency, interval, endDate?, template, enabled | frequency weekly/monthly/yearly; Template ohne fremde Bereichsreferenzen |
| ScheduleOccurrence | scheduleId, dueDate, state, transactionId? | Paar eindeutig; dauerhaft confirmed/skipped; proposed ist eine reine Projektion ohne Saldoänderung |
| Rule | order, conditions[], actions[], stopProcessing, enabled | Nur katalogisierte Bedingungen/Aktionen |
| ImportMapping | name, mapping | CSV-Zuordnung mit Encoding, Separator, Kopfzeile, Spalten und Datum-/Zahlenformat; bereichseigen |
| ImportBatch | fileHash, accountId, rows[], committedRows[], state | rows: sourceRow, candidate?, decision import/exclude/separate, issues[]; state ready/partial/completed; bestätigte Zeilen unveränderlich |
| ImportFingerprint | accountId, parserSource, externalId?, fingerprint, transactionId, importId, sourceRow | Quell-ID nach Konto/Parser; Fingerprinttreffer benötigen eine ausdrückliche Entscheidung |
| SavingsGoal | categoryId, targetAmount, targetDate?, archived | Betrag positiv; Rate und Fortschritt Projektionen |

Systemkategorien/-teilnehmer erhalten lokale stabile IDs und werden als vollständige Datensätze exportiert. Sie dürfen nicht vom Nutzer entfernt werden. Finanzierungs-/Ausgleichsbuchungen werden durch den zugehörigen Befehl erzeugt; unabhängig davon veränderbare Kopien sind unzulässig.

Importkandidaten enthalten Quellzeile, Parserquelle, Finanzdatum, Centbetrag, Empfänger, Verwendungszweck und externe ID sowie optional Kategorie, Empfänger-ID und Abgleichstatus. `sourceFingerprint` hält vor Regelanwendung die normalisierte Quelle fest; eine Empfängerregel verändert nicht die Quell-ID-Prüfung. Die Importzeilen enthalten keine Rechte oder Fremdbereichsreferenzen.

Ein Gruppencommit schreibt höchstens 100 Quellzeilen samt normalen Buchungen, erforderlichen Empfängern, Fingerprints und Batchfortschritt atomar. Das Konto wird als CAS-Anker revidiert, damit parallele Importe desselben Kontos ihre Dublettenprüfung wiederholen müssen. Ausschlüsse zählen als bearbeitete Quellzeilen, erzeugen aber keine Buchung. Dauerzahlungsbestätigung/-überspringen revidiert analog die Schedule als CAS-Anker für das eindeutige Paar Schedule/Fälligkeit.

## Nur private/lokale Verknüpfungen

`PublicationLink` liegt im privaten Bereich: privateTransactionId, privateSplitId?, householdSpaceId, sharedExpenseId, publishedFieldsDigest, state. Gemeinsame Daten kennen weder diesen Datensatz noch seine private Quelle. Im Haushalt wird nur eine freigegebene Kopie gespeichert.

Offline-Veröffentlichung und privater Link werden zunächst in derselben lokalen Speichertransaktion angelegt. Beide Bereiche werden getrennt autorisiert und synchronisiert. Haushaltspush kann scheitern, ohne Privatdaten zu veröffentlichen; der Link zeigt dann `pending` oder `rejected`. Keine verteilte Transaktion zwischen privaten und gemeinsamen Serverbereichen vortäuschen. Wiederholungen verwenden dieselbe SharedExpense-ID und Operations-ID.

## Speicher- und Synchronisierungsdaten

- `ConfirmedAggregate`: letzter bestätigter Stand einschließlich Revision, Epoche und Payload.
- `PendingOperation`: Operations-ID, Befehl, erwartete Revisionen, Vorgänger-IDs, Zustandsautomat, lokaler Entwurf und Wiederholungsmetadaten.
- `OperationReceipt`: serverseitig Operations-ID, Hash der vollständigen verschlüsselten Hülle, Ergebnis, Akteur und Epoche; Unique(spaceId, epoch, operationId).
- `Change`: spaceId, epoch, cursor, operationId und unveränderte EncryptedOperation; vollständige Finanzaggregate/Tombstones ausschließlich im verschlüsselten Payload; Cursor monoton je Bereich.
- `SyncState`: Serverbindung, spaceId, epoch, zuletzt dauerhaft angewandter Cursor.
- `Projection`: Kontostand, Kategorie/Monat, Teilnehmerguthaben, Reserve, Index für Suche; stets neu aufbaubar.
- `Conflict`: Operations-ID, erwarteter Stand, bestätigter Stand, lokaler Entwurf, betroffene Aggregate; kein gemeinsamer Finanzdatensatz.
- `ImportBatch`/`ImportFingerprint`: private bzw. bereichseigene Parserzuordnung, Dateihash, Quellreferenz und Mapping; keine automatische Dublettenentscheidung allein wegen identischer Beträge.

## Aggregate, Indizes und Löschung

Transaction samt Splits, Transfer samt beiden Seiten, SharedExpense samt Anteilen, BudgetMonth samt Zeilen und Settlement samt Zuordnungen werden jeweils atomar gespeichert. Befehle können mehrere Aggregate verändern und prüfen dann alle Revisionen. Eigenanteilsverrechnung prüft zusätzlich die betroffene Ausgabe.

Pflichtindizes: Transaktionen nach space/account/date/id, Kategorie/Datum und Importquell-ID; Budgets nach space/month/method; aktive Membership nach user/household; Teilnehmer nach space; Regeln nach space/order/id; Occurrences nach schedule/date; Change nach space/epoch/cursor; Outbox nach space/state/createdAt; Receipt nach space/epoch/operationId.

Fachfremdschlüssel werden in clientseitigem SQLite aktiviert, in IndexedDB durch denselben Fachvalidator geprüft. Der CiphertextStore kann keine Finanzreferenzen prüfen. Neue oder umgestellte Konto-, Kategorien-, Kategoriegruppen-, Empfänger- und Transferreferenzen benötigen vollständige, nicht gelöschte Ziele im selben Bereich. Neue Splitreferenzen prüfen zusätzlich die Kategoriegruppe. Der Fachkern vergleicht hierfür den vollständigen Ausgangsbestand mit dem atomaren Folgebestand; reine Revisionsköpfe genügen nicht. Unveränderte historische Referenzen auf spätere Tombstones bleiben erhalten; Archivierung ist keine Löschung. Tombstones bleiben verschlüsselt erhalten; Epochwechsel nur durch clientgeprüften, signierten Snapshotersatz. Administrationsdaten gehören nicht in gewöhnliche Finanzsnapshots.

## Schemaentwicklung

Storage-Schemaversion, Fachvertragsversion, Exportformatversion und Sync-Epoche sind unabhängig. Migrationen sind fortlaufend nummeriert und nur vorwärts; vor destruktiven Änderungen Sicherung. Konkrete SQL-DDL und Dexie-Stores entstehen in P3/P8 aus diesem Modell; gemeinsam überprüfte Vertragsschemas in P1/P2 sind die spätere maschinenlesbare Quelle.

Lokale V1-Snapshots binden Profil, Bereich und Epoche einschließlich bestätigter Aggregate, Entwürfe, Projektionen und optionalem tatsächlichem Synczustand. Aggregate besitzen vollständige Formverträge; Handle und Fach-ID stimmen überein. Doppelte/fremde Handles, unbekannte Versionen und widersprüchliche Fachbestände werden vor Löschungen abgewiesen. Snapshotersatz stellt vollständige Historie wieder her und erzeugt keine neuen Fachreferenzen: enthaltene historische Tombstoneziele bleiben zulässig. V1-Finanzcaches sind `balance` (Legacycentzahl), `accountBalance` (Centzahl im Feld `balance`, optional passende `accountId`) und `consumption` (Gesamtstand mit Schlüssel `all` bzw. Monatsstand). Sie entsprechen den reproduzierten Fachprojektionen; andere Cachearten werden beim Restore kontrolliert abgewiesen. Details in [ADR-041](decisions.md#adr-041--gemeinsame-snapshotprüfung-vor-destruktivem-ersatz).

## Lokales Profil und Profilrevision

Das lokale `LocalProfile` enthält `profileId`, `revision`, `areas`, `selectedAreaId` und den verschlüsselten `UserVault`. Die Profilrevision ist unabhängig von Finanzaggregatrevisionen. Ein Altprofil ohne Revision wird beim Lesen als Revision null behandelt; erst eine erfolgreiche Änderung persistiert die nächste sichere Ganzzahl. Bereich, Schlüsselbestand und Auswahl bilden einen einzigen dauerhaft gespeicherten Datensatz.

Der asynchrone `ProfileStore.change` liest den aktuellen Stand unter einem profilweiten Web Lock, berechnet die Änderung gegen diesen Stand und erhöht die Revision nach erfolgreichem CAS. Zusätzlich wird der unveränderte Originalwert unmittelbar vor dem Schreiben geprüft. Eine Neuanlage ist nur bei fehlendem Profil möglich. Ohne Web Locks werden Änderungen verständlich abgewiesen; es gibt keinen unkoordinierten Schreibfallback. Fehler und Konflikte verändern den gespeicherten Ausgangsstand nicht.

`ProfileStore.load` liefert ein explizites Ergebnis `missing`, `loaded` mit Profil, `corrupt` oder `unreadable`. Fehlerstände enthalten keine Originalbytes in Meldungen oder Logs. `change` prüft denselben Bestand erneut unter Koordination; bei beschädigtem oder nicht lesbarem Profil wird der Änderungs-Callback nicht ausgeführt. Öffentliche Hüllen werden vor Verwendung vollständig geprüft, der authentifizierte Inhalt beim Entsperren.

## Lokale Finanzrevision

`financialRevision` ist ein lokales Metadatenaggregat mit reservierter `id = spaceId`, positiver Revision sowie Erstellungs-/Änderungszeitpunkt. Es enthält keine Kontofelder oder Geldwerte und erscheint nicht in Finanzlisten/Projektionen. Jeder lokale geldwirksame Batch erwartet und erhöht diese Revision atomar. Bei einem bisherigen Bereich ohne diesen Kopf wird sie mit Erwartung null angelegt. Dadurch konkurrieren auch neu angelegte beziehungsweise erste Konten um denselben geprüften Folgebestand. Vorhandene Finanzdaten bleiben erhalten; keine eager Migration. Finanzgegenbefehle prüfen und erhöhen den Kopf neu, restaurieren ihn jedoch nicht als fachliches Ziel. [ADR-039](decisions.md#adr-039--lokale-finanzrevision-schützt-neue-kontoaggregate) grenzt die Revision von späteren gemeinsamen Syncaggregaten ab.

Die reservierte Bereichs-ID wird in jeder fachlichen Änderungsmenge ausschließlich für `financialRevision` akzeptiert; normale Finanz-/Stammdatenaggregate können sie nicht belegen. Eine vorhandene ID-Kollision wird vor Schreiben kontrolliert abgewiesen; Originalaggregate werden weder überschrieben noch automatisch umbenannt.
