// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest';

import {
  DomainValidationError,
  monthOf,
  multiplyDivideMoney,
  multiplyMoney,
  parseFinanceDate,
  parseMoney,
  parseYearMonth,
  sumMoney
} from './index.js';

function expectDomainError(action: () => unknown, code: DomainValidationError['code']): void {
  expect(action).toThrow(DomainValidationError);
  try {
    action();
  } catch (error) {
    expect(error).toMatchObject({ code });
  }
}

describe('Geldprimitive', () => {
  it.each([
    ['0', 0],
    ['12', 1200],
    ['+12,3', 1230],
    ['-12.34', -1234],
    ['00012,34', 1234],
    ['90071992547409.91', Number.MAX_SAFE_INTEGER],
    ['-90071992547409.91', Number.MIN_SAFE_INTEGER]
  ])('liest %s exakt als %i Cent', (value, expected) => {
    expect(parseMoney(value)).toBe(expected);
  });

  it.each(['', ' 12', '12 ', '1,234', '1.2.3', '1e2', '12,', '--12'])('lehnt ungültige Dezimaltexte ab', (value) => {
    expectDomainError(() => parseMoney(value), 'INVALID_MONEY');
  });

  it('lehnt Centbeträge außerhalb des sicheren Bereichs ab', () => {
    expectDomainError(() => parseMoney('90071992547409.92'), 'MONEY_OVERFLOW');
    expectDomainError(() => multiplyMoney(Number.MAX_SAFE_INTEGER, 2), 'MONEY_OVERFLOW');
  });

  it('erhält Summen im sicheren Bereich und weist überlaufende Zwischenwerte zurück', () => {
    expect(sumMoney([1234, -34, 800])).toBe(2000);
    expectDomainError(
      () => sumMoney([Number.MAX_SAFE_INTEGER, 1, -1]),
      'MONEY_OVERFLOW'
    );
  });

  it('berechnet gewichtete Anteile mit exakter Ganzzahldivision', () => {
    expect(multiplyDivideMoney(1001, 1, 2)).toBe(500);
    expect(multiplyDivideMoney(Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER)).toBe(
      Number.MAX_SAFE_INTEGER
    );
    expectDomainError(() => multiplyDivideMoney(100, 1, 0), 'INVALID_DIVISOR');
  });
});

describe('Kalenderprimitive', () => {
  it('akzeptiert echte Kalendertage einschließlich Schaltjahren', () => {
    expect(parseFinanceDate('2028-02-29')).toBe('2028-02-29');
    expect(parseFinanceDate('2027-02-28')).toBe('2027-02-28');
  });

  it.each(['2027-02-29', '2028-13-01', '2028-04-31', '2028-2-01', '2028-02-01T00:00:00Z'])('lehnt ungültige oder zeitbehaftete Daten ab', (value) => {
    expectDomainError(() => parseFinanceDate(value), 'INVALID_DATE');
  });

  it('validiert Monatsschlüssel unabhängig von einer Zeitzone', () => {
    const date = parseFinanceDate('2028-02-29');
    expect(parseYearMonth('2028-02')).toBe('2028-02');
    expect(monthOf(date)).toBe('2028-02');
    expectDomainError(() => parseYearMonth('2028-2'), 'INVALID_MONTH');
  });
});
