// SPDX-License-Identifier: AGPL-3.0-or-later
import { execFileSync } from 'node:child_process';
import { lstat, readdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const workspaceDirectories = [
  '.', 'apps/web', 'apps/desktop', 'apps/server',
  'packages/contracts', 'packages/crypto', 'packages/domain',
  'packages/importers', 'packages/storage', 'packages/sync', 'packages/ui'
];

async function status(file) {
  try {
    return await lstat(file);
  } catch (error) {
    if (error.code === 'ENOENT') return undefined;
    throw error;
  }
}

export async function cleanWorkspace(root, args, log = console.log) {
  const allowed = new Set(['--dry-run', '--tests', '--deps', '--all']);
  for (const arg of args) {
    if (!allowed.has(arg)) throw new Error(`Unbekannte Clean-Option: ${arg}`);
  }
  const dryRun = args.includes('--dry-run');
  const tests = args.includes('--tests') || args.includes('--all');
  const deps = args.includes('--deps') || args.includes('--all');
  const builds = args.includes('--all') || (!tests && !deps);
  const candidates = [];
  if (builds) candidates.push('apps/desktop/src-tauri/target', 'apps/desktop/src-tauri/gen');
  if (tests) candidates.push('test-results', '.toolchain-checks');
  for (const directory of workspaceDirectories) {
    // Auch interne Symlink-Eltern dürfen kein Löschziel umleiten.
    let parent = root;
    for (const part of directory.split('/').filter((part) => part !== '.')) {
      parent = path.join(parent, part);
      if ((await status(parent))?.isSymbolicLink()) {
        throw new Error(`Aufräumen abgebrochen: verlinktes Verzeichnis ${directory}.`);
      }
    }
    if (builds) {
      candidates.push(path.join(directory, 'dist'));
      const entries = await readdir(path.join(root, directory)).catch((error) => {
        if (error.code === 'ENOENT') return [];
        throw error;
      });
      candidates.push(...entries.filter((name) => name.endsWith('.tsbuildinfo'))
        .map((name) => path.join(directory, name)));
    }
    if (deps) candidates.push(path.join(directory, 'node_modules'));
  }
  if (builds && (await status(path.join(root, 'apps/desktop/src-tauri')))?.isSymbolicLink()) {
    throw new Error('Aufräumen abgebrochen: src-tauri ist ein verlinktes Verzeichnis.');
  }

  // Vor jeder Löschung alle Ziele prüfen; versionierte Dateien bleiben geschützt.
  const tracked = execFileSync('git', ['ls-files', '-z', '--', ...candidates], { cwd: root });
  if (tracked.length > 0) throw new Error('Aufräumen abgebrochen: Ein Löschziel enthält versionierte Dateien.');
  const existing = [];
  for (const candidate of candidates) {
    if (await status(path.join(root, candidate))) existing.push(candidate);
  }
  for (const candidate of existing) {
    log(`${dryRun ? 'Würde entfernen' : 'Entferne'}: ${candidate}`);
    if (!dryRun) await rm(path.join(root, candidate), { recursive: true, force: true });
  }
  if (existing.length === 0) log('Keine passenden Dateien zum Aufräumen vorhanden.');
  if (dryRun) log('Vorschau beendet; keine Dateien entfernt.');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = fileURLToPath(new URL('../', import.meta.url));
  try {
    await cleanWorkspace(root, process.argv.slice(2));
  } catch (error) {
    console.error(`Workspace-Aufräumen fehlgeschlagen: ${error.message}`);
    process.exitCode = 1;
  }
}
