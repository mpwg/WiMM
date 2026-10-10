// SPDX-License-Identifier: AGPL-3.0-or-later
let binding;
self.onmessage = async ({ data }) => {
  if (data.crash) { setTimeout(() => { throw new Error('Kontrollierter Ausfall des isolierten Testworkers'); }, 0); return; }
  try {
    if (data.wasmUrl) {
      binding = await import(/* @vite-ignore */ data.wasmUrl);
      const response = await fetch(data.wasmUrl.replace(/\.js$/, '_bg.wasm'));
      if (!response.ok) throw new Error('Die lokale WASM-Testdatei fehlt.');
      await binding.default({ module_or_path: await response.arrayBuffer() });
      await binding.open_receipt_probe(data.profile); self.postMessage({ ready: true });
    } else {
      self.postMessage({ id: data.id, result: JSON.parse(binding.receipt_probe_request(JSON.stringify(data.request))) });
    }
  } catch (error) { self.postMessage({ error: `Das isolierte Testbinding scheitert: ${String(error)}` }); }
};
