# WhereIsMyMoney

WhereIsMyMoney ist ein geplanter Open-Source-Finanzmanager für Familien. Gemeinsame Haushaltsfinanzen, persönliche Finanzbereiche, Budgetplanung und ein nachvollziehbarer Ausgleich zwischen Erwachsenen stehen im Mittelpunkt.

**Projektstatus: P1 abgeschlossen.** D0 und D1 enthalten Spezifikation sowie Agenten-/Editor-/GitHubhilfen; D2 ergänzt Einstieg, Beispiele und P1-Teilaufgaben. P1.1 bis P1.6 sind abgeschlossen. Web-, Desktop- und Serverhülle starten, enthalten aber noch keine Finanzfunktionen. Als Nächstes folgt P2, der plattformunabhängige Fachkern.

## Geplantes Produkt

- Webanwendung und installierbare, offlinefähige PWA.
- Desktop-Apps für macOS, Windows und Linux mit plattformgerechter Gestaltung und nativen Menüs und Dialogen.
- Vollständiger lokaler Betrieb ohne Benutzerkonto oder Backend.
- Optional selbst gehosteter Server für persönliche Konten, Familienrollen und Synchronisierung.
- Mehrere getrennte Familien pro Server und mehrere Haushalte pro Person.
- Persönliche Bereiche ohne automatische Freigabe von Konten, Buchungen oder Summen.
- Verpflichtende Ende-zu-Ende-Verschlüsselung aller Finanzdaten; der Finanzserver erhält keine Entschlüsselungsschlüssel.
- Konten, Buchungen, Dateiimporte, Regeln, Dauerzahlungen, beide Budgetmethoden, Sparziele und Berichte.
- Geteilte Ausgaben, flexible Kostenverteilung, Beiträge und Ausgleichszahlungen.

Die erste Version richtet sich an Erwachsene im deutschsprachigen Raum, verwendet EUR und benötigt keine externen Finanzdienste. Bankanbindung, Kinderrollen, weitere Währungen und mobile Store-Apps folgen später.

## Einstieg für einen implementierenden Agenten

Für einen kompakten Start: [Einstiegsleitfaden](docs/getting-started.md), [Teilaufgabenübersicht P1–P11](docs/tasks.md#teilaufgaben-und-bearbeitungsfolge) und [synthetischer Referenzhaushalt mit Buchungsablauf](docs/reference-household.md). P4–P11 sind in 50 offene Aufgaben zerlegt; nach Implementierungsfreigabe ist [P4.1](docs/p4-ui.md#p41--composition-root-und-lokaler-einstieg) der nächste Schritt.

1. [Arbeitsregeln](AGENTS.md) lesen.
2. Im [Dokumentationsindex](docs/README.md) die Lesereihenfolge beachten.
3. [Fachliche Architektur](docs/domain.md), [technische Architektur](docs/architecture.md) und [Entscheidungen](docs/decisions.md) verstehen.
   Zusätzlich [Verschlüsselung und Schlüsselverwaltung](docs/encryption.md) vor Speicher-/Syncarbeit lesen.
4. Bei einem ausdrücklichen Implementierungsauftrag das erste offene, freigegebene [Arbeitspaket](docs/tasks.md) mit erfüllten Voraussetzungen übernehmen.
5. Paket anhand der [Test- und Abnahmeregeln](docs/testing.md) abschließen und seinen Status aktualisieren.

## Verhältnis zu Actual Budget

Für Zusammenarbeit auf GitHub und Entwicklung in VS Code: [Beitragsleitfaden](CONTRIBUTING.md), [Entwicklungsumgebung](docs/development.md) und [Agentenleitfaden mit vier Projektskills](docs/agent-guide.md). Die Hilfen sind versioniert, nicht global in anderen Projekten installiert.

[Actual Budget](https://github.com/actualbudget/actual) ist Funktionsreferenz und mögliche Quelle ausgewählter Importer, Berechnungen und Tests. WhereIsMyMoney wird überwiegend eigenständig entwickelt. Ein vollständiger Fork, dessen Oberflächendesign oder dessen Synchronisierungsprotokoll sind nicht vorgesehen.

WhereIsMyMoney einschließlich seiner eigenen Dokumentation und des späteren eigenen Anwendungscodes steht unter **GNU Affero General Public License, Version 3 oder neuer (AGPL-3.0-or-later)**. Der vollständige Lizenztext steht in [LICENSE](LICENSE.md); die Wahl einer späteren Version ergibt sich aus diesem ausdrücklichen Projektlizenzhinweis.

Übernommene Bestandteile behalten ihre tatsächlichen Lizenz- und Copyright-Hinweise; Paket- und Abhängigkeitslizenzen werden einzeln auf Kompatibilität geprüft. Die AGPL-Projektlizenz entfernt keine Hinweise fremder MIT-/ISC-Komponenten. Veröffentlichungen und Serveroberflächen stellen den zur betriebenen Version gehörenden Quellcode samt Buildanleitungen bereit; Einzelheiten stehen in [Betrieb](docs/operations.md).

## Verbindlichkeit

Dieses Dokumentationspaket ist die Umsetzungsspezifikation vom 2. Oktober 2026. Bei Widersprüchen zwischen verbindlichen Quellen den Widerspruch benennen und betroffene Quellen vor abhängiger Implementierung gemeinsam korrigieren; bei unklarer Produktabsicht rückfragen. Die [Entscheidungen](docs/decisions.md) begründen Festlegungen, die spezifischen Fach- und Schnittstellendokumente beschreiben ihre Verträge. Produktänderungen müssen dort vor Umsetzung nachvollziehbar dokumentiert werden.
