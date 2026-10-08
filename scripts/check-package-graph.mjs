// SPDX-License-Identifier: AGPL-3.0-or-later
import { readdirSync, readFileSync } from 'node:fs';
import { resolve, dirname, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parse } from '@babel/parser';

const packages = new Map([
  ['@wimm/contracts', 'packages/contracts'],
  ['@wimm/application', 'packages/application'],
  ['@wimm/core-bindings', 'packages/core-bindings'],
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
  ['@wimm/application', ['@wimm/contracts', '@wimm/domain', '@wimm/storage', '@wimm/importers', '@wimm/crypto']],
  ['@wimm/core-bindings', ['@wimm/contracts']],
  ['@wimm/crypto', ['@wimm/contracts']],
  ['@wimm/domain', ['@wimm/contracts']],
  ['@wimm/storage', ['@wimm/contracts', '@wimm/domain']],
  ['@wimm/sync', ['@wimm/contracts', '@wimm/crypto', '@wimm/domain', '@wimm/storage']],
  ['@wimm/importers', ['@wimm/contracts', '@wimm/domain']],
  ['@wimm/ui', ['@wimm/application', '@wimm/contracts', '@wimm/crypto', '@wimm/domain', '@wimm/storage', '@wimm/importers']],
  ['@wimm/web', ['@wimm/core-bindings', '@wimm/contracts', '@wimm/crypto', '@wimm/domain', '@wimm/importers', '@wimm/storage', '@wimm/sync', '@wimm/ui']],
  ['@wimm/desktop', ['@wimm/contracts', '@wimm/crypto', '@wimm/domain', '@wimm/importers', '@wimm/storage', '@wimm/sync', '@wimm/ui']],
  ['@wimm/server', ['@wimm/contracts']]
]);

export function sourceFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.tsx?$/.test(path) ? [path] : [];
  });
}

/** Syntaxkanten statt Texttreffer: Kommentare und Strings sind keine Imports. */
export function importSpecifiers(source, filename) {
  const ast = parse(source, { sourceType: 'module', createImportExpressions: true, plugins: filename.endsWith('.tsx') ? ['typescript', 'jsx'] : ['typescript'] });
  const imports = []; const pending = [ast.program];
  const literal = node => node?.type === 'StringLiteral' ? node.value : node?.type === 'TemplateLiteral' && node.expressions.length === 0 ? node.quasis[0].value.cooked : undefined;
  while (pending.length) {
    const node = pending.pop();
    if (!node || typeof node !== 'object') continue;
    let specifier;
    if (['ImportDeclaration', 'ExportNamedDeclaration', 'ExportAllDeclaration', 'ImportExpression'].includes(node.type)) specifier = literal(node.source);
    else if (node.type === 'TSImportType') specifier = literal(node.source ?? node.argument);
    else if (node.type === 'TSExternalModuleReference') specifier = literal(node.expression);
    else if (node.type === 'CallExpression' && (node.callee?.type === 'Import' || (node.callee?.type === 'Identifier' && node.callee.name === 'require'))) specifier = literal(node.arguments[0]);
    if (specifier !== undefined) imports.push(specifier);
    // Rückwärts stacken bewahrt die Quellreihenfolge.
    for (const [key, value] of Object.entries(node).reverse()) {
      if (['loc', 'comments', 'leadingComments', 'trailingComments', 'innerComments', 'extra'].includes(key)) continue;
      if (Array.isArray(value)) for (const child of value.toReversed()) pending.push(child);
      else if (value !== null && typeof value === 'object') pending.push(value);
    }
  }
  return imports;
}

export function checkPackageGraph(root = process.cwd(), directories = packages, allowedGraph = allowedDependencies) {
  const violations = [];
  for (const [name, directory] of directories) {
    const allowed = allowedGraph.get(name) ?? [];
    const manifest = JSON.parse(readFileSync(resolve(root, directory, 'package.json'), 'utf8'));
    for (const dependency of Object.keys({ ...manifest.dependencies, ...manifest.devDependencies }).filter(dep => dep.startsWith('@wimm/'))) {
      if (!allowed.includes(dependency)) violations.push(`${name} darf ${dependency} nicht deklarieren.`);
    }
    for (const file of sourceFiles(resolve(root, directory, 'src'))) {
      try {
        for (const specifier of importSpecifiers(readFileSync(file, 'utf8'), file)) {
          const target = specifier.startsWith('.') ? resolve(dirname(file), specifier) : undefined;
          const dependency = specifier.startsWith('@wimm/') ? specifier.split('/').slice(0, 2).join('/') : target === undefined ? undefined : [...directories].find(([, path]) => target.startsWith(resolve(root, path) + sep))?.[0];
          if (dependency !== undefined && dependency !== name && !allowed.includes(dependency)) violations.push(`${name} darf ${dependency} nicht importieren (${file}).`);
        }
      } catch (error) { violations.push(`Die Quelle kann nicht auf Abhängigkeiten geprüft werden (${file}): ${error.message}`); }
    }
  }
  return violations;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const violations = checkPackageGraph();
  if (violations.length) { console.error(violations.join('\n')); process.exitCode = 1; }
  else console.log('Paketgraph entspricht den erlaubten Abhängigkeitsrichtungen.');
}
