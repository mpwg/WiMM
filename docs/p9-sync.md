# P9 — Spezifikation für Zusammenarbeit und Synchronisierung

## Ziel und Verantwortung

Diese funktionale Spezifikation bleibt verbindlich; aktueller Auftrag/Freigabe ausschließlich in [Aufgaben](tasks.md), Fortschritt und Blockaden in GitHub. Die gemeinsame Rust-Architektur ist Ziel, keine behauptete Implementierung. Fachregeln im Rust-Kern, Clientabläufe in Rust-Anwendung, Serverabläufe im öffentlichen Rust-Server; Plattformen bleiben Adapter. Neue Produktfeatures dieses Pakets benötigen weiterhin ihren gesonderten Auftrag. [Architektur](architecture.md), [Prüfstrategie](testing.md).

## P9.1 — Verschlüsselte Operationen, Snapshots und Entwurfsexport

- Voraussetzungen: P8 erledigt; P2-Änderungssets/P3-Entwürfe vorhanden.
- Schritte: opake Handles auf lokale Aggregate abbilden; öffentliche Header/AAD und Gerätesignatur an Fachbefehl/Änderungsset binden; Snapshotbindung aus P8.4 um Initialisierung/Pullcursor erweitern; Hülle vor erstem Sendversuch dauerhaft fixieren; verschlüsselte wimm-drafts-Containerbasis mit separater Exportpassphrase über lokale Snapshot-/Dateiports implementieren.
- Ergebnis: interoperable signierte Chiffrate und sicherbare Originalentwürfe ohne sichtbare Fachfelder.
- Verträge: [Transportvertrag](encryption.md#verschlüsselter-transportvertrag), [Syncformat](synchronization.md), [Entwurfscontainer](formats.md), [API](api.md), [Testvektoren](crypto-test-vectors.md).
- Abnahme: neue Verschlüsselung frische Nonce; Retries identische Hülle; Domain-Separatoren/Kontexte korrekt; Headerrevisionen und entschlüsselte Aggregate stimmen überein; unbekannte Suites abgewiesen; Entwürfe nach WIMMENC1-Vertrag verschlüsselt exportierbar, ohne Credentials.
- Prüfungen: C01/C02, feste interoperable Vektoren, Header-/Nonce-/AAD-/Signatur-/Handlemanipulation und Snapshotcursorbindung; Entwurfsexport mit falscher Passphrase/Manipulation sowie KDF-/Containerlimits.

## P9.2 — Server-Push/Pull, CAS und Receipts

- Voraussetzungen: P9.1 erledigt.
- Schritte: Push/Pull auf CiphertextStore implementieren; Sitzung/Roster/Gerät/Signatur/Version/Abhängigkeiten/CAS prüfen; Heads, Bundle, Change und Receipt atomar committen; Limits und unveränderte Konfliktchiffrate beachten.
- Ergebnis: idempotenter öffentlicher Transport ohne serverseitige Finanzberechnung.
- Verträge: [Push/Pull](synchronization.md), [API-Antworten/Fehler](api.md), [Speichergrenzen](architecture.md).
- Abnahme: Batch maximal 100 Operationen/2 MiB, Operation atomar, Batch nicht insgesamt; Pull maximal 500 Changes; identische ID/Hash gleiches Receipt, andere Hülle OPERATION_ID_REUSED; temporäre Fehler ohne endgültiges Receipt.
- Prüfungen: S04/S05/S08/S09/S15, CAS-Rennen, Abbruch nach Commit/vor Antwort, DB-Rollback und Rechte pro Operation.

## P9.3 — Outboxscheduler, Retry und Abhängigkeiten

- Voraussetzungen: P9.2 erledigt.
- Schritte: Outboxzustandsautomat, dependsOn und Bindung bestätigter Vorgängerrevisionen umsetzen; Start/Fokus/Reconnect-/Sichtbarkeitstrigger, Debounce/Retry und Tabführung anbinden; bekannte Rechte-/Versionsfehler separat behandeln.
- Ergebnis: fortsetzbare Offline-Queue mit getrennten Originalentwürfen.
- Verträge: [Zustände und Scheduler](synchronization.md), [Speicherdaten](data-model.md), [S07/S11/S14](testing.md).
- Abnahme: Vorgänger vor abhängigem Sendversuch bestätigt; gesendete Hüllen nie verändert; nur Abhängige blockiert; 401 erneute externe Anmeldung, 403/404 Bereich gesperrt; Standalone ohne Outbox.
- Prüfungen: S07/S09/S11/S14, Neustart aus sending, exponentieller Retry/Jitter, versteckte Tabs, Führungswechsel und Rechtewechsel während Offlinephase.

## P9.4 — Pullvalidierung, Quarantäne und Konflikte

- Voraussetzungen: P9.3 erledigt.
- Schritte: Manifest-/Zertifikats-/Hashkette und Nachricht prüfen, entschlüsseln und Fachinvarianten validieren; komplette Seite samt Cursor atomar speichern; Quarantäne/Hashrollback/UPDATE_REQUIRED und Konfliktauflösung mit neuer Operation implementieren.
- Ergebnis: clientvalidierter bestätigter Stand ohne stilles Überschreiben oder Cursorverlust.
- Verträge: [Pull/Konflikte](synchronization.md), [E2EE](encryption.md), [Fachinvarianten](domain.md).
- Abnahme: ungültige Nachricht keine Anwendung/Cursorfortschreibung; stale Entwurf sichtbar; keine Feldverschmelzung; Auflösung prüft aktuelle Revision und Abhängige einzeln; ohne Leserecht keine neue Konfliktfassung.
- Prüfungen: S06/S08/S10/S15, C02/C06/C12, Absturz vor Seitencommit, viewer-Fälschung, bekannte Replays und manipulierte entschlüsselte Fachinhalte.

## P9.5 — Onboarding, Rotation und getrennte Veröffentlichung

- Voraussetzungen: P9.4 erledigt.
- Schritte: lokalen Bereich nach bestätigter Rettungscodesicherung serverbinden; Snapshot/Pullcursor und adoptEmptyPrivate absichern; P8-Rotation in Mehrgeräteabläufe integrieren; private Kopie/PublicationLink getrennt synchronisieren.
- Ergebnis: verschlüsselter Einstieg und Bereichswechsel ohne Vermischung privater Daten.
- Verträge: [Serverbindung](architecture.md#lokaler-commit-und-projektionen), [API](api.md), [private Veröffentlichung/Epochen](synchronization.md).
- Abnahme: kein automatisches Zusammenführen vorhandener Daten; neue Epoche blockiert Alt-Replay; Entwürfe vor Snapshotübernahme sicherbar; kein Push enthält beide Bereiche; Haushaltablehnung lässt Privatbuchung intakt und Link pending/rejected.
- Prüfungen: S11–S13, C05/C08/C09/C12, kontrollierter Epochwechsel, Rotation mit Offlinewrite, erste Serverbindung und befüllter/leerer Initialbereich.

## P9.6 — Mehrgeräteoberfläche und Gesamt-Abnahme

- Voraussetzungen: P9.5 erledigt.
- Schritte: Sync-/Konflikt-/Schlüssel-/Versionszustände und verschlüsselten Entwurfsexport aus P9.1 in UI anbinden; drei Clients mit privaten/gemeinsamen Bereichen betreiben; konvergierte Snapshots sowie Serverdump/Transport/Logs prüfen.
- Ergebnis: nachgewiesene Zusammenarbeit mit Offlinefortsetzung und expliziten Konflikten.
- Verträge: [P9](tasks.md#p9--zusammenarbeit-und-synchronisierung), [UI](ui.md), [S-/C-Matrix](testing.md).
- Abnahme: S04–S15 und C01–C03/C05–C09/C12 bestanden; kanonische Finanzsnapshots und Revisionen nach Wiederverbindung gleich; Entwürfe erhalten/exportierbar; keine Finanzklartexte auf Server/Transport/Logs.
- Prüfungen: echte DBs und Netzwerkausfälle, drei Clients, Quarantäne/Rotation/viewer-Fälschung, getrennte private Veröffentlichung und UI-Konfliktabläufe; Entwurfsexport mit falscher Passphrase/Manipulation, KDF-/Containerlimits und ohne Credentials; Crypto-/Fach-/Adapterregressionen.
