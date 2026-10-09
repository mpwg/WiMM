# P10 — Spezifikation für Sicherung und Betrieb

## Ziel und Verantwortung

Diese funktionale Spezifikation bleibt verbindlich; aktueller Auftrag/Freigabe ausschließlich in [Aufgaben](tasks.md), Fortschritt und Blockaden in GitHub. Die gemeinsame Rust-Architektur ist Ziel, keine behauptete Implementierung. Fachregeln im Rust-Kern, Clientabläufe in Rust-Anwendung, Serverabläufe im öffentlichen Rust-Server; Plattformen bleiben Adapter. Neue Produktfeatures dieses Pakets benötigen weiterhin ihren gesonderten Auftrag. [Architektur](architecture.md), [Prüfstrategie](testing.md).

## P10.1 — Vollständige WIMM- und Entwurfscontainer

- Voraussetzungen: P9 erledigt; verschlüsselte Containerbasis aus P9.1 und UI-Entwurfsexport aus P9.6 vorhanden.
- Schritte: vorhandene Containerbasis zum vollständigen WIMM-Export mit etabliertem ZIP-Werkzeug ausbauen; konsistenten sichtbaren Bereichsstand, Manifest, Arrays/Referenzen und SHA-256-Dateiangaben erzeugen; separate Exportpassphrase und Limits durchgehend anwenden.
- Ergebnis: eigenständig verschlüsselte .wimm-/wimm-drafts-Dateien ohne Credentials oder private Identitäts-/Geräteschlüssel.
- Verträge: [WIMM-Export](formats.md#wimm-export-v1), [Verschlüsselung](encryption.md), [Datenmodell](data-model.md).
- Abnahme: WIMMENC1/Header/AAD/KDF und Manifestkennzeichnung containsUnconfirmedChanges korrekt; frische Salt/Nonce; private Links nur in Privatbereich; Projektionen keine Exportquelle; Bereichstrennung erhalten.
- Prüfungen: C13, Manifest/Checksummen/Recordcounts, leere Arrays, sichtbarer Stand mit Entwürfen, falsche Passphrase und manipuliertes Chiffrat vor ZIP-Verarbeitung.

## P10.2 — Clientrestore und Schlüsselrecovery

- Voraussetzungen: P10.1 erledigt.
- Schritte: Container/ZIP-Limits und vollständige Fach-/Referenzvalidierung vor Änderungen durchführen; neuen lokalen Bereich mit neuen IDs/Keys anlegen; bestehenden Bereich nur nach Backup/Bestätigung ersetzen; Rettungscode-/Tresorwiederherstellung getrennt führen.
- Ergebnis: überprüfbare lokale Wiederherstellung ohne neue Mitgliedschaften oder Serverrechte.
- Verträge: [Restore](formats.md#validierung-und-wiederherstellung), [Recovery](encryption.md), [UI](ui.md).
- Abnahme: fehlerhafte Datei verändert nichts; Pfadtraversal/Symlink/Zipbomb abgewiesen; Fachprojektionen erhalten; fremde PublicationLinks unverbindlich; fehlende alle Recoverymittel nicht durch Betreiber ersetzbar.
- Prüfungen: C10–C13, beschädigte/fehlende Datei, falsche Checksummen, unsichere Zahlen, fremde Referenzen/neuere Version; kanonischer Vorher-/Nachhervergleich von Salden/Budgets/Ausgleich.

## P10.3 — Backups, Retention und Migrationen

- Voraussetzungen: P10.2 erledigt.
- Schritte: tägliche verschlüsselte Desktopbackups und konsistente Chiffratserverbackups implementieren; Vor-Migrationssicherung, Integritätsprüfung/atomare Umbenennung, Retention und Wiederholungsstart anbinden; PWA-Exporterinnerung umsetzen.
- Ergebnis: nachvollziehbare Sicherungsrotation und geprüfte Vorwärtsmigrationen.
- Verträge: [Sicherungsarten](operations.md#sicherungsarten), [Schemaentwicklung](data-model.md#schemaentwicklung), [Schlüsselschutz](encryption.md).
- Abnahme: Desktopbackupkey im Tresor, keine Klartexttempkopie; Serverbackup via Online Backup API/getestetem VACUUM INTO; Retention erst nach Erfolg, letzte funktionierende Sicherung erhalten; kein ready während Migration.
- Prüfungen: tägliche/verspätete Ausführung und Betreiberzeitzone, Disk-full, Backupfehler/Retention, WAL-konsistentes Backup, alle unterstützten Ausgangsschemata mit Abbruch/Neustart.

## P10.4 — Bereichsrestore und Vollserverwiederanlauf

- Voraussetzungen: P10.3 erledigt.
- Schritte: clientgeprüften/signierten Bereichsrestore mit neuer Epoche anbinden; vollständigen Betreiberrestore samt Datenordnersicherung und Session-/Device-Tokenwiderruf umsetzen; Bereiche bis autorisierter Clientbestätigung gegen reguläre Writes sperren.
- Ergebnis: Wiederherstellung mit geschützten Entwürfen und clientautorisiertem Wiederanlauf.
- Verträge: [Betriebsrestore](operations.md#wiederherstellung), [Snapshotersatz](synchronization.md#snapshotersatz-und-epochen), [C14](testing.md).
- Abnahme: Betreiber signiert/manipuliert keine Epochen/Roster; gepinnte Hashstände clientseitig geprüft; alte Session ungültig; Altwrite EPOCH_MISMATCH; keine destruktive lokale Übernahme ohne gesicherte Entwürfe/Platz.
- Prüfungen: C14/S12, Nutzer-/Vollrestore, alte Offlineclients, fehlende Keys, manipulierte Manifeste, Wiederanlaufabbruch und unabhängige Bereiche.

## P10.5 — Reproduzierbares Self-Hosting und Updateabläufe

- Voraussetzungen: P10.4 erledigt.
- Schritte: Dockerimage/Compose und HTTPS-Proxybeispiel mit lokalem Volume erstellen; Provider-/Secretdateikonfiguration, Backup-/Update-/Shutdownabläufe und getrennte PWA-Auslieferung dokumentieren; Builds an Commit/Quellstand binden.
- Ergebnis: lokal prüfbare Self-Hosting-Artefakte mit sicherer Konfiguration.
- Verträge: [Betrieb](operations.md), [Sicherheit](security.md), [Architektur](architecture.md).
- Abnahme: keine eingecheckten Secrets; keine DB/Backups als Webdateien; eine SQLite-Instanz ohne NFS/Cluster; Konfiguration vor Migration geprüft; Update sichert Daten, PWA erzwingt keinen Neustart bei Bearbeitung.
- Prüfungen: Docker-Neustart/Volumeerhalt, HTTPS/Proxy/Origin, fehlender Provider, Shutdown mit Write, Upgrade/Migration und lokal nachvollziehbarer Image-/Sourcebezug.

## P10.6 — Verlustszenarien und Gesamt-Abnahme

- Voraussetzungen: P10.5 erledigt.
- Schritte: Export-/Restore-/Recovery-/Betriebssuiten zusammenführen; RPO/RTO auf dokumentiertem Referenzsystem messen; Bedien- und Betreiberanleitungen anhand tatsächlicher Abläufe korrigieren.
- Ergebnis: nachgewiesener Schutz gegen Datenverlust und reproduzierbarer Betrieb.
- Verträge: [P10](tasks.md#p10--sicherung-restore-und-betrieb), [Betriebsziele](operations.md#wiederherstellung), [Tests](testing.md).
- Abnahme: C10–C14 bestanden; Fachprojektionen erhalten; fehlerhafte Datei ohne Dateneingriff; Retention erhält letzte gute Sicherung; RPO-Ziel 24 Stunden bei täglichem Backup/RTO-Ziel unter zehn Minuten bei 50.000 Buchungen gemessen und Abweichungen benannt.
- Prüfungen: sämtliche Nutzer-/Vollrestores, verlorene Keys/falsche Passphrase, Altclientwrites, Quota/Disk-full, Retention/Migrationsabbruch, Docker-Neustart und redigierter Serverbackup-/Logcheck.
