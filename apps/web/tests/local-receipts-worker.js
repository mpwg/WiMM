// SPDX-License-Identifier: AGPL-3.0-or-later
let binding;
let backupHandle;
let cryptoSession;
let wrongSession;
let failBackup = false;
let wrongKey = false;
self.onmessage = async ({ data }) => {
  if (data.crash) { setTimeout(() => { throw new Error('Kontrollierter Ausfall des isolierten Testworkers'); }, 0); return; }
  try {
    if (data.wasmUrl) {
      binding = await import(/* @vite-ignore */ data.wasmUrl);
      const response = await fetch(data.wasmUrl.replace(/\.js$/, '_bg.wasm'));
      if (!response.ok) throw new Error('Die lokale WASM-Testdatei fehlt.');
      await binding.default({ module_or_path: await response.arrayBuffer() });
      const cryptoUrl=data.wasmUrl.replace('/wasm/wimm_local_dal.js','/crypto/wimm_client_crypto.js');
      const crypto=await import(/* @vite-ignore */ cryptoUrl);
      await crypto.default({module_or_path:await (await fetch(cryptoUrl.replace(/\.js$/,'_bg.wasm'))).arrayBuffer()});
      cryptoSession=new crypto.CryptoSession(new Uint8Array(32).fill(41));
      wrongSession=new crypto.CryptoSession(new Uint8Array(32).fill(42));
      const coreUrl=data.wasmUrl.replace('/wasm/wimm_local_dal.js','/core/wimm_core_bindings.js');
      const core=await import(/* @vite-ignore */ coreUrl);
      await core.default({module_or_path:await (await fetch(coreUrl.replace(/\.js$/,'_bg.wasm'))).arrayBuffer()});
      const directory=await (await navigator.storage.getDirectory()).getDirectoryHandle(`wimm-receipt-backup-${data.profile}`,{create:true});
      backupHandle=await (await directory.getFileHandle('source.enc',{create:true})).createSyncAccessHandle();
      self.receiptSeal=plain=>{return JSON.stringify(Array.from(cryptoSession.seal_snapshot(new TextEncoder().encode(plain))));};
      self.receiptUnseal=bytes=>{return new TextDecoder().decode((wrongKey?wrongSession:cryptoSession).open_snapshot(new Uint8Array(JSON.parse(bytes))));};
      self.receiptPersist=json=>{
        if(failBackup)throw new Error('Kontrollierter Backupfehler');
        const r=JSON.parse(json);backupHandle.truncate(0);backupHandle.write(new Uint8Array(r.ciphertext),{at:0});backupHandle.flush();
        return JSON.stringify({backupId:'50000000-0000-4000-8000-000000000090',profileId:r.profileId,spaceId:r.spaceId,epoch:r.epoch,snapshotHash:r.snapshotHash});
      };
      self.receiptRead=json=>{if(JSON.parse(json).backupId!=='50000000-0000-4000-8000-000000000090')throw new Error('Die gespeicherte Sicherung fehlt.');const bytes=new Uint8Array(backupHandle.getSize());backupHandle.read(bytes,{at:0});return JSON.stringify(Array.from(bytes));};
      self.receiptValidate=json=>{
        const s=JSON.parse(json);const aggregates=s.aggregates.map(({handle:_handle,...a})=>a);
        const result=JSON.parse(core.cache_json(JSON.stringify({contractVersion:1,domainSchemaVersion:1,spaceId:s.spaceId,aggregates,projections:s.projections})));
        if(result.status!=='valid')throw new Error('Der tatsächliche Fachkern weist den Snapshot ab.');
      };
      await binding.open_receipt_probe(data.profile); self.postMessage({ ready: true });
    } else {
      failBackup=Boolean(data.request.testFailBackup);wrongKey=Boolean(data.request.testWrongKey);
      const {testFailBackup: _fail, testWrongKey: _key, ...request}=data.request;
      self.postMessage({ id: data.id, result: JSON.parse(binding.receipt_probe_request(JSON.stringify(request))) });
    }
  } catch (error) { self.postMessage({ error: `Das isolierte Testbinding scheitert: ${String(error)}` }); }
};
