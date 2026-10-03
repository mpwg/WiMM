// SPDX-License-Identifier: AGPL-3.0-or-later
import { afterEach, describe, expect, it } from 'vitest';

import { createServer } from './index.js';

const servers = [] as ReturnType<typeof createServer>[];

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => server.close()));
});

describe('Serverhülle', () => {
  it('meldet Liveness, Bereitschaft und öffentliche Metadaten ohne Finanzdaten', async () => {
    const server = createServer({ sourceUrl: 'https://example.test/source' });
    servers.push(server);

    const live = await server.inject('/api/v1/health/live');
    expect(live.statusCode).toBe(200);
    expect(live.json()).toEqual({ status: 'live' });

    const ready = await server.inject('/api/v1/health/ready');
    expect(ready.statusCode).toBe(200);
    expect(ready.json()).toEqual({ status: 'ready' });

    const metadata = await server.inject('/api/v1/meta');
    expect(metadata.statusCode).toBe(200);
    expect(metadata.json()).toEqual({
      appVersion: '0.0.0',
      externalAuthenticationAvailable: false,
      license: 'AGPL-3.0-or-later',
      protocolVersion: 1,
      sourceUrl: 'https://example.test/source'
    });
  });

  it('meldet während eines nicht bereiten Zustands HTTP 503', async () => {
    const server = createServer({ ready: false });
    servers.push(server);

    const response = await server.inject('/api/v1/health/ready');
    expect(response.statusCode).toBe(503);
    expect(response.json()).toEqual({ status: 'starting' });
  });
});
