# Leitfaden für Agenten

## Verbindliche Quellen und aktuelle Freigabe

[AGENTS.md](../AGENTS.md) enthält globale Regeln. [Dokumentationsindex](README.md) führt zur Fachspezifikation; [Aufgaben](tasks.md) enthalten Paketstatus; [Entscheidungen](decisions.md) begründen Defaults. Diese Quellen werden gemeinsam gepflegt. Issues und Skills sind Arbeitsmittel, keine abweichenden Fachspezifikationen.

Freigegeben sind Dokumentation, Agenten-Skills, Guides und GitHub-/VS-Codevorlagen. P1–P11 bleiben offen; keine App-Implementierung starten. Die Anweisung zu Zwischencommits gilt weiter. Eine ausdrücklich spätere Implementierungsfreigabe genügt, ohne noch einmal allein wegen des alten Dokumentationsstatus nachzufragen.

## Installierte Projektskills

Die folgenden Skills liegen versioniert in `.agents/skills`. Sie sind für alle Checkouts gemeinsam verfügbar und verändern keine globalen Benutzer-Skills. Ihre eigenen Metadaten sind AGPL-3.0-or-later. Automatische Auswahl ist aktiviert; ausdrücklich sind sie per `$wimm-workflow`, `$wimm-finance`, `$wimm-e2ee` und `$wimm-ui` aufrufbar.

| Skill | Wann lesen | Referenzen |
| --- | --- | --- |
| [wimm-workflow](../.agents/skills/wimm-workflow/SKILL.md) | Paket/Teilaufgabe, Dokumentationspflege, Übergabe oder PR | Aufgaben, ADR-/Task-/Handoffvorlagen |
| [wimm-finance](../.agents/skills/wimm-finance/SKILL.md) | Buchungen, Budget, Verteilung, Reserve und Ausgleich | Fach-/Datenmodell, F-/S-Testfälle |
| [wimm-e2ee](../.agents/skills/wimm-e2ee/SKILL.md) | Schlüssel, verschlüsselter Transport, Recovery, Exporte | Encryption, Sync, API, Formate, C-Testfälle |
| [wimm-ui](../.agents/skills/wimm-ui/SKILL.md) | Navigation, Formulare, native Integration und visuelle Prüfung | UI, Produkt, Screenshotmatrix |

Codex unterstützt Repository-Skills unter `.agents/skills` und lädt deren ausführlichen Inhalt nach Bedarf. [Offizielle Skill-Dokumentation](https://learn.chatgpt.com/docs/build-skills). Andere Agenten öffnen SKILL.md direkt, falls automatische Discovery fehlt. `.github/copilot-instructions.md` verweist VS-Code-/GitHub-Copilot auf dieselben Quellen. Keine parallelen Regelkopien pro Modell erstellen.

Externe Skills sind derzeit nicht erforderlich: Das Projekt hat kein aktives CI, kein Figma-Design, keine Bankintegration oder Clouddeployment. Bei späterem Bedarf eine eng passende, geprüfte Erweiterung hinzufügen; keine pauschale Sammlung globaler Plugins. Kryptografische Bibliotheken ersetzen Skills nicht und werden erst im Implementierungspaket installiert.

## Konsistente Formate

- Dokumentation deutsch mit Umlauten, technischer Code/API-Bezeichner englisch; UTF-8/LF, Abschlussnewline und keine nachlaufenden Leerzeichen.
- Markdown: ein H1, kurze H2/H3, Tabellen für Vergleiche, lesbare Absätze, eingezäunte Beispiele mit Sprachkennung. Keine erzwungene Zeilenlänge; Editor-Softwrap statt automatischem Absatzumbau.
- Geldbeispiele nennen EUR und erwartetes Ergebnis; API-Beispiele Cent. JSON-Beispiele gültig, Platzhalter als solche erklären. Synthetische Beispiele nicht als Cryptotestvektoren ausgeben.
- Aufgabe: ID, Status, Voraussetzung/Freigabe, Schritte, Ergebnis, Verträge, Abnahme, Prüfungen, Nachweise. [Vorlage](templates/task.md).
- Entscheidung: ID, Datum/Status, Problem, Entscheidung, Herkunft, Folgen und Migration/Tests. [Vorlage](templates/decision.md).
- Übergabe: Ergebnis, erledigte/ausstehende Prüfungen, Commit(s), Einschränkungen und nächstes freigegebenes Paket. [Vorlage](templates/handoff.md).
- PR: konkretes Problem und resultierendes Verhalten zuerst, Paket/Verträge, Prüfungen und Einschränkungen. [GitHub-Vorlage](../.github/pull_request_template.md). Reviews beginnen mit konkreten Befunden nach Schwere und Codebezug.

## GitHub und Commits

Projekt wird auf GitHub gehostet, Entwicklung in VS Code. Remoteadresse/Owner nicht erfinden; vor jedem Push echte `git remote`-Konfiguration prüfen. Aktuell ist noch kein Remote eingerichtet. Templates liegen bereits lokal und funktionieren nach Veröffentlichung; sie veröffentlichen selbst keine Issues/PRs.

Neue Arbeitsbranches heißen `codex/<paket>-<thema>`, z. B. `codex/p3-speicheradapter`. Bestehende Branches nicht ungefragt wechseln; vorhandenen Arbeitsstand erhalten. Zwischenschritte als zusammenhängende Commits, keine mechanisch leeren Commits und keine fremden Dateien.

Neue Commitnachrichten folgen Conventional Commits mit deutschem Inhalt: `docs(agents): Ergänze projektspezifische Leitfäden`, `feat(budget): Ergänze monatliche Umschlagzuweisung`, `fix(sync): Erhalte Entwürfe bei Schlüsselrotation`, `test(finance): Prüfe Restcent bei Erstattungen`. Vorhandene ältere Commitnachrichten werden nicht umgeschrieben. Scopes möglichst aus domain/crypto/storage/sync/import/ui/server/docs/agents/ci wählen.

Paketabschluss verleiht kein automatisches Push-/Merge-/Release-Recht. Für spätere GitHubprojekteinstellungen empfiehlt sich PR-basierter Hauptbranch mit Review und erforderlichen existierenden Checks; diese Einstellungen müssen im echten Repository eingerichtet werden. Keine CODEOWNERS-Datei mit erfundenem Benutzer.

## Prüfung und Übergabe

In der aktuellen Dokumentationsphase: relative Links, JSON/YAML, Skillfrontmatter/-metadaten, Status und widersprüchliche E2EE-/Lizenzannahmen prüfen. Markdownlint-Konfiguration liegt im Repository; eine installierte VS-Code-Erweiterung kann sie verwenden. Keine angeblich bestehenden Appbefehle oder CI-Ergebnisse melden.

Später Prüfungen nach [Testplan](testing.md), nicht nach einer für jedes Paket identischen Vollcheckliste. Bei Geld-/Key-/Rechteänderungen sind die entsprechenden Referenzfälle verpflichtend. Fehlende Plattformen klar nennen. Detaillierte Umsetzung bleibt in Tasks/Docs; die Nutzerantwort fasst Ergebnis und wichtige Grenzen kurz zusammen.
