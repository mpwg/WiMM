# Fachliche Architektur

## Begriffe und Invarianten

Ein Finanzbereich (`Space`) ist die Einheit für Konten, Kategorien, Budgets, Berechtigungen und Synchronisierung. Private Bereiche gehören einer Person, gemeinsame Bereiche einem Haushalt. Ein Haushalt besitzt genau einen gemeinsamen Bereich. Eine externe Serveridentität kann Mitglied mehrerer Haushalte sein; lokale fachliche Teilnehmer benötigen keine Anmeldung und sind keine Benutzerkonten.

Kontostände sind die Summe nicht gelöschter Buchungen einschließlich Anfangsbestand. Berichte, Budgets und Ausgleich sind reproduzierbare Projektionen; sie dürfen nicht als zusätzliche Buchungen zurückgeschrieben werden. Es gibt keine automatische Übernahme privater Daten in gemeinsame Berechnungen.

Verbindliche Invarianten:

1. Geldbeträge, Gewichte und sämtliche Zwischenwerte bleiben innerhalb sicherer Ganzzahlgrenzen; Überlauf lehnt den gesamten Befehl ab.
2. Splits summieren sich exakt zum Buchungsbetrag. Eine einfache kategorisierte Buchung hat einen Split.
3. Umbuchungspaare besitzen entgegengesetzte Beträge und dasselbe Datum; beide Seiten werden atomar geändert.
4. Personenanteile ergeben exakt den Betrag einer geteilten Ausgabe.
5. Jeder Ausgleichsvorgang hat ausgeglichene Gegenposten; die Summe aller Teilnehmerguthaben einschließlich Haushalt ist null.
6. Jeder Euro tatsächlicher Ausgabe wird je Berichtsperspektive genau einmal gezählt.
7. Finanzreferenzen liegen im gleichen Bereich, ausgenommen ausdrücklich lokale private Veröffentlichungszuordnungen. Solche Zuordnungen werden niemals gemeinsam synchronisiert.
8. Projektionen verwenden dieselbe Fachlogik auf allen autorisierten Clients. E2EE verhindert Finanzberechnung auf dem Server; empfangende Clients prüfen entschlüsselte Änderungen selbst.

## Geld, Datum und Konten

`Money` ist ein vorzeichenbehafteter ganzzahliger Centbetrag. Dezimaltexte werden über Vorzeichen, Ganzzahl und höchstens zwei Nachkommastellen eingelesen, nicht über Multiplikation einer Gleitkommazahl. API-Zahlen werden mit `Number.isSafeInteger` geprüft; gewichtete Multiplikation verwendet intern BigInt und prüft vor Rückgabe die Grenzen.

EUR ist v1-Rechenwährung. Kontenarten: `checking`, `cash`, `savings`, `credit`, `other`. Kreditkonten sind außerhalb des Umschlagbudgets; ein Wechsel zu budgetrelevant ist unzulässig. Andere Konten besitzen explizit `onBudget`. Negative Guthaben sind erlaubt und sichtbar, nicht automatisch auf null begrenzt.

Finanzdaten sind echte Kalenderdaten ohne Tageszeit. Eine Planung für November bleibt November, auch wenn ein technischer UTC-Zeitpunkt einen anderen lokalen Tag besitzt. Monatsschlüssel sind `YYYY-MM`; UTC-Zeitpunkte enthalten `Z`. Haushaltszeitzone ist standardmäßig `Europe/Vienna`.

## Buchungen, Umbuchungen und Berichte

Buchungsarten: `normal`, `opening`, `transfer`, `contribution`, `settlement`. Einnahmen positiv, Ausgaben negativ. Anfangsbestand ist keine Einnahme. Beiträge und Ausgleich sind in Verbrauchsberichten separat und keine Konsumausgaben. Zahlungsempfänger und Notiz sind optional; Konto, Datum und Betrag verpflichtend.

Normale Buchungen dürfen unzugeordnet sein; hierfür existiert die systemseitige Kategorie `uncategorized`. Kategoriegruppen unterscheiden Einnahmen und Ausgaben. Erstattungen dürfen positive Beträge in einer Ausgabenkategorie besitzen und mindern deren Nettoausgaben. Transfers haben keine Kategorie.

Beim Budgeteintritt dokumentiert `budgetRelease=true` die bestätigte Freigabe, beim Abgang verweist `budgetCategoryId` auf eine Ausgabenkategorie; die Transferseiten bleiben kategoriefrei.

Transfers zwischen budgetrelevanten und nicht budgetrelevanten Konten verändern das im Budget verfügbare Vermögen. Die Budgetseite des Transfers benötigt eine explizite Ausgabenkategorie beim Verlassen bzw. Freigabe vorhandenen Geldes beim Eintritt; der normale Einnahmen-/Ausgabenbericht bleibt transferfrei. Splits/Transfers sind jeweils vollständige Aggregate und kein Satz unabhängig änderbarer Zeilen.

Abgleichstatus: `uncleared`, `cleared`, `reconciled`. Abgleich bestätigt eine ausgewählte offene Buchungsmenge und einen Kontoauszugssaldo. Die Differenz ist Auszugssaldo minus Summe der bereits abgeglichenen Buchungen bis zum Auszugsdatum minus Summe der ausgewählten Bewegungen; alle Summen verwenden sichere Cent. Bereits bestätigte Ausgangsbuchungen werden mit CAS geprüft, aber nicht erneut einem Abgleich zugeordnet. Nur bei Differenz null wird gespeichert. Passt die Summe nicht, zeigt die UI die Differenz; eine Korrekturbuchung erfordert gesonderte Zustimmung. Reconciled-Buchungen müssen vor Änderungen atomar entsperrt werden. Die Entsperrung hebt ihren gesamten Abgleich auf; bei Transfers umfasst sie beide Seiten und transitiv alle verbundenen Abgleiche in einem Batch. Bereits freie Gegenbuchungen behalten ihren Status. Undo/Redo stellt die fachlichen Felder und vorherigen Abgleichstatus über reguläre Gegenbefehle wieder her, erhöht dabei Revisionen und bewahrt Tombstones; zwischenzeitliche Fremdänderungen werden abgewiesen.

Berichte unterscheiden Konsum, Kontobewegungen, persönliche Finanzperspektive und Haushaltsausgleich. Ein zusammengeführter Bericht darf nur Bereiche verwenden, die der aktuelle Benutzer sehen darf. Veröffentlichungslinks erlauben dort die Entfernung derselben privat und gemeinsam sichtbaren Ausgabe; sie erlauben keine Einsicht in den Rest des Privatbereichs.

## Planbudget

Je Monat und Kategorie werden Planbeträge in positiven Cent geführt. Ist-Einnahmen sind positive Einnahmensplits; Ist-Ausgaben sind negierte Ausgabensplits einschließlich Erstattungen. Ausgabeabweichung = Plan minus Ist, Einnahmeabweichung = Ist minus Plan. Geplante und tatsächliche Zahlen bleiben getrennt.

Vortragsdarstellung einer Kategorie zeigt bisher nicht verbrauchte Planbeträge, schafft jedoch kein reales Guthaben. Beispiel: Plan 300 EUR, Ist 250 EUR ergibt 50 EUR Abweichung; der Kontostand wird durch die Planvorgabe nicht verändert. Offene Dauerzahlungsvorschläge erzeugen nur Prognosewerte.

## Umschlagbudget

Für Kategorie c in Monat m gilt `available(c,m) = available(c,m-1) + assigned(c,m) - expense(c,m)`. Vorträge behalten ihr Vorzeichen. Bei erstmaligem Start ist der Vortrag null. Umverteilung erhöht eine Zuweisung und vermindert eine andere um exakt denselben Betrag.

`budgetEquity(m)` ist die Summe budgetrelevanter Kontostände zum Monatsende abzüglich offener, ausdrücklich vom Haushalt zu erstattender Vorleistungen. `unassigned(m) = budgetEquity(m) - sum(available(c,m))`. Kategorienüberträge werden also nicht ein zweites Mal als frei zuweisbares Geld angeboten. Künftige Monate verwenden nur bereits vorhandenes Geld; Prognoseeinnahmen bleiben separat.

Eine Zuweisung, die unassigned negativ macht, wird in v1 abgewiesen. Bereits eingetretene negative Kategorie- oder Kontostände durch reale Buchungen sind dagegen zulässig und hervorgehoben. Negative Kategorien bleiben bis zur Deckung negativ. Historische Budgetänderungen berechnen alle späteren Monatsprojektionen neu.

Beispiel: Anfangsguthaben 1.000 EUR, Zuweisung Lebensmittel 300 EUR und Rücklage 200 EUR: unassigned 500 EUR. Ausgabe Lebensmittel 100 EUR: Kontoguthaben 900 EUR, Kategorieverfügbarkeiten 200 + 200 EUR, unassigned weiter 500 EUR. Übertrag im Folgemonat ist 200/200 EUR; er wird nicht erneut zugewiesen.

Methodenwechsel werden als Historie zum ersten Tag eines Monats gespeichert. Beim ersten Umschlagmonat startet dessen Vortrag bei null; vorhandenes budgetrelevantes Vermögen ist neu zuweisbar. Beim Zurückwechseln bleiben alte Zuweisungen gespeichert, wirken aber nicht auf Planwerte. Kein automatisches Übersetzen von Prognosewerten in Umschlaggeld.

## Familienkosten und Ausgleich

Eine geteilte Ausgabe (`SharedExpense`) beschreibt Kosten und deren Verteilung, nicht eine zweite Kontobelastung. Quellen sind `household_transaction` oder `private_advance`. Gemeinsame Quellen referenzieren ein vollständiges Ausgabensplit oder eine ganze Buchung; mehrfaches Zuweisen desselben Splits ist unzulässig. Nicht verteilte gemeinsame Ausgaben bleiben Kosten des Haushalts.

Der Haushalt besitzt einen technischen Teilnehmer. Guthaben bedeutet: Ein Teilnehmer hat mehr finanziert als ihm Kosten zugeordnet wurden. Pro Ausgabe wird dem tatsächlichen Finanzierer der Betrag gutgeschrieben und den begünstigten Personen ihr Anteil abgezogen. Bei Finanzierung aus einem gemeinsamen Konto ist der Finanzierer der Haushalt; bei privater Vorleistung die zahlende Person.

Ein Beitrag Person → Haushalt schreibt der Person den Betrag gut und belastet den Haushalt. Ein Ausgleich Schuldner → Gläubiger erhöht das Guthaben des Schuldners und vermindert das des Gläubigers. Ein positiver Saldo ist eine Verrechnungsposition, nicht zwingend eine sofortige Erstattungsverpflichtung des Haushalts. Insbesondere Beiträge erzeugen keine automatische Rückzahlungsreserve.

Die Anwendung schlägt Zahlungen zwischen negativen und positiven Guthaben vor, deterministisch nach Teilnehmer-ID. Vorschläge sind unverbindlich und buchen nichts. Eine tatsächliche Zahlung muss bestätigt werden; es sind auch Teilbeträge und Zahlungen über den Haushalt zulässig. Physische Kontobuchungen und zugehöriger Ausgleich werden zusammen erfasst, soweit sie im gemeinsamen Bereich liegen.

### Vorleistungen und Budgetreserve

Private Vorleistungen besitzen zusätzlich eine explizite Erstattungsquelle `household` oder `participants`. Standard ist `household`: Der gesamte externe Betrag wird zunächst als Haushaltsverpflichtung reserviert, bis eine dokumentierte Erstattung oder Verrechnung ihn reduziert. Bei `participants` tragen die Personen die Kosten außerhalb der gemeinsamen Liquidität; die Ausgabe erscheint in Haushaltsberichten und Planbudgets, nicht im gemeinsamen Umschlagverbrauch. Diese Kennzeichnung ist im Erfassungsdialog sichtbar.

Bei `household` mindert eine private Vorleistung sowohl die Budgetreserve als auch die entsprechende Umschlagkategorie, ohne einen fiktiven Geldabgang auf einem Konto zu erzeugen. Eine Erstattung aus dem Haushaltskonto reduziert Kontoguthaben und Reserve um denselben Betrag; sie mindert nicht erneut die Kategorie. Direkte Personenzahlungen reduzieren die Haushaltsreserve nur, wenn ausdrücklich auf dieselbe Vorleistung angerechnet; eine Übernahme des Eigenanteils ist eine gesonderte dokumentierte Verrechnung. Beide werden als Finanzierung durch Personen geführt, nicht als Konsumeinnahmen.

Beispiel: A bezahlt 100 EUR privat, Anteile A/B 50/50, Erstattungsquelle Haushalt. Guthaben A +50, B -50, Haushalt 0; Reserve 100 EUR. B zahlt 50 EUR in den Haushalt: Guthaben B 0, Haushalt -50. A verrechnet seinen Eigenanteil von 50 EUR: keine neue Konsumausgabe, Reserve sinkt auf 50 EUR, Guthaben bleiben unverändert, weil eigene Kostenpflicht und Vorleistungsanspruch im gleichen Betrag verrechnet werden. Haushalt erstattet A die übrigen 50 EUR: A 0, Haushalt 0, Reserve 0. Im gesamten Ablauf bleiben Konsumausgaben 100 EUR. Die Eigenanteilsverrechnung erhöht das nicht zugewiesene Haushaltsbudget um 50 EUR als privat finanzierte Kostenübernahme, nicht als Konsumeinnahme.

### Verteilung und Historie

Methoden: `equal`, `weights`, `income`. Alle ausgewählten Personen nehmen teil; Archivierte werden für neue Verteilungen nicht vorausgewählt. Gewichte sind nichtnegative ganze Zahlen, Summe größer null. Einkommensgrundlagen sind freiwillig öffentlich angegebene monatliche Nettobeträge, niemals aus Privatbuchungen berechnet. Ohne positive Summe wird eine andere Methode verlangt.

Berechnung: `floor(amount * weight / totalWeight)` je Person; verbleibende Cent nach absteigendem Rest vergeben, bei Gleichstand nach UUID lexikografisch. Beispiel 1.001 Cent gleich für A/B mit A-ID vor B-ID: A 501, B 500. Bei Zahlung durch A erhält A +500 und B -500 Cent. Anteilsschlüssel werden je Ausgabe einschließlich Grundlagen eingefroren; eine neue Policy verändert nur neue Ausgaben ab ihrem Gültigkeitsdatum.

Änderung einer veröffentlichten Ausgabe ist ein eigener bestätigter Vorgang. Bereits angerechnete Erstattungen dürfen nicht durch eine nachträgliche Kürzung ungültig werden; erst Zahlungszuordnungen korrigieren. Das Löschen mit offenen Zuordnungen ist gesperrt. Private Änderungen lösen lediglich einen lokalen Hinweis auf möglichen Aktualisierungsbedarf aus.

## Rückerstattungen

Eine Lieferantenrückerstattung referenziert die ursprüngliche Ausgabe. Kumulierte Rückerstattungen dürfen deren Betrag nicht überschreiten. Für einen kumulierten Erstattungsbetrag wird die gleiche Restcentmethode auf die ursprünglichen Anteilssummen angewandt; die neue Rückerstattung ist die Differenz zum vorherigen kumulierten Ergebnis. Dadurch ergibt eine vollständige Erstattung exakt die ursprünglichen Anteile, auch nach vielen Teilzahlungen.

Rückerstattung kehrt Finanzierungs- und Kostenposten um. Empfang auf einem gemeinsamen Konto wird dort als kategorisierte positive Buchung verknüpft; privater Empfang wird explizit angegeben. Bereits erledigter Ausgleich wird nicht gelöscht, sondern gegebenenfalls ein neuer Anspruch erzeugt. Lieferantenrückerstattung und Ausgleich zwischen Personen sind verschiedene Vorgänge.

## Dauerzahlungen, Ziele, Löschung

Dauerzahlungen speichern Ausgangsdatum, Rhythmus, Intervall, optional Enddatum und Buchungsvorlage. Monatliche Fälligkeiten orientieren sich stets am ursprünglichen Tag: 31. Januar → 28./29. Februar → 31. März. Vorschläge tragen einen eindeutigen Schlüssel aus Schedule-ID und Fälligkeit; bestätigte Vorschläge werden nicht erneut angelegt. Importe können ausdrücklich mit einer vorhandenen Fälligkeit verbunden werden.

Regeln besitzen Reihenfolge, Bedingungen, Aktionen und `stopProcessing`; Bedingungen für Datum, Betrag, Zahlungsempfänger und Verwendungszweck; Aktionen für Kategorie, Empfänger und Abgleichstatus. Keine ausführbaren Skripte. Sparziele: positiver Zielbetrag, Kategorie, optional Zieldatum; Monatsrate ist verbleibender Betrag aufgerundet geteilt durch Anzahl verbleibender Monate einschließlich Zielmonat, im Minimum ein Monat.

Stammdaten werden bei Referenzen archiviert. Buchungen können nach Aufhebung des Abgleichs gelöscht werden; Tombstones bleiben bis zur neuen Synchronisierungsepoche erhalten. Historische Teilnehmer/Anteilsschlüssel und Zahlungszuordnungen werden nicht physisch gelöscht. Bereichslöschung ist eine gesonderte bestätigte Verwaltungsaktion, nicht eine Sammeloperation gewöhnlicher Buchungslöschungen.

## Summenprüfung vor lokalen Finanzänderungen

Finanzänderungen erhalten über `AggregateHeadReader.list(spaceId)` den vollständigen entschlüsselten Bereichsbestand. Buchungs-/Transferanlage, Änderung, Löschung, Import, Dauerzahlungsbestätigung und Gegenbefehle prüfen vor dem Write den resultierenden Bestand: Konto- und Gesamtsalden, Kategorie-/Verbrauchssummen und Monatssummen einschließlich sicherer Zwischenwerte. Ungültige Bestände werden kontrolliert abgewiesen; Geld wird nicht automatisch korrigiert.

Betroffene bisherige und neue Konten werden als vollständige revidierte CAS-Anker atomar mitgeschrieben. Alle für die Summenberechnung gelesenen vorhandenen Konten und Kategorie-/Gruppenrevisionen werden erwartet. Ein konkurrierender Write macht damit den vorbereiteten Finanzbefehl veraltet. Gegenbefehle verändern die Kontofelder nicht; sie erzeugen neue Ankerrevisionen und prüfen die Finanzprojektionen erneut.

Summenprüfungen und Konto-/Verbrauchsprojektionen verwenden dieselbe stabile Reihenfolge nach Buchungs-ID. Dadurch kann die unterschiedliche Rückgabereihenfolge von Memory, IndexedDB und SQLite keinen erst nach Speicherung erkannten Zwischenwertüberlauf erzeugen.
