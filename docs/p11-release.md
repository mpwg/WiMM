# P11 — Teilaufgaben der Veröffentlichungsvorbereitung

## Auftrag und Reihenfolge

Diese Teilaufgaben konkretisieren [P11](tasks.md#p11--veröffentlichung). Der Nutzerauftrag vom 3. Oktober 2026 erlaubt ihre Planung; die Implementierungsfreigabe für P11 steht aus. P11.1 bis P11.6 werden in Reihenfolge nach abgeschlossenem [P10](p10-backup.md) und Abnahme aller vorherigen Pakete bearbeitet. Dieser Plan und sein Paketabschluss erteilen keine Veröffentlichungs-, Push- oder Mergefreigabe.

Status und konkrete Prüfbelege hier sowie den Gesamtstatus in [tasks.md](tasks.md) pflegen; nach jedem abgeschlossenen Abschnitt einen zusammengehörigen Zwischencommit und eine [Übergabe](templates/handoff.md) erstellen. P11 ist erst nach nachgewiesener Gesamt-Abnahme erledigt. Für die Umsetzung wimm-workflow und für die Sicherheitsabnahme wimm-e2ee verwenden. Fehlende Plattformprüfungen/Signierungsgeheimnisse blockieren die betroffene Distribution; fehlende unabhängige E2EE-Prüfung blockiert die öffentliche Sicherheitsabnahme.

## P11.1 — Nutzer-, Installations- und Recoveryanleitungen

- Status: offen.
- Freigabe: Implementierungsauftrag für P11 erforderlich.
- Voraussetzungen: P10 und alle vorherigen Pakete abgenommen.
- Schritte: tatsächliche Erstnutzung, Standalone/PWA/Desktop, externe Serveranmeldung, Haushaltsbeitritt, Backup/Restore und Schlüsselrecovery dokumentieren; lokale Schutzgrenzen und unterstützte Plattformen verständlich nennen.
- Ergebnis: getestete Anleitungen für Nutzer und Betreiber mit aktuellen Befehlen/Abbildungen.
- Verträge: [Produkt](product.md), [Betrieb](operations.md), [Sicherheit](security.md), [Verschlüsselung](encryption.md).
- Abnahme: Schritte auf frischem Profil ausführbar; Anmeldung/Entsperren/Recovery klar getrennt; kein verlorenes Privatkeymaterial als betreiberrecoverbar dargestellt; nur synthetische Screenshots.
- Prüfungen: Anleitungen praktisch nachvollziehen, Offline-Erst-/Wiederstart, Einladung/Schlüsselfreigabe, Nutzer-/Vollrestore sowie Link-/Dokumentationsprüfung.
- Prüfbelege: noch keine.

## P11.2 — Plattformartefakte und native Installationsprüfung

- Status: offen.
- Freigabe: Implementierungsauftrag für P11 erforderlich.
- Voraussetzungen: P11.1 erledigt.
- Schritte: reproduzierbare Releasebuilds für macOS arm64/x64, Windows x64 und Linux x64 sowie PWA/Server herstellen; DMG/Installer/AppImage auf verfügbaren Zielsystemen frisch installieren und Kernabläufe prüfen.
- Ergebnis: versionierte Artefakte mit getrennten Build-/Installations-/Plattformnachweisen.
- Verträge: [Plattformdistribution](operations.md#migration-und-release), [native UI](ui.md), [Plattformmatrix](testing.md).
- Abnahme: unterstützte Artefakte starten, speichern offline und stellen Daten wieder her; native Menüs/Dialoge/Shortcuts belegt; ungeprüfte Architekturen/Plattformen ausdrücklich unveröffentlicht.
- Prüfungen: frische Installation und Sourcebuild, echte native Smokechecks, mobile PWA/iOS-Safari, Installations-/Backup-/Restoreabläufe; Emulation ersetzt keinen Plattformnachweis.
- Prüfbelege: noch keine.

## P11.3 — Distributionssignierung, Notarisierung und Updater

- Status: offen.
- Freigabe: Implementierungsauftrag für P11 erforderlich; Geheimnisse nur aus autorisiertem externem Secretbestand.
- Voraussetzungen: P11.2 abgenommen; betroffene Signierungsprüfung zusätzlich mit verfügbaren Credentials.
- Schritte: Paketcodesignierung/Notarisierung und signierte Updatermetadaten anbinden; Upgrade nur nach Zustimmung und verschlüsseltem Backup durchführen; Herkunft des Updatekanals prüfen.
- Ergebnis: überprüfbare Distribution und sichere Updates pro verfügbar signierbarer Plattform.
- Verträge: [Release/Updater](operations.md#migration-und-release), [Tauri-Sicherheit](security.md), [Clientvertrauen](encryption.md#clientvertrauen-und-veröffentlichung).
- Abnahme: falsche Signatur/anderer Kanal abgewiesen; Update bewahrt/migriert Daten; keine Secrets im Repository; Appsignatur keine Login-/E2EE-Voraussetzung; fehlende Credentials nur betroffene Distribution offenhalten.
- Prüfungen: gültiges/manipuliertes Update, falscher Kanal, Migrationsabbruch/Recovery, native Signatur-/Notarisierungsprüfung mit verfügbaren Secrets.
- Prüfbelege: noch keine.

## P11.4 — AGPL-Quellarchive und Fremdhinweise

- Status: offen.
- Freigabe: Implementierungsauftrag für P11 erforderlich.
- Voraussetzungen: P11.3 abgeschlossen oder nur einzelne Distributionsprüfungen durch fehlende Secrets blockiert; fehlende Secrets verhindern die Archivarbeit nicht.
- Schritte: vollständiges zugehöriges Quellarchiv mit Lockfiles/Buildskripten/Lizenz/Herkunftsregister erstellen; tatsächlichen Releasecommit und Source-URL eintragen; Hilfe/Über und Servermeta auf denselben Quellstand beziehen.
- Ergebnis: prüfbares AGPL-Quellcodeangebot passend zu Binary und Dockerimage.
- Verträge: [AGPL und Herkunft](operations.md#agpl-30-or-later-und-herkunft), [Paketlizenz](architecture.md#quellen-und-lizenz), [Meta-API](api.md).
- Abnahme: AGPL-3.0-or-later-Metadaten, erhaltene Fremdhinweise und Actual-Herkunftscommits soweit übernommen; Archiv ohne Secrets; Quellstand reproduziert Artefakte; vor Distribution tatsächlich verfügbares Quellangebot erforderlich.
- Prüfungen: Archivinhalt/Lizenzen, unabhängiger Sourcebuild, Commit-/Build-/Imagezuordnung und erreichbarer Lizenz-/Sourcepunkt; öffentliche URL erst nach autorisierter Bereitstellung als erreichbar belegen.
- Prüfbelege: noch keine.

## P11.5 — Unabhängige E2EE-Prüfung und Gesamt-Abnahme

- Status: offen.
- Freigabe: Implementierungsauftrag für P11 erforderlich; externen Prüfauftrag nur mit entsprechender Autorisierung vergeben.
- Voraussetzungen: P11.4 erledigt; geprüfte Artefakte und vollständige Nachweise P1–P10 vorhanden.
- Schritte: vollständige F-/S-/C-Abnahme und unabhängige Prüfung von Protokoll/Binding durchführen; Befunde beheben und erneut verifizieren; Releaseversion, getestete Plattformen und verbleibende Distributionsblocker dokumentieren.
- Ergebnis: nachvollziehbarer Releaseprüfstand mit tatsächlichem unabhängigem Sicherheitsbeleg.
- Verträge: [Releaseabnahme](encryption.md#releaseabnahme), [Teststrategie](testing.md), [P11](tasks.md#p11--veröffentlichung).
- Abnahme: C01–C14 sowie kritische Fach-/Zugriffs-/Restorefälle bestanden; unabhängige Prüfung mit Umfang/Datum/Befunden belegt; keine fingierte Audit-/Plattformabnahme; offene Sicherheitsblocker verhindern öffentliche Freigabe.
- Prüfungen: Interoperabilität/Manipulation/viewer-Fälschung/Rotation/Recovery, Serverdump/Backup ohne Finanzklartext, vollständiger Installations-/Update-/Restorelauf und zugehöriger Sourcebuild.
- Prüfbelege: noch keine.

## P11.6 — Konkreter Releaseabschluss und Übergabe

- Status: offen.
- Freigabe: Implementierungsauftrag für P11 erforderlich; tatsächliche Veröffentlichung zusätzlich nur bei entsprechendem Nutzerauftrag.
- Voraussetzungen: P11.5 bestanden; für jede veröffentlichte Distribution passende Plattform-/Signatur-/Sourcebelege und Veröffentlichungsfreigabe vorhanden.
- Schritte: endgültige Artefakte/Checksummen, Versions-/Quellverweise und Releasehinweise zusammenstellen; veröffentlichbare Plattformen einzeln ausweisen; bei Freigabe konkrete Veröffentlichung ausführen und Links prüfen, andernfalls vorbereiteten Prüfstand übergeben.
- Ergebnis: konkret überprüfbares Releasepaket und dokumentierter Veröffentlichungsstatus.
- Verträge: [Veröffentlichungskriterien](product.md#veröffentlichungskriterien), [Betriebsnachweise](operations.md#betriebsnachweise), [Übergabe](templates/handoff.md).
- Abnahme: kein Artefakt ohne passende Sourceverfügbarkeit/erforderliche Signatur als öffentlich fertig; veröffentlichte Links belegt; ausstehende Distributionen mit Ursache benannt; P11 nur bei erfüllter Gesamt-Abnahme erledigt, Vorbereitung nicht als Veröffentlichung verbuchen.
- Prüfungen: finale Artefakt-/Commit-/Source-/Signaturzuordnung; nach autorisierter Veröffentlichung Download/Installation/Sourceangebot prüfen; ohne Auftrag tatsächliche Veröffentlichung ausdrücklich ausstehend lassen.
- Prüfbelege: noch keine.
