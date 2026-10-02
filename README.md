# WhereIsMyMoney

WhereIsMyMoney ist ein geplanter Open-Source-Finanzmanager für Familien. Gemeinsame Haushaltsfinanzen, persönliche Finanzbereiche, Budgetplanung und ein nachvollziehbarer Ausgleich zwischen Erwachsenen stehen im Mittelpunkt.

**Projektstatus: Dokumentationsphase. Es gibt noch keine lauffähige Anwendung.** Anwendungscode, Paketkonfiguration, Infrastruktur und Installationspakete wurden noch nicht angelegt. Der Auftrag für diese Übergabe umfasst ausschließlich D0; die Implementierung der Pakete P1 bis P11 benötigt einen späteren ausdrücklichen Auftrag.

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

1. [Arbeitsregeln](AGENTS.md) lesen.
2. Im [Dokumentationsindex](docs/README.md) die Lesereihenfolge beachten.
3. [Fachliche Architektur](docs/domain.md), [technische Architektur](docs/architecture.md) und [Entscheidungen](docs/decisions.md) verstehen.
   Zusätzlich [Verschlüsselung und Schlüsselverwaltung](docs/encryption.md) vor Speicher-/Syncarbeit lesen.
4. Bei einem ausdrücklichen Implementierungsauftrag das erste offene, freigegebene [Arbeitspaket](docs/tasks.md) mit erfüllten Voraussetzungen übernehmen.
5. Paket anhand der [Test- und Abnahmeregeln](docs/testing.md) abschließen und seinen Status aktualisieren.

## Verhältnis zu Actual Budget

[Actual Budget](https://github.com/actualbudget/actual) ist Funktionsreferenz und mögliche Quelle ausgewählter Importer, Berechnungen und Tests. WhereIsMyMoney wird überwiegend eigenständig entwickelt. Ein vollständiger Fork, dessen Oberflächendesign oder dessen Synchronisierungsprotokoll sind nicht vorgesehen.

WhereIsMyMoney einschließlich seiner eigenen Dokumentation und des späteren eigenen Anwendungscodes steht unter **GNU Affero General Public License, Version 3 oder neuer (AGPL-3.0-or-later)**. Der vollständige Lizenztext steht in [LICENSE](LICENSE); die Wahl einer späteren Version ergibt sich aus diesem ausdrücklichen Projektlizenzhinweis.

Übernommene Bestandteile behalten ihre tatsächlichen Lizenz- und Copyright-Hinweise; Paket- und Abhängigkeitslizenzen werden einzeln auf Kompatibilität geprüft. Die AGPL-Projektlizenz entfernt keine Hinweise fremder MIT-/ISC-Komponenten. Veröffentlichungen und Serveroberflächen stellen den zur betriebenen Version gehörenden Quellcode samt Buildanleitungen bereit; Einzelheiten stehen in [Betrieb](docs/operations.md).

## Verbindlichkeit

Dieses Dokumentationspaket ist die Umsetzungsspezifikation vom 2. Oktober 2026. Bei widersprüchlichen technischen Einzelheiten gelten die [Entscheidungen](docs/decisions.md) und die spezifischen Fach- und Schnittstellendokumente. Produktänderungen müssen dort vor Umsetzung nachvollziehbar dokumentiert werden.
