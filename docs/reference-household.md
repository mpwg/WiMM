# Synthetischer Referenzhaushalt und Buchungsablauf

## Zweck und Grenzen

Dieser Datensatz beschreibt Beispiele für spätere Tests, Screenshots und Erklärungen. Es gibt noch keine Fixture-Dateien oder ausführbaren Tests. Alle Personen und Werte sind erfunden; IDs sind ausschließlich feste Test-IDs, produktive IDs bleiben zufällig. Die Beispiele erläutern [Fachmodell](domain.md), [Datenmodell](data-model.md) und [Synchronisierung](synchronization.md), ohne neue Verträge einzuführen. Sie enthalten keine Schlüssel, Nonces, Signaturen oder echten Crypto-Testvektoren.

## Feste Identitäten

| Objekt | Test-ID | Bedeutung |
| --- | --- | --- |
| Gemeinsamer Bereich | `10000000-0000-4000-8000-000000000001` | Haushalt „Beispielhaushalt“, EUR, Europe/Vienna |
| Privater Bereich A | `10000000-0000-4000-8000-000000000002` | Nur A zugänglich |
| Teilnehmer A | `20000000-0000-4000-8000-000000000001` | Alex, person |
| Teilnehmer B | `20000000-0000-4000-8000-000000000002` | Bea, person |
| Teilnehmer H | `20000000-0000-4000-8000-000000000003` | Technischer Haushalt, household |
| Gemeinsames Girokonto | `30000000-0000-4000-8000-000000000001` | checking, onBudget |
| Privates Girokonto A | `30000000-0000-4000-8000-000000000002` | Im privaten Bereich, checking, onBudget |
| Gemeinsame Kategorie Lebensmittel | `40000000-0000-4000-8000-000000000001` | Ausgabenkategorie |
| Gemeinsame Kategorie Rücklage | `40000000-0000-4000-8000-000000000002` | Ausgabenkategorie |
| Private Kategorie A | `40000000-0000-4000-8000-000000000003` | Ausgabenkategorie im privaten Bereich |
| Gemeinsame Buchung T | `50000000-0000-4000-8000-000000000001` | Einkauf im durchgängigen Beispiel |
| Split zu T | `60000000-0000-4000-8000-000000000001` | Lebensmittel |
| Private Buchung A | `50000000-0000-4000-8000-000000000002` | Quelle einer bestätigten Veröffentlichung |
| Geteilte Ausgabe E | `70000000-0000-4000-8000-000000000001` | Kopie im Haushalt, ohne private Quellen-ID |
| Operation O | `80000000-0000-4000-8000-000000000001` | Erster Sendversuch für T; Wiederholungen behalten diese ID |

Kategoriegruppen, Anfangsbuchungen und technische Crypto-/Revisionskontexte sind für zukünftige vollständige Fixtures zusätzlich nach dem Datenmodell anzulegen. Diese Tabelle ist kein vollständiger importierbarer Snapshot. A liegt lexikografisch vor B; Teilnehmer-IDs sind keine Anmeldeidentitäten oder Rollen.

## Drei unabhängige Szenarien

Jedes Szenario startet neu. Werte sind ganzzahlige Cent; Szenarien nicht zusammenrechnen. Die F01–F16 in [testing.md](testing.md) behalten jeweils ihren eigenen dokumentierten Ausgangsstand und ihre Erwartungen.

| Szenario | Eingabe/Ausgangsstand | Erwartung |
| --- | --- | --- |
| R01 Buchung und Umschlag | Gemeinsames Anfangsguthaben 100000; Oktober 2026 mit Vortrag 0, Lebensmittel 30000 und Rücklage 20000 zugewiesen; T am 02.10.2026: -10000, ein Split -10000 | Kontostand 90000; Konsumausgabe 10000; Lebensmittel 20000, Rücklage 20000, unassigned 50000; keine geteilte Ausgabe oder Teilnehmerverrechnung |
| R02 Private Veröffentlichung | Neues Szenario; A zahlt privat 1001, A/B gleich, reimbursementSource participants; A bestätigt E mit Betrag 1001 und Anteilen 501/500 | Guthaben A +500, B -500, H 0; Haushaltsreserve 0; gemeinsames Konto unverändert; Konsum 1001 in Haushaltssicht und berechtigter zusammengeführter Sicht jeweils einmal |
| R03 Kumulative Rückerstattung | Neues Szenario mit derselben ursprünglichen Verteilung 501/500 und privater Finanzierung durch A wie R02; A erhält Refunds 333 und 668 privat | Erste kumulierte Anteilsrücknahme 167/166, Restkosten 334/334; vollständige kumulierte Anteilsrücknahme 501/500, Restkosten 0/0; ohne zwischenzeitlichen Ausgleich sind alle Guthaben am Ende 0 |

R01 übernimmt die Rechnung aus F04 und illustriert Kontoführung aus F01, ohne dessen Einnahmefall zu ersetzen. R02 entspricht der Restcentrechnung F07 und dem participants-Weg aus F12 vor Zahlung. R03 entspricht F13. Private Buchung und gemeinsame Kopie bleiben eigene Datensätze; Doppelzählung wird nur in einer für beide Bereiche berechtigten Sicht über die private Zuordnung entfernt.

## Durchgängiger Ablauf einer Buchung

Der folgende Ablauf verwendet R01 und wird erst über P2/P3/P4/P8/P9 umgesetzt. Konto und Kategorie existieren bereits. Im verbundenen Fall sind Ausgangsdaten bestätigt, Gerät und Bereichsschlüssel aufgenommen und entsperrt. Dies ist eine Verhaltensbeschreibung, kein neuer Wirevertrag.

1. **Eingabe:** Die UI zeigt den gemeinsamen Bereich. Der Benutzer erfasst am 02.10.2026 einen Einkauf über 100,00 EUR. Der exakte Geldparser erzeugt -10000 Cent; die Oberfläche erzeugt `transaction.save` für T mit Split, clearance uncleared und erwarteter Buchungsrevision 0.
2. **Fachprüfung:** Der Client prüft Datum, sichere Ganzzahlen, vollständige Splitsumme, Bereichsreferenzen und Revisionen. Der Fachkern liefert ein vollständiges Änderungsset. Der Server wird dafür nicht benötigt.
3. **Lokaler Commit:** Der Speicheradapter prüft die lokalen erwarteten Revisionen erneut und schreibt Buchung samt Split, Projektionen sowie im verbundenen Fall Originalentwurf und Outbox atomar. R01 ergibt 90000 Cent Kontostand und 50000 Cent unassigned. Erst nach dauerhaftem Commit meldet die UI Erfolg; verbundene Daten stehen zunächst ausstehend.
4. **Transport vorbereiten:** Vor erstem Sendversuch bindet der Client den bestätigten Revisionsstand, erzeugt O und eine neue Nonce, verschlüsselt Fachbefehl und vollständige Aggregate und signiert die Hülle gemäß [E2EE-Vertrag](encryption.md). Öffentliche Handles sind unabhängig von den sprechend zugeordneten Test-IDs; Betrag, Kategorie, Kontoname und Notiz bleiben verschlüsselt.
5. **Servercommit:** Der Server prüft Sitzung, öffentliche Hülle, Zertifikat, signiertes Roster, Schlüsselversion, Receipt und CAS. Er speichert Heads, Chiffrat, Change und Receipt atomar. Er berechnet weder Kontostand noch Budget. accepted bedeutet Transportannahme, keine serverseitige Finanzabnahme.
6. **Bestätigung und Empfang:** Der sendende Client ordnet das Receipt seinem Entwurf zu und bestätigt den Stand atomar. Ein weiterer berechtigter Client prüft Manifestkette, Signatur, Kontext und Hashkette, entschlüsselt und validiert Schema, Referenzen und Fachinvarianten. Erst danach speichert er Pull-Seite, Projektionen und Cursor gemeinsam. Ungültige Inhalte werden quarantänisiert; der Cursor rückt nicht still darüber hinweg.

| Abweichung | Verhalten und passende Referenz |
| --- | --- |
| Vollständiger Lokalbetrieb | Gleicher Fachkern und atomarer Speicher; kein Pflichtlogin, kein Push und keine Outbox. Kein wartender Syncstatus ohne Serverbindung; S02 |
| Speicherfehler/Quota vor Commit | Gesamter lokaler Vorgang zurückgerollt; keine Teilbuchung, neue Projektion oder Outbox; Eingaben erhalten, kein Erfolg; S01/S03 |
| Verbindung bricht nach Servercommit ab | O einschließlich Nonce, Signatur und Chiffrat unverändert erneut senden; identischer Hash liefert gleiches Receipt, keine zweite Buchung; S04/S05 |
| Zwei Geräte ändern später T auf derselben Revision | Eine Änderung angenommen, andere als Konflikt erhalten; bestätigter Stand und lokaler Entwurf sichtbar, nur abhängige Entwürfe blockiert. Auflösung nach Prüfung als neue Operation gegen aktuelle Revision; S06/S07 |
| Finanzinhalt nach Entschlüsselung ungültig | Keine Anwendung oder Cursorfortschreibung; Quarantäne und sichtbarer Reparaturbedarf; C02 und E2EE-Vertrag |

## Private Daten bleiben getrennt

R02 verwendet einen anderen Ablauf als R01: A bestätigt die öffentlichen Felder für E ausdrücklich. Private Kontonamen, Notizen, Buchungs-/Split-IDs und Summen werden nicht in E kopiert. Der PublicationLink liegt nur im privaten Bereich; kein Push enthält beide Bereiche. Private Buchung, gemeinsame Kopie und Link werden zunächst lokal atomar angelegt beziehungsweise zugeordnet. Bei abgelehntem Haushaltspush bleibt die Privatbuchung erhalten und der Link pending/rejected (S13). Änderungen der privaten Quelle veröffentlichen keine automatische Aktualisierung.
