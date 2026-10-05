# Architekturentscheidungen

Stand: 2. Oktober 2026. Status: angenommen, außer ausdrücklich ersetzten Einträgen. Nutzerentscheidungen sind verbindlich; technische Defaults präzisieren das Konzept. Änderungen benötigen einen neuen Eintrag mit Grund, betroffenen Verträgen und Migration/Tests. Alte Einträge bleiben als Historie erhalten.

| ID | Entscheidung | Herkunft und Begründung | Konsequenz |
| --- | --- | --- | --- |
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
| ADR-011 | admin/member/viewer; eigene Konten plus optional OIDC | Durch ADR-030 ersetzt | Historischer Authentifizierungsdefault; nur Rollen-/Einladungsregeln bleiben gültig |
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
| ADR-026 | Bereichsschlüssel, signierte Rollen/Geräte und eigenständige Recovery | Technischer Default für ADR-025 | libsodium, Fingerprintprüfung, Schlüsselfreigabe, Rotation und separate Tresorentsperrung; Änderungen beim externen Identitätsanbieter entschlüsseln nichts |
| ADR-027 | Authentifizierte Clients sind vertrauenswürdig; keine Codesignatur als Sicherheitsbasis | Zusätzliche Nutzerentscheidung | Web/PWA/Desktop gleich zugelassen; keine Attestierung/Build-Allowlist; Nachrichten-/Schlüsselsignaturen schützen Datenintegrität, keine Appherkunft |
| ADR-028 | Repositorylokale Agenten-Skills und gemeinsame Vorlagen, GitHub/VS Code | Nutzerauftrag plus technischer Default | Vier Skills in .agents/skills; zentrale Docs statt Regelkopien; keine globale Plugininstallation, kein Push/CI/Appstart |
| ADR-029 | Kompakter Einstieg, P1-Teilaufgaben und portable Prüfungen; Hooks erst P1 | Nutzerauftrag D2 und bestätigter Ergänzungsplan | Zentrale Fachquellen erhalten, Beispiele synthetisch; optionaler pre-commit prüft vorgemerkte Inhalte ohne Dateiumschreiben; gemeinsame Prüfungen in CI; keine automatische Commit-/Push-/Taskabschlussfunktion |
| ADR-030 | Serveridentitäten ausschließlich extern; Apps lokal eigenständig | Nutzerentscheidung vom 2. Oktober 2026; ersetzt ADR-011 Authentifizierungsdefault | Keine lokale Benutzer-/Passwortverwaltung oder Setupkonten; Serververbindung setzt OIDC oder gleichwertigen externen Identitätsdienst voraus; Standalone-Apps benötigen keine Anmeldung |
| ADR-032 | Abgleich nur ohne Differenz, Budgeteintritt mit Geldfreigabe und gezielte Gegenbefehle | P4.4-Vertragsabgleich mit verbindlichem Fachmodell | Auswahl, Ausgangssaldo und CAS explizit; keine Snapshotrücksetzung |
| ADR-031 | Gemeinsame UI enthält den lokalen Client-Composition-Root | P4-Umsetzung | Die UI darf die lokalen Crypto-/Storage-Clients zusammensetzen; native Systemfunktionen bleiben injizierte Ports |

## ADR-032 — Abgleich und lokale Gegenbefehle

- Datum: 5. Oktober 2026.
- Status: angenommen.
- Herkunft: P4.4-Implementierungsauftrag und Abgleich mit dem bestehenden Fachmodell.
- Problem: Die bisherige Implementierung bestätigte Kontoauszüge trotz Differenz; das Datenmodell verlangte beim Budgeteintritt eine Kategorie, obwohl das Fachmodell eine Freigabe vorhandenen Geldes vorsieht. Entsperrung und Historie benötigten einen vollständigen atomaren Umfang.
- Entscheidung: Nur Differenz null erlaubt `reconciliation.confirm`. Bestätigte Ausgangsbuchungen bis zum Auszugsdatum werden zusätzlich mit CAS gelesen; die neue Bestätigung enthält nur ausgewählte offene Bewegungen. Beim Budgetabgang ist eine Ausgabenkategorie erforderlich, beim Eintritt stattdessen `budgetRelease=true`. Die Entsperrung hebt verbundene Abgleiche samt Transferpaaren in einem Batch auf. Undo/Redo erzeugt geprüfte reguläre Gegenbefehle für die betroffenen Aggregate; Revisionen steigen und Tombstones bleiben erhalten.
- Alternativen: Automatische Korrekturbuchungen und vollständige Bereichssnapshotrücksetzungen widersprechen Bestätigung beziehungsweise Revisionsschutz und werden ausgeschlossen.
- Folgen: UI zeigt Auswahl und Differenz, verlangt separate Korrekturbestätigung und bewahrt geänderte Eingaben bis zum bestätigten Verwerfen. Die flüchtige Historie wird bei Bereichswechsel und Stammdatenaktionen geleert.
- Betroffene Verträge/Pakete: [Fachmodell](domain.md), [Datenmodell](data-model.md), [Fachbefehle](api.md#fachbefehle), domain, ui und P4.4.
- Migration und Kompatibilität: Keine Speicherstrukturmigration; das optionale Finanzfeld `budgetRelease` liegt im bestehenden Aggregatpayload. Die bisherige UI konnte mangels Kategorieangabe keine Budgetgrenztransfers erzeugen. Alte synthetische Abgleiche mit Differenz werden nicht automatisch korrigiert; explizit entsperren und neu prüfen. Finanzvertrag vor der ersten Veröffentlichung präzisiert; Servertransport unverändert.
- Prüfung: F03, Differenz-/Ausgangssaldo-/Budgetgrenzfälle, atomare Fehlrollback- und Gegenbefehlsprüfungen sowie Chromium-Tastatur/Touch und dauerhafter Neustart in P4.4.

## ADR-031 — Lokale Client-Composition in der UI

- Datum: 3. Oktober 2026.
- Status: angenommen.
- Problem: Web und Desktop benötigen dieselbe lokale Tresor-, Bereichs- und Speicherorchestrierung; doppelte App-Composition würde Verträge auseinanderführen.
- Entscheidung: `packages/ui` enthält den gemeinsamen Client-Composition-Root und darf dazu `crypto` und `storage` verwenden. Systemzugriffe verbleiben hinter `PlatformServices`.
- Folgen: Fachkern und Server bleiben weiterhin frei von UI-/Speicher-/Krypto-UI-Abhängigkeiten; Paketgraph prüft diese eng begrenzte Richtung.
- Prüfung: TypeScript, Paketgraph sowie Web-/Desktop-Build in P4.

## ADR-030 — Externe Serveridentität und eigenständige Apps

- Datum: 2. Oktober 2026.
- Status: angenommen.
- Herkunft: ausdrückliche Nutzeranforderung.
- Problem: Die bisherige Spezifikation erlaubte lokale Serverkonten und stellte OIDC als optional dar. Das widerspricht der Anforderung, Serveridentitäten extern zu beziehen und Apps unabhängig vom Server nutzbar zu halten.
- Entscheidung: Es gibt keine lokale Benutzer-, Registrierungs- oder Passwortverwaltung. Jede Serververbindung authentifiziert über OIDC oder einen gleichwertig sicheren externen Identitätsdienst, beispielsweise Authentik. Desktop- und PWA-Apps bleiben ohne Serveranmeldung vollständig stand-alone nutzbar; lokale Profile und fachliche Teilnehmer sind keine Benutzerkonten.
- Alternativen: Lokale Passwörter als Notfallfallback oder ein eingebautes Bootstrapkonto wurden verworfen.
- Folgen: Betreiber konfigurieren den Identitätsanbieter vor Serveranmeldung und ordnen erste Administratorrechte über Providerclaims oder gleichwertige externe Verwaltung zu. Provideridentität und lokale Tresorentsperrung bleiben getrennt.
- Betroffene Verträge/Pakete: Produkt, Fachmodell, Architektur, Datenmodell, API, Sicherheit, Verschlüsselung, Betrieb, UI, Tests und P8.
- Migration und Kompatibilität: Vor Implementierung vorhandene Entwürfe zu lokalen Zugangsdaten/Bootstrap entfernen; keine produktive Datenmigration ist nötig, da Serverauthentifizierung noch nicht implementiert ist.
- Prüfung: Konsistenzabgleich der Dokumentation im zugehörigen PR; spätere OIDC-/Provider- und Standalone-Prüfungen in P8/P4.

## ADR-029 — Einstieg und portable Prüfungen

- Datum: 2. Oktober 2026.
- Status: angenommen.
- Herkunft: Nutzerauftrag D2 und bestätigter Ergänzungsplan.
- Problem: Die umfangreiche Spezifikation braucht einen kurzen Einstieg und begrenzte erste Arbeitsschritte; die Dokumentationsphase besitzt noch keine gemeinsame Prüf-Toolchain.
- Entscheidung: Einstieg, Lesematrix, P1-Teilaufgaben und synthetische Beispiele ergänzen; optionale lokale Hooks erst in P1 mit denselben Validatoren wie CI umsetzen. Nach jedem abgeschlossenen Abschnitt ist ein Zwischencommit mit zusammengehörigen Änderungen verpflichtend.
- Alternativen: Ein Dokumentations-Hook bereits in D2 wurde angeboten; der Nutzer wählte Konzept jetzt und Umsetzung in P1. Agentenspezifische Automatik wird erst bei konkretem Bedarf geprüft.
- Folgen: Zentrale Fachquellen bleiben maßgeblich; keine Installation, Gitkonfigurationsänderung oder zusätzliche Implementierungsfreigabe in D2.
- Betroffene Verträge/Pakete: [Einstieg](getting-started.md), [Agentenleitfaden](agent-guide.md), [P1-Teilaufgaben](p1-foundation.md), [Entwicklung](development.md); D2 und P1.6.
- Migration und Kompatibilität: Keine Daten-/Protokollmigration, weil ausschließlich Dokumentation und Arbeitsregeln ergänzt werden.
- Prüfung: D2-Link-/Struktur-/Konsistenzprüfung; später Hookkontrollfälle einschließlich teilweise vorgemerkter Inhalte und CI-Abnahme in P1.6.

## Nicht mehr offen

Keine Grundsatzentscheidung zu Fork, Lizenz, Mehrbenutzerstruktur, Rollen, Plattformen, Verschlüsselung oder Budgetmethoden bleibt dem späteren Agenten überlassen. Die Behandlung von Erstattungsreserve, Privatsichtbarkeit und Konflikten ist in den spezifischen Dokumenten festgelegt.

## In späteren Paketen zu ermittelnde technische Fakten

- P1: stabile Versionskombinationen und Buildtoolchain anhand offizieller Dokumentation ermitteln; kein erneutes Produktentscheidungsmeeting nötig.
- P4: native Plattformintegration anhand tatsächlich verfügbarer SDKs und dokumentierter Tauri-Funktionen prüfen; Windows/Linux/macOS-Smokechecks nachweisen.
- P8: OIDC-Providerinteroperabilität und OS-Schlüsselspeicherverfügbarkeit prüfen; externe Authentifizierungsgrenzen verifizieren.
- P11: tatsächliche Repository-/Release-Quellcode-URL, Signierungsgeheimnisse und getestete Artefaktarchitekturen eintragen. Fehlende Credentials erlauben keine fingierte Releaseabnahme.

## Änderungsformat

Neue Entscheidung dokumentiert ID, Datum, Status, konkretes Problem, Entscheidung, Alternativen, Folgen und betroffene Aufgaben. Nutzerwünsche haben Vorrang vor technischen Defaults. Bei Widersprüchen zwischen verbindlichen Quellen den Widerspruch benennen und betroffene Quellen vor abhängiger Implementierung gemeinsam korrigieren; bei unklarer Produktabsicht rückfragen. Schema-/Syncänderungen nennen außerdem Migrations- und Kompatibilitätspfad. Bei Änderung bestehender Fachregeln Referenzrechnungen und Tests gleichzeitig aktualisieren.

## ADR-033 — Lokale Importgruppen und Automatisierung

- Datum: 5. Oktober 2026.
- Status: angenommen.
- Herkunft: ausdrücklicher Nutzerauftrag „Setze P5.* um“.
- Problem: Rohparser allein ermöglichen keine bestätigte Übernahme; getrennte Fortschrittswrites und parallele Fälligkeitsbestätigungen könnten Doppelbuchungen erzeugen.
- Entscheidung: Die gemeinsame Clientkomposition darf zusätzlich `importers` verwenden. Parser und vollständige Importgruppenvorbereitung laufen in lokal gebündelten Workern; die Clientaktion injiziert ihren Zeitpunkt. Mappingvorlagen, bestätigte Zeilenentscheidungen, Quellreferenzen und Fortschritt liegen ausschließlich im jeweiligen lokalen Bereich. Der Fachkern erzeugt je Gruppe höchstens 100 Buchungen zusammen mit Fingerprints und Fortschritt. Eine Kontorevision serialisiert konkurrierende Importgruppen; eine Schedulerevision serialisiert Fälligkeitsbestätigungen. Fachberechnungen bleiben plattformfrei.
- Alternativen: Ein globaler Importrollback, automatische Dublettenentscheidung und ausführbare Regelskripte widersprechen den Verträgen.
- Folgen: Abbruch beendet die Vorbereitung beziehungsweise pausiert zwischen bestätigten Gruppen. Bereits gespeicherte Gruppen bleiben erhalten. Reine Vorschläge ändern keine Salden. Bestätigung und ausdrückliche Importzuordnung schreiben Occurrence und Buchung gemeinsam. Regelreihenfolge wird atomar revisionsgeprüft. Quellfingerprints werden vor Regelaktionen festgehalten; importierte Empfänger werden anhand eindeutiger aktiver Namen/Aliasse wiederverwendet oder atomar angelegt. Neue Dauerzahlungsbuchungen prüfen sichere Kontosummen und revidieren zusätzlich das Konto als CAS-Anker.
- Betroffene Verträge/Pakete: [Architektur](architecture.md), [Dateiformate](formats.md), [Datenmodell](data-model.md), [API](api.md), domain, importers und ui; P5.2–P5.6.
- Migration und Kompatibilität: Neue lokale Aggregattypen ergänzen das generische Speicherformat ohne Tabellenmigration. Bestehende Buchungen bleiben unverändert. Die Server-/Altclient-Kompatibilitätsprüfung folgt mit dem tatsächlichen Finanzprotokoll in P9; ältere Clients dürfen unbekannte Aggregate nicht still anwenden.
- Prüfung: Formatfixtures, Fachfehlfälle, echte Browserworker, atomare Speicherfehlfälle, Wiederaufnahme und UI-Abläufe in den P5-Tests. Plattformgrenzen stehen in der P5-Übergabe.
