# Architekturentscheidungen

Stand: 2. Oktober 2026. Status: angenommen, außer ausdrücklich ersetzten Einträgen. Nutzerentscheidungen sind verbindlich; technische Defaults präzisieren das Konzept. Änderungen benötigen einen neuen Eintrag mit Grund, betroffenen Verträgen und Migration/Tests. Alte Einträge bleiben als Historie erhalten.

| ID | Entscheidung | Herkunft und Begründung | Konsequenz |
|---|---|---|---|
| ADR-001 | Öffentliches Open-Source-Projekt für Familien, DACH zuerst | Nutzerentscheidung | Keine kommerzielle Registrierung/Billing in v1 |
| ADR-002 | Private Bereiche und gemeinsame Haushalte getrennt | Nutzerentscheidung | Bereich ist Autorisierungs- und Synceinheit; keine versteckten privaten Zeilen in gemeinsamen Snapshots |
| ADR-003 | PWA und Desktop macOS/Windows/Linux | Nutzerentscheidung | Offlinefähige gemeinsame Fachlogik, keine mobilen Store-Apps in v1 |
| ADR-004 | Gemeinsame UI mit nativer Integration | Nutzerentscheidung | Tauri 2 und Plattformtokens; Desktop-Menüs/Dialoge echt nativ, fachliche Inhalte Webtechnologie |
| ADR-005 | Überwiegend neue Architektur statt Actual-Fork | Nutzerentscheidung | Actual als Referenz und selektive Quelle; kein kompatibles Actual-Syncprotokoll voraussetzen |
| ADR-006 | Familienkern zuerst, Plan- und Umschlagbudget | Nutzerentscheidung | P1–P11, Spezialfunktionen später; beide Methoden ohne doppelte Kontobuchungen |
| ADR-007 | Dateiimporte vor Bankanbindung, EUR zuerst | Nutzerentscheidung | CSV/CAMT/OFX/QFX; keine Providersecrets, Mehrwährung oder Wertpapierbewertung |
| ADR-008 | Ursprünglich mitlesender Server ohne E2EE | Ersetzt durch ADR-025 auf neue Nutzeranweisung | Nur historische Entscheidung; darf nicht implementiert werden |
| ADR-009 | Flexible Verteilung und nur freiwillige private Angaben | Nutzerentscheidung | Policygrundlagen ausdrücklich angeben; keine Einkommensableitung aus Privatbereich |
| ADR-010 | Mehrere Familien pro Server, mehrere Haushalte pro Person | Nutzerentscheidung | Mitgliedschaft unabhängig vom Privatbereich; kein globaler Familienadminzugriff |
| ADR-011 | admin/member/viewer; eigene Konten plus optional OIDC | Nutzerentscheidung | Keine öffentliche Registrierung, getrennte Betreiberrolle, Einladungsannahme |
| ADR-012 | Projektlizenz AGPL-3.0-or-later | Nachträgliche Nutzerentscheidung, ersetzt ursprünglichen MIT-Default | Eigene Dokumentation/Code AGPL; Fremdhinweise erhalten, passender Quellcode in Releases und Serveroberfläche |
| ADR-013 | Nur D0 jetzt; Zwischencommits pro Abschnitt | Nutzerauftrag | Keine App, Pakete oder Infrastruktur; P1 verlangt späteren ausdrücklichen Auftrag |
| ADR-014 | TypeScript/React/Vite, Tauri/Fastify, SQLite/Dexie | Technischer Default | Plattformfreier Kern; stabile kompatible Versionen erst P1 sperren |
| ADR-015 | Fachbefehle mit Revisionen statt generischem CRUD/CRDT | Technischer Default | Finanzaggregate atomar; explizite Konflikte statt stiller Feldverschmelzung |
| ADR-016 | Bestätigte Daten und lokale Entwürfe getrennt | Technischer Default | Offline-Queue und Rebase auf bestätigte Vorgänger; kein Datenverlust bei Ablehnung |
| ADR-017 | Haushalts-/Personenguthaben getrennt von Erstattungsreserve | Fachliche Präzisierung | Beiträge schaffen keine automatische Rückzahlungspflicht; private Vorleistungen haben explizite Erstattungsquelle |
| ADR-018 | Veröffentlichung als freigegebene Kopie plus privater Link | Fachliche Präzisierung | Keine privaten Quellen-IDs im Haushalt; Änderungen nur nach erneuter Bestätigung |
| ADR-019 | Rückerstattungen kumulativ aus ursprünglichen Anteilen | Technischer/Fachlicher Default | Teilzahlungen runden deterministisch und volle Erstattung stellt Originalverteilung wieder her |
| ADR-020 | Snapshotersatz erzeugt neue Epoche | Technischer Default | Alte Offlinewrites werden nicht wieder eingespielt; Entwürfe vor Übernahme sichern |
| ADR-021 | Eine SQLite-Serverinstanz und lokale Volumes | Technischer Default | Kein Cluster/NFS, serialisierte Writes; horizontaler Ausbau später neue Architekturentscheidung |
| ADR-022 | WIMM-Export einzelner Bereiche, getrennte Adminsicherung | Technischer Default | Finanzrestore verleiht keine Benutzerrechte; Nutzerexport enthält keine Credentials |
| ADR-023 | Offlinegeräte gelten als vertrauenswürdige lokale Geräte | Technischer Default aus Lokalbetrieb | Kein Fernwiderruf schon bekannter Daten; OS-Schutz statt behaupteter Appverschlüsselung |
| ADR-024 | Finanzlogik in TypeScript, begrenzte Rust-Speicherbrücke | Technischer Default | Keine zweite Budgetengine, kein uneingeschränktes SQL aus der UI |
| ADR-025 | E2EE ist Pflicht ab v1, ersetzt ADR-008 | Nutzerentscheidung: sonst kein Vertrauen | Finanzserver nur Chiffrate/öffentliche Metadaten; Fachvalidierung und Berechnungen auf Clients |
| ADR-026 | Bereichsschlüssel, signierte Rollen/Geräte und eigenständige Recovery | Technischer Default für ADR-025 | libsodium, Fingerprintprüfung, Schlüsselfreigabe, Rotation und separate Tresorentsperrung; Serverpasswortreset entschlüsselt nichts |
| ADR-027 | Authentifizierte Clients sind vertrauenswürdig; keine Codesignatur als Sicherheitsbasis | Zusätzliche Nutzerentscheidung | Web/PWA/Desktop gleich zugelassen; keine Attestierung/Build-Allowlist; Nachrichten-/Schlüsselsignaturen schützen Datenintegrität, keine Appherkunft |

## Nicht mehr offen

Keine Grundsatzentscheidung zu Fork, Lizenz, Mehrbenutzerstruktur, Rollen, Plattformen, Verschlüsselung oder Budgetmethoden bleibt dem späteren Agenten überlassen. Die Behandlung von Erstattungsreserve, Privatsichtbarkeit und Konflikten ist in den spezifischen Dokumenten festgelegt.

## In späteren Paketen zu ermittelnde technische Fakten

- P1: stabile Versionskombinationen und Buildtoolchain anhand offizieller Dokumentation ermitteln; kein erneutes Produktentscheidungsmeeting nötig.
- P4: native Plattformintegration anhand tatsächlich verfügbarer SDKs und dokumentierter Tauri-Funktionen prüfen; Windows/Linux/macOS-Smokechecks nachweisen.
- P8: Argon2-Laufzeitbenchmark und OS-Schlüsselspeicherverfügbarkeit messen; definierte Sicherheitsuntergrenzen nicht unterschreiten.
- P11: tatsächliche Repository-/Release-Quellcode-URL, Signierungsgeheimnisse und getestete Artefaktarchitekturen eintragen. Fehlende Credentials erlauben keine fingierte Releaseabnahme.

## Änderungsformat

Neue Entscheidung dokumentiert ID, Datum, Status, konkretes Problem, Entscheidung, Alternativen, Folgen und betroffene Aufgaben. Nutzerwünsche haben Vorrang vor technischen Defaults. Schema-/Syncänderungen nennen außerdem Migrations- und Kompatibilitätspfad. Bei Änderung bestehender Fachregeln Referenzrechnungen und Tests gleichzeitig aktualisieren.
