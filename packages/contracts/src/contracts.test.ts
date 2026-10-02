// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest';

import {
  CRYPTO_SUITE,
  PROTOCOL_VERSION,
  encryptedOperationSchema,
  keyRosterSchema,
  moneySchema,
  revisionSchema
} from './index.js';

const identifiers = {
  deviceId: '00000000-0000-4000-8000-000000000001',
  epoch: '00000000-0000-4000-8000-000000000002',
  handle: '00000000-0000-4000-8000-000000000003',
  operationId: '00000000-0000-4000-8000-000000000004',
  spaceId: '00000000-0000-4000-8000-000000000005',
  userId: '00000000-0000-4000-8000-000000000006'
} as const;

function validEncryptedOperation() {
  return {
    header: {
      protocolVersion: PROTOCOL_VERSION,
      cryptoSuite: CRYPTO_SUITE,
      operationId: identifiers.operationId,
      deviceId: identifiers.deviceId,
      spaceId: identifiers.spaceId,
      epoch: identifiers.epoch,
      keyVersion: 1,
      rosterHash: 'cm9zdGVyLWg',
      dependsOn: [],
      reads: [],
      writes: [
        {
          handle: identifiers.handle,
          expectedRevision: 0,
          proposedRevision: 1
        }
      ]
    },
    nonce: 'bm9uY2U',
    ciphertext: 'Y2lwaGVydGV4dA',
    signature: 'c2lnbmF0dXJl'
  };
}

describe('öffentliche Vertragsgrundlage', () => {
  it('akzeptiert eine bekannte gültige verschlüsselte Operation ohne Finanzklartext', () => {
    expect(encryptedOperationSchema.safeParse(validEncryptedOperation()).success).toBe(true);
  });

  it('lehnt unsichere Zahlen und unbekannte Protokollversionen ab', () => {
    expect(moneySchema.safeParse(Number.MAX_SAFE_INTEGER).success).toBe(true);
    expect(moneySchema.safeParse(Number.MAX_SAFE_INTEGER + 1).success).toBe(false);
    expect(revisionSchema.safeParse(-1).success).toBe(false);

    const operation = validEncryptedOperation();
    operation.header.protocolVersion = 2 as never;
    expect(encryptedOperationSchema.safeParse(operation).success).toBe(false);
  });

  it('lehnt Finanzklartext und widersprüchliche Revisionen im öffentlichen Header ab', () => {
    const withFinanceField = validEncryptedOperation();
    Object.assign(withFinanceField.header, { amount: 1250 });
    expect(encryptedOperationSchema.safeParse(withFinanceField).success).toBe(false);

    const withInvalidRevision = validEncryptedOperation();
    withInvalidRevision.header.writes[0]!.proposedRevision = 2;
    expect(encryptedOperationSchema.safeParse(withInvalidRevision).success).toBe(false);
  });

  it('akzeptiert ein Genesis-Roster und verlangt für Nachfolger einen vorherigen Hash', () => {
    const genesis = {
      protocolVersion: PROTOCOL_VERSION,
      cryptoSuite: CRYPTO_SUITE,
      spaceId: identifiers.spaceId,
      rosterVersion: 1,
      epoch: identifiers.epoch,
      keyVersion: 1,
      members: [
        {
          userId: identifiers.userId,
          identityPublicKey: 'cHVibGljLWtleQ',
          role: 'admin'
        }
      ]
    };

    expect(keyRosterSchema.safeParse(genesis).success).toBe(true);
    expect(keyRosterSchema.safeParse({ ...genesis, amount: 1250 }).success).toBe(false);
    expect(keyRosterSchema.safeParse({ ...genesis, rosterVersion: 2 }).success).toBe(false);
  });
});
