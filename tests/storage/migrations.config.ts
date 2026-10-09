// SPDX-License-Identifier: AGPL-3.0-or-later
import {defineConfig} from '@playwright/test';
export default defineConfig({testDir:'.',testMatch:'migrations.spec.ts',workers:1,use:{baseURL:'http://127.0.0.1:5188',browserName:'chromium'},webServer:{command:'pnpm --filter @wimm/web dev --host 127.0.0.1 --port 5188',url:'http://127.0.0.1:5188',reuseExistingServer:false},outputDir:'../../test-results/storage-migrations'});
