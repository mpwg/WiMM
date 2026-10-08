// SPDX-License-Identifier: AGPL-3.0-or-later
import {defineConfig} from '@playwright/test';
export default defineConfig({testDir:'.',testMatch:'encrypted-backups.spec.ts',workers:1,use:{baseURL:'http://127.0.0.1:5187',browserName:'chromium'},webServer:{command:'pnpm --filter @wimm/web dev --host 127.0.0.1 --port 5187',url:'http://127.0.0.1:5187',reuseExistingServer:false},outputDir:'test-results/encrypted-backups'});
