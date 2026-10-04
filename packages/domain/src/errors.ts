// SPDX-License-Identifier: AGPL-3.0-or-later

export type DomainErrorCode =
  | 'INVALID_DATE'
  | 'INVALID_MONTH'
  | 'INVALID_MONEY'
  | 'INVALID_SAFE_INTEGER'
  | 'MONEY_OVERFLOW'
  | 'INVALID_DIVISOR'
  | 'INVALID_COMMAND'
  | 'INVALID_AGGREGATE'
  | 'DUPLICATE_REFERENCE'
  | 'REVISION_MISSING'
  | 'REVISION_CONFLICT'
  | 'REVISION_OVERFLOW'
  | 'CROSS_SPACE_REFERENCE'
  | 'INVALID_GENERATOR';

/** Ein verständlicher Validierungsfehler für einen Fachbefehl ohne Teiländerung. */
export class DomainValidationError extends Error {
  override readonly name = 'DomainValidationError';

  constructor(
    readonly code: DomainErrorCode,
    message: string
  ) {
    super(message);
  }
}
