# UX-Neugestaltung

## Auftrag und Audit

Am 5. Oktober 2026 ausdrücklich freigegeben: UX-01–UX-06. Ziel ist eine klare, markante und ruhige Finanzanwendung für Desktop und Mobil. P6–P10 bleiben spätere Fachpakete. Quellprüfung und gespeicherte synthetische Screenshots zeigen: offene Formulare verdrängen Listen; Verwaltung dominiert die Navigation; Mehr springt mobil zur Seitenleiste; gleichgewichtige Kennzahlen und primäre Buttons verwischen die Hierarchie. Die Kontosumme heißt künftig „Kontostand gesamt“, nicht „Verfügbares Geld“.

## Gestaltung

Systemschrift mit 16 px Fließtext, 14 px Zusatztext, 28 px Seitentitel und 36 px führender Zahl. Hell: #F7F8FA, #FFFFFF, #181B25, Akzent #4F46E5. Dunkel: #14161C, #1D2029, #F3F4F8, Akzent #A5B4FC. Semantische Tokens trennen Eingabegrenzen von dekorativen Trennlinien. 4-/8-Pixelraster, 8 px Kontroll- und 12 px Dialogrundung. Lucide-Icons mit Text beziehungsweise zugänglichem Namen. Normale Ausgaben neutral, destruktive Aktionen rot; niemals alleinige Farbcodierung. Übergänge 120–180 ms, reduced motion berücksichtigt.

## Navigation und Abläufe

Desktop ab 1024 px: Bereichswechsel und Übersicht/Buchungen/Konten; Einstellungen, Hilfe und Tresorsperre unten. Tablet 768–1023 px kompakter. Mobil unter 768 px: Bereichskopf und Übersicht/Buchungen/Mehr. Mehr ist eine eigene Ansicht. Import wird in Buchungen angeboten; Kategorien, Empfänger, Regeln, Dauerzahlungen und Farbschema liegen unter Einstellungen. Native Menüs öffnen dieselben Ansichten.

Übersicht: führende Kontosumme, Monatsausgaben/-einnahmen, fällige Vorschläge, letzte fünf Buchungen und kompakte Konten. Ohne Konten gezielter Einstieg. Kein großer Statuskasten ohne Handlungsbedarf.

Buchungen: Liste zuerst; Suche sichtbar, weitere Filter aufklappbar mit entfernbaren Chips. Desktoptabelle und eigene mobile Liste mit Datum, Empfänger, Betrag, Kategorie/Konto. Neue Buchung und Bearbeitung als Dialog, mobil bildschirmfüllend. Betrag ohne notwendiges Minus, Richtung Ausgabe/Einnahme; Erstattungen in Ausgabenkategorien möglich. Notiz/Splits bei Bedarf. Konto nur aus dem Kontokontext vorauswählen. Erfolg erst nach lokalem Commit; Entwürfe, Fokus und Listenposition erhalten.

Konten: Liste, Kontodetails mit Buchungen, Umbuchung und Abgleich. Optionale Anfangsbuchung zusammen mit Konto atomar über Fachkern. Verwaltung: Listen zuerst und gezielte Dialoge; getrennte Regeln-/Dauerzahlungsansichten, deutsche Wenn-dann-Beschreibungen. Import: Datei → Zuordnung → Vorschau → Bestätigung, Dubletten/Fehler explizit, bestätigte Gruppen fortsetzbar. Einstieg: Tresor → Rettungscode → erstes Konto; Entsperren ohne Serverlogin.

## Umsetzung und Abnahme

| Etappe | Ergebnis |
| --- | --- |
| UX-01 | Konzept, abgestimmte Spezifikation und synthetische Desktop-/Mobilentwürfe |
| UX-02 | Gemeinsame Tokens, Kontroll-/Dialog-/Statuskomponenten und geprüfte Kontraste |
| UX-03 | Bereichswechsel, Navigation, Einstellungen, Mehr und Übersicht |
| UX-04 | Buchungsliste/-dialoge, Kontodetails und atomarer Kontoeinstieg |
| UX-05 | Verwaltung, geführter Import und angeglichener Tresoreinstieg |
| UX-06 | Aktuelle Kriterienmatrix, Interaktion, Screenshots, Fehler-, Offline- und Leistungsbelege |

Jede Etappe hat Themenbranch, Zwischencommit und PR; keine direkte Mainintegration. UI-Zustand bleibt von Fachdaten getrennt. Keine neue Persistenzmigration; Konto plus Anfangsbestand benötigt einen clientinternen Fachbefehl.

Prüfung: Alltag einschließlich Erstattung, Splits, Transfer, Abgleich, Empfängermerge und Importwiederaufnahme; Quota/CAS/ungültige Beträge/Entwurfsabbruch; 320×568, 390×844, 768×1024, 1440×900, 1920×1080 jeweils Hell/Dunkel und 200 % Zoom. Lange deutsche Namen, siebenstellige Beträge. Tastatur, Fokusfang/-rückgabe, Screenreader und 44×44-px-Touchflächen; WCAG 2.2 AA. 50.000 Buchungen: Öffnen unter 2 s, warme Filter-/Scrollreaktion p95 unter 100 ms. Chromium, Firefox, WebKit; echte Geräte und native Desktopprüfung getrennt belegen.

Budget, Ausgleich, Berichte, Konflikte und Wiederherstellung übernehmen später dieselben Muster, ihre Fachfunktionen sind nicht Teil dieses Auftrags.

## Synthetische Entwürfe

[Desktop und Mobil](assets/ux-wireframes.svg) zeigen Übersicht, Buchungen, Erfassung und Kontodetails. Es handelt sich um Entwürfe, nicht um Laufzeitbelege. Aktuelle Abnahmebelege werden in [UX-Übergabe](handoffs/ux.md) geführt.
