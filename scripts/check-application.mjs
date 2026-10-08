// SPDX-License-Identifier: AGPL-3.0-or-later
import { readFileSync } from 'node:fs';
import { parse } from '@babel/parser';
import { sourceFiles, importSpecifiers } from './check-package-graph.mjs';
const forbidden = new Set(['window', 'document', 'navigator', 'localStorage', 'Worker', 'AbortController', 'AbortSignal', 'HTMLElement', 'crypto', 'Date']);
for (const file of sourceFiles('packages/application/src').filter((file) => !file.endsWith('.test.ts'))) {
  const source = readFileSync(file, 'utf8');
  for (const dependency of importSpecifiers(source, file)) if (!dependency.startsWith('.') && !['@wimm/contracts', '@wimm/domain', '@wimm/crypto', '@wimm/storage', '@wimm/importers'].includes(dependency)) throw new Error(`Die Anwendung darf ${dependency} nicht importieren: ${file}`);
  const stack = [parse(source, { sourceType: 'module', plugins: ['typescript'] }).program];
  while (stack.length) {
    const node = stack.pop();
    if (!node || typeof node !== 'object') continue;
    if (node.type === 'Identifier' && forbidden.has(node.name)) throw new Error(`Nicht injizierte Plattformabhängigkeit ${node.name}: ${file}`);
    for (const [key, value] of Object.entries(node)) {
      if (['loc', 'comments', 'leadingComments', 'trailingComments', 'innerComments', 'extra'].includes(key)) continue;
      if (Array.isArray(value)) stack.push(...value); else if (value !== null && typeof value === 'object') stack.push(value);
    }
  }
}
console.log('Anwendung ohne React/DOM/Browserglobals/Worker und ohne versteckte Uhr/IDs geprüft.');
