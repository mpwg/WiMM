// SPDX-License-Identifier: AGPL-3.0-or-later
import {readFile,mkdir,writeFile,rm} from 'node:fs/promises';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
const files=['packages/contracts/generated/local-v2/wasm/wimm_local_contracts.d.ts','packages/contracts/generated/private-v2/wasm/wimm_core_bindings.d.ts','packages/browser-adapters/generated/sqlite/wimm_browser_runtime.d.ts'];
const directory=resolve('test-results/stored-aggregate-declarations');await rm(directory,{recursive:true,force:true});await mkdir(directory,{recursive:true});
function diagnostics(file){return spawnSync('pnpm',['exec','tsc','--ignoreConfig','--noEmit','--skipLibCheck','false','--strict','--target','ES2024','--module','ESNext','--lib','ES2024,DOM,ESNext.Disposable',file],{encoding:'utf8'});}
for(const [index,file] of files.entries()){
 const source=await readFile(file,'utf8');assert(source.includes('export type StoredAggregate = Aggregate & { handle: EntityId };'));
 const declaration=resolve(directory,`positive-${index}.d.ts`);await writeFile(declaration,source);
 const positive=resolve(directory,`consumer-${index}.ts`);await writeFile(positive,`import type {StoredAggregate} from './positive-${index}.js';\ndeclare const entry:StoredAggregate;\nconst id:string=entry.id;\nconst handle:string=entry.handle;\nconst revision:number=entry.revision;\n`);
 const errors=diagnostics(positive);assert.equal(errors.status,0,errors.stdout+errors.stderr);
 const negative=resolve(directory,`negative-${index}.d.ts`);await writeFile(negative,source.replace('export type StoredAggregate = Aggregate & { handle: EntityId };','export interface StoredAggregate extends Aggregate { handle: EntityId; }'));
 const rejected=diagnostics(negative);assert(rejected.status!==0&&rejected.stdout.includes('TS2312'),'Alte ungültige Union-Vererbung wurde nicht abgewiesen.');
}
console.log('Drei tatsächliche WASM-Deklarationen ohne skipLibCheck gültig; alte Union-Interfaces negativ abgewiesen.');
