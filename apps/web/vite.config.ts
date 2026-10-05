// SPDX-License-Identifier: AGPL-3.0-or-later
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import react from '@vitejs/plugin-react';
import { clientIconDirectives } from '../../scripts/client-directives.js';
import { createLogger, defineConfig } from 'vite';

export default defineConfig(({ command }) => {
  const logger = createLogger();
  const warn = logger.warn.bind(logger);
  logger.warn = (message, options) => {
    warn(message, options);
    if (command === 'build') throw new Error(`Buildwarnung: ${message}`);
  };
  logger.warnOnce = (message, options) => logger.warn(message, options);

  return {
    customLogger: logger,
    build: {
      target: 'baseline-widely-available',
      rolldownOptions: {
        output: {
          codeSplitting: {
            groups: [
              { name: 'sodium-wasm', test: /node_modules[\\/]libsodium-sumo[\\/]/ },
              { name: 'sodium-bindings', test: /node_modules[\\/]libsodium-wrappers-sumo[\\/]/ }
            ]
          }
        },
        onLog(level, log, handler) {
          handler(level, log);
          if (level === 'warn') throw new Error(`Buildwarnung: ${log.message}`);
        }
      }
    },
    plugins: [clientIconDirectives(), react(), {
      name: 'wimm-offline-assets',
      apply: 'build',
      closeBundle() {
        const assets = readdirSync('dist/assets').sort().map(file => `/assets/${file}`);
        const version = createHash('sha256').update(JSON.stringify(assets)).digest('hex').slice(0, 16);
        const source = readFileSync('dist/service-worker.js', 'utf8');
        writeFileSync('dist/service-worker.js', source.replace("const appShell = ['/'];", `const appShell = ${JSON.stringify(['/', ...assets])};`).replace('wimm-app-assets-v1', `wimm-app-assets-${version}`));
      }
    }]
  };
});
