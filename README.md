# WiMM

Mobile-first Webanwendung für gemeinsame Einnahmen und Ausgaben. Die [Referenzarchitektur](docs/architecture/reference-architecture.md) beschreibt die Zielarchitektur; dieses Repository enthält deren technische Basis.

## Umgesetzte Basis

- Nuxt 4 mit Vue, TypeScript, Nuxt UI und Tailwind; clientseitige Oberfläche mit Nitro-Node-Server.
- SQLite/Drizzle mit versionierter SQL-Migration für Identitäten, Sitzungen, Bereiche, Konten, Kategorien, Buchungen, Importvorschauen und Belege.
- Bereichsübergreifende Fremdschlüssel, WAL, `foreign_keys=ON`, `busy_timeout=5000`, `synchronous=FULL` und exakte 64-Bit-Centbeträge.
- Validierte Bereichskonfiguration, Rollenrangfolge, Sitzungs- und Gruppenablauf als serverseitige Fachlogik.
- Startprüfung von Migrationshistorie, Datenbankintegrität und Bereichskonfiguration; `/health/live` und `/health/ready`.
- Verwaltungsbefehle, Docker-Image, Compose einschließlich Migrationsdienst, Proxy-Vorlagen und automatisierte Prüfungen.

Die Oberfläche zeigt den Einrichtungszustand. Noch offen sind der vollständige OIDC-Adapter mit SQLite-Sitzungen und CSRF, die geschützten Fachendpunkte und Bedienabläufe, CSV-Import, Belegspeicherung einschließlich Wiederanlauf, Backup/Restore und Installationsmanifest. Nuxt Auth Utils, `jose` und `csv-parse` sind dafür als Abhängigkeiten vorbereitet. Es gibt keinen Entwicklungslogin und keine freigegebenen Finanzdaten. `/api/session` antwortet mit 401; die eingebauten Cookie-Sitzungsendpunkte sind gesperrt, bis der Datenbankadapter existiert. Diese Basis ist noch keine produktiv nutzbare Finanzanwendung.

## Lokal starten

Voraussetzungen: Node.js 24 (siehe `.node-version`) und die in `package.json` angegebene pnpm-Version.

```sh
pnpm install --frozen-lockfile
cp .env.example .env
cp deploy/access.example.json deploy/access.json
chmod 600 .env
```

In `.env` insbesondere `NUXT_SESSION_PASSWORD` durch mindestens 32 zufällige Zeichen ersetzen. Für lokale Entwicklung `NUXT_PUBLIC_APP_URL=http://localhost:3000` setzen. Die lokalen Speicherpfade aus der Vorlage können bleiben. Das Gruppenmapping steht in `deploy/access.json`; diese Datei und `.env` werden nicht eingecheckt.

```sh
pnpm db:migrate
pnpm dev
```

Nuxt lädt `.env` im Entwicklungsbetrieb. Die Verwaltungsbefehle lesen `.env` ebenfalls, vorhandene Umgebungsvariablen haben Vorrang. Änderungen an Bereichen benötigen einen erneuten Migrations-/Konfigurationslauf; entfernte Bereiche werden nicht gelöscht. Fehlerhafte oder fehlende Konfiguration und nicht angewandte Migrationen verhindern den Serverstart. Im Produktionsbetrieb injiziert Compose die Umgebungsvariablen.

## Struktur

```text
app/                Oberfläche
server/api/         HTTP-Handler
server/routes/      Health-Endpunkte
server/modules/     Identität/Zugriffsrechte und Finanzlogik
server/db/          SQLite-Verbindung, Schema und Lebenszyklus
shared/schemas/     Zod-Schemata und transportierbare Verträge
migrations/         SQL-Migrationen und Drizzle-Metadaten
tools/              Verwaltungsbefehle
deploy/             Bereichskonfiguration und Proxy-Vorlagen
tests/              Fach-, SQLite- und Browser-Smoke-Tests
```

Beleg- und Importmodule entstehen mit ihrer ersten funktionsfähigen Implementierung. Servercode importiert keine Oberfläche; Browsercode erhält keinen Datenbankzugriff. IDs und Zugriffsprüfungen müssen bei der Umsetzung der HTTP-Endpunkte serverseitig entstehen.

## Prüfen und bauen

```sh
pnpm typecheck
pnpm test
pnpm build
pnpm exec playwright install chromium
pnpm test:e2e
```

Die Browsertests starten den gebauten Produktionsserver und erwarten eine vorbereitete lokale Datenbank, Bereichskonfiguration und `NUXT_SESSION_PASSWORD` in der Umgebung. Sie prüfen die Oberfläche bei Desktop- und Mobilbreite sowie die Health-Endpunkte. Die SQLite-Tests verwenden echte temporäre Dateien und prüfen Migrationen, Fremdschlüssel, Versionsbedingungen und Centpräzision. OIDC-, Import-, Beleg- und Restore-Abnahmen aus der Zielarchitektur sind noch offen.

`pnpm db:generate` erzeugt neue Migrationen aus `server/db/schema.ts`. SQL prüfen und zusammen mit den Drizzle-Metadaten committen. Im Betrieb ausschließlich Migrationen anwenden, kein Schema-Push.

## Container

```sh
docker build -t wimm:local .
```

Für einen veröffentlichten Stand `WIMM_IMAGE` in `.env` auf dessen unveränderliche Image-Referenz setzen. Compose verwendet UID/GID 10001, ein lokales Datenvolume und das schreibgeschützte Gruppenmapping.

```sh
docker compose config --quiet
docker compose up -d app
docker compose ps -a
docker compose logs --tail=100 migrate app
```

Der Migrationsdienst muss erfolgreich abschließen, bevor die Anwendung startet. Der App-Port bindet an `127.0.0.1:3000`; ein vorhandener HTTPS-Proxy übernimmt die Domain. Siehe `deploy/nginx.example.conf`. Für einen containerisierten Proxy kann `deploy/compose.proxy.yaml` ergänzt werden (Compose >= 2.24.4 für `!reset`); das externe Netzwerk heißt standardmäßig `proxy`, Ziel ist `http://app:3000`.

```sh
docker compose run --rm --no-deps ops node tools/manage.mjs verify
docker compose run --rm --no-deps ops node tools/manage.mjs revoke-sessions USER_ID
```

Weitere Befehle: `migrate`, `healthcheck`, `help`. Backup/Restore-Befehle aus dem Architekturdokument sind noch nicht implementiert. Vor produktiver Nutzung sind diese und ihre Wiederherstellungsprobe nachzurüsten. Migrationen und Updates erfolgen nur bei gestoppter Anwendung. Für vorhandene Datenvolumes müssen die Rechte zu UID/GID 10001 passen.
