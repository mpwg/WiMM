// SPDX-License-Identifier: AGPL-3.0-or-later
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const script = fileURLToPath(new URL('./check-documentation.mjs', import.meta.url));

async function fixture(files) {
  const directory = await mkdtemp(path.join(tmpdir(), 'wimm-documentation-'));
  await Promise.all(
    Object.entries(files).map(async ([name, content]) => {
      const target = path.join(directory, name);
      await mkdir(path.dirname(target), { recursive: true });
      await writeFile(target, content, 'utf8');
    })
  );
  return directory;
}

function run(directory) {
  try {
    execFileSync(process.execPath, [script, '--root', directory], { encoding: 'utf8', stdio: 'pipe' });
    return { code: 0, output: '' };
  } catch (error) {
    return { code: error.status ?? 1, output: `${error.stdout ?? ''}${error.stderr ?? ''}` };
  }
}

async function withFixture(files, assertion) {
  const directory = await fixture(files);
  try {
    await assertion(run(directory));
  } finally {
    await rm(directory, { force: true, recursive: true });
  }
}

test('akzeptiert gültige Dateien und lokale Anker', async () => {
  await withFixture(
    {
      'README.md': '# Start\n\n[Details](details.md#übersicht)\n',
      'details.md': '# Übersicht\n',
      'settings.json': '{"ready":true}\n',
      'workflow.yml': 'name: Prüfung\n'
    },
    ({ code, output }) => {
      assert.equal(code, 0, output);
    }
  );
});

test('lehnt fehlende Links, JSON und YAML ab', async () => {
  await withFixture(
    {
      'README.md': '# Start\n\n[Fehlt](fehlend.md)\n',
      'settings.json': '{"ready":}\n',
      'workflow.yml': 'name: [\n'
    },
    ({ code, output }) => {
      assert.equal(code, 1);
      assert.match(output, /Ziel fehlt/);
      assert.match(output, /ungültiges JSON/);
      assert.match(output, /ungültiges YAML/);
    }
  );
});

test('prüft Dokumentation, ohne erzeugte Browserprofile und Prüfberichte einzulesen', async () => {
  await withFixture(
    { 'README.md': '# Start\n', '.toolchain-checks/profil/metadata.json': '{defekte generierte Datei', 'test-results/report.json': '{defekte generierte Datei' },
    ({ code, output }) => { assert.equal(code, 0, output); }
  );
});
