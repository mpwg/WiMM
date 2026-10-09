# Architekturentscheidungen

Stand: 8. Oktober 2026. Status: angenommen, außer ausdrücklich ersetzten Einträgen. Nutzerentscheidungen sind verbindlich; technische Defaults präzisieren das Konzept. Änderungen benötigen einen neuen Eintrag mit Grund, betroffenen Verträgen und Migration/Tests. Alte Einträge bleiben als Historie erhalten.

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
| ADR-021 | Eine SQLite-Serverinstanz und lokale Volumes | SQL-Beschränkung als Ziel durch ADR-044 ersetzt | SQLite bleibt Standard; kein Cluster/NFS, horizontaler Ausbau weiterhin eigene Entscheidung |
| ADR-022 | WIMM-Export einzelner Bereiche, getrennte Adminsicherung | Technischer Default | Finanzrestore verleiht keine Benutzerrechte; Nutzerexport enthält keine Credentials |
| ADR-023 | Offlinegeräte gelten als vertrauenswürdige lokale Geräte | Technischer Default aus Lokalbetrieb | Kein Fernwiderruf schon bekannter Daten; OS-Schutz statt behaupteter Appverschlüsselung |
| ADR-024 | Finanzlogik in TypeScript, begrenzte Rust-Speicherbrücke | Ziel durch ADR-042 ersetzt; Bestand bis K05 | Keine zweite produktive Budgetengine, kein uneingeschränktes SQL aus der UI |
| ADR-025 | E2EE ist Pflicht ab v1, ersetzt ADR-008 | Nutzerentscheidung: sonst kein Vertrauen | Finanzserver nur Chiffrate/öffentliche Metadaten; Fachvalidierung und Berechnungen auf Clients |
| ADR-026 | Bereichsschlüssel, signierte Rollen/Geräte und eigenständige Recovery | Technischer Default für ADR-025 | libsodium, Fingerprintprüfung, Schlüsselfreigabe, Rotation und separate Tresorentsperrung; Änderungen beim externen Identitätsanbieter entschlüsseln nichts |
| ADR-027 | Authentifizierte Clients sind vertrauenswürdig; keine Codesignatur als Sicherheitsbasis | Zusätzliche Nutzerentscheidung | Web/PWA/Desktop gleich zugelassen; keine Attestierung/Build-Allowlist; Nachrichten-/Schlüsselsignaturen schützen Datenintegrität, keine Appherkunft |
| ADR-028 | Repositorylokale Agenten-Skills und gemeinsame Vorlagen, GitHub/VS Code | Nutzerauftrag plus technischer Default | Vier Skills in .agents/skills; zentrale Docs statt Regelkopien; keine globale Plugininstallation, kein Push/CI/Appstart |
| ADR-029 | Kompakter Einstieg, P1-Teilaufgaben und portable Prüfungen; Hooks erst P1 | Nutzerauftrag D2 und bestätigter Ergänzungsplan | Zentrale Fachquellen erhalten, Beispiele synthetisch; optionaler pre-commit prüft vorgemerkte Inhalte ohne Dateiumschreiben; gemeinsame Prüfungen in CI; keine automatische Commit-/Push-/Taskabschlussfunktion |
| ADR-030 | Serveridentitäten ausschließlich extern; Apps lokal eigenständig | Nutzerentscheidung vom 2. Oktober 2026; ersetzt ADR-011 Authentifizierungsdefault | Keine lokale Benutzer-/Passwortverwaltung oder Setupkonten; Serververbindung setzt OIDC oder gleichwertigen externen Identitätsdienst voraus; Standalone-Apps benötigen keine Anmeldung |
| ADR-032 | Abgleich nur ohne Differenz, Budgeteintritt mit Geldfreigabe und gezielte Gegenbefehle | P4.4-Vertragsabgleich mit verbindlichem Fachmodell | Auswahl, Ausgangssaldo und CAS explizit; keine Snapshotrücksetzung |
| ADR-031 | Gemeinsame UI enthält den lokalen Client-Composition-Root | Ziel durch ADR-043 ersetzt; Bestand bis K02 | Vorhandene UI-Composition im Übergang; Ziel ist eigenständige Anwendung mit injizierten Ports |
| ADR-034 | Änderungen werden ausschließlich über Pull Requests integriert | Nutzerentscheidung vom 5. Oktober 2026 | Direkte Commits und Pushes auf `main` sind verboten; Themenbranch-Pushes dienen dem zugehörigen Pull Request |
| ADR-042 | Gemeinsamer Rust-Fachkern für Web und native Clients | Nutzerziel vom 8. Oktober 2026; ersetzt ADR-024 als Ziel | WASM und native Bindings; bestehende TypeScript-Engine bis geprüfter Umschaltung, keine Produktfreigabe |
| ADR-043 | UI-freie Anwendung und App-Composition | Nutzerziel vom 8. Oktober 2026; ersetzt ADR-031 als Ziel | Anwendungsabläufe außerhalb React, Plattform-/Speicherports injiziert |
| ADR-044 | Austauschbare SQL-Serveradapter | Nutzerziel vom 8. Oktober 2026; erweitert ADR-021 | SQLite/PostgreSQL/MySQL hinter gleichen Serverports; lokale Clients unverändert, E2EE verpflichtend |

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
- Status: als Ziel durch ADR-043 ersetzt; vorhandene Umsetzung bis geprüfter K02-Umstellung erhalten.
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

## ADR-034 — Pull-Request-Pflicht und geschützter Hauptbranch

- Datum: 5. Oktober 2026.
- Status: ersetzt durch ADR-038 am 7. Oktober 2026.
- Herkunft: ausdrücklicher Nutzerauftrag.
- Problem: Verbindliche Arbeitsanweisungen verlangten Zwischencommits, untersagten aber nicht eindeutig direkte Commits oder Pushes auf `main` und machten Pull Requests nur zur Empfehlung.
- Entscheidung: Sämtliche Repositoryänderungen werden ausschließlich über Pull Requests integriert. Direkte Commits und Pushes auf `main` sind verboten. Zwischencommits liegen auf einem Themenbranch; Pushes auf Themenbranches dienen ausschließlich dem Erstellen oder Aktualisieren des zugehörigen Pull Requests. Änderungen gelangen erst über dessen Merge nach `main`.
- Alternativen: Direkte Integration auf `main` wird ausgeschlossen.
- Folgen: AGENTS.md, Agentenleitfaden, Entwicklungsleitfaden, Copilot-Anweisungen, Workflow-Skill und PR-Vorlage enthalten dieselbe verbindliche Vorgabe. GitHub-Branchschutz muss direkte Pushes auf `main` verhindern; diese Dokumentationsänderung konfiguriert das Repository nicht.
- Betroffene Verträge/Pakete: [Agentenregeln](../AGENTS.md), [Agentenleitfaden](agent-guide.md), [Entwicklung](development.md), [Workflow-Skill](../.agents/skills/wimm-workflow/SKILL.md), Copilot-Anweisungen, GitHub-PR-Vorlage; D6.
- Migration und Kompatibilität: Keine Code-, Daten- oder Protokollmigration. Vorhandene Branches und Commits bleiben erhalten; neue Änderungen folgen ab sofort dem PR-Ablauf.
- Prüfung: Dokumentationskonsistenz, relative Links und Whitespace; tatsächliche Durchsetzung benötigt gesonderte Prüfung der GitHub-Repositoryeinstellungen.

## ADR-035 — Markante und ruhige Finanzoberfläche

- Datum: 5. Oktober 2026. Status: angenommen.
- Herkunft: Nutzerwahl „Klar und markant“, Desktop und Mobil; ausdrücklicher Implementierungsauftrag UX-01–UX-06.
- Problem: dauerhaft offene Formulare und gleichrangige Verwaltung verdrängen Finanzarbeit; Kontosumme suggeriert Budgetverfügbarkeit.
- Entscheidung: Grünakzent, warme Flächen und Systemschrift gemäß zusätzlichem Nutzerauftrag vom 5. Oktober 2026 für den [UX-Flow](assets/ux-flow-konzept.html), Listen zuerst, kontextbezogene Dialoge und eigene mobile Mehr-Ansicht gemäß [UX-Konzept](ux-redesign.md). Kontosumme heißt „Kontostand gesamt“ und führt die Übersicht. Die Budgetzahl des synthetischen Konzepts wird bis P6 nicht übernommen.
- Folgen: bestehende UI-Defaults werden gemeinsam aktualisiert. Native Bedienung, Fachkern und E2EE-Grenzen bleiben verbindlich.
- Migration und Tests: interne Ansichtsänderung ohne Datenmigration; atomarer Kontoeinstieg und vollständige UI-Regression. P6–P10 bleiben später.

## ADR-036 — Atomare lokale Profiländerungen

- Datum: 6. Oktober 2026. Status: angenommen.
- Herkunft: ausdrücklicher B01-Behebungsauftrag für Audit A01 (#24).
- Problem: veraltete Tabs überschreiben vollständige Profil-/Schlüsselbestände; Finanzbereichskoordination schützt das gemeinsame Profil nicht.
- Entscheidung: Der gemeinsame asynchrone ProfileStore liest und ändert unter einem profilweiten Web Lock. Profilrevision und Originalwert-CAS schützen den Commit. Haushaltsanlagen entschlüsseln den aktuellen bestätigten Tresor mit dem flüchtigen Sitzungsschlüssel, ergänzen Bereich und Schlüssel und speichern beide atomar. Bereichswechsel verwendet ebenfalls den aktuellen Stand. Ohne Web Locks gibt es keinen unkoordinierten Schreibfallback.
- Alternativen: vollständiges Zurückschreiben eines UI-Snapshots und manuelles Zusammenführen veralteter Schlüsselbestände werden wegen Verlust-/Konsistenzrisiken verworfen.
- Folgen: AppShell wartet auf dauerhafte Speicherung, zeigt Fehler und verhindert Doppelausführung sowie Fortsetzung einer gesperrten Sitzung. Der Port bleibt von Finanzspeicher und Servertransport getrennt.
- Betroffene Verträge: [Lokales Profil](data-model.md#lokales-profil-und-profilrevision), [Tresorerweiterung](encryption.md#atomare-lokale-profilerweiterung), [B01-Prüfungen](testing.md#b01--lokale-profilpersistenz).
- Migration und Kompatibilität: fehlende Altprofilrevision wird lesend als null initialisiert; erst erfolgreicher Commit schreibt die nächste Revision. Passphrase-/Recoveryhüllen und vorhandene Bereichsschlüssel bleiben unverändert. Die Koordination gilt für Clients mit diesem Port; alte parallel laufende Appversionen besitzen diesen Schutz nicht.
- Prüfung: Zwei-Tab-/Neustart-/Recovery-, Quota-, CAS-, Altprofil- und Sitzungsgenerationstests; A02 ergänzt im separaten PR vollständig geprüfte öffentliche Profil-/Hüllenfelder, authentifizierte Bereichs-/Schlüsselzugehörigkeit und die Ergebnisse missing/loaded/corrupt/unreadable. Ausschließlich missing erlaubt Erststart; Fehlerstände bleiben erhalten und werden auch vom Änderungsport abgewiesen.

## ADR-037 — Selbstbeschreibende Passphrasehüllen mit kompatibler Legacyhärtung

- Datum: 7. Oktober 2026. Status: angenommen.
- Herkunft: technischer Default zur Erfüllung des bestehenden Argon2id-Vertrags und des Gesamtbehebungsauftrags, Audit A10 (#31).
- Problem: historische Passphrasehüllen speichern keine Parameter und verwenden libsodium INTERACTIVE (zwei Durchläufe/64 MiB); globales Ändern würde Altprofile aussperren.
- Entscheidung: neue `PassphraseWrap`-Hüllen besitzen Version 2 und explizite `kdf.opslimit`/`kdf.memlimit` (initial 3/67.108.864 Byte). Unterstützte Parameter: ganze 3–6 Durchläufe und 64–256 MiB; Prüfung vor KDF. AAD ist das UTF-8-JSON-Array mit Domain `wimm/v1/passphrase-wrap`, Hüllenversion, Algorithmus, Durchläufen, Speicherbytes und Salt. Die Suite-/Signatur-/Transportverträge ändern sich nicht; XChaCha20-Poly1305 bleibt das AEAD.
- Alternativen: blindes Erhöhen globaler INTERACTIVE-Konstanten verworfen; kein KDF-Downgradefallback bei fehlgeschlagener Authentifizierung.
- Folgen: Hüllenparameter sind authentifiziert, Aufwand ist explizit begrenzt. Neue Clients lesen Legacy und Version 2; alte Clients können die neue Passphrasehülle nicht öffnen.
- Betroffene Verträge/Pakete: [Verschlüsselung](encryption.md), lokaler Profilport, `packages/crypto`, Audit B05.
- Migration und Kompatibilität: fehlende Hüllenversion **und** fehlende Parameter bedeuten exakt Legacy 2/64 MiB mit bisheriger AAD. Nach erfolgreicher Passphraseentsperrung und semantischer Profilprüfung wird nur die Passphrasehülle unter Profilkoordination/CAS ersetzt. Tresorchiffrat, Tresorschlüssel, Bereiche und Recoveryhülle bleiben unverändert. Recoveryentsperrung schreibt nichts; die Härtung erfolgt beim nächsten Passphraseentsperren. Fehler/Abbruch/CAS bewahren das Originalprofil.
- Prüfung: Legacy und neue Hüllen über beide Wege, authentifizierte Header, Parameterabweisung vor KDF, Originalstand bei Migrationsfehler/Abbruch und Profil-CAS; echte Web-/Desktopfrontendabläufe.

## ADR-038 — Direkte Hauptbrancharbeit nach erneuter Nutzerfreigabe

- Datum: 7. Oktober 2026. Status: angenommen.
- Herkunft: ausdrücklicher Nutzerauftrag, direkte Arbeit auf `main` wieder zu erlauben und alle GitHub-Issues systematisch zu beheben.
- Problem: ADR-034 und abgeleitete Kurzregeln widersprechen der aktuellen Nutzerfreigabe.
- Entscheidung: direkte Hauptbrancharbeit einschließlich eigener Zwischencommits und normaler Pushes ist wieder erlaubt. Themenbranches/PRs bleiben bei entsprechendem Auftrag möglich. Aktuelle Gitregeln stehen in AGENTS.md; Freigaben/Paketstatus ausschließlich in docs/tasks.md und im Nutzerauftrag.
- Folgen: keine ungefragte Änderung von GitHub-Schutzregeln, kein Force-Push, kein Überschreiben fremder Änderungen; zielgerichtete Prüfungen und wahrheitsgemäße Abnahme bleiben verbindlich.
- Betroffene Verträge/Pakete: Agenten-/Entwicklungsleitfäden, Workflow-Skill, Copilot- und PR-Vorlage; Audit Q06.
- Migration und Kompatibilität: keine Produkt-/Datenmigration. ADR-034 bleibt als ersetzte Historie erhalten.
- Prüfung: Dokumentationsvalidator, Links und konsistente zentrale Freigabeverweise.

## ADR-039 — Lokale Finanzrevision schützt neue Kontoaggregate

- Datum: 7. Oktober 2026. Status: angenommen.
- Herkunft: weiterer reproduzierter Parallelfall innerhalb Audit A03 und bestehender Summeninvariante.
- Problem: zwei neue Konten mit Anfangsbeständen ändern keine bisherige Kontorevision. Auch bei Konto-CAS können beide vorbereiteten Writes dieselbe sichere Gesamtsumme lesen und zusammen einen unsicheren Bestand erzeugen; ohne bisherige Konten existiert noch kein Kontoanker.
- Entscheidung: jede lokale Geldmutation schreibt atomar eine `financialRevision` des Bereichs mit erwarteter Revision. Deren lokale Aggregat-ID ist die reservierte Bereichs-ID; sie enthält ausschließlich Metadaten, keine Geldwerte. Neuanlage der Revision mit Erwartung null schließt auch parallele erste Konten ein. Zusätzlich bleiben Kontoanker und Folgebestandsprüfung bestehen.
- Folgen: genau ein veralteter konkurrierender Gesamtbestandswrite kann committen; andere erhalten einen Revisionskonflikt und behalten ihren Entwurf. Die Revision ist kein sichtbares Konto und kein Gegenbefehlsziel.
- Betroffene Verträge/Pakete: [Fachmodell](domain.md), [lokaler Fachport](api.md#lokaler-finanzbestandsport), [lokales Datenmodell](data-model.md), P2/P3/P4 und Audit B02.
- Migration und Kompatibilität: vorhandene Bereiche erhalten die lokale Revision erst beim ersten erfolgreichen Finanzcommit; vorhandene Finanz-/Schlüsselaggregate werden nicht umgeschrieben. Die Revision bleibt lokal und darf bei späterem P9 nicht als gemeinsames Finanzaggregat oder globale Sync-CAS-Revision übertragen werden. Empfangene Finanzänderungen müssen weiterhin vor dem lokalen Commit als kombinierter Bestand geprüft werden. Alte parallel laufende Appversionen besitzen diesen Schutz nicht.
- Prüfung: parallele Grenzwrites auf bestehenden Konten, neue Konten mit Anfangsbestand und zwei gleichzeitige erste Konten; genau ein vollständiger Erfolg, keine Teilwrites. Undo/Redo, Speicherfehler und echte Adapterintegration bleiben Pflicht.

## ADR-040 — Dauerhafte lokale Epoche ohne Synczustand

- Datum: 8. Oktober 2026. Status: angenommen.
- Herkunft: Nutzerauftrag zur Issuebehebung; reproduzierter Standalone-Exportfehler #78.
- Problem: lokale Bereiche besitzen keine bestätigten Serverdaten und keinen Cursor. Der Snapshotexport konnte deshalb trotz `initialEpoch` keine Epoche liefern.
- Entscheidung: `LocalStorageAdapter.initializeArea(spaceId, proposedEpoch)` speichert atomar eine profil- und bereichsgebundene lokale Epoche und gibt die bereits bestehende oder erstmals gewählte Epoche zurück. Bestehende Sync-/Bestätigungsepochen haben beim kompatiblen Erstaufbau Vorrang. Lokale Metadaten und Synczustand bleiben logisch getrennt; eine lokale Initialisierung erzeugt keine Syncseite oder Outbox. Der Bereichsstart und LocalAreaService rufen die idempotente Initialisierung auf. Snapshotersatz übernimmt die Snapshotepoche atomar mit dem übrigen Bestand.
- Alternativen: eine künstliche Syncseite würde Standalonezustand und Transportcursor vermischen; ein nur flüchtiger Exportfallback würde nach Neustarts wechselnde Epochen liefern.
- Folgen: auch leere lokale Bereiche erhalten einen stabilen Snapshotkontext. Export bleibt ausschließlich über SnapshotProtector verfügbar; vor erfolgreicher Entschlüsselung wird beim Restore nichts geschrieben.
- Betroffene Verträge/Pakete: [Speicherports](architecture.md#speicherports), [lokales Datenmodell](data-model.md), P3 und #78–#80.
- Migration und Kompatibilität: zusätzliche Metadatenfelder in vorhandenen Stores, keine Änderung der Finanzaggregate oder Snapshotversion. Bestehende Bereiche werden beim nächsten Öffnen/Export idempotent ergänzt; vorhandene Schlüssel, Bestätigungsdaten und Cursor bleiben erhalten.
- Prüfung: leerer/befüllter Standalone-Export, Neustart, gleichzeitige Initialisierung, historische Bereiche mit vorhandener Epoche und verschlüsselter Roundtrip mit falschem Schlüssel ohne Write auf IndexedDB und SQLite.

## ADR-041 — Gemeinsame Snapshotprüfung vor destruktivem Ersatz

- Datum: 8. Oktober 2026. Status: angenommen.
- Herkunft: Nutzerauftrag zur Behebung von #80 und bestehende Fach-/Bereichsinvarianten.
- Problem: authentische Verschlüsselung beweist keine gültige Snapshotversion, Bereichszuordnung oder Finanzstruktur. Der bisherige Ersatz konnte unbekannte Versionen und fremde Bereichsdaten speichern.
- Entscheidung: gemeinsame strikte Zod-Formverträge in contracts prüfen alle vorhandenen P2/P5-Aggregattypen und Snapshotmetadaten. Der Fachkern prüft vollständige Bestände, Referenzen, Transferpaare, Abgleichzuordnungen, Automatisierungsstrukturen und sichere Projektionen. Alle lokalen Adapter validieren und kopieren den Snapshot vor dem ersten destruktiven Write. Profil-/Bereichs-/Epochenbindung, eindeutige Handles und vorhandene fremde Handlebelegungen werden abgewiesen; keine automatische Inhaltsreparatur.
- Folgen: unbekannte Storage-/Fachversionen und unbekannte Cachearten erhalten den Originalbestand. V1 unterstützt die vorhandene numerische Cacheart `balance`, `accountBalance` mit Centsaldo und `consumption` für `all` oder einen Monat. Finanzcaches müssen dem vollständig validierten Fachbestand entsprechen. Neue Cachearten benötigen einen passenden Vertrag.
- Betroffene Verträge/Pakete: [Datenmodell](data-model.md), [Speicherports](architecture.md#speicherports), P2/P3/P5, #80 und die gemeinsame Referenzabnahme #86. Fachberechnung bleibt clientseitig; Rust wiederholt nur öffentliche lokale Metadaten-/Besitzgrenzen und SQLite-Atomizität.
- Migration und Kompatibilität: bestehende vollständige V1-Finanzdaten und die numerische Legacycacheart bleiben lesbar. Historische Referenzen auf enthaltene Tombstoneziele bleiben in wiederhergestellten vollständigen Beständen erhalten; neue Fachreferenzen unterliegen weiterhin #76. Entwürfe sind getrennte Originaldaten und werden nicht automatisch angewandt. Beschädigte oder noch nicht unterstützte Bestände benötigen eine gesonderte bestätigte Korrektur, keine stille Ersetzung.
- Prüfung: F01–F03, verschlüsselte Negativroundtrips für Versionen/Metadaten/Handles/Caches, unveränderter Gesamtbestand nach Ablehnung, native Bereichsgrenzen und gemeinsame dauerhafte Adapterprüfung in #85. Der aktuelle Abschnitt ist Implementierung mit Teilbelegen, keine abgeschlossene Gesamtadapterabnahme.

## ADR-042 — Gemeinsamer Rust-Fachkern für Web und native Clients

- Datum: 8. Oktober 2026.
- Status: angenommen; Produktimplementierung K01–K11 durch anschließenden Nutzerauftrag zu #91 am 8. Oktober 2026 freigegeben.
- Herkunft: ausdrückliche Nutzerwahl „Rust als Ziel festlegen“ und bestätigter Konzept-/Issueauftrag.
- Problem: Der TypeScript-Kern ist React-frei, benötigt für vollständig native Swift-/Kotlin-Oberflächen aber eine zusätzliche JavaScript-Laufzeit. Eine zweite Finanzimplementierung gefährdet konsistente Regeln.
- Entscheidung: Ein eigenständiger Rust-Fachkern liefert gemeinsame Befehlsprüfung und Projektionen. Web nutzt WASM, Tauri direkte Rust-Aufrufe und spätere native Clients etablierte Swift-/Kotlin-Bindings. ADR-024 wird als Ziel ersetzt; TypeScript bleibt bis zur geprüften K05-Umschaltung Bestand und Vergleichsreferenz. ADR-014 wird hinsichtlich der Fachkernsprache entsprechend präzisiert.
- Alternativen: Dauerhafte TypeScript-/JavaScript-Laufzeit in jedem nativen Client und getrennte Engines pro Sprache werden zugunsten eines gemeinsamen Kerns verworfen.
- Folgen: Binding-/WASM-/Vergleichstests werden erforderlich. Pure Fachlogik bleibt frei von UI, Datenbank, HTTP und Tauri; der Server importiert sie nicht. Native Produktoberflächen bleiben ein späterer eigener Auftrag, ADR-004 gilt für die vorhandene UI fort.
- Betroffene Verträge/Pakete: [Portabilitätskonzept](core-and-sql-portability.md), [Fachmodell](domain.md), [Datenmodell](data-model.md), [Architektur](architecture.md), K01/K03–K05/K11 und vorhandene Clientpakete.
- Migration und Kompatibilität: bisherige sichere Centgrenzen, Kalender-/Rundungsregeln und Daten-/Cryptoformate erhalten; erst nach Ergebnisvergleich und Clientintegration produktive TypeScript-Engine entfernen. Keine Freigabe zusätzlicher P6–P11-Funktionen.
- Prüfung: vorhandene Fach-/Grenzfälle nativ und WASM, deterministischer TypeScript-Vergleich, tatsächlich kompilierte/ausgeführte Swift-/Kotlin-Testharnesses, Web-/Tauri-/Offline-Regressionsabnahme.

## ADR-043 — UI-freie Anwendung und App-Composition

- Datum: 8. Oktober 2026.
- Status: angenommen; Produktimplementierung K01–K11 durch anschließenden Nutzerauftrag zu #91 am 8. Oktober 2026 freigegeben.
- Herkunft: bestätigter Nutzerauftrag für Konzept und Issues zur austauschbaren Oberfläche.
- Problem: FinanceModel, Profilabläufe, Historie und Speicherung/Importkoordination liegen im UI-Paket oder in React-Callbacks. Ihre Wiederverwendung benötigt dadurch UI-/Browserabhängigkeiten.
- Entscheidung: Anwendungsschicht als eigenes Paket, zunächst TypeScript, außerhalb React bereitstellen. Apps komponieren Fachkern, Anwendung und injizierte Speicher-/Profil-/Plattformports. ADR-031 wird als Ziel ersetzt; bestehende Komposition bleibt bis K02-Abnahme erhalten. Native Clients erfüllen dieselben dokumentierten Ablaufverträge.
- Alternativen: Zusammensetzen der Clients weiterhin im UI-Paket und Kopieren von Anwendungsabläufen in jede Oberfläche werden verworfen.
- Folgen: Browser-Worker, lokale Profilpersistenz/Koordination, Uhr und IDs werden Adapter beziehungsweise injizierte Dienste. Darstellung, Navigation, Fokus und Formulare bleiben in der UI. TypeScript-Anwendung wird nicht automatisch zu einer Swift-/Kotlin-Bibliothek.
- Betroffene Verträge/Pakete: [Portabilitätskonzept](core-and-sql-portability.md), [Architektur](architecture.md), [Aufgaben](tasks.md#k--rust-fachkern-und-sql-portabilität), K01/K02/K05/K11 sowie ui und App-Einstiegspunkte.
- Migration und Kompatibilität: bestehende Profile, atomare Speicherung, Schreib-/Wechselsperren, Entwürfe und Konfliktzustände bewahren; keine Speicherformatmigration allein durch Paketverschiebung.
- Prüfung: Anwendung ohne React/DOM/Browserglobals, Paketgraph, Fehler-/Konflikt-/Historien-/Abbruchfälle sowie bestehende Web-/Desktopfrontendabläufe.

## ADR-044 — Austauschbare SQL-Serveradapter

- Datum: 8. Oktober 2026.
- Status: angenommen; Produktimplementierung K01–K11 durch anschließenden Nutzerauftrag zu #91 am 8. Oktober 2026 freigegeben.
- Herkunft: Nutzerpräzisierung zu beliebigen SQL-Datenbanken und Auswahl „Server, Client bleibt lokal“.
- Problem: Der bisherige Serverdefault schreibt SQLite vor. SQL-Wechsel dürfen weder Fach-/Transportregeln noch E2EE-Vertrauensgrenzen ändern.
- Entscheidung: Gemeinsamer CiphertextStore und separater öffentlicher Verwaltungsport mit gemeinsamer Transaktion; SQLite als Standard/Referenz, PostgreSQL und MySQL/InnoDB als zusätzliche Serveradapter. Weitere SQL-Systeme benötigen Adapter und bestandene Konformitätssuite. ADR-021 wird hinsichtlich der SQLite-Beschränkung erweitert; Cluster-/Mehrinstanzbetrieb bleibt außerhalb dieses Ziels.
- Alternativen: Datenbankspezifische Regeln in API/Fachkern, direkte SQL-Zugriffe aus Oberflächen und automatische Zusage für alle SQL-Systeme werden verworfen.
- Folgen: CAS, Operations-ID-Idempotenz, Rollback und konsistente Snapshot-/Cursorregeln sind gemeinsame Garantien. Dialekte, Isolation, Sperren, Indizes und Migrationen liegen in Adaptern. Desktop bleibt SQLite, PWA IndexedDB; Server erhält niemals Finanzklartexte/private Schlüssel.
- Betroffene Verträge/Pakete: [Portabilitätskonzept](core-and-sql-portability.md), [Architektur](architecture.md), [P8](p8-server.md), [API](api.md), [E2EE](encryption.md), [Sync](synchronization.md), [Betrieb](operations.md), K01/K06–K11. P8-/P9-Produktfreigaben bleiben gesondert erforderlich.
- Migration und Kompatibilität: angehaltene Writes, gesicherter versionierter Betreiberexport, leeres Ziel, byte-/wertgetreue Hüllen/IDs/Revisionen/Receipts/Epochen/Cursor, Integritätsprüfung vor Umschaltung und geprüfter Restore. Keine automatische Crypto-/Protokolländerung.
- Prüfung: gemeinsame Suite gegen echte SQLite/PostgreSQL/MySQL, parallele Verbindungen, CAS-/Idempotenz-/Rollback-/Snapshot-/Neustartfälle und alle sechs gerichteten Datenbankwechsel.

## ADR-045 — Fachprojektionsneuaufbau mit vollständigem Bestandsvergleich

- Datum: 8. Oktober 2026. Status: angenommen.
- Herkunft: bestehender P3-Auftrag und Behebung von #81.
- Problem: Der bisherige Neuaufbau löscht nur Caches. Eine clientseitige SQLite-Berechnung außerhalb der Committransaktion könnte veraltete Werte zurückschreiben.
- Entscheidung: Die Speicherformatierung verwendet ausschließlich `validateFinancialState`, `rebuildFinancialProjections` und `projectConsumption` des vorhandenen Fachkerns. Kanonische Caches sind `accountBalance` für alle Konten einschließlich null und `consumption` für `all` sowie gespeicherte Buchungsmonate. Bekannte numerische Legacyadressen `balance` und bereits angeforderte gültige Monatsadressen bleiben mit neu berechneten Werten erhalten. Nicht mehr ableitbare Cacheadressen werden beim ausdrücklichen Neuaufbau entfernt.
- Folgen: IndexedDB berechnet und ersetzt innerhalb einer Schreibtransaktion, Memory innerhalb der Schreibwarteschlange. Der Desktopadapter nutzt den atomaren Exportlesestand; Rust vergleicht in einer unmittelbaren SQLite-Schreibtransaktion sämtliche Ausgangsaggregate einschließlich Handles, Feldern und Revisionen und ersetzt dann nur Projektionen. Neue Handles, geänderte Revisionen und Änderungen bei gleicher Revision verhindern veraltete Cachewrites. Keine zweite Finanzengine in Rust.
- Betroffene Verträge: Speicherports, `ProjectionRebuild`, P3.1/P3.6 und #81/#85. Originalentwürfe, bestätigte Syncdaten, Cursor, Epochen und Finanzaggregate bleiben erhalten; beschädigter Fachbestand wird vor Cachelöschung abgewiesen.
- Migration und Kompatibilität: keine Schema- oder Finanzformatmigration. Das bestehende begrenzte Rust-Neuaufbaukommando erhält Ausgangsaggregate und berechnete Projektionen statt einer bloßen Bereichs-ID; alte inkompatible Aufrufe scheitern vor Mutation. Clients öffnen ihre Bereiche vor dem Neuaufbau gemäß ADR-040. Der spätere Rust-Fachkern bleibt K-Produktarbeit ohne zusätzliche Freigabe.
- Prüfung: gemeinsamer echter SQLite-/IndexedDB-Katalog mit expliziten Centwerten, leeren Caches/Konten, Legacy- und Monatsadressen, Tombstones/Opening/Transfer/Erstattung, Überlauf, Konkurrenz, Profil-/Bereichstrennung, dauerhaftem Neustart und Fehler nach der ersten geschriebenen Cachezeile. Zusätzlich native CAS-Grenzfälle für neue Handles und Änderungen ohne Revisionswechsel. Disk-full/Quota-Fehler werden hier gezielt injiziert; dies ersetzt keine tatsächliche Ressourcenabnahme.

## ADR-046 — Versionierte sprachneutrale Fachengine- und Anwendungsverträge

- Datum: 8. Oktober 2026. Status: angenommen; K01 im ausdrücklich freigegebenen #91-Auftrag.
- Problem: TypeScript-Fachtypen und UI-nahe Ablaufports reichen als sprachübergreifende Rust-/WASM-/Native-Grenze nicht aus. Finanzresultat, dauerhafter Commit und unklarer Commitausgang müssen getrennt bleiben.
- Entscheidung: `packages/contracts` enthält strikte versionierte normale JSON-Requests/Results für vorhandene Fachbefehle, Gegenbefehle, Projektionen, historische/Mutationvalidierung und reine Geld-/Regel-/Dauerzahlungs-/Importberechnung. Fachaggregate enthalten keine zusätzlichen Speicherhandles. IDs, Uhr und erzeugte UUID-Vorräte werden explizit übergeben; Binding-, Fach-, Storage-, Crypto-/Exportversion und Epoche bleiben unabhängig.
- Folgen: Ein logischer FinanceEnginePort gilt für alle Bindings; keine Browser-/React-/SQL-/Tauri-/HTTP-Typen im Port. Generische Profil-, Finanzspeicher- und Snapshotports werden auch von den vorhandenen Produktports verwendet. Die TypeScript-Fachengine bleibt bis K05 unverändert aktiv; K03/K04 implementieren und vergleichen den Kern.
- Weitere Grenzen: Anwendung koordiniert Profil/Sitzung, Entwürfe, Abbruch und atomaren dauerhaften Commit; spätes Lesen darf einen bestätigten Write nicht wiederholen. Serverpersistenz bietet öffentliche Verwaltung und Chiffrate in derselben Transaktion und unterscheidet sicher erfolgten, sicher nicht erfolgten und unklaren Commit. Keine Entschlüsselung/Finanzprüfung im Server. Nummerierte Vorwärtsmigration und dauerhaft bestätigter verschlüsselter Backupbeleg sind getrennte Ports; die konkrete Umsetzung bleibt #82.
- Betroffene Verträge: [K01-Spezifikation](core-contracts.md), contracts, bestehende Profil-/Speicher-/Snapshotporttypen und zentrale Fachbefehls-/Fehlerlisten, K02–K11.
- Migration und Kompatibilität: zusätzliche Engine-Bindingversion 1, keine Änderung vorhandener Finanz-, Speicher-, Transport- oder Cryptodaten. Optionales bleibt abwesend statt null, sichere Centgrenzen bleiben erhalten. Keine neue P6–P11-Funktion.
- Prüfung: Schema-/Grenz-/Negativ-/JSON-Roundtriptests, vorhandene Fach-/Profil-/Speichertests, Typecheck/Paketgraph und Dokumentation. Tatsächliche Rust-/WASM-/Swift-/Kotlin-Ausführung, SQL-Adapter und Produktumschaltung folgen in ihren eigenen Issues.

## ADR-047 — Clientanwendung mit gemeinsamer Aktivitätssperre und konkreten Browseradaptern

- Datum: 8. Oktober 2026. Status: angenommen; Umsetzung K02/#93 im freigegebenen #91-Auftrag.
- Problem: React-Callbacks besaßen persistente Clientabläufe und Browserabhängigkeiten; Profil- und Finanzaktionen müssen dieselbe Sitzungssperre beachten.
- Entscheidung: packages/application besitzt beobachtbare Finanz-/Profilcontroller, Historie, Konfliktlesen und Generationsschutz. Eine gemeinsam injizierte ApplicationActivity sperrt Profil- und Finanzwrites gegenseitig. Web-/Desktop-Einstiege komponieren konkrete Speicher- und Browseradapter; packages/ui rendert den Zustand und ruft Aktionen auf.
- Folgen: Uhr/IDs, Locks/localStorage und begrenzte Worker liegen in packages/browser-adapters. Ein bestätigter Finanzcommit wird direkt übernommen; späte abgebrochene oder sitzungsfremde Ergebnisse werden verworfen. Profil-/Tresorformate und etablierte Kryptografie bleiben unverändert.
- Betroffene Verträge: K01-Anwendungsports, ADR-043 und bisherige ADR-031-Composition, application, browser-adapters, UI und App-Einstiege.
- Migration und Kompatibilität: keine Datenmigration; TypeScript-Fachengine bis K05 aktiv. Alte UI-Importstellen delegieren über Kompatibilitätsbarrels.
- Prüfung: [K02-Kriterienmatrix und aktuelle Browser-/Node-/Offlinebelege](handoffs/k02-2026-10-08.md); native GUI-/Geräte-/Screenreaderabnahme bleibt separat.

## ADR-048 — Explizite gesicherte lokale Indexmigration

- Datum: 9. Oktober 2026. Status: angenommen als technischer Default im freigegebenen #82-/#83-Auftrag.
- Problem: Die Pflichtindizes benötigen ein neues physisches IndexedDB-Schema und zusätzliche SQLite-Indizes/Referenzzeilen. Ein automatischer Upgrade beim Öffnen könnte die zugesagte Originalprüfung und Sicherung umgehen.
- Entscheidung: Registrierter Schritt 1 führt Storage 1/Fachversion 1 nach Storage 2/Fachversion 1. Fachpayloads, Entwürfe, Bestätigungen und Epochen bleiben identisch. Der Schritt erzeugt nur abgeleitete Indizes, ergänzt deren Metadaten und schreibt einen dauerhaften Journalbeleg. Trotzdem wird bereits für diesen additiven Schritt ein verschlüsselter Originalsnapshot mit bestätigtem Backupbeleg verlangt.
- Folgen: Öffnen unterstützt bekannte V1-/V2-Bestände ohne automatische Migration. Dexie wechselt physisch erst nach Sicherungsprüfung von Version 10 nach 20. Im Upgrade bzw. in SQLite BEGIN IMMEDIATE werden vollständiger aktueller Snapshot und Journalnummer erneut verglichen; DDL, Referenzaufbau, Versionsfortschritt und Journal bilden eine Transaktion. Andere Profile behalten ihre Finanzdaten; deren abgeleitete Indizes werden aus dem aktuellen Transaktionsstand aufgebaut. Die Sicherung bleibt an das ausgewählte Profil und den ausgewählten Bereich gebunden.
- Weitere Grenzen: Hash, Verschlüsselung und Rücklesen/Authentifizieren der Sicherung finden außerhalb der IndexedDB-Finanztransaktion statt. Rust hasht die übergebenen JSON-Bytes mit bestehendem SHA-256 und prüft, dass ihr Inhalt exakt dem tatsächlichen Ausgangssnapshot entspricht. Der native Schreibjob läuft außerhalb des UI-Threads und beobachtet Abbruch vor dem Commit. Nach einem bestätigten Commit ist ein verspäteter Abbruch kein fehlgeschlagener Write. Kein freies SQL, kein Pfad aus JavaScript und keine Client-Migrationscallbacks im nativen Port.
- Betroffene Verträge: [Datenmodell](data-model.md#schemaentwicklung), [Speicherports](architecture.md#speicherports), [K01](core-contracts.md), #82/#83, storage, application und native Tauri-Brücke.
- Migration und Kompatibilität: V1 bleibt lesbar, unbekannte Versionen werden abgewiesen. V1-/V2-Snapshots enthalten dasselbe Fachschema; neues createdAt ist optional für lokale Outboxeinträge, Altentwürfe werden unverändert bewahrt. Nur registrierte Schritte dürfen Versionen und Journal fortschreiben. Produktive Startkoordination folgt mit K05, kein automatischer ungesicherter Upgrade.
- Prüfung: Gemeinsamer tatsächlicher IndexedDB-/SQLite-Katalog, native Rust-Assertions, Abbruch nach Index-/Journalschreiben, vollständige Prozessneustarts, Profiltrennung, Originalentwürfe und 50.000-Buchungen-Indexbasis. [Datierter Abnahmesnapshot](handoffs/storage-index-migration-2026-10-09.md).

## ADR-049 — Gemeinsamer Rust-DAL mit ORM als Architekturvorschlag

- Datum: 9. Oktober 2026.
- Status: vorgeschlagen; keine Implementierungsfreigabe und kein Ersatz angenommener Bestandsentscheidungen.
- Herkunft: ausdrücklicher Nutzerauftrag für Konzept und GitHub-Issues, bevorzugter gemeinsamer Browserpfad und ORM-/Migrations-DSL mit gekapselten technischen SQL-Ausnahmen.
- Problem: Desktop verwendet direkte rusqlite-Statements, die PWA Dexie/IndexedDB. Ein gemeinsamer Rust-Fachkern vereinheitlicht diese Persistenzpfade nicht. Gewünscht sind typisierte Datenzugriffe ähnlich Entity Framework auch im Browser und auf dem Server.
- Entscheidung: Vorgeschlagen wird eine eigenständige Rust-Persistenzbasis mit Diesel als bevorzugtem ORM-Kandidaten, SQLite nativ und im Browser sowie PostgreSQL/MySQL auf dem Server. Schemaänderungen sollen eine etablierte Rust-DSL verwenden, vorzugsweise SeaQuery; konkrete Eignung und stabile Versionen sind vor Produktumstellung nachzuweisen. Lokale Finanz- und serverseitige Chiffratverträge bleiben getrennt. Fachkern und öffentliche Ports bleiben frei von ORM-/Treiberabhängigkeiten.
- Alternativen: SeaORM für entitätennahe Modellierung und Rust-Migrationen, aber ohne hier nachgewiesenen WiMM-Browserpfad; IndexedDB als eigener Adapter hinter gemeinsamen Rust-Verträgen, aber ohne dieselbe SQL-/ORM-Basis im Browser. Keine automatische Ersatzwahl nach fehlgeschlagenem Nachweis.
- Folgen: Native SQLite-/WASM-/Fastify-Bindings und Rust-Migrationsausführung benötigen eigene Machbarkeits- und Konformitätsbelege. SQL-Ausnahmen ausschließlich adapterintern begründen und prüfen. Keine eigene DbContext-/LINQ-Implementierung oder implizite Speicherung von Objektgraphen. Eigener Rust-Code und eigene Bindings behalten die bestehenden unsafe-Verbote.
- Betroffene Verträge/Pakete: [DAL-Konzept](rust-dal.md), [Auftrag und Freigabe](tasks.md#dal--gemeinsamer-rust-dal-konzept-und-issuetracking), [Architektur](architecture.md), [bisheriges K-Konzept](core-and-sql-portability.md), K01-Ports, DAL01–DAL07 und verlinkte K-/P3-Issues. Bestehende Freigaben/Kriterien bleiben erhalten.
- Migration und Kompatibilität: heutige PWA bleibt IndexedDB. Eine spätere Umstellung benötigt konsistenten Ausgangsstand, bestätigte verschlüsselte Sicherung, separates SQLite-Ziel, vollständigen Vergleich und absturzsichere Aktivierung ohne Dual-Write oder Rückfall auf veraltete Daten. Fach-/Cryptoformate und IDs/Revisionen/Entwürfe/Epochen/Cursor erhalten; kein automatischer ORM-Schemaupgrade beim Öffnen.
- Prüfung: jetzt nur Dokumentation, Freigabegrenzen und rückgelesenes Issuetracking. Selbst DAL01-Prototypen sind nicht beauftragt. Nach gesonderter Implementierungsfreigabe native Rust-/WASM-/Bindingnachweise, echte DB-Konformität, Browser-/Offline-/Migrations-/Parallelitätsfälle und vorhandene Leistungsgrenzen; fehlende Plattformen bleiben offen.
