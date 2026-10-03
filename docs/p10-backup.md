# P10 — Teilaufgaben für Sicherung und Betrieb

## Auftrag und Reihenfolge

Diese Teilaufgaben konkretisieren [P10](tasks.md#p10--sicherung-und-betrieb). Der Nutzerauftrag vom 3. Oktober 2026 erlaubt ihre Planung; die Implementierungsfreigabe für P10 steht aus. P10.1 bis P10.6 werden in Reihenfolge nach abgeschlossenem [P9](p9-sync.md) bearbeitet. Finanzrestore und Schlüsselrecovery bleiben Clientaufgaben; Betreiberbackups enthalten ausschließlich vorhandene Chiffrate und öffentliche Verwaltung.

Status und konkrete Prüfbelege hier sowie den Gesamtstatus in [tasks.md](tasks.md) pflegen; nach jedem abgeschlossenen Abschnitt einen zusammengehörigen Zwischencommit und eine [Übergabe](templates/handoff.md) erstellen. P10 ist erst nach allen Teilabnahmen und der Gesamt-Abnahme erledigt; danach folgt [P11](p11-release.md). Für die Umsetzung wimm-e2ee und wimm-workflow verwenden, bei Finanzrestore wimm-finance und für Wiederherstellungsdialoge wimm-ui. Deployment oder Veröffentlichungen benötigen weiterhin einen entsprechenden Auftrag.

## P10.1 — Vollständige WIMM- und Entwurfscontainer

- Status: offen.
- Freigabe: Implementierungsauftrag für P10 erforderlich.
- Voraussetzungen: P9 erledigt; verschlüsselte Containerbasis aus P9.1 und UI-Entwurfsexport aus P9.6 vorhanden.
- Schritte: vorhandene Containerbasis zum vollständigen WIMM-Export mit etabliertem ZIP-Werkzeug ausbauen; konsistenten sichtbaren Bereichsstand, Manifest, Arrays/Referenzen und SHA-256-Dateiangaben erzeugen; separate Exportpassphrase und Limits durchgehend anwenden.
- Ergebnis: eigenständig verschlüsselte .wimm-/wimm-drafts-Dateien ohne Credentials oder private Identitäts-/Geräteschlüssel.
- Verträge: [WIMM-Export](formats.md#wimm-export-v1), [Verschlüsselung](encryption.md), [Datenmodell](data-model.md).
- Abnahme: WIMMENC1/Header/AAD/KDF und Manifestkennzeichnung containsUnconfirmedChanges korrekt; frische Salt/Nonce; private Links nur in Privatbereich; Projektionen keine Exportquelle; Bereichstrennung erhalten.
- Prüfungen: C13, Manifest/Checksummen/Recordcounts, leere Arrays, sichtbarer Stand mit Entwürfen, falsche Passphrase und manipuliertes Chiffrat vor ZIP-Verarbeitung.
- Prüfbelege: noch keine.

## P10.2 — Clientrestore und Schlüsselrecovery

- Status: offen.
- Freigabe: Implementierungsauftrag für P10 erforderlich.
- Voraussetzungen: P10.1 erledigt.
- Schritte: Container/ZIP-Limits und vollständige Fach-/Referenzvalidierung vor Änderungen durchführen; neuen lokalen Bereich mit neuen IDs/Keys anlegen; bestehenden Bereich nur nach Backup/Bestätigung ersetzen; Rettungscode-/Tresorwiederherstellung getrennt führen.
- Ergebnis: überprüfbare lokale Wiederherstellung ohne neue Mitgliedschaften oder Serverrechte.
- Verträge: [Restore](formats.md#validierung-und-wiederherstellung), [Recovery](encryption.md), [UI](ui.md).
- Abnahme: fehlerhafte Datei verändert nichts; Pfadtraversal/Symlink/Zipbomb abgewiesen; Fachprojektionen erhalten; fremde PublicationLinks unverbindlich; fehlende alle Recoverymittel nicht durch Betreiber ersetzbar.
- Prüfungen: C10–C13, beschädigte/fehlende Datei, falsche Checksummen, unsichere Zahlen, fremde Referenzen/neuere Version; kanonischer Vorher-/Nachhervergleich von Salden/Budgets/Ausgleich.
- Prüfbelege: noch keine.

## P10.3 — Backups, Retention und Migrationen

- Status: offen.
- Freigabe: Implementierungsauftrag für P10 erforderlich.
- Voraussetzungen: P10.2 erledigt.
- Schritte: tägliche verschlüsselte Desktopbackups und konsistente Chiffratserverbackups implementieren; Vor-Migrationssicherung, Integritätsprüfung/atomare Umbenennung, Retention und Wiederholungsstart anbinden; PWA-Exporterinnerung umsetzen.
- Ergebnis: nachvollziehbare Sicherungsrotation und geprüfte Vorwärtsmigrationen.
- Verträge: [Sicherungsarten](operations.md#sicherungsarten), [Schemaentwicklung](data-model.md#schemaentwicklung), [Schlüsselschutz](encryption.md).
- Abnahme: Desktopbackupkey im Tresor, keine Klartexttempkopie; Serverbackup via Online Backup API/getestetem VACUUM INTO; Retention erst nach Erfolg, letzte funktionierende Sicherung erhalten; kein ready während Migration.
- Prüfungen: tägliche/verspätete Ausführung und Betreiberzeitzone, Disk-full, Backupfehler/Retention, WAL-konsistentes Backup, alle unterstützten Ausgangsschemata mit Abbruch/Neustart.
- Prüfbelege: noch keine.

## P10.4 — Bereichsrestore und Vollserverwiederanlauf

- Status: offen.
- Freigabe: Implementierungsauftrag für P10 erforderlich.
- Voraussetzungen: P10.3 erledigt.
- Schritte: clientgeprüften/signierten Bereichsrestore mit neuer Epoche anbinden; vollständigen Betreiberrestore samt Datenordnersicherung und Session-/Device-Tokenwiderruf umsetzen; Bereiche bis autorisierter Clientbestätigung gegen reguläre Writes sperren.
- Ergebnis: Wiederherstellung mit geschützten Entwürfen und clientautorisiertem Wiederanlauf.
- Verträge: [Betriebsrestore](operations.md#wiederherstellung), [Snapshotersatz](synchronization.md#snapshotersatz-und-epochen), [C14](testing.md).
- Abnahme: Betreiber signiert/manipuliert keine Epochen/Roster; gepinnte Hashstände clientseitig geprüft; alte Session ungültig; Altwrite EPOCH_MISMATCH; keine destruktive lokale Übernahme ohne gesicherte Entwürfe/Platz.
- Prüfungen: C14/S12, Nutzer-/Vollrestore, alte Offlineclients, fehlende Keys, manipulierte Manifeste, Wiederanlaufabbruch und unabhängige Bereiche.
- Prüfbelege: noch keine.

## P10.5 — Reproduzierbares Self-Hosting und Updateabläufe

- Status: offen.
- Freigabe: Implementierungsauftrag für P10 erforderlich.
- Voraussetzungen: P10.4 erledigt.
- Schritte: Dockerimage/Compose und HTTPS-Proxybeispiel mit lokalem Volume erstellen; Provider-/Secretdateikonfiguration, Backup-/Update-/Shutdownabläufe und getrennte PWA-Auslieferung dokumentieren; Builds an Commit/Quellstand binden.
- Ergebnis: lokal prüfbare Self-Hosting-Artefakte mit sicherer Konfiguration.
- Verträge: [Betrieb](operations.md), [Sicherheit](security.md), [Architektur](architecture.md).
- Abnahme: keine eingecheckten Secrets; keine DB/Backups als Webdateien; eine SQLite-Instanz ohne NFS/Cluster; Konfiguration vor Migration geprüft; Update sichert Daten, PWA erzwingt keinen Neustart bei Bearbeitung.
- Prüfungen: Docker-Neustart/Volumeerhalt, HTTPS/Proxy/Origin, fehlender Provider, Shutdown mit Write, Upgrade/Migration und lokal nachvollziehbarer Image-/Sourcebezug.
- Prüfbelege: noch keine.

## P10.6 — Verlustszenarien und Gesamt-Abnahme

- Status: offen.
- Freigabe: Implementierungsauftrag für P10 erforderlich.
- Voraussetzungen: P10.5 erledigt.
- Schritte: Export-/Restore-/Recovery-/Betriebssuiten zusammenführen; RPO/RTO auf dokumentiertem Referenzsystem messen; Bedien- und Betreiberanleitungen anhand tatsächlicher Abläufe korrigieren.
- Ergebnis: nachgewiesener Schutz gegen Datenverlust und reproduzierbarer Betrieb.
- Verträge: [P10](tasks.md#p10--sicherung-und-betrieb), [Betriebsziele](operations.md#wiederherstellung), [Tests](testing.md).
- Abnahme: C10–C14 bestanden; Fachprojektionen erhalten; fehlerhafte Datei ohne Dateneingriff; Retention erhält letzte gute Sicherung; RPO-Ziel 24 Stunden bei täglichem Backup/RTO-Ziel unter zehn Minuten bei 50.000 Buchungen gemessen und Abweichungen benannt.
- Prüfungen: sämtliche Nutzer-/Vollrestores, verlorene Keys/falsche Passphrase, Altclientwrites, Quota/Disk-full, Retention/Migrationsabbruch, Docker-Neustart und redigierter Serverbackup-/Logcheck.
- Prüfbelege: noch keine.
