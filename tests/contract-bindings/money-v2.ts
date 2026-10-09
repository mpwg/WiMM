// SPDX-License-Identifier: AGPL-3.0-or-later
import type * as Binding from '../../packages/contracts/generated/private-v2/wasm/wimm_core_bindings.js';

export interface MoneyFixtureRequest {
  readonly contractVersion: number;
  readonly domainSchemaVersion: number;
  readonly spaceId: string;
  readonly text: string;
}

export function callTypedMoney(wasm: typeof Binding, request: MoneyFixtureRequest): unknown {
  const input = new wasm.MoneyRequestV2(request.contractVersion, request.domainSchemaVersion, request.spaceId, request.text);
  // Die generierte Funktion übernimmt den Request; nur das Ergebnis ist hier zu befreien.
  const result = wasm.calculate_money_v2(input);
  try {
    if (result.status === wasm.MoneyStatusV2.Money) {
      if (result.value === undefined || !Number.isSafeInteger(result.value) || result.errorCode !== undefined || result.message !== undefined) throw new Error('Der erfolgreiche V2-Vertrag ist widersprüchlich.');
      return { contractVersion: result.contractVersion, status: 'money', value: result.value };
    }
    if (result.status !== wasm.MoneyStatusV2.Rejected || result.value !== undefined || result.errorCode === undefined || result.message === undefined) throw new Error('Die V2-Ablehnung ist widersprüchlich.');
    return { contractVersion: result.contractVersion, status: 'rejected', error: { code: result.errorCode, message: result.message } };
  } finally {
    result.free();
  }
}
