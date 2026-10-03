// SPDX-License-Identifier: AGPL-3.0-or-later
import { z } from 'zod';

export const PROTOCOL_VERSION = 1 as const;
export const CRYPTO_SUITE = 'XCHACHA20_POLY1305_IETF_ED25519_V1' as const;

export const uuidSchema = z.uuid();
export const base64UrlSchema = z
  .string()
  .min(1)
  .max(65_536)
  .regex(/^[A-Za-z0-9_-]+$/, 'Muss base64url ohne Padding sein.');
export const safeIntegerSchema = z
  .number()
  .int()
  .refine(Number.isSafeInteger, 'Muss eine sichere Ganzzahl sein.');
export const moneySchema = safeIntegerSchema;
export const revisionSchema = safeIntegerSchema.nonnegative();
export const positiveRevisionSchema = safeIntegerSchema.positive();
export const keyVersionSchema = safeIntegerSchema.positive();
export const protocolVersionSchema = z.literal(PROTOCOL_VERSION);
export const cryptoSuiteSchema = z.literal(CRYPTO_SUITE);
export const isoDateSchema = z.iso.date();
export const yearMonthSchema = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Muss YYYY-MM sein.');
export const utcTimestampSchema = z.iso.datetime({ offset: false });

export type Base64Url = z.infer<typeof base64UrlSchema>;
export type CryptoSuite = z.infer<typeof cryptoSuiteSchema>;
export type KeyVersion = z.infer<typeof keyVersionSchema>;
export type IsoDate = z.infer<typeof isoDateSchema>;
export type Money = z.infer<typeof moneySchema>;
export type ProtocolVersion = z.infer<typeof protocolVersionSchema>;
export type Revision = z.infer<typeof revisionSchema>;
export type UUID = z.infer<typeof uuidSchema>;
export type YearMonth = z.infer<typeof yearMonthSchema>;
