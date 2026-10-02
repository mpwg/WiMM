// SPDX-License-Identifier: AGPL-3.0-or-later
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const packages = new Map([
  ['@wimm/contracts', 'packages/contracts'],
  ['@wimm/crypto', 'packages/crypto'],
  ['@wimm/domain', 'packages/domain'],
  ['@wimm/storage', 'packages/storage'],
  ['@wimm/sync', 'packages/sync'],
  ['@wimm/importers', 'packages/importers'],
  ['@wimm/ui', 'packages/ui'],
  ['@wimm/web', 'apps/web'],
  ['@wimm/desktop', 'apps/desktop'],
  ['@wimm/server', 'apps/server']
]);
const allowedDependencies = new Map([
  ['@wimm/contracts', []],
  ['@wimm/crypto', ['@wimm/contracts']],
  ['@wimm/domain', ['@wimm/contracts']],
  ['@wimm/storage', ['@wimm/contracts', '@wimm/domain']],
  ['@wimm/sync', ['@wimm/contracts', '@wimm/crypto', '@wimm/domain', '@wimm/storage']],
  ['@wimm/importers', ['@wimm/contracts', '@wimm/domain']],
  ['@wimm/ui', ['@wimm/contracts', '@wimm/domain']],
  ['@wimm/web', ['@wimm/contracts', '@wimm/crypto', '@wimm/domain', '@wimm/importers', '@wimm/storage', '@wimm/sync', '@wimm/ui']],
  ['@wimm/desktop', ['@wimm/contracts', '@wimm/crypto', '@wimm/domain', '@wimm/importers', '@wimm/storage', '@wimm/sync', '@wimm/ui']],
  ['@wimm/server', ['@wimm/contracts']]
]);
const violations = [];

function sourceFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return path.endsWith('.ts') ? [path] : [];
  });
}

for (const [name, directory] of packages) {
  const allowed = allowedDependencies.get(name);
  const manifest = JSON.parse(readFileSync(resolve(root, directory, 'package.json'), 'utf8'));
  const declared = Object.keys({ ...manifest.dependencies, ...manifest.devDependencies })
    .filter((dependency) => dependency.startsWith('@wimm/'));

  for (const dependency of declared) {
    if (!allowed.includes(dependency)) violations.push(`${name} darf ${dependency} nicht deklarieren.`);
  }

  for (const file of sourceFiles(resolve(root, directory, 'src'))) {
    const source = readFileSync(file, 'utf8');
    for (const match of source.matchAll(/(?:from\s+|import\s*)['"](@wimm\/[^/'"]+)/g)) {
      if (!allowed.includes(match[1])) violations.push(`${name} darf ${match[1]} nicht importieren (${file}).`);
    }
  }
}

if (violations.length > 0) {
  console.error(violations.join('\n'));
  process.exit(1);
}

console.log('Paketgraph entspricht den erlaubten Abhängigkeitsrichtungen.');
