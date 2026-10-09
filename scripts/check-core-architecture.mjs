// SPDX-License-Identifier: AGPL-3.0-or-later
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
const metadata = JSON.parse(execFileSync('cargo', ['metadata', '--locked', '--format-version=1'], { encoding: 'utf8' }));
const core = metadata.packages.find((entry) => entry.name === 'wimm-finance-core');
if (!core) throw new Error('Der eigenständige Rust-Fachkern fehlt.');
const pureDependencies = new Set(['serde', 'serde_json', 'uuid', 'chrono', 'time', 'unicode-normalization', 'num-bigint', 'num-traits', 'schemars']);
for (const dependency of core.dependencies) if (!pureDependencies.has(dependency.name)) throw new Error(`Der Fachkern darf ${dependency.name} nicht importieren.`);
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
