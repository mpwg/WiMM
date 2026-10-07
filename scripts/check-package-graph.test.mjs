// SPDX-License-Identifier: AGPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { checkPackageGraph, importSpecifiers } from './check-package-graph.mjs';

const forms = [
  "import '@wimm/ui';", "import type { T } from '@wimm/ui';", "await import('@wimm/ui/subpath');",
  "export { T } from '@wimm/ui';", "export * from '@wimm/ui';", "type T = import('@wimm/ui').T;",
  "import T = require('@wimm/ui');", "await import(`@wimm/ui`);", "const T = require('@wimm/ui');"
];
for (const form of forms) test(`weist verbotene TSX-Kante ab: ${form}`, () => {
  mkdirSync('.toolchain-checks', { recursive: true }); const root = mkdtempSync(resolve('.toolchain-checks', 'graph-'));
  const packages = new Map([['@wimm/domain', 'packages/domain']]); const allowed = new Map([['@wimm/domain', ['@wimm/contracts']]]);
  try {
    mkdirSync(resolve(root, 'packages/domain/src'), { recursive: true });
    writeFileSync(resolve(root, 'packages/domain/package.json'), JSON.stringify({ dependencies: {} }));
    writeFileSync(resolve(root, 'packages/domain/src/view.tsx'), `${form}\nconst element = <div />;`);
    assert.equal(checkPackageGraph(root, packages, allowed).length, 1);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
test('erfasst reale Imports und ignoriert Kommentare, Texte und JSX-Inhalte', () => {
  assert.deepEqual(importSpecifiers("// import '@wimm/ui'\nconst text = \"import('@wimm/ui')\"; const node = <div>from '@wimm/ui'</div>; import type { Money } from '@wimm/contracts'; export * from '@wimm/contracts/subpath';", 'view.tsx'), ['@wimm/contracts', '@wimm/contracts/subpath']);
});
test('validiert TS ohne JSX-Mehrdeutigkeit und lehnt Syntaxfehler ab', () => {
  assert.deepEqual(importSpecifiers("const identity = <T>(value: T) => value;", 'source.ts'), []);
  assert.throws(() => importSpecifiers("import {", 'source.ts'));
});
