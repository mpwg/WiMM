// SPDX-License-Identifier: AGPL-3.0-or-later
import {writeFile}from'node:fs/promises';
import {createUserVault,unlockUserVaultWithRecoveryCode,addIndependentSpaceKey,reencryptUserVault,lockUserVault}from'../../packages/crypto/src/index.js';
import {legacyVaultRecord}from'../../packages/crypto/src/legacy-vault.fixture.js';
if(!process.argv.includes('--write-fixture'))throw new Error('Goldenfixture nur nach ausdrücklicher Prüfung mit --write-fixture erzeugen.');
const password='Synthetische Passphrase 🏠';const created=await createUserVault(password);const empty=await unlockUserVaultWithRecoveryCode(created.record,created.recoveryCode);const enriched=await addIndependentSpaceKey(empty,'00000000-0000-4000-8000-000000000001');const current=await reencryptUserVault(enriched,password,created.recoveryCode);const legacy=await legacyVaultRecord(current,created.recoveryCode,password);await lockUserVault(empty);await lockUserVault(enriched);
await writeFile('crates/client-crypto/tests/fixtures/vault-interop.json',JSON.stringify({synthetic:true,password,recoveryCode:created.recoveryCode,current,legacy,spaceId:'00000000-0000-4000-8000-000000000001'},null,2)+'\n');
