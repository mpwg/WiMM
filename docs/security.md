# Sicherheit und Datenschutz

## Vertrauensmodell

Der Nutzer hat einen vertrauenswürdigen selbst gehosteten Server gewählt. Serveradministratoren können technisch Finanzdaten lesen; es gibt in v1 keine Ende-zu-Ende-Verschlüsselung und keinen Anspruch auf Geheimhaltung gegenüber dem Betreiber. Private Daten werden gegenüber anderen angemeldeten Personen durch Autorisierung abgeschottet.

Lokale Dateien/Browserdaten sind nicht standardmäßig appverschlüsselt. Betriebssystemprofil, Gerätesperre und Festplattenverschlüsselung bilden den lokalen Schutz. Lokale Teilnehmer sind keine gegeneinander isolierten Nutzer. Bereits synchronisierte Kopien lassen sich bei Rechteentzug nicht zuverlässig entfernen.

## Identitäten und Einrichtung

Initialer Serverstart erzeugt bzw. liest ein einmaliges Setupgeheimnis. Der Betreiber erhält es lokal außerhalb gewöhnlicher Requestlogs. Bootstrap erzeugt User, private Space und Betreiberrolle atomar und wird danach deaktiviert. Keine standardmäßigen Zugangsdaten.

Eigene Benutzerkonten benötigen displayName, normalisierte E-Mail und Passwort. Normalisierung trimmt E-Mail und verwendet konsistente Kleinschreibung; keine providerspezifischen Punkt-/Plusaliasregeln. Passwort mindestens 12 Zeichen, bis 256 Unicodezeichen, nicht still trimmen. Argon2id mit individuellem Salt; initiale Untergrenze 64 MiB, drei Iterationen, Parallelität 1; Hardwarebenchmark in P8 prüfen und Parameter mit Hash speichern.

Registrierung nur über einmalige Einladung oder Bootstrap. Einladungen sieben Tage gültig, mindestens 256 Bit zufälliges Token, nur Hash serverseitig. Annahme und Rollenvergabe atomar; Replay und Parallelannahme werden abgewiesen. Keine E-Mails werden ohne später ausdrücklich eingebauten Versand verschickt; admin teilt Link selbst.

OIDC: Authorization Code + PKCE S256, State und Nonce, Discovery nur für Betreiber-konfigurierten HTTPS-Issuer, Prüfung von Issuer/Audience/Signatur/Zeit. Identity eindeutig nach issuer/subject. Keine automatische Verknüpfung bestehender Benutzer nur anhand E-Mail. Clientsecret gehört in Betreiber-Secrets; Tokens des Identitätsproviders werden nicht in Finanzdaten gespeichert. [OAuth-Standard](https://datatracker.ietf.org/doc/html/rfc9700).

## Sitzungen und Gerätekopplung

Web: mindestens 256 Bit zufälliges opakes Token, nur Hash in Datenbank, Cookie HttpOnly/Secure/SameSite=Lax und Path=/; neue ID nach Anmeldung/Privilegwechsel. 24 Stunden Inaktivität und 30 Tage absolute Laufzeit. Cookies werden niemals im LocalStorage gespiegelt. CSRF-Token an Session gebunden und für Cookie-Mutationen zusätzlich Originprüfung.

Desktop: Browseranmeldung und ausdrücklich bestätigte Gerätekopplung. deviceCode zufällig/geheim, userCode zur manuellen Bestätigung, Ablauf nach zehn Minuten, Poll frühestens alle fünf Sekunden; keine Anmeldung allein durch deviceId. Device-Token einmal ausgeliefert, widerrufbar, 30 Tage Laufzeit; anschließend neu koppeln. Token im OS-Schlüsselspeicher über native Brücke. Verfügbarkeit eines sicheren Schlüsselspeichers auf Linux wird geprüft; ohne ihn nur flüchtige Tokens und erneute Kopplung, keine Klartextdatei als Fallback.

Offline dürfen bereits bekannte verbundene Profile ihre lokale Datenkopie verwenden. Dies ist keine serverseitige Anmeldung und verlängert keine Sitzung. Neue Profile und neue Geräte benötigen Onlineanmeldung; nach erkanntem Widerruf werden Zugriffe gesperrt und ausstehende Entwürfe exportierbar gehalten. Aus der Offlinekopie kann die App keinen aktuellen Rechtebestand garantieren.

Logout widerruft Online-Session und entfernt Credentials. Die Oberfläche bietet lokales Profil beibehalten oder lokale Kopie löschen; Löschung erfordert Sicherungsentscheidung bei unbestätigten Änderungen. Passwortwechsel widerruft andere eigene Sitzungen. Passwortverlust wird ohne Maildienst über dokumentierten lokalen Betreiber-Reset mit kurzlebigem Einmalcode behandelt, niemals durch ein dauerhaftes Reset-API ohne Nachweis.

## Autorisierung

Jeder Zugriff prüft Eigentum oder aktive Membership der konkreten Ressource, nicht nur erfolgreiche Anmeldung. Zugehörigkeit aller referenzierten Konten/Kategorien/Aggregate wird geprüft. Haushalts-admin darf private Bereiche nicht lesen. Betreiberrolle bedeutet Verwaltung des Dienstes, nicht reguläre Finanz-API-Leseberechtigung für fremde Haushalte.

Lesende erhalten keine Fachmutationen. Finanzsnapshot-Restore benötigt privaten owner/Haushalts-admin. Letzter admin kann nicht entfernt werden. Neue Membership gilt erst nach Einladung/Annahme; ein Participant mit userId allein verleiht keinen Zugriff. Berechtigungscaches werden bei Änderung invalidiert, Receipts/Conflictdetails erst nach aktueller Leseberechtigung geliefert.

## Datenminimierung und Angriffsflächen

Keine automatische private Veröffentlichung, keine Telemetrie, keine Nutzerdaten in Beispielen oder Screenshots. Logs enthalten Request-ID, Route, Status, Laufzeit und generische Fehlercodes; keine Body-Payloads, Passwörter, Cookies, E-Mail-Einladungslinks oder Buchungsnotizen. Finanz-Audithistorie bleibt im berechtigten Bereich und ist kein Betriebslog.

TLS außer ausdrücklich lokalem Entwicklungsbetrieb. Same-Origin-PWA/API; keine allgemeinen CORS-Freigaben. Content Security Policy beschränkt Skripte auf gebündelte Assets, kein eval/Inline-Skriptfallback. Benutzernotizen sind Text, nie HTML. Parser verhindern XML-Entitäten, ZIP-Pfadtraversal und Dekompressionsbomben; [Formatgrenzen](formats.md) werden geprüft.

Rate-Limits: Login zehn Versuche je 15 Minuten pro IP und Konto, Device-Poll mindestens fünf Sekunden, Einladungs-/Setupversuche 20 pro 15 Minuten/IP. Normaler Sync 120 Requests/Minute/Session; Limits liefern Retry-After. Keine personenbezogenen Unterschiede in Loginfehlern.

Tauri lädt keine Remoteinhalte. Capabilities erlauben nur benötigte Dialoge, ausgewählten Datenpfad, explizite Serverorigin und sichere Tokenspeicherung. Dateipfade werden nicht als beliebige Client-Kommandos ausgeführt. Fremdlinks öffnen Systembrowser. Updates werden signiert und nur vom konfigurierten Projektkanal geladen. [Tauri-Capabilities](https://v2.tauri.app/security/capabilities/).

## Löschung und Sicherung

Bereichslöschung löscht aktiven Serverbestand und widerruft zugehörige Synczugriffe; tägliche Sicherungen können Daten bis zum Ablauf der 30 Tage enthalten. Die Oberfläche erklärt die Aufbewahrung. Referenzierte Teilnehmer bleiben als fachliche Personen historisch erhalten, ohne Loginverknüpfung. Selbstlöschung benötigt vorher Übergabe letzter admin-Rollen; privater Bereich und Sitzungen werden entfernt.

WIMM-Exporte und Finanzbackups sind ohne ausdrücklich andere Betreiberkonfiguration unverschlüsselt. Keine Passwörter/Device-Tokens in Nutzerexporten. Vollserversicherungen enthalten Authdaten und werden separat mit restriktiven Dateirechten geschützt. Wiederherstellung eines Vollservers widerruft alle Web-/Device-Sessions.

## Abnahme

[Zugriffstests](testing.md) decken Fremd-IDs, Rollenwechsel, private Veröffentlichungen, Sessionablauf, CSRF, OIDC, Setup-/Invitereplay und lokale Limits ab. Abhängigkeits-/Lizenzprüfung vor Release; Änderungen am Vertrauensmodell benötigen Nutzerentscheidung und ADR. AGPL-Quellcodeangebot ist eine Produkteigenschaft, keine Freigabe zum Offenlegen von Secrets oder Finanzdaten.
