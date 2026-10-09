// SPDX-License-Identifier: AGPL-3.0-or-later
import './warnings-as-errors.mjs';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';
const policy=JSON.parse(await readFile('docs/architecture-checks/policy.json','utf8'));const results=[];
for(const [name] of Object.entries(policy.rust).filter(([,rule])=>rule.nativeAssertions)) {
  const args=['test','--locked',...(name==='wimm-desktop'?['--manifest-path','apps/desktop/src-tauri/Cargo.toml']:['-p',name])];
  const result=spawnSync('cargo',args,{encoding:'utf8',maxBuffer:16*1024*1024});
  assert.equal(result.status,0,result.stderr);assert.doesNotMatch(result.stderr,/(?:^|\n)warning(?:\[|:)/);
  const passed=[...result.stdout.matchAll(/test result: ok\. (\d+) passed;/g)].reduce((sum,m)=>sum+Number(m[1]),0);
  assert.ok(passed>0,`${name} benötigt tatsächlich bestandene native Assertions; ausgelassene/ignorierte Tests zählen nicht.`);
  results.push({crate:name,runtime:'native Rust',passed});console.log(`${name}: ${passed} tatsächliche native Tests bestanden.`);
}
await mkdir('test-results/architecture-checks',{recursive:true});await writeFile('test-results/architecture-checks/native-assertions.json',JSON.stringify(results,null,2)+'\n');
