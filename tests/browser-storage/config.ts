// SPDX-License-Identifier: AGPL-3.0-or-later
import {defineConfig} from '@playwright/test';
export default defineConfig({testDir:'.',testMatch:'browser.spec.ts',outputDir:'../../test-results/dal04/browser',forbidOnly:true,
 reporter:[['list'],['json',{outputFile:'test-results/dal04/browser-report.json'}]],workers:1,
 use:{baseURL:'http://127.0.0.1:4179',trace:'retain-on-failure'},
 projects:['chromium','firefox','webkit'].map(name=>({name,use:{browserName:name as 'chromium'|'firefox'|'webkit'}})),
 webServer:{command:'pnpm --filter @wimm/web exec vite --host 127.0.0.1 --port 4179 --strictPort',url:'http://127.0.0.1:4179',reuseExistingServer:false}
});
