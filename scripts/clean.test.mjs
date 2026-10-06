// SPDX-License-Identifier: AGPL-3.0-or-later
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { cleanWorkspace } from './clean.mjs';

const scratch = fileURLToPath(new URL('../.toolchain-checks/', import.meta.url));

async function fixture(t) {
  await mkdir(scratch, { recursive: true });
  const root = await mkdtemp(path.join(scratch, 'clean-test-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  execFileSync('git', ['init', '--quiet', root]);
  for (const file of [
    'apps/desktop/src-tauri/target/debug/build.txt', 'apps/web/dist/index.html',
    'test-results/report.txt', '.toolchain-checks/probe.txt',
    'node_modules/package.txt', 'packages/ui/node_modules/package.txt',
    'tsconfig.tsbuildinfo', 'apps/web/src/keep.txt', 'data/local.sqlite', 'pnpm-lock.yaml'
  ]) {
    await mkdir(path.dirname(path.join(root, file)), { recursive: true });
    await writeFile(path.join(root, file), 'synthetisch\n');
  }
  return root;
}

const exists = async (root, file) => readFile(path.join(root, file), 'utf8');
const silent = () => {};

test('Vorschau verändert nichts; Standard entfernt Builds und erhält Daten, Tests und Abhängigkeiten', async (t) => {
  const root = await fixture(t);
  const messages = [];
  await cleanWorkspace(root, ['--all', '--dry-run'], (message) => messages.push(message));
  assert(messages.some((message) => message.includes('src-tauri/target')));
  assert.equal(await exists(root, 'apps/desktop/src-tauri/target/debug/build.txt'), 'synthetisch\n');
  await cleanWorkspace(root, [], silent);
  await assert.rejects(exists(root, 'apps/desktop/src-tauri/target/debug/build.txt'), { code: 'ENOENT' });
  await assert.rejects(exists(root, 'tsconfig.tsbuildinfo'), { code: 'ENOENT' });
  for (const file of ['test-results/report.txt', 'node_modules/package.txt', 'data/local.sqlite', 'pnpm-lock.yaml', 'apps/web/src/keep.txt']) {
    assert.equal(await exists(root, file), 'synthetisch\n');
  }
  await cleanWorkspace(root, [], silent);
});

test('Tests und Abhängigkeiten lassen sich unabhängig entfernen', async (t) => {
  const root = await fixture(t);
  await cleanWorkspace(root, ['--tests'], silent);
  await assert.rejects(exists(root, 'test-results/report.txt'), { code: 'ENOENT' });
  await assert.rejects(exists(root, '.toolchain-checks/probe.txt'), { code: 'ENOENT' });
  assert.equal(await exists(root, 'apps/web/dist/index.html'), 'synthetisch\n');
  await cleanWorkspace(root, ['--deps'], silent);
  await assert.rejects(exists(root, 'packages/ui/node_modules/package.txt'), { code: 'ENOENT' });
  assert.equal(await exists(root, 'pnpm-lock.yaml'), 'synthetisch\n');
});

test('Versionierte Löschziele brechen vor der ersten Löschung ab', async (t) => {
  const root = await fixture(t);
  execFileSync('git', ['add', '-f', 'apps/web/dist/index.html'], { cwd: root });
  await assert.rejects(cleanWorkspace(root, ['--all'], silent), /versionierte Dateien/u);
  assert.equal(await exists(root, 'apps/desktop/src-tauri/target/debug/build.txt'), 'synthetisch\n');
});

test('Symlink-Eltern werden abgewiesen; Symlink-Löschziele behalten ihren Inhalt', async (t) => {
  const root = await fixture(t);
  await symlink(path.join(root, 'data'), path.join(root, 'apps/server'), 'dir');
  await assert.rejects(cleanWorkspace(root, ['--all'], silent), /verlinktes Verzeichnis/u);
  await rm(path.join(root, 'apps/server'));
  await symlink(path.join(root, 'data'), path.join(root, 'packages/ui/dist'), 'dir');
  await cleanWorkspace(root, [], silent);
  assert.equal(await exists(root, 'data/local.sqlite'), 'synthetisch\n');
});

test('Unbekannte Optionen brechen ab, auch bei Vorschau', async (t) => {
  const root = await fixture(t);
  await assert.rejects(cleanWorkspace(root, ['--dry-run', '--everything'], silent), /Unbekannte Clean-Option/u);
  assert.equal(await exists(root, 'apps/web/dist/index.html'), 'synthetisch\n');
});
