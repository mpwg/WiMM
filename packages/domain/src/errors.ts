// SPDX-License-Identifier: AGPL-3.0-or-later

export type DomainErrorCode =
  | 'INVALID_DATE'
  | 'INVALID_MONTH'
  | 'INVALID_MONEY'
  | 'INVALID_SAFE_INTEGER'
  | 'MONEY_OVERFLOW'
  | 'INVALID_DIVISOR';

/** Ein verständlicher Validierungsfehler für einen Fachbefehl ohne Teiländerung. */
export class DomainValidationError extends Error {
  readonly name = 'DomainValidationError';

  constructor(
    readonly code: DomainErrorCode,
    message: string
  ) {
    super(message);
  }
}
