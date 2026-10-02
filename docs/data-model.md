# Datenmodell und Aggregate

## Gemeinsame Typen

IDs sind UUIDs; technische IDs werden zufällig lokal erzeugt. Geld = sicherer ganzzahliger Centbetrag, Datum = validiertes `YYYY-MM-DD`, Monat = `YYYY-MM`, Zeitpunkt = ISO-8601 UTC. Revision ist eine nichtnegative sichere Ganzzahl; neue serverseitige Aggregate starten bei 1, erwartete Revision 0 bedeutet Neuanlage.

Finanzaggregate besitzen `id`, `spaceId`, `revision`, `createdAt`, `updatedAt`, `deletedAt?`. Kindzeilen verwenden die Revision des Elternaggregats. Finanzzeitpunkte und neue Aggregate werden clientseitig erstellt und authentifiziert verschlüsselt; der Server darf signierten Inhalt nicht verändern. Er bestätigt nur öffentliche erwartete/neue Revisionen per CAS. Zeitpunkte entscheiden nicht über Konflikte.

## Verwaltungsdaten

| Entität | Pflichtfelder neben ID/Zeitpunkten | Beziehungen und Regeln |
| --- | --- | --- |
| User | displayName, normalizedEmail, status | E-Mail eindeutig auf Server; privater Bereich genau einer; keine Passwörter in Finanzexporten |
| Credential / OidcIdentity | userId, Art, Hash bzw. issuer/subject | issuer + subject eindeutig; E-Mail-Gleichheit verknüpft Identitäten nicht automatisch |
| Household | name, timezone, sharedSpaceId | Genau ein gemeinsamer Bereich; sharedSpaceId eindeutig |
| Space | kind, currency, syncEpoch, ownerUserId? / householdId? | kind `private` oder `household`; genau passende Eigentumsreferenz; lokal ownerLocalProfileId statt User möglich |
| Membership | householdId, userId, role, status | Paar eindeutig; admin/member/viewer; keine Entfernung des letzten aktiven admin |
| Participant | spaceId, name, kind, archived, userId? | kind person/household; genau ein technischer Haushaltsteilnehmer; Benutzerzuordnung nur mit Zustimmung |
| Invitation | householdId, role, tokenHash, expiresAt, createdBy, consumedAt? | Rohcode nur beim Erstellen; sieben Tage gültig, einmal nutzbar; nicht finanziell synchronisieren |
| Session / Device | userId, tokenHash, expiry, revokedAt? / name | Sessiondaten nie exportieren; Device-ID allein authentifiziert nicht |

## E2EE-Speicherebenen

Die Finanztabellen unten existieren ausschließlich auf Clients bzw. in entschlüsselten Exports. Server-Household enthält ID und Verwaltungsreferenzen, keinen Klartext-Familiennamen/Zeitzoneninhalt. Login-displayName/E-Mail sind notwendige öffentliche Accountmetadaten; finanzielle Teilnehmernamen bleiben verschlüsselt.

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
| Transfer | date, sourceAccountId, targetAccountId, amount, budgetCategoryId? | Zwei Transaction-Kinder, vollständiges Aggregat; Betrag positiv, Konten verschieden; budgetCategoryId bei Abgang aus on-budget zu off-budget verpflichtend |
| Reconciliation | accountId, statementDate, statementBalance, transactionIds[] | Betroffene Buchungsrevisionen prüfen; historische Bestätigung |
| BudgetMethodPeriod | effectiveMonth, method | Pro Bereich/Monat eindeutig, chronologische Historie |
| BudgetMonth | month, method, lines[] | lines: categoryId, planned?/assigned; vollständiger Monatsstand mit einer Revision |
| AllocationPolicy | effectiveDate, method, entries[], archived | entries: participantId, weight bzw. declaredIncome; keine Privatbereichsreferenzen |
| SharedExpense | date, amount, categoryId, payerId, fundingKind, reimbursementSource?, sourceTransactionId?, sourceSplitId?, policySnapshot, shares[] | Private Quellen besitzen keine privaten IDs im öffentlichen Datensatz; shares: participantId/amount |
| ExpenseRefund | sharedExpenseId, date, amount, receivedBy, sharedTransactionId? | Positiver Erstattungsbetrag; ursprüngliche Anteile abgeleitet |
| Contribution | date, participantId, amount, householdTransactionId | Positive Einlage; Kindbuchung auf gemeinsamem Konto |
| Settlement | date, payerId, recipientId, amount, householdTransactionId?, applications[] | applications: expenseId/amount; payer != recipient; tatsächlicher Zahlungsweg |
| AdvanceOffset | expenseId, participantId, date, amount, reason | Dokumentierte Eigenanteilsverrechnung, auf ursprünglichen Eigenanteil begrenzt |
| Schedule | startDate, frequency, interval, endDate?, template, enabled | frequency weekly/monthly/yearly; Template ohne fremde Bereichsreferenzen |
| ScheduleOccurrence | scheduleId, dueDate, state, transactionId? | Paar eindeutig; state proposed/confirmed/skipped |
| Rule | order, conditions[], actions[], stopProcessing, enabled | Nur katalogisierte Bedingungen/Aktionen |
| SavingsGoal | categoryId, targetAmount, targetDate?, archived | Betrag positiv; Rate und Fortschritt Projektionen |

Systemkategorien/-teilnehmer erhalten lokale stabile IDs und werden als vollständige Datensätze exportiert. Sie dürfen nicht vom Nutzer entfernt werden. Finanzierungs-/Ausgleichsbuchungen werden durch den zugehörigen Befehl erzeugt; unabhängig davon veränderbare Kopien sind unzulässig.

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

Fachfremdschlüssel werden in clientseitigem SQLite aktiviert, in IndexedDB durch denselben Fachvalidator geprüft. Der CiphertextStore kann keine Finanzreferenzen prüfen. Referenzen auf gelöschte Objekte dürfen nicht neu erzeugt werden. Tombstones bleiben verschlüsselt erhalten; Epochwechsel nur durch clientgeprüften, signierten Snapshotersatz. Administrationsdaten gehören nicht in gewöhnliche Finanzsnapshots.

## Schemaentwicklung

Storage-Schemaversion, Fachvertragsversion, Exportformatversion und Sync-Epoche sind unabhängig. Migrationen sind fortlaufend nummeriert und nur vorwärts; vor destruktiven Änderungen Sicherung. Konkrete SQL-DDL und Dexie-Stores entstehen in P3/P8 aus diesem Modell; gemeinsam überprüfte Vertragsschemas in P1/P2 sind die spätere maschinenlesbare Quelle.
