# Umsetzungsplan und Agentenübergabe

## Auftrag und Statusführung

Auf ausdrücklichen Nutzerauftrag vom 8. Oktober 2026 ist die Pause zum Rechnerwechsel beendet. Die systematische Behebung der offenen GitHub-Issues wird ausschließlich in der aktiven Arbeitskopie fortgesetzt; direkte eigene Commits und Pushes auf `main` sind erlaubt. Die [historische Übergabe](handoffs/issues-2026-10-08-rechnerwechsel.md) nennt den Ausgangsstand `cc7b90f`; aktuelle Belege und Blockaden stehen in den jeweiligen Issues. P6–P11 erhalten dadurch keine zusätzliche Produktfreigabe. K01–K11 sind durch den anschließenden ausdrücklichen Nutzerauftrag zu #91 freigegeben.

Der anschließende ausdrückliche Auftrag „PLEASE IMPLEMENT THIS PLAN“ vom 8. Oktober 2026 bestätigt die vollständige Umsetzung aller lokal bearbeitbaren offenen Issues in der vereinbarten Reihenfolge. Die anschließende Nutzervorgabe verbietet unsafe in eigenem Rust-Code; alle eigenen Rust-Crates und Buildscripts erzwingen `#![forbid(unsafe_code)]`. Rust-Komponenten müssen zusätzlich direkt aus Rust getestet werden. Der Nutzer bestätigt ausdrücklich, dass dieses verhindernde Attribut erlaubt ist, und verlangt die globale Sperre, wo möglich: Workspace-Cargo-Lint mit Vererbung in jedem eigenen Paket plus separate Tauri-Cargo-Regel. Nutzerantwort vom 9. Oktober 2026: zunächst sämtliche Arbeiten auf diesem Mac umsetzen und fehlende Plattformbelege ausdrücklich offen halten. Nur der aktuelle Mac steht als Zielsystem zur Verfügung; echte Windows-/Linux-/Intel-Mac-/iOS-Abnahmen bleiben bis zu passenden Systemen offen. Neue P6–P11-Produktfunktionen, native Produkt-Apps und Veröffentlichungen bleiben ausgeschlossen.

Aktuelle Freigabe: D0, D1 und D2 sind abgeschlossen. P1, P2 und P3 sind nach der [Nachprüfung vom 8. Oktober 2026](handoffs/p1-p3-review-2026-10-08.md) erneut in Arbeit: Herkunftsregistergrundlage, verbleibende Fachabnahme und zehn Speicherdeltas verhindern die vollständige Abnahme; [Gesamtübersicht #87](https://github.com/mpwg/WiMM/issues/87) führt die Einzelissues und vorhandene native Plattformdeltas. Der Nutzerauftrag vom 8. Oktober 2026 umfasst die systematische Behebung der offenen Issues und das Schließen erfüllter Issues. Die Fachkorrekturen werden mit aktuellen Belegen in #87 verfolgt; vollständige gemeinsame Adapter- und Plattformabnahmen stehen noch aus. P4 besitzt dokumentierte Implementierungsfreigaben und Teilimplementierungen. P4.1 sowie P4.2.1 bis P4.2.7 sind erneut vollständig abgenommen; P4.3.1–P4.3.8 sind ebenfalls vollständig abgenommen; P4.4 und P4.5.1–P4.5.6 sind ebenfalls abgenommen. P4.6 ist ausdrücklich freigegeben und in Arbeit; verbleibende Abnahmezellen stehen in der [Kriterienmatrix](handoffs/p4-6.md). Zusätzlich ist T1 zur Toolkonfigurationsmodernisierung ausdrücklich freigegeben.

Statuswerte: `offen`, `in Arbeit`, `blockiert`, `erledigt`. Blockiert benötigt konkrete fehlende Voraussetzung und nächste Handlung. Bei Implementierungsfreigabe das erste offene Paket mit erfüllten Voraussetzungen bearbeiten. Unteraufgaben in Reihenfolge; keine Grundsatzentscheidungen aus dem Konzept neu öffnen. Prüfbelege und notwendige Abweichungen direkt beim Paket ergänzen.

Seit Nutzerauftrag vom 8. Oktober 2026 führt GitHub den aktuellen Bearbeitungsstand offener Deltas. Fortschritt, Blockaden und Prüfbelege direkt im jeweiligen Issue pflegen; diese Datei behält Auftrag, Freigaben und zusammengefassten Paketstatus. Kriterienmatrizen dokumentieren Abnahmesnapshots mit Issueverweisen. Für P4 ist [Übersicht #57](https://github.com/mpwg/WiMM/issues/57) der Einstieg; das Anlegen eines Issues ändert keine Produktfreigabe.

## K — Rust-Fachkern und SQL-Portabilität

- Status: in Arbeit (Implementierungsfreigabe K01–K11 am 8. Oktober 2026); Konzeptdokumentation und Issueanlage zuvor abgeschlossen.
- Freigabe: ausdrücklicher Nutzerauftrag vom 8. Oktober 2026: „ok. mach so weiter. der auftrag für #91 ist hiermit erteilt“. Er umfasst die Umsetzung und kriteriumsgerechte Abnahme von K01–K11. Rust ist das Ziel des gemeinsamen Fachkerns; SQL-Austauschbarkeit betrifft den Server, lokale Clients behalten SQLite beziehungsweise IndexedDB.
- Voraussetzungen: aktuelle aktive Arbeitskopie, bestehende Fach-/E2EE-Verträge und geprüfte GitHub-Duplikate; bestehende Freigaben für P1–P11 werden nicht erweitert.
- Ergebnis: [Gesicherte registrierte Indexmigration und aktuelle tatsächliche SQLite-/IndexedDB-Abfragebasis #82/#83](handoffs/storage-index-migration-2026-10-09.md); #84/#86/#85 und Produktstartkoordination K05 folgen. [K04-Geld-/Kalenderprimitive sowie Bestands-/Referenzvalidierung, Projektionen und einfache Stammdaten-/Revisionshandler und Buchungen mit Finanz-CAS und atomarer Kontoeinstieg, Transfers, Abgleich, Empfängermerge und Fälligkeitsberechnung mit nativen Rust-Assertions als geprüfte Migrationsabschnitte](handoffs/k04-2026-10-08.md), K04 mit vollständiger vorhandener Fachengine und nativer/sprachübergreifender Abnahme erledigt; K05-Produktumschaltung bleibt offen. [K02-Anwendung einschließlich Profil-/Sitzungskoordination und App-Composition vollständig abgenommen](handoffs/k02-2026-10-08.md); alle fünf #93-Kriterien mit aktuellen Entwicklungs-/Produktions-/Offlinebelegen erfüllt. [K03-Rust-/WASM-/Sprachbindinggrundlage](handoffs/k03-2026-10-08.md) mit 25 identischen Fällen pro tatsächlich ausgeführter Laufzeit; [K01-Vertragsspezifikation](core-contracts.md) und plattformfreie Fach-/Anwendungsports in contracts; [Portabilitätskonzept](core-and-sql-portability.md), ADR-042–ADR-044, abgestimmte Architektur und [Gesamtübersicht #91](https://github.com/mpwg/WiMM/issues/91) mit elf Einzelissues #92–#102 und deren Voraussetzungen/Abnahmekriterien.
- Verträge: Architektur, Fachmodell, Datenmodell, E2EE, P8-/P9-Speicher- und Transportgrenzen. Bestehende lokale Speicherdeltas #77/#82/#85 behalten ihre Zuständigkeit.
- Abnahme: aktuelle Kriterien von #91 und den elf Einzelissues; gemeinsame Rust-/WASM-/Sprachbindings, vorhandene Finanzregeln, Web-/Tauri-Umschaltung, drei echte SQL-Serveradapter, alle sechs Datenbankwechsel und E2EE-/Kompatibilitätsnachweise.
- Prüfungen: Dokumentationsvalidator, Paketgraph, Whitespace-/Freigabeprüfung und Rücklesen der angelegten Issues.
- Prüfbelege: [K01-Abnahme vom 8. Oktober 2026](handoffs/k01-2026-10-08.md): 16 Vertrags-/94 Fach-/26 Speicher-/40 UI-/Profiltests, 20 native SQLite-Contractfälle und 58 echte IndexedDB-Ausführungen sowie reine Vertragstypprüfung, Typecheck/Lint/Paketgraph und Webbuild bestanden. Historische Konzeptbelege: Dokumentationsvalidator, drei Dokumentationsvalidatortests, Paketgraph und Whitespaceprüfung bestanden. Alle zwölf GitHub-Issues mit Titel, offenem Zustand, exaktem Inhalt, Freigabegrenzen und gegenseitigen Abhängigkeitslinks rückgelesen. Konzeptzwischencommit `2cb536d`; Trackingabschluss im nachfolgenden Dokumentationscommit. Diese historischen Konzeptprüfungen sind keine Rust-/WASM-/Native-Abnahme.
- Einschränkungen: K01 ist als Vertragsgrundlage, K02 als vollständig ausgelagerte Anwendung und K03 als tatsächlich ausgeführte Bindinggrundlage abgenommen; K04 ist vollständig abgenommen; Produktumschaltung K05 und die lokalen Speicher-/Migrationsvoraussetzungen bleiben offen. P6–P11-Funktionen, neue native Produkt-Apps, Clusterbetrieb und Veröffentlichungen bleiben gesonderte Aufträge. K06–K10 folgen als eigener Serverpersistenzstrang; sie blockieren die lokale Kernumstellung nicht.
- Bearbeitungsfolge gemäß anschließendem ausdrücklichem Gesamtplan: abgenommene K01–K04 → gesicherte Migration #82/#78/#79 → Indizes, Persistenz und Referenzprüfung #83/#84/#86 → gemeinsame Adapterabnahme #85/#77 mit aktueller Nachprüfung #75/#80/#81 → K05/#96 → P5-Funktionsdeltas #58–#62 → Herkunftsregister #72 → Serverpersistenz #97–#100 → SQL-Wechsel #101 → verfügbare P4-/P5-Abnahmen und Vorbereitung fehlender Zielsysteme → Gesamtübersichten einschließlich K11. Fehlende Zielsysteme blockieren nur ihre eigenen tatsächlichen Plattformnachweise.

## Teilaufgaben und Bearbeitungsfolge

Abnahmesnapshot vom 8. Oktober 2026: #73, #74 und #76 sind behoben; #80 und #81 besitzen nach dem Rechnerwechsel die [aktuelle gemeinsame Speicherabnahme](handoffs/storage-2026-10-08-fortsetzung.md); #75 besitzt nun auch den gemeinsamen echten SQLite-/IndexedDB-Mergebeleg als Sollbasis für K04. Maßgeblich für die weitere Bearbeitung sind die Kriterien und Voraussetzungen der GitHub-Issues.

Die Teilpläne konkretisieren die Pakete nach dem Muster von [P1](p1-foundation.md). Jedes Paket beginnt nach Abnahme seines Vorgängers und eigener Implementierungsfreigabe. Pro Teilaufgabe Status, Ergebnis und Prüfbelege im Teilplan pflegen, den Gesamtstatus hier; die bestehenden Paketabnahmen bleiben verbindlich. P2 ist nach der aktuellen Nachprüfung erneut in Arbeit. Der Nutzer hat am 3. Oktober 2026 den vollständigen Abschluss von P3 freigegeben.

| Paket | Teilaufgaben | Ergebnis der Schrittfolge |
| --- | --- | --- |
| P1 | [P1.1–P1.6](p1-foundation.md) | Projektgrundlage; Herkunftsregisterdelta offen |
| P2 | [P2.1–P2.6](p2-domain.md) | Primitive → Aggregate → Stammdaten → Buchungen → Transfer/Abgleich → Projektionen/Abnahme |
| P3 | [P3.1–P3.6](p3-storage.md) | Speicherverträge → Tresor → SQLite → IndexedDB → Orchestrierung → Offline-Abnahme |
| P4 | [44 kleine Unteraufgaben in P4.1–P4.6](p4-ui.md#kleine-arbeitsaufträge-und-abschlussregeln) | jede Funktion und jeder Nachweis einzeln; verbleibend P4.5.7 und offene P4.6-Abnahmezellen |
| P5 | [P5.1–P5.6](p5-import.md) | Parserbasis → CSV → CAMT/OFX/QFX → Übernahme → Regeln → Dauerzahlungen/Abnahme |
| P6 | [P6.1–P6.6](p6-budget.md) | Methodenhistorie → Plan → Umschläge → Ziele → Berichte → Budgetabnahme |
| P7 | [P7.1–P7.7](p7-family.md) | Teilnehmer → Anteile → Zahlungen → Reserve → Refunds → Veröffentlichung → Familienabnahme |
| P8 | [P8.1–P8.7](p8-server.md) | CiphertextStore → OIDC → Kopplung → Identitäten → Grants → Rotation → Zugriffsmatrix |
| P9 | [P9.1–P9.6](p9-sync.md) | Transport → Push/Pull → Scheduler → Validierung/Konflikte → Onboarding → Mehrgeräteabnahme |
| P10 | [P10.1–P10.6](p10-backup.md) | Container → Clientrestore → Backups → Serverrestore → Self-Hosting → Betriebsabnahme |
| P11 | [P11.1–P11.6](p11-release.md) | Anleitungen → Plattformen → Signierung → Quellarchive → unabhängige Prüfung → Releaseübergabe |

P4 enthält sechs Sammelaufgaben mit acht noch offenen Unterabnahmen; P5–P11 behalten ihre bisherigen Teilpläne. Bei fehlenden Plattformen oder Signierungsgeheimnissen nur die betroffene Prüfung/Distribution blockieren und unabhängige bereits freigegebene Arbeit fortsetzen; keine Abnahme überspringen oder erledigt behaupten. P11-Abschluss erteilt keine Veröffentlichungsfreigabe.

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

## T2 — Befehle zum Aufräumen des Workspace

- Status: erledigt (5. Oktober 2026).
- Freigabe: ausdrücklicher Nutzerauftrag, Aufräumbefehle für den großen Workspace hinzuzufügen.
- Voraussetzungen: vorhandener pnpm-Workspace und lokale Build-/Prüfartefakte.
- Schritte: Speicherverbrauch prüfen; getrennte Clean-Befehle mit Vorschau ergänzen; Löschgrenzen testen und Bedienung dokumentieren.
- Ergebnis: `clean`, `clean:preview`, `clean:tests`, `clean:deps` und `clean:all`; Standard entfernt insbesondere den rund 15 GB großen Desktop-Rust-Buildordner. Die vorhandenen Build-/Prüfartefakte wurden nur in der Vorschau erfasst.
- Verträge: [Entwicklungsanleitung](development.md#workspace-aufräumen); keine Änderung an Anwendung, Fachverträgen oder Datenformaten.
- Abnahme: Vorschau verändert nichts; Build-, Test- und Abhängigkeitsbereinigung getrennt verfügbar; Quellcode, Lockfiles, Git und Finanzdaten bleiben erhalten; versionierte Ziele und Symlink-Eltern führen vor Löschungen zum Abbruch.
- Prüfungen: fünf synthetische Clean-Tests innerhalb der Arbeitskopie, Vorschau im echten Workspace, Dokumentationsvalidator, Lint und Whitespaceprüfung.
- Prüfbelege: `pnpm test:clean` besteht mit fünf Tests auf macOS arm64; tatsächliche Löschung nur in temporären Testverzeichnissen. `pnpm clean:preview` zeigt ausschließlich erwartete Artefakte. `pnpm check:docs`, `pnpm lint` und `git diff --check` bestanden.
- Einschränkungen: Windows/Linux nicht ausgeführt. Testergebnisse einschließlich lokaler Abnahmebelege werden nur mit `clean:tests` oder `clean:all` entfernt; vorher sichern. Nach Abhängigkeitsbereinigung ist eine erneute gesperrte Installation nötig.

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

## D6 — Pull-Request-Pflicht und Schutz von `main`

- Status: in Arbeit (PR [#14](https://github.com/mpwg/WiMM/pull/14) offen).
- Freigabe: ausdrücklicher Nutzerauftrag vom 5. Oktober 2026 zur Dokumentation einer neuen Grundregel.
- Voraussetzungen: bestehende Commit-, Push- und GitHubregeln in AGENTS.md, Agentenleitfaden und Entwicklungsleitfaden abgeglichen.
- Schritte: PR-Pflicht und Verbot direkter Commits/Pushes auf `main` in zentralen Arbeitsregeln, Agentenhilfen und PR-Vorlage konsistent festhalten; ADR dokumentieren.
- Ergebnis: sämtliche Repositoryänderungen werden über Pull Requests integriert; Themenbranch-Pushes dienen ausschließlich dem jeweiligen Pull Request.
- Verträge: ADR-034, `AGENTS.md`, Agentenleitfaden, Entwicklungsleitfaden, Copilot-Anweisungen, `wimm-workflow` und GitHub-PR-Vorlage.
- Abnahme: keine verbindliche Anleitung erlaubt direkte Integration auf `main`; Hinweise zum Themenbranch-Push und zur nötigen GitHub-Branchschutzkonfiguration sind eindeutig.
- Prüfungen: Dokumentationsstruktur, relative Links und Whitespace; Repositoryeinstellungen separat verifizieren, falls autorisiert.
- Prüfbelege: `git diff --check` bestanden; die verbindlichen Arbeitsanweisungen und PR-Vorlage wurden auf konsistente PR-Pflicht, Themenbranch-Pushes und das Verbot direkter Commits/Pushes auf `main` abgeglichen. PR #14 ist offen. Repository-Branchschutz ist nicht geprüft oder geändert.
- Einschränkungen: GitHub-Branchschutz ist hier nicht geprüft oder geändert.

## P1 — Projektgrundlage

- Status: in Arbeit (erneute Nachprüfung vom 8. Oktober 2026; historische Abnahme vom 3. Oktober eingeschränkt). Freigabe: Nutzerauftrag vom 2. Oktober 2026 für den Beginn mit P1.1. Voraussetzung: D0 erledigt.
- Fortschritt: P1.1 bis P1.6 sind erledigt.
- Teilaufgaben: [P1.1–P1.6](p1-foundation.md) in Reihenfolge; Gesamtabschluss erst nach allen Teilabnahmen.
- Schritte: stabile kompatible Toolchain prüfen; Workspace einschließlich `packages/crypto`; TS strict/ESM; Fach- und öffentliche EncryptedOperation-/KeyRoster-Verträge trennen; gepflegte libsodium-Bindung und RFC-8785-Bibliothek; Crypto-Testvektoren; leere Apphüllen/Lockfiles/CI. Keine Klartext-FinanzAPI als Zwischenlösung.
- Ergebnis: reproduzierbare Entwicklungsbasis, ohne bereits vollständige Finanzfunktionen zu behaupten. Rootbefehle `dev:web`, `dev:server`, `dev:desktop`, `typecheck`, `test` und `build` sind vorhanden; `test:e2e` folgt mit den E2E-Tests.
- Verträge: Paketabhängigkeiten, gemeinsame Primitive/Versionen, PlatformServices, künftige Storage-Ports.
- Abnahme: frischer Checkout installierbar, Typ-/Buildprüfungen laufen; Web-/Tauri-Hülle startet; Backendhealth liefert korrekte Zustände. Versionskombination und getestete Betriebssysteme festgehalten. AGPL-Metadaten, Herkunftsregistergrundlage und Sourcehinweis angelegt.
- Prüfungen: CI lokal reproduzieren, Paketgraph auf verbotene Imports prüfen, Buildsmokechecks; keine Secrets erforderlich.
- Prüfbelege: P1.1: [Versions- und Lizenzbasis](technology-baseline.md) am 3. Oktober 2026 anhand offizieller Release-, Registry- und Tauri-Quellen geprüft; Tauri 2.12.1 wegen der festgelegten sieben Tage Reifezeit auf die aktuelle reife 2.11-Kombination korrigiert. P1.2: Workspace und Lockfile angelegt; Installation mit unverändertem Lockfile, TypeScript und Paketgraph damals im OrbStack-Dev-Container geprüft. Die VS-Code-Dev-Containers-Erweiterung 0.469.0 hat die damalige Konfiguration einschließlich `postCreateCommand` erfolgreich gestartet. P1.3: öffentliche Zod-Vertragshüllen, Fehler- und Porttypen angelegt; vier gezielte Vertragstests sowie TypeScript und Paketgraphprüfungen damals im Container bestanden. Ein absichtlich verbotener Import wurde erkannt und entfernt. Die Containerumgebung wurde inzwischen entfernt. P1.4: `libsodium-wrappers-sumo` 0.8.4 und `canonicalize` 5.1.0 gekapselt; sieben synthetische Binding-/Manipulationstests sowie Vertrags-, TypeScript- und Paketgraphprüfungen mit Node 24.21.0 bestanden. P1.5: Web-, Server- und Tauri-Hülle mit sichtbarem Source-/Lizenzhinweis und Crypto-Binding angelegt. Die zwei Servertests, TypeScript, Paketgraph, Vite-Builds und der native macOS-arm64-Tauri-Build mit Rust 1.99.0 aus Homebrew bestanden; alle drei Hüllen starteten lokal. P1.6: gemeinsame Markdown-/JSON-/YAML-/Linkprüfung, optionale indexbasierte Hookprüfung und Ubuntu-CI erstellt; positiver/negativer Validator-, Hook-, Installations-, Typ-, Paketgraph-, Test- und lokaler Buildnachweis erbracht. Kein Remote-Lauf oder Push. Keine Finanzfunktion, Finanz-HTTP-API oder Finanzdaten vorhanden. Windows und E2E bleiben ungeprüft. Wartung am 3. Oktober 2026: Dependabot prüft npm/pnpm, Cargo und GitHub Actions täglich; npm/pnpm-Versionsupdates warten sieben Tage. `@types/node` 26.6.3, Actions v7/v6 und die vollständige lokale CI-Prüfserie bestanden. `skipLibCheck` übergeht ausschließlich die inkompatible Fremddeklaration von `thread-stream` mit Node-26-Typen. CI-Nachbesserung am 4. Oktober 2026: Lauf 37188501893 scheiterte an fehlendem Playwright-Chromium; Browserinstallation samt Systemabhängigkeiten wurde ergänzt. CI-Optimierung am 4. Oktober 2026: Playwright-Chromium und Rust/Cargo-Buildartefakte werden mit getrennten, passenden Schlüsseln gecacht; Browser-Systemabhängigkeiten bleiben auf jedem frischen Runner installiert. Vollständiges `pnpm check:ci` in der aktiven macOS-arm64-Arbeitskopie bestanden (Dokumentation, Paketgraph, TypeScript, 80 Unit-/Service-Worker-Tests, 14 Web-/Desktop-UI-Prüfungen sowie Builds einschließlich Tauri). Nachprüfung des Remote-Laufs 37190134465: Ubuntu 24.04 brach nach 20 Minuten während der Playwright-Installation des vollständigen 167-MiB-Chromium-Archivs ab; Tests begannen nicht. Die Installation hing beim Entpacken reproduzierbar auch lokal mit Playwright 1.58.2 unter Node 26.10.0. Playwright hat den Hänger für Versionen unter 1.60.0 dokumentiert; ab 1.60.0 behoben ([Playwright-Fehlerbericht](https://github.com/microsoft/playwright/issues/40998)). `@playwright/test` ist auf die bereits in der [Versionsbasis](technology-baseline.md) festgelegte Version 1.63.0 aktualisiert. CI folgt Playwrights GitHub-Actions-Empfehlung und installiert nur Chromiums Headless-Shell samt OS-Abhängigkeiten (`pnpm exec playwright install --with-deps --only-shell chromium`); Browsercache entfernt, Cargo-Cache bleibt. Frische lokale Headless-Shell-Installation und beide UI-Suiten mit Node 26.10.0 bestanden. Vollständiges `pnpm check:ci` anschließend bestanden (80 Unit-/Service-Worker-Tests, 14 UI-Prüfungen und alle Builds einschließlich Tauri). Remote-Neulauf mangels Push noch offen.

- Aktuelle Nachprüfung: [Kriterienmatrix P1–P3](handoffs/p1-p3-review-2026-10-08.md), [Gesamtabnahme #87](https://github.com/mpwg/WiMM/issues/87). Frühere Prüfbelege bleiben historische Nachweise; der Paketabschluss ist erneut offen.

## P2 — Fachkern

- Status: in Arbeit (erneute Nachprüfung vom 8. Oktober 2026; historische Abnahme vom 3. Oktober eingeschränkt). Voraussetzung: P1.
- Fortschritt: P2.1 erfüllt; P2.2–P2.6 wegen reproduzierter Referenz-/Schutzregeldefekte erneut in Arbeit.
- Teilaufgaben: [P2.1–P2.6](p2-domain.md) in Reihenfolge; Gesamtabschluss erst nach allen Teilabnahmen.
- Schritte: exakte Geld-/Datumsparser; Aggregate/Revisionstypen; Konten/Kategorien/Empfänger; Buchungen/Splits/Opening; Transfers und Kontenabgleich; pure Befehlshandler mit Änderungssets; Projektionen für Salden und Einnahmen/Ausgaben. Reconciled-Lock und Referenzarchivierung berücksichtigen.
- Ergebnis: plattformfreie Fachlogik ohne Datenbank/React/HTTP, die sämtliche Eingabe- und Summeninvarianten prüft sowie Saldo- und Verbrauchsprojektionen reproduzierbar aus vollständigen Aggregaten ableitet.
- Verträge: Datenmodell und Befehle account/category/payee/transaction/transfer/reconciliation.
- Abnahme: Referenzfälle F01–F03 und Geld-/Datums-/Abgleichfehlfälle bestehen; Updates ohne alle erwarteten Revisionen abgewiesen; keine Teiländerungssets.
- Prüfungen: deterministische Vitest-Fachtests sowie Eigenschaften für Summen, Transfererhaltung und Ganzzahlüberlauf.
- Prüfbelege: P2.1: Dezimalgeld-, sichere Summen-/Zwischenwert- und Kalenderprimitive im plattformfreien Paket `@wimm/domain` umgesetzt. 26 neue Fachtests sowie die vier vorhandenen Vitest-Suiten mit insgesamt 39 Tests bestanden; TypeScript, Paketgraph und positive/negative Dokumentationsprüfung bestanden. Nach Aktualisierung auf Node 26.10.0 und pnpm 12.8.1 bestanden außerdem die gesperrte Installation und `pnpm check:ci`. P2.2: vollständige Aggregate, Revisionskopfstände, atomare Änderungsmengen und injizierte ID-/Zeitgeber ergänzt; die Fachtests decken Mehraggregat- und Fehlpfade ab. P2.3: Konten, Kategorien und Empfänger einschließlich atomarer Empfänger-Merges ergänzt. P2.4: vollständige Buchungen, Splits, Anfangsbestandsregeln und Tombstones ergänzt; 43 Domänentests und `pnpm check:ci` bestanden. P2.5: atomare Umbuchungen mit Gegenbuchungen, Budgetgrenzen und Kontenabgleich ergänzt; 47 Domänentests und `pnpm check:ci` bestanden. P2.6: reine Saldo- und Verbrauchsprojektionen mit F01/F03, Erstattungs- und Neuaufbaugleichheit ergänzt. Die P2-Gesamtabnahme mit 50 Domänentests und vollständigem `pnpm check:ci` ist bestanden. Details und Teilnachweise stehen im [P2-Teilplan](p2-domain.md).

- Aktuelle Nachprüfung: [Kriterienmatrix P1–P3](handoffs/p1-p3-review-2026-10-08.md), [Gesamtabnahme #87](https://github.com/mpwg/WiMM/issues/87). Frühere Prüfbelege bleiben historische Nachweise; der Paketabschluss ist erneut offen.

## P3 — Speicher und Offlinebasis

- Status: in Arbeit (erneute Nachprüfung vom 8. Oktober 2026; historische Abnahme vom 3. Oktober eingeschränkt). Voraussetzung: P2 erledigt.
- Teilaufgaben: [P3.1–P3.6](p3-storage.md) in Reihenfolge; Gesamtabschluss erst nach allen Teilabnahmen.
- Schritte: Client-Speicheradapter/Rustbatch-Brücke, Transaktionen/Projektionen/Entwürfe; lokaler verschlüsselter UserVault, unabhängige Bereichsschlüssel, Entsperrung/Rettungscode und Schlüsselports; keine persistierten Klartextkeys. Export-Snapshotport verschlüsselt. Service Worker, persistenter Browserstore und Tabkoordination.
- Ergebnis: dauerhafte lokale Datenhaltung in beiden Clients; vorbereitete Outbox ohne Netzwerkpflicht.
- Verträge: StorageAdapter, lokale Revisionen, Snapshot-/Outboxzustände; Datenmodellindizes.
- Abnahme: gemeinsame Konformitätssuite für beide Adapter; S01–S03/S14; offline Neustart ohne verlorene Buchungen; Quota/Disk-full kein Erfolg; private Profile getrennt.
- Prüfungen: echte DB-/IndexedDB-Integrationsprüfungen, Absturzpunkte in Batch-/Cursorcommit simulieren; PWA-Network-off-Neustart.
- Prüfbelege: P3.1–P3.6 mit atomarem Speichervertrag, lokalem UserVault, begrenzter SQLite-Brücke, Dexie-Adapter, Orchestrierung und Service Worker abgeschlossen. Acht Speichertests, elf Kryptotests, Service-Worker- und Rust-SQLite-Test sowie TypeScript, Paketgraph, Dokumentation, Web-/Desktopbuild und lokale CI-Prüfung bestanden. Echte Network-off-PWA- und native Disk-full-Smokechecks bleiben als explizite Plattformprüfung vor P4 offen; Details stehen im [P3-Teilplan](p3-storage.md).

- Aktuelle Nachprüfung: [Kriterienmatrix P1–P3](handoffs/p1-p3-review-2026-10-08.md), [Gesamtabnahme #87](https://github.com/mpwg/WiMM/issues/87). Frühere Prüfbelege bleiben historische Nachweise; der Paketabschluss ist erneut offen.

## P4 — Oberfläche und native App

- Status: in Arbeit. Voraussetzung: P3. P4.1 und P4.2 sind erneut vollständig abgenommen; P4.3 einschließlich aller acht Unteraufgaben ist vollständig abgenommen; P4.4 einschließlich aller sieben Unteraufgaben ist vollständig abgenommen; P4.5.1–P4.5.6 sind abgenommen, P4.5.7 ist auf macOS arm64 geprüft und wegen fehlender weiterer Plattformnachweise noch offen; P4.6 ist in Arbeit; aktuelle Teilnachweise und fehlende Abnahmen stehen in der P4.6-Kriterienmatrix.
- Teilaufgaben: [P4.1–P4.6 mit 44 kleinen Unteraufgaben](p4-ui.md#kleine-arbeitsaufträge-und-abschlussregeln); standardmäßig pro Auftrag eine Unteraufgabe einschließlich konkretem Nachweis; P4.3.1–P4.3.8 und P4.4.1–P4.4.7 wurden ausdrücklich gemeinsam beauftragt und einzeln geprüft. Nächster notwendiger Schritt: [P4.5.7](p4-ui.md#p457--native-systemintegration-je-zielsystem-prüfen) auf fehlenden Plattformen; zusätzlich die offenen [P4.6-Abnahmezellen](handoffs/p4-6.md) des ausdrücklich freigegebenen Sammelauftrags schließen. Gesamtabschluss erst nach allen Teilabnahmen.
- Schritte: Composition Root, PlatformServices, Bereichswechsel; Übersicht/Konten/Buchungslisten/Formulare; Splits/Transfer/Abgleich; virtuelle Listen; Touch-/Desktoplayout; Systemschrift/-Farbschema; native Menüs, Dialoge, Kurzbefehle und Systembrowserlinks; leer/Fehler/offline/ausstehend-Zustände.
- Ergebnis: lokal benutzbares Haushaltsbuch auf Web/PWA und Tauri, noch ohne alle Planungsfunktionen.
- Verträge: UI-Ansichten, Befehlseingaben, Dateidialog-/Menüports, Bildschirm-/Fokusregeln.
- Abnahme: neue Buchung, Transfer, Abgleich per Tastatur und Touch; alle Daten nach Neustart; Screenshots ohne Überlappung; native Dialog-/Menü-Smokecheck auf verfügbaren Zielsystemen. Fehlende Plattformprüfung konkret markieren.
- Prüfungen: Playwright für Kernabläufe und Viewports; echte Tauri-Prüfung nach [UI](ui.md), Screenreader-/Zoomsmokecheck.
- Prüfbelege: Aktueller Stand: lokaler Tresor-/Bereichseinstieg mit Rettungscode und drei UI-Tests; lokale Navigation und Stammdaten; einfache Buchungen, Anfangsbestände und exakte Zweiweg-Splits; Formulare für atomare Umbuchung und Abgleich; natives Tauri-Datei-/Bearbeiten-Menü. P4.2 ergänzt Archivierung von Konten/Kategorien und atomaren Empfänger-Merge über die bestehenden Fachbefehle sowie zwei Chromium-Playwright-Abläufe. `pnpm check:ci` bestand am 3. Oktober 2026 mit Dokumentation, Paketgraph, TypeScript, Vertrags-, Domain-, Krypto-, Speicher-, Offline-, Server- und Chromium-UI-Tests sowie Web- und Desktop-Produktionsbuild.

  P4.1 ist am 4. Oktober 2026 erneut vollständig abgenommen: Neue Haushaltsschlüssel bleiben nach Sperren/Neustart per Passphrase oder Rettungscode verfügbar. Chromium prüft Erstnutzung, Sperren/Entsperren und einen Offline-Neustart für Web und Desktop-Frontend. Zusätzlich prüft P4.1.8 die gebündelte Tauri-Anwendung auf macOS arm64 mit echter nativer Interaktion: Tresor und Haushalt anlegen, sperren, Laufzeit neu starten und beide Entsperrwege erreichen wieder den Haushalt. Details stehen in der [P4.1.8-Übergabe](handoffs/p4-1-8.md). P4.2 ist vollständig einzeln abgenommen: Konto- und Kategoriearchivierung mit Referenzen, Empfänger-Merge mit gespeicherter Buchung und echtem Chromium-Neustart, Layout/Farbschema sowie Tastaturfokus für Bereichswechsel und Stammdaten. P4.2.7 belegt auf Web und Desktop-Frontend mit realem Tabulator, Enter und Escape die Fokusfolge, sichtbare Fokuslinie und Rückkehr zum Merge-Auslöser nach Dialogabbruch; Details in der [P4.2.7-Übergabe](handoffs/p4-2-7.md). Browser-Zoom, Firefox/WebKit, Screenreader und native Desktop-Prüfungen bleiben in P4.6 separat offen. P4.3.1 ist vollständig abgenommen: F01 mit 1.100 EUR Saldo, 100 EUR Monatsausgaben und 200 EUR Monatseinnahmen sowie Betrag-/Datumsfeldfehler sind per Tastatur und Touch in Chromium auf Web und Desktop-Frontend belegt. 26 Web- und 23 Desktop-Frontendabläufe, 50 Fachtests, fünf UI-Pakettests, TypeScript, Lint, Paketgraph und beide Produktionsbuilds bestanden; Kriterienmatrix und Grenzen stehen in der [P4.3.1-Übergabe](handoffs/p4-3-1.md). P4.3.1–P4.3.8 sind ebenfalls vollständig abgenommen: freie Splits, F02, Bearbeiten/Löschen, kombinierte Filter und mobile Details, 50.000-Buchungen-Virtualisierung, kontrollierte Speicherfehler und echter Network-off-PWA-Neustart. 30 Web- und 27 Desktop-Frontendabläufe plus sechs Speicherintegrationen bestanden; aktuelle Kriterienmatrix, README und Grenzen stehen in der [P4.3-Übergabe](handoffs/p4-3.md). Die vollständige lokale Serie `pnpm check:ci` mit 85 Unit-/Service-Worker-Tests, 63 Browser-/Speicherintegrationen und Web-/Desktopbuild einschließlich Tauri bestand. Ein vorhandener zufallsabhängiger Chiffrat-Manipulationstest wurde deterministisch korrigiert; keine Kryptoänderung. P4.4.1–P4.4.7 sind am 5. Oktober 2026 einzeln vollständig abgenommen: F03/Budgetgrenzen, explizite Abgleichauswahl und Differenz, bestätigte Entsperrung/Korrektur, revisionsgeprüfte Gegenbefehle und Schutz ungespeicherter Eingaben. 53 Fachtests, neun UI-Pakettests, 32 Web- und 29 Desktop-Frontendabläufe sowie 28 Speicherintegrationen bestanden; aktuelle Kriterienmatrix, README und Plattformgrenzen stehen in der [P4.4-Übergabe](handoffs/p4-4.md). ADR-032 präzisiert Differenz null, Ausgangssaldo/CAS, Budgeteintritt mit bestätigter Geldfreigabe und gezielte Gegenbefehle. P4.5.1–P4.5.6 sind am 5. Oktober 2026 umgesetzt und abgenommen: Menüs/Kurzbefehle, echte Öffnen-/Speicherdialogports, Systembrowserlinks und begrenzte Appcommands. Der echte macOS-arm64-Smokecheck belegt Text-/Finanz-Undo, Dialogabbruch/Überschreiben/Schreibfehler, abgewiesene IPC-/Navigationsfälle und neuen Prozess unter Netzwerksperre mit 1.000 EUR gespeichertem Saldo. Ein vorhandener SQLite-Rücklesefehler und ein zeitabhängiger sauberer Formularstand wurden dabei korrigiert. README und aktuelle Kriterien stehen in der [P4.5-Übergabe](handoffs/p4-5.md). P4.5 bleibt wegen fehlender Windows-/Linux-/macOS-x86_64-Nachweise nicht vollständig abgenommen; P4.6-weitere Browser, Screenshot-/Barrierefreiheits-/Leistungs- und Plattformmatrix bleiben offen.

  Planungsänderung vom 4. Oktober 2026: Alle P4.x-Aufgaben einschließlich P4.1 sind in einzeln abnehmbare Unteraufgaben aufgeteilt. Bisherige Code-/Testbelege bleiben historische Nachweise; keine neue Unterabnahme ist durch die Aufteilung bereits erfüllt. Die neue Reihenfolge, Voraussetzungen und Nachweislücken stehen im [P4-Teilplan](p4-ui.md). Prüfung der Planungsänderung: Dokumentationsvalidator, Validator-Kontrolltests, Struktur-/ID-/Voraussetzungsabgleich und Whitespaceprüfung; Details in der [Planungsübergabe](handoffs/p4-planung.md). Keine Anwendung implementiert oder neu abgenommen.

- P4.6: Nutzerauftrag vom 5. Oktober 2026; Browser-/Viewport-/Zoom-/Leistungsprüfungen und macOS-arm64-Persistenz/Disk-full ergänzt. [Kriterienmatrix](handoffs/p4-6.md) hält Firefox, Screenreader-Ansagen, echte iOS-Geräte und verbleibende native Zielsysteme offen. P4 ist weiterhin nicht vollständig abgenommen.
- CI-Nachprüfung vom 5. Oktober 2026: GitHub-Lauf `37285669352` auf `4e1c1f7` erreicht die P4.6-Matrix, scheitert aber an vier mobilen Überlappungen und zwei Leistungsmessungen. Die Mobilansicht reserviert nun die tatsächlich gemessene Navigationshöhe einschließlich Schriftumbruch und sicherer Flächen; zwei Regressionstests erzwingen vergrößerte Buttontexte und einen Wechsel der Fensterbreite. Die Testseite prüft beim Neustart ein Startkonto statt einer zusätzlichen Vollabfrage und erzeugt gespeicherte Testdatensätze nicht erneut. Die Leistungsgrenzen von zwei Sekunden und p95 unter 100 ms bleiben unverändert; Messberichte nennen die tatsächliche Laufzeitumgebung. `pnpm check:ci` einschließlich 24 Matrix-/Leistungsfällen, Produktionsbuilds und gebautem PWA-Offline-Neustart besteht lokal auf macOS arm64; Beleg: `.toolchain-checks/ci-fix-37285669352.log`. JSON-Berichte liegen nun im Repository unter `test-results`; GitHub Actions sichert diese samt Browseraufzeichnungen bei Fehlern. Der nächste Ubuntu-Lauf und die verbleibenden P4.6-Plattformabnahmen sind weiterhin offen.

### P4 — Nachprüfung vom 8. Oktober 2026

- Nutzerauftrag: P4.* prüfen und fehlende Umsetzung beziehungsweise Abnahme benennen; keine neue Produktimplementierung.
- Ergebnis: keine fehlende P4-Fachfunktion in den ausgeführten Prüfungen festgestellt; P4 bleibt wegen offener Abnahmekriterien in Arbeit. 36/44 Unteraufgaben erledigt; P4.5.7 und P4.6.1–P4.6.7 formal weiterhin offen.
- Aktuelle Belege auf `0beb3c6` (Laufzeitcode unverändert gegenüber `880ccfa`): Typecheck, 40 UI-Unit-Tests, 60 Web-/58 Desktopfrontendfälle, 66 Speicherintegrationen, 24 Layout-/Leistungsfälle und zwei echte 200-%-Zoomfälle bestanden. Separate Produktionsbrowserabnahme: Chromium/WebKit auf beiden Frontends vier bestanden; Firefox zweimal vor Appinteraktion mit Profilstartfehler gescheitert.
- Restlücken: Firefox-Kernabläufe einschließlich dauerhaftem Neustart; beobachtete Screenreader-Ansagen; fünf Größen × Hell/Dunkel bei echtem 200-%-Zoom; aktuelle native macOS-arm64-Wiederholung sowie Windows/Linux/macOS x86_64 und echtes iOS-Safari/PWA. Der live bestätigte grüne Ubuntu-Lauf 37731984200 enthält Firefox-UX, aber nicht die separate P4.6-Produktionsbrowserabnahme.
- Vollständige Kriterienmatrix, Prüfgrenzen, Messwerte und nächste Schritte: [P4-Nachprüfung](handoffs/p4-review-2026-10-08.md). READMEs aktualisiert; keine Abschlussmarker geändert.
- Delta-Tracking auf Nutzerauftrag vom 8. Oktober: acht offene Einzelissues [#49–#56](https://github.com/mpwg/WiMM/issues/57) und Gesamtabnahme [#57](https://github.com/mpwg/WiMM/issues/57) angelegt. Firefox, Screenreader, Zoom, macOS arm64, Windows x64, Linux x64, macOS x86_64 und iOS-Safari/PWA jeweils separat; vorhandener Linuxbefund [#41](https://github.com/mpwg/WiMM/issues/41) als zusätzliche Freigabegrenze verknüpft. Aktueller Bearbeitungsstand ab sofort ausschließlich in den Issues; P4 bleibt in Arbeit.

## P5 — Import und Automatisierung

- Status: in Arbeit; P5.1–P5.6 weitgehend implementiert, aber nicht vollständig umgesetzt oder abgenommen. Nachprüfung vom 8. Oktober 2026: fünf Funktions- und acht Abnahmedeltas, Tracking in [Gesamtabnahme #71](https://github.com/mpwg/WiMM/issues/71); P5.2–P5.4 erneut in Arbeit. Voraussetzung: P4; Nutzerauftrag vom 5. Oktober 2026 erlaubt P5.1 vor Abschluss der offenen P4-Abnahmen und verschiebt Windows-/Linux-Prüfungen. Der anschließende Nutzerauftrag „Setze P5.* um“ gibt P5.2–P5.6 frei und erlaubt die Fortsetzung; die offenen P4-Abnahmen bleiben bestehen.
- Teilaufgaben: [P5.1–P5.6](p5-import.md) in Reihenfolge; Gesamtabschluss erst nach allen Teilabnahmen.
- Schritte: etablierte CSV/XML/OFX-Parser auswählen/lizenzprüfen; normalisierte Zwischenform; Mappingvorlagen und Vorschau; Dublettenentscheidungen; gruppierte Übernahme/Wiederaufnahme; Regeln mit Priorität und Stop; Schedule/Fälligkeiten/Bestätigung und Zuordnung importierter Zahlungen.
- Ergebnis: alltagstauglicher Import ohne Bankanbieter und deterministische wiederkehrende Vorschläge.
- Verträge: Formate, rule/schedule-Befehle, Quellreferenzen, Importbatchstatus.
- Abnahme: CSV/CAMT/OFX/QFX-Referenzfixtures; keine automatische Übernahme ungültiger Zeilen; Wiederimport/Bestätigung ohne Doppelbuchung; Monatsende ohne Drift; Vorschläge verändern keine Salden.
- Prüfungen: F14, Parser-/Dubletten-/Limitsuite, Replay/Abbruch eines Großimports, UI bleibt interaktiv.
- Prüfbelege: [Nachprüfung vom 8. Oktober 2026](handoffs/p5-review-2026-10-08.md): 57 Importer-/77 Fach-/40 UI-Pakettests, Typecheck, beide Produktionsfrontendbuilds, 28 P5-Speicher-/Layoutfälle, echter Parserworker, je sechs Chromium- und WebKit-Fälle pro Frontend und zwei gebaute PWA-Offlinefälle bestanden. Je vier Firefox-Profilstartfehler vor Appinteraktion; keine aktuelle native/Geräte-/Screenreader-/vollständige Zoomabnahme. Historische [Matrix](handoffs/p5.md) und [native Teilmatrix](handoffs/p5-native.md) erhalten. Konkrete Funktionsreproduktionen und fehlende Nachweise stehen in #58–#70, Gesamt-Abnahme #71. P4 bleibt offen; P6 erhält keine neue Freigabe.

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

## UX-01–UX-06 — Markante, ruhige Neugestaltung

- Status: in Arbeit; UX-01–UX-05 implementiert; UX-06 Gesamtabnahme offen.
- Freigabe: ausdrücklicher Implementierungsauftrag vom 5. Oktober 2026 für [UX-Konzept](ux-redesign.md).
- Voraussetzungen: vorhandene P4-/P5-Implementierungen; bestehende Abnahmelücken bleiben sichtbar.
- Schritte: Konzept, gemeinsame Gestaltung, Navigation/Übersicht, Buchungen/Konten, Verwaltung/Import, Gesamtabnahme; je Etappe Themenbranch und PR.
- Ergebnis: ruhige Desktop-/Mobilansichten mit Liste zuerst, gezielten Dialogen und eindeutigen Finanzbegriffen.
- Verträge: interne Ansichts-/Dialogzustände; atomarer Kontoeinstieg über Fachkern, keine Speicher-/Transportmigration.
- Abnahme: alle Alltagspfade, Fehler-/Entwurfs-/Fokusfälle, Hell/Dunkel/Zoom, Browser-/native Plattform-/Gerätematrix und Leistung.
- Prüfungen und Nachweise: [UX-Kriterienmatrix](handoffs/ux.md). Keine zusätzliche Freigabe für P6–P10.
- Ergänzung vom 5. Oktober 2026: Der alternative [klickbare UX-Flow](assets/ux-flow-konzept.html) ist auf Nutzerauftrag dauerhaft unter `docs/assets` abgelegt und im [UX-Konzept](ux-redesign.md#alternativer-klickbarer-ux-flow) erläutert. Reiner Konzeptentwurf; Paketstatus und Implementierungsfreigaben bleiben unverändert. Prüfbelege und Grenzen stehen in der [UX-Übergabe](handoffs/ux.md#ablage-des-alternativen-ux-flows).

### UX-Flow: aktuelle Umsetzung und Abnahme

- Freigabe vom 5. Oktober 2026: Gestaltung und vorhandene Funktionen nach `docs/assets/ux-flow-konzept.html`; Budget, Teilen und Familienausgleich bleiben spätere Fachpakete.
- Ergebnis: Grünakzent und warme Flächen in gemeinsamer UI, „WiMM.“, geführter Einstieg, Bereichskopf und reale Übersichtskennzahlen. Bestehende Bedien- und Fehlerprüfungen an Dialoge und Navigation angepasst; UX-Suite in reguläre Prüfung und CI aufgenommen.
- Status: Umsetzung bereit zur PR-Prüfung; UX-06 Gesamtabnahme weiterhin offen. [Aktuelle Kriterienmatrix](handoffs/ux.md#umsetzung-des-freigegebenen-ux-flows-am-5-oktober-2026) enthält konkrete Belege und fehlende Plattform-/Geräte-/Zoomprüfungen. [Laufzeitansichten](assets/ux-flow-runtime/README.md) verwenden ausschließlich synthetische Daten.

## B01 — Profilpersistenz aus Audit vom 6. Oktober 2026

- Status: A01 (#24) und A02 (#25) behoben und anhand ihrer Einzelissue-Kriterien gezielt geprüft. Die erste Gesamtsuite traf vier Q01-Fehler (#34), die durch den nachfolgenden PR-45-CI-Auftrag behoben sind; lokale Firefoxprüfung weiterhin am Profilstart blockiert. Aktuelle Nachprüfung unten. Getrennte PRs: [A01 #45](https://github.com/mpwg/WiMM/pull/45), [A02 #46](https://github.com/mpwg/WiMM/pull/46) baut darauf auf.
- Voraussetzung/Freigabe: ausdrücklicher Nutzerauftrag vom 6. Oktober 2026 für B01 aus [Auditübersicht #44](https://github.com/mpwg/WiMM/issues/44), pro Einzelissue ein Pull Request. Keine Freigabe für weitere Auditpakete oder P6–P11.
- Ergebnis A01: asynchroner atomarer Profiländerungsport mit Profilrevision, aktuellem Tresorstand, CAS, Doppelausführungs- und Sitzungsschutz; Altprofile behalten ihre Schlüssel.
- Verträge: [Profilrevision](data-model.md#lokales-profil-und-profilrevision), [Profilerweiterung](encryption.md#atomare-lokale-profilerweiterung), [B01-Prüfungen](testing.md#b01--lokale-profilpersistenz).
- Abnahme/Nachweise: Regression vor Behebung verliert zwei Bereiche; nach Behebung erhalten Zwei-Tab-/Recovery-, Speicherfehler- und veraltete Wechseltests alle bestätigten Bereiche. Aktuelle Befehle und Grenzen in [B01-Übergabe](handoffs/b01.md).
- Ergebnis A02: fehlend, geladen, beschädigt und nicht lesbar getrennt; vollständige öffentliche Profil-/Hüllenprüfung und authentifizierte Schlüsselzugehörigkeit. Genau einmal laden, kein ersetzender Erststart bei vorhandenen Fehlerständen.
- Erste Prüfbelege vor dem Review-/CI-Fix: 171 Vitesttests, fünf Rusttests, 45 Web-/43 Desktop-Frontendabläufe, Builds, 24 Layout-/Leistungsfälle, zwei gebaute PWA-Offlinefälle und Importworker bestanden. Speicherintegration 54 bestanden/vier Q01-Fehler; B01 Chromium/WebKit 14 bestanden, Firefoxstart lokal nicht möglich. Details und synthetischer Screenshot in [B01-Übergabe](handoffs/b01.md#aktuelle-gesamtnachprüfung-beider-b01-fixes).
- Nächster Schritt: A01-PR #45 prüfen/integrieren, danach A02-PR #46 auf main umstellen; weitere Auditpakete benötigen einen gesonderten Auftrag.

### B01 — PR-45-Review und CI-Nachprüfung

- Freigabe: Nutzerauftrag vom 6. Oktober 2026 zur Behebung der PR-45-Kommentare und des fehlgeschlagenen CI-/Buildlaufs; umfasst den hierfür notwendigen Q01-Fixturefix.
- Ergebnis: verständlicher Fehler bei fehlender Profilkoordination; feste Abgleichfixturezeit, ausdrücklich gefülltes Buchungsdatum und separater Zukunftsbuchungs-Negativfall. Keine Änderung an Geld-, Abgleich- oder Kryptoregeln.
- Prüfung: 18 UI-/Profilporttests, vier B01-Webfälle und alle 28 P4.4-Web-/Desktopfrontendfälle bestanden. Gesamtnachprüfung: 166 Vitesttests, fünf Rusttests, 42 Web-/40 Desktop-Frontendfälle, alle 62 Speicherintegrationen und 24 Layout-/Leistungsfälle bestanden. Lokale UX-Serie: Chromium/WebKit 14 bestanden, sieben Firefoxstarts durch Profilfehler blockiert. Produktionsbuilds, zwei gebaute PWA-Offlinefälle und Importworker ebenfalls bestanden. Aktueller Ubuntu-CI-Status in [PR #45](https://github.com/mpwg/WiMM/pull/45); aktuelle Details in [B01-Übergabe](handoffs/b01.md#pr-45--review-und-fehlgeschlagene-ci-korrigiert).

- Weiterer PR-45-Reviewfix: wartende Profiländerungen sperren Finanzaktionen und Kurzbefehle bis zum tatsächlichen Commit; keine neuen Entwürfe während eines Bereichswechsels. Je fünf B01-Fälle auf Web/Desktopfrontend bestanden. Wiederholte Gesamtnachprüfung: 166 Vitesttests, fünf Rusttests, 43 Web-/41 Desktop-Frontendfälle, 62 Speicherintegrationen, 24 Layout-/Leistungsfälle, Produktionsbuilds, Offline und Worker bestanden. Nur lokale Firefoxstarts weiterhin blockiert; aktueller Ubuntu-CI-Status beim PR.

### B01 — PR-46-Review zur Schlüsselzugehörigkeit

- Freigabe: Nutzerfrage vom 6. Oktober 2026 zum eigenen PR-46-Review-Kommentar; bestätigt und im zugehörigen A02-Branch behoben.
- Ergebnis: mathematische Ed25519-/X25519-Schlüsselzugehörigkeit mit libsodium vor Profilfreigabe und Profiländerung prüfen; auch den eingebetteten öffentlichen Ed25519-Anteil validieren. Originalbytes und gültige Sitzungsschlüssel erhalten; keine Suite-/KDF-/Formatänderung.
- Prüfung: vier Repros vor Behebung fehlgeschlagen, danach bestanden. Typecheck, Lint, 20 Cryptotests, 27 UI-/Profilporttests und je acht neue echte AppShell-Fälle auf Web/Desktopfrontend bestanden. Vollständige Nachprüfung des erweiterten A02-Stands folgt. [Nachweise](handoffs/b01.md#pr-46--mathematische-schlüsselzugehörigkeit-prüfen).
- PR #45: aktueller [Ubuntu-Lauf 37517001103](https://github.com/mpwg/WiMM/actions/runs/37517001103) vollständig erfolgreich; beide Review-Threads beantwortet und aufgelöst.

## Auditbehebung — Gesamtauftrag vom 7. Oktober 2026

- Freigabe: ausdrücklicher Nutzerauftrag, alle GitHub-Issues systematisch zu beheben; direkte Arbeit einschließlich Zwischencommits und Pushes auf `main` ist wieder erlaubt. Diese aktuelle Freigabe ersetzt die bisherige PR-Pflicht (ADR-038). Bestehende Fach- und Abnahmekriterien gelten weiterhin; offene Plattformnachweise werden nicht fingiert.
- Umfang: alle 21 Issues geprüft; #24/#25 bereits geschlossen. Offene Einzelbefunde #26–#43 und Übersicht #44 werden anhand ihrer Kriterien bearbeitet. Noch nicht implementierte P6–P11 sind keine Auditfehler.
- A12 (#33): gemeinsame Warteschlange für alle Mutationen des Memory-Referenzadapters; konkurrierende CAS-Writes, unabhängige Writes und Fehlerfreigabe geprüft. Regression vor Fix: beide CAS-Writes erfolgreich; danach genau einer erfolgreich. Keine Änderung der Produktionsspeicherformate.
- Q05 (#38): Cleanup vergleicht das tatsächlich gespeicherte Warteschlangenpromise; Fallbackserialisierung, Fehlerfreigabe und Entfernung des letzten Eintrags geprüft.
- Prüfbelege: `pnpm test:storage` — 12 Tests bestanden; `pnpm typecheck` und `pnpm lint` bestanden. Vollständige Gesamtabnahme folgt nach den weiteren Fixpaketen.
- A03 (#26): gemeinsame Folgebestandsprüfung im Fachkern, vollständiger Lesebestandsport und atomare Konto-CAS-Anker für Buchungen, Transfers, Import, Dauerzahlungen und Undo/Redo. Bestehende fokussierte Fachfixtures um Bestandshierarchie ergänzt. Regression mit deaktivierter neuer Prüfung: fünf Grenz-/Gegenbefehls-/Paralleltests fehlgeschlagen; mit Fix bestanden.
- A03-Prüfbelege: 71 Fachtests und 32 UI-Unit-Tests, Typecheck/Lint bestanden. Browser-/Speicherintegration und Gesamtlauf folgen.
- A04–A06 (#27–#29): Übersicht und Liste verwenden dieselbe Transferauswahl mit vollständiger Paarvalidierung. Empfängerzusammenführung benötigt den Abgleichstatus und verweigert gesperrte Quellen; Aliasunion dedupliziert NFC/Whitespace/Locale-normalisierte Werte, Einzel-Empfängerspeicherung bleibt streng.
- B03-Prüfbelege: vier Empfängerregressionen vor Fix fehlgeschlagen, danach 75 Fachtests bestanden. Übersichtstransfer vor Fix in Web/Desktopfrontend mit leerem Bearbeitungsbetrag fehlgeschlagen; danach je ein realer IndexedDB-Ablauf einschließlich IDs, Buchungsanzahl und atomarer Paarlöschung bestanden.
- A07/A11 (#30/#32): nichtnegative CAMT-Magnituden vor Richtungsableitung; Detailfehler werden nicht als gültige Sammelbuchung versteckt. Originalsourceindex und physische Zeile bleiben bei Vereinzelung erhalten. Beide Regressionen vor Fix fehlgeschlagen, danach bestanden.
- A08/A09 (#42/#43): Auswahlbudgets vor Lesen in Browser/Rust, CAMT-Knoten-/Ausgabegrenzen, benötigte Felder, Workerfrist, Abbruch-/Fehlercleanup und zugeschnittene Bytekopie. Unabhängige Sicherheitsgrenzenprüfung und Kandidatreview durchgeführt. Reviewregression (mehrfach gezählter gemeinsamer Quellbaum) reproduziert und durch referenzbewusste Zählung behoben; 300 reguläre Sammeldetails bleiben gültig.
- B04-Prüfbelege: 55 Importertests einschließlich negativer Magnituden, Originalindex, globaler/Entry-/Ausgabegrenzen und Workercleanup bestanden; drei Plattform-Unit-Tests, sechs Rusttests, Rust fmt/Clippy, Typecheck/Lint bestanden. Echter Importworker und Gesamtabnahme folgen.
- B04-Nachprüfung: Typecheck/Lint und alle 55 Importertests bestanden; echter Browserworker (Parsing, strukturierte Ablehnung, Abbruch und Neustart) ebenfalls bestanden.
- A10 (#31): Version-2-Passphrasehüllen speichern drei Argon2id-Durchläufe/64 MiB mit authentifizierter Parameter-/Saltbindung und vorab geprüften Obergrenzen. Legacy 2/64 MiB bleibt über Passphrase und Recovery lesbar; nach validierter Passphraseentsperrung wird ausschließlich die Passphrasehülle unter Profil-CAS gehärtet. Recoveryentsperrung schreibt nichts. ADR-037 dokumentiert Format/Kompatibilität.
- B05-Prüfbelege: Parameterregression vor Fix fehlgeschlagen; danach 24 Cryptotests und 35 UI-Unit-Tests bestanden. Ungültige Parameter rufen `crypto_pwhash` nicht auf; gültig manipulierte Parameter/Headerentfernung scheitern an Authentifizierung. Quota, Abbruch und CAS erhalten Originalprofil. Echter Legacy-/Recovery-/Migrations-/Neustartablauf auf Web und Desktopfrontend bestanden; Typecheck/Lint bestanden.
- Q01 (#34): bereits eingecheckter Fixturefix erneut geprüft; alle 28 P4.4-Speicherintegrationen auf Web/Desktopfrontend bestanden, einschließlich vier Tastatur-/Touchvarianten und separater Zukunftsbuchung. Vollständige CI-Nachprüfung folgt.
- Q02 (#35): P5-Zoomablauf folgt Übernahme prüfen → Bestätigung → Zurück zur Vorschau und Einstellungen → Dauerzahlungen → Neue Dauerzahlung. Zentrale Zoomserie enthält nun beide GUI-Fälle. `pnpm test:ui:zoom`: zwei echte 200-%-Systemzoomtests bestanden, ohne CSS-Zoom, inklusive Vorschau, Fehlerentscheidung und geöffnetem Dauerzahlungsdialog.
- Q03 (#36): Secretprüfungen durchsuchen vollständige LocalStorage-/Logtexte auf Einbettung; synthetische JSON-Negativfixture lässt die erwartete Secretassertion scheitern. Recoveryprüfung wählt produktpassenden Profilkey und verlangt vorhandenen Datensatz. Je fünf Web-/Desktopfrontendtests bestanden; falscher Rettungscode verändert das tatsächliche Profil nicht.
- Q04 (#37): TS/TSX-Paketgraph mit etabliertem AST-Parser statt Regex; statische/dynamische Imports, Reexports, Typeimports und require sowie relative Projektpaketkanten geprüft. Babel-Parser 8.0.6 exakt gesperrt, MIT, Reifezeit erfüllt; keine neue Produktabhängigkeit. Elf Graphprüfungen, tatsächlicher Repositorygraph, Typecheck/Lint bestanden; Negativfixtures laufen in `check:all`/CI mit.
- D01 (#40): eng begrenzter Override `source-map-js@<1.2.2` → `1.2.2`, exaktes Lockfile. Vorher ein GHSA-68fv-2mgg-jv7q-Treffer, danach `pnpm audit`: keine bekannten Schwachstellen. Typecheck, zehn Toolchainnegativtests, Web-/Desktopfrontend-Produktionsbuilds und nativer macOS-Tauri-Releasebuild bestanden. Keine Majoraktualisierung.

- Q06 (#39): aktuelle tauri-build/rusqlite/Dialogversionen mit Manifest/Lockfile abgeglichen; historische P1-Auswahl erhalten. Zentrale Freigabe-/Gitverweise statt überholter Kopien; aktuelle Nutzerfreigabe durch ADR-038 dokumentiert. Erfolgreicher Remote-Ubuntu-CI-Lauf vom 7. Oktober auf `4e6d714` ausdrücklich als vorheriger Stand verlinkt.
- D02 (#41): tatsächlichen gesperrten Linux/GTKbaum per Cross-Target-`cargo tree --locked` bewertet; glib-Runtimehinweis von proc-macro-error-Compilezeit/Wartung getrennt. Keine eigene VariantStrIter-Nutzung gefunden, transitive Nichterreichbarkeit nicht behauptet. Keine kompatible Registrylösung nachgewiesen; Majoroverride verworfen. Native Linuxabnahme auf diesem macOS-Rechner nicht verfügbar, Issue bleibt offen. [Konkrete Bewertung und nächster Schritt](handoffs/audit-2026-10-07.md#gtk-abhängigkeitsbewertung-d02).
- Zusätzliche #44-Beobachtungen: allein geänderte Buchungsrichtung und ausgewählte Importdatei vor Vorschau vor Fix im Browser verloren, danach Entwurfsschutz auf Web/Desktopfrontend bestanden. Commitworker-postMessage-Cleanup vor Fix fehlgeschlagen; danach Fehler/Abbruch ohne Write und späte Antworten geprüft. 37 UI-Unit-Tests, je zwei Beobachtungs-Browsertests, Typecheck/Lint bestanden. Dublettenklassifizierung mit 100.000 Kandidaten/Fingerprints gemessen (fünf Node-Läufe 64/54/53/62/57 ms), kein zusätzlicher belegter Leistungsfehler; Haushaltsfehler besitzen bereits sichtbaren Alert/B01-Abdeckung.
- Gesamtlauf-Korrektur: neues verborgenes Richtungsfeld darf keinen Dialoganfangsfokus erhalten. Gemeinsame Fokusauswahl überspringt hidden/deaktivierte Felder; je zwei P4.5-Web-/Desktopfrontend-Kurzbefehls-/Portfälle, Typecheck/Lint bestanden. Der erste Gesamtlauf wurde nach dieser Fokusregression beendet; erneuter vollständiger Lauf folgt.
- Großimport-Nachprüfung: das CAMT-Ausgabebudget gilt ausschließlich für CAMT; die bisherige CSV-Vorschau mit 99.999 Zeilen bleibt zulässig. Der zweite Gesamtlauf zeigte die zu breite Budgetanwendung; nach Korrektur 56 Importertests und beide echten Web-/Desktopfrontend-Großimportfälle bestanden, einschließlich bedienbarem Worker und pausiertem Commit. Typecheck/Lint bestanden.
- A03-Nachprüfung: zwei zusätzliche Regressionen belegen unterschiedliche Zwischenwertbewertung bei der Reihenfolge von vorbereiteten und nach IndexedDB-Commit sortierten Buchungen. Folgebestandsprüfung sowie Konto-/Verbrauchsprojektionen verwenden nun dieselbe stabile ID-Reihenfolge. Beide Regressionen vor Fix fehlgeschlagen, danach 77 Fachtests bestanden; Grenzfixtures besitzen deterministische IDs statt zufälliger Überlaufreihenfolge.

- Aktuelle lokale Gesamtnachprüfung auf `373a88e`: 212 Vitesttests, Serviceworker, sechs Rusttests, Typecheck/Lint, Toolchain-/Dokumentations-/ASTprüfungen, 59 Web-/57 Desktopfrontendfälle, 64 Speicherintegrationen und 24 Layout-/Leistungsfälle bestanden. UX Chromium/WebKit 14 bestanden; sieben Firefoxstarts vor Appinteraktion durch Profilfehler blockiert. Danach Produktions-/Tauri-Releasebuilds, zwei gebaute PWA-Offlinefälle und echter Worker separat bestanden. Echter Zoom: zwei GUI-Fälle bestanden (Chromium 153, Breite 1200→600, DPR 2→4, CSS-Zoom 1). Ubuntu-CI-Nachweis und Restgrenzen stehen in [Auditübergabe](handoffs/audit-2026-10-07.md#gesamtnachprüfung).
- A03-Kontoanlage: zwei weitere Regressionen bestätigen gleichzeitige Anfangsbestände auf neuen beziehungsweise ersten Konten trotz unveränderter vorhandener Kontoanker. Lokale `financialRevision` mit reservierter Bereichs-ID schützt jeden Finanzbatch einschließlich dieser Neuanlagen. Keine Geldwerte/neuen sichtbaren Konten, keine Übertragung als Syncanker; ADR-039 und betroffene Verträge aktualisiert. Vor Fix beide Writes erfolgreich, danach jeweils genau ein vollständiger Commit. 77 Fachtests und 39 UI-Unit-Tests sowie Typecheck/Lint bestanden.
- Finanzrevision-Nachprüfung: alle 64 echten Web-/Desktopfrontend-Speicherintegrationen einschließlich Zwei-Tab-Import, Fehlerrollback, Undo/Redo, Großimport und 50.000-Zeilen-Fokus bestanden. Die vorherige Gesamtnachprüfung auf `373a88e` wird durch den abschließenden Finanzrevisionslauf ergänzt.
- Finanzrevisions-ID: jede fachliche Änderungsmenge schützt die reservierte Bereichs-ID vor anderweitiger Neubelegung; Fehlgenerator-Negativfall erhält einen vollständig leeren Originalspeicher. Acht Grenz-/Parallel-/Reservierungsfälle, Typecheck/Lint bestanden.

- CI-Zeitbudget: Ubuntu-Lauf 37664072055 wurde nach 20 Minuten abgebrochen, obwohl Fach-/UI-/Firefox-/Speicher-/Leistungsprüfungen bestanden und der native Releasebuild gerade abgeschlossen war. System-/Browserinstallation und kalter Linuxbuild brauchen ausreichend Restzeit für Offline-/Workerabschluss. Joblimit auf 30 Minuten erhöht; keine Prüfungen, Fehlerregeln oder fachlichen Schwellen abgeschaltet. Vollständiger Lauf auf dem Finanzrevisionsstand folgt.

- Pause auf ausdrücklichen Nutzerwunsch wegen Kontingent am 7. Oktober 2026. Aktueller gepushter Finanzrevisions-/CI-Stand `ab30dc3`; Ubuntu-Lauf 37667346674 läuft. Letzter lokaler Abschnitt kalibriert das CAMT-Strukturbudget auf 256 MiB zur Erhaltung regulärer 100.000-Zeilen-Dateien; 57 Importertests bestanden. Push/Gesamtnachprüfung dieses Abschnitts sowie #34/#44-Abschluss stehen aus. [Verbindlicher Wiedereinstieg](handoffs/audit-2026-10-07.md#pause-auf-nutzerwunsch).


### Fortsetzung am 8. Oktober 2026

- Nutzerauftrag: Fortsetzung der Auditbehebung; #41 auf ausdrückliche Nutzerwahl für die spätere native Linuxabnahme offen halten. Keine Ausnahme für externe Arbeitsumgebungen freigegeben.
- Pause überwunden: `e560514` ist bereits integriert und [Ubuntu-Lauf 37668773056](https://github.com/mpwg/WiMM/actions/runs/37668773056) vollständig erfolgreich. 216 Vitesttests, sechs Rusttests, 59 Web-/57 Desktopfrontendfälle, 64 Speicherintegrationen, 24 Layout-/Leistungsfälle, alle 21 UX-Browserfälle einschließlich Firefox, Produktions-/Tauri-Builds, zwei gebaute PWA-Offlinefälle und echter Worker bestanden. #34 am 8. Oktober zusätzlich mit allen 28 Abgleichfällen geprüft und geschlossen.
- Nachfolgende Nutzeränderungen `81bf325`/`6258f71` an pnpm-Reifezeit und Abhängigkeiten bewahrt. Neuer Oxlint meldet zwei echte Render-Purity-Verstöße; Buchungsdatum lazy initialisiert, Tagesstand der Dauerzahlungen per Fokus/Sichtbarkeit/Minute aktualisiert. Je ein Web-/Desktopfrontend-Tageswechseltest bewahrt eingegebene Buchungsdaten und zeigt neue Fälligkeiten ohne Neuladen; Typecheck/Lint bestanden.
- Tatsächlicher Tauri-Build verweigert Core 2.11.6 mit JS-API 2.12.0. Core auf reife stabile 2.12.1 einschließlich Lockfile abgeglichen; Rust fmt/Clippy und sechs Rusttests sowie beide Produktionsbuilds und nativer macOS-Releasebuild bestanden. Keine Rücksetzung der Nutzerupdates, kein Majoroverride für glib.
- Vollständige Nachprüfung des aktuellen Standes läuft; #44 erhält danach aktualisierte Kriterien und Belege. #41 und damit die vollständige Gesamtübersicht bleiben wegen der ausdrücklich aufgeschobenen nativen Linuxabnahme offen.

- Nachprüflauf 37729270978 auf `edb8fb2`: Ubuntu besteht bis zur Layout-/Leistungsserie, scheitert beim Desktopfrontend-Kaltöffnen der 50.000 Buchungen mit 2.123 ms statt unter 2.000 ms. Kein Grenzwert angehoben. Datumsindex einmal pro unveränderlichem FinanceModel-Bestand berechnet und in Übersicht/Liste verwendet; leere Suche vermeidet unnötige Locale-Konvertierung, Suchtext wird nur einmal normalisiert. Vier Browserfälle prüfen Transferpflege und Reihenfolge nach bestätigter Datumsänderung/Filterung; 40 UI-Unit-Tests, Typecheck/Lint bestanden.
- Optimierte lokale Layout-/Leistungsserie: alle 24 Fälle bestanden. Web/Desktopfrontend-Kaltöffnen 476/453 ms, warmes Öffnen 22/29 ms, Filter-p95 35/35 ms, Scroll-p95 35/35 ms. Dies sind macOS-arm64-Messungen; aktueller Ubuntu-Nachweis folgt. Bibliotheksdeklarationen ohne skipLibCheck geprüft: verbleibende Fremdfehler in saxes/thread-stream konkret dokumentiert, eigene Typprüfung bleibt streng.

- Abschluss der aktuellen Nachprüfung auf `880ccfa`: vollständiger Prüfschritt von [Ubuntu-CI 37731984200](https://github.com/mpwg/WiMM/actions/runs/37731984200) erfolgreich. 216 Vitesttests, sechs Rusttests, 60 Web-/58 Desktopfrontendfälle, 66 Speicherintegrationen, 24 Layout-/Leistungsfälle, alle 21 UX-Browserfälle einschließlich Firefox, Builds, Offline und Worker bestanden. Lokale ergänzende Zoomprüfung: zwei echte 200-%-Fälle bestanden. 19/20 Einzelissues geschlossen (17 Behebungen dieses Auftrags plus A01/A02); #41 auf ausdrücklichen Nutzerwunsch bis zur nativen Linuxabnahme offen, deshalb #44 noch keine vollständige Gesamtabnahme. [Aktuelle Übergabe](handoffs/audit-2026-10-07.md#fortsetzung-und-abschluss-der-aktuellen-behebung-am-8-oktober-2026).
