// SPDX-License-Identifier: AGPL-3.0-or-later
import { execFileSync } from 'node:child_process';
const metadata = JSON.parse(execFileSync('cargo', ['metadata', '--locked', '--format-version=1'], { encoding: 'utf8' }));
const core = metadata.packages.find((entry) => entry.name === 'wimm-finance-core');
if (!core) throw new Error('Der eigenständige Rust-Fachkern fehlt.');
const pureDependencies = new Set(['serde', 'serde_json', 'uuid', 'chrono', 'time', 'unicode-normalization', 'num-bigint', 'num-traits']);
for (const dependency of core.dependencies) if (!pureDependencies.has(dependency.name)) throw new Error(`Der Fachkern darf ${dependency.name} nicht importieren.`);
console.log('Rust-Fachkern ohne UI-/Tauri-/Datenbank-/HTTP-Abhängigkeit geprüft.');
