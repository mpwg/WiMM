// SPDX-License-Identifier: AGPL-3.0-or-later
// Ausschließlich synthetischer 100.000-Records-Pfad, keine Finanzdaten in Profilmeldungen.
import {handleWorkerRequest} from '../packages/importers/src/worker.ts';
import {performance} from 'node:perf_hooks';
const entry='<Ntry><Amt Ccy="EUR">1.00</Amt><CdtDbtInd>CRDT</CdtDbtInd><BookgDt><Dt>2026-10-07</Dt></BookgDt><NtryRef>synthetisch</NtryRef></Ntry>';
const bytes=new TextEncoder().encode('<Document xmlns="urn:iso:std:iso:20022:tech:xsd:camt.053.001.02">'+entry.repeat(100000)+'</Document>');
const start=performance.now();const reply=handleWorkerRequest({bytes,format:'camt053',preview:true});
if(!reply.ok||reply.result.preview?.length!==100000)throw new Error('Synthetischer CAMT-Prüfpfad nicht vollständig.');
console.log(JSON.stringify({milliseconds:performance.now()-start,records:reply.result.records.length,preview:reply.result.preview.length}));
