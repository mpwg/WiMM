# WiMM

WiMM ist eine mobile Webanwendung für gemeinsame Einnahmen und Ausgaben. Jeder Bereich hat eigene Konten, Kategorien, Buchungen und Belege. Ein OpenID-Connect-Provider liefert Gruppen für die Rollen Leser, Bearbeiter und Besitzer.

Buchungen lassen sich erfassen, filtern, ändern und löschen. CSV-Dateien werden zuerst als Vorschau geprüft. Belege bleiben im privaten Dateispeicher und sind nur mit Bereichszugriff abrufbar. Über das Web-App-Manifest lässt sich WiMM in unterstützten Browsern zum Startbildschirm hinzufügen. Die Anwendung benötigt eine Serververbindung.

## Lokal starten

Voraussetzung ist die in [`.bun-version`](.bun-version) festgelegte Bun-Version.

```sh
bun install --frozen-lockfile
cp .env.example .env
cp deploy/access.example.json deploy/access.json
chmod 600 .env
bun run db:migrate
bun run dev
```

Für die Anmeldung `NUXT_PUBLIC_APP_URL` auf die lokale Anwendungsadresse setzen, `NUXT_SESSION_PASSWORD` mit mindestens 32 zufälligen Zeichen belegen und die OIDC-Variablen eintragen. Die Callback-URL lautet `/auth/oidc` unter dieser Anwendungsadresse. Das Gruppenmapping steht in `deploy/access.json`. Änderungen am Mapping oder an Bereichen erfordern einen erneuten Migrationslauf und einen Neustart.

Die [Referenzarchitektur](docs/architecture/reference-architecture.md) beschreibt die Daten- und HTTP-Verträge, das Gruppenmapping sowie Installation, Update und Wiederherstellung. SQLite speichert Beträge als exakte Ganzzahlen in Cent. Alte SQL-Migrationen bleiben Teil der Prüfhistorie.

## Prüfen

```sh
bun run typecheck
bun run test
bun run build
bunx --bun --no-install playwright install chromium
bun run test:e2e
```

Die Browserprüfung startet den gebauten Server mit einem lokalen OIDC-Testprovider und einer temporären SQLite-Datenbank. Sie prüft die tatsächlichen HTTP-Schnittstellen und Bedienabläufe in Chromium bei Mobil- und Desktopbreite. CI baut außerdem das Containerimage und prüft Compose-Start, Persistenz, blockierten Start bei fehlerhafter Migration und Restore in ein separates Volume.

TypeScript 6 ist festgesetzt, weil `vue-tsc` für die Prüfung der Vue-Templates die JavaScript-Schnittstelle des Compilers benötigt. Der eigenständige TypeScript-Check lief auch mit 7.0.2. [Vue Language Tools zur Unterstützung von TypeScript 7](https://github.com/vuejs/language-tools/issues/6156)

`bun run db:generate` erzeugt Migrationen aus dem Drizzle-Schema. SQL und Metadaten gemeinsam prüfen und einchecken. Im Betrieb laufen ausschließlich eingecheckte Migrationen.

## Containerbetrieb

```sh
docker build -t wimm:local .
docker compose config --quiet
docker compose up -d --wait app
docker compose ps -a
```

Für die lokale Probe kann `WIMM_IMAGE=wimm:local` gesetzt werden. Für den Betrieb verweist `WIMM_IMAGE` auf einen Image-Digest. Bei einem Versions-Tag wie `v0.1.0` veröffentlicht der Workflow nach erfolgreicher Abnahme das Image in GHCR. Die unveränderliche Referenz steht in der Zusammenfassung des Workflows. Der Container verwendet UID/GID 10001, ein lokales Datenvolume und ein schreibgeschützt eingebundenes Gruppenmapping. Der App-Port bindet an Loopback. Der vorhandene HTTPS-Proxy leitet die gesamte Domain weiter. Die Vorlage steht in [`deploy/nginx.example.conf`](deploy/nginx.example.conf). Für containerisierte Proxys gibt es zusätzlich [`deploy/compose.proxy.yaml`](deploy/compose.proxy.yaml).

Bei gestoppter Anwendung erzeugt `backup` ein gemeinsames TAR-Archiv aus SQLite-Snapshot, privaten Belegen, Prüfsummen und dem Bereichsmapping. `restore --stdin` validiert das Archiv und stellt es in einem vorbereiteten, gestoppten Compose-Projekt wieder her. Ein vorhandener Datenstand erfordert `--replace` und wird separat gesichert. Alte Sitzungen sind nach Restore ungültig.

```sh
docker compose stop app
docker compose run --rm --no-deps -T ops bun tools/manage.mjs backup > wimm-backup.tar
docker compose start app
```

Starte die Anwendung nach dem Sicherungsversuch wieder und prüfe den Exitcode des Backup-Befehls, bevor du das Archiv verwendest. Vor produktiver Nutzung die Wiederherstellung mit dem vorgesehenen Image und eine Anmeldung mit jeder konfigurierten Rolle prüfen. Die vollständige Reihenfolge für [Update, Sicherung und Restore](docs/architecture/reference-architecture.md#10-backup-wiederherstellung-und-überwachung) steht in der Referenzarchitektur.
