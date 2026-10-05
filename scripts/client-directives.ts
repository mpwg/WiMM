// SPDX-License-Identifier: AGPL-3.0-or-later
/** Beide Apps sind vollständige React-Clients ohne React-Server-Components. */
export function clientIconDirectives() {
  return {
    name: 'wimm-client-icon-directives',
    enforce: 'pre' as const,
    transform(code: string, id: string) {
      // Nur die RSC-Metadaten des unveränderten Lucide-Pakets normalisieren.
      // Andere Direktiven und sämtliche Bundlerwarnungen bleiben unverändert.
      if (!/[/\\]lucide-react[/\\]dist[/\\]esm[/\\]/.test(id)) return null;
      const normalized = code.replace(/^(['"])use client\1;?\s*$/m, '');
      return normalized === code ? null : { code: normalized, map: null };
    }
  };
}
