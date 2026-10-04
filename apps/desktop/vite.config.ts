// SPDX-License-Identifier: AGPL-3.0-or-later
import react from '@vitejs/plugin-react';
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
    plugins: [react()],
    server: {
      port: 1420,
      strictPort: true,
      watch: {
        ignored: ['**/src-tauri/**']
      }
    }
  };
});
