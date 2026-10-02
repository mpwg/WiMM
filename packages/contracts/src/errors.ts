// SPDX-License-Identifier: AGPL-3.0-or-later
import { z } from 'zod';

export const contractErrorCodeSchema = z.enum([
  'INVALID_ENVELOPE',
  'INVALID_SIGNATURE',
  'UNSUPPORTED_CRYPTO_SUITE',
  'REVISION_CONFLICT',
  'EPOCH_MISMATCH',
  'KEY_VERSION_MISMATCH',
  'ROSTER_MISMATCH',
  'OPERATION_ID_REUSED',
  'DEPENDENCY_NOT_ACCEPTED',
  'UPDATE_REQUIRED'
]);

export const contractIssueSchema = z
  .object({
    path: z.string().min(1),
    code: z.string().min(1)
  })
  .strict();

export const publicErrorSchema = z
  .object({
    code: contractErrorCodeSchema,
    message: z.string().min(1),
    fields: z.array(contractIssueSchema).optional(),
    requestId: z.string().min(1).optional()
  })
  .strict();

export type ContractErrorCode = z.infer<typeof contractErrorCodeSchema>;
export type ContractIssue = z.infer<typeof contractIssueSchema>;
export type PublicError = z.infer<typeof publicErrorSchema>;
