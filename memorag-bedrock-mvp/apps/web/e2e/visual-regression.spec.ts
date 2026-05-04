import { expect, type Page, type Route, test } from '@playwright/test'

const permissions = [
  'chat:create',
  'chat:read:own',
  'chat:read:shared',
  'chat:share:own',
  'chat:delete:own',
  'chat:admin:read_all',
  'answer:edit',
  'answer:publish',
  'rag:doc:read',
  'rag:doc:write:group',
  'rag:doc:delete:group',
  'rag:index:rebuild:group',
  'benchmark:read',
  'benchmark:query',
  'benchmark:run',
  'benchmark:cancel',
  'benchmark:download',
  'usage:read:own',
  'usage:read:all_users',
  'cost:read:own',
  'cost:read:all',
  'user:create',
  'user:read',
  'user:suspend',
  'user:unsuspend',
  'user:delete',
  'access:role:create',
  'access:role:update',
  'access:role:assign',
  'access:policy:read'
]

const documents = [
  { documentId: 'doc-1', fileName: 'requirements.md', chunkCount: 8, memoryCardCount: 4, createdAt: '2026-05-01T00:00:00.000Z' },
  { documentId: 'doc-2', fileName: 'policy.md', chunkCount: 5, memoryCardCount: 2, createdAt: '2026-05-02T00:00:00.000Z' }
]

const debugTrace = {
  schemaVersion: 1,
  runId: 'visual-run-1',
  question: '製品コードは何ですか？',
  modelId: 'amazon.nova-lite-v1:0',
  embeddingModelId: 'amazon.titan-embed-text-v2:0',
  clueModelId: 'amazon.nova-lite-v1:0',
  topK: 6,
  memoryTopK: 4,
  minScore: 0.2,
  startedAt: '2026-05-02T00:00:00.000Z',
  completedAt: '2026-05-02T00:00:01.250Z',
  totalLatencyMs: 1250,
  status: 'success',
  answerPreview: '製品コードは MVP-2026 です。',
  isAnswerable: true,
  citations: [{ documentId: 'doc-1', fileName: 'requirements.md', chunkId: 'chunk-001', score: 0.94, text: '製品コードはMVP-2026です。' }],
  retrieved: [{ documentId: 'doc-1', fileName: 'requirements.md', chunkId: 'chunk-001', score: 0.94, text: '製品コードはMVP-2026です。' }],
  steps: [
    { id: 1, label: 'retrieve_memory', status: 'success', latencyMs: 25, summary: 'memoryを検索しました。', hitCount: 2, startedAt: '2026-05-02T00:00:00.000Z', completedAt: '2026-05-02T00:00:00.025Z' },
    { id: 2, label: 'answerability_gate', status: 'success', latencyMs: 1225, summary: '根拠ありです。', tokenCount: 12, startedAt: '2026-05-02T00:00:00.025Z', completedAt: '2026-05-02T00:00:01.250Z' }
  ]
}

async function installMockApi(page: Page) {
  await page.route('**/config.json', async (route) => {
    await route.fulfill({ json: { apiBaseUrl: 'http://api.visual.test' } })
  })

  const handleApiRoute = async (route: Route) => {
    const request = route.request()
    const url = new URL(request.url())
    const method = request.method()
    const path = url.pathname

    if (path === '/me') {
      await route.fulfill({ json: { user: { userId: 'visual-admin', email: 'visual@example.com', groups: ['SYSTEM_ADMIN'], permissions } } })
      return
    }
    if (path === '/documents') {
      if (method === 'GET') await route.fulfill({ json: { documents } })
      else await route.fulfill({ json: documents[0] })
      return
    }
    if (path === '/chat' && method === 'POST') {
      const body = JSON.parse(request.postData() ?? '{}')
      await route.fulfill({
        json: {
          answer: '製品コードは MVP-2026 です。',
          isAnswerable: true,
          citations: debugTrace.citations,
          retrieved: debugTrace.retrieved,
          debug: body.includeDebug ? debugTrace : undefined
        }
      })
      return
    }
    if (path === '/debug-runs') {
      await route.fulfill({ json: { debugRuns: [debugTrace] } })
      return
    }
    if (path === '/conversation-history') {
      if (method === 'GET') {
        await route.fulfill({ json: { history: [] } })
      } else {
        const body = JSON.parse(request.postData() ?? '{}')
        await route.fulfill({ json: { ...body, historyId: 'visual-history-1', createdAt: '2026-05-02T00:00:00.000Z', updatedAt: '2026-05-02T00:00:00.000Z' } })
      }
      return
    }
    if (path === '/questions') {
      await route.fulfill({
        json: {
          questions: [
            {
              questionId: 'question-1',
              title: '社内手続きについて確認したい',
              question: '申請期限の例外条件を確認してください。',
              requesterName: '山田 太郎',
              requesterDepartment: '利用部門',
              assigneeDepartment: '総務部',
              category: '手続き',
              priority: 'normal',
              status: 'open',
              sourceQuestion: '申請期限の例外条件は？',
              chatAnswer: '資料からは回答できません。',
              createdAt: '2026-05-02T00:00:00.000Z',
              updatedAt: '2026-05-02T00:00:00.000Z'
            }
          ]
        }
      })
      return
    }
    if (path === '/benchmark-suites') {
      await route.fulfill({ json: { suites: [{ suiteId: 'standard-agent-v1', label: 'Agent standard', mode: 'agent', datasetS3Key: 'datasets/agent/standard-v1.jsonl', preset: 'standard', defaultConcurrency: 1 }] } })
      return
    }
    if (path === '/benchmark-runs') {
      await route.fulfill({
        json: {
          benchmarkRuns: [
            {
              runId: 'bench-visual-1',
              suiteId: 'standard-agent-v1',
              status: 'succeeded',
              modelId: 'amazon.nova-lite-v1:0',
              startedAt: '2026-05-02T00:00:00.000Z',
              completedAt: '2026-05-02T00:01:00.000Z',
              metrics: { p50LatencyMs: 850, p95LatencyMs: 1400, answerableAccuracy: 0.92, retrievalRecallAt20: 0.88 }
            }
          ]
        }
      })
      return
    }
    if (path === '/admin/users') {
      await route.fulfill({ json: { users: [{ userId: 'visual-admin', email: 'visual@example.com', displayName: 'Visual Admin', status: 'active', groups: ['SYSTEM_ADMIN'], createdAt: '2026-05-02T00:00:00.000Z', updatedAt: '2026-05-02T00:00:00.000Z', lastLoginAt: '2026-05-02T00:00:00.000Z' }] } })
      return
    }
    if (path === '/admin/roles') {
      await route.fulfill({ json: { roles: [{ role: 'SYSTEM_ADMIN', permissions }] } })
      return
    }
    if (path === '/admin/audit-log') {
      await route.fulfill({ json: { auditLog: [{ auditId: 'audit-1', action: 'role:assign', actorUserId: 'visual-admin', actorEmail: 'visual@example.com', targetUserId: 'visual-admin', targetEmail: 'visual@example.com', beforeGroups: ['CHAT_USER'], afterGroups: ['SYSTEM_ADMIN'], createdAt: '2026-05-02T00:00:00.000Z' }] } })
      return
    }
    if (path === '/admin/usage') {
      await route.fulfill({ json: { users: [{ userId: 'visual-admin', email: 'visual@example.com', chatMessages: 12, conversationCount: 3, questionCount: 1, documentCount: 2, benchmarkRunCount: 1, debugRunCount: 1, lastActivityAt: '2026-05-02T00:00:00.000Z' }] } })
      return
    }
    if (path === '/admin/costs') {
      await route.fulfill({ json: { periodStart: '2026-05-01T00:00:00.000Z', periodEnd: '2026-05-02T00:00:00.000Z', currency: 'USD', totalEstimatedUsd: 0.0123, pricingCatalogUpdatedAt: '2026-05-02T00:00:00.000Z', users: [{ userId: 'visual-admin', email: 'visual@example.com', estimatedCostUsd: 0.0123 }], items: [{ service: 'Bedrock', category: 'chat completion', usage: 12, unit: 'message', unitCostUsd: 0.0008, estimatedCostUsd: 0.0096, confidence: 'estimated_usage' }] } })
      return
    }

    await route.fulfill({ json: {} })
  }

  await page.route('http://api.visual.test/**', handleApiRoute)
  await page.route('http://127.0.0.1:8787/**', handleApiRoute)
}

async function signIn(page: Page) {
  await page.goto('/')
  await page.getByPlaceholder('メールアドレスを入力').fill('visual@example.com')
  await page.getByPlaceholder('パスワードを入力').fill('LocalPassword123!')
  await page.getByRole('button', { name: 'サインイン' }).click()
  await expect(page.locator('section[aria-label="チャット"]')).toBeVisible()
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    const fixedTime = new Date('2026-05-02T00:00:00.000Z').valueOf()
    const RealDate = Date
    class FixedDate extends RealDate {
      constructor(value?: string | number | Date) {
        super(value ?? fixedTime)
      }

      static now() {
        return fixedTime
      }
    }
    window.Date = FixedDate as DateConstructor
  })
  await installMockApi(page)
})

test('ログイン画面の visual regression @visual', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('button', { name: 'サインイン' })).toBeVisible()
  await expect(page).toHaveScreenshot('login.png', { fullPage: true, animations: 'disabled' })
})

test('チャット空状態の visual regression @visual', async ({ page }) => {
  await signIn(page)
  await expect(page).toHaveScreenshot('chat-empty.png', { fullPage: true, animations: 'disabled' })
})

test('回答と引用表示の visual regression @visual', async ({ page }) => {
  await signIn(page)
  await page.getByLabel('質問').fill('製品コードは何ですか？')
  await page.getByRole('button', { name: '送信' }).click()
  await expect(page.getByText('製品コードは MVP-2026 です。')).toBeVisible()
  await expect(page.getByText('根拠ドキュメント')).toBeVisible()
  await expect(page).toHaveScreenshot('chat-answer-citations.png', { fullPage: true, animations: 'disabled' })
})

test('デバッグパネルの visual regression @visual', async ({ page }) => {
  await signIn(page)
  await page.getByRole('checkbox').check({ force: true })
  await page.getByLabel('質問').fill('製品コードは何ですか？')
  await page.getByTitle('送信').click()
  await expect(page.getByLabel('デバッグパネル')).toBeVisible()
  await expect(page.getByText('answerability_gate')).toBeVisible()
  await expect(page).toHaveScreenshot('debug-panel.png', { fullPage: true, animations: 'disabled' })
})

test('管理系画面の visual regression @visual', async ({ page }) => {
  await signIn(page)

  await page.getByTitle('ドキュメント').click()
  await expect(page.getByLabel('ドキュメント管理')).toBeVisible()
  await expect(page).toHaveScreenshot('documents-workspace.png', { fullPage: true, animations: 'disabled' })

  await page.getByTitle('担当者対応').click()
  await expect(page.getByLabel('担当者対応')).toBeVisible()
  await expect(page).toHaveScreenshot('assignee-workspace.png', { fullPage: true, animations: 'disabled' })

  await page.getByTitle('性能テスト').click()
  await expect(page.getByLabel('性能テスト')).toBeVisible()
  await expect(page).toHaveScreenshot('benchmark-workspace.png', { fullPage: true, animations: 'disabled' })

  await page.getByTitle('管理者設定').click()
  await expect(page.getByLabel('管理者設定')).toBeVisible()
  await expect(page).toHaveScreenshot('admin-workspace.png', { fullPage: true, animations: 'disabled' })
})

test('モバイル幅チャットの visual regression @visual', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await signIn(page)
  await expect(page).toHaveScreenshot('chat-empty-mobile.png', { fullPage: true, animations: 'disabled' })
})
