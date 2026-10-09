// SPDX-License-Identifier: AGPL-3.0-or-later
import type * as Binding from '../../packages/contracts/generated/private-v2/wasm/wimm_core_bindings.js';

export function callTypedCommand(wasm: typeof Binding, input: unknown): unknown {
  try {
    // Negativfixtures umgehen ausschließlich die statische Formprüfung im Test.
    const result = wasm.execute_v2(input as Binding.Request);
    if (result.contractVersion !== 2) throw new Error('Die V2-Ergebnisversion fehlt.');
    return { ...result, contractVersion: 1 };
  } catch (error) {
    if (typeof error !== 'object' || error === null || !('contractVersion' in error) || error.contractVersion !== 2 || !('code' in error) || typeof error.code !== 'string' || !('detail' in error) || typeof error.detail !== 'string') throw error;
    return { contractVersion: 1, status: 'rejected', error: { code: error.code, message: error.detail } };
  }
}

export function mutateCommandFixture(input: unknown, mode: string): Binding.Request {
  const request = structuredClone(input) as Binding.Request;
  request.contractVersion = 2;
  switch (mode) {
    case 'version': request.contractVersion = 1; break;
    case 'mixedVersion': request.contractVersion = 99; request.spaceId = 'privat – ungültig 🏠'; break;
    case 'mixedDomain': request.domainSchemaVersion = 99; request.context.occurredAt = '2026-10-09T25:00:00Z'; break;
    case 'uuid': request.spaceId = 'privat – ungültig 🏠'; break;
    case 'utc': request.context.occurredAt = '2026-10-09T25:00:00Z'; break;
    case 'list': request.command = { commandType: 'account.save', aggregates: [] }; break;
    case 'cent': {
      let found = false;
      for (const aggregate of request.aggregates) if (aggregate.aggregateType === 'transaction') { aggregate.amount = 9_007_199_254_740_992; found = true; }
      if (!found) throw new Error('Die synthetische Centfixture fehlt.');
      break;
    }
    default: throw new Error('Unbekannter synthetischer Bindingmodus.');
  }
  return request;
}
