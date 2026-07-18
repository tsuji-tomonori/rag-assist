import { existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { defineConfig, devices } from '@playwright/test'

const isCI = !!process.env.CI
const scenario = process.env.E2E_SCENARIO ?? 'all'
const grep =
  scenario === 'smoke'
    ? /@smoke/
    : scenario === 'ui-quality'
      ? /@ui-quality|@mobile-required|@visual/
      : scenario === 'cross-browser'
        ? /@ui-quality/
        : undefined
const crossBrowser = process.env.E2E_CROSS_BROWSER === '1'
const systemChrome = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ?? (existsSync('/usr/bin/google-chrome') ? '/usr/bin/google-chrome' : undefined)
const localDataDir = process.env.E2E_LOCAL_DATA_DIR ?? join(tmpdir(), `memorag-web-e2e-${process.pid}`)
const ragGuardProfileJson = JSON.stringify({
  id: 'e2e-safe-rag',
  version: 'e2e-safe-rag-v1',
  guards: {
    authentication: true,
    authorization: true,
    classification_usage: true,
    prompt_injection: true,
    tool_policy: true,
    grounding: true,
    citation: true,
    output_secret: true,
    trace_redaction: true
  }
})

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  expect: {
    timeout: 10_000,
    toHaveScreenshot: { maxDiffPixels: 300 }
  },
  fullyParallel: false,
  workers: 1,
  retries: isCI ? 1 : 0,
  reporter: isCI ? [['github'], ['html', { open: 'never' }]] : [['list'], ['html', { open: 'never' }]],
  grep,
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure'
  },
  webServer: [
    {
      command: `NODE_ENV=test RAG_GUARD_PROFILE_JSON='${ragGuardProfileJson}' MEMORAG_ALLOW_LEGACY_LOCAL_STORE_FOR_TESTS=true LOCAL_DATA_DIR=${localDataDir} MOCK_BEDROCK=1 USE_LOCAL_VECTOR_STORE=1 USE_LOCAL_QUESTION_STORE=1 USE_LOCAL_CONVERSATION_HISTORY_STORE=1 USE_LOCAL_BENCHMARK_RUN_STORE=1 USE_LOCAL_CHAT_RUN_STORE=1 USE_LOCAL_DOCUMENT_INGEST_RUN_STORE=1 USE_LOCAL_DOCUMENT_GROUP_STORE=1 LOCAL_AUTH_USER_ID=local-dev LOCAL_AUTH_EMAIL=local@example.com LOCAL_AUTH_GROUPS=SYSTEM_ADMIN LOCAL_AUTH_ACCOUNT_STATUS=active LOCAL_AUTH_TENANT_ID=local-e2e BENCHMARK_EVALUATION_ENABLED=true BENCHMARK_EVALUATION_TENANT_ID=benchmark-e2e npm run start -w @memorag-mvp/api`,
      url: 'http://127.0.0.1:8787/health',
      reuseExistingServer: !isCI,
      timeout: 120_000
    },
    {
      command: 'VITE_API_BASE_URL=http://127.0.0.1:8787 VITE_AUTH_MODE=local npm run dev -w @memorag-mvp/web -- --host 127.0.0.1 --port 4173',
      url: 'http://127.0.0.1:4173',
      reuseExistingServer: !isCI,
      timeout: 120_000
    }
  ],
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: systemChrome ? { executablePath: systemChrome, args: ['--no-sandbox'] } : undefined
      }
    },
    ...(crossBrowser
      ? [
          { name: 'firefox-scheduled', use: { ...devices['Desktop Firefox'] } },
          { name: 'webkit-scheduled', use: { ...devices['Desktop Safari'] } }
        ]
      : [])
  ]
})
