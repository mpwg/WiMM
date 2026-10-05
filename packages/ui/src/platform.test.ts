// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest';
import { validateExternalUrl } from './platform.js';
describe('Externe Links', () => {
  it('erlaubt Weblinks und lehnt aktive/lokale Schemata sowie Credentials ab', () => {
    for (const value of ['javascript:alert(1)', 'data:text/html,hi', 'file:///etc/passwd', 'https://user:secret@example.org', 'tauri://localhost', 'kein Link']) expect(() => validateExternalUrl(value)).toThrow(/Link|Invalid URL/);
    expect(validateExternalUrl('https://github.com/mpwg/WiMM')).toBe('https://github.com/mpwg/WiMM');
  });
});
