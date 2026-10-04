# Umsetzungsplan und Agentenübergabe

## Auftrag und Statusführung

Aktuelle Freigabe: D0, D1, D2, P1, P2 und P3 sind abgeschlossen. P4 besitzt dokumentierte Implementierungsfreigaben und Teilimplementierungen. P4.1 sowie P4.2.1 bis P4.2.4 sind erneut vollständig abgenommen; als nächster begrenzter Folgeauftrag steht P4.2.5 an. Zusätzlich ist T1 zur Toolkonfigurationsmodernisierung ausdrücklich freigegeben.

Statuswerte: `offen`, `in Arbeit`, `blockiert`, `erledigt`. Blockiert benötigt konkrete fehlende Voraussetzung und nächste Handlung. Bei Implementierungsfreigabe das erste offene Paket mit erfüllten Voraussetzungen bearbeiten. Unteraufgaben in Reihenfolge; keine Grundsatzentscheidungen aus dem Konzept neu öffnen. Prüfbelege und notwendige Abweichungen direkt beim Paket ergänzen.

## Teilaufgaben und Bearbeitungsfolge

Die Teilpläne konkretisieren die Pakete nach dem Muster von [P1](p1-foundation.md). Jedes Paket beginnt nach Abnahme seines Vorgängers und eigener Implementierungsfreigabe. Pro Teilaufgabe Status, Ergebnis und Prüfbelege im Teilplan pflegen, den Gesamtstatus hier; die bestehenden Paketabnahmen bleiben verbindlich. P2 ist abgeschlossen. Der Nutzer hat am 3. Oktober 2026 den vollständigen Abschluss von P3 freigegeben.

| Paket | Teilaufgaben | Ergebnis der Schrittfolge |
| --- | --- | --- |
| P1 | [P1.1–P1.6](p1-foundation.md) | Projektgrundlage; bereits erledigt |
| P2 | [P2.1–P2.6](p2-domain.md) | Primitive → Aggregate → Stammdaten → Buchungen → Transfer/Abgleich → Projektionen/Abnahme |
| P3 | [P3.1–P3.6](p3-storage.md) | Speicherverträge → Tresor → SQLite → IndexedDB → Orchestrierung → Offline-Abnahme |
| P4 | [44 kleine Unteraufgaben in P4.1–P4.6](p4-ui.md#kleine-arbeitsaufträge-und-abschlussregeln) | jede Funktion und jeder Nachweis einzeln; Fortsetzung mit P4.2.5 |
| P5 | [P5.1–P5.6](p5-import.md) | Parserbasis → CSV → CAMT/OFX/QFX → Übernahme → Regeln → Dauerzahlungen/Abnahme |
| P6 | [P6.1–P6.6](p6-budget.md) | Methodenhistorie → Plan → Umschläge → Ziele → Berichte → Budgetabnahme |
| P7 | [P7.1–P7.7](p7-family.md) | Teilnehmer → Anteile → Zahlungen → Reserve → Refunds → Veröffentlichung → Familienabnahme |
| P8 | [P8.1–P8.7](p8-server.md) | CiphertextStore → OIDC → Kopplung → Identitäten → Grants → Rotation → Zugriffsmatrix |
| P9 | [P9.1–P9.6](p9-sync.md) | Transport → Push/Pull → Scheduler → Validierung/Konflikte → Onboarding → Mehrgeräteabnahme |
| P10 | [P10.1–P10.6](p10-backup.md) | Container → Clientrestore → Backups → Serverrestore → Self-Hosting → Betriebsabnahme |
| P11 | [P11.1–P11.6](p11-release.md) | Anleitungen → Plattformen → Signierung → Quellarchive → unabhängige Prüfung → Releaseübergabe |

P4 enthält sechs Sammelaufgaben mit 34 noch offenen Unterabnahmen; P5–P11 behalten ihre bisherigen Teilpläne. Bei fehlenden Plattformen oder Signierungsgeheimnissen nur die betroffene Prüfung/Distribution blockieren und unabhängige bereits freigegebene Arbeit fortsetzen; keine Abnahme überspringen oder erledigt behaupten. P11-Abschluss erteilt keine Veröffentlichungsfreigabe.

## T1 — Toolkonfigurationen und verbindliche Warnungsprüfung

- Status: erledigt (4. Oktober 2026).
- Freigabe: ausdrücklicher Nutzerauftrag zur Umsetzung des Modernisierungsplans; kein allgemeines Bibliotheksupdate und keine Erweiterung von P4–P11.
- Voraussetzungen: vorhandene Projektgrundlage P1–P3 und aktuelle Toolchain in der aktiven Arbeitskopie.
- Schritte: ES2025 und vollständige Typprüfung; Oxlint mit Typinformationen; strenge Build-/Rust-/Node-Prüfungen; vollständige Pakettestserie; Editor-/CI-Integration und isolierte Fehlerproben.
- Ergebnis: ES2025, vollständige Typprüfung, Oxlint, strenge Build-/Rust-/Node-Prüfungen und zehn reproduzierbare Toolchainprüfungen verbindlich integriert. Getrennte Anwendungs-/libsodium-Bundles bleiben ohne Anhebung unter Vites 500-kB-Grenze. Tauri-CLI 2.12.0 beseitigt die veraltete STATIC_VCRUNTIME-Übergabe; sonst keine bestehenden Bibliotheksversionen aktualisiert.
- Verträge: Entwicklungs-/Prüfanleitung und Versionsbasis; keine Fach-API, Speicherformate oder Finanzregeln geändert.
- Abnahme: zentrale Prüfserie einschließlich UI-Pakettests, Rust und Web-/Desktopbuild erfolgreich; Fehlerproben brechen zuverlässig ab; Prüfeingaben vollständig; Plattformgrenzen dokumentiert.
- Prüfungen: `pnpm install --frozen-lockfile`, vollständiges `pnpm check:ci`, zusätzlich `pnpm test:ui:build` gegen beide gebauten Frontends und abschließende Dokumentations-/Whitespaceprüfung.
- Prüfbelege: macOS arm64, Node 26.10.0, pnpm 12.8.1, TypeScript 7.0.2, Rust 1.99.0. Die vollständige zentrale Serie bestand am 4. Oktober 2026: zwei Dokumentationsvalidator-Tests, 84 Vitest-Tests, ein Service-Worker-Test, ein Rust-SQLite-Test, zehn Toolchainprüfungen und 17 Chromium-UI-Tests (zehn Web, sieben Desktopfrontend). Webbuild und nativer macOS-Releasebuild bestanden ohne Warnungen. Zusätzlich bestanden dieselben 17 UI-Tests über Vite Preview gegen die gebauten Frontends, einschließlich PWA-Offline-Neustart, Passphrase-/Recovery-Entsperren und Haushaltserhalt. Größte Anwendungsdatei: 465,78 kB; libsodium-WASM: 413,40 kB; Bindings: 120,53 kB. Gesperrte Installation bestanden.
- Einschränkungen: `skipLibCheck` wegen Dexie-4.2.1-/thread-stream-4.2.0-Deklarationen weiterhin erforderlich. Linux-Remote-CI, Windows und macOS x64 nicht ausgeführt. Die Desktop-Frontendmatrix enthält keinen PWA-Service-Worker-Test; dieser bleibt verpflichtend im Webclient und ersetzt keine native Desktopabnahme.

### T1 — Abnahmematrix und Übergabe

| Kriterium | Status | Beleg |
| --- | --- | --- |
| ES2025, strengere Regeln und vollständige Prüfeingaben | erfüllt | TypeScript und Dateiliste in `test:toolchain`, einschließlich React, Vite, Vitest und UI-Tests |
| Warnungen und exklusive Tests führen zu Fehlerstatus | erfüllt | Zehn isolierte Toolchainprüfungen; Vite-Logger, Rolldown und nativer Reporter für beide Apps; Cargo-Buildskript-/Compiler- und Node-Warnungen |
| Vollständige lokale Tests und Builds | erfüllt | `check:ci` einschließlich UI-Pakettests, Rust und nativem macOS-Releasebuild; zusätzlich 17 Tests der gebauten Frontends |
| Reproduzierbare Toolchain, Editor-/CI-Integration | erfüllt | Gesperrte Installation, versionierte Rust-Toolchain, JSON/YAML-/Dokumentationsprüfung und gemeinsame Projektbefehle |
| Einschränkungen und Versionsabweichungen ausgewiesen | erfüllt | Entwicklungsanleitung und Versionsbasis; konkrete skipLibCheck-Ursachen sowie ungeprüfte Remote-/Plattformläufe benannt |

- Ergebnis: T1 lokal vollständig abgenommen; keine Fachverträge oder Datenformate verändert.
- Geprüft: zentrale Serie und gebaute Oberflächen auf macOS arm64; Belege siehe oben.
- Nicht geprüft: Linux-Remote-CI, Windows, macOS x64 und interaktive native Tauri-Bedienung; T1 erteilt keine P4-Gesamtabnahme.
- Commits: Implementierungsstand `3075147`; Abschlusscommit ergänzt die aktuellen Prüfbelege und diese Übergabe. Kein Push oder Merge.
- Einschränkungen: Fremddeklarationsprüfung bleibt vorläufig eingeschränkt; keine fiktiven Remote-CI-Belege.
- Nächster Schritt: P4.2.5 bleibt der nächste begrenzte Produktauftrag; T1 erweitert dessen Freigabe nicht.

## D0 — Dokumentationsübergabe

- Status: erledigt (2. Oktober 2026).
- Voraussetzung: bestätigtes Konzept, Nutzerlizenz AGPL-3.0-or-later und Freigabe für Dokumentation.
- Schritte: Root-README/Agentenregeln/Lizenz; Produkt/Fachmodell/Datenmodell; Architektur/Sync/API/Formate; UI/Sicherheit/Betrieb; Entscheidungen/Tests/Aufgaben anlegen. Nutzer wünscht Zwischencommits pro abgeschlossenem Abschnitt.
- Ergebnis: vollständiges verlinktes Übergabepaket, keine Anwendungscode- oder Infrastrukturdateien.
- Verträge: alle Dokumente; Begriffe, Lizenz, Rechte, Buchungs-/Budget-/Ausgleichsregeln konsistent.
- Abnahme: alle relativen Links lösen auf, JSON-Beispiele parsebar, geplante Pakete bleiben offen, keine veraltete MIT-Projektlizenz, keine behaupteten Anwendungstests oder existierenden APIs.
- Prüfbelege: 17 Dateien (16 Markdown-Dateien und vollständiger Lizenztext); 42 relative Links auf vorhandene Ziele geprüft; drei JSON-Beispiele erfolgreich geparst; P1–P11 vollständig und offen; Cent-Referenzrechnungen für Umschlag, Eigenanteilsverrechnung und Teilrückerstattung geprüft; Whitespaceprüfung bestanden. Keine Anwendungstests, Paketinstallation oder Infrastruktur ausgeführt. Zwischencommits: `07c0608` (Fachmodell/Schnittstellen/Lizenz), `14f2784` (UI/Sicherheit/Betrieb); Abschlusscommit ergänzt Agentenübergabe und Konsistenzkorrekturen.

## D1 — E2EE-Präzisierung und Agentenhilfen

- Status: erledigt (2. Oktober 2026).
- Freigabe: Nutzerauftrag zu verpflichtender E2EE, authentifiziertem Clientvertrauen sowie Skills/Guides für GitHub und VS Code; keine App-Implementierung.
- Voraussetzungen: D0 erledigt; spätere Nutzerentscheidungen ersetzen alte Defaults.
- Schritte: Verschlüsselungsspezifikation, API/Sync/Speicherung/Recovery und C01–C14 konsistent anpassen; vier Repository-Skills und zentrale Agenten-/Beitrags-/Editorleitfäden; Task-/ADR-/Handoff- und GitHubvorlagen; Formatkonfiguration.
- Ergebnis: gemeinsame versionierte Richtlinien und nach Bedarf ladbare Skills; verpflichtende E2EE ohne Appcodesignatur/Attestierung als Clientzugangsbedingung.
- Verträge: ADR-025–ADR-028, Verschlüsselung/API/Sync/Formate, Agentenregeln und Vorlagen.
- Abnahme: P1–P11 bleiben offen, kein Appcode/Remote-Push; Skills validiert, Markdown/JSON/YAML/Links geprüft; keine aktuellen Klartextserverannahmen; Repositorystatus sauber nach Abschlusscommit.
- Prüfbelege: vier Skills erfolgreich mit dem mitgelieferten Validator geprüft; 29 Markdown-Dateien ohne Markdownlintfehler, 105 relative Links auf vorhandene Ziele, drei JSON-Beispiele/drei JSON-Konfigurationen und sechs YAML-Dateien geprüft. YAML-Metadaten inkl. Aufrufnamen/automatischer Auswahl und GitHubformularfelder gültig. P1–P11 offen, kein Anwendungscode/Remote/Push. E2EE-Zwischencommits `d84846e` und `dfebdcd`; Abschlusscommit enthält Guides und einheitliches Tabellenformat. Crypto-/App-Tests sind spezifiziert, mangels Implementierung noch nicht ausgeführt.

## D2 — Einstieg und Vorbereitung des Implementierungsstarts

- Status: erledigt (2. Oktober 2026).
- Freigabe: ausdrücklicher Nutzerauftrag zur Umsetzung des Ergänzungsplans; Dokumentation und Agentenhilfen, keine P1-Implementierung oder Commit-/Pushfreigabe.
- Voraussetzungen: D0/D1 erledigt.
- Schritte: kompakten Einstieg, Lesematrix und P1-Teilaufgaben ergänzen; synthetischen Referenzhaushalt und Buchungsablauf dokumentieren; Widerspruchs-/Commitregeln vereinheitlichen; Hook-/CI-Konzept für P1 beschreiben.
- Ergebnis: verlinkte Startanleitung mit begrenzten Arbeitsschritten und gemeinsamen Beispielen; keine installierten Hooks oder Anwendungspakete.
- Verträge: Agenten-/Beitragsleitfäden, P1-Struktur, bestehende Fach-/E2EE-Verträge unverändert; ADR-029.
- Abnahme: Links/Anker und Dokumentstruktur gültig; feste IDs und Centrechnungen konsistent; F-Fälle unabhängig; P1 und Teilaufgaben offen; Freigabe-/Commit-/Widerspruchsregeln konsistent; kein Appcode oder Gitkonfigurationswechsel.
- Prüfungen: lokale Link-/Ankerprüfung, JSON/YAML soweit Werkzeuge verfügbar, Whitespace-/Strukturprüfung, IDs/Rechnungen und Status-/Vertragsabgleich.
- Prüfbelege: 32 Markdown-Dateien mit jeweils einem H1, gültigen Tabellen und UTF-8/LF/Abschlussnewline; 161 lokale Links einschließlich Anker auf vorhandene Ziele geprüft; 6 JSON-Blöcke/-Dateien und sechs YAML-Dateien erfolgreich geparst. 15 eindeutige UUIDs sowie R01–R03-Centrechnungen geprüft; P1–P11 und P1.1–P1.6 offen. Whitespaceprüfung und manueller Freigabe-/Commit-/Fach-/E2EE-Abgleich bestanden. Keine Paketinstallation, App-/Crypto-Tests, Hookaktivierung, Gitkonfigurationsänderung, Commits oder Veröffentlichung. Vollständiges Markdownlint nicht ausgeführt, weil kein ausführbares Werkzeug verfügbar war; Struktur-/Tabellen-/Whitespaceprüfungen separat durchgeführt.

- Nächster Schritt: Nach ausdrücklicher Implementierungsfreigabe P1.1 übernehmen; davor kein Anwendungscode.

## D3 — Externe Serveridentität und eigenständiger Lokalbetrieb

- Status: erledigt (2. Oktober 2026).
- Freigabe: ausdrückliche Nutzeranforderung zur ausschließlichen externen Authentifizierung für Serververbindungen und zu eigenständig nutzbaren Apps; Dokumentationsänderung, keine App-Implementierung.
- Ergebnis: Serveridentitäten und Anmeldung erfolgen über OIDC oder einen gleichwertigen externen Identitätsdienst; lokale Passwörter, Benutzeranlage und Setupkonten sind ausgeschlossen. Desktop/PWA bleiben ohne Server vollständig nutzbar.
- Verträge: ADR-030; Produkt, Architektur, Sicherheit, API, Betrieb, Datenmodell, Verschlüsselung und Tests.
- Prüfbelege: Dokumentationskonsistenz sowie lokale Linkziele, Markdownstruktur und Whitespace geprüft; PR dient als Nachweis. Keine Anwendungstests oder Infrastruktur gestartet.

## D4 — Arbeitsumgebung ohne DevContainer

- Status: erledigt (3. Oktober 2026).
- Freigabe: Nutzerauftrag zur Anpassung der Dokumentation nach Abschaffung des VS-Code-DevContainers.
- Ergebnis: Die verbindlichen Arbeitsregeln, der Agentenleitfaden, der Copilot-Hinweis und der Workflow-Skill verwenden die aktive Arbeitskopie als Arbeitsumgebung. Andere lokale Kopien und externe Arbeitsumgebungen bleiben ausgeschlossen. Nach jedem abgeschlossenen Abschnitt ist ein Zwischencommit verpflichtend.
- Verträge: `AGENTS.md`, [Agentenleitfaden](agent-guide.md), `.github/copilot-instructions.md` und [wimm-workflow](../.agents/skills/wimm-workflow/SKILL.md).
- Prüfbelege: Alle aktiven Arbeitsanweisungen auf DevContainer-, Containerzugriffs- und Hosttransportvorgaben geprüft. Historische Prüfbelege zu P1.2 und P1.3 bleiben unverändert, weil sie vergangene Ausführungsumgebungen beschreiben.


## D5 — Schrittweise Teilaufgaben für P2 bis P11

- Status: erledigt (3. Oktober 2026).
- Freigabe: Nutzerauftrag zur Anlage von Tasks analog zu docs/p1-foundation.md; Dokumentationsarbeit, keine P2–P11-Implementierung.
- Voraussetzungen: P1 erledigt; bestehende Paket-, Fach-, E2EE- und Abnahmeverträge gelesen.
- Schritte: P2–P11 in nummerierte, abhängige Teilaufgaben mit Ergebnis/Abnahme/Prüfungen zerlegen; Paketstatus, Index und Einstieg verlinken; Vertragsabdeckung und Reihenfolge prüfen.
- Ergebnis: zehn Teilpläne mit 62 offenen Aufgaben; nächster Implementierungsschritt P2.1 nach ausdrücklicher Freigabe.
- Verträge: vorhandene Pakete/Fachquellen unverändert; minimale verschlüsselte Entwurfsexportbasis bereits in P9 für dessen bestehende Abnahme, vollständiger Bereichsexport/Restore in P10; signierte Rotationssnapshotbasis in P8, Wiederverwendung in P9.
- Abnahme: alle P2–P11-Pakete und Teilaufgaben offen, fortlaufend und verlinkt; Vorbedingungen/Abnahme/Prüfungen je Aufgabe vorhanden; keine neue Produktregel, Appimplementierung oder Veröffentlichung.
- Prüfungen: bestehender Dokumentationsvalidator für UTF-8/LF, JSON/YAML, relative Links/Anker; Struktur-/Status-/Voraussetzungsprüfung aller Teilaufgaben; manueller Vertrags-/Abnahmekriterienabgleich; Whitespaceprüfung.
- Prüfbelege: Dokumentationsvalidator und Whitespaceprüfung bestanden. Zehn Teilpläne mit 62 eindeutigen fortlaufenden IDs, jeweils neun vollständigen Aufgabenfeldern, offenen Statuswerten, noch leeren Implementierungsnachweisen und Vorgängervoraussetzungen geprüft; alle P2–P11-Pakete weiterhin offen und verlinkt. Manueller Abgleich mit Fach-/Speicher-/E2EE-/UI-/Betriebsverträgen und F-/S-/C-Abnahmekriterien bestanden. Veralteten Einstieg vor P1 aktualisiert. Zwischencommit `ba05fb5` legt die Teilpläne an; Abschlusscommit integriert Index/Übergabe und präzisiert früh benötigte Snapshot-/Entwurfsexportgrundlagen. Keine Anwendungstests, Builds, Installationen, Infrastruktur, Pushes oder Veröffentlichungen ausgeführt; ausschließlich Dokumentationsarbeit.
- Nächster Schritt: [P2.1 — Exakte Geld- und Kalenderprimitive](p2-domain.md#p21--exakte-geld--und-kalenderprimitive) nach ausdrücklicher Implementierungsfreigabe übernehmen.

## P1 — Projektgrundlage

- Status: erledigt (3. Oktober 2026). Freigabe: Nutzerauftrag vom 2. Oktober 2026 für den Beginn mit P1.1. Voraussetzung: D0 erledigt.
- Fortschritt: P1.1 bis P1.6 sind erledigt.
- Teilaufgaben: [P1.1–P1.6](p1-foundation.md) in Reihenfolge; Gesamtabschluss erst nach allen Teilabnahmen.
- Schritte: stabile kompatible Toolchain prüfen; Workspace einschließlich `packages/crypto`; TS strict/ESM; Fach- und öffentliche EncryptedOperation-/KeyRoster-Verträge trennen; gepflegte libsodium-Bindung und RFC-8785-Bibliothek; Crypto-Testvektoren; leere Apphüllen/Lockfiles/CI. Keine Klartext-FinanzAPI als Zwischenlösung.
- Ergebnis: reproduzierbare Entwicklungsbasis, ohne bereits vollständige Finanzfunktionen zu behaupten. Rootbefehle `dev:web`, `dev:server`, `dev:desktop`, `typecheck`, `test` und `build` sind vorhanden; `test:e2e` folgt mit den E2E-Tests.
- Verträge: Paketabhängigkeiten, gemeinsame Primitive/Versionen, PlatformServices, künftige Storage-Ports.
- Abnahme: frischer Checkout installierbar, Typ-/Buildprüfungen laufen; Web-/Tauri-Hülle startet; Backendhealth liefert korrekte Zustände. Versionskombination und getestete Betriebssysteme festgehalten. AGPL-Metadaten, Herkunftsregistergrundlage und Sourcehinweis angelegt.
- Prüfungen: CI lokal reproduzieren, Paketgraph auf verbotene Imports prüfen, Buildsmokechecks; keine Secrets erforderlich.
- Prüfbelege: P1.1: [Versions- und Lizenzbasis](technology-baseline.md) am 3. Oktober 2026 anhand offizieller Release-, Registry- und Tauri-Quellen geprüft; Tauri 2.12.1 wegen der festgelegten sieben Tage Reifezeit auf die aktuelle reife 2.11-Kombination korrigiert. P1.2: Workspace und Lockfile angelegt; Installation mit unverändertem Lockfile, TypeScript und Paketgraph damals im OrbStack-Dev-Container geprüft. Die VS-Code-Dev-Containers-Erweiterung 0.469.0 hat die damalige Konfiguration einschließlich `postCreateCommand` erfolgreich gestartet. P1.3: öffentliche Zod-Vertragshüllen, Fehler- und Porttypen angelegt; vier gezielte Vertragstests sowie TypeScript und Paketgraphprüfungen damals im Container bestanden. Ein absichtlich verbotener Import wurde erkannt und entfernt. Die Containerumgebung wurde inzwischen entfernt. P1.4: `libsodium-wrappers-sumo` 0.8.4 und `canonicalize` 5.1.0 gekapselt; sieben synthetische Binding-/Manipulationstests sowie Vertrags-, TypeScript- und Paketgraphprüfungen mit Node 24.21.0 bestanden. P1.5: Web-, Server- und Tauri-Hülle mit sichtbarem Source-/Lizenzhinweis und Crypto-Binding angelegt. Die zwei Servertests, TypeScript, Paketgraph, Vite-Builds und der native macOS-arm64-Tauri-Build mit Rust 1.99.0 aus Homebrew bestanden; alle drei Hüllen starteten lokal. P1.6: gemeinsame Markdown-/JSON-/YAML-/Linkprüfung, optionale indexbasierte Hookprüfung und Ubuntu-CI erstellt; positiver/negativer Validator-, Hook-, Installations-, Typ-, Paketgraph-, Test- und lokaler Buildnachweis erbracht. Kein Remote-Lauf oder Push. Keine Finanzfunktion, Finanz-HTTP-API oder Finanzdaten vorhanden. Windows und E2E bleiben ungeprüft. Wartung am 3. Oktober 2026: Dependabot prüft npm/pnpm, Cargo und GitHub Actions täglich; npm/pnpm-Versionsupdates warten sieben Tage. `@types/node` 26.6.3, Actions v7/v6 und die vollständige lokale CI-Prüfserie bestanden. `skipLibCheck` übergeht ausschließlich die inkompatible Fremddeklaration von `thread-stream` mit Node-26-Typen. CI-Nachbesserung am 4. Oktober 2026: Lauf 37188501893 scheiterte an fehlendem Playwright-Chromium; Browserinstallation samt Systemabhängigkeiten wurde ergänzt. CI-Optimierung am 4. Oktober 2026: Playwright-Chromium und Rust/Cargo-Buildartefakte werden mit getrennten, passenden Schlüsseln gecacht; Browser-Systemabhängigkeiten bleiben auf jedem frischen Runner installiert. Vollständiges `pnpm check:ci` in der aktiven macOS-arm64-Arbeitskopie bestanden (Dokumentation, Paketgraph, TypeScript, 80 Unit-/Service-Worker-Tests, 14 Web-/Desktop-UI-Prüfungen sowie Builds einschließlich Tauri). Nachprüfung des Remote-Laufs 37190134465: Ubuntu 24.04 brach nach 20 Minuten während der Playwright-Installation des vollständigen 167-MiB-Chromium-Archivs ab; Tests begannen nicht. Die Installation hing beim Entpacken reproduzierbar auch lokal mit Playwright 1.58.2 unter Node 26.10.0. Playwright hat den Hänger für Versionen unter 1.60.0 dokumentiert; ab 1.60.0 behoben ([Playwright-Fehlerbericht](https://github.com/microsoft/playwright/issues/40998)). `@playwright/test` ist auf die bereits in der [Versionsbasis](technology-baseline.md) festgelegte Version 1.63.0 aktualisiert. CI folgt Playwrights GitHub-Actions-Empfehlung und installiert nur Chromiums Headless-Shell samt OS-Abhängigkeiten (`pnpm exec playwright install --with-deps --only-shell chromium`); Browsercache entfernt, Cargo-Cache bleibt. Frische lokale Headless-Shell-Installation und beide UI-Suiten mit Node 26.10.0 bestanden. Vollständiges `pnpm check:ci` anschließend bestanden (80 Unit-/Service-Worker-Tests, 14 UI-Prüfungen und alle Builds einschließlich Tauri). Remote-Neulauf mangels Push noch offen.

## P2 — Fachkern

- Status: erledigt (3. Oktober 2026). Voraussetzung: P1.
- Fortschritt: P2.1 bis P2.6 und die P2-Gesamtabnahme sind erledigt.
- Teilaufgaben: [P2.1–P2.6](p2-domain.md) in Reihenfolge; Gesamtabschluss erst nach allen Teilabnahmen.
- Schritte: exakte Geld-/Datumsparser; Aggregate/Revisionstypen; Konten/Kategorien/Empfänger; Buchungen/Splits/Opening; Transfers und Kontenabgleich; pure Befehlshandler mit Änderungssets; Projektionen für Salden und Einnahmen/Ausgaben. Reconciled-Lock und Referenzarchivierung berücksichtigen.
- Ergebnis: plattformfreie Fachlogik ohne Datenbank/React/HTTP, die sämtliche Eingabe- und Summeninvarianten prüft sowie Saldo- und Verbrauchsprojektionen reproduzierbar aus vollständigen Aggregaten ableitet.
- Verträge: Datenmodell und Befehle account/category/payee/transaction/transfer/reconciliation.
- Abnahme: Referenzfälle F01–F03 und Geld-/Datums-/Abgleichfehlfälle bestehen; Updates ohne alle erwarteten Revisionen abgewiesen; keine Teiländerungssets.
- Prüfungen: deterministische Vitest-Fachtests sowie Eigenschaften für Summen, Transfererhaltung und Ganzzahlüberlauf.
- Prüfbelege: P2.1: Dezimalgeld-, sichere Summen-/Zwischenwert- und Kalenderprimitive im plattformfreien Paket `@wimm/domain` umgesetzt. 26 neue Fachtests sowie die vier vorhandenen Vitest-Suiten mit insgesamt 39 Tests bestanden; TypeScript, Paketgraph und positive/negative Dokumentationsprüfung bestanden. Nach Aktualisierung auf Node 26.10.0 und pnpm 12.8.1 bestanden außerdem die gesperrte Installation und `pnpm check:ci`. P2.2: vollständige Aggregate, Revisionskopfstände, atomare Änderungsmengen und injizierte ID-/Zeitgeber ergänzt; die Fachtests decken Mehraggregat- und Fehlpfade ab. P2.3: Konten, Kategorien und Empfänger einschließlich atomarer Empfänger-Merges ergänzt. P2.4: vollständige Buchungen, Splits, Anfangsbestandsregeln und Tombstones ergänzt; 43 Domänentests und `pnpm check:ci` bestanden. P2.5: atomare Umbuchungen mit Gegenbuchungen, Budgetgrenzen und Kontenabgleich ergänzt; 47 Domänentests und `pnpm check:ci` bestanden. P2.6: reine Saldo- und Verbrauchsprojektionen mit F01/F03, Erstattungs- und Neuaufbaugleichheit ergänzt. Die P2-Gesamtabnahme mit 50 Domänentests und vollständigem `pnpm check:ci` ist bestanden. Details und Teilnachweise stehen im [P2-Teilplan](p2-domain.md).

## P3 — Speicher und Offlinebasis

- Status: erledigt (3. Oktober 2026). Voraussetzung: P2 erledigt.
- Teilaufgaben: [P3.1–P3.6](p3-storage.md) in Reihenfolge; Gesamtabschluss erst nach allen Teilabnahmen.
- Schritte: Client-Speicheradapter/Rustbatch-Brücke, Transaktionen/Projektionen/Entwürfe; lokaler verschlüsselter UserVault, unabhängige Bereichsschlüssel, Entsperrung/Rettungscode und Schlüsselports; keine persistierten Klartextkeys. Export-Snapshotport verschlüsselt. Service Worker, persistenter Browserstore und Tabkoordination.
- Ergebnis: dauerhafte lokale Datenhaltung in beiden Clients; vorbereitete Outbox ohne Netzwerkpflicht.
- Verträge: StorageAdapter, lokale Revisionen, Snapshot-/Outboxzustände; Datenmodellindizes.
- Abnahme: gemeinsame Konformitätssuite für beide Adapter; S01–S03/S14; offline Neustart ohne verlorene Buchungen; Quota/Disk-full kein Erfolg; private Profile getrennt.
- Prüfungen: echte DB-/IndexedDB-Integrationsprüfungen, Absturzpunkte in Batch-/Cursorcommit simulieren; PWA-Network-off-Neustart.
- Prüfbelege: P3.1–P3.6 mit atomarem Speichervertrag, lokalem UserVault, begrenzter SQLite-Brücke, Dexie-Adapter, Orchestrierung und Service Worker abgeschlossen. Acht Speichertests, elf Kryptotests, Service-Worker- und Rust-SQLite-Test sowie TypeScript, Paketgraph, Dokumentation, Web-/Desktopbuild und lokale CI-Prüfung bestanden. Echte Network-off-PWA- und native Disk-full-Smokechecks bleiben als explizite Plattformprüfung vor P4 offen; Details stehen im [P3-Teilplan](p3-storage.md).

## P4 — Oberfläche und native App

- Status: in Arbeit. Voraussetzung: P3. P4.1 ist erneut vollständig abgenommen; P4.2–P4.5 besitzen Teilimplementierungen, erfüllen nach Nachprüfung ihre Abnahmen aber noch nicht; P4.6 ist offen.
- Teilaufgaben: [P4.1–P4.6 mit 44 kleinen Unteraufgaben](p4-ui.md#kleine-arbeitsaufträge-und-abschlussregeln); pro Auftrag nur eine Unteraufgabe einschließlich konkretem Nachweis. Nächster Schritt: [P4.2.5](p4-ui.md#p425--empfänger-merge-mit-buchungsreferenz-abnehmen). Gesamtabschluss erst nach allen Teilabnahmen.
- Schritte: Composition Root, PlatformServices, Bereichswechsel; Übersicht/Konten/Buchungslisten/Formulare; Splits/Transfer/Abgleich; virtuelle Listen; Touch-/Desktoplayout; Systemschrift/-Farbschema; native Menüs, Dialoge, Kurzbefehle und Systembrowserlinks; leer/Fehler/offline/ausstehend-Zustände.
- Ergebnis: lokal benutzbares Haushaltsbuch auf Web/PWA und Tauri, noch ohne alle Planungsfunktionen.
- Verträge: UI-Ansichten, Befehlseingaben, Dateidialog-/Menüports, Bildschirm-/Fokusregeln.
- Abnahme: neue Buchung, Transfer, Abgleich per Tastatur und Touch; alle Daten nach Neustart; Screenshots ohne Überlappung; native Dialog-/Menü-Smokecheck auf verfügbaren Zielsystemen. Fehlende Plattformprüfung konkret markieren.
- Prüfungen: Playwright für Kernabläufe und Viewports; echte Tauri-Prüfung nach [UI](ui.md), Screenreader-/Zoomsmokecheck.
- Prüfbelege: Aktueller Stand: lokaler Tresor-/Bereichseinstieg mit Rettungscode und drei UI-Tests; lokale Navigation und Stammdaten; einfache Buchungen, Anfangsbestände und exakte Zweiweg-Splits; Formulare für atomare Umbuchung und Abgleich; natives Tauri-Datei-/Bearbeiten-Menü. P4.2 ergänzt Archivierung von Konten/Kategorien und atomaren Empfänger-Merge über die bestehenden Fachbefehle sowie zwei Chromium-Playwright-Abläufe. `pnpm check:ci` bestand am 3. Oktober 2026 mit Dokumentation, Paketgraph, TypeScript, Vertrags-, Domain-, Krypto-, Speicher-, Offline-, Server- und Chromium-UI-Tests sowie Web- und Desktop-Produktionsbuild.

  P4.1 ist am 4. Oktober 2026 erneut vollständig abgenommen: Neue Haushaltsschlüssel bleiben nach Sperren/Neustart per Passphrase oder Rettungscode verfügbar. Chromium prüft Erstnutzung, Sperren/Entsperren und einen Offline-Neustart für Web und Desktop-Frontend. Zusätzlich prüft P4.1.8 die gebündelte Tauri-Anwendung auf macOS arm64 mit echter nativer Interaktion: Tresor und Haushalt anlegen, sperren, Laufzeit neu starten und beide Entsperrwege erreichen wieder den Haushalt. Details stehen in der [P4.1.8-Übergabe](handoffs/p4-1-8.md). P4.2 ist nicht abnahmefähig, weil Kategoriearchivierung und ein Merge mit tatsächlich referenzierter Buchung nicht über die Oberfläche geprüft sind, Tastaturfokus nur als CSS-Regel und CSS-Zoom 200 % nur über Überschriftensichtbarkeit geprüft wurden. Browser-Zoom, Firefox/WebKit, Screenreader und native Desktop-Prüfungen fehlen ebenfalls. P4.3-Bearbeitung, Virtualisierung, F01/F02 und Fehlerpfade; P4.4-Entsperren/Undo und F03; P4.5-Dateidialoge/Systembrowser/Smokecheck; P4.6-weitere Browser, Screenshot-/Barrierefreiheits-/Leistungs- und Plattformmatrix bleiben offen.

  Planungsänderung vom 4. Oktober 2026: Alle P4.x-Aufgaben einschließlich P4.1 sind in einzeln abnehmbare Unteraufgaben aufgeteilt. Bisherige Code-/Testbelege bleiben historische Nachweise; keine neue Unterabnahme ist durch die Aufteilung bereits erfüllt. Die neue Reihenfolge, Voraussetzungen und Nachweislücken stehen im [P4-Teilplan](p4-ui.md). Prüfung der Planungsänderung: Dokumentationsvalidator, Validator-Kontrolltests, Struktur-/ID-/Voraussetzungsabgleich und Whitespaceprüfung; Details in der [Planungsübergabe](handoffs/p4-planung.md). Keine Anwendung implementiert oder neu abgenommen.

## P5 — Import und Automatisierung

- Status: offen. Voraussetzung: P4.
- Teilaufgaben: [P5.1–P5.6](p5-import.md) in Reihenfolge; Gesamtabschluss erst nach allen Teilabnahmen.
- Schritte: etablierte CSV/XML/OFX-Parser auswählen/lizenzprüfen; normalisierte Zwischenform; Mappingvorlagen und Vorschau; Dublettenentscheidungen; gruppierte Übernahme/Wiederaufnahme; Regeln mit Priorität und Stop; Schedule/Fälligkeiten/Bestätigung und Zuordnung importierter Zahlungen.
- Ergebnis: alltagstauglicher Import ohne Bankanbieter und deterministische wiederkehrende Vorschläge.
- Verträge: Formate, rule/schedule-Befehle, Quellreferenzen, Importbatchstatus.
- Abnahme: CSV/CAMT/OFX/QFX-Referenzfixtures; keine automatische Übernahme ungültiger Zeilen; Wiederimport/Bestätigung ohne Doppelbuchung; Monatsende ohne Drift; Vorschläge verändern keine Salden.
- Prüfungen: F14, Parser-/Dubletten-/Limitsuite, Replay/Abbruch eines Großimports, UI bleibt interaktiv.
- Prüfbelege: noch keine.

## P6 — Budget, Ziele und Berichte

- Status: offen. Voraussetzung: P5.
- Teilaufgaben: [P6.1–P6.6](p6-budget.md) in Reihenfolge; Familienreserve und Veröffentlichung erweitern die Projektionen in P7.
- Schritte: Budgetmethodenhistorie; Plan/Ist, Umschläge, Vorträge, Zuweisung und Umschichtung; off-budget Transfers; Sparziele/Monatsraten; Dauerzahlungsprognose; Monats-/Kategorie-/Vermögensberichte; Workerprojektion und Detailnavigation.
- Ergebnis: beide vollständigen Budgetmethoden ohne doppelte Kontoführung oder Vorwegnahme künftiger Einnahmen.
- Verträge: budget/savingsGoal-Befehle, Monatsprojektionen und Berichtsperspektiven.
- Abnahme: F04–F06/F15, negative Überträge, Methodenwechsel und Folge-Neuberechnung; Ausgabe-/Einnahmevorzeichen nachvollziehbar; Zuweisung über verfügbares Geld abgewiesen.
- Prüfungen: Fachreferenzen, Berichtssummen gegen Einzelbuchungen, UI Monatswechsel/Undo/Prognose, Leistungsdatensatz.
- Prüfbelege: noch keine.

## P7 — Familienfinanzen lokal

- Status: offen. Voraussetzung: P6.
- Teilaufgaben: [P7.1–P7.7](p7-family.md) in Reihenfolge; Gesamtabschluss erst nach allen Teilabnahmen.
- Schritte: Haushalte und fachliche Teilnehmer ohne eigene Anmeldung oder Benutzerkonto; Policies und freiwillige Einkommen; eingefrorene Anteile und Restcent; SharedExpense mit beiden Quellen/Erstattungswegen; Beiträge/Settlements/Eigenanteilsverrechnung; Reserve und kumulative Refunds; Veröffentlichungsvorschau/privater Link; Guthaben-/Ausgleichsberichte und Vorschlagszahlungen.
- Ergebnis: vollständiger Familienalltag lokal, identische Fachregeln für den späteren verschlüsselten Mehrgerätebetrieb auf Clients.
- Verträge: participant/allocationPolicy/sharedExpense/contribution/settlement/advanceOffset/expenseRefund; Budgetreserve; private Veröffentlichung.
- Abnahme: F07–F13/F16; Salden einschließlich H summieren null; Reserve unabhängig von Beitragssaldo; Ausgaben/Erstattung genau einmal; private Felder gelangen nicht in gemeinsamen Snapshot; historische Policies unverändert.
- Prüfungen: Restcent-/Rückerstattungs-Eigenschaften, private Link-/Anteilskorrektur-/Löschfehlfälle, komplette Haushaltsabläufe in UI.
- Prüfbelege: noch keine.

## P8 — Server und Identitäten

- Status: offen. Voraussetzung: P7.
- Teilaufgaben: [P8.1–P8.7](p8-server.md) in Reihenfolge; vollständige Mehrgeräte-Syncabnahme folgt in P9.
- Schritte: Server-CiphertextStore und öffentliche Berechtigungsprüfung; externe OIDC-/gleichwertige Identitätsanbindung, Sessions/CSRF und Provider-Rollenzuordnung; keine lokalen Passwörter, Benutzerkonten oder Setupkonten; getrennte Tresorentsperrung; öffentliche Identitäten/Gerätezertifikate, KeyRosters/Grants, Fingerprintprüfung und Geräteaufnahme; pending_key_grant/Bestätigung, Widerruf und Rotation; OS-Keyring, Verwaltungs-API/Health/Meta. Keine Appcodesignatur/Attestierung als Zugriffsvoraussetzung.
- Ergebnis: abgesicherte Zuordnung externer Identitäten, Geräte und Rollen für mehrere Familien; noch keine vollständige Multi-Client-Syncabnahme.
- Verträge: API-Verwaltungsendpunkte, Rollenmatrix, Session-/Einladungsregeln.
- Abnahme: Fremd-IDs geschützt, letzter admin bleibt; Authreplays abgewiesen; Änderungen beim Identitätsanbieter entschlüsseln keine Finanzdaten; authentifizierte Clients unabhängig von Appsignatur zugelassen; C04–C08/C10–C11; keine privaten Keys auf Server; sichere Linux-Keyringalternative.
- Prüfungen: vollständige Auth-/Zugriffsmatrix, OIDC-Providerinteroperabilität, echte Desktopkopplung, CSRF-/Origin-/Rate-Limittests.
- Prüfbelege: noch keine.

## P9 — Zusammenarbeit und Synchronisierung

- Status: offen. Voraussetzung: P8.
- Teilaufgaben: [P9.1–P9.6](p9-sync.md) in Reihenfolge; verschlüsselter Entwurfsexport für Rechte-/Epochenfehler bereits hier, vollständige WIMM-Sicherung in P10.
- Schritte: verschlüsselte signierte Änderungssets/Snapshots, CAS-Handles und Receipts/Changes; Client-Fachvalidierung nach Entschlüsselung; Scheduler/Retry/abhängige Entwürfe/Konflikte; Hash-/Roster-/K-Versionprüfung und Quarantäne; atomare Mitgliedsrotation; getrennte private Veröffentlichungen; verschlüsseltes Onboarding. Keine serverseitigen Finanzfachhandler.
- Ergebnis: mehrere Geräte arbeiten offline weiter und konvergieren ohne stilles Überschreiben; private und gemeinsame Daten bleiben getrennt.
- Verträge: Operationsformat, Cursor/Epoche, Konflikt-/Receiptstatus, UPDATE_REQUIRED.
- Abnahme: S04–S15 und drei Clients mit privaten/gemeinsamen Bereichen; doppelte Requests unschädlich; fremde Epoche kein Replay; blockierte Vorgänger blockieren nur Abhängige; Entwürfe exportierbar.
- Prüfungen: S04–S15 sowie C01–C03/C05–C09/C12; Netzwerkabbrüche, Revisionen, entschlüsselte Snapshotgleichheit; Serverdump ohne Finanzklartext, viewer-Fälschung und Keyrotation.
- Prüfbelege: noch keine.

## P10 — Sicherung und Betrieb

- Status: offen. Voraussetzung: P9.
- Teilaufgaben: [P10.1–P10.6](p10-backup.md) in Reihenfolge; Gesamtabschluss erst nach allen Teilabnahmen.
- Schritte: verschlüsselter WIMM-/Draftscontainer, clientseitige Validierung/Referenzabbildung, Schlüsselrecovery; verschlüsselte Desktop-/Chiffratserverbackups, Retention/Migration; clientbestätigter Snapshot-/Vollrestore ohne serverseitige Signatur-/Epochenfälschung; Docker/HTTPS/Updates gemäß Betriebsvertrag.
- Ergebnis: getesteter Schutz gegen Verlust und reproduzierbarer Self-Hosting-Betrieb.
- Verträge: Exportmanifest, Limits, Restore/Revisions-/Epochenregeln und WIMM-Konfiguration.
- Abnahme: Export/Restore bewahrt alle Fachprojektionen; fehlerhafte Datei verändert nichts; Vollrestore widerruft Sessions; tägliche Rotation behält letzte funktionierende Sicherung; kein ready während Migration/Restore; RPO/RTO-Prüfziele gemessen.
- Prüfungen: C10–C14, verschlüsselte Nutzer-/Vollrestores, Altclientwrites, verlorene Keys/falsche Passphrase, Disk-full/Retention/Migrationsabbruch und Docker-Neustart.
- Prüfbelege: noch keine.

## P11 — Veröffentlichung

- Status: offen. Voraussetzung: P10 und Abnahme aller vorherigen Pakete.
- Teilaufgaben: [P11.1–P11.6](p11-release.md) in Reihenfolge; Vorbereitung und tatsächliche Veröffentlichung getrennt nachweisen.
- Schritte: Nutzer-/Installations-/Backup-/Schlüsselrecoveryanleitungen; Plattformbuilds/native Smokechecks; Paketcodesignierung/Notarisierung für Distribution und signierter Updater, unabhängig vom Clientvertrauen; AGPL-Sourcearchive/Fremdhinweise; C01–C14 und unabhängige Protokoll-/Bindingprüfung vor öffentlichem Sicherheitsrelease.
- Ergebnis: öffentliche reproduzierbare Distribution pro nachweislich geprüfter Plattform.
- Verträge: Lizenz, Releaseversion/Commit, Source-URL, signierter Updatekanal, unterstützte Plattformliste.
- Abnahme: passende Sourcearchive verfügbar, Installationspakete starten und stellen Daten wieder her; verfügbare native Plattformprüfungen belegt; fehlende Signierung/Tests verhindern nur betroffene Distribution, kein fingierter Gesamtrelease.
- Prüfungen: frischer Installationslauf und Sourcebuild, Update mit Datenmigration, Quellarchiv entspricht Binary/Dockerbuild; Releasecheck in Betrieb.
- Prüfbelege: noch keine.

## Übergabe nach einem Paket

Status und Nachweise aktualisieren, relevante Docs anpassen, gezielte Prüfungen ausführen und nach jedem abgeschlossenen Abschnitt einen Zwischencommit erstellen. Der Commit enthält zusammengehörige Änderungen und keine fremden/unverwandten Dateien. Für den nächsten Agenten verbleibende Einschränkungen und erstes nächstes Paket nennen. Keine automatische Veröffentlichung durch Abschluss von P11 ohne entsprechenden Auftrag.
