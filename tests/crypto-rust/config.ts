// SPDX-License-Identifier: AGPL-3.0-or-later
import { defineConfig } from '@playwright/test';
export default defineConfig({testDir:'.',testMatch:'interop.spec.ts',outputDir:'../../test-results/crypto-proof/browser',forbidOnly:true,use:{baseURL:'http://127.0.0.1:4179'},webServer:{command:'pnpm --filter @wimm/web exec vite --host 127.0.0.1 --port 4179 --strictPort',url:'http://127.0.0.1:4179',reuseExistingServer:!process.env.CI}});
