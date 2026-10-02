# P1 — Teilaufgaben der Projektgrundlage

## Auftrag und Reihenfolge

Diese Teilaufgaben konkretisieren [P1](tasks.md#p1--projektgrundlage). P1.1 bis P1.6 werden in Reihenfolge bearbeitet. P1 ist erst mit der Abnahme des Gesamtpakets erledigt; P2 beginnt danach. Nach Umsetzung Status und Prüfbelege hier sowie den Gesamtstatus in tasks.md pflegen.

## P1.1 — Versions- und Lizenzprüfung

- Status: erledigt (2. Oktober 2026).
- Freigabe: Nutzerauftrag vom 2. Oktober 2026 für den Beginn der Umsetzung.
- Voraussetzungen: D0/D1 erledigt; [Architektur](architecture.md) und [Entscheidungen](decisions.md) gelesen.
- Schritte: unterstützte Node-LTS-/pnpm-/Rust-/Tauri-Versionen und stabile kompatible Bibliotheken aus offiziellen Quellen ermitteln; libsodium-Binding, RFC-8785-Bibliothek und Node-SQLite-Binding berücksichtigen; Lizenzen und Plattformvoraussetzungen prüfen.
- Ergebnis: datierte Versions-/Lizenzübersicht und Herkunftsregistergrundlage, ohne neue Produktentscheidungen.
- Verträge: Architektur, E2EE und AGPL-3.0-or-later; Fremdhinweise erhalten.
- Abnahme: jede Auswahl nennt Version, offizielle Quelle, Lizenz und Kompatibilitätsgrund; verfügbare und noch ungeprüfte Zielsysteme sind getrennt ausgewiesen.
- Prüfungen: Quellen-/Lizenzprüfung und Abgleich der Engine-/SDK-Anforderungen; tatsächliche Builds folgen ab P1.2.
- Prüfbelege: [Versions- und Lizenzbasis](technology-baseline.md) erstellt. Offizielle Release-/Registryquellen, Lizenzen und Engine-/SDK-Anforderungen für Node 24.21.0, pnpm 12.8.1, Rust 1.98.1, Tauri 2.12.1 und die Architekturabhängigkeiten geprüft. macOS arm64 mit Xcode, Node 24.21.0 und pnpm 12.8.1 festgestellt; Rust und alle Zielsystembuilds nicht verfügbar beziehungsweise nicht ausgeführt. Kein Lockfile oder Produktcode angelegt.

## P1.2 — Workspace und Paketgraph

- Status: erledigt (2. Oktober 2026).
- Freigabe: Nutzerauftrag vom 2. Oktober 2026, ergänzt um OrbStack-/VS-Code-Integration.
- Voraussetzungen: P1.1 erledigt.
- Schritte: pnpm-Workspace mit den Architekturpaketen und Appverzeichnissen anlegen; Versionen/Lockfile sperren, TypeScript strict/ESM und AGPL-Metadaten konfigurieren; erlaubte Importgrenzen automatisch prüfbar machen.
- Ergebnis: installierbare Paketstruktur mit minimalen Modulen; noch keine Finanzfunktionen.
- Verträge: Paketgraph der Architektur; domain bleibt plattformfrei, contracts importiert nicht domain, Server erhält keine Finanzfachlogik.
- Abnahme: Installation mit unverändertem Lockfile und Typprüfung funktionieren; Grenze zwischen öffentlichen Serververträgen und clientseitigen Fachverträgen ist explizit.
- Prüfungen: frischer Checkout, Typprüfung und Paketgraphprüfung; absichtlich verbotenen Import in temporärem Prüfstand als negativen Kontrollfall erkennen und anschließend entfernen.
- Prüfbelege: pnpm-Workspace mit zehn Architekturpaketen/-apps, striktem TypeScript/ESM und AGPL-Metadaten angelegt. `pnpm-lock.yaml` mit pnpm 12.8.1 erstellt und unverändert im OrbStack-Dev-Container installiert. Dort Node 24.21.0, pnpm 12.8.1, Rust/Cargo 1.98.1, `pnpm typecheck` und `pnpm check:package-graph` erfolgreich. Temporärer verbotener Import `@wimm/contracts` → `@wimm/domain` wurde erwartungsgemäß abgewiesen und danach entfernt. Docker-Kontext auf OrbStack gesetzt. Die installierte VS-Code-Dev-Containers-Erweiterung 0.469.0 hat die Konfiguration gelesen sowie den Container mit `outcome: success` und erfolgreichem `postCreateCommand` gestartet. Keine App, Finanzfunktion, Server-API oder Tauri-App gestartet.

## P1.3 — Gemeinsame Verträge und Ports

- Status: erledigt (2. Oktober 2026).
- Freigabe: Nutzerauftrag vom 2. Oktober 2026 für P1.3.
- Voraussetzungen: P1.2 erledigt.
- Schritte: gemeinsame Primitive, Versionen und Fehlergrundlage in contracts anlegen; öffentliche EncryptedOperation-/KeyRoster-Hüllen von Finanzschemas trennen; PlatformServices und zukünftige Storage-Ports anhand der bestehenden Spezifikation typisieren.
- Ergebnis: validierbare Vertragsgrundlage und Ports ohne vorgetäuschte Speicher-/Syncimplementierung.
- Verträge: [Datenmodell](data-model.md), [API](api.md), Architektur und E2EE; vollständige Fachhandler entstehen in P2.
- Abnahme: bekannte gültige Eingaben akzeptiert, unsichere Zahlen und unbekannte Versionen abgewiesen; öffentliche Hüllen deklarieren keine Finanzklartextfelder; Apps können Ports ohne Plattformabhängigkeit im Fachkern referenzieren.
- Prüfungen: gezielte positive/negative Schematests und Typ-/Importgrenzenprüfung; neue Vertragsschemas mit den Dokumenten abgleichen.
- Prüfbelege: `@wimm/contracts` enthält Zod-Schemas für gemeinsame Primitive, Fehler, öffentliche `EncryptedOperation`- und signierte `KeyRoster`-Hüllen sowie typisierte `StorageAdapter`-/`PlatformServices`-Ports. Die Hüllen sind strikt und enthalten keinen Finanzpayload. Im OrbStack-Dev-Container bestanden `pnpm test:contracts` mit vier gezielten Positiv-/Negativfällen (gültige Hüllen, unsichere Zahlen, unbekannte Protokollversion, Finanzklartext, Revisions- und Rosterfolgefehler), `pnpm typecheck` und `pnpm check:package-graph`. Ein temporärer verbotener Import `@wimm/contracts` → `@wimm/domain` wurde abgewiesen und danach entfernt. Keine Crypto-Bindung, Verschlüsselung, Speicher-, Sync- oder Appimplementierung ausgeführt.

## P1.4 — Crypto-Binding und Testgrundlage

- Status: offen.
- Freigabe: Implementierungsauftrag für P1.
- Voraussetzungen: P1.3 erledigt.
- Schritte: gewähltes libsodium-Binding und RFC-8785-Bibliothek kapseln; dokumentierte Primitive und Kontexte anbinden; feste synthetische Testvektoren mit Herkunft, Eingabebytes und erwarteten Ausgabebytes anlegen.
- Ergebnis: ausführbare Crypto-Grundlage für spätere Tresor-/Schlüssel-/Syncarbeit; keine eigene Kryptografie und kein vollständiges Schlüsselprotokoll.
- Verträge: [Verschlüsselung](encryption.md); reine Rechenbeispiele aus dem Referenzhaushalt sind keine Crypto-Testvektoren.
- Abnahme: Bibliotheksinitialisierung funktioniert in Web- und Desktoplaufzeit; kanonische Bytes, Verschlüsselung/Entschlüsselung und Signaturen stimmen mit festen Vektoren überein; Manipulation von Chiffrat, AAD und Signatur wird erkannt. Fixierte Nonces ausschließlich in isolierten Tests, frische Nonces bei neuer produktiver Verschlüsselung.
- Prüfungen: Bindingsmokechecks, Vektor- und Manipulationstests als Grundlage für C01/C02; kein behauptetes Bestehen der vollständigen C01–C14 oder unabhängiges Audit.
- Prüfbelege: noch keine.

## P1.5 — Minimale Apphüllen

- Status: offen.
- Freigabe: Implementierungsauftrag für P1.
- Voraussetzungen: P1.4 erledigt.
- Schritte: minimale Vite-/React-Webhülle, Tauri-Hülle und Fastify-Serverhülle anlegen; Healthzustände gemäß Betriebsvertrag und Source-/Lizenzhinweis vorsehen; keine Finanz-HTTP-API oder Finanzoberfläche vorziehen.
- Ergebnis: start- und baubare Hüllen; bestehende P2–P10-Funktionen bleiben ausstehend.
- Verträge: Architektur, API-Health und [Betrieb](operations.md); Bereitschaft nur für tatsächlich vorhandene Komponenten melden.
- Abnahme: Web und Tauri starten auf dokumentierten verfügbaren Zielsystemen; Server liefert richtige Healthstatuscodes ohne persönliche Daten; fehlende Plattformprüfungen sind benannt.
- Prüfungen: Start-/Buildsmokechecks, Health-Tests und Crypto-Binding in beiden Clienthüllen ausführen.
- Prüfbelege: noch keine.

## P1.6 — CI, Prüfungen und Entwicklungsanleitung

- Status: offen.
- Freigabe: Implementierungsauftrag für P1; externe GitHubeinstellungen nur bei entsprechender Autorisierung ändern.
- Voraussetzungen: P1.5 erledigt.
- Schritte: Rootbefehle aus P1 bereitstellen, CI-Workflow mit gesperrten Abhängigkeiten anlegen und lokal reproduzieren; gemeinsame Dokumentationsprüfung und optionalen pre-commit-Hook gemäß [Hook-Konzept](development.md#hooks-und-automatisierte-prüfungen-ab-p1) einrichten; Installations-/Start-/Prüfanleitung aktualisieren.
- Ergebnis: nachvollziehbare Entwicklungsbasis und identische Prüfwerkzeuge für Menschen, Agenten, Hooks und CI.
- Verträge: Entwicklungsanleitung, Teststrategie, Hook-Konzept und Gesamt-Abnahme P1.
- Abnahme: dokumentierte Befehle sind vorhanden und tatsächlich ausführbar; Hookaktivierung/-deaktivierung ist checkoutlokal dokumentiert; vorgemerkte Inhalte werden ohne Dateiumschreiben geprüft. Noch leere App-/E2E-Suites werden als solche ausgewiesen. CI-Konfiguration lokal geprüft; Remoteausführung erst nach autorisiertem Push belegen.
- Prüfungen: frischer Checkout mit gesperrtem Lockfile; Typ-/Build-/Vertragstests und Paketgraph; Dokumentationsprüfung einschließlich absichtlich defekter Links/JSON/YAML in temporären Prüfständen. Hook mit teilweise vorgemerkter Datei prüfen; Arbeitskopie darf das geprüfte Commitbild nicht ersetzen. Vorhandenen abweichenden hooksPath bei Aktivierung erkennen und nicht automatisch überschreiben.
- Prüfbelege: noch keine.
