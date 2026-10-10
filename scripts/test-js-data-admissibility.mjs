// SPDX-License-Identifier: AGPL-3.0-or-later
import assert from 'node:assert/strict';
import {checkData} from '../crates/contract-primitives/js/data.js';
const invalid=[NaN,Infinity,-Infinity,()=>{},Symbol('synthetisch'),1n,new Date(),new Map(),new Set(),[undefined],{draft:{optional:undefined}},{mapping:{optional:undefined}},{profile:{optional:undefined}},{list:[{optional:undefined}]}];
const cycle={};cycle.self=cycle;invalid.push(cycle);
const symbol={};symbol[Symbol('synthetisch')]=1;invalid.push(symbol);
const thrown={};Object.defineProperty(thrown,'data',{get(){throw new Error('synthetisch');}});invalid.push(thrown);
let deep={};for(let i=0;i<128;i++)deep={next:deep};invalid.push(deep);
for(const value of invalid)assert.equal(checkData(value),false);
const shared={value:1};const nil=Object.create(null);nil.value='Synthetisch';
for(const value of [null,true,'Synthetisch',0,-1,Number.MAX_SAFE_INTEGER,undefined,{optional:undefined},{values:[null,1,'x']},{a:shared,b:shared},nil])assert.equal(checkData(value),true);
console.log('JS-Datengrenze: endliche primitive Daten, Realm/Prototyp, Zyklen, Tiefe, Symbole und strikte Originalfelder geprüft.');
