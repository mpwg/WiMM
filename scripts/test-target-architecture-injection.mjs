// SPDX-License-Identifier: AGPL-3.0-or-later
import './warnings-as-errors.mjs';
import { readFile, writeFile, unlink, access } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
const path='packages/ui/src/__architecture_negative__.tsx';
try { await access(path); throw new Error('Die synthetische Negativquelle existiert bereits; vorhandene Datei bleibt erhalten.'); } catch(error) { if(error.code!=='ENOENT')throw error; }
const policy='docs/architecture-checks/policy.json';const before=createHash('sha256').update(await readFile(policy)).digest('hex');
try {
  await writeFile(path,"// Ausschließlich synthetischer Architekturtest, kein Produktcode.\nimport { sumMoney } from '@wimm/domain';\nexport const result = sumMoney([1, 2]);\n");
  const result=spawnSync(process.execPath,['scripts/check-target-architecture.mjs'],{encoding:'utf8'});
  assert.notEqual(result.status,0);assert.match(result.stderr,/Neue UI-Fach-/);assert.equal(createHash('sha256').update(await readFile(policy)).digest('hex'),before,'Prüfmodus darf keine Bestandsausnahme hinzufügen.');
} finally { await unlink(path); }
const restored=spawnSync(process.execPath,['scripts/check-target-architecture.mjs'],{encoding:'utf8'});assert.equal(restored.status,0,restored.stderr);
console.log('Absichtlicher UI-Fachimport vom echten Prüfkommando abgewiesen, Quelle entfernt, Policy unverändert, anschließender Lauf grün.');
