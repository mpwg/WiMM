// SPDX-License-Identifier: AGPL-3.0-or-later
import './warnings-as-errors.mjs';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
const directory='test-results/dal04/signature-drift';await mkdir(directory,{recursive:true});
const original=await readFile('packages/browser-adapters/generated/sqlite/wimm_browser_runtime.d.ts','utf8');const changed=original+'\nexport type InjectedBrowserDrift = true;\n';const file=`${directory}/wimm_browser_runtime.d.ts`;await writeFile(file,changed);
const result=spawnSync('node',['scripts/build-browser-runtime.mjs','--check',directory],{encoding:'utf8'});
if(result.status!==1||!result.stderr.includes('Signatur ist verändert')||await readFile(file,'utf8')!==changed)throw new Error('Negativer Browser-Signaturdrift wurde nicht ohne Überschreiben abgewiesen.');
console.log('Absichtlicher Browser-Signaturdrift abgewiesen; keine versionierte oder veränderte Testdatei überschrieben.');
