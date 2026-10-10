// SPDX-License-Identifier: AGPL-3.0-or-later
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect,test } from '@playwright/test';
import type {} from '../../apps/web/tests/stateful-runtime.js';
const catalog=JSON.parse(readFileSync('test-results/stateful-runtime/cases.json','utf8')) as {cases:{name:string}[];expected:unknown[]};
test('Zustandsbehaftete Rust-Runtime: derselbe Sprachkatalog im tatsächlichen Chromium-WASM',async({page})=>{
 expect(catalog.cases).toHaveLength(148);expect(catalog.expected).toHaveLength(148);
 await page.goto(`/tests/stateful-runtime.html?wasmUrl=${encodeURIComponent(`/@fs/${resolve('test-results/stateful-runtime/wasm/wimm_core_bindings.js')}`)}`);
 await page.waitForFunction(()=>window.statefulRuntimeProbe!==undefined);
 for(const [index,scenario]of catalog.cases.entries())expect(await page.evaluate(s=>window.statefulRuntimeProbe(s),scenario),scenario.name).toEqual(catalog.expected[index]);
});
