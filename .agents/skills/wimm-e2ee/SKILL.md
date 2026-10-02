---
name: wimm-e2ee
description: "Entwickle oder prüfe WhereIsMyMoney-E2EE, Schlüsselverwaltung, verschlüsselte Synchronisierung, Recovery oder Exporte. Nutze bei Änderungen an der Client-Server-Vertrauensgrenze oder verschlüsselten Datenformaten."
license: AGPL-3.0-or-later
---

# E2EE und verschlüsselter Transport

Lies [Verschlüsselung](../../../docs/encryption.md), [Synchronisierung](../../../docs/synchronization.md) und [Sicherheit](../../../docs/security.md). Für Wireänderungen zusätzlich [API](../../../docs/api.md), für Dateiverarbeitung [Formate](../../../docs/formats.md).

Authentifizierte Clients sind vertrauenswürdig; keine Binarysignatur, Attestierung oder Build-Allowlist als Zugangsvoraussetzung. Loginzugriff, Besitz/Entsperren von Finanzschlüsseln und Signaturen von Nachrichten sind verschiedene Dinge. E2EE ist verpflichtend, kein abschaltbarer Modus.

- Gepflegte libsodium-Bindung und dokumentierte Primitive/KDF/Suite verwenden; keine eigene Kryptografie.
- Finanzpayload, Fachfehlerdaten und Snapshot vor Netzwerk/Serverbackup verschlüsseln. Server prüft nur Hülle, öffentliche Signaturen, Rollen und CAS.
- Nonce/Salt/Empfänger/Domain-Separator/AAD-Kontext nach Vertrag behandeln; bereits gesendete Hüllen nicht umschreiben.
- Identitäts-/Rosterkette und Empfängerfingerprints prüfen; viewer-Leseschlüssel erlauben keine wirksamen Schreibnachrichten.
- Mitgliedsentfernung atomar mit Rotation/KeyGrants/Snapshot durchführen; offline Altoperationen als Entwürfe erhalten. Keine Behauptung rückwirkender Geheimhaltung alter Kopien.
- Login-/OIDC-Reset stellt keine Finanzschlüssel wieder her. Schlüsselverlust und tatsächliche Recoverywege getrennt erklären.
- Logs, Fixtures, PRs und Issues enthalten keine realen Schlüssel oder Finanzdaten. Synthetische Testvektoren ausdrücklich kennzeichnen.

Wähle passende C01–C14/S-Fälle aus [Tests](../../../docs/testing.md), dokumentiere Auswirkungen auf Protokollversionen und bekannte Grenzen. Bei Änderung der Suite/Vertrauensannahmen zuerst ADR und Verträge aktualisieren. Prüfung eines eigenen Protokolls ist kein behauptetes externes Kryptoaudit.
