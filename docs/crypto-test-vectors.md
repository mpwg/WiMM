# Krypto-Testvektoren

Diese Vektoren sind ausschließlich synthetische öffentliche Testdaten. Sie enthalten keine Finanzdaten, Produktionsschlüssel oder nutzerbezogenen Werte. Sie prüfen die in P1.4 gewählte Binding-Grundlage, kein vollständiges Schlüssel- oder Transportprotokoll.

## Herkunft

- Kanonisierung: RFC 8785 über `canonicalize` 5.1.0. Der Testwert prüft die sortierte Objektordnung, `-0` als `0` und die Exponentendarstellung.
- AEAD und Signatur: `libsodium-wrappers-sumo` 0.8.4 mit XChaCha20-Poly1305-IETF beziehungsweise Ed25519. Die festen Eingaben und erwarteten Ausgaben stehen in [`packages/crypto/src/crypto.test.ts`](../packages/crypto/src/crypto.test.ts); sie wurden für die gewählte Binding-Version aus reproduzierbaren öffentlichen Bytes erzeugt und anschließend fixiert.

## Feste Eingaben

Der AEAD-Vektor nutzt Schlüssel `000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f`, Nonce `000102030405060708090a0b0c0d0e0f1011121314151617`, AAD `wimm/v1/operation` und Klartext `WIMM fixture v1`. Die Nonce ist nur für diesen isolierten Test festgelegt; neue Verschlüsselungen erhalten immer eine frische libsodium-Nonce.

Der Ed25519-Vektor verwendet den nur für Tests bekannten Seed `000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f` und die Nachricht `WIMM fixture signature v1`. Der Seed wird nicht von Produktcode verwendet.
