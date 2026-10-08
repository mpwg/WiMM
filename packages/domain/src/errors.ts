// SPDX-License-Identifier: AGPL-3.0-or-later

import type { FinanceErrorCode } from '@wimm/contracts';

export type DomainErrorCode = FinanceErrorCode;

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
