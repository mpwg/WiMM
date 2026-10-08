# Regeln für Agenten

## Arbeitsumgebung

- Sämtliche Projektarbeit findet in der aktiven Arbeitskopie dieses Repositorys statt. Dateisuche, Lesen, Bearbeiten, Git-Befehle, Installationen, Builds, Tests, Linter, Typechecks und sonstige Prüfungen laufen dort.
- Bearbeite keine andere lokale Kopie oder externe Arbeitsumgebung. Der frühere VS-Code-DevContainer wird nicht mehr verwendet.

## Auftrag und Sprache

- Verwende deutsche Sprache und deutsche Umlaute in Dokumentation, Benutzeroberfläche und verständlichen Meldungen. Technische Bezeichner bleiben englisch.
- Aktueller Auftrag, Implementierungsfreigaben und Paketstatus stehen ausschließlich in [Aufgaben](docs/tasks.md). Neue Produktpakete beginnen erst nach ausdrücklichem Implementierungsauftrag; ein vollständiges Planzitat erteilt keine zusätzliche Freigabe.
- Seit Nutzerauftrag vom 8. Oktober 2026 werden offene Deltas in GitHub-Issues verfolgt. Für jedes Delta ein eigenes Issue mit Voraussetzungen und Abnahmekriterien anlegen; Fortschritt, Blockaden und Prüfbelege dort pflegen. Repositorydokumente enthalten Spezifikation, zusammengefassten Paketstatus und Abnahmesnapshots mit Issueverweisen, keine zweite unabhängig gepflegte Deltaliste. P4-Einstieg: [Gesamtabnahme #57](https://github.com/mpwg/WiMM/issues/57).
- Lies vor Arbeit [Dokumentationsindex](docs/README.md), [Fachmodell](docs/domain.md), [Architektur](docs/architecture.md), [Entscheidungen](docs/decisions.md) und [Aufgaben](docs/tasks.md).
- Nutze den [Agentenleitfaden](docs/agent-guide.md) und passende Skills unter `.agents/skills`; weitere Produktregeln nicht in Kopien pro Agent verteilen.
- Seit ausdrücklicher Nutzerfreigabe vom 7. Oktober 2026 ist direkte Arbeit einschließlich Commits und Pushes auf `main` wieder erlaubt. Themenbranches und Pull Requests bleiben bei entsprechendem Auftrag möglich. Bestehende Branches, fremde Änderungen und GitHub-Repositoryschutz bewahren; niemals Force-Push.
- Bewahre vorhandene Änderungen anderer Beteiligter. Erstelle die verpflichtenden Zwischencommits nur für eigene abgeschlossene Abschnitte; keine Veröffentlichungen oder Zurücksetzungen.

## Architektur

- Implementiere Geld-, Budget-, Verteilungs- und Ausgleichsregeln ausschließlich im plattformunabhängigen Fachkern.
- Verwende ganze Cent; keine Gleitkomma-Geldberechnungen. Prüfe auch Summen und Zwischenwerte auf sichere Ganzzahlgrenzen.
- Verwende kein `unsafe` in eigenem Rust-Code. Alle eigenen Rust-Crates einschließlich Bindings, Werkzeuge, Tauri-App und Buildscripts müssen `#![forbid(unsafe_code)]` setzen; das Verbot darf nicht abgeschwächt oder umgangen werden. Zusätzlich gilt Cargo-seitig global `unsafe_code = "forbid"` für den Workspace mit Vererbung in jedem Paket und für den separaten Tauri-Appcrate.
- Halte Fachkern frei von UI, HTTP und Speicherabhängigkeiten. Beachte die Abhängigkeitsrichtung in der Architektur.
- Verwende dieselben Fachverträge und Adapter-Konformitätstests auf allen Plattformen.
- Änderungen an Buchungen, Umbuchungen, Ausgabenverteilungen und ihren Projektionen müssen atomar sein.
- Private Konto-, Buchungs-, Notiz- und Summendaten dürfen nicht in gemeinsame Datensätze, Synchronisierung, Exporte, Berichte oder Logs gelangen. Teile nur explizit bestätigte Angaben.
- Ende-zu-Ende-Verschlüsselung ist verpflichtend. Lies `docs/encryption.md`; verwende etablierte libsodium-Primitive, niemals eigene Kryptografie. Keine Finanzklartexte oder privaten Schlüssel im Server, Transport oder Betreiberbackup.
- Leite die handelnde Serveridentität aus der Sitzung ab und prüfe signierte Geräte-/Rollenmanifeste. Fachvalidierung geschieht auf Clients; der Server prüft nur öffentliche Hüllen, Signaturen, Rechte und CAS-Revisionen, nie Finanzinhalte.
- Behandle lokal ausstehende Änderungen, bestätigte Daten und Konflikte getrennt. Kein stilles Überschreiben.

## Umsetzung und Abschluss

- Bearbeite das erste offene, freigegebene Arbeitspaket mit erfüllten Voraussetzungen. Halte Status, Ergebnis und Prüfbelege in `docs/tasks.md` aktuell.
- Schließe ein Paket erst ab, wenn seine Abnahmekriterien erfüllt sind. Dokumentiere verbleibende Einschränkungen konkret.
- Rust-Komponenten müssen auch durch native Rust-Tests geprüft werden. Sprachbinding-/TypeScript-/Browservergleiche ergänzen diese Tests, ersetzen aber keine Rust-Assertions.
- Führe risikogerechte Prüfungen gemäß `docs/testing.md` aus. Bestehende Fach-, Adapter- und Zugriffsinvarianten sind verbindlich.
- Dokumentiere nötige Architekturänderungen in `docs/decisions.md` und passe betroffene Verträge gleichzeitig an. Bei Widersprüchen zwischen verbindlichen Quellen benenne den Widerspruch und korrigiere betroffene Quellen gemeinsam vor abhängiger Implementierung; bei unklarer Produktabsicht rückfragen.
- Verwende konsistente Task-/ADR-/Übergabevorlagen aus `docs/templates`; bei Pull Requests gilt die GitHub-Vorlage, Editorformatregeln gelten stets. Erstelle nach jedem abgeschlossenen Abschnitt einen Zwischencommit mit zusammengehörigen eigenen Änderungen gemäß aktueller Gitfreigabe; keine fremden Dateien einschließen. Neue Commitnachrichten nach Conventional Commits mit deutschem Inhalt.
- Übernimm Actual-Code nur nach Herkunfts- und Lizenzprüfung. Halte Herkunftscommit, lokale Änderungen und ursprüngliche Hinweise fest.
- Projektlizenz ist AGPL-3.0-or-later. Verwende diesen SPDX-Bezeichner für eigene Pakete und Quelldateien; erhalte Fremdlizenzen. Releases und Serveroberflächen müssen den zugehörigen Quellcode anbieten. Keine Umstellung auf MIT.
- Verwende etablierte Parser und Standards; keine eigene Kryptografie, XML- oder CSV-Parser.
- Eine Desktop-App muss plattformgerechte Bedienung erhalten. Eine breite Browseroberfläche unverändert in einem Desktopfenster erfüllt P4 nicht.
- Fehlende Signierungs- oder Deploymentgeheimnisse blockieren nur die betroffene Veröffentlichung; Geheimnisse gehören nicht ins Repository.
- Installiere oder starte während D0 keine Anwendung, Server, Paketverwaltung oder Infrastruktur.
