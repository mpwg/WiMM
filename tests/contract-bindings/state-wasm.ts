// SPDX-License-Identifier: AGPL-3.0-or-later
import type * as Binding from '../../packages/contracts/generated/private-v2/wasm/wimm_core_bindings.js';
export type StateAction = 'project' | 'validate' | 'reverse' | 'calculate';
export function callTypedState(wasm: typeof Binding, method: StateAction, input: unknown): unknown {
  try {
    const result = method === 'project' ? wasm.project_v2(input as Binding.ProjectionRequest) : method === 'validate' ? wasm.validate_v2(input as Binding.ValidationRequest) : method === 'reverse' ? wasm.reverse_v2(input as Binding.ReverseRequest) : wasm.calculate_v2(input as Binding.CalculationRequest);
    if (result.contractVersion !== 2) throw new Error('Die V2-Ergebnisversion fehlt.');
    return { ...result, contractVersion: 1 };
  } catch (error) {
    if (typeof error !== 'object' || error === null || !('contractVersion' in error) || error.contractVersion !== 2 || !('code' in error) || typeof error.code !== 'string' || !('detail' in error) || typeof error.detail !== 'string') throw error;
    return { contractVersion: 1, status: 'rejected', error: { code: error.code, message: error.detail } };
  }
}

/** Explizite synthetische V1-Katalogform auf die neue Bindingversion abbilden. */
export function stateFixtureFromV1(input: unknown): unknown {
  const request: unknown = typeof input === 'string' ? JSON.parse(input) : structuredClone(input);
  if (typeof request === 'object' && request !== null && 'contractVersion' in request) {
    // Nicht unterstützte V1-Versionen bleiben nicht unterstützt.
    request.contractVersion = request.contractVersion === 1 ? 2 : 99;
  }
  return request;
}
