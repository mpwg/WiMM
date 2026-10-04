// SPDX-License-Identifier: AGPL-3.0-or-later
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { after, test } from 'node:test';

const root = resolve(import.meta.dirname, '..');
const require = createRequire(import.meta.url);
const scratch = join(root, '.toolchain-checks');
mkdirSync(scratch, { recursive: true });
const fixture = mkdtempSync(join(scratch, 'run-'));
symlinkSync(join(root, 'apps/web/node_modules'), join(fixture, 'node_modules'), 'junction');
after(() => rmSync(fixture, { recursive: true, force: true }));

function write(name, content) {
  writeFileSync(join(fixture, name), content);
}

function cli(packageName, bin, args, cwd = root) {
  const manifestPath = require.resolve(`${packageName}/package.json`);
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  const path = join(dirname(manifestPath), manifest.bin[bin]);
  return spawnSync(process.execPath, [path, ...args], { cwd, encoding: 'utf8', timeout: 60_000 });
}

function rejected(result, diagnostic) {
  assert.ifError(result.error);
  assert.notEqual(result.status, null);
  assert.notEqual(result.status, 0, result.stdout + result.stderr);
  assert.match(result.stdout + result.stderr, diagnostic);
}

write('tsconfig.json', JSON.stringify({ extends: '../../tsconfig.base.json', include: ['*.ts', '*.tsx'] }));

test('Compiler erfasst React, Toolkonfigurationen und UI-Tests explizit', () => {
  const result = cli('typescript', 'tsc', ['--project', 'tsconfig.json', '--listFilesOnly']);
  assert.equal(result.status, 0, result.stderr);
  for (const file of ['apps/web/src/main.tsx', 'apps/desktop/src/main.tsx', 'packages/ui/src/workspace.tsx',
    'apps/web/vite.config.ts', 'apps/desktop/vite.config.ts', 'playwright.config.ts', 'vitest.config.ts',
    'tests/ui/desktop.config.ts', 'tests/ui/p4-2.spec.ts']) {
    assert.ok(result.stdout.includes(join(root, file)), `${file} fehlt in der Typprüfung.`);
  }
});

test('Compilerfehler in einer React-Datei brechen ab', () => {
  write('invalid.tsx', 'export const value: string = 42;\n');
  rejected(cli('typescript', 'tsc', ['--project', join(fixture, 'tsconfig.json')]), /TS2322/);
});

test('Lintwarnungen und JavaScript-Fehler brechen ab', () => {
  write('warning.ts', 'const unused = 42;\n');
  rejected(cli('oxlint', 'oxlint', ['--deny-warnings', '--no-ignore', join(fixture, 'warning.ts')]), /no-unused-vars/);
  write('invalid.mjs', 'debugger;\n');
  rejected(cli('oxlint', 'oxlint', ['--deny-warnings', '--deny', 'no-debugger', '--no-ignore', join(fixture, 'invalid.mjs')]), /no-debugger/);
});

test('Typgestütztes Linting erkennt unbehandelte Promises und unsichere Zuweisungen', () => {
  write('unsafe.ts', 'Promise.resolve(42);\nexport const value: string = JSON.parse("{}");\n');
  const result = cli('oxlint', 'oxlint', ['--type-aware', '--deny-warnings', '--no-ignore', join(fixture, 'unsafe.ts')]);
  rejected(result, /no-floating-promises/);
  assert.match(result.stdout + result.stderr, /no-unsafe-assignment/);
});

test('Vite-Logger, Rolldown und nativer Größenreporter brechen Builds ab', () => {
  write('package.json', '{"type":"module"}\n');
  write('index.html', '<script type="module" src="/main.js"></script>\n');
  for (const app of ['web', 'desktop']) {
    for (const kind of ['logger', 'rolldown', 'native']) {
      write('main.js', kind === 'native' ? `console.log('${'x'.repeat(510_000)}');\n` : 'console.log("ok");\n');
      const hook = kind === 'logger' ? 'configResolved(config) { config.logger.warn("Fixture-Loggerwarnung"); }'
        : kind === 'rolldown' ? 'buildStart() { this.warn("Fixture-Rolldownwarnung"); }' : '';
      write('vite.config.mjs', `import configure from '../../apps/${app}/vite.config.ts';
const config = configure({ command: 'build', mode: 'production' });
config.plugins.push({ name: 'warning-fixture', ${hook} });
export default config;\n`);
      const result = spawnSync(process.execPath, [join(root, 'scripts/build-vite.mjs')], {
        cwd: fixture, encoding: 'utf8', timeout: 60_000
      });
      rejected(result, kind === 'native' ? /chunks are larger|Diagnoseausgaben/ : /Fixture-.*warnung/);
    }
  }
});

test('Exklusive Vitest-Tests werden auch außerhalb von CI abgewiesen', () => {
  write('exclusive.test.ts', 'import { test, expect } from "vitest";\ntest.only("exklusiv", () => expect(1).toBe(1));\n');
  rejected(cli('vitest', 'vitest', ['run', '--config', join(root, 'vitest.config.ts'), '--root', fixture, 'exclusive.test.ts']), /only|exclusive|exklusiv/i);
});

test('Exklusive Playwright-Tests werden in beiden Konfigurationen abgewiesen', () => {
  write('exclusive.spec.ts', 'import { test } from "@playwright/test";\ntest.only("exklusiv", () => {});\n');
  for (const config of ['playwright.config.ts', 'tests/ui/desktop.config.ts']) {
    write('playwright.config.mjs', `import config from '../../${config}';
export default { ...config, testDir: '.', testMatch: 'exclusive.spec.ts', webServer: undefined };\n`);
    rejected(cli('@playwright/test', 'playwright', ['test', '--config', join(fixture, 'playwright.config.mjs')]), /only|forbidOnly/);
  }
});

test('Rust-Compilerwarnungen werden durch die Projektkonfiguration zu Fehlern', () => {
  const crate = join(fixture, 'rust');
  mkdirSync(join(crate, 'src'), { recursive: true });
  writeFileSync(join(crate, 'Cargo.toml'), '[package]\nname = "warning-fixture"\nversion = "0.0.0"\nedition = "2024"\n[workspace]\n');
  writeFileSync(join(crate, 'Cargo.lock'), 'version = 4\n[[package]]\nname = "warning-fixture"\nversion = "0.0.0"\n');
  writeFileSync(join(crate, 'src/main.rs'), 'fn main() { let unused = 42; }\n');
  const result = spawnSync('cargo', ['check', '--locked', '--manifest-path', join(crate, 'Cargo.toml')], {
    cwd: root, encoding: 'utf8', timeout: 60_000
  });
  rejected(result, /unused.*variable|unused_variables/);
});

test('Node-Warnungen werden zu Fehlern und widersprüchliche Farbvariablen werden normalisiert', () => {
  const policy = join(root, 'scripts/warnings-as-errors.mjs');
  const result = spawnSync(process.execPath, ['--import', policy, '--input-type=module', '-e', 'process.emitWarning("Fixture-Nodewarnung");'], {
    cwd: root, encoding: 'utf8', timeout: 10_000
  });
  rejected(result, /Fixture-Nodewarnung/);
  const colors = spawnSync(process.execPath, ['--import', policy, '--input-type=module', '-e',
    'console.log(JSON.stringify({ noColor: process.env.NO_COLOR, forceColor: process.env.FORCE_COLOR }));'], {
    cwd: root, encoding: 'utf8', env: { ...process.env, NO_COLOR: '1', FORCE_COLOR: '1' }, timeout: 10_000
  });
  assert.equal(colors.status, 0, colors.stderr);
  assert.deepEqual(JSON.parse(colors.stdout), { forceColor: '0' });
});

test('Cargo-Buildskriptwarnungen werden zusätzlich zu rustc-Warnungen abgewiesen', () => {
  const crate = join(fixture, 'rust');
  writeFileSync(join(crate, 'src/main.rs'), 'fn main() {}\n');
  writeFileSync(join(crate, 'build.rs'), 'fn main() { println!("cargo:warning=Fixture-Buildskriptwarnung"); }\n');
  const runner = new URL('./run-with-warning-check.mjs', import.meta.url).href;
  const source = `import { runWithWarningCheck } from ${JSON.stringify(runner)};
process.exitCode = await runWithWarningCheck('cargo', ['check', '--locked', '--manifest-path', ${JSON.stringify(join(crate, 'Cargo.toml'))}]);`;
  rejected(spawnSync(process.execPath, ['--input-type=module', '-e', source], {
    cwd: root, encoding: 'utf8', timeout: 60_000
  }), /Fixture-Buildskriptwarnung/);
});
