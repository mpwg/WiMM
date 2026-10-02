# Betrieb, Sicherung und Veröffentlichung

## Geplanter Betrieb

Eine Fastify-Serverinstanz liefert PWA und API hinter HTTPS-Reverse-Proxy. SQLite-Datei liegt auf lokalem persistentem Volume; kein Netzwerkdateisystem, Cluster oder paralleler Server auf derselben DB. Docker Compose und Images entstehen erst in P10. Offline-Desktop benötigt keinen mitgestarteten HTTP-Server.

Statische PWA-Auslieferung ohne Backend ist ebenfalls möglich. Browser-Origin ist Teil der Speicheridentität: Wechsel von Domain oder Port migriert IndexedDB nicht; vorher exportieren und auf neuer Origin importieren.

## Konfigurationsvertrag

| Variable | Default | Bedeutung |
|---|---|---|
| WIMM_HOST / WIMM_PORT | 0.0.0.0 / 3000 | Containerlistener; lokaler Entwicklungsstart bindet ausdrücklich 127.0.0.1 |
| WIMM_PUBLIC_URL | verpflichtend für Serverbetrieb | HTTPS-Origin ohne Pfad; localhost-HTTP nur Entwicklung |
| WIMM_DATA_DIR | /data | DB, Migrationen und betriebliche Daten |
| WIMM_BACKUP_DIR | /data/backups | konsistente Vollserversicherungen; bevorzugt zweites gesichertes Medium |
| WIMM_BACKUP_RETENTION_DAYS | 30 | tägliche Aufbewahrung, nicht unter 1 |
| WIMM_SETUP_SECRET_FILE | optional | Datei mit einmaligem Bootstrapgeheimnis; sonst lokale Generierung |
| WIMM_OIDC_ISSUER / WIMM_OIDC_CLIENT_ID | leer | zusammen aktivieren optionales OIDC |
| WIMM_OIDC_CLIENT_SECRET_FILE | leer | Secretdatei, nicht direkt in Compose einchecken |
| WIMM_TRUST_PROXY | false | explizite vertrauenswürdige Proxyadressen/Hops konfigurieren |
| WIMM_LOG_LEVEL | info | strukturierte Logs ohne Nutzdaten |
| WIMM_SOURCE_URL | Release-Quellarchiv | Quellcodeangebot für exakt betriebenen Build |

Konfiguration wird vor Datenmigration validiert; unvollständiges OIDC und ungültige öffentliche URL verhindern Start mit verständlichem Fehler. Pfade gehören dem Dienstbenutzer, Secretdateien haben restriktive Rechte. WIMM_SOURCE_URL darf für lokale Entwicklung auf den eigenen Quellstand verweisen, Releases benötigen tatsächlich verfügbares Archiv.

## Start und Wartung

Start: Konfiguration prüfen → DB exklusiv öffnen → Version prüfen → Backup vor notwendiger Migration → Migration transaktional ausführen → Fachreferenzen prüfen → Bereitschaft setzen. Livecheck zeigt laufenden Prozess, Readycheck zusätzlich erreichbaren konsistenten Speicher. Kein ready während Migration/Restore.

Shutdown: neue Requests stoppen, laufende Schreibtransaktion abschließen/rollback, SQLite schließen. Disk-full und SQLITE_BUSY werden als konkrete Betriebsfehler mit Request-ID sichtbar; keine still verworfenen Operationen. Schreibkonkurrenz hat begrenzte Retryzeit, danach 503. Datenbankpfad und Backupordner sind nicht als statische Webdateien erreichbar.

## Sicherungsarten

| Sicherung | Inhalt | Zeitpunkt / Aufbewahrung |
|---|---|---|
| Nutzerexport .wimm | kompletter einzelner Finanzbereich, keine Auth-/Rollenrechte | ausdrücklich, beliebige lokale Ziele |
| Desktopbackup | lokale bestätigte Daten plus Entwürfe, Profilmetadaten ohne OS-Tokens | täglich beim ersten Lauf und vor Migration, 30 Tage |
| Vollserverbackup | konsistente SQLite-DB, Schema-/Buildmanifest, Verwaltung und Syncmetadaten | täglich 03:00 Betreiberzeitzone, Default Europe/Vienna; 30 Tage |
| Vor-Migrationsbackup | identischer vollständiger Stand vor Upgrade | unabhängig von täglicher Rotation bis bestätigtem Upgrade und 30 Tagen danach |

Server-/Desktop-SQLite-Backup nutzt Online Backup API oder getestetes VACUUM INTO, nie bloßes Kopieren einer aktiven DB ohne WAL. Temporäre Sicherung nach Abschluss integritätsprüfen und atomar umbenennen. Retention bereinigt erst nach erfolgreicher neuer Sicherung. [SQLite-Backup](https://www.sqlite.org/backup.html).

PWA kann Downloads nicht ohne Nutzerinteraktion als verlässliche tägliche Sicherung garantieren. Sie erinnert nach sieben Tagen ohne Export und nach wichtigen Datenmigrationen. Hinweise sind quittierbar; Browserpersistenz wird angefragt und Speicherfehler klar angezeigt. Ein Gerät, das am vorgesehenen Zeitpunkt nicht läuft, sichert Desktopdaten beim nächsten Start.

## Wiederherstellung

Nutzerrestore legt standardmäßig unabhängigen lokalen Bereich an; vorhandenen Bereich nur nach expliziter Bestätigung ersetzen. Datenvalidierung und Referenzabbildung vor Änderungen. Serverbereichsrestore erzeugt neue Epoche; Clients sichern ausstehende Operationen und laden neuen Snapshot. Details in [Formate](formats.md) und [Sync](synchronization.md).

Vollserverrestore: Dienst stoppen, aktuellen Datenordner sichern, Build-/Schemasversion der Sicherung installieren, Backupintegrität prüfen, konsistente DB einspielen, alle Sessions/Device-Tokens widerrufen und alle Bereichsepochen erneuern. Erst danach ready setzen. Benutzer-/Mitgliedschaftsdaten bleiben aus dem Backup; Clients benötigen neue Anmeldung und Entwurfsprüfung. Kein Start eines älteren Binaries auf einer neueren DB.

RPO bei funktionierender täglicher Sicherung maximal 24 Stunden; ungesicherte Offlinegeräte können mehr verlieren. Wiederherstellung auf dem dokumentierten Referenzsystem soll bei 50.000 Buchungen unter zehn Minuten abgeschlossen werden. Diese Ziele sind Prüfziele, keine garantierte Verfügbarkeit ohne funktionierende Backups.

## Migration und Release

Storage-, Export- und Protokollversion getrennt führen. Nur vorwärts gerichtete Migrationen, keine ungeprüften Rollbacks. Downgrade durch passendes Vollbackup und Build. Migrationsschema mit Ausgangsfixture prüfen, Abbruch/Rollback simulieren und Wiederholungsstart testen. Finanzbereichssnapshots enthalten keine Infrastrukturkonfiguration.

CI ab P1: Format-/Typprüfung, Vitest, Builds. Ab P4 Web-E2E; ab P8 API-/Zugriffstests; vor Release Plattformbuilds und native Smokechecks. Desktoppakete: macOS DMG, Windows Installer, Linux AppImage; unterstützte Architekturen in P1 festlegen: macOS arm64/x64, Windows x64, Linux x64. Plattformen ohne verfügbar getesteten Build bleiben ausdrücklich unveröffentlicht.

Signierung und macOS-Notarisierung über externe Secrets. Dockerimage wird nach Commit und Releaseversion getaggt, Deployment pinnt digest statt latest. Desktopupdater prüft signierte Metadaten, verlangt Updatezustimmung und führt Backup vor Migration durch. Web-Service-Worker wartet bei laufender Bearbeitung auf ausdrücklichen Neustart.

## AGPL-3.0-or-later und Herkunft

Projekt einschließlich eigener Dokumentation und späterer Pakete: AGPL-3.0-or-later. Der unveränderte [Lizenztext](../LICENSE) nennt Version 3; der [Projektlizenzhinweis](../README.md) erlaubt ausdrücklich Version 3 oder jede spätere Version. Eigene Paketmetadaten/SPDX-Header verwenden `AGPL-3.0-or-later`.

Releases liefern vollständigen zugehörigen Quellcode einschließlich Build-/Installationsskripten und gesperrten Abhängigkeiten sowie Lizenztext und Fremdhinweise. Die Oberfläche besitzt unter Hilfe/Über einen erreichbaren Quellcode- und Lizenzpunkt; Serverbuilds bieten den tatsächlich betriebenen, gegebenenfalls geänderten Quellstand an. Source-URL und Commit-/Build-ID werden in `/api/v1/meta` ausgegeben. Buildpakete dürfen ohne passende Quellcodeverfügbarkeit nicht als veröffentlichungsfertig markiert werden. [AGPL-Lizenztext, insbesondere §§ 6, 13, 14](https://www.gnu.org/licenses/agpl-3.0.html).

Bei Actual-Übernahme entsteht später ein Herkunftsregister mit Repository, Pfad, unveränderlichem Commit, Lizenz, Copyright, lokalen Änderungen und Datum. Fremde MIT-/ISC-Hinweise werden erhalten, nicht durch AGPL-Header ersetzt. Abhängigkeiten, Fonts und Icons werden ebenfalls auf Lizenzkompatibilität geprüft; keine ungeprüfte Übernahme kommerzieller Markenassets.

## Betriebsnachweise

Releasecheck umfasst Buildversion, Quellarchiv, gültige Signatur, native Startprüfung, erfolgreicher Nutzer-/Vollserverrestore, Backup-Retention und redigierte Logs. Fehlende Geheimnisse halten nur Veröffentlichung auf. Keine Deployments, Images oder Updater werden im aktuellen D0-Auftrag tatsächlich erstellt.
