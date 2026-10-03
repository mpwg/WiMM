# Verpflichtende Ende-zu-Ende-Verschlüsselung

## Verbindlichkeit und Schutzumfang

Diese Spezifikation ersetzt das ursprüngliche Modell eines mitlesenden Finanzservers. E2EE ist Pflicht ab v1, kein Schalter und keine spätere Erweiterung. Sämtliche Finanzinhalte werden vor Verlassen eines autorisierten Clients verschlüsselt: Kontonamen, Buchungen, Beträge, Notizen, Kategorien, Budget, freiwillige Einkommensangaben, Ziele, Familienausgleich, Teilnehmernamen, Veröffentlichungskopien und Finanzsnapshots.

Server, Reverse-Proxy, Betreiberbackup und Logs enthalten keine Finanzklartexte, unverschlüsselten Finanzschlüssel oder privaten Identitäts-/Geräteschlüssel. Öffentlich notwendige Metadaten bleiben: Loginidentität, User-/Geräte-/Bereichs-IDs, Rollen, öffentliche Schlüssel/Zertifikate, Keyversion, Epoche, opake Aggregathandles, Revisionen, Cursor, Zeitpunkte sowie Chiffratgröße und Zugriffsmuster. Keine Zusage der Anonymität oder vollständigen Metadatenverbergung.

Der Server ist für Finanzvertraulichkeit nicht vertrauenswürdig. Nach Nutzerfestlegung gelten authentifizierte Clients und ihre Laufzeit als vertrauenswürdig: keine App-Signatur, Attestierung oder Liste genehmigter Builds als Zugangsbedingung. Die Authentifizierung berechtigt zum Transportzugriff; lokal vorhandene/entsperrte Schlüssel ermöglichen die Entschlüsselung. Signaturen von Protokollnachrichten sind keine Signaturen des Clientprogramms. Kompromittierte entsperrte Laufzeiten und bereits berechtigte Leser liegen außerhalb dieses Schutzes. Ein aktiver Server kann Daten vorenthalten, löschen oder unterschiedliche Historien ausliefern. Nachrichtenprüfung erkennt Veränderungen und bekannte Replays, garantiert aber keine Verfügbarkeit oder vollständige Erkennung bisher unbekannter Serverforks.

## Etablierte Primitive statt eigener Kryptografie

`packages/crypto` kapselt eine gepflegte libsodium-WASM-Bindung für alle Clients. Keine selbst entworfenen Cipher/KDF/Signaturimplementierungen; Interoperabilität wird durch feste Testvektoren geprüft. Primitive:

- XChaCha20-Poly1305-IETF für Finanzpayloads und verschlüsselte Tresore; zufälliger 32-Byte-Schlüssel und frische kryptografisch zufällige 24-Byte-Nonce je neuer Verschlüsselung.
- Ed25519 für Identitäts-/Gerätezertifikate, Rollenmanifest, Schlüsselpakete, Operationen und Snapshotmanifeste.
- libsodium sealed boxes (`crypto_box_seal`) für Bereichsschlüssel an X25519-Identitätsschlüssel; sealed box allein authentifiziert den Absender nicht, daher wird das gesamte Schlüsselpaket zusätzlich signiert.
- Argon2id v1.3 für separate Tresor-/Exportpassphrasen, 16-Byte-Salt, 32-Byte-Ergebnis, initial 64 MiB Speicher und drei Durchläufe. Parameter werden mit dem Tresor gespeichert; erlaubte Obergrenzen vor KDF-Ausführung prüfen, um DoS zu verhindern.

Quellen: [XChaCha20-Poly1305](https://libsodium.gitbook.io/doc/secret-key_cryptography/aead/chacha20-poly1305/xchacha20-poly1305_construction), [sealed boxes](https://libsodium.gitbook.io/doc/public-key_cryptography/sealed_boxes), [Signaturen](https://libsodium.gitbook.io/doc/public-key_cryptography/public-key_signatures), [Passwortableitung](https://libsodium.gitbook.io/doc/password_hashing/default_phf).

## Schlüsselhierarchie

Ein lokales Profil erzeugt einen zufälligen Tresorschlüssel `V`, ein unabhängiges Ed25519-Identitätsschlüsselpaar und ein X25519-Schlüsselpaar. Der mit V verschlüsselte `UserVault` enthält private Identitätsschlüssel und Bereichsschlüsselgeschichte. Öffentliche Identitätsschlüssel sind nach Freigabe auf dem Server verfügbar. Anmeldung/OIDC allein entschlüsseln diesen Tresor nicht.

V wird getrennt unter einer vom Benutzer gewählten Entsperrpassphrase und einem zufälligen 32-Byte-Rettungsschlüssel verpackt. Eine externe Serveranmeldung ist unabhängig; die Entsperrpassphrase wird nie an den Server oder Identitätsanbieter gesendet. Rettungscode ist base64url des 32-Byte-Geheimnisses plus Anzeige-/Prüfsummenformat. Der Benutzer muss seine Sicherung bestätigen, bevor ein Bereich servergebunden wird. Mit dem Code und dem verschlüsselten Tresor bzw. dessen Sicherung lassen sich Schlüssel auf einem vertrauenswürdigen Client wiederherstellen.

Jeder Finanzbereich besitzt einen unabhängigen zufälligen Bereichsschlüssel K pro `keyVersion`. Private K werden ausschließlich für die eigene Identität verpackt. Gemeinsame K werden separat für jedes ausdrücklich bestätigte Mitglied verpackt; Haushaltsverwalter kennen deshalb niemals private K anderer Mitglieder. Keine deterministische Ableitung aller Familienbereiche aus einem gemeinsamen Servergeheimnis.

## Geräteaufnahme und Entsperren

Ein neues Gerät erzeugt eigene Ed25519-Geräteschlüssel. Aufnahme erfordert entweder ein bereits entsperrtes vertrauenswürdiges Gerät oder die separate Entsperrpassphrase/Rettungscode mit gepinnter Identität. Ein vorhandenes Gerät bestätigt den Fingerprint des neuen Geräts über QR/Codevergleich und signiert dessen Zertifikat mit dem Identitätsschlüssel. Login-/Device-Token beweist nur Serveranmeldung, nicht kryptografische Geräteberechtigung.

Nach Aufnahme entsperrt der Client seinen Tresor lokal. Desktop speichert V nur im Betriebssystem-Schlüsselspeicher nach ausdrücklicher Gerätefreigabe, sonst flüchtig. PWA speichert nur verschlüsselte Tresore und verlangt nach Neustart Entsperrung; kein persistierter Klartext-V oder scheinbar sicherer LocalStorage-Schlüssel. Identitäts-/Bereichsschlüssel verlassen den Client nur in verschlüsselten Tresoren/Schlüsselpaketen. Sperren/Logout entfernt Schlüssel aus dem aktiven Speicher so weit die Laufzeit es erlaubt; geladene Finanzansichten werden geschlossen.

Standalone- und Offline-Lokalbetrieb besitzen dieselbe Schlüsselhierarchie und verschlüsselte Exporte, aber weder Serveranmeldung noch lokale Benutzerverwaltung. Bereits lokal entschlüsselte Finanzdaten/Indizes dürfen im vertrauenswürdigen OS-/Browserprofil liegen; E2EE ist keine Zusage vollständig verschlüsselter lokaler Datenbanken. Der UI-Sperrbildschirm ersetzt daher keinen Schutz gegen direkten Dateizugriff. Dieser Unterschied wird verständlich genannt.

## Familienbeitritt und Identitätsprüfung

Die Servereinladung allein erzeugt zunächst nur `pending_key_grant`. Ein entsperrter admin-Client und das neue Mitglied vergleichen einen aus ihren öffentlichen Identitäten und Bereichsgenesis abgeleiteten Fingerprint/QR über einen zweiten Kanal. Keine alleinige Übernahme eines vom Server ausgetauschten öffentlichen Schlüssels.

Der admin signiert ein neues `KeyRoster` mit Bereichs-ID, Folgeversion, vorherigem Manifesthash, Epoche, K-Version und User-IDs/Identitätsschlüsseln/Rollen. Genesis ist vom Gründer signiert und bei Geräten gepinnt. Nachfolgende Manifeste müssen von einer im vorherigen Manifest berechtigten admin-Identität stammen. KeyGrant enthält Bereich/K-Version/Empfängerfingerprint/Manifesthash und sealed box; das Ganze ist signiert. Empfänger prüft Signatur und Kontext, entschlüsselt, bestätigt; erst dann ist gemeinsame Nutzung aktiv. Neumitglieder erhalten bewusst die aktuelle vollständige Haushaltshistorie.

Lesende erhalten K, aber keine wirksame Schreibberechtigung: Clients akzeptieren Fachänderungen nur mit gültiger Signatur eines zertifizierten, im signierten Manifest schreibberechtigten Geräts. Eine symmetrische AEAD allein könnte dies nicht gewährleisten. Haushaltseinstellungen/Familienname im Finanzbereich sind verschlüsselt; nur technisch notwendige Mitgliedschaftsdaten stehen im öffentlichen Manifest.

## Entfernen, Rollenwechsel und Rotation

Entfernung eines Mitglieds oder kompromittierter Identität ist eine admin-Client-Aktion: Schlüsselmanifest fortschreiben, K neu zufällig erzeugen, vollständigen aktuellen Snapshot clientseitig unter neuer K-Version verschlüsseln und neue KeyGrants ausschließlich an verbleibende Mitglieder erzeugen. Neuer Snapshot, K-Version, Manifest und Widerruf werden serverseitig atomar aktiviert. Neue Schreiboperationen nutzen ausschließlich diese Version; Altversionen werden abgewiesen.

Entfernte Mitglieder können ihre alten Schlüssel/Kopien behalten, aber keine neuen Versionen entschlüsseln. Alte Daten können nicht nachträglich geheim gemacht werden. member→viewer widerruft über signiertes Manifest das Schreibrecht; der Leseschlüssel darf bleiben. Gerätewiderruf aktualisiert signierte Zertifikats-/Widerrufsdaten; bei möglichem Schlüsselabfluss muss zusätzlich K rotiert werden. Der letzte kryptografische admin darf nicht entfernt werden.

Offlinewrites mit alter K-/Roster-Version bleiben als verschlüsselt sicherbarer Entwurf erhalten. Ein weiterhin berechtigtes Gerät lädt/prüft neue Manifeste, entschlüsselt aktuellen Stand und erstellt nach fachlicher Prüfung eine neue Operation mit neuer ID/Nonce. Bereits gesendetes Chiffrat wird nicht umgeschrieben. Widerruf kann auf offline Geräten erst bei neuer Information greifen; serverseitige Rollenchecks ergänzen, ersetzen aber nicht die kryptografische Prüfung.

## Verschlüsselter Transportvertrag

Eine `EncryptedOperation` besitzt öffentlichen Header: protocolVersion, operationId, deviceId, spaceId, epoch, keyVersion, rosterHash, dependsOn und read/write-Handles mit erwarteter/proposierter Revision und vorherigem Chiffrathash. Handles sind zufällige UUIDs ohne Typnamen oder Beträge. Innerer verschlüsselter Inhalt enthält commandType/schemaVersion, Fachpayload und vollständige neue Aggregate/Tombstones. Auch Fachfehler-/Konfliktstände werden nur als Chiffrate ausgetauscht.

Header wird als standardisiertes kanonisches JSON (RFC 8785 über etablierte Bibliothek) zusammen mit Protokoll-Domain-Separator als AEAD-AAD verwendet. Gerätesignatur bindet Domain-Separator, Header, Nonce und Chiffrat. Separate Domain-Separatoren für Operation, Snapshot, Grant, Zertifikat und Roster verhindern Protokollverwechslung. Schlüsselkontext, Epoche, Empfänger und Manifesthash werden auch in den jeweiligen geschützten Inhalten geprüft. Bytes base64url ohne Padding; unbekannte Suite ablehnen.

Die Domain-Separatoren sind UTF-8-Bytes der festen Werte `wimm/v1/operation`, `wimm/v1/snapshot`, `wimm/v1/grant`, `wimm/v1/certificate` und `wimm/v1/roster`. `packages/crypto` liefert diese Werte, die Kanonisierung sowie die libsodium-Primitiven; die spätere Transportimplementierung bindet sie ausschließlich an die im Vertrag genannten Header, Nonces und Chiffrate.

Server prüft Header, Sitzung, bekannte Zertifikate/signiertes Manifest, Größen, Receipt, CAS-Revisionen und Signatur. Er kann weder Fachpayload lesen noch Geld-/Referenzinvarianten berechnen. Empfänger prüfen Manifestkette, Signatur, AAD, AEAD, Änderungs-/Hashkette, Payloadschema, deklarierte Handles und Fachinvarianten. Ungültige Inhalte werden quarantänisiert und nicht als bestätigte Fachdaten angewandt; Cursor darf nicht still daran vorbeirücken. Reparatur benötigt ausdrücklich bestätigten vertrauenswürdigen Snapshot/Entwurf. Ein böswilliger berechtigter Schreiber kann Verfügbarkeit beeinträchtigen.

## Snapshot, Wiederherstellung und Exporte

Snapshots sind clientseitig verschlüsselt und signiert; Header bindet Bereich, Epoche, K-Version, Rosterhash, snapshotCursor und Aggregathashes. Headerrevisionen müssen mit entschlüsseltem Inhalt übereinstimmen. Serverrestore kann nur Container-/Signatur-/CAS-Prüfungen durchführen. Finanzprüfung und Neubildung von Projektionen erfolgen ausschließlich auf Client.

Eine Änderung, Sperrung oder Wiederherstellung der externen Anmeldung stellt keine Finanzschlüssel wieder her. Bei Verlust aller entsperrten Geräte, Entsperrpassphrase und Rettungscode sind private Daten nicht wiederherstellbar. Ein verbleibender Haushaltsadmin kann nur gemeinsame Bereichsschlüssel erneut freigeben. Login-Recovery und Finanz-Recovery haben getrennte UI und Tests.

Nutzerexporte/Entwurfsexporte sind standardmäßig verpflichtend verschlüsselte Container mit separater Exportpassphrase; Format siehe [Dateiformate](formats.md). Sie enthalten Finanzdaten, aber weder Login-/Device-Tokens noch fremde private Schlüssel. Serverbackups enthalten ausschließlich vorhandene Chiffrate und öffentliche Auth-/Rollenmetadaten; ein Betreiber kann daraus allein keine Finanzen wiederherstellen.

Vollserverrestore verändert signierte Epochen/Manifeste nicht ohne autorisierten Client. Nach Restore Sessions widerrufen und Dienst in Wiederanlaufzustand setzen. Berechtigte Clients vergleichen ihre gepinnten Hashstände, sichern Entwürfe und bestätigen je Bereich einen neuen signierten Snapshot mit neuer Epoche. Ein unbestätigter zurückgespielter Stand darf nicht still zur neuesten Finanzhistorie werden.

## Clientvertrauen und Veröffentlichung

Jeder authentifizierte Web-, PWA- oder Desktopclient ist unabhängig von Paket-/Codesignatur zugelassen. Kein E2EE-Schlüssel wird an Binaryhash, Herstellerzertifikat oder attestierten Build gebunden. Same-Origin-PWA bleibt regulärer unterstützter Betrieb. Codesignierung dient ausschließlich Plattformdistribution/Updates, nicht als E2EE-Vertrauensanker.

Die Annahme einer vertrauenswürdigen Clientlaufzeit wird ausdrücklich dokumentiert: Ein Login allein kann nicht technisch beweisen, dass laufender Code keine entschlüsselten Daten abgreift. Das Produkt behauptet deshalb keinen Schutz vor manipuliertem Clientcode. Auch eine PWA vom Finanzserver kann nach dem Laden zur vertrauenswürdigen Clientlaufzeit gehören; ein aktiv manipulierter ausgelieferter Client fällt außerhalb des vereinbarten Modells. Separate PWA-Auslieferung kann optional angeboten werden, ist aber keine Voraussetzung für E2EE oder Zugang.

## Releaseabnahme

Interoperable Crypto-Testvektoren, Nonce-/AAD-/Signaturtampering, falscher Empfänger, Schlüsselaustausch, Geräteaufnahme, viewer-Schreibfälschung, Rotation, Offlinealtversionen, Recovery und Serverdump ohne Finanzklartext sind Pflicht. Vor öffentlicher Freigabe unabhängige Prüfung des Protokolls/Bindings einplanen; keine Behauptung eines bereits erfolgten Audits. Details in [Tests](testing.md), Pakete P1/P3/P8/P9/P10/P11 in [Aufgaben](tasks.md).
