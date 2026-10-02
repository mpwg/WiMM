// SPDX-License-Identifier: AGPL-3.0-or-later
import { z } from 'zod';

import {
  base64UrlSchema,
  cryptoSuiteSchema,
  keyVersionSchema,
  positiveRevisionSchema,
  protocolVersionSchema,
  revisionSchema,
  uuidSchema
} from './primitives.js';

const existingHandleSchema = z
  .object({
    handle: uuidSchema,
    expectedRevision: positiveRevisionSchema,
    previousCiphertextHash: base64UrlSchema
  })
  .strict();

const writeHandleSchema = z
  .object({
    handle: uuidSchema,
    expectedRevision: revisionSchema,
    proposedRevision: positiveRevisionSchema,
    previousCiphertextHash: base64UrlSchema.optional()
  })
  .strict()
  .superRefine((handle, context) => {
    if (handle.proposedRevision !== handle.expectedRevision + 1) {
      context.addIssue({
        code: 'custom',
        message: 'Die vorgeschlagene Revision muss genau um eins steigen.',
        path: ['proposedRevision']
      });
    }

    if (handle.expectedRevision === 0 && handle.previousCiphertextHash !== undefined) {
      context.addIssue({
        code: 'custom',
        message: 'Neue Aggregate besitzen keinen vorherigen Chiffrathash.',
        path: ['previousCiphertextHash']
      });
    }

    if (handle.expectedRevision > 0 && handle.previousCiphertextHash === undefined) {
      context.addIssue({
        code: 'custom',
        message: 'Bestehende Aggregate benötigen den vorherigen Chiffrathash.',
        path: ['previousCiphertextHash']
      });
    }
  });

export const encryptedOperationHeaderSchema = z
  .object({
    protocolVersion: protocolVersionSchema,
    cryptoSuite: cryptoSuiteSchema,
    operationId: uuidSchema,
    deviceId: uuidSchema,
    spaceId: uuidSchema,
    epoch: uuidSchema,
    keyVersion: keyVersionSchema,
    rosterHash: base64UrlSchema,
    dependsOn: z.array(uuidSchema).max(500),
    reads: z.array(existingHandleSchema).max(500),
    writes: z.array(writeHandleSchema).min(1).max(500)
  })
  .strict();

export const encryptedOperationSchema = z
  .object({
    header: encryptedOperationHeaderSchema,
    nonce: base64UrlSchema,
    ciphertext: base64UrlSchema,
    signature: base64UrlSchema
  })
  .strict();

const keyRosterMemberSchema = z
  .object({
    userId: uuidSchema,
    identityPublicKey: base64UrlSchema,
    role: z.enum(['admin', 'member', 'viewer'])
  })
  .strict();

export const keyRosterSchema = z
  .object({
    protocolVersion: protocolVersionSchema,
    cryptoSuite: cryptoSuiteSchema,
    spaceId: uuidSchema,
    rosterVersion: positiveRevisionSchema,
    previousManifestHash: base64UrlSchema.optional(),
    epoch: uuidSchema,
    keyVersion: keyVersionSchema,
    members: z.array(keyRosterMemberSchema).min(1).max(500)
  })
  .strict()
  .superRefine((roster, context) => {
    if (roster.rosterVersion === 1 && roster.previousManifestHash !== undefined) {
      context.addIssue({
        code: 'custom',
        message: 'Das Genesis-Roster besitzt keinen vorherigen Hash.',
        path: ['previousManifestHash']
      });
    }

    if (roster.rosterVersion > 1 && roster.previousManifestHash === undefined) {
      context.addIssue({
        code: 'custom',
        message: 'Ein Folge-Roster benötigt den vorherigen Hash.',
        path: ['previousManifestHash']
      });
    }
  });

export const signedKeyRosterSchema = z
  .object({
    roster: keyRosterSchema,
    signature: base64UrlSchema
  })
  .strict();

export type EncryptedOperation = z.infer<typeof encryptedOperationSchema>;
export type EncryptedOperationHeader = z.infer<typeof encryptedOperationHeaderSchema>;
export type KeyRoster = z.infer<typeof keyRosterSchema>;
export type SignedKeyRoster = z.infer<typeof signedKeyRosterSchema>;
