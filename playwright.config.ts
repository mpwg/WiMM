import { defineConfig, devices } from '@playwright/test'
export default defineConfig({
  testDir: './tests/e2e',
  use: { baseURL: 'http://127.0.0.1:3000' },
  projects: [ { name: 'desktop', use: { ...devices['Desktop Chrome'] } }, { name: 'mobile', use: { ...devices['iPhone SE'], defaultBrowserType: 'chromium' } } ],
  webServer: { command: 'pnpm start', url: 'http://127.0.0.1:3000/health/ready', reuseExistingServer: false },
})
