// SPDX-License-Identifier: AGPL-3.0-or-later
import {defineConfig} from '@playwright/test';
export default defineConfig({testDir:'.',testMatch:'offline.spec.ts',outputDir:'../../test-results/dal04/offline',forbidOnly:true,workers:1,timeout:60_000,
 reporter:[['list'],['json',{outputFile:'test-results/dal04/offline-report.json'}]],
 projects:['chromium','firefox','webkit'].map(name=>({name,use:{browserName:name as 'chromium'|'firefox'|'webkit'}})),
 use:{trace:'retain-on-failure'},
 ...(process.env.WIMM_OFFLINE_STOP_SERVER==='1'?{}:{webServer:{command:'pnpm --filter @wimm/web exec vite preview --host 127.0.0.1 --port 4180 --strictPort',url:'http://127.0.0.1:4180',reuseExistingServer:false}})
});
