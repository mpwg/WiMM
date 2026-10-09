// SPDX-License-Identifier: AGPL-3.0-or-later
import { readFileSync, existsSync } from 'node:fs';
import { resolve, relative, dirname } from 'node:path';
import { pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { parse } from '@babel/parser';
import { sourceFiles } from './check-package-graph.mjs';
export function nodes(ast) {
  const result=[]; const stack=[ast];
  while(stack.length) { const node=stack.pop();if(!node||typeof node!=='object')continue; if(node.type)result.push(node);
    for(const [key,value] of Object.entries(node)) { if(['loc','comments','leadingComments','trailingComments','innerComments','extra'].includes(key))continue; if(Array.isArray(value))stack.push(...value);else if(value!==null&&typeof value==='object')stack.push(value); }
  }return result;
}
export function uiBoundaries(source, filename) {
  const ast=parse(source,{sourceType:'module',createImportExpressions:true,plugins:['typescript',...(filename.endsWith('.tsx')?['jsx']:[])]});
  const all=nodes(ast.program); const result=[];
  const protectedName=/^(?:amount|cents|money|balance|budget|refund|share|total)(?:$|[A-Z_])/;
  const tainted=new Set(all.filter(n=>n.type==='Identifier'&&protectedName.test(n.name)).map(n=>n.name));
  const financial=node=>nodes(node).some(n=>(n.type==='Identifier'&&tainted.has(n.name))||(n.type==='MemberExpression'&&protectedName.test(n.property?.name??'')));
  for(let changed=true;changed;) { changed=false; for(const n of all)if(n.type==='VariableDeclarator'&&n.id.type==='Identifier'&&!tainted.has(n.id.name)&&financial(n.init)){tainted.add(n.id.name);changed=true;} }
  for(const n of all) {
    let specifier, names=[];
    if(n.type==='ImportDeclaration'&&n.importKind!=='type') { names=n.specifiers.filter(s=>s.importKind!=='type').map(s=>s.imported?.name??'*').sort();if(n.specifiers.length===0||names.length)specifier=n.source.value; }
    if(['ExportNamedDeclaration','ExportAllDeclaration'].includes(n.type)&&n.exportKind!=='type'&&n.source) {names=n.type==='ExportAllDeclaration'?['*']:n.specifiers.filter(s=>s.exportKind!=='type').map(s=>s.local?.name??'*').sort();if(names.length)specifier=n.source.value;}
    if(n.type==='ImportExpression') {specifier=n.source.value;names=['*'];if(specifier===undefined)result.push({kind:'unresolvedRuntime',source:source.slice(n.start,n.end)});}
    if(n.type==='CallExpression'&&n.callee?.name==='require') {specifier=n.arguments[0]?.value;names=['*'];}
    if(typeof specifier==='string'&&specifier.startsWith('.')) { const match=resolve(dirname(filename),specifier).match(/\/packages\/(domain|storage|crypto|importers|browser-adapters)\//);if(match)specifier=`@wimm/${match[1]}/relative`; }
    if(typeof specifier==='string'&&/^@wimm\/(domain|storage|crypto|importers|browser-adapters)(?:\/|$)/.test(specifier))result.push({kind:'runtime',source:specifier,names});
    if(((n.type==='BinaryExpression'&&['+','-','*','/','%','**'].includes(n.operator))||(n.type==='AssignmentExpression'&&n.operator!=='=')||n.type==='UpdateExpression')&&financial(n))result.push({kind:'financeArithmetic',source:source.slice(n.start,n.end)});
  }
  return result;
}
export function checkUiSource(source, filename, exceptions=[]) {
  const remaining=[...exceptions];const violations=[];
  for(const entry of uiBoundaries(source,filename)) {const key=JSON.stringify(entry);const index=remaining.findIndex(e=>JSON.stringify(e)===key);if(index>=0)remaining.splice(index,1);else violations.push(`Neue UI-Fach-/Speicherkante: ${filename}: ${key}`);}
  return violations;
}
const ownAllowed={primitive:[],privateTypes:['wimm-contract-primitives'],core:['wimm-finance-types','wimm-contract-primitives'],publicTypes:['wimm-contract-primitives'],localTypes:['wimm-contract-primitives','wimm-finance-types','wimm-public-contracts']};
const forbiddenTechnical=/^(?:diesel(?:_|$)|sqlx(?:-|_|$)|rusqlite$|sea-query$|sea-orm$|axum$|tokio$|tauri(?:-|$)|reqwest$|hyper$|gtk$|react$)/;
const privateServer=/^(?:wimm-finance-(?:core|types)$|wimm-local-|wimm-client-|wimm-core-bindings$|wimm-crypto$|wimm-private-crypto$|wimm-dal-proof$)/;
export function checkRustClosure(role, names, binding=false, roles={}) {
  const errors=[];
  for(const name of names) {
    if(['server','serverDal','http','publicTypes','publicCrypto'].includes(role)&&['core','privateTypes','localTypes','localDal','client','clientCrypto','bindings','platform','dalProof','probe'].includes(roles[name]))errors.push(`Private Rolle im öffentlichen Abschluss: ${role}/${name}/${roles[name]}`);
    if(['clientCrypto','localDal','dalProof'].includes(role)&&roles[name]==='core')errors.push(`Fachhandler im technischen Abschluss: ${role}/${name}`);
    if(ownAllowed[role]&&name.startsWith('wimm-')&&!ownAllowed[role].includes(name))errors.push(`Nicht erlaubte eigene Abhängigkeit: ${role}/${name}`);
    if(['primitive','privateTypes','core','publicTypes','localTypes','client','clientCrypto','publicCrypto','bindings'].includes(role)&&forbiddenTechnical.test(name))errors.push(`${role} darf ${name} nicht transitiv importieren.`);
    if(role==='publicTypes'&&privateServer.test(name))errors.push(`Öffentliche Quelle importiert private Quelle ${name}.`);
    if(['localTypes','localDal','dalProof'].includes(role)&&name==='wimm-finance-core')errors.push('Lokale Vertragsquelle importiert Fachhandler.');
    if(['server','serverDal','publicCrypto','http'].includes(role)&&privateServer.test(name))errors.push(`Serverabschluss enthält private Clientquelle ${name}.`);
    if(['primitive','privateTypes','core','publicTypes','localTypes'].includes(role)&&!binding&&/^(?:uniffi(?:_|$)|wasm-bindgen$|js-sys$|tsify$)/.test(name))errors.push(`Plattformruntime ${name} im reinen Standardabschluss.`);
  }return errors;
}
export function checkUnsafe(source, workspace, manifest, separate=false) {
  const errors=[];
  if(!/^#!\[forbid\(unsafe_code\)\]$/m.test(source))errors.push('Compilerseitige unsafe-Sperre fehlt.');
  if(!/^\[workspace\.lints\.rust\]\s*\nunsafe_code\s*=\s*"forbid"/m.test(workspace))errors.push('Workspace-unsafe-Sperre fehlt.');
  if(!new RegExp(separate?'^\\[lints\\.rust\\]\\s*\\nunsafe_code\\s*=\\s*"forbid"':'^\\[lints\\]\\s*\\nworkspace\\s*=\\s*true','m').test(manifest))errors.push('Cargo-unsafe-Sperre fehlt.');
  return errors;
}
export function checkCatalog(bytes, expected) {
  const parsed=JSON.parse(bytes);const rows=Array.isArray(parsed)?parsed:parsed.cases;
  return rows.length!==expected.count||createHash('sha256').update(bytes).digest('hex')!==expected.sha256?['Contractkatalog wurde geändert oder Fälle ausgelassen.']:[];
}
export function checkEvidence(matrix) {
  const errors=[];const slots=['localSqliteNative','localSqliteBrowser','serverSqlite','serverPostgresql','serverMysql','nativeGui','screenreader','physicalIos'];
  for(const slot of slots) {const e=matrix[slot];
    const backend=slot==='serverPostgresql'?'postgresql':slot==='serverMysql'?'mysql':['nativeGui','screenreader','physicalIos'].includes(slot)?'manual':'sqlite';
    const runtimeKind=slot==='localSqliteBrowser'?'browser':backend==='manual'?'manual':'native';
    if(e?.backend!==backend||e?.runtimeKind!==runtimeKind)errors.push(`Backend-/Laufzeitnachweise vermischt: ${slot}`);if(!e||!['open','historical','verified'].includes(e.status))errors.push(`Unzulässiger Abnahmestatus: ${slot}`);
    if(e?.status==='verified'&&(!e.commit||!e.command||!e.artifact||!e.runtime||e.mock||e.fallback||e.source==='compile'||e.source==='frontend'||e.source==='ci'&&['nativeGui','screenreader','physicalIos'].includes(slot)))errors.push(`Unzureichender tatsächlicher Nachweis: ${slot}`);
  }return errors;
}
export function checkTargetArchitecture(root=process.cwd()) {
  const policy=JSON.parse(readFileSync(resolve(root,'docs/architecture-checks/policy.json'),'utf8'));const errors=[];
  const roles=Object.fromEntries(Object.entries(policy.rust).map(([name,rule])=>[name,rule.role]));
  for(const dir of ['packages/ui/src','apps/web/src','apps/desktop/src'])for(const path of sourceFiles(resolve(root,dir)).filter(p=>!p.includes('.test.'))) {const file=relative(root,path);errors.push(...checkUiSource(readFileSync(path,'utf8'),file,policy.uiLegacy[file]??[]));}
  const own=new Map();
  for(const manifest of ['Cargo.toml','apps/desktop/src-tauri/Cargo.toml']) {const data=JSON.parse(execFileSync('cargo',['metadata','--locked','--format-version=1','--manifest-path',manifest],{cwd:root,encoding:'utf8',maxBuffer:16*1024*1024}));for(const pkg of data.packages)if(pkg.manifest_path.startsWith(resolve(root)+'/'))own.set(pkg.manifest_path,pkg);}
  const metadata={packages:[...own.values()]};
  const workspace=readFileSync(resolve(root,'Cargo.toml'),'utf8');
  for(const pkg of metadata.packages) {
    const separate=pkg.manifest_path===resolve(root,'apps/desktop/src-tauri/Cargo.toml');
    const rule=policy.rust[pkg.name];if(!rule){errors.push(`Eigene Rust-Quelle ohne katalogisierte Rolle: ${pkg.name}`);continue;}
    if(!rule.nativeAssertions&&!policy.legacyAssertionExemptions[pkg.name])errors.push(`Eigene Rust-Quelle ohne native Assertions: ${pkg.name}`);
    if(policy.plannedServerBinaries.includes(pkg.name)&&!pkg.targets.some(t=>t.kind.includes('bin')))errors.push(`Eigenständiges Serverbinary fehlt: ${pkg.name}`);
    if(JSON.stringify(Object.keys(pkg.features).sort())!==JSON.stringify(rule.features.toSorted()))errors.push(`Nicht katalogisierte Featureänderung: ${pkg.name}`);
    for(const target of pkg.targets)errors.push(...checkUnsafe(readFileSync(target.src_path,'utf8'),workspace,readFileSync(pkg.manifest_path,'utf8'),separate).map(e=>`${pkg.name}: ${e}`));
    if(rule.checkClosure)for(const all of [false,true]) {const args=['tree','--locked','-p',pkg.name,'--no-default-features','--edges','normal','--prefix','none','--format','{p}','--target','all'];if(all)args.push('--all-features');const text=execFileSync('cargo',args,{cwd:root,encoding:'utf8'});const names=[...new Set(text.split('\n').filter(Boolean).map(l=>l.split(' ')[0]))];errors.push(...checkRustClosure(rule.role,names.filter(n=>n!==pkg.name),all&&rule.bindings,roles));}
  }
  for(const name of new Set([...policy.plannedServerRoots,...metadata.packages.filter(p=>/^wimm-(?:server|http)/.test(p.name)).map(p=>p.name)]))if(metadata.packages.some(p=>p.name===name)) {const text=execFileSync('cargo',['tree','--locked','-p',name,'--all-features','--edges','normal','--prefix','none','--format','{p}','--target','all'],{cwd:root,encoding:'utf8'});errors.push(...checkRustClosure('server',text.split('\n').map(l=>l.split(' ')[0]),false,roles));}
  for(const file of ['apps/desktop/src-tauri/src/main.rs','apps/desktop/src-tauri/build.rs'])errors.push(...checkUnsafe(readFileSync(resolve(root,file),'utf8'),workspace,readFileSync(resolve(root,'apps/desktop/src-tauri/Cargo.toml'),'utf8'),true));
  for(const [file,expected] of Object.entries(policy.catalogs))errors.push(...checkCatalog(readFileSync(resolve(root,file),'utf8'),expected));
  errors.push(...checkEvidence(JSON.parse(readFileSync(resolve(root,'docs/architecture-checks/evidence.json'),'utf8'))));
  for(const entry of Object.values(policy.rust).filter(e=>e.nativeAssertions)){ const path=resolve(root,entry.nativeAssertions);if(!existsSync(path)||!/#\[test\]/.test(readFileSync(path,'utf8'))||!/assert(?:_eq|_ne|_matches)?!/.test(readFileSync(path,'utf8')))errors.push(`Native Assertions fehlen: ${entry.nativeAssertions}`); }
  return errors;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){const errors=checkTargetArchitecture();if(errors.length){console.error(errors.join('\n'));process.exitCode=1;}else console.log('Rust-Zielgrenzen, UI-Übergangskanten, Contractinventare und getrennte Abnahmestände geprüft.');}
