import { defineConfig, devices } from '@playwright/test'

const isCI = !!process.env.CI
const scenario = process.env.E2E_SCENARIO ?? 'all'
const grep = scenario === 'smoke' ? /@smoke/ : undefined

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  retries: isCI ? 1 : 0,
  reporter: isCI ? [['github'], ['html', { open: 'never' }]] : [['list'], ['html', { open: 'never' }]],
  grep,
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'on-first-retry'
  },
  webServer: [
    {
      command: 'MOCK_BEDROCK=1 USE_LOCAL_VECTOR_STORE=1 USE_LOCAL_QUESTION_STORE=1 npm run start -w @memorag-mvp/api',
      url: 'http://127.0.0.1:8787/health',
      reuseExistingServer: !isCI,
      timeout: 120_000
    },
    {
      command: 'VITE_API_BASE_URL=http://127.0.0.1:8787 npm run dev -w @memorag-mvp/web -- --host 127.0.0.1 --port 4173',
      url: 'http://127.0.0.1:4173',
      reuseExistingServer: !isCI,
      timeout: 120_000
    }
  ],
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }]
})
