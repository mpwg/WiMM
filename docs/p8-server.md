# P8 — Spezifikation für Server und Identitäten

## Ziel und Verantwortung

Diese funktionale Spezifikation bleibt verbindlich; aktueller Auftrag/Freigabe ausschließlich in [Aufgaben](tasks.md), Fortschritt und Blockaden in GitHub. Die gemeinsame Rust-Architektur ist Ziel, keine behauptete Implementierung. Fachregeln im Rust-Kern, Clientabläufe in Rust-Anwendung, Serverabläufe im öffentlichen Rust-Server; Plattformen bleiben Adapter. Neue Produktfeatures dieses Pakets benötigen weiterhin ihren gesonderten Auftrag. [Architektur](architecture.md), [Prüfstrategie](testing.md).

## P8.1 — CiphertextStore und öffentliche Servergrundlage

- Voraussetzungen: P7 erledigt; öffentliche P1-Verträge vorhanden.
- Schritte: öffentliche Server-SQLite-Schemata/Indizes, Verwaltungsrevisionen und CiphertextStore implementieren; Betreiberkonfiguration vor DB-Migration validieren; Health/Meta und explizite Antwortschemas vervollständigen.
- Ergebnis: öffentliche Verwaltungs-/Chiffratbasis ohne Finanzklartexttabellen.
- Verträge: [Architektur](architecture.md), [E2EE-Speicherebenen](data-model.md#e2ee-speicherebenen), [API](api.md), [Betrieb](operations.md).
- Abnahme: keine Finanzprojektion/privaten Keys auf Server; fehlender externer Provider verhindert Serverbetrieb mit verständlichem Fehler; ready nur nach verfügbaren Voraussetzungen; keine lokalen Setup-/Passwortpfade.
- Prüfungen: echte DB-Transaktionen, Konfigurationsfehlfälle, Healthzustände, Serialization und Server-Paketgrenzen.

## P8.2 — Externe Anmeldung, Sitzungen und CSRF

- Voraussetzungen: P8.1 erledigt.
- Schritte: gepflegte OIDC-Bibliothek prüfen/sperren; Authorization Code/PKCE, State/Nonce und Issuer-/Audience-/Signatur-/Zeitprüfung implementieren; issuer/subject-Zuordnung, Provideradministration, Cookies/CSRF/Origin und Logout/Widerruf anbinden.
- Ergebnis: externe Serveridentität getrennt von lokaler Tresorentsperrung.
- Verträge: [ADR-030](decisions.md#weitergeltende-produkt--und-sicherheitsentscheidungen), [Sicherheit](security.md), [Authendpunkte](api.md).
- Abnahme: keine E-Mail-basierte automatische Identitätsverknüpfung; Tokenhash statt Rohsession in DB; Laufzeiten eingehalten; Providerlogin/-recovery entschlüsselt keine Finanzdaten; kein Passwortfallback.
- Prüfungen: Providerinteroperabilität, falscher State/Nonce/Issuer/Audience, Replay, Providerentzug, Sessionwechsel/-ablauf, CSRF/Origin und C04.

## P8.3 — Desktopkopplung und OS-Schlüsselablage

- Voraussetzungen: P8.2 erledigt.
- Schritte: browserbestätigten Device-Code-Ablauf mit Ablauf/Pollgrenze/Einmalausgabe implementieren; begrenzte native HTTPS-Transportbrücke und OS-Keyring für Device-Token sowie freigegebenen Tresorschlüssel anbinden.
- Ergebnis: serververbundener Desktop mit widerrufbaren sicher gespeicherten Credentials.
- Verträge: [Gerätekopplung](security.md#sitzungen-und-gerätekopplung), [Plattformintegration](architecture.md), [Entsperren](encryption.md).
- Abnahme: Device-ID allein kein Login; Poll frühestens fünf Sekunden, Kopplung zehn Minuten gültig; Token einmal ausgegeben; Linux ohne sicheren Keyring nur flüchtig, keine Klartextdatei; Tauri nur konfigurierte Origin.
- Prüfungen: echte Desktopkopplung, pending/denied/expired, paralleles Polling/Replay, Widerruf und Keyrings auf verfügbaren macOS-/Windows-/Linuxsystemen.

## P8.4 — Öffentliche Identitäten, Tresore und Gerätezertifikate

- Voraussetzungen: P8.3 erledigt; lokaler P3-Tresor vorhanden.
- Schritte: öffentliche Identitätsschlüssel mit Besitznachweis registrieren; verschlüsselten Vault per CAS speichern; Geräteaufnahme per entsperrtem Gerät oder separater Recovery und gepinnter Identität umsetzen; Zertifikate/Widerrufe signieren und prüfen; clientseitige Snapshotheader/-hashes samt Verschlüsselungs-/Signaturbindung für initiale Haushaltsanlage und spätere Rotation kapseln.
- Ergebnis: getrennte Serveranmeldung und kryptografisch bestätigte Geräteberechtigung.
- Verträge: [Verschlüsselung](encryption.md), [Cryptoendpunkte](api.md), [Krypto-Testvektoren](crypto-test-vectors.md).
- Abnahme: Zertifikat/Fingerprint/Identität geprüft; Server erhält nur verschlüsselten Vault und öffentliche Keys; kein Schlüsselaustausch allein durch Providerlogin; Appsignatur/Attestierung keine Aufnahmebedingung.
- Prüfungen: ausgetauschte Identität, falsches Zertifikat, Vault-CAS, Gerätewiderruf, manipulierte Snapshotheader/-hashes/-signatur, C05/C07/C10/C11 und bestehende Bindingtests.

## P8.5 — Mitgliedschaften, Einladungen und KeyGrants

- Voraussetzungen: P8.4 erledigt.
- Schritte: Haushaltsverwaltung und Einladungen implementieren; pending_key_grant, Fingerprintvergleich, signierte Rosterkette/Genesis, empfängergebundene Grants und bestätigte Annahme umsetzen; Teilnehmer-/Identitätszuordnung separat bestätigen lassen.
- Ergebnis: explizit autorisierte Haushaltsmitglieder mit geprüften Bereichsschlüsseln.
- Verträge: [Rollenmatrix](product.md#rollenmatrix), [Familienbeitritt](encryption.md#familienbeitritt-und-identitätsprüfung), [Verwaltungs-API](api.md).
- Abnahme: Einladung sieben Tage/einmal gültig; kein Finanzzugriff vor KeyGrant-Annahme; letzte admin-Rolle geschützt; fachliche Teilnehmerzuordnung verleiht kein Zugriffsrecht; keine privaten Keys anderer Personen.
- Prüfungen: Rolle/Owner/Fremd-ID/anonym je Ressourcenendpoint, abgelaufene/widerrufene Einladung, falscher Empfänger/Manifesthash, viewer-Schreibfälschung und C05/C06.

## P8.6 — Rollenwiderruf und atomare Bereichsrotation

- Voraussetzungen: P8.5 erledigt.
- Schritte: admin-Client erzeugt neue K-Version, signiertes Roster, aktuellen verschlüsselten Snapshot mit der Bindung aus P8.4 und Grants für verbleibende Mitglieder; Server aktiviert Manifest/Widerruf/Snapshot atomar per CAS; member→viewer und Gerätewiderruf unterscheiden.
- Ergebnis: geprüfter Rotationsvertrag mit unmittelbaren öffentlichen Rechteänderungen.
- Verträge: [Rotation](encryption.md#entfernen-rollenwechsel-und-rotation), [API](api.md), [Sync-Epochen](synchronization.md#snapshotersatz-und-epochen).
- Abnahme: neue Daten mit alten Keys nicht entschlüsselbar; keine Teilaktivierung; stale Roster Konflikt; letzter kryptografischer admin bleibt; alte lokale Kopien nicht als fernwiderrufbar bezeichnet.
- Prüfungen: C08, Rollen-/Gerätewiderruf, alte K-/Roster-Version, CAS-Rennen und DB-Abbruchpunkte; vollständige Offlineentwurfs-/Konvergenzabläufe folgen in P9.

## P8.7 — Zugriffsmatrix und Gesamt-Abnahme

- Voraussetzungen: P8.6 erledigt.
- Schritte: Identitäts-/Geräte-/Schlüsselflächen und externe Abmeldung abschließen; Auth-/Rollenmatrix, Rate-Limits, Origins und Serverlogs prüfen; Plattform-/Providerbelege zusammenführen.
- Ergebnis: abgesicherte Identitäts-, Rollen- und Schlüsselbasis für P9.
- Verträge: [P8](tasks.md#p8--öffentlicher-rust-server-und-identitäten), [Sicherheit](security.md), [Zugriffs-/Cryptoabnahme](testing.md).
- Abnahme: C04–C08/C10–C11 bestanden; Fremd-IDs geschützt, letzter admin bleibt; Authreplays abgewiesen; kein Serverprivatschlüssel; authentifizierte Clients unabhängig von Appsignatur; sichere Linuxalternative.
- Prüfungen: vollständige Endpointzugriffsmatrix, echte Provider-/Desktopintegration, CSRF-/Origin-/Rate-Limits, Schlüssellebenszyklus und keine sensitiven Inhalte in DB/Logs.
