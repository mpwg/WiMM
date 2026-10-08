// SPDX-License-Identifier: AGPL-3.0-or-later
import { coreCommandRequestSchema, coreCommandResultSchema, coreCalculationRequestSchema, coreCalculationResultSchema, type FinanceEnginePort } from '@wimm/contracts';

/** K03-Probeumfang; vollständige Produktengine folgt in K04/K05. */
export function createJsonReferenceEngine(call: (method: 'execute' | 'calculate', request: string) => Promise<string> | string): Pick<FinanceEnginePort, 'execute' | 'calculate'> {
  return {
    async execute(request) {
      const validated = coreCommandRequestSchema.parse(request);
      const result = coreCommandResultSchema.parse(JSON.parse(await call('execute', JSON.stringify(validated))));
      if (result.status === 'changed' && (result.changeSet.spaceId !== validated.spaceId || result.changeSet.operationId !== validated.context.operationId || result.changeSet.commandType !== validated.command.commandType || result.changeSet.occurredAt !== validated.context.occurredAt)) throw new Error('Das Fachkernergebnis passt nicht zum angeforderten Befehl.');
      return result;
    },
    async calculate(request) {
      const validated = coreCalculationRequestSchema.parse(request);
      return coreCalculationResultSchema.parse(JSON.parse(await call('calculate', JSON.stringify(validated))));
    }
  };
}
