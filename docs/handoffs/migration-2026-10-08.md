# #82 — Gesicherte Migrationsvorbereitung

Abnahmesnapshot vom 8. Oktober 2026, nach vollständiger K04-Abnahme `42c6670`. Aktueller Fortschritt und offene Kriterien stehen in [#82](https://github.com/mpwg/WiMM/issues/82); dieser Abschnitt schließt das Issue noch nicht.

## Implementierter Abschnitt

LocalMigrationCoordinator liegt in der browserfreien Anwendung. Er prüft den strikten vorwärtsgerichteten Plan gegen registrierte Migrationsdefinitionen, liest denselben konsistenten Export wie LocalAreaService, validiert Profil/Bereich/Storage-/Fachversion und verlangt für destruktive Schritte einen verschlüsselten dauerhaft bestätigten Backupbeleg. Profil, Bereich, Epoche und Originalsnapshot-Hash müssen vollständig passen. Abbruch wird vor/nach Export, Hash, Verschlüsselung und Sicherung geprüft; bei Fehler erreicht kein Mutationsaufruf den Adapter. Eine bereits persistierte verschlüsselte Sicherung bleibt bei anschließendem Abbruch erhalten.

BrowserEncryptedBackupPort schreibt ausschließlich Chiffrat und gebundene Belegmetadaten in eine separate IndexedDB-Sicherungsdatenbank. Er fordert einen strikten Commit, wartet auf Transaktionsabschluss und liest die komplette Hülle samt Kontext erneut zurück, bevor er einen Beleg liefert. Ein wiederverwendeter Backup-ID-Schlüssel überschreibt keine ältere Sicherung. Blockierte/veraltete Datenbanken, fehlende strikte Durability, Fehler und unpassende Rücklesedaten liefern keinen Erfolgsbeleg. Grundlage: [IndexedDB-Durabilityvertrag](https://w3c.github.io/IndexedDB/#enumdef-idbtransactiondurability).

## Aktuelle Belege

- 14 Anwendungstests bestanden; acht neue Vorbereitungsfälle prüfen echte bestehende XChaCha20-Poly1305-Snapshotverschlüsselung mit synthetischem Schlüssel, authentifizierten Roundtrip, fehlenden Schlüssel/Sicherungsfehler, falschen Hashbeleg, Abbruch vor/nach Sicherung sowie unbekannten/rückwärtsgerichteten Plan. Der Mutationsadapter ist in diesen Koordinatortests eine kontrollierte Probe; dies ist kein nativer Migrationsnachweis.
- Zwei echte Chromium-/IndexedDB-Fälle bestehen: strikter Commit, Ciphertext-only und vollständiger Roundtrip, Rücklesen nach Neuladen, Abweisung doppelter Backup-ID ohne Änderung sowie vollständiges Beenden/Neustarten des Chromium-Prozesses mit demselben dauerhaften Testprofil. Befehl: `env -u NO_COLOR pnpm exec playwright test --config tests/storage/backups.config.ts`; Artefakt test-results/migration-browser-backup-final.log. Keine Warnung oder neue Skipregel. Browserbeleg ersetzt keine SQLite-/Tauri-GUI-Abnahme.
- Typecheck, vollständiger Lint, browserfreie Anwendungsarchitektur, Paketgraph und Whitespaceprüfung bestanden. Keine neue Abhängigkeit, eigene Kryptografie oder Änderung vorhandener Tresor-/Snapshotformate. Aktive Arbeitskopie macOS 27.0.1 arm64, Node 26.10.0/pnpm 12.8.1; ausschließlich synthetische Daten.

## Verbleibende Abnahme

Die registrierte Vorwärtsmigration in echten SQLite-/IndexedDB-Adaptern, atomarer vollständiger Ausgangsstandsvergleich unmittelbar vor Commit, nummerierter dauerhafter Migrationsjournalstand, Native-Sicherungsport und echte Fehler-/Rollback-/Neustartfälle sind noch zu implementieren und abnehmen. Die Registryeinträge in Koordinatortests sind ausdrücklich synthetisch; kein neues Produktionsschema wird allein daraus als unterstützt ausgegeben. #82 bleibt offen. Danach folgen #83/#84/#86/#85 und K05 in der vereinbarten Reihenfolge.
