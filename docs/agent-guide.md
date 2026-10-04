# Leitfaden für Agenten

## Verbindliche Quellen und aktuelle Freigabe

[AGENTS.md](../AGENTS.md) enthält globale Regeln. [Dokumentationsindex](README.md) führt zur Fachspezifikation; [Aufgaben](tasks.md) enthalten Paketstatus; [Entscheidungen](decisions.md) begründen Defaults. Diese Quellen werden gemeinsam gepflegt. Issues und Skills sind Arbeitsmittel, keine abweichenden Fachspezifikationen.

Freigegeben sind Dokumentation, Agenten-Skills, Guides und GitHub-/VS-Codevorlagen. P1 bis P3 sind abgeschlossen; P4–P11 bleiben offen. Nach jedem abgeschlossenen Abschnitt ist ein Zwischencommit mit zusammengehörigen Änderungen verpflichtend. Pushes und Veröffentlichungen bleiben ausgeschlossen.

Für neue Mitwirkende: [kompakter Einstieg](getting-started.md), [Teilaufgabenübersicht P1–P11](tasks.md#teilaufgaben-und-bearbeitungsfolge) und [Referenzhaushalt mit durchgängigem Ablauf](reference-household.md). Die erneuten Einzelabnahmen [P4.1.1–P4.1.8](p4-ui.md#p411--gemeinsame-dienste-und-plattformports-prüfen), [P4.2.1](p4-ui.md#p421--navigation-und-bereichstrennung-prüfen) und [P4.2.2](p4-ui.md#p422--übersicht-und-kontostart-prüfen) sind abgeschlossen; [P4.2.3](p4-ui.md#p423--kontoarchivierung-mit-referenzen-abnehmen) ist der nächste begrenzte Schritt. Vorhandene Implementierungen nur bei festgestellter Lücke ändern. Die [Klärungsmatrix](getting-started.md#entscheidung-oder-rückfrage) unterscheidet verbindliche Festlegungen, technische Ermittlungen und Nutzerentscheidungen. Bei Widersprüchen zwischen verbindlichen Quellen den Widerspruch benennen und betroffene Quellen vor abhängiger Implementierung gemeinsam korrigieren; bei unklarer Produktabsicht rückfragen.

## Arbeitsumgebung

Alle Projektarbeiten erfolgen in der aktiven Arbeitskopie dieses Repositorys. Dateisuche, Lesen, Bearbeiten, Git-Befehle, Builds, Tests, Linter, Typechecks und sonstige Prüfungen laufen dort. Bearbeite keine andere lokale Kopie oder externe Arbeitsumgebung. Der frühere VS-Code-DevContainer wird nicht mehr verwendet. Die verbindliche Regel steht in [AGENTS.md](../AGENTS.md).

## Lesematrix nach Aufgabe

Die Pflichtlektüre aus AGENTS.md bleibt erhalten. Danach gezielt diese Abschnitte lesen; bei übergreifenden Aufgaben mehrere Zeilen kombinieren.

| Aufgabe | Zusätzlich benötigte Abschnitte | Skill / Abnahme |
| --- | --- | --- |
| Projektgrundlage P1 | Architektur: Komponenten und Zielstruktur, Bibliotheken und Toolchain; Datenmodell: Gemeinsame Typen, E2EE-Speicherebenen, Schemaentwicklung; P1-Teilaufgaben; Entwicklung: Hooks und automatisierte Prüfungen ab P1 | wimm-workflow; P1-Abnahme, bei Crypto zusätzlich wimm-e2ee |
| Fachkern | Fachmodell: betroffene Berechnung; Datenmodell: Finanzdaten, Aggregate, Indizes und Löschung; API: Fachbefehle; Tests: Referenzdatensätze | wimm-finance; passende F-Fälle und Invarianten |
| Speicher/Offline | Architektur: Speicherports, Lokaler und verbundener Betrieb; Datenmodell: Speicher- und Synchronisierungsdaten, Schemaentwicklung; Verschlüsselung: Schlüsselhierarchie, Geräteaufnahme und Entsperren; Tests: Speicher- und Syncmatrix | wimm-workflow, wimm-e2ee; Adapterkonformität, S01–S03/S14 |
| Oberfläche | Produkt: Navigation, Abläufe und Zustände; UI-Dokument; Architektur: Plattformintegration; Tests: Oberflächenmatrix und Leistung | wimm-ui; P4-/paketbezogene UI-Abnahme |
| Import | Formate: Importablauf, CSV, CAMT.053 und OFX/QFX, Dubletten; Fachmodell: Buchungen, Umbuchungen und Berichte, Dauerzahlungen, Ziele, Löschung; API: Fachbefehle; Tests: Zugriff und Parser | wimm-finance; F14, Parser-/Dublettenfälle |
| Crypto/Recovery | Verschlüsselung vollständig; Sicherheit: Vertrauensmodell, Sitzungen und Gerätekopplung; Formate bei Export/Recovery; Tests: Verpflichtende Crypto-Abnahme | wimm-e2ee; passende C-Fälle, kein fingierter Auditbeleg |
| Synchronisierung/Server | Synchronisierung vollständig; Verschlüsselung: Verschlüsselter Transportvertrag, Entfernen, Rollenwechsel und Rotation; API: Endpunkte, Push-Antwort, Fehler; Produkt: Rollenmatrix; Tests: Speicher- und Syncmatrix, Zugriff und Parser | wimm-e2ee; passende S-/C-Fälle und Zugriffsmatrix |

## Installierte Projektskills

Die folgenden Skills liegen versioniert in `.agents/skills`. Sie sind für alle Checkouts gemeinsam verfügbar und verändern keine globalen Benutzer-Skills. Ihre eigenen Metadaten sind AGPL-3.0-or-later. Automatische Auswahl ist aktiviert; ausdrücklich sind sie per `$wimm-workflow`, `$wimm-finance`, `$wimm-e2ee` und `$wimm-ui` aufrufbar.

| Skill | Wann lesen | Referenzen |
| --- | --- | --- |
| [wimm-workflow](../.agents/skills/wimm-workflow/SKILL.md) | Paket/Teilaufgabe, Dokumentationspflege, Übergabe oder PR | Aufgaben, ADR-/Task-/Handoffvorlagen |
| [wimm-finance](../.agents/skills/wimm-finance/SKILL.md) | Buchungen, Budget, Verteilung, Reserve und Ausgleich | Fach-/Datenmodell, F-/S-Testfälle |
| [wimm-e2ee](../.agents/skills/wimm-e2ee/SKILL.md) | Schlüssel, verschlüsselter Transport, Recovery, Exporte | Encryption, Sync, API, Formate, C-Testfälle |
| [wimm-ui](../.agents/skills/wimm-ui/SKILL.md) | Navigation, Formulare, native Integration und visuelle Prüfung | UI, Produkt, Screenshotmatrix |

Codex unterstützt Repository-Skills unter `.agents/skills` und lädt deren ausführlichen Inhalt nach Bedarf. [Offizielle Skill-Dokumentation](https://learn.chatgpt.com/docs/build-skills). Andere Agenten öffnen SKILL.md direkt, falls automatische Discovery fehlt. `.github/copilot-instructions.md` verweist VS-Code-/GitHub-Copilot auf dieselben Quellen. Keine parallelen Regelkopien pro Modell erstellen.

Externe Skills sind für die aktuelle Dokumentationsarbeit nicht erforderlich. Die CI-Konfiguration und das Crypto-Binding sind seit P1 vorhanden; ein Remote-CI-Lauf ist noch nicht belegt. Figma-Design, Bankintegration und Clouddeployment sind nicht eingerichtet. Bei späterem Bedarf eine eng passende, geprüfte Erweiterung hinzufügen; keine pauschale Sammlung globaler Plugins. Kryptografische Bibliotheken ersetzen Skills nicht.

## Konsistente Formate

- Dokumentation deutsch mit Umlauten, technischer Code/API-Bezeichner englisch; UTF-8/LF, Abschlussnewline und keine nachlaufenden Leerzeichen.
- Markdown: ein H1, kurze H2/H3, Tabellen für Vergleiche, lesbare Absätze, eingezäunte Beispiele mit Sprachkennung. Keine erzwungene Zeilenlänge; Editor-Softwrap statt automatischem Absatzumbau.
- Geldbeispiele nennen EUR und erwartetes Ergebnis; API-Beispiele Cent. JSON-Beispiele gültig, Platzhalter als solche erklären. Synthetische Beispiele nicht als Cryptotestvektoren ausgeben.
- Aufgabe: ID, Status, Voraussetzung/Freigabe, Schritte, Ergebnis, Verträge, Abnahme, Prüfungen, Nachweise. [Vorlage](templates/task.md).
- Entscheidung: ID, Datum/Status, Problem, Entscheidung, Herkunft, Folgen und Migration/Tests. [Vorlage](templates/decision.md).
- Übergabe: Ergebnis, erledigte/ausstehende Prüfungen, Commit(s), Einschränkungen und nächstes freigegebenes Paket. [Vorlage](templates/handoff.md).
- PR: konkretes Problem und resultierendes Verhalten zuerst, Paket/Verträge, Prüfungen und Einschränkungen. [GitHub-Vorlage](../.github/pull_request_template.md). Reviews beginnen mit konkreten Befunden nach Schwere und Codebezug.

## GitHub und Commits

Projekt wird auf GitHub gehostet, Entwicklung in VS Code. Remoteadresse/Owner nicht erfinden; vor jedem Push echte `git remote`-Konfiguration prüfen. Ein Remote ist eingerichtet, verleiht aber keine Push- oder Veröffentlichungsfreigabe. Templates liegen bereits lokal und funktionieren nach Veröffentlichung; sie veröffentlichen selbst keine Issues/PRs.

Neue Arbeitsbranches heißen `codex/<paket>-<thema>`, z. B. `codex/p3-speicheradapter`. Bestehende Branches nicht ungefragt wechseln; vorhandenen Arbeitsstand erhalten. Nach jedem abgeschlossenen Abschnitt einen zusammenhängenden Zwischencommit erstellen; keine mechanisch leeren Commits und keine fremden Dateien.

Neue Commitnachrichten folgen Conventional Commits mit deutschem Inhalt: `docs(agents): Ergänze projektspezifische Leitfäden`, `feat(budget): Ergänze monatliche Umschlagzuweisung`, `fix(sync): Erhalte Entwürfe bei Schlüsselrotation`, `test(finance): Prüfe Restcent bei Erstattungen`. Vorhandene ältere Commitnachrichten werden nicht umgeschrieben. Scopes möglichst aus domain/crypto/storage/sync/import/ui/server/docs/agents/ci wählen.

Paketabschluss verleiht kein automatisches Push-/Merge-/Release-Recht. Für spätere GitHubprojekteinstellungen empfiehlt sich PR-basierter Hauptbranch mit Review und erforderlichen existierenden Checks; diese Einstellungen müssen im echten Repository eingerichtet werden. Keine CODEOWNERS-Datei mit erfundenem Benutzer.

## Prüfung und Übergabe

In der aktuellen Dokumentationsphase: relative Links, JSON/YAML, Skillfrontmatter/-metadaten, Status und widersprüchliche E2EE-/Lizenzannahmen prüfen. Markdownlint-Konfiguration liegt im Repository; eine installierte VS-Code-Erweiterung kann sie verwenden. Keine angeblich bestehenden Appbefehle oder CI-Ergebnisse melden.

Später Prüfungen nach [Testplan](testing.md), nicht nach einer für jedes Paket identischen Vollcheckliste. Bei Geld-/Key-/Rechteänderungen sind die entsprechenden Referenzfälle verpflichtend. Fehlende Plattformen klar nennen. Detaillierte Umsetzung bleibt in Tasks/Docs; die Nutzerantwort fasst Ergebnis und wichtige Grenzen kurz zusammen.
