# Regeln für Agenten

## Auftrag und Sprache

- Verwende deutsche Sprache und deutsche Umlaute in Dokumentation, Benutzeroberfläche und verständlichen Meldungen. Technische Bezeichner bleiben englisch.
- Der aktuelle Auftrag umfasst ausschließlich Dokumentation, Paket D0. Beginne P1 oder Anwendungscode erst nach einem späteren ausdrücklichen Implementierungsauftrag. Das Zitieren des gesamten Plans innerhalb des D0-Auftrags ist keine zusätzliche Freigabe für P1 bis P11.
- Lies vor Arbeit [Dokumentationsindex](docs/README.md), [Fachmodell](docs/domain.md), [Architektur](docs/architecture.md), [Entscheidungen](docs/decisions.md) und [Aufgaben](docs/tasks.md).
- Bewahre vorhandene Änderungen anderer Beteiligter. Keine ungefragten Commits, Veröffentlichungen oder Zurücksetzungen.

## Architektur

- Implementiere Geld-, Budget-, Verteilungs- und Ausgleichsregeln ausschließlich im plattformunabhängigen Fachkern.
- Verwende ganze Cent; keine Gleitkomma-Geldberechnungen. Prüfe auch Summen und Zwischenwerte auf sichere Ganzzahlgrenzen.
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
- Führe risikogerechte Prüfungen gemäß `docs/testing.md` aus. Bestehende Fach-, Adapter- und Zugriffsinvarianten sind verbindlich.
- Dokumentiere nötige Architekturänderungen in `docs/decisions.md` und passe betroffene Verträge gleichzeitig an.
- Übernimm Actual-Code nur nach Herkunfts- und Lizenzprüfung. Halte Herkunftscommit, lokale Änderungen und ursprüngliche Hinweise fest.
- Projektlizenz ist AGPL-3.0-or-later. Verwende diesen SPDX-Bezeichner für eigene Pakete und Quelldateien; erhalte Fremdlizenzen. Releases und Serveroberflächen müssen den zugehörigen Quellcode anbieten. Keine Umstellung auf MIT.
- Verwende etablierte Parser und Standards; keine eigene Kryptografie, XML- oder CSV-Parser.
- Eine Desktop-App muss plattformgerechte Bedienung erhalten. Eine breite Browseroberfläche unverändert in einem Desktopfenster erfüllt P4 nicht.
- Fehlende Signierungs- oder Deploymentgeheimnisse blockieren nur die betroffene Veröffentlichung; Geheimnisse gehören nicht ins Repository.
- Installiere oder starte während D0 keine Anwendung, Server, Paketverwaltung oder Infrastruktur.
