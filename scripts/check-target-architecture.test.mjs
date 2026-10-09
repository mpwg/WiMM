// SPDX-License-Identifier: AGPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { checkUiSource, checkRustClosure, checkUnsafe, checkCatalog, checkEvidence } from './check-target-architecture.mjs';
for(const source of ["import { sumMoney } from '@wimm/domain'; sumMoney(values);", "export * from '@wimm/storage';", "await import('@wimm/crypto');", "const core = require('@wimm/domain');", "import { sumMoney } from '../../domain/src/index.js';", "const total = a.amount + b.amount;", "balance += 1;", "budget++;", "const value=account.balance; const changed=value*2;", "await import(target);"])test(`UI-Verstoß scheitert: ${source}`,()=>assert.notEqual(checkUiSource(source,'packages/ui/src/negative.tsx').length,0));
test('Typimports, Kommentare und Darstellung sind keine Fachruntimekante',()=>assert.deepEqual(checkUiSource("import type { AccountAggregate } from '@wimm/domain'; import { type Money } from '@wimm/domain'; // const balance=a.amount+b.amount\nconst label='balance + amount'; const element=<div>{label}</div>;",'view.tsx'),[]));
test('Bestehende Übergangskante erlaubt keine zusätzlichen Symbole oder Berechnungen',()=>{
 const allowed=[{kind:'runtime',source:'@wimm/domain',names:['parseMoney']}];assert.deepEqual(checkUiSource("import { parseMoney } from '@wimm/domain';",'view.tsx',allowed),[]);
 assert.notEqual(checkUiSource("import { parseMoney, sumMoney } from '@wimm/domain';",'view.tsx',allowed).length,0);
 assert.notEqual(checkUiSource("import { parseMoney } from '@wimm/domain';const balance=a.amount+b.amount;",'view.tsx',allowed).length,0);
});
for(const [role,names,binding]of[['core',['serde','orm-wrapper','diesel'],false],['privateTypes',['sqlx-core'],true],['publicTypes',['wimm-finance-types'],true],['localTypes',['wrapper','wimm-finance-core'],true],['server',['server-wrapper','wimm-finance-core'],false],['server',['wimm-private-crypto'],false],['http',['wimm-local-contracts'],false],['serverDal',['wimm-client-application'],false],['core',['tokio'],true],['core',['uniffi'],false]])test(`Transitive verbotene Rust-Kante: ${role}/${names.at(-1)}`,()=>assert.notEqual(checkRustClosure(role,names,binding).length,0));
test('Öffentliche Signaturbibliotheken und optionale Datenbindings gezielt zulässig',()=>{assert.deepEqual(checkRustClosure('server',['axum','tokio','wimm-public-contracts','wimm-public-crypto']),[]);assert.deepEqual(checkRustClosure('publicTypes',['serde','uniffi'],true),[]);});
const source='#![forbid(unsafe_code)]\n';const workspace='[workspace.lints.rust]\nunsafe_code = "forbid"';const manifest='[lints]\nworkspace = true';
for(const [s,w,m]of[[source.replace('forbid','deny'),workspace,manifest],[source,workspace.replace('forbid','warn'),manifest],[source,workspace,manifest.replace('true','false')]])test(`Abgeschwächte unsafe-Sperre scheitert: ${s}/${w}/${m}`,()=>assert.notEqual(checkUnsafe(s,w,m).length,0));
test('Alle compilerseitigen und Cargo-Sperren gemeinsam nötig',()=>assert.deepEqual(checkUnsafe(source,workspace,manifest),[]));
test('Ausgelassene, doppelte und veränderte Contractorakel scheitern ohne Reparatur',()=>{
 const policy=JSON.parse(readFileSync('docs/architecture-checks/policy.json','utf8'));const file='crates/finance-core/tests/fixtures/contract-catalog.json';const bytes=readFileSync(file,'utf8');assert.deepEqual(checkCatalog(bytes,policy.catalogs[file]),[]);
 const original=JSON.parse(bytes);for(const changed of [original.slice(1),[...original.slice(1),original[1]],original.map((c,i)=>i===0?{...c,expected:{status:'invented'}}:c)])assert.notEqual(checkCatalog(JSON.stringify(changed),policy.catalogs[file]).length,0);
 assert.equal(readFileSync(file,'utf8'),bytes);
});
const matrix=JSON.parse(readFileSync('docs/architecture-checks/evidence.json','utf8'));
test('Historische echte DAL-Belege und offene manuelle/Servernachweise bleiben getrennt',()=>assert.deepEqual(checkEvidence(matrix),[]));
for(const slot of ['localSqliteNative','localSqliteBrowser','serverSqlite','serverPostgresql','serverMysql','nativeGui','screenreader','physicalIos'])test(`CI-Grün oder Mock ersetzt ${slot} nicht`,()=>{
 const changed=structuredClone(matrix);changed[slot]={status:'verified',commit:'synthetic',command:'synthetic',artifact:'synthetic',runtime:'mock/Frontendfallback',source:'ci',mock:true};assert.notEqual(checkEvidence(changed).length,0);
});
test('Fehlender Matrixslot wird nicht als Null oder Grün behandelt',()=>{const changed=structuredClone(matrix);delete changed.serverMysql;assert.notEqual(checkEvidence(changed).length,0);});
test('SQLite-Frontendbeleg wird nicht als PostgreSQL oder MySQL umgedeutet',()=>{
 for(const slot of ['serverPostgresql','serverMysql']) {const changed=structuredClone(matrix);changed[slot]={...matrix.localSqliteNative};assert.notEqual(checkEvidence(changed).length,0);}
});
test('Treiberbuild ist keine ausgeführte SQLkonformität',()=>{
 const changed=structuredClone(matrix);changed.serverPostgresql={...changed.serverPostgresql,status:'verified',commit:'abc1234',command:'cargo build',artifact:'compile.log',runtime:'postgresql',source:'compile'};assert.notEqual(checkEvidence(changed).length,0);
});
test('Umbenannte private Rollen umgehen öffentliche Servergrenzen nicht',()=>{
 assert.notEqual(checkRustClosure('server',['innocent-helper'],false,{'innocent-helper':'clientCrypto'}).length,0);
 assert.notEqual(checkRustClosure('publicTypes',['neutral-name'],true,{'neutral-name':'privateTypes'}).length,0);
 assert.notEqual(checkRustClosure('localDal',['helper'],false,{helper:'core'}).length,0);
});
