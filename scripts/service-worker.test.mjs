// SPDX-License-Identifier: AGPL-3.0-or-later
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('../apps/web/public/service-worker.js', import.meta.url), 'utf8');

test('Service Worker cached nur versionierte App-Assets', () => {
  assert.match(source, /wimm-app-assets-v1/);
  assert.match(source, /url\.pathname\.startsWith\('\/api\/'\)/);
  assert.match(source, /request\.destination/);
  assert.doesNotMatch(source, /cache\.put\([^\n]*api/);
});
