// SPDX-License-Identifier: AGPL-3.0-or-later
import { expect, it } from 'vitest';
import { createJsonReferenceEngine } from './index.js';
import type { CoreCommandRequest } from '@wimm/contracts';
const id = '30000000-0000-4000-8000-000000000001';
const request: CoreCommandRequest = { contractVersion: 1, domainSchemaVersion: 1, spaceId: id, aggregates: [], command: { commandType: 'rule.reorder', ruleIds: [] }, expectedRevisions: [], context: { operationId: id, occurredAt: '2026-10-08T12:00:00Z', generatedIds: [] } };
it('gibt ein fremdes oder veraltetes Bindingresultat niemals als anwendbare Änderung frei', async () => {
  const engine = createJsonReferenceEngine(() => JSON.stringify({ contractVersion: 1, status: 'changed', changeSet: { spaceId: id, operationId: '30000000-0000-4000-8000-000000000002', occurredAt: request.context.occurredAt, commandType: 'rule.reorder', expectedRevisions: [], aggregates: [] } }));
  await expect(engine.execute(request)).rejects.toThrow('passt nicht');
});
it('blockiert unsichere Eingaben vor dem nativen Aufruf und unsichere Antworten vor Freigabe', async () => {
  let calls = 0;
  const engine = createJsonReferenceEngine(() => { calls++; return JSON.stringify({ contractVersion: 1, status: 'money', value: Number.MAX_SAFE_INTEGER + 1 }); });
  await expect(engine.execute({ ...request, expectedRevisions: [{ id, expectedRevision: 0.1 }] })).rejects.toThrow(/expected int/i);
  expect(calls).toBe(0);
  await expect(engine.calculate({ contractVersion: 1, domainSchemaVersion: 1, spaceId: id, calculationType: 'money.parse', text: '1.00' })).rejects.toThrow(/expected int/i);
  expect(calls).toBe(1);
});

it('prüft den vollständigen Engineport und bindet Gegenbefehle an dieselbe Aktion', async () => {
  const { createJsonFinanceEngine }=await import('./index.js');
  const engine=createJsonFinanceEngine((method)=>method==='project'?JSON.stringify({contractVersion:1,status:'projected',projections:{accountBalances:[],consumption:{income:0,expense:0,net:0,categories:[]}}}):method==='validate'?JSON.stringify({contractVersion:1,status:'valid'}):JSON.stringify({contractVersion:1,status:'changed',changeSet:{spaceId:id,operationId:'30000000-0000-4000-8000-000000000099',occurredAt:request.context.occurredAt,commandType:'transaction.delete',expectedRevisions:[],aggregates:[]}}));
  const state={contractVersion:1 as const,domainSchemaVersion:1 as const,spaceId:id,aggregates:[]};
  expect(await engine.project(state)).toMatchObject({status:'projected'});
  expect(await engine.validate({...state,mode:'historical'})).toEqual({contractVersion:1,status:'valid'});
  await expect(engine.reverse({...state,expectedRevisions:[],targets:[{id}],context:request.context})).rejects.toThrow('Gegenbefehl');
});
