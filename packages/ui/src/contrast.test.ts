// SPDX-License-Identifier: AGPL-3.0-or-later
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';

function luminance(hex: string) {
  const channels = hex.replace('#', '').match(/../g)!.map(value => parseInt(value, 16) / 255).map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return channels[0]! * 0.2126 + channels[1]! * 0.7152 + channels[2]! * 0.0722;
}
function contrast(a: string, b: string) {
  const values = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (values[0]! + 0.05) / (values[1]! + 0.05);
}
const css = readFileSync(new URL('./styles.css', import.meta.url), 'utf8');
for (const scheme of ['light', 'dark']) {
  it(`prüft Text, primäre Aktionen und Eingabegrenzen im ${scheme}-Schema`, () => {
    const block = css.match(new RegExp(`\\.app-shell\\[data-color-scheme='${scheme}'\\] \\{([^}]+)`))![1]!;
    const tokens: Record<string, string> = Object.fromEntries([...block.matchAll(/--([\w-]+):\s*(#[0-9a-f]+)/g)].map(match => [match[1]!, match[2]!] as const));
    const normalize = (value: string) => value.length === 4 ? '#' + value.slice(1).split('').map(char => char + char).join('') : value;
    const value = (key: string) => normalize(tokens[key]!);
    for (const foreground of ['text', 'muted', 'danger', 'accent', 'status']) {
      for (const background of ['background', 'surface']) expect(contrast(value(foreground), value(background))).toBeGreaterThanOrEqual(4.5);
    }
    expect(contrast(value('accent-text'), value('accent'))).toBeGreaterThanOrEqual(4.5);
    expect(contrast(value('selected-text'), value('selected'))).toBeGreaterThanOrEqual(4.5);
    expect(contrast(value('input-border'), value('surface'))).toBeGreaterThanOrEqual(3);
  });
}
