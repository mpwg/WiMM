// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Money } from '@wimm/contracts';

import { DomainValidationError } from './errors.js';

const MAX_SAFE_MONEY = BigInt(Number.MAX_SAFE_INTEGER);
const MIN_SAFE_MONEY = BigInt(Number.MIN_SAFE_INTEGER);
const decimalMoneyPattern = /^([+-]?)(\d+)(?:[,.](\d{1,2}))?$/;

/** Prüft einen Centbetrag, der über eine API oder Berechnung in den Fachkern gelangt. */
export function assertMoney(value: number, field = 'Der Geldbetrag'): Money {
  if (!Number.isSafeInteger(value)) {
    throw new DomainValidationError(
      'INVALID_SAFE_INTEGER',
      `${field} muss ein sicherer ganzzahliger Centbetrag sein.`
    );
  }

  return value as Money;
}

/**
 * Liest einen Dezimaltext ohne Gleitkommaoperationen als Centbetrag ein.
 * Punkt und Komma sind als Dezimaltrennzeichen erlaubt; Tausendertrennzeichen
 * und mehr als zwei Nachkommastellen werden bewusst nicht stillschweigend
 * interpretiert.
 */
export function parseMoney(value: string, field = 'Der Geldbetrag'): Money {
  const match = decimalMoneyPattern.exec(value);
  if (match === null) {
    throw new DomainValidationError(
      'INVALID_MONEY',
      `${field} muss ein Dezimaltext mit höchstens zwei Nachkommastellen sein.`
    );
  }

  const sign = match[1] === '-' ? -1n : 1n;
  const whole = BigInt(match[2]!);
  const fraction = BigInt((match[3] ?? '').padEnd(2, '0') || '0');
  const cents = sign * (whole * 100n + fraction);

  return moneyFromBigInt(cents, field);
}

/** Addiert Centbeträge und lehnt jeden unsicheren Zwischenstand ab. */
export function sumMoney(values: readonly Money[], field = 'Die Geldsumme'): Money {
  let sum = 0n;

  for (const value of values) {
    assertMoney(value, field);
    sum += BigInt(value);
    assertMoneyRange(sum, field);
  }

  return Number(sum) as Money;
}

/** Subtrahiert Centbeträge exakt und prüft auch den Zwischenwert. */
export function subtractMoney(
  left: Money,
  right: Money,
  field = 'Die Gelddifferenz'
): Money {
  assertMoney(left, 'Der linke Geldbetrag');
  assertMoney(right, 'Der rechte Geldbetrag');
  return moneyFromBigInt(BigInt(left) - BigInt(right), field);
}

/** Multipliziert einen Centbetrag exakt mit einem sicheren ganzzahligen Faktor. */
export function multiplyMoney(
  amount: Money,
  factor: number,
  field = 'Das Gewichtsergebnis'
): Money {
  assertMoney(amount, 'Der Geldbetrag');
  assertSafeInteger(factor, 'Der Gewichtungsfaktor');

  return moneyFromBigInt(BigInt(amount) * BigInt(factor), field);
}

/**
 * Berechnet den ganzzahligen Anteil einer gewichteten Summe mit BigInt.
 * Der Rückgabewert wird erst nach Division gegen die Geldgrenzen geprüft.
 */
export function multiplyDivideMoney(
  amount: Money,
  numerator: number,
  denominator: number,
  field = 'Der gewichtete Geldanteil'
): Money {
  assertMoney(amount, 'Der Geldbetrag');
  assertSafeInteger(numerator, 'Der Gewichtungszähler');
  assertSafeInteger(denominator, 'Der Gewichtungsnenner');

  if (denominator <= 0) {
    throw new DomainValidationError(
      'INVALID_DIVISOR',
      'Der Gewichtungsnenner muss größer als null sein.'
    );
  }

  const result = (BigInt(amount) * BigInt(numerator)) / BigInt(denominator);
  return moneyFromBigInt(result, field);
}

function assertSafeInteger(value: number, field: string): void {
  if (!Number.isSafeInteger(value)) {
    throw new DomainValidationError(
      'INVALID_SAFE_INTEGER',
      `${field} muss eine sichere Ganzzahl sein.`
    );
  }
}

function moneyFromBigInt(value: bigint, field: string): Money {
  assertMoneyRange(value, field);
  return Number(value) as Money;
}

function assertMoneyRange(value: bigint, field: string): void {
  if (value < MIN_SAFE_MONEY || value > MAX_SAFE_MONEY) {
    throw new DomainValidationError(
      'MONEY_OVERFLOW',
      `${field} überschreitet den sicheren Centbereich.`
    );
  }
}

/** Exakter editierbarer Dezimaltext, auch an den sicheren Centgrenzen. */
export function moneyDecimal(value: Money): string {
  assertMoney(value);
  const amount = BigInt(value); const absolute = amount < 0n ? -amount : amount;
  return `${amount < 0n ? '-' : ''}${absolute / 100n}.${String(absolute % 100n).padStart(2, '0')}`;
}

/** Die gewählte Buchungsrichtung bestimmt das Vorzeichen eines eingegebenen Betrags. */
export function parseDirectedMoney(value: string, direction: 'expense' | 'income', field = 'Der Betrag'): Money {
  const amount = parseMoney(value, field);
  const magnitude = BigInt(amount) < 0n ? -BigInt(amount) : BigInt(amount);
  return moneyFromBigInt(direction === 'expense' ? -magnitude : magnitude, field);
}
