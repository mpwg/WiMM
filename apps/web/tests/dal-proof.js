// SPDX-License-Identifier: AGPL-3.0-or-later
// Nur isolierte Testseite; kein produktiver Composition Root oder Fallback.
const url = new URL(location.href).searchParams.get('wasmUrl');
const scope = new URL(location.href).searchParams.get('scope');
if (!url?.startsWith('/@fs/')) throw new Error('Das lokale Testbinding fehlt.');
if (!scope || !/^[A-Za-z0-9-]{1,64}$/.test(scope)) throw new Error('Der isolierte Testbereich fehlt.');
const status = document.getElementById('status');
const pending = new Map();
let next = 0;
let worker;
let release;
window.dalProofStatus = 'waiting';
const closed = new Promise(resolve => { release = resolve; });
window.dalProofClose = () => {
  worker?.terminate();
  for (const job of pending.values()) { clearTimeout(job.timer); job.reject(new Error('Die Testverbindung wurde beendet.')); }
  pending.clear(); window.dalProofStatus = 'closed'; release();
};
window.dalProofCrash = () => worker.postMessage({ crash: true });
window.dalProof = (request) => new Promise((resolve, reject) => {
  if (window.dalProofStatus !== 'ready') { reject(new Error('Die Testdatenbank ist nicht bereit.')); return; }
  const id = ++next;
  const timer = setTimeout(() => { pending.delete(id); reject(new Error('Das Testkommando überschreitet die Frist.')); }, 10_000);
  pending.set(id, { resolve, reject, timer }); worker.postMessage({ id, request });
});
if (!navigator.locks) { window.dalProofStatus = 'unsupported'; status.textContent = 'Web Locks fehlen.'; }
else {
  void navigator.locks.request(`wimm-dal-proof-owner-${scope}`, async () => {
    if (window.dalProofStatus === 'closed') return;
    window.dalProofStatus = 'opening';
    worker = new Worker(new URL('./dal-proof-worker.js', import.meta.url), { type: 'module' });
    worker.onmessage = ({ data }) => {
      if (data.ready) { window.dalProofStatus = 'ready'; status.textContent = 'Echtes Diesel/SQLite mit OPFS bereit'; return; }
      if (data.error) { window.dalProofClose(); window.dalProofStatus = 'error'; status.textContent = data.error; return; }
      const job = pending.get(data.id);
      if (job) { clearTimeout(job.timer); pending.delete(data.id); job.resolve(data.result); }
    };
    worker.onerror = () => { window.dalProofClose(); window.dalProofStatus = 'error'; status.textContent = 'Der Testworker ist fehlgeschlagen.'; };
    worker.postMessage({ wasmUrl: url, scope });
    await closed;
  });
}
