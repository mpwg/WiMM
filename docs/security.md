# Sicherheit und Datenschutz

## Vertrauensmodell

Ende-zu-Ende-Verschlüsselung ist Pflicht ab v1. Der Server erhält keine Finanzklartexte oder privaten Schlüssel und wird für Vertraulichkeit nicht vertraut. Authentifizierte Clients gelten nach Nutzerfestlegung als vertrauenswürdig, unabhängig von Codesignatur, Attestierung oder Buildherkunft. Anmeldung und lokale Schlüsselentsperrung sind getrennt. [Verschlüsselung](encryption.md) beschreibt Schlüsselverwaltung, signierte Nachrichten und unvermeidbare Metadaten.

Lokale Dateien/Browserdaten sind nicht standardmäßig appverschlüsselt. Betriebssystemprofil, Gerätesperre und Festplattenverschlüsselung bilden den lokalen Schutz. Lokale Teilnehmer sind keine gegeneinander isolierten Nutzer. Bereits synchronisierte Kopien lassen sich bei Rechteentzug nicht zuverlässig entfernen.

## Identitäten und Einrichtung

Serverkonten und Anmeldedaten werden nicht lokal verwaltet. Vor der ersten Serveranmeldung konfiguriert der Betreiber einen externen OpenID-Connect-Anbieter oder einen vergleichbaren Identitätsdienst; Authentik ist ein mögliches Beispiel, keine fest eingebaute Abhängigkeit. Der Server unterstützt keine lokalen Passwörter, Benutzerregistrierung, Passwortzurücksetzung oder einmaligen Setupkonten. Erste Serveradministratoren werden über Gruppen-/Rollenclaims des Providers oder einen gleichwertigen dokumentierten Provider-Administrationsweg zugeordnet.

OIDC verwendet Authorization Code + PKCE S256, State und Nonce, Discovery nur für einen Betreiber-konfigurierten HTTPS-Issuer sowie Prüfung von Issuer/Audience/Signatur/Zeit. Die stabile Identität ist issuer/subject; E-Mail-Gleichheit verknüpft keine Identitäten automatisch. Provider-Clientsecrets gehören in Betreiber-Secrets. Tokens des Identitätsproviders werden nicht in Finanzdaten gespeichert. Andere Protokolle sind nur zulässig, wenn sie gleichwertig sichere externe Authentifizierung und eine stabile Identität bereitstellen; lokale Passwortkonten sind kein Fallback. [OAuth-Sicherheitsstandard](https://datatracker.ietf.org/doc/html/rfc9700).

## Sitzungen und Gerätekopplung

Web: mindestens 256 Bit zufälliges opakes Token, nur Hash in Datenbank, Cookie HttpOnly/Secure/SameSite=Lax und Path=/; neue ID nach Anmeldung/Privilegwechsel. 24 Stunden Inaktivität und 30 Tage absolute Laufzeit. Cookies werden niemals im LocalStorage gespiegelt. CSRF-Token an Session gebunden und für Cookie-Mutationen zusätzlich Originprüfung.

Desktop: Browseranmeldung und ausdrücklich bestätigte Gerätekopplung. deviceCode zufällig/geheim, userCode zur manuellen Bestätigung, Ablauf nach zehn Minuten, Poll frühestens alle fünf Sekunden; keine Anmeldung allein durch deviceId. Device-Token einmal ausgeliefert, widerrufbar, 30 Tage Laufzeit; anschließend neu koppeln. Token im OS-Schlüsselspeicher über native Brücke. Verfügbarkeit eines sicheren Schlüsselspeichers auf Linux wird geprüft; ohne ihn nur flüchtige Tokens und erneute Kopplung, keine Klartextdatei als Fallback.

Offline dürfen bereits bekannte verbundene Profile ihre lokale Datenkopie verwenden. Dies ist keine serverseitige Anmeldung und verlängert keine Sitzung. Neue Profile und neue Geräte benötigen Onlineanmeldung; nach erkanntem Widerruf werden Zugriffe gesperrt und ausstehende Entwürfe exportierbar gehalten. Aus der Offlinekopie kann die App keinen aktuellen Rechtebestand garantieren.

Logout widerruft Online-Session und entfernt Credentials. Die Oberfläche bietet lokales Profil beibehalten oder lokale Kopie löschen; Löschung erfordert Sicherungsentscheidung bei unbestätigten Änderungen. Änderungen und Sperrungen der Anmeldung erfolgen beim externen Identitätsanbieter. Der WIMM-Server stellt weder Passwortwechsel noch Passwortreset bereit; die Wiederherstellung der Finanzschlüssel bleibt davon unabhängig.

## Autorisierung

Jeder Serverzugriff prüft Eigentum/aktive Membership, öffentliche Nachrichtensignatur und signiertes KeyRoster. Konten-/Kategorie-/Finanzreferenzen kann nur der entschlüsselnde Client prüfen. Haushalts-admin erhält keine privaten K anderer Personen. Betreiberrolle bedeutet Dienstverwaltung, weder Zugriff auf Finanzklartexte noch Fähigkeit, gültige fremde Fachnachrichten/KeyGrants zu signieren.

Lesende erhalten Leseschlüssel, aber keine im signierten Manifest wirksame Schreibberechtigung. Finanzrestore benötigt owner/admin-Signatur. Letzter admin kann nicht entfernt werden. Membership erst nach Einladung und bestätigtem KeyGrant aktiv; eine fachliche Teilnehmerverknüpfung allein verleiht keinen Zugriff. Entfernung rotiert K und verschlüsselten Snapshot atomar; Rollen-/Gerätewiderruf ist signiert. Keine Appcodesignatur als Berechtigungsnachweis.

## Datenminimierung und Angriffsflächen

Keine automatische private Veröffentlichung, keine Telemetrie, keine Nutzerdaten in Beispielen oder Screenshots. Logs enthalten Request-ID, Route, Status, Laufzeit und generische Fehlercodes; keine Body-Payloads, Passwörter, Cookies, E-Mail-Einladungslinks oder Buchungsnotizen. Finanz-Audithistorie bleibt im berechtigten Bereich und ist kein Betriebslog.

TLS außer ausdrücklich lokalem Entwicklungsbetrieb. Same-Origin-PWA/API regulär; bei optional getrenntem Hosting nur konfigurierte konkrete CORS-Origin, keine Wildcards. CSP beschränkt Skripte auf Appassets; kein eval/Inline-Skriptfallback. Authentifiziertes Clientvertrauen umfasst die Laufzeit, behauptet aber keinen Schutz gegen manipulierten Clientcode. Notizen sind Text, nie HTML. Parser verhindern XML-Entitäten, ZIP-Pfadtraversal und Dekompressionsbomben; Formatgrenzen werden geprüft.

Rate-Limits: OIDC-Start/Callback, Device-Poll mindestens fünf Sekunden und Einladungsannahme 20 Versuche je 15 Minuten/IP; Authentifizierungsversuche werden zusätzlich vom externen Identitätsanbieter begrenzt. Normaler Sync 120 Requests/Minute/Session; Limits liefern Retry-After. Keine personenbezogenen Unterschiede in Loginfehlern.

Tauri lädt keine Remoteinhalte. Capabilities erlauben nur benötigte Dialoge, ausgewählten Datenpfad, explizite Serverorigin und sichere Tokenspeicherung. Dateipfade werden nicht als beliebige Client-Kommandos ausgeführt. Fremdlinks öffnen Systembrowser. Updates werden signiert und nur vom konfigurierten Projektkanal geladen. [Tauri-Capabilities](https://v2.tauri.app/security/capabilities/).

## Löschung und Sicherung

Bereichslöschung löscht aktiven Serverbestand und widerruft zugehörige Synczugriffe; tägliche Sicherungen können Daten bis zum Ablauf der 30 Tage enthalten. Die Oberfläche erklärt die Aufbewahrung. Referenzierte Teilnehmer bleiben als fachliche Personen historisch erhalten, ohne Loginverknüpfung. Selbstlöschung benötigt vorher Übergabe letzter admin-Rollen; privater Bereich und Sitzungen werden entfernt.

WIMM-/Entwurfsexporte und Desktopbackups sind standardmäßig verschlüsselt, mit unabhängiger Exportpassphrase bzw. lokal gesichertem Backupschlüssel. Serverbackups enthalten Finanzchiffrate und öffentliche Schlüsselpakete, nie deren privaten Schlüssel. Authdaten im Vollbackup brauchen weiterhin restriktive Dateirechte. Wiederherstellung widerruft Sessions; signierte Bereichsepochen/Manifeste werden erst durch autorisierte Clients erneuert. Ohne Geräte/Tresorpassphrase/Rettungscode kann der Betreiber private Finanzen nicht wiederherstellen.

## Abnahme

[Zugriffstests](testing.md) decken Fremd-IDs, Rollenwechsel, private Veröffentlichungen, Sessionablauf, CSRF, OIDC-State-/Nonce-/Issuerfehler, Einladungsreplay und lokale Limits ab. Abhängigkeits-/Lizenzprüfung vor Release; Änderungen am Vertrauensmodell benötigen Nutzerentscheidung und ADR. AGPL-Quellcodeangebot ist eine Produkteigenschaft, keine Freigabe zum Offenlegen von Secrets oder Finanzdaten.
