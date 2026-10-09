// SPDX-License-Identifier: AGPL-3.0-or-later
import {defineConfig} from '@playwright/test';
export default defineConfig({testDir:'.',testMatch:'persistence.spec.ts',workers:1,timeout:60_000,use:{baseURL:'http://127.0.0.1:5189',browserName:'chromium',trace:'retain-on-failure'},webServer:{command:'pnpm --filter @wimm/web dev --host 127.0.0.1 --port 5189',url:'http://127.0.0.1:5189',reuseExistingServer:false},outputDir:'../../test-results/storage-persistence'});
