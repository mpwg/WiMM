// SPDX-License-Identifier: AGPL-3.0-or-later
import {readFileSync}from'node:fs';
import{Ajv2020}from'ajv/dist/2020.js';import addFormats from'ajv-formats';import{expect,it}from'vitest';
it('Versionierte Checkpointform erhält die vorhandenen Snapshot- und Receiptstrukturen',()=>{
 const request=JSON.parse(readFileSync('crates/local-dal/tests/fixtures/receipt-request.json','utf8')) as {identity:Record<string,unknown>;batch:{aggregates:Record<string,unknown>[];outbox:unknown[];projections:unknown[]}};
 const value={checkpointVersion:1,physicalSchemaVersion:1,snapshot:{storageSchemaVersion:1,domainSchemaVersion:1,profileId:request.identity.profileId,spaceId:request.identity.spaceId,epoch:request.identity.epoch,aggregates:request.batch.aggregates,pending:request.batch.outbox,projections:request.batch.projections,confirmed:[]},operations:[{request,receipt:{identity:request.identity,contentHash:'ab'.repeat(32),committedRevisions:[{handle:request.batch.aggregates[0]!.handle,revision:1}]}}]};
 const ajv=new Ajv2020({strict:true,allErrors:true});addFormats.default(ajv);ajv.addFormat('uint32',{type:'number',validate:n=>Number.isInteger(n)&&n>=0&&n<=4_294_967_295});
 const check=ajv.compile(JSON.parse(readFileSync('packages/contracts/generated/local-v2/schema/local-commit-checkpoint.schema.json','utf8')) as object);
 expect(check(value)).toBe(true);
 expect(check({...value,checkpointVersion:2})).toBe(false);expect(check({...value,physicalSchemaVersion:2})).toBe(false);expect(check({...value,sql:'unsafe path'})).toBe(false);
});
