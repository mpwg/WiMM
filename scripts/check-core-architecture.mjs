// SPDX-License-Identifier: AGPL-3.0-or-later
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
const metadata = JSON.parse(execFileSync('cargo', ['metadata', '--locked', '--format-version=1'], { encoding: 'utf8' }));
const core = metadata.packages.find((entry) => entry.name === 'wimm-finance-core');
if (!core) throw new Error('Der eigenständige Rust-Fachkern fehlt.');
const pureDependencies = new Set(['serde', 'serde_json', 'uuid', 'chrono', 'time', 'unicode-normalization', 'num-bigint', 'num-traits', 'schemars', 'wimm-finance-types', 'wimm-contract-primitives']);
const types = metadata.packages.find((entry) => entry.name === 'wimm-finance-types');
if (!types) throw new Error('Die gemeinsame plattformfreie Rust-Typquelle fehlt.');
for (const component of [core, types]) {
  for (const dependency of component.dependencies) {
    const nativeGenerator = component === types && dependency.name === 'uniffi' && dependency.optional
      && JSON.stringify(types.features['native-bindings']) === JSON.stringify(['dep:uniffi']);
    const wasmGenerator = component === types && ['tsify', 'wasm-bindgen'].includes(dependency.name) && dependency.optional
      && JSON.stringify(types.features['wasm-bindings']) === JSON.stringify(['wimm-contract-primitives/wasm-data', 'dep:tsify', 'dep:wasm-bindgen']);
    if (!pureDependencies.has(dependency.name) && !nativeGenerator && !wasmGenerator) throw new Error(`Der Fachkern darf ${dependency.name} nicht importieren.`);
  }
}
const defaultCoreTree = execFileSync('cargo', ['tree', '--locked', '-p', 'wimm-finance-core', '--no-default-features', '--edges', 'normal', '--prefix', 'none', '--format', '{p}'], { encoding: 'utf8' });
if (/^(?:uniffi(?:[_ ]|$)|wasm-bindgen |js-sys |tsify )/m.test(defaultCoreTree)) throw new Error('Die plattformfreie Kernkonfiguration darf keine native Bindingruntime importieren.');
console.log('Rust-Fachkern ohne UI-/Tauri-/Datenbank-/HTTP-Abhängigkeit geprüft.');

const ownTargets = metadata.packages.filter((entry) => metadata.workspace_members.includes(entry.id)).flatMap((entry) => entry.targets.map((target) => target.src_path));
for (const path of [...ownTargets, 'apps/desktop/src-tauri/src/main.rs', 'apps/desktop/src-tauri/build.rs']) {
  if (!/^#!\[forbid\(unsafe_code\)\]$/m.test(readFileSync(path, 'utf8'))) throw new Error(`Die verbindliche unsafe-Sperre fehlt: ${path}`);
}
console.log('Compilerverbot für unsafe in allen eigenen Rust-Crates und im Tauri-Buildscript geprüft.');

if (!/^\[workspace\.lints\.rust\]\s*\nunsafe_code\s*=\s*"forbid"/m.test(readFileSync('Cargo.toml','utf8'))) throw new Error('Die globale Workspace-unsafe-Sperre fehlt.');
for (const entry of metadata.packages.filter((entry) => metadata.workspace_members.includes(entry.id))) {
  if (!/^\[lints\]\s*\nworkspace\s*=\s*true/m.test(readFileSync(entry.manifest_path,'utf8'))) throw new Error(`Die unsafe-Regel wird nicht geerbt: ${entry.name}`);
}
if (!/^\[lints\.rust\]\s*\nunsafe_code\s*=\s*"forbid"/m.test(readFileSync('apps/desktop/src-tauri/Cargo.toml','utf8'))) throw new Error('Die globale Tauri-unsafe-Sperre fehlt.');
console.log('unsafe-Code global für Workspace und separaten Tauri-Appcrate verboten.');

const publicTree = execFileSync('cargo', ['tree','--locked','-p','wimm-public-contracts','--no-default-features','--edges','normal','--prefix','none','--format','{p}'], {encoding:'utf8'});
if (/^(?:wimm-finance-(?:core|types) |uniffi(?:[_ ]|$)|wasm-bindgen |js-sys |tsify |tauri |(?:sqlx|diesel|axum|tokio) )/m.test(publicTree)) throw new Error('Die öffentliche Standardtypquelle darf keine privaten Fachmodelle, Plattformruntime oder ORM importieren.');
console.log('Öffentliche Rust-Typquelle ohne private Fach-/Plattform-/ORM-Abhängigkeiten geprüft.');

const localTree=execFileSync('cargo',['tree','--locked','-p','wimm-local-contracts','--no-default-features','--edges','normal','--prefix','none','--format','{p}'],{encoding:'utf8'});
if(/^(?:wimm-finance-core |tauri |(?:sqlx|diesel|axum|tokio) |uniffi(?:[_ ]|$)|wasm-bindgen |js-sys |tsify )/m.test(localTree))throw new Error('Lokale Standard-Vertragsformen dürfen keine Fachhandler, Plattformruntime oder ORM importieren.');
if(/^wimm-local-contracts /m.test(publicTree))throw new Error('Öffentliche Verträge dürfen lokale Vertragsquellen nicht importieren.');
console.log('Lokale Standard-Vertragsquelle ohne Fachhandler/Plattform/ORM und öffentliche Abhängigkeitsrichtung geprüft.');
