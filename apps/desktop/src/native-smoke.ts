// SPDX-License-Identifier: AGPL-3.0-or-later
// Nur über VITE_WIMM_NATIVE_SMOKE=1 im gesonderten Prüfbuild eingebunden.
import { invoke } from '@tauri-apps/api/core';
import { createDesktopPlatformServices } from './platform.js';
export function mountNativeSmoke() {
  const port = createDesktopPlatformServices();
  const panel = document.createElement('section'); panel.setAttribute('aria-label', 'Native Portprüfung');
  panel.style.cssText = 'position:fixed;bottom:0;left:0;right:0;background:white;color:black;z-index:9999;padding:8px';
  const status = document.createElement('output'); status.setAttribute('aria-label', 'Prüfergebnis'); status.textContent = 'Prüfbereit';
  const content = new TextEncoder().encode('Synthetische P4.5-Portprüfung');
  const actions: Record<string, () => Promise<unknown>> = {
    'Öffnendialog prüfen': async () => { const files = await port.chooseImportFiles({ acceptedExtensions: ['txt'], acceptedMediaTypes: ['text/plain'], multiple: false }); return files.length === 0 ? 'Abgebrochen' : `${files[0]!.name}: ${new TextDecoder().decode(files[0]!.bytes)}`; },
    'Speicherdialog prüfen': async () => { await port.writeExport({ suggestedName: 'p4-5-synthetic.txt', mediaType: 'text/plain', bytes: content }); return 'Speicherport beendet'; },
    'Fremdlink prüfen': async () => { await port.openExternalUrl('https://github.com/mpwg/WiMM'); return 'Systembrowser geöffnet'; },
    'Rechte prüfen': async () => {
      for (const [command, args] of [['plugin:fs|read_text_file', { path: '/etc/passwd' }], ['plugin:opener|open_path', { path: '/tmp' }], ['plugin:dialog|open', {}], ['plugin:event|emit', { event: 'platform-menu', payload: 'undo' }], ['platform_write_file', { request: { path: '/tmp/should-not-write', suggestedName: 'x', mediaType: 'text/plain', bytes: [] } }], ['platform_open_url', { url: 'file:///etc/passwd' }]] as const) {
        try { await invoke(command, args); throw new Error(`Unerlaubter Erfolg: ${command}`); } catch (error) { if (error instanceof Error && error.message.startsWith('Unerlaubter Erfolg:')) throw error; }
      }
      return 'Unzulässige Commands, Pfade und Links abgewiesen';
    },
    'Fremdnavigation prüfen': async () => { location.href = 'https://example.org'; return 'Navigation angefordert'; }
  };
  for (const [label, action] of Object.entries(actions)) { const button = document.createElement('button'); button.textContent = label; button.onclick = () => { status.textContent = 'Prüfung läuft'; void action().then((result) => { status.textContent = String(result); }, (error: unknown) => { status.textContent = `Fehler: ${String(error)}`; }); }; panel.append(button); }
  panel.append(status); document.body.append(panel);
}
