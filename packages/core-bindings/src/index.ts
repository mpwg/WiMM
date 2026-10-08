// SPDX-License-Identifier: AGPL-3.0-or-later
import { coreCommandRequestSchema, coreCommandResultSchema, coreCalculationRequestSchema, coreCalculationResultSchema, coreStateRequestSchema, coreProjectionResultSchema, coreValidationRequestSchema, coreValidationResultSchema, coreInverseRequestSchema, type FinanceEnginePort } from '@wimm/contracts';

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

/** Vollständiger K01-Port für dieselbe produktive Rust-Bibliothek in allen Ausführungsformen. */
export function createJsonFinanceEngine(call: (method: 'execute' | 'calculate' | 'project' | 'validate' | 'reverse', request: string) => Promise<string> | string): FinanceEnginePort {
  const reference=createJsonReferenceEngine(call);
  return {
    ...reference,
    async project(request) { const validated=coreStateRequestSchema.parse(request);return coreProjectionResultSchema.parse(JSON.parse(await call('project',JSON.stringify(validated)))); },
    async validate(request) { const validated=coreValidationRequestSchema.parse(request);return coreValidationResultSchema.parse(JSON.parse(await call('validate',JSON.stringify(validated)))); },
    async reverse(request) { const validated=coreInverseRequestSchema.parse(request);const result=coreCommandResultSchema.parse(JSON.parse(await call('reverse',JSON.stringify(validated))));if(result.status==='changed'&&(result.changeSet.spaceId!==validated.spaceId||result.changeSet.operationId!==validated.context.operationId||result.changeSet.occurredAt!==validated.context.occurredAt||!['transaction.save','transaction.delete','transfer.save','transfer.delete','reconciliation.confirm','reconciliation.unlock'].includes(result.changeSet.commandType)))throw new Error('Der Gegenbefehl passt nicht zur angeforderten Aktion.');return result; }
  };
}
