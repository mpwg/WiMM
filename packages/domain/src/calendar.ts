// SPDX-License-Identifier: AGPL-3.0-or-later
import type { IsoDate, YearMonth } from '@wimm/contracts';

import { DomainValidationError } from './errors.js';

const financeDatePattern = /^(\d{4})-(\d{2})-(\d{2})$/;
const yearMonthPattern = /^(\d{4})-(0[1-9]|1[0-2])$/;

/** Validiert ein Finanzdatum als echten gregorianischen Kalendertag ohne Uhrzeit oder Zeitzone. */
export function parseFinanceDate(value: string, field = 'Das Finanzdatum'): IsoDate {
  const match = financeDatePattern.exec(value);
  if (match === null) {
    throw invalidDate(field);
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  if (month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) {
    throw invalidDate(field);
  }

  return value as IsoDate;
}

/** Validiert einen Monatsschlüssel im Format YYYY-MM. */
export function parseYearMonth(value: string, field = 'Der Monatsschlüssel'): YearMonth {
  if (!yearMonthPattern.test(value)) {
    throw new DomainValidationError('INVALID_MONTH', `${field} muss YYYY-MM sein.`);
  }

  return value as YearMonth;
}

/** Leitet den Monatsschlüssel aus einem bereits validierten Finanzdatum ab. */
export function monthOf(date: IsoDate): YearMonth {
  return parseYearMonth(date.slice(0, 7));
}

function daysInMonth(year: number, month: number): number {
  if (month === 2) {
    return isLeapYear(year) ? 29 : 28;
  }

  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

function isLeapYear(year: number): boolean {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

function invalidDate(field: string): DomainValidationError {
  return new DomainValidationError(
    'INVALID_DATE',
    `${field} muss ein gültiger Kalendertag im Format YYYY-MM-DD sein.`
  );
}
