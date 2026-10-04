# P4 — Teilaufgaben für Oberfläche und native App

## Auftrag und Reihenfolge

Diese Teilaufgaben konkretisieren [P4](tasks.md#p4--oberfläche-und-native-app). P4.1 wird auf Nutzerwunsch vom 4. Oktober 2026 erneut geprüft; P4.2 besitzt eine Teilimplementierung aus einem ausdrücklichen Nutzerauftrag vom 3. Oktober 2026, erfüllt nach der Nachprüfung ihre Abnahmen jedoch noch nicht. Die bisherigen Freigaben stehen bei den Sammelaufgaben und gelten für deren Unteraufgaben weiter. Dieser Auftrag vom 4. Oktober 2026 ändert ausschließlich die Aufgabenplanung; er startet keine Implementierung. P4.1 bis P4.6 sind Sammelaufgaben; bearbeitet und abgenommen werden künftig ihre unten aufgeführten kleinen Unteraufgaben nach abgeschlossenem [P3](p3-storage.md). Die verbindliche Gestaltung steht in [ui.md](ui.md); spätere Budget-, Import-, Familien- und Syncflächen entstehen in ihren Paketen.

Status und konkrete Prüfbelege hier sowie den Gesamtstatus in [tasks.md](tasks.md) pflegen; nach jedem abgeschlossenen Abschnitt einen zusammengehörigen Zwischencommit und eine [Übergabe](templates/handoff.md) erstellen. P4 ist erst nach allen Teilabnahmen und der Gesamt-Abnahme erledigt; danach folgt [P5](p5-import.md). Für die Umsetzung wimm-ui verwenden, bei Schlüsselbedienung zusätzlich wimm-e2ee. Native Prüfungen und Browseremulation getrennt belegen.

## Kleine Arbeitsaufträge und Abschlussregeln

Ein Auftrag umfasst genau eine Unteraufgabe, einen beobachtbaren Ablauf und dessen unmittelbare Prüfungen. Richtgröße ist ein zusammenhängender Abschnitt in einer Agentensitzung, kein vollständiges P4.x-Paket. Falls währenddessen weitere unabhängige Funktionen nötig werden, diese vor der Umsetzung als eigene Unteraufgabe dokumentieren. Eine garantierte Umsetzung lässt sich nicht aus der Größe ableiten; die Abnahme entscheidet anhand des tatsächlichen Verhaltens.

Vorhandenen Code und historische Prüfbelege weiterverwenden, zunächst gegen die konkrete Unterabnahme prüfen und nur die verbleibende Lücke schließen. Alle neuen Unteraufgaben starten als `offen`, weil ihre vollständige Einzelabnahme noch nicht dokumentiert ist; das setzt keine vorhandene Implementierung zurück. Auch P4.1 wird erneut einzeln abgenommen; vorhandene Funktionen werden nur bei festgestellter Lücke geändert. Die bisherigen P4.x-Anker und Nachweise bleiben bestehen. Eine historische Abnahme gilt nicht automatisch als neue Einzelabnahme.

Die Reihenfolge steht in der Tabelle; innerhalb einer Gruppe gilt zusätzlich die konkrete Voraussetzung der Unteraufgabe. Fehlende native Plattformen blockieren nur ihren Nachweis: unabhängige Prüfungen dürfen weiterlaufen, die offene Plattformzelle und der Gesamtabschluss bleiben sichtbar. Browserprüfung des Desktop-Frontends ersetzt niemals einen nativen Nachweis. P3 verlangt noch echte Network-off-PWA- und native Disk-full-Nachweise; diese bleiben in P4.3.8 beziehungsweise P4.6.6 ausdrücklich enthalten.

Für jede Unteraufgabe: Schritte und Abnahme erfüllen, gezielte Tests mit Ergebnis/Umgebung dokumentieren, Status aktualisieren, Zwischencommit und kurze Übergabe erstellen. Der Sammelauftrag wird erst nach allen zugehörigen Unterabnahmen erledigt. Übergreifende Browser-, Screenshot-, Zoom-, Screenreader- und Plattformprüfungen werden einzeln in P4.6 abgenommen; sie entfallen dadurch bei keiner Sammelabnahme. Fachlogik bleibt im vorhandenen Fachkern. Import/Export, Budget und Synchronisierung behalten ihren späteren Paketumfang; Serverkonfliktansichten entstehen erst in P9. Die P4-Screenshotmatrix umfasst deshalb die bereits vorhandenen Ansichten, keine vorgezogenen Budget-/Import-/Ausgleichsflächen.

| Sammelaufgabe | Kleine Arbeitsaufträge | Abschluss |
| --- | --- | --- |
| P4.1 | P4.1.1–P4.1.8 | Dienste, Erstnutzung, Sperren, Recovery, Schlüsselpersistenz, Trennung, PWA und nativer Einstieg einzeln |
| P4.2 | P4.2.1–P4.2.7 | Navigation, Zahlen, Stammdaten, Layout und Fokus einzeln |
| P4.3 | P4.3.1–P4.3.8 | Erfassung, Splits, Bearbeitung, Löschen, Suche, Virtualisierung, Commit und Neustart einzeln |
| P4.4 | P4.4.1–P4.4.7 | Transfer, Abgleich, Entsperren, Bestätigung, Undo, Redo und Entwurfsschutz einzeln |
| P4.5 | P4.5.1–P4.5.7 | Menüs, Kurzbefehle, Öffnen, Speichern, Links, Capabilities und native Prüfung einzeln |
| P4.6 | P4.6.1–P4.6.7 | Browser, Screenshots, Zoom, Screenreader, Leistung, Plattformen und Gesamtabschluss einzeln |

Nächster konkreter Arbeitsauftrag: **P4.1.8 — Nativen lokalen Einstieg nach Neustart prüfen**. Beispiel für einen begrenzten Folgeauftrag: „Prüfe P4.1.8 vollständig, schließe festgestellte Lücken und dokumentiere nur dessen Abnahme.“

## P4.1 — Composition Root und lokaler Einstieg

- Status: in Arbeit — historische Abnahme vom 4. Oktober 2026 auf Nutzerwunsch wieder geöffnet; erneute Einzelabnahmen erforderlich.
- Freigabe: Nutzerauftrag zum vollständigen Abschluss von P4.
- Voraussetzungen: P3 erledigt.
- Schritte: gemeinsame Clientdienste und PlatformServices in Web/Desktop injizieren; lokalen Profil-/Bereichseinstieg, Tresorentsperrung und Rettungscodesicherung anbinden; Routing und flüchtigen UI-Zustand von Fachdaten trennen.
- Ergebnis: lokal startfähige App mit explizitem aktivem Bereich und injizierten Plattformdiensten.
- Verträge: [Architektur](architecture.md), [Produktabläufe](product.md), [Schlüsselbedienung](ui.md#schlüsselbedienung).
- Abnahme: Standalone ohne Anmeldung/Serverkonfiguration nutzbar; gesperrter Tresor zeigt keine Finanzansicht; Bereichswechsel übernimmt keine privaten Daten in andere Bereiche.
- Prüfungen: lokale Erstnutzung, Entsperren/Sperren und Offline-Neustart auf beiden Clients; Dienst-/Bereichswechsel mit synthetischen Profilen.
- Prüfbelege: `packages/ui` stellt für Web und Desktop denselben Composition Root mit injiziertem Profil- und `PlatformServices`-Port bereit. Ein neuer Tresor wird mit einer lokalen Passphrase angelegt; der Rettungscode wird ausschließlich einmalig angezeigt und muss vor dem lokalen Start bestätigt werden. `lockUserVault` entfernt geladene private Schlüssel und zeigt wieder nur den Sperrbildschirm. Der neue Schlüssel eines Haushalts wird über `persistUnlockedUserVault` mit frischer Nonce in die bestehende, verschlüsselte Tresorhülle geschrieben; die Passphrase- und Rettungscodehüllen bleiben erhalten. Die Crypto- und UI-Unit-Tests prüfen den Haushalt nach Sperren und lokalem Neustart über beide Entsperrwege. `tests/ui/p4-1.spec.ts` prüft im Chromium die vollständige Interaktion Tresor anlegen → Rettungscode bestätigen → Haushalt anlegen → sperren → entsperren → Offline-Neustart. Der gleiche Ablauf läuft gegen das Desktop-Frontend. `pnpm test:ui`, TypeScript sowie der Web- und Desktop-Produktionsbuild bestanden am 4. Oktober 2026. Der gebündelte Tauri-Start wurde auf macOS arm64 ohne Serverkonfiguration visuell bis zum Formular „Lokalen Tresor anlegen“ geprüft; die CSP erlaubt dafür ausschließlich zusätzlich `wasm-unsafe-eval` für die verwendete libsodium-WASM-Bindung.

### P4.1.1 — Gemeinsame Dienste und Plattformports prüfen

- Status: erledigt (4. Oktober 2026).
- Freigabe: ausdrücklicher Nutzerauftrag „mach P4.1.1 fertig“ vom 4. Oktober 2026.
- Voraussetzungen: P3 erledigt; reale Plattformnachweise sind weiterhin offen und in den Abschlussregeln zugeordnet.
- Schritte: Composition Root und injizierte Dienste in Web/Desktop nachverfolgen; nur Verdrahtungslücken schließen.
- Ergebnis: Die gemeinsame Fachansicht erhält ihren lokalen Speicher ausschließlich vom Composition Root. Web injiziert `IndexedDbStorageAdapter`; die Tauri-App injiziert eine begrenzte SQLite-Brücke für Bereichsabfrage und atomare Schreibmengen. Der Desktop erhält außerdem einen eigenen `PlatformServices`-Port; noch nicht freigegebene Systemfunktionen fallen nicht auf Browserverhalten zurück.
- Verträge: [Architektur](architecture.md), [Schlüsselbedienung](ui.md#schlüsselbedienung), [Verschlüsselung](encryption.md), [P3-Speicherbasis](p3-storage.md).
- Abnahme: Beide Clients verwenden gemeinsame lokale Dienste und den jeweils richtigen Speicher-/Plattformadapter; UI-Zustand ist von gespeicherten Fachdaten getrennt; lokale Nutzung benötigt keine Outbox oder Serverbestätigung.
- Prüfungen: Gezielte UI-Integration für beide Clientkompositionen, TypeScript und Paketgraph; tatsächlichen Adapter benennen.
- Prüfbelege: Kriterienmatrix: (1) gemeinsame lokale Dienste und richtige Adapter **erfüllt** — `FinanceWorkspace` ist adapterneutral; Web verwendet Dexie/IndexedDB, Desktop die katalogisierten Tauri-Befehle `storage_query_aggregates` und `storage_apply_batch`; der neue Brückentest prüft die Bereichsabfrage. (2) UI-Zustand getrennt von Fachdaten **erfüllt** — Ansichtszustand bleibt in React, dauerhaftes Lesen/Schreiben läuft nur über den injizierten Speicherport. (3) Standalone ohne Outbox/Serverbestätigung **erfüllt** — lokale Änderungsmengen enthalten eine leere Outbox; `pnpm test:ui` bestätigt den lokalen Ablauf in Chromium für Web und Desktop-Frontend. Aktuell bestanden: `pnpm typecheck`, `pnpm check:package-graph`, `pnpm --filter @wimm/storage test` (9 Tests), `pnpm --filter @wimm/ui test` (4 Tests), `cargo test` im Tauri-Projekt, Web-/Desktop-Frontendbuild und `pnpm test:ui` (3 Web- plus 1 Desktop-Frontend-Test).
- Einschränkungen: Die Desktop-Frontend-Prüfung läuft ohne Tauri-Laufzeit mit einem ausdrücklich gekennzeichneten IndexedDB-Fallback und ist kein nativer Nachweis. Der native Tauri-Speicherport ist durch Rust-Test und Produktionsbuild geprüft; ein vollständiger nativer Wiedereinstieg bleibt korrekt P4.1.8 vorbehalten.

### P4.1.2 — Tresor-Erstnutzung und Rettungscodebestätigung prüfen

- Status: erledigt (4. Oktober 2026).
- Freigabe: ausdrücklicher Nutzerauftrag „setze P4.1.2 um“ vom 4. Oktober 2026.
- Voraussetzungen: P4.1.1 abgenommen.
- Schritte: Vorhandene lokale Anlage mit Passphrase, einmaliger Codeanzeige und Sicherungsbestätigung erneut prüfen.
- Ergebnis: Tresor-Erstnutzung und Rettungscodebestätigung prüfen mit erneuter Einzelabnahme.
- Verträge: [Architektur](architecture.md), [Schlüsselbedienung](ui.md#schlüsselbedienung), [Verschlüsselung](encryption.md), [P3-Speicherbasis](p3-storage.md).
- Abnahme: Ohne Server/Anmeldung anlegbar; vor Codebestätigung keine Finanzansicht; Code nicht in Logs oder dauerhaftem UI-Zustand abgelegt.
- Prüfungen: Chromium auf Web und Desktop-Frontend: Anlage → unbestätigt → bestätigt; Fehleingaben und abgebrochene Anlage.
- Prüfbelege: Kriterienmatrix: (1) lokale Anlage ohne Server oder Anmeldung **erfüllt** — je drei Chromium-Playwright-Abläufe gegen Web und Desktop-Frontend erstellen den Tresor bis zur Rettungscodeansicht und öffnen den Bereich nach Bestätigung. (2) keine Finanzansicht vor der Bestätigung **erfüllt** — der Bestätigungsbefehl bleibt deaktiviert, bis die Sicherung bestätigt ist; die Übersicht ist vorher nicht im DOM. (3) kein Rettungscode in Logs oder dauerhaftem UI-Zustand **erfüllt** — der Ablauf prüft `localStorage` und Browser-Konsolenmeldungen auf den angezeigten synthetischen Code; ein Reload vor der Bestätigung führt ohne gespeichertes Profil wieder zur Anlage. Fehleingaben bleiben als zuordenbare Meldung am Formular, damit die Passphrase korrigiert werden kann. Aktuell bestanden: `pnpm exec playwright test tests/ui/p4-1.spec.ts` (3 Chromium-Webtests), `WIMM_CLIENT=desktop pnpm exec playwright test --config tests/ui/desktop.config.ts` (3 Chromium-Desktop-Frontendtests), `pnpm --filter @wimm/ui test` (4 Tests) und `pnpm typecheck`.
- Einschränkungen: Die Desktop-Frontend-Prüfung ist bewusst kein nativer Tauri-Nachweis; der vollständige native Wiedereinstieg bleibt P4.1.8.

### P4.1.3 — Sperren und Passphrase-Entsperrung prüfen

- Status: erledigt (4. Oktober 2026).
- Freigabe: ausdrücklicher Nutzerauftrag „setz das um: P4.1.3 (Sperren und Passphrase-Entsperrung)“ vom 4. Oktober 2026.
- Voraussetzungen: P4.1.2 abgenommen.
- Schritte: Sperren, falsche und richtige Passphrase sowie erneutes Öffnen der App prüfen.
- Ergebnis: Sperren und Passphrase-Entsperrung prüfen mit erneuter Einzelabnahme.
- Verträge: [Architektur](architecture.md), [Schlüsselbedienung](ui.md#schlüsselbedienung), [Verschlüsselung](encryption.md), [P3-Speicherbasis](p3-storage.md).
- Abnahme: Sperren entfernt flüchtige private Schlüssel und Finanzansicht; falsche Passphrase gibt keine Daten frei; richtige stellt denselben Bereich her.
- Prüfungen: Crypto-/UI-Integration für Schlüsselentfernung plus Chromium-Sperrablauf auf beiden Frontends; Prüfung nach Neustart.
- Prüfbelege: Kriterienmatrix: (1) Sperren entfernt flüchtige private Schlüssel und Finanzansicht **erfüllt** — der Crypto-Test prüft das Überschreiben von Identitäts-, Verschlüsselungs- und Bereichsschlüsselmaterial und verhindert danach jede Tresorpersistenz; je ein Chromium-Ablauf für Web und Desktop-Frontend prüft zusätzlich, dass nach „Tresor sperren“ weder Übersicht noch Privatbereich im DOM bleiben. (2) falsche Passphrase gibt keine Daten frei **erfüllt** — beide Frontends zeigen die zuordenbare Fehlermeldung und öffnen keine Finanzansicht. (3) richtige Passphrase stellt denselben Bereich nach Neustart her **erfüllt** — beide Abläufe laden nach einem echten Seitenneustart wieder den lokalen Tresor, entsperren ihn mit der korrekten Passphrase und zeigen wieder „Privater Bereich“. Aktuell bestanden: `pnpm --filter @wimm/crypto test` (13 Tests), `pnpm exec playwright test tests/ui/p4-1-3.spec.ts` (1 Chromium-Webablauf), `WIMM_CLIENT=desktop pnpm exec playwright test tests/ui/p4-1-3.spec.ts --config tests/ui/desktop.config.ts` (1 Chromium-Desktop-Frontendablauf), `pnpm test:ui` (6 Web- und 4 Desktop-Frontendabläufe), `pnpm --filter @wimm/ui test` (4 Tests) und `pnpm typecheck`.
- Einschränkungen: Die Desktop-Frontend-Prüfung ist kein vollständiger nativer Tauri-Nachweis; dieser bleibt P4.1.8 zugeordnet.

### P4.1.4 — Rettungscode-Entsperrung separat prüfen

- Status: erledigt (4. Oktober 2026).
- Freigabe: ausdrücklicher Nutzerauftrag „Setze P4.1.4 um“ vom 4. Oktober 2026.
- Voraussetzungen: P4.1.3 abgenommen.
- Schritte: Entsperrung mit gespeichertem Tresor und Rettungscode ohne vorhandene flüchtige Schlüssel prüfen.
- Ergebnis: Rettungscode-Entsperrung separat prüfen mit erneuter Einzelabnahme.
- Verträge: [Architektur](architecture.md), [Schlüsselbedienung](ui.md#schlüsselbedienung), [Verschlüsselung](encryption.md), [P3-Speicherbasis](p3-storage.md).
- Abnahme: Richtiger Code stellt vorhandene Bereiche wieder her; falscher Code verändert keinen Speicher und gibt keine Daten frei.
- Prüfungen: Crypto-/UI-Integration und Chromium mit frischer Clientinstanz auf Web und Desktop-Frontend; kein unverschlüsselter Recoveryfallback.
- Prüfbelege: Kriterienmatrix: (1) Richtiger Code stellt vorhandene Bereiche wieder her **erfüllt** — der Crypto-Integrationstest entsperrt den gespeicherten Tresor über den Rettungscode; je ein Chromium-Ablauf für Web und Desktop-Frontend überträgt ausschließlich den verschlüsselten lokalen Profilstand in eine frische Clientinstanz und öffnet damit den gespeicherten „Privater Bereich“. (2) Falscher Code verändert keinen Speicher und gibt keine Daten frei **erfüllt** — der Crypto-Test vergleicht die Tresorhülle vor und nach der Ablehnung; beide Frontend-Abläufe behalten den Sperrbildschirm bei und vergleichen den `localStorage`-Profildatensatz bytegleich. (3) Kein unverschlüsselter Recoveryfallback **erfüllt** — die Frontend-Abläufe prüfen, dass der einmalig angezeigte synthetische Rettungscode nicht im lokalen Speicher liegt; der erfolgreiche Wiedereinstieg verwendet nur die verschlüsselte Tresorhülle. Aktuell bestanden: `pnpm --filter @wimm/crypto test` (14 Tests), `pnpm exec playwright test tests/ui/p4-1-4.spec.ts` (1 Chromium-Webablauf), `WIMM_CLIENT=desktop pnpm exec playwright test tests/ui/p4-1-4.spec.ts --config tests/ui/desktop.config.ts` (1 Chromium-Desktop-Frontendablauf), `pnpm --filter @wimm/ui test` (4 Tests) und `pnpm typecheck`.
- Einschränkungen: Die Desktop-Frontend-Prüfung ist kein vollständiger nativer Tauri-Nachweis; dieser bleibt P4.1.8 zugeordnet.

### P4.1.5 — Haushaltsschlüssel dauerhaft sichern

- Status: erledigt (4. Oktober 2026).
- Freigabe: ausdrücklicher Nutzerauftrag „setze p4.1.5 um“ vom 4. Oktober 2026.
- Voraussetzungen: P4.1.4 abgenommen.
- Schritte: Haushaltanlage und persistUnlockedUserVault einschließlich Fehler vor Commit und erneuter Entsperrung prüfen.
- Ergebnis: Haushaltsschlüssel dauerhaft sichern mit erneuter Einzelabnahme.
- Verträge: [Architektur](architecture.md), [Schlüsselbedienung](ui.md#schlüsselbedienung), [Verschlüsselung](encryption.md), [P3-Speicherbasis](p3-storage.md).
- Abnahme: Neuer Haushalt bleibt nach Neustart über Passphrase und Code verfügbar; frische Nonce; Fehler meldet keinen erfolgreichen dauerhaft angelegten Haushalt.
- Prüfungen: Gezielte Crypto-/UI-Integration für beide Entsperrwege und Speicherfehler; UI-Neustartablauf je Client.
- Prüfbelege: Kriterienmatrix: (1) Neuer Haushalt bleibt nach Neustart über beide Entsperrwege verfügbar **erfüllt** — der gezielte Chromium-Ablauf legt einen Haushalt an, übergibt ausschließlich den dauerhaften Clientzustand an zwei frische Clientinstanzen und erreicht den Haushalt jeweils mit Passphrase beziehungsweise Rettungscode. Der Ablauf bestand für Web und Desktop-Frontend. (2) Frische Nonce **erfüllt** — derselbe Ablauf vergleicht die persistierte Tresornonce vor und nach der Haushaltanlage; sie ist verschieden. (3) Fehler vor Commit meldet keinen dauerhaft angelegten Haushalt **erfüllt** — der UI-Integrationstest sperrt den Tresor vor der Anlage, erwartet die Ablehnung und prüft das unveränderte Profil mit genau einem weiter entsperrbaren Bereich; der Fehlerpfad löscht den nur flüchtig erzeugten Bereichsschlüssel. Aktuell bestanden: `pnpm --filter @wimm/crypto test` (14 Tests), `pnpm --filter @wimm/ui test` (5 Tests), `pnpm exec playwright test tests/ui/p4-1-5.spec.ts` (1 Chromium-Webablauf), `WIMM_CLIENT=desktop pnpm exec playwright test tests/ui/p4-1-5.spec.ts --config tests/ui/desktop.config.ts` (1 Chromium-Desktop-Frontendablauf) und `pnpm typecheck`.
- Einschränkungen: Die Desktop-Frontend-Prüfung ist kein vollständiger nativer Tauri-Nachweis; dieser bleibt P4.1.8 zugeordnet.

### P4.1.6 — Profil- und Bereichstrennung prüfen

- Status: erledigt (4. Oktober 2026).
- Freigabe: ausdrücklicher Nutzerauftrag „setze P4.1.6 um“ vom 4. Oktober 2026.
- Voraussetzungen: P4.1.5 abgenommen.
- Schritte: Zwei synthetische Profile sowie private/gemeinsame Bereiche mit unterschiedlichen Daten und UI-Entwürfen wechseln.
- Ergebnis: Profil- und Bereichstrennung prüfen mit erneuter Einzelabnahme.
- Verträge: [Architektur](architecture.md), [Schlüsselbedienung](ui.md#schlüsselbedienung), [Verschlüsselung](encryption.md), [P3-Speicherbasis](p3-storage.md).
- Abnahme: Nur aktiver Bereich lesbar; keine privaten Daten oder Entwürfe gelangen in andere Bereiche/Profile; gesperrte Bereiche zeigen keine Finanzdaten.
- Prüfungen: Integration der Profil-/Bereichsdienste und Chromium-Wechsel mit unterscheidbaren Fixtures; kein bloßer Wechsel der Überschrift.
- Prüfbelege: Kriterienmatrix: (1) Nur aktiver Bereich lesbar **erfüllt** — der Chromium-Ablauf legt ein privates Konto und ein Haushaltskonto mit eindeutig verschiedenen Namen an und zeigt beim jeweiligen Wechsel ausschließlich das Konto des aktiven Bereichs. (2) Keine privaten Daten oder Entwürfe gelangen in andere Bereiche/Profile **erfüllt** — ein ungespeicherter privater Kontonamenentwurf wird beim Wechsel in den Haushalt verworfen; ein zweites synthetisches Profil sieht weder private noch gemeinsame Daten des ersten, und das wiederhergestellte erste Profil sieht keine Daten des zweiten. (3) Gesperrte Bereiche zeigen keine Finanzdaten **erfüllt** — nach `Tresor sperren` ist nur das Entsperrformular sichtbar; Übersicht und Kontoname des aktiven Bereichs fehlen. Der Ablauf bestand am 4. Oktober 2026 mit `pnpm exec playwright test tests/ui/p4-1-6.spec.ts` im Chromium-Webclient und mit `WIMM_CLIENT=desktop pnpm exec playwright test tests/ui/p4-1-6.spec.ts --config tests/ui/desktop.config.ts` im Chromium-Desktop-Frontend. Zusätzlich bestanden `pnpm --filter @wimm/ui test` (5 Tests) und `pnpm typecheck`.
- Einschränkungen: Die Desktop-Frontend-Prüfung ist kein vollständiger nativer Tauri-Nachweis; der vollständige native Wiedereinstieg bleibt P4.1.8 zugeordnet.

### P4.1.7 — PWA-Einstieg nach Offline-Neustart prüfen

- Status: erledigt (4. Oktober 2026).
- Freigabe: ausdrücklicher Nutzerauftrag „Setze P4.1.7 um“ vom 4. Oktober 2026.
- Voraussetzungen: P4.1.6 abgenommen.
- Schritte: Nach Erstladen Tresor und Haushalt anlegen; Netzwerk ausschalten, App neu starten und lokal entsperren.
- Ergebnis: PWA-Einstieg nach Offline-Neustart prüfen mit erneuter Einzelabnahme.
- Verträge: [Architektur](architecture.md), [Schlüsselbedienung](ui.md#schlüsselbedienung), [Verschlüsselung](encryption.md), [P3-Speicherbasis](p3-storage.md).
- Abnahme: App-Assets starten ohne Netz; Passphrase und Rettungscode erreichen den gespeicherten Haushalt; keine Anmeldung/Serverkonfiguration nötig.
- Prüfungen: Echter Network-off-Chromium-Ablauf mit dokumentierter PWA-/Service-Worker-Version; native Prüfung separat P4.1.8.
- Prüfbelege: Kriterienmatrix: (1) App-Assets starten ohne Netz **erfüllt** — der Chromium-Webablauf installiert zuerst die PWA, wartet auf die Service-Worker-Kontrolle und bestätigt den Cache `wimm-app-assets-v1`; nach dem Schließen der Seite lädt eine neue Seite bei deaktiviertem Netzwerk `/` mit Status 200. (2) Passphrase und Rettungscode erreichen den gespeicherten Haushalt **erfüllt** — vor dem Offline-Neustart wird ein Tresor samt „Haushalt 1“ angelegt; zwei getrennte Offline-Neustarts entsperren ihn jeweils mit Passphrase beziehungsweise Rettungscode und zeigen den Bereich an. (3) Keine Anmeldung oder Serverkonfiguration nötig **erfüllt** — der Ablauf verwendet ausschließlich lokalen Browserzustand, deaktiviert vor beiden Neustarts das Netzwerk und erreicht keine Serveranmeldung. Aktuell bestanden am 4. Oktober 2026: `pnpm exec playwright test tests/ui/p4-1-7.spec.ts` (1 echter Network-off-Chromium-PWA-Ablauf), `pnpm test:offline` (Service-Worker-Regeln), `pnpm --filter @wimm/ui test` (5 Tests), `pnpm typecheck` sowie `pnpm test:ui` (10 Web- und 8 Desktop-Frontend-Abläufe).
- Einschränkungen: Die Abnahme belegt die PWA im Chromium-Webclient mit Service Worker `wimm-app-assets-v1`; ein vollständiger nativer Tauri-Wiedereinstieg bleibt getrennt in P4.1.8 offen.

### P4.1.8 — Nativen lokalen Einstieg nach Neustart prüfen

- Status: offen.
- Freigabe: vorhandener Nutzerauftrag zum Abschluss von P4; aktueller Auftrag fordert Aufteilung und erneute Abnahmeplanung, keine Umsetzung.
- Voraussetzungen: P4.1.7 abgenommen.
- Schritte: Gebündelte Tauri-App auf verfügbarer Plattform ohne Server starten; Tresor/Haushalt anlegen, sperren, beenden und offline neu öffnen.
- Ergebnis: Nativen lokalen Einstieg nach Neustart prüfen mit erneuter Einzelabnahme.
- Verträge: [Architektur](architecture.md), [Schlüsselbedienung](ui.md#schlüsselbedienung), [Verschlüsselung](encryption.md), [P3-Speicherbasis](p3-storage.md).
- Abnahme: Vollständiger nativer Ablauf erreicht wieder den Haushalt über beide Entsperrwege; bloß sichtbares Tresorformular genügt nicht.
- Prüfungen: Echter Tauri-Smokecheck mit OS/Architektur/Build und synthetischen Daten; fehlende Zielsysteme separat offen halten, Menüs/Dialoge bleiben P4.5.
- Prüfbelege: erneute Einzelabnahme noch offen; historische Belege bei P4.1 und in der [Übergabe](handoffs/p4-1.md) gezielt nachprüfen.
- Einschränkungen: historischer Tauri-Nachweis reicht bisher nur bis zum Tresorformular; kein vollständiger nativer Wiedereinstieg belegt.

## P4.2 — Navigation, Übersicht und Stammdaten

- Status: in Arbeit — Nachprüfung vom 3. Oktober 2026 hat offene Abnahmelücken ergeben.
- Freigabe: expliziter Nutzerauftrag „setze P4.2 vollständig um“.
- Voraussetzungen: P4.1 einschließlich P4.1.1–P4.1.8 erneut abgenommen.
- Schritte: Desktop-/Tablet-/Mobilnavigation, Bereichskennzeichnung, Übersicht und Konto-/Kategorie-/Empfängerverwaltung umsetzen; Systemtypografie, Hell/Dunkel und zugängliche Zustände aufbauen.
- Ergebnis: passende Arbeitsansichten für Tastatur und Touch mit echten lokalen Zahlen.
- Verträge: [Layout und Navigation](ui.md), [Produkt](product.md), P2-Stammdatenbefehle in [API](api.md).
- Abnahme: erster Kontostart/Anfangsbestand möglich; leere Daten erzeugen keine erfundenen Guthaben; Archivierung und Merge nachvollziehbar; 320-Pixel-Ansicht ohne Seitenüberlauf.
- Prüfungen: Playwright für Einstieg/Bereichswechsel/Stammdaten, Hell/Dunkel, lange deutsche Namen, Fokus und 200 % Zoom.
- Prüfbelege: Gemeinsame Web-/Desktopansicht mit Bereichskennzeichnung, Übersicht sowie Konto-, Kategoriegruppen-, Kategorie- und Empfängerverwaltung liegt in `packages/ui/src/workspace.tsx` vor. Lokale Salden entstehen aus `projectAccountBalances`; leere Bereiche zeigen keinen erfundenen Saldo. Konten und Kategorien werden über die P2-Fachbefehle archiviert und bleiben damit an historischen Referenzen erhalten; ein Empfänger-Merge erfasst alle lokal vorhandenen Quellreferenzen in einer atomaren Änderungsmenge und archiviert die Quelle. Systemschrift, Hell-/Dunkelmodus, sichtbare Fokusregel und ein Touchlayout unter 768 CSS-Pixeln sind vorhanden. `pnpm test:ui` bestand am 3. Oktober 2026 in Chromium; TypeScript, die UI-Unit-Tests sowie Web- und Desktop-Frontend-Build bestanden ebenfalls.

  Offen nach Nachprüfung: Der Chromium-Ablauf prüft Kategoriearchivierung nicht und führt den Empfänger-Merge ohne referenzierte Buchung aus. Die Tastaturprüfung stellt nur die Existenz einer `:focus-visible`-CSS-Regel fest, nicht die reale Fokusreihenfolge oder den sichtbaren Fokus nach Tastaturnavigation. Bei CSS-Zoom 200 % wird nur die Sichtbarkeit einer Überschrift geprüft; ein Seitenüberlauf- oder Erreichbarkeitsnachweis fehlt. Browser-Zoom, Firefox/WebKit, echter Screenreader und native Desktop-Prüfungen bleiben als getrennte Nachweise offen. Die vollständige Übergabe steht in [P4.2-Übergabe](handoffs/p4-2.md).

### P4.2.1 — Navigation und Bereichstrennung prüfen

- Status: offen.
- Freigabe: erbt die bestehende Freigabe von P4.2; aktueller Auftrag nur Aufgabenplanung.
- Voraussetzungen: P4.1 einschließlich P4.1.1–P4.1.8 erneut abgenommen.
- Schritte: Bestehende Navigation und Bereichswechsel mit zwei synthetischen Bereichen prüfen; nur dabei gefundene Navigationslücken schließen.
- Ergebnis: Navigation und Bereichstrennung prüfen mit dokumentierter Einzelabnahme.
- Verträge: [UI](ui.md), [Produkt](product.md), P2-Stammdatenbefehle in [API](api.md).
- Abnahme: Übersicht, Konten, Buchungen und Stammdaten sind erreichbar; aktiver Bereich ist erkennbar; Wechsel zeigt ausschließlich dessen Daten.
- Prüfungen: Chromium-Ablauf auf Web und Desktop-Frontend mit verschieden benannten privaten und gemeinsamen Konten.
- Prüfbelege: Einzelabnahme noch nicht dokumentiert; vorhandene Teilbelege stehen bei P4.2 und sind gezielt nachzuprüfen.
- Einschränkungen: spätere Paketfunktionen bleiben außerhalb des Auftrags; fehlende Prüfmittel mit konkreter offener Abnahme dokumentieren.

### P4.2.2 — Übersicht und Kontostart prüfen

- Status: offen.
- Freigabe: erbt die bestehende Freigabe von P4.2; aktueller Auftrag nur Aufgabenplanung.
- Voraussetzungen: P4.2.1 abgenommen.
- Schritte: Leeren Bereich und Kontoanlage mit Anfangsbestand an vorhandene Projektionen anbinden beziehungsweise nachprüfen.
- Ergebnis: Übersicht und Kontostart prüfen mit dokumentierter Einzelabnahme.
- Verträge: [UI](ui.md), [Produkt](product.md), P2-Stammdatenbefehle in [API](api.md).
- Abnahme: Leerer Bereich zeigt einen Leerzustand; Anfang 1.000 EUR ergibt 1.000 EUR Saldo und keine Konsumeinnahme, auch nach erneutem Laden.
- Prüfungen: Chromium: leerer Bereich → Konto mit Anfangsbestand → Übersicht und Konto prüfen; Web und Desktop-Frontend.
- Prüfbelege: Einzelabnahme noch nicht dokumentiert; vorhandene Teilbelege stehen bei P4.2 und sind gezielt nachzuprüfen.
- Einschränkungen: spätere Paketfunktionen bleiben außerhalb des Auftrags; fehlende Prüfmittel mit konkreter offener Abnahme dokumentieren.

### P4.2.3 — Kontoarchivierung mit Referenzen abnehmen

- Status: offen.
- Freigabe: erbt die bestehende Freigabe von P4.2; aktueller Auftrag nur Aufgabenplanung.
- Voraussetzungen: P4.2.2 abgenommen.
- Schritte: Archivierung eines bereits bebuchten Kontos prüfen; Auswahl und historische Anzeige bei Bedarf korrigieren.
- Ergebnis: Kontoarchivierung mit Referenzen abnehmen mit dokumentierter Einzelabnahme.
- Verträge: [UI](ui.md), [Produkt](product.md), P2-Stammdatenbefehle in [API](api.md).
- Abnahme: Historische Buchung und Saldo bleiben erhalten; archiviertes Konto wird für neue Buchungen nicht vorausgewählt.
- Prüfungen: Chromium: Konto bebuchen → archivieren → Historie und neue Buchungsmaske prüfen.
- Prüfbelege: Einzelabnahme noch nicht dokumentiert; vorhandene Teilbelege stehen bei P4.2 und sind gezielt nachzuprüfen.
- Einschränkungen: spätere Paketfunktionen bleiben außerhalb des Auftrags; fehlende Prüfmittel mit konkreter offener Abnahme dokumentieren.

### P4.2.4 — Kategoriearchivierung mit Referenzen abnehmen

- Status: offen.
- Freigabe: erbt die bestehende Freigabe von P4.2; aktueller Auftrag nur Aufgabenplanung.
- Voraussetzungen: P4.2.3 abgenommen; bestehende Buchungserfassung für die Referenzfixture vorhanden.
- Schritte: Kategoriegruppe und Kategorie anlegen; Kategorie einer Buchung zuordnen, archivieren und historische Anzeige prüfen.
- Ergebnis: Kategoriearchivierung mit Referenzen abnehmen mit dokumentierter Einzelabnahme.
- Verträge: [UI](ui.md), [Produkt](product.md), P2-Stammdatenbefehle in [API](api.md).
- Abnahme: Archivierte Kategorie bleibt an der alten Buchung lesbar und wird für neue Eingaben nicht vorausgewählt; kein Referenzverlust.
- Prüfungen: Chromium-Ablauf mit echter gespeicherter Kategorienreferenz; atomaren Fehlerfall des Fachbefehls weiterverwenden.
- Prüfbelege: Einzelabnahme noch nicht dokumentiert; vorhandene Teilbelege stehen bei P4.2 und sind gezielt nachzuprüfen.
- Einschränkungen: spätere Paketfunktionen bleiben außerhalb des Auftrags; fehlende Prüfmittel mit konkreter offener Abnahme dokumentieren.

### P4.2.5 — Empfänger-Merge mit Buchungsreferenz abnehmen

- Status: offen.
- Freigabe: erbt die bestehende Freigabe von P4.2; aktueller Auftrag nur Aufgabenplanung.
- Voraussetzungen: P4.2.4 abgenommen; bestehende Buchungserfassung für die Referenzfixture vorhanden.
- Schritte: Zwei Empfänger anlegen und eine gespeicherte Buchung mit der Quelle zusammenführen; bestehende Merge-Anbindung gezielt korrigieren.
- Ergebnis: Empfänger-Merge mit Buchungsreferenz abnehmen mit dokumentierter Einzelabnahme.
- Verträge: [UI](ui.md), [Produkt](product.md), P2-Stammdatenbefehle in [API](api.md).
- Abnahme: Buchung referenziert das Ziel, Quelle ist archiviert; Betrag und Konto bleiben gleich; nach Neustart derselbe Stand.
- Prüfungen: Chromium-Merge mit referenzierter Buchung und Neustart; keine Prüfung nur mit unbenutzten Empfängern.
- Prüfbelege: Einzelabnahme noch nicht dokumentiert; vorhandene Teilbelege stehen bei P4.2 und sind gezielt nachzuprüfen.
- Einschränkungen: spätere Paketfunktionen bleiben außerhalb des Auftrags; fehlende Prüfmittel mit konkreter offener Abnahme dokumentieren.

### P4.2.6 — Layout und Farbschema stabilisieren

- Status: offen.
- Freigabe: erbt die bestehende Freigabe von P4.2; aktueller Auftrag nur Aufgabenplanung.
- Voraussetzungen: P4.2.5 abgenommen.
- Schritte: Navigation und Stammdaten bei 320, 768, 900 und 1024 CSS-Pixeln mit langen deutschen Namen prüfen; Systemschrift und Hell/Dunkel kontrollieren.
- Ergebnis: Layout und Farbschema stabilisieren mit dokumentierter Einzelabnahme.
- Verträge: [UI](ui.md), [Produkt](product.md), P2-Stammdatenbefehle in [API](api.md).
- Abnahme: Kein horizontaler Seitenüberlauf oder abgeschnittener Betrag; Touchziele mindestens 44 × 44; Hell/Dunkel folgt System und lässt sich überschreiben.
- Prüfungen: Gezielte Chromium-Screenshots und Überlauf-/Touchzielprüfung für Navigation und Stammdaten; gesamte Matrix folgt P4.6.2.
- Prüfbelege: Einzelabnahme noch nicht dokumentiert; vorhandene Teilbelege stehen bei P4.2 und sind gezielt nachzuprüfen.
- Einschränkungen: spätere Paketfunktionen bleiben außerhalb des Auftrags; fehlende Prüfmittel mit konkreter offener Abnahme dokumentieren.

### P4.2.7 — Tastaturfokus für Navigation und Stammdaten abnehmen

- Status: offen.
- Freigabe: erbt die bestehende Freigabe von P4.2; aktueller Auftrag nur Aufgabenplanung.
- Voraussetzungen: P4.2.6 abgenommen.
- Schritte: Fokusfolge und sichtbaren Fokus durch reale Tastaturnavigation prüfen und gezielt verbessern.
- Ergebnis: Tastaturfokus für Navigation und Stammdaten abnehmen mit dokumentierter Einzelabnahme.
- Verträge: [UI](ui.md), [Produkt](product.md), P2-Stammdatenbefehle in [API](api.md).
- Abnahme: Bereichswechsel, Konto-/Kategorieanlage und Merge sind per Tastatur erreichbar; Fokus sichtbar; Dialogfokus kehrt zum Auslöser zurück.
- Prüfungen: Chromium mit Tab/Shift+Tab/Enter/Escape und Prüfung des tatsächlich fokussierten Elements auf Web und Desktop-Frontend; reine CSS-Regel zählt nicht.
- Prüfbelege: Einzelabnahme noch nicht dokumentiert; vorhandene Teilbelege stehen bei P4.2 und sind gezielt nachzuprüfen.
- Einschränkungen: spätere Paketfunktionen bleiben außerhalb des Auftrags; fehlende Prüfmittel mit konkreter offener Abnahme dokumentieren.

## P4.3 — Buchungslisten und Erfassungsformulare

- Status: in Arbeit.
- Freigabe: Nutzerauftrag zum Abschluss von P4.
- Voraussetzungen: P4.2 einschließlich Unteraufgaben abgenommen.
- Schritte: virtualisierte Buchungslisten, Suche/Filter, Einzelbuchung und Splits anbinden; exakte Betragseingabe, Datum, Feldfehler und Speicherstatus umsetzen; mobile Details statt gequetschter Tabelle gestalten.
- Ergebnis: nutzbare Buchungserfassung mit dauerhaftem Speichern und erhaltenen Fehlereingaben.
- Verträge: [Formulare](ui.md#formulare-und-wichtige-dialoge), [Fachmodell](domain.md), [Oberflächenmatrix](testing.md#oberflächenmatrix-und-leistung).
- Abnahme: Tastatur-/Toucherfassung und Bearbeitung möglich; falsche Splitsumme abgewiesen; keine Erfolgsmeldung vor Commit; Quota/Disk-full erhält Eingaben.
- Prüfungen: F01/F02 über UI, Fehler-/Offlinezustände, virtuelle Liste mit Leistungsdatensatz und dokumentierter Messumgebung.
- Prüfbelege: Einzelbuchung, Anfangsbestand, Suche und ein zweizeiliger Split sind an `saveTransaction` gebunden. Betragstexte werden nur durch `parseMoney` im Fachkern verarbeitet; der zweite Split entsteht mit `subtractMoney`. Speichererfolg wird erst nach `LocalAreaService.applyChangeSet` angezeigt; Fachfehler bleiben im Formular sichtbar. Offen: Bearbeiten/Löschen, echte Virtualisierung, UI-Referenzfälle F01/F02, Quota-/Offline- und Leistungsnachweise.

### P4.3.1 — Einzelbuchung und F01 abnehmen

- Status: offen.
- Freigabe: erbt die bestehende Freigabe von P4.3; aktueller Auftrag nur Aufgabenplanung.
- Voraussetzungen: P4.2 einschließlich P4.2.1–P4.2.7 abgenommen.
- Schritte: Vorhandene Erfassung von Ausgabe und Einnahme einschließlich Datum, Empfänger und Notiz prüfen; Feldfehler gezielt schließen.
- Ergebnis: Einzelbuchung und F01 abnehmen mit dokumentierter Einzelabnahme.
- Verträge: [Formulare](ui.md#formulare-und-wichtige-dialoge), [Fachmodell](domain.md), [Tests](testing.md).
- Abnahme: F01 ergibt Saldo 1.100 EUR, Ausgabe 100 EUR, Einnahme 200 EUR; ungültiger Betrag oder Kalenderwert bleibt mit Feldfehler im Formular.
- Prüfungen: F01 per Chromium auf Web und Desktop-Frontend; eine Erfassung mit Tastatur und eine mit Touch sowie ungültige Eingaben.
- Prüfbelege: Einzelabnahme noch nicht dokumentiert; vorhandene Teilbelege stehen bei P4.3 und sind gezielt nachzuprüfen.
- Einschränkungen: spätere Paketfunktionen bleiben außerhalb des Auftrags; fehlende Prüfmittel mit konkreter offener Abnahme dokumentieren.

### P4.3.2 — Spliterfassung und F02 abnehmen

- Status: offen.
- Freigabe: erbt die bestehende Freigabe von P4.3; aktueller Auftrag nur Aufgabenplanung.
- Voraussetzungen: P4.3.1 abgenommen.
- Schritte: Splitzeilen ergänzbar und entfernbar machen; Beträge ausschließlich über Fachkern validieren.
- Ergebnis: Spliterfassung und F02 abnehmen mit dokumentierter Einzelabnahme.
- Verträge: [Formulare](ui.md#formulare-und-wichtige-dialoge), [Fachmodell](domain.md), [Tests](testing.md).
- Abnahme: F02 -60/-40 zu -100 EUR speichert vollständig; -60/-39 wird vollständig abgewiesen; mindestens drei Zeilen sind erfassbar.
- Prüfungen: Chromium: gültiger und ungültiger F02-Fall sowie Hinzufügen/Entfernen einer dritten Splitzeile; Saldo unverändert im Fehlfall.
- Prüfbelege: Einzelabnahme noch nicht dokumentiert; vorhandene Teilbelege stehen bei P4.3 und sind gezielt nachzuprüfen.
- Einschränkungen: spätere Paketfunktionen bleiben außerhalb des Auftrags; fehlende Prüfmittel mit konkreter offener Abnahme dokumentieren.

### P4.3.3 — Bestehende Buchung bearbeiten

- Status: offen.
- Freigabe: erbt die bestehende Freigabe von P4.3; aktueller Auftrag nur Aufgabenplanung.
- Voraussetzungen: P4.3.2 abgenommen.
- Schritte: Detail-/Bearbeitungsansicht an bestehenden Speicherbefehl mit aktueller Revision anbinden.
- Ergebnis: Bestehende Buchung bearbeiten mit dokumentierter Einzelabnahme.
- Verträge: [Formulare](ui.md#formulare-und-wichtige-dialoge), [Fachmodell](domain.md), [Tests](testing.md).
- Abnahme: Normale und Splitbuchung lassen sich ändern; kein Duplikat; ungültige Änderung erhält Eingaben und bisherigen gespeicherten Stand.
- Prüfungen: Chromium: normale und Splitbuchung öffnen → ändern → erneut öffnen; Fehlfall und veraltete Revision gezielt prüfen.
- Prüfbelege: Einzelabnahme noch nicht dokumentiert; vorhandene Teilbelege stehen bei P4.3 und sind gezielt nachzuprüfen.
- Einschränkungen: spätere Paketfunktionen bleiben außerhalb des Auftrags; fehlende Prüfmittel mit konkreter offener Abnahme dokumentieren.

### P4.3.4 — Buchung bestätigt löschen

- Status: offen.
- Freigabe: erbt die bestehende Freigabe von P4.3; aktueller Auftrag nur Aufgabenplanung.
- Voraussetzungen: P4.3.3 abgenommen.
- Schritte: Löschbestätigung und Tombstone-Befehl für nicht abgeglichene Buchungen anbinden.
- Ergebnis: Buchung bestätigt löschen mit dokumentierter Einzelabnahme.
- Verträge: [Formulare](ui.md#formulare-und-wichtige-dialoge), [Fachmodell](domain.md), [Tests](testing.md).
- Abnahme: Abbruch verändert nichts; Bestätigung entfernt die Buchung aus aktiver Liste und Saldo; Tombstone bleibt; gesperrte Buchung wird abgewiesen.
- Prüfungen: Chromium: abbrechen/bestätigen und Neustart; gezielte Prüfung des gesperrten Fehlfalls.
- Prüfbelege: Einzelabnahme noch nicht dokumentiert; vorhandene Teilbelege stehen bei P4.3 und sind gezielt nachzuprüfen.
- Einschränkungen: spätere Paketfunktionen bleiben außerhalb des Auftrags; fehlende Prüfmittel mit konkreter offener Abnahme dokumentieren.

### P4.3.5 — Suche, Filter und mobile Details abnehmen

- Status: offen.
- Freigabe: erbt die bestehende Freigabe von P4.3; aktueller Auftrag nur Aufgabenplanung.
- Voraussetzungen: P4.3.4 abgenommen.
- Schritte: Suche und Konto-/Zeitraumfilter prüfen; mobile Buchungsdetails mit identischen Daten anbinden.
- Ergebnis: Suche, Filter und mobile Details abnehmen mit dokumentierter Einzelabnahme.
- Verträge: [Formulare](ui.md#formulare-und-wichtige-dialoge), [Fachmodell](domain.md), [Tests](testing.md).
- Abnahme: Leere Liste und Suche ohne Treffer haben verständliche Leerzustände; Filterkombinationen liefern passende Buchungen; zurücksetzen zeigt alle; 320-Pixel-Details enthalten vollständigen Betrag und Aktionen.
- Prüfungen: Chromium mit unterscheidbaren Fixtures: Suche/Filter/zurücksetzen, keine Treffer und mobile Detailansicht.
- Prüfbelege: Einzelabnahme noch nicht dokumentiert; vorhandene Teilbelege stehen bei P4.3 und sind gezielt nachzuprüfen.
- Einschränkungen: spätere Paketfunktionen bleiben außerhalb des Auftrags; fehlende Prüfmittel mit konkreter offener Abnahme dokumentieren.

### P4.3.6 — Buchungsliste virtualisieren

- Status: offen.
- Freigabe: erbt die bestehende Freigabe von P4.3; aktueller Auftrag nur Aufgabenplanung.
- Voraussetzungen: P4.3.5 abgenommen.
- Schritte: Nur sichtbare Zeilen plus begrenzten Puffer rendern; stabile IDs, Auswahl und Rückkehrfokus erhalten.
- Ergebnis: Buchungsliste virtualisieren mit dokumentierter Einzelabnahme.
- Verträge: [Formulare](ui.md#formulare-und-wichtige-dialoge), [Fachmodell](domain.md), [Tests](testing.md).
- Abnahme: 50.000 synthetische Buchungen erzeugen keine 50.000 DOM-Zeilen; erste, mittlere und letzte Buchung sind erreichbar und bearbeitbar.
- Prüfungen: Chromium mit 50.000 Buchungen: DOM-Zeilenanzahl, Scrollen und Detailrückkehr prüfen; Zeitmessung separat P4.6.5.
- Prüfbelege: Einzelabnahme noch nicht dokumentiert; vorhandene Teilbelege stehen bei P4.3 und sind gezielt nachzuprüfen.
- Einschränkungen: spätere Paketfunktionen bleiben außerhalb des Auftrags; fehlende Prüfmittel mit konkreter offener Abnahme dokumentieren.

### P4.3.7 — Commit- und Speicherfehler sichtbar behandeln

- Status: offen.
- Freigabe: erbt die bestehende Freigabe von P4.3; aktueller Auftrag nur Aufgabenplanung.
- Voraussetzungen: P4.3.6 abgenommen.
- Schritte: Verzögerten Commit und Quota-/Disk-full-Fehler über kontrollierte Speicherfehler prüfen; Lade-, Fehler- und lokal ausstehende Speicherzustände sowie Entwurfserhalt korrigieren.
- Ergebnis: Commit- und Speicherfehler sichtbar behandeln mit dokumentierter Einzelabnahme.
- Verträge: [Formulare](ui.md#formulare-und-wichtige-dialoge), [Fachmodell](domain.md), [Tests](testing.md).
- Abnahme: Vor Commit kein Erfolg; bei Fehler sämtliche Formularwerte erhalten, keine Teilbuchung und unveränderter Saldo; erneuter Versuch speichert einmal.
- Prüfungen: UI-Integration mit verzögertem Adapter, Quota und Disk-full; Fehlereinspritzung getrennt vom echten nativen Nachweis in P4.6.6 bezeichnen.
- Prüfbelege: Einzelabnahme noch nicht dokumentiert; vorhandene Teilbelege stehen bei P4.3 und sind gezielt nachzuprüfen.
- Einschränkungen: spätere Paketfunktionen bleiben außerhalb des Auftrags; fehlende Prüfmittel mit konkreter offener Abnahme dokumentieren.

### P4.3.8 — Offline-Neustart der Buchungsabläufe abnehmen

- Status: offen.
- Freigabe: erbt die bestehende Freigabe von P4.3; aktueller Auftrag nur Aufgabenplanung.
- Voraussetzungen: P4.3.7 abgenommen.
- Schritte: Erfasste, bearbeitete, gesplittete und gelöschte Daten nach Offline-Neustart vergleichen.
- Ergebnis: Offline-Neustart der Buchungsabläufe abnehmen mit dokumentierter Einzelabnahme.
- Verträge: [Formulare](ui.md#formulare-und-wichtige-dialoge), [Fachmodell](domain.md), [Tests](testing.md).
- Abnahme: Echte Network-off-PWA startet nach Erstladen offline; gespeicherter Stand und Salden bleiben; Desktop-Frontend erhält denselben Datensatz.
- Prüfungen: Chromium mit abgeschaltetem Netzwerk und Neustart, nicht nur Offline-Banner; Web/PWA und Desktop-Frontend getrennt belegen, native Wiederholung in P4.6.6.
- Prüfbelege: Einzelabnahme noch nicht dokumentiert; vorhandene Teilbelege stehen bei P4.3 und sind gezielt nachzuprüfen.
- Einschränkungen: spätere Paketfunktionen bleiben außerhalb des Auftrags; fehlende Prüfmittel mit konkreter offener Abnahme dokumentieren.

## P4.4 — Transfer, Abgleich und Rückgängig

- Status: in Arbeit.
- Freigabe: Nutzerauftrag zum Abschluss von P4.
- Voraussetzungen: P4.3 erledigt.
- Schritte: Transfer-/Abgleichdialoge und atomare Entsperrung anbinden; Differenz ausdrücklich anzeigen; Undo/Redo als reguläre Gegenbefehle mit aktuellen Revisionen durchführen; ungespeicherte Eingaben schützen.
- Ergebnis: vollständige lokale Kontenpflege ohne versteckte Korrekturbuchungen.
- Verträge: [Transfer-/Abgleichregeln](domain.md), [Fachbefehle](api.md#fachbefehle), [Tastaturregeln](ui.md#tastatur-und-systemintegration).
- Abnahme: Transferseiten bleiben gemeinsam; abgeglichene Änderung erfordert Entsperrung; Korrekturbuchung nur nach eigener Bestätigung; Undo kann stale Revisionen nicht überschreiben.
- Prüfungen: F03, Abgleichdifferenz, gesperrte Bearbeitung, Gegenbefehl bei veraltetem Stand, Tastatur-/Touchdialoge.
- Prüfbelege: Die Kontenansicht besitzt Formulare für `saveTransfer` und `confirmReconciliation`; beide verwenden vollständige Fachaggregate und werden über den atomaren lokalen Speicher ausgeführt. Der Abgleich zeigt die vom Fachkern gelieferte Differenz und erzeugt keine verdeckte Korrekturbuchung. Offen: Entsperren abgeglichener Buchungen, Gegenbefehle für Undo/Redo, Schutz ungespeicherter Eingaben sowie UI-Prüfungen F03 und Stale-Revision.

### P4.4.1 — Transferdialog und F03 abnehmen

- Status: offen.
- Freigabe: erbt die bestehende Freigabe von P4.4; aktueller Auftrag nur Aufgabenplanung.
- Voraussetzungen: P4.3 einschließlich P4.3.1–P4.3.8 abgenommen.
- Schritte: Vorhandenen Transferablauf für zwei Konten einschließlich Budgetgrenzen prüfen und vervollständigen.
- Ergebnis: Transferdialog und F03 abnehmen mit dokumentierter Einzelabnahme.
- Verträge: [Fachmodell](domain.md), [Fachbefehle](api.md#fachbefehle), [Tastaturregeln](ui.md#tastatur-und-systemintegration).
- Abnahme: F03 zeigt 800/200 EUR, Gesamt 1.000 EUR und Verbrauch null; Budgetgrenztransfer verlangt die vorgesehene Kategorie/Freigabe.
- Prüfungen: F03 über Chromium auf Web und Desktop-Frontend per Tastatur/Touch; Fehler zwischen Transferseiten erzeugt keine Teilbuchung.
- Prüfbelege: Einzelabnahme noch nicht dokumentiert; vorhandene Teilbelege stehen bei P4.4 und sind gezielt nachzuprüfen.
- Einschränkungen: spätere Paketfunktionen bleiben außerhalb des Auftrags; fehlende Prüfmittel mit konkreter offener Abnahme dokumentieren.

### P4.4.2 — Abgleich und Differenz abnehmen

- Status: offen.
- Freigabe: erbt die bestehende Freigabe von P4.4; aktueller Auftrag nur Aufgabenplanung.
- Voraussetzungen: P4.4.1 abgenommen.
- Schritte: Ausgewählte Buchungen, Auszugssaldo und sichtbare Differenz in bestehendem Abgleichdialog prüfen.
- Ergebnis: Abgleich und Differenz abnehmen mit dokumentierter Einzelabnahme.
- Verträge: [Fachmodell](domain.md), [Fachbefehle](api.md#fachbefehle), [Tastaturregeln](ui.md#tastatur-und-systemintegration).
- Abnahme: Passende Summe gleicht exakt die Auswahl ab; abweichende Summe zeigt Differenz und erzeugt keine Korrekturbuchung.
- Prüfungen: Chromium: erfolgreicher und abgelehnter Abgleich; Auswahl, Status und Saldo nach Neustart vergleichen.
- Prüfbelege: Einzelabnahme noch nicht dokumentiert; vorhandene Teilbelege stehen bei P4.4 und sind gezielt nachzuprüfen.
- Einschränkungen: spätere Paketfunktionen bleiben außerhalb des Auftrags; fehlende Prüfmittel mit konkreter offener Abnahme dokumentieren.

### P4.4.3 — Abgeglichene Buchungen atomar entsperren

- Status: offen.
- Freigabe: erbt die bestehende Freigabe von P4.4; aktueller Auftrag nur Aufgabenplanung.
- Voraussetzungen: P4.4.2 abgenommen.
- Schritte: Explizite Entsperrbestätigung für gesperrte normale Buchungen und Transferpaare anbinden.
- Ergebnis: Abgeglichene Buchungen atomar entsperren mit dokumentierter Einzelabnahme.
- Verträge: [Fachmodell](domain.md), [Fachbefehle](api.md#fachbefehle), [Tastaturregeln](ui.md#tastatur-und-systemintegration).
- Abnahme: Änderung/Löschung vor Entsperrung gesperrt; bestätigte Entsperrung betrifft das vollständige Aggregat; Abbruch verändert nichts.
- Prüfungen: Chromium: Sperre → Abbruch → bestätigte Entsperrung → Bearbeitung; Transferseiten und Fehlrollback prüfen.
- Prüfbelege: Einzelabnahme noch nicht dokumentiert; vorhandene Teilbelege stehen bei P4.4 und sind gezielt nachzuprüfen.
- Einschränkungen: spätere Paketfunktionen bleiben außerhalb des Auftrags; fehlende Prüfmittel mit konkreter offener Abnahme dokumentieren.

### P4.4.4 — Korrekturbuchung ausdrücklich bestätigen

- Status: offen.
- Freigabe: erbt die bestehende Freigabe von P4.4; aktueller Auftrag nur Aufgabenplanung.
- Voraussetzungen: P4.4.3 abgenommen.
- Schritte: Bei Abgleichdifferenz einen gesonderten Korrekturvorgang mit Betrag, Datum und Kategorie anbieten.
- Ergebnis: Korrekturbuchung ausdrücklich bestätigen mit dokumentierter Einzelabnahme.
- Verträge: [Fachmodell](domain.md), [Fachbefehle](api.md#fachbefehle), [Tastaturregeln](ui.md#tastatur-und-systemintegration).
- Abnahme: Differenz allein bucht nichts; erst eigene Bestätigung legt die sichtbare Korrekturbuchung an; Abbruch erhält Daten.
- Prüfungen: Chromium: Differenz → Korrekturvorschau → abbrechen/bestätigen; Projektion und erneuten Abgleich prüfen.
- Prüfbelege: Einzelabnahme noch nicht dokumentiert; vorhandene Teilbelege stehen bei P4.4 und sind gezielt nachzuprüfen.
- Einschränkungen: spätere Paketfunktionen bleiben außerhalb des Auftrags; fehlende Prüfmittel mit konkreter offener Abnahme dokumentieren.

### P4.4.5 — Rückgängig mit Revisionsprüfung umsetzen

- Status: offen.
- Freigabe: erbt die bestehende Freigabe von P4.4; aktueller Auftrag nur Aufgabenplanung.
- Voraussetzungen: P4.4.4 abgenommen.
- Schritte: Lokale Historie erfolgreicher Finanzaktionen und Gegenbefehle für die in P4 vorhandenen Buchungs-/Transfer-/Abgleichaktionen anbinden.
- Ergebnis: Rückgängig mit Revisionsprüfung umsetzen mit dokumentierter Einzelabnahme.
- Verträge: [Fachmodell](domain.md), [Fachbefehle](api.md#fachbefehle), [Tastaturregeln](ui.md#tastatur-und-systemintegration).
- Abnahme: Undo stellt fachlichen Vorzustand atomar wieder her; nach zwischenzeitlicher Fremdänderung klare Ablehnung und kein Überschreiben.
- Prüfungen: Gezielte Integration für Erfassung, Änderung, Löschung, Transfer und Abgleich; Chromium für Undo und stale Revision; keine unkontrollierte Snapshotrücksetzung.
- Prüfbelege: Einzelabnahme noch nicht dokumentiert; vorhandene Teilbelege stehen bei P4.4 und sind gezielt nachzuprüfen.
- Einschränkungen: spätere Paketfunktionen bleiben außerhalb des Auftrags; fehlende Prüfmittel mit konkreter offener Abnahme dokumentieren.

### P4.4.6 — Wiederholen mit Revisionsprüfung umsetzen

- Status: offen.
- Freigabe: erbt die bestehende Freigabe von P4.4; aktueller Auftrag nur Aufgabenplanung.
- Voraussetzungen: P4.4.5 abgenommen.
- Schritte: Redo erfolgreicher Gegenbefehle ergänzen; neue Aktion und Bereichswechsel in der Historie behandeln.
- Ergebnis: Wiederholen mit Revisionsprüfung umsetzen mit dokumentierter Einzelabnahme.
- Verträge: [Fachmodell](domain.md), [Fachbefehle](api.md#fachbefehle), [Tastaturregeln](ui.md#tastatur-und-systemintegration).
- Abnahme: Redo reproduziert Aktion einmal; stale Revision wird abgewiesen; neue Aktion verwirft Redo-Zweig; keine Historie wirkt auf fremden Bereich.
- Prüfungen: Integrationsprüfungen der Gegenbefehle plus Chromium: Undo → Redo, stale Revision und Bereichswechsel.
- Prüfbelege: Einzelabnahme noch nicht dokumentiert; vorhandene Teilbelege stehen bei P4.4 und sind gezielt nachzuprüfen.
- Einschränkungen: spätere Paketfunktionen bleiben außerhalb des Auftrags; fehlende Prüfmittel mit konkreter offener Abnahme dokumentieren.

### P4.4.7 — Ungespeicherte Eingaben schützen

- Status: offen.
- Freigabe: erbt die bestehende Freigabe von P4.4; aktueller Auftrag nur Aufgabenplanung.
- Voraussetzungen: P4.4.6 abgenommen.
- Schritte: Abbrechen, Escape, Navigation und Bereichswechsel mit geändertem Formular absichern.
- Ergebnis: Ungespeicherte Eingaben schützen mit dokumentierter Einzelabnahme.
- Verträge: [Fachmodell](domain.md), [Fachbefehle](api.md#fachbefehle), [Tastaturregeln](ui.md#tastatur-und-systemintegration).
- Abnahme: Geänderte Eingaben werden nur nach ausdrücklichem Verwerfen entfernt; Abbruch der Rückfrage erhält Werte; sauberes Formular schließt ohne Rückfrage.
- Prüfungen: Chromium per Tastatur und Touch mit Buchungs-, Transfer- und Abgleichformular; Fokus nach Rückfrage prüfen.
- Prüfbelege: Einzelabnahme noch nicht dokumentiert; vorhandene Teilbelege stehen bei P4.4 und sind gezielt nachzuprüfen.
- Einschränkungen: spätere Paketfunktionen bleiben außerhalb des Auftrags; fehlende Prüfmittel mit konkreter offener Abnahme dokumentieren.

## P4.5 — Native Menüs, Dialoge und Plattformbedienung

- Status: in Arbeit.
- Freigabe: Nutzerauftrag zum Abschluss von P4.
- Voraussetzungen: P4.4 erledigt.
- Schritte: originale Fensterdekoration, Systemmenüs, Cmd-/Ctrl-Kurzbefehle, native Datei-/Speicherdialogports und Systembrowserlinks integrieren; Capabilities begrenzen; spätere Import-/Exportaktionen nur entsprechend vorhandenem Funktionsumfang anbieten.
- Ergebnis: plattformgerecht bedienbare Tauri-App und passende Browseralternativen.
- Verträge: [Plattformintegration](architecture.md#plattformintegration), [Systemintegration](ui.md), [Tauri-Sicherheit](security.md).
- Abnahme: echte native Menüs/Dialoge auf verfügbaren Zielsystemen; Textfeld-Undo unverändert plattformüblich; externe Links öffnen Systembrowser; Tauri lädt nur gebündelte Inhalte.
- Prüfungen: native Smokechecks mit Plattform/Architektur, Menü, Dialog, Shortcut, Fremdlink und Offline-Neustart; ungeprüfte Systeme konkret ausweisen.
- Prüfbelege: Die Tauri-Hülle erstellt ein natives Datei-/Bearbeiten-Menü mit Neu, Undo/Redo und Standard-Textaktionen; `cargo check` und der Desktop-Produktionsbuild bestanden. Ein PlatformServices-Port wird sowohl in Web als auch Desktop injiziert. Offen: Anbindung der Menübefehle, native Datei-/Speicherdialoge, Systembrowserlinks, begrenzte Capabilities und echter nativer Smokecheck.

### P4.5.1 — Native Menübefehle anbinden

- Status: offen.
- Freigabe: erbt die bestehende Freigabe von P4.5; aktueller Auftrag nur Aufgabenplanung.
- Voraussetzungen: P4.4 einschließlich P4.4.1–P4.4.7 abgenommen.
- Schritte: Vorhandene Tauri-Menüereignisse über PlatformServices an neue Buchung, Suche und Undo/Redo anbinden; Menügruppen vervollständigen.
- Ergebnis: Native Menübefehle anbinden mit dokumentierter Einzelabnahme.
- Verträge: [Plattformintegration](architecture.md#plattformintegration), [Systemintegration](ui.md), [Sicherheit](security.md).
- Abnahme: Datei/Bearbeiten/Ansicht/Hilfe und plattformübliche Appaktionen erreichbar; nicht verfügbare Import-/Exportfunktionen nicht als nutzbar dargestellt.
- Prüfungen: Menüereignisse gezielt integrieren und echten macOS-Menüaufruf prüfen; native Plattformmatrix separat P4.5.7.
- Prüfbelege: Einzelabnahme noch nicht dokumentiert; vorhandene Teilbelege stehen bei P4.5 und sind gezielt nachzuprüfen.
- Einschränkungen: spätere Paketfunktionen bleiben außerhalb des Auftrags; fehlende Prüfmittel mit konkreter offener Abnahme dokumentieren.

### P4.5.2 — Plattformübliche Kurzbefehle abnehmen

- Status: offen.
- Freigabe: erbt die bestehende Freigabe von P4.5; aktueller Auftrag nur Aufgabenplanung.
- Voraussetzungen: P4.5.1 abgenommen.
- Schritte: Cmd-/Ctrl+N/F/Z und Redo mit Dialogen und Textfeldern prüfen; Konflikte korrigieren.
- Ergebnis: Plattformübliche Kurzbefehle abnehmen mit dokumentierter Einzelabnahme.
- Verträge: [Plattformintegration](architecture.md#plattformintegration), [Systemintegration](ui.md), [Sicherheit](security.md).
- Abnahme: Neue Buchung/Suche und Fach-Undo funktionieren außerhalb Textfeldern; Textfeld-Undo und Standardtextaktionen bleiben plattformüblich.
- Prüfungen: Gezielte UI-Prüfung plus echtes Tauri auf macOS: Menü und Tastatur, fokussiertes Textfeld und Finanzaktion.
- Prüfbelege: Einzelabnahme noch nicht dokumentiert; vorhandene Teilbelege stehen bei P4.5 und sind gezielt nachzuprüfen.
- Einschränkungen: spätere Paketfunktionen bleiben außerhalb des Auftrags; fehlende Prüfmittel mit konkreter offener Abnahme dokumentieren.

### P4.5.3 — Nativen Öffnendialog als Port bereitstellen

- Status: offen.
- Freigabe: erbt die bestehende Freigabe von P4.5; aktueller Auftrag nur Aufgabenplanung.
- Voraussetzungen: P4.5.2 abgenommen.
- Schritte: Dateiöffnen über begrenzten Plattformport und Browserdateiauswahl bereitstellen; synthetische Datei für Portprüfung verwenden.
- Ergebnis: Nativen Öffnendialog als Port bereitstellen mit dokumentierter Einzelabnahme.
- Verträge: [Plattformintegration](architecture.md#plattformintegration), [Systemintegration](ui.md), [Sicherheit](security.md).
- Abnahme: Desktop zeigt echten Systemdialog; Auswahl liefert nur bestätigte Datei; Abbruch ist folgenlos; Webalternative funktioniert.
- Prüfungen: Portintegration und echter Öffnendialog auf verfügbarer Plattform; kein Finanzimport vor P5.
- Prüfbelege: Einzelabnahme noch nicht dokumentiert; vorhandene Teilbelege stehen bei P4.5 und sind gezielt nachzuprüfen.
- Einschränkungen: spätere Paketfunktionen bleiben außerhalb des Auftrags; fehlende Prüfmittel mit konkreter offener Abnahme dokumentieren.

### P4.5.4 — Nativen Speicherdialog als Port bereitstellen

- Status: offen.
- Freigabe: erbt die bestehende Freigabe von P4.5; aktueller Auftrag nur Aufgabenplanung.
- Voraussetzungen: P4.5.3 abgenommen.
- Schritte: Dateispeichern über Plattformport und Browserdownload bereitstellen; synthetischen Inhalt für Portprüfung verwenden.
- Ergebnis: Nativen Speicherdialog als Port bereitstellen mit dokumentierter Einzelabnahme.
- Verträge: [Plattformintegration](architecture.md#plattformintegration), [Systemintegration](ui.md), [Sicherheit](security.md).
- Abnahme: Desktop bestätigt Pfad und Überschreiben im Systemdialog; Abbruch schreibt nichts; Schreibfehler sichtbar; Webdownload nutzbar.
- Prüfungen: Portintegration und echter Speicherdialog mit Abbruch/Fehler auf verfügbarer Plattform; kein WIMM-Export vor P10.
- Prüfbelege: Einzelabnahme noch nicht dokumentiert; vorhandene Teilbelege stehen bei P4.5 und sind gezielt nachzuprüfen.
- Einschränkungen: spätere Paketfunktionen bleiben außerhalb des Auftrags; fehlende Prüfmittel mit konkreter offener Abnahme dokumentieren.

### P4.5.5 — Externe Links im Systembrowser öffnen

- Status: offen.
- Freigabe: erbt die bestehende Freigabe von P4.5; aktueller Auftrag nur Aufgabenplanung.
- Voraussetzungen: P4.5.4 abgenommen.
- Schritte: Hilfe-/Lizenz-/Quellcodelinks über begrenzten Linkport öffnen; unzulässige URL-Schemata abweisen.
- Ergebnis: Externe Links im Systembrowser öffnen mit dokumentierter Einzelabnahme.
- Verträge: [Plattformintegration](architecture.md#plattformintegration), [Systemintegration](ui.md), [Sicherheit](security.md).
- Abnahme: Externer Link öffnet im Systembrowser; privilegiertes Tauri-Fenster bleibt bei gebündelter App; Browseralternative öffnet sicher.
- Prüfungen: URL-Fehlfälle am Port und echter Tauri-Linkaufruf auf verfügbarer Plattform.
- Prüfbelege: Einzelabnahme noch nicht dokumentiert; vorhandene Teilbelege stehen bei P4.5 und sind gezielt nachzuprüfen.
- Einschränkungen: spätere Paketfunktionen bleiben außerhalb des Auftrags; fehlende Prüfmittel mit konkreter offener Abnahme dokumentieren.

### P4.5.6 — Tauri-Capabilities begrenzen

- Status: offen.
- Freigabe: erbt die bestehende Freigabe von P4.5; aktueller Auftrag nur Aufgabenplanung.
- Voraussetzungen: P4.5.5 abgenommen.
- Schritte: Neue Menü-/Datei-/Linkrechte gegen Architektur und Sicherheitsvertrag prüfen; unnötige Berechtigungen entfernen.
- Ergebnis: Tauri-Capabilities begrenzen mit dokumentierter Einzelabnahme.
- Verträge: [Plattformintegration](architecture.md#plattformintegration), [Systemintegration](ui.md), [Sicherheit](security.md).
- Abnahme: Nur benötigte Commands/Scopes freigegeben; kein beliebiger SQL-/Dateizugriff; entfernte Inhalte können nicht in privilegierter Ansicht laden.
- Prüfungen: Konfigurationsprüfung, negative Command-/Navigationsfälle und Desktopbuild; konkrete erlaubte Rechte dokumentieren.
- Prüfbelege: Einzelabnahme noch nicht dokumentiert; vorhandene Teilbelege stehen bei P4.5 und sind gezielt nachzuprüfen.
- Einschränkungen: spätere Paketfunktionen bleiben außerhalb des Auftrags; fehlende Prüfmittel mit konkreter offener Abnahme dokumentieren.

### P4.5.7 — Native Systemintegration je Zielsystem prüfen

- Status: offen.
- Freigabe: erbt die bestehende Freigabe von P4.5; aktueller Auftrag nur Aufgabenplanung.
- Voraussetzungen: P4.5.6 abgenommen.
- Schritte: Menü, Shortcut, Öffnen/Speichern, Textfeld-Undo, Fremdlink und originale Fensterdekoration an echtem Tauri prüfen.
- Ergebnis: Native Systemintegration je Zielsystem prüfen mit dokumentierter Einzelabnahme.
- Verträge: [Plattformintegration](architecture.md#plattformintegration), [Systemintegration](ui.md), [Sicherheit](security.md).
- Abnahme: Jede verfügbare Plattform hat eigenen Nachweis mit Architektur/Build; fehlende Windows-/Linux-/macOS-Zellen bleiben offen und benannt.
- Prüfungen: Pro Plattform eigener kleiner Smokecheck mit synthetischen Daten; keine Browseremulation als native Abnahme.
- Prüfbelege: Einzelabnahme noch nicht dokumentiert; vorhandene Teilbelege stehen bei P4.5 und sind gezielt nachzuprüfen.
- Einschränkungen: spätere Paketfunktionen bleiben außerhalb des Auftrags; fehlende Prüfmittel mit konkreter offener Abnahme dokumentieren.

## P4.6 — Barrierefreiheit, Leistung und Gesamt-Abnahme

- Status: offen.
- Freigabe: vorhandener Nutzerauftrag zum Abschluss von P4; dieser Planungsauftrag startet keine Umsetzung.
- Voraussetzungen: P4.5 funktional abgenommen; fehlende native Zielsysteme separat offen, unabhängige Prüfschritte bleiben möglich.
- Schritte: Kernabläufe in Playwright und Projektprüfungen aufnehmen; Screenshot-/Viewportmatrix, Screenreader/Zoom, Fokus und Leistungsziele prüfen; native Belege zusammenführen.
- Ergebnis: abgenommenes lokales Haushaltsbuch als Basis der Planungsfunktionen.
- Verträge: [P4](tasks.md#p4--oberfläche-und-native-app), [UI](ui.md), [Prüfmatrix und Leistungsziele](testing.md).
- Abnahme: Buchung/Transfer/Abgleich per Tastatur und Touch, Daten nach Neustart erhalten; keine Überlappung/abgeschnittenen Beträge; verfügbare native Zielsysteme geprüft, fehlende Prüfungen einzeln benannt.
- Prüfungen: Chromium/Firefox/WebKit, fünf Viewports aus testing.md, Hell/Dunkel/200 % Zoom, echtes iOS-Safari soweit verfügbar; 50.000-Buchungen-Messung und native Plattformsmokechecks.
- Prüfbelege: noch keine.

### P4.6.1 — Kernabläufe in drei Browsern prüfen

- Status: offen.
- Freigabe: erbt die bestehende Freigabe von P4.6; aktueller Auftrag nur Aufgabenplanung.
- Voraussetzungen: P4.2–P4.4 abgenommen und P4.5.1–P4.5.6 erledigt; fehlende native Plattform blockiert nur ihren eigenen Nachweis.
- Schritte: Vorhandene F01/F02/F03- und Abgleichabläufe in Chromium, Firefox und WebKit ausführen; browserspezifische Lücken gezielt schließen.
- Ergebnis: Kernabläufe in drei Browsern prüfen mit dokumentierter Einzelabnahme.
- Verträge: [P4-Abnahme](tasks.md#p4--oberfläche-und-native-app), [UI](ui.md), [Prüfmatrix](testing.md).
- Abnahme: Buchung, Split, Transfer und Abgleich bestehen in jedem Browser; Offline-/Neustartnachweis konkret je unterstütztem Client dokumentiert.
- Prüfungen: Pro Browser eigener Lauf mit Version, Web-/Desktop-Frontend und Ergebnis; WebKit ersetzt keinen echten iOS-Safari-Nachweis.
- Prüfbelege: Einzelabnahme noch nicht dokumentiert; vorhandene Teilbelege stehen bei P4.6 und sind gezielt nachzuprüfen.
- Einschränkungen: spätere Paketfunktionen bleiben außerhalb des Auftrags; fehlende Prüfmittel mit konkreter offener Abnahme dokumentieren.

### P4.6.2 — Screenshot- und Viewportmatrix abnehmen

- Status: offen.
- Freigabe: erbt die bestehende Freigabe von P4.6; aktueller Auftrag nur Aufgabenplanung.
- Voraussetzungen: P4.6.1 abgenommen.
- Schritte: Synthetische Kernansichten in den fünf Viewports aus testing.md in Hell/Dunkel prüfen.
- Ergebnis: Screenshot- und Viewportmatrix abnehmen mit dokumentierter Einzelabnahme.
- Verträge: [P4-Abnahme](tasks.md#p4--oberfläche-und-native-app), [UI](ui.md), [Prüfmatrix](testing.md).
- Abnahme: Keine Überlappung, abgeschnittenen Beträge oder horizontaler Seitenüberlauf; Desktop-, Tablet- und Mobilkomposition erfüllen ui.md.
- Prüfungen: Pro Viewport eigene Screenshotgruppe mit Übersichten, Liste, Details und Dialogen; lange deutsche Namen und große/negative Beträge.
- Prüfbelege: Einzelabnahme noch nicht dokumentiert; vorhandene Teilbelege stehen bei P4.6 und sind gezielt nachzuprüfen.
- Einschränkungen: spätere Paketfunktionen bleiben außerhalb des Auftrags; fehlende Prüfmittel mit konkreter offener Abnahme dokumentieren.

### P4.6.3 — Echten Zoom und Tastaturzugang abnehmen

- Status: offen.
- Freigabe: erbt die bestehende Freigabe von P4.6; aktueller Auftrag nur Aufgabenplanung.
- Voraussetzungen: P4.6.2 abgenommen.
- Schritte: Echten Browserzoom 200 %, Fokusfolge, Dialogfokus und reduced motion für Kernabläufe prüfen.
- Ergebnis: Echten Zoom und Tastaturzugang abnehmen mit dokumentierter Einzelabnahme.
- Verträge: [P4-Abnahme](tasks.md#p4--oberfläche-und-native-app), [UI](ui.md), [Prüfmatrix](testing.md).
- Abnahme: Bei 200 % bleiben Beträge, Fehler und Aktionen erreichbar; Tastatur kann gesamten Ablauf bedienen; CSS-Zoom allein gilt nicht als Beleg.
- Prüfungen: Realer Browserzoom mit Browser/Version dokumentiert; Tastaturabläufe und reduced motion prüfen; fehlende Automatisierung manuell belegen.
- Prüfbelege: Einzelabnahme noch nicht dokumentiert; vorhandene Teilbelege stehen bei P4.6 und sind gezielt nachzuprüfen.
- Einschränkungen: spätere Paketfunktionen bleiben außerhalb des Auftrags; fehlende Prüfmittel mit konkreter offener Abnahme dokumentieren.

### P4.6.4 — Screenreader und Kontraste abnehmen

- Status: offen.
- Freigabe: erbt die bestehende Freigabe von P4.6; aktueller Auftrag nur Aufgabenplanung.
- Voraussetzungen: P4.6.3 abgenommen.
- Schritte: Beschriftungen, Tabellen, Statusmeldungen, Fehlerzuordnung und Fokus mit echtem Screenreader prüfen; Kontraste messen.
- Ergebnis: Screenreader und Kontraste abnehmen mit dokumentierter Einzelabnahme.
- Verträge: [P4-Abnahme](tasks.md#p4--oberfläche-und-native-app), [UI](ui.md), [Prüfmatrix](testing.md).
- Abnahme: Tresor, Buchung und Abgleich verständlich bedienbar; Status/Fehler angesagt; Kontrast mindestens 4,5:1 und Bedeutung zusätzlich als Text/Symbol.
- Prüfungen: VoiceOver oder anderer verfügbarer Screenreader mit OS/Browser dokumentieren; Kontrastmessung; automatisierter Semantiktest allein genügt nicht.
- Prüfbelege: Einzelabnahme noch nicht dokumentiert; vorhandene Teilbelege stehen bei P4.6 und sind gezielt nachzuprüfen.
- Einschränkungen: spätere Paketfunktionen bleiben außerhalb des Auftrags; fehlende Prüfmittel mit konkreter offener Abnahme dokumentieren.

### P4.6.5 — Leistungsziele mit 50.000 Buchungen messen

- Status: offen.
- Freigabe: erbt die bestehende Freigabe von P4.6; aktueller Auftrag nur Aufgabenplanung.
- Voraussetzungen: P4.6.4 abgenommen.
- Schritte: Deterministischen synthetischen Datensatz erzeugen; Listenöffnen sowie warme Filter-/Scrollreaktion in dokumentierter Umgebung messen.
- Ergebnis: Leistungsziele mit 50.000 Buchungen messen mit dokumentierter Einzelabnahme.
- Verträge: [P4-Abnahme](tasks.md#p4--oberfläche-und-native-app), [UI](ui.md), [Prüfmatrix](testing.md).
- Abnahme: Liste innerhalb zwei Sekunden, p95 Filter-/Scrollreaktion unter 100 ms; Zahlen bleiben korrekt; Datensatz, Hardware, Versionen und Messverfahren nachvollziehbar.
- Prüfungen: Wiederholbare Messung von 50.000 Buchungen, zehn Konten, 100 Kategorien, 36 Monate und 1.000 SharedExpenses gemäß testing.md; SharedExpenses für P4 nur als synthetische Speicherlast, funktionale Familienabnahme erst in P7; konkrete Messwerte statt subjektiver Geschwindigkeit.
- Prüfbelege: Einzelabnahme noch nicht dokumentiert; vorhandene Teilbelege stehen bei P4.6 und sind gezielt nachzuprüfen.
- Einschränkungen: spätere Paketfunktionen bleiben außerhalb des Auftrags; fehlende Prüfmittel mit konkreter offener Abnahme dokumentieren.

### P4.6.6 — Native Persistenz und echte Geräte ergänzen

- Status: offen.
- Freigabe: erbt die bestehende Freigabe von P4.6; aktueller Auftrag nur Aufgabenplanung.
- Voraussetzungen: P4.3.7/P4.3.8 und P4.5.7 auf der jeweils verfügbaren Plattform; unabhängige Browserprüfungen dürfen weiterlaufen.
- Schritte: Gebündelte Tauri-App offline neu starten, echte native Disk-full-Prüfung und verfügbaren iOS-Safari-/PWA-Ablauf durchführen.
- Ergebnis: Native Persistenz und echte Geräte ergänzen mit dokumentierter Einzelabnahme.
- Verträge: [P4-Abnahme](tasks.md#p4--oberfläche-und-native-app), [UI](ui.md), [Prüfmatrix](testing.md).
- Abnahme: Gespeicherte Buchungen/Transfer/Abgleich bleiben; echtes Disk-full zeigt Fehler und erhält Entwurf ohne Teilerfolg; reale Geräte separat nachgewiesen.
- Prüfungen: Je verfügbarer Plattform/Architektur beziehungsweise Gerät eigener Lauf; Disk-full in begrenztem Testvolume ohne produktive Daten; fehlende Geräte bleiben offene Zellen.
- Prüfbelege: Einzelabnahme noch nicht dokumentiert; vorhandene Teilbelege stehen bei P4.6 und sind gezielt nachzuprüfen.
- Einschränkungen: spätere Paketfunktionen bleiben außerhalb des Auftrags; fehlende Prüfmittel mit konkreter offener Abnahme dokumentieren.

### P4.6.7 — P4-Gesamtabnahme und Übergabe abschließen

- Status: offen.
- Freigabe: erbt die bestehende Freigabe von P4.6; aktueller Auftrag nur Aufgabenplanung.
- Voraussetzungen: Alle P4-Unterabnahmen belegt; offene Plattformzellen gemäß Abschlussregeln einzeln bewertet.
- Schritte: Alle Unterabnahmen und offenen Plattformzellen zusammenführen; lokale Projektprüfungen ausführen und Gesamtstatus aktualisieren.
- Ergebnis: P4-Gesamtabnahme und Übergabe abschließen mit dokumentierter Einzelabnahme.
- Verträge: [P4-Abnahme](tasks.md#p4--oberfläche-und-native-app), [UI](ui.md), [Prüfmatrix](testing.md).
- Abnahme: Keine P4-Abnahmelücke verdeckt; Gesamtabschluss nur bei erfüllten Kriterien; fehlende Plattformprüfungen konkret als Einschränkung oder Blockade gemäß tasks.md benannt.
- Prüfungen: pnpm check:ci und Nachweismatrix mit Commit, Plattform/Browser, Testgruppe, Ergebnis und verbleibender Grenze; P5 erst nach P4-Abnahme.
- Prüfbelege: Einzelabnahme noch nicht dokumentiert; vorhandene Teilbelege stehen bei P4.6 und sind gezielt nachzuprüfen.
- Einschränkungen: spätere Paketfunktionen bleiben außerhalb des Auftrags; fehlende Prüfmittel mit konkreter offener Abnahme dokumentieren.
