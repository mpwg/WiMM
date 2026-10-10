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
it('V2-Checkpointschema erhält Bestätigungen und Cursor und begrenzt optionale Recoverybytes',()=>{
 const request=JSON.parse(readFileSync('crates/local-dal/tests/fixtures/receipt-request.json','utf8')) as {identity:Record<string,unknown>;batch:{aggregates:Record<string,unknown>[];outbox:unknown[];projections:unknown[]}};
 const value={checkpointVersion:2,physicalSchemaVersion:5,localWriteEpoch:request.identity.epoch,snapshot:{storageSchemaVersion:2,domainSchemaVersion:1,profileId:request.identity.profileId,spaceId:request.identity.spaceId,epoch:request.identity.epoch,aggregates:request.batch.aggregates,pending:request.batch.outbox,projections:request.batch.projections,confirmed:[{spaceId:request.identity.spaceId,epoch:request.identity.epoch,aggregate:request.batch.aggregates[0]}],syncState:{profileId:request.identity.profileId,spaceId:request.identity.spaceId,epoch:request.identity.epoch,cursor:'9007199254740993'}},operations:[{request,receipt:{identity:request.identity,contentHash:'ab'.repeat(32),committedRevisions:[{handle:request.batch.aggregates[0]!.handle,revision:1}]}}]};
 const ajv=new Ajv2020({strict:true,allErrors:true});addFormats.default(ajv);
 ajv.addFormat('uint32',{type:'number',validate:n=>Number.isInteger(n)&&n>=0&&n<=4_294_967_295});ajv.addFormat('uint8',{type:'number',validate:n=>Number.isInteger(n)&&n>=0&&n<=255});
 const check=ajv.compile(JSON.parse(readFileSync('packages/contracts/generated/local-v2/schema/local-checkpoint-v2.schema.json','utf8')) as object);
 expect(check(value)).toBe(true);expect(check({...value,recovery:[0,255]})).toBe(true);
 for(const recovery of [null,[256],[-1],[1.5],'opaque'])expect(check({...value,recovery})).toBe(false);
 for(const invalid of [{checkpointVersion:1},{physicalSchemaVersion:1},{physicalSchemaVersion:2},{physicalSchemaVersion:3},{physicalSchemaVersion:4},{extra:true}])expect(check({...value,...invalid})).toBe(false);
});
