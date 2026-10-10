// SPDX-License-Identifier: AGPL-3.0-or-later
import {expect,it,vi} from 'vitest';
vi.mock('./types.js',async original=>({...await original<typeof import('./types.js')>(),MAX_IMPORT_OUTPUT_BYTES:4096}));
import {createImportOutputBudget} from './output-budget.js';
import {ImportFailure} from './types.js';
it('erhält das exakte UTF-8-Budget über Puffergrenze, Mehrbytezeichen und unpaarige Surrogate',()=>{
 const texts=['Synthetischer ASCII-Text','Österreich','\ud800','🧮'.repeat(300),'a'.repeat(1024)];
 const budget=createImportOutputBudget();let used=0;
 for(const text of texts){used+=new TextEncoder().encode(text).byteLength+8;expect(()=>budget(text)).not.toThrow();}
 const exact='b'.repeat(4096-used-8);expect(()=>budget(exact)).not.toThrow();
 expect(()=>budget('')).toThrow(ImportFailure);
});
it('zählt gemeinsame Quellreferenzen weiterhin einmal und primitive Werte vollständig',()=>{
 const shared={text:'ü'};const budget=createImportOutputBudget();
 budget(shared);budget(shared); // 32 Objektbytes + 12 Schlüsselbytes + 10 Textbytes.
 expect(()=>budget('x'.repeat(4096-54-8))).not.toThrow();expect(()=>budget(null)).toThrow(ImportFailure);
});
