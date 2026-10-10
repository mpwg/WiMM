// SPDX-License-Identifier: AGPL-3.0-or-later
// Dieselben zulässigen JS-Daten vor Standard-JSON; keine Fachregeln oder Typkonvertierungen.
export function checkData(value) {
 const ancestors=new Set();
 function walk(value,strict){
  if(value===null||typeof value==='boolean'||typeof value==='string')return true;
  if(value===undefined)return !strict;
  if(typeof value==='number')return Number.isFinite(value);
  if(typeof value!=='object'||ancestors.has(value)||ancestors.size>=128)return false;
  ancestors.add(value);
  try{
   if(Array.isArray(value)){for(const child of value)if(!walk(child,true))return false;return true;}
   const prototype=Reflect.getPrototypeOf(value);if(prototype!==null&&prototype!==Object.prototype)return false;
   for(const key of Reflect.ownKeys(value)){if(typeof key!=='string'||!walk(Reflect.get(value,key),strict||key==='draft'||key==='mapping'||key==='profile'))return false;}
   return true;
  }finally{ancestors.delete(value);}
 }
 try{return walk(value,false);}catch{return false;}
}
