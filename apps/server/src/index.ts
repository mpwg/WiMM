// SPDX-License-Identifier: AGPL-3.0-or-later
import Fastify from 'fastify';

import { PROTOCOL_VERSION } from '@wimm/contracts';

const defaultSourceUrl = 'https://github.com/mpwg/WiMM';

export interface ServerOptions {
  ready?: boolean;
  sourceUrl?: string;
}

export function createServer(options: ServerOptions = {}) {
  const ready = options.ready ?? true;
  const sourceUrl = options.sourceUrl ?? process.env.WIMM_SOURCE_URL ?? defaultSourceUrl;
  const server = Fastify({ logger: false });

  server.get('/api/v1/health/live', async () => ({ status: 'live' }));
  server.get('/api/v1/health/ready', async (_request, reply) => {
    if (!ready) return reply.status(503).send({ status: 'starting' });

    return { status: 'ready' };
  });
  server.get('/api/v1/meta', async () => ({
    appVersion: '0.0.0',
    externalAuthenticationAvailable: false,
    license: 'AGPL-3.0-or-later',
    protocolVersion: PROTOCOL_VERSION,
    sourceUrl
  }));

  return server;
}

export async function startServer(): Promise<void> {
  const server = createServer();
  const host = process.env.WIMM_HOST ?? '127.0.0.1';
  const port = Number.parseInt(process.env.WIMM_PORT ?? '3000', 10);

  await server.listen({ host, port });
}

if (process.argv[1]?.endsWith('/index.ts')) {
  void startServer().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
