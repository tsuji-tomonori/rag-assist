import { expect, type Page, type Route, test } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

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

function benchmarkRun(index: number) {
  return {
    runId: `bench-visual-${String(index).padStart(2, '0')}`,
    suiteId: 'standard-agent-v1',
    status: index % 5 === 0 ? 'failed' : 'succeeded',
    mode: 'agent',
    runner: 'codebuild',
    datasetS3Key: 'datasets/agent/standard-v1.jsonl',
    createdBy: 'visual-admin',
    createdAt: `2026-05-02T00:${String(index).padStart(2, '0')}:00.000Z`,
    updatedAt: `2026-05-02T00:${String(index).padStart(2, '0')}:30.000Z`,
    modelId: 'amazon.nova-lite-v1:0',
    startedAt: `2026-05-02T00:${String(index).padStart(2, '0')}:00.000Z`,
    completedAt: `2026-05-02T00:${String(index).padStart(2, '0')}:30.000Z`,
    metrics: {
      p50LatencyMs: 800 + index,
      p95LatencyMs: 1400 + index,
      answerableAccuracy: 0.92,
      retrievalRecallAt20: 0.88
    }
  }
}

async function installMockApi(page: Page) {
  let includeDebugForChatRun = false

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
    if (path === '/document-groups') {
      await route.fulfill({ json: { groups: [] } })
      return
    }
    if (path === '/documents/reindex-migrations') {
      await route.fulfill({ json: { migrations: [] } })
      return
    }
    if (path === '/rpc/chat/startRun' && method === 'POST') {
      const rpcBody = JSON.parse(request.postData() ?? '{}')
      const body = rpcBody.json ?? rpcBody
      includeDebugForChatRun = body.includeDebug === true
      await route.fulfill({
        json: {
          json: {
            runId: 'visual-chat-run',
            status: 'queued',
            eventsPath: '/chat-runs/visual-chat-run/events'
          }
        }
      })
      return
    }
    if (path === '/chat-runs/visual-chat-run/events' && method === 'GET') {
      const finalResult = {
        answer: '製品コードは MVP-2026 です。',
        isAnswerable: true,
        citations: debugTrace.citations,
        retrieved: debugTrace.retrieved,
        debug: includeDebugForChatRun ? debugTrace : undefined
      }
      await route.fulfill({
        contentType: 'text/event-stream',
        body: `id: 1\nevent: final\ndata: ${JSON.stringify(finalResult)}\n\n`
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
      if (method === 'POST') {
        await route.fulfill({
          json: {
            runId: 'bench-visual-created',
            suiteId: 'standard-agent-v1',
            status: 'queued',
            mode: 'agent',
            runner: 'codebuild',
            datasetS3Key: 'datasets/agent/standard-v1.jsonl',
            createdBy: 'visual-admin',
            modelId: 'amazon.nova-lite-v1:0',
            createdAt: '2026-05-02T00:00:00.000Z',
            updatedAt: '2026-05-02T00:00:00.000Z'
          }
        })
        return
      }

      await route.fulfill({
        json: {
          benchmarkRuns: [
            {
              runId: 'bench-visual-1',
              suiteId: 'standard-agent-v1',
              status: 'succeeded',
              mode: 'agent',
              runner: 'codebuild',
              datasetS3Key: 'datasets/agent/standard-v1.jsonl',
              createdBy: 'visual-admin',
              modelId: 'amazon.nova-lite-v1:0',
              createdAt: '2026-05-02T00:00:00.000Z',
              updatedAt: '2026-05-02T00:01:00.000Z',
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

async function installCurrentUserPermissions(page: Page, grantedPermissions: string[]) {
  await page.route(/http:\/\/(api\.visual\.test|127\.0\.0\.1:8787)\/me$/, async (route) => {
    await route.fulfill({
      json: {
        user: {
          userId: 'visual-user',
          email: 'visual@example.com',
          groups: [],
          permissions: grantedPermissions
        }
      }
    })
  })
}

async function installBenchmarkRuns(page: Page, count: number) {
  const benchmarkRuns = Array.from({ length: count }, (_, index) => benchmarkRun(index + 1))

  await page.route(/http:\/\/(api\.visual\.test|127\.0\.0\.1:8787)\/benchmark-runs$/, async (route) => {
    if (route.request().method() === 'POST') {
      await route.fulfill({
        json: {
          runId: 'bench-visual-created',
          suiteId: 'standard-agent-v1',
          status: 'queued',
          mode: 'agent',
          runner: 'codebuild',
          datasetS3Key: 'datasets/agent/standard-v1.jsonl',
          createdBy: 'visual-admin',
          modelId: 'amazon.nova-lite-v1:0',
          createdAt: '2026-05-02T00:00:00.000Z',
          updatedAt: '2026-05-02T00:00:00.000Z'
        }
      })
      return
    }

    await route.fulfill({ json: { benchmarkRuns } })
  })
}

async function installRiskyOperationApi(page: Page) {
  let historyAvailable = true
  const requests = {
    historyDelete: false,
    documentShare: null as unknown,
    benchmarkCancel: false,
    aliasPublish: false
  }
  const riskDocument = {
    detailLevel: 'manager',
    documentId: 'doc-risk-1',
    fileName: 'risk-policy.md',
    chunkCount: 3,
    memoryCardCount: 2,
    createdAt: '2026-05-01T00:00:00.000Z',
    updatedAt: '2026-05-02T00:00:00.000Z',
    currentUserEffectivePermission: 'full',
    capabilities: {
      canRead: true,
      canShare: true,
      canMove: false,
      canDelete: true,
      canReindex: true
    }
  }
  const runningBenchmark = {
    runId: 'bench-risk-1',
    suiteId: 'standard-agent-v1',
    status: 'running',
    mode: 'agent',
    runner: 'codebuild',
    datasetS3Key: 'datasets/agent/standard-v1.jsonl',
    createdBy: 'risk-admin',
    modelId: 'amazon.nova-lite-v1:0',
    createdAt: '2026-05-02T00:00:00.000Z',
    updatedAt: '2026-05-02T00:00:30.000Z',
    startedAt: '2026-05-02T00:00:00.000Z'
  }
  const approvedAlias = {
    aliasId: 'alias-risk-1',
    term: 'pto',
    expansions: ['有給休暇'],
    status: 'approved',
    createdBy: 'risk-admin',
    createdAt: '2026-05-01T00:00:00.000Z',
    updatedAt: '2026-05-02T00:00:00.000Z'
  }

  await page.route(/http:\/\/(?:api\.visual\.test|127\.0\.0\.1:8787)\/.*/, async (route) => {
    const request = route.request()
    const path = new URL(request.url()).pathname
    const method = request.method()

    if (path === '/conversation-history' && method === 'GET') {
      await route.fulfill({
        json: {
          history: historyAvailable
            ? [{
                schemaVersion: 1,
                id: 'risk-history-1',
                title: 'Risk review conversation',
                updatedAt: '2026-05-02T00:00:00.000Z',
                messages: [{ role: 'user', text: '削除前に確認してください。', createdAt: '2026-05-02T00:00:00.000Z' }]
              }]
            : []
        }
      })
      return
    }
    if (path === '/conversation-history/risk-history-1' && method === 'DELETE') {
      requests.historyDelete = true
      historyAvailable = false
      await route.fulfill({ status: 204 })
      return
    }
    if (path === '/documents' && method === 'GET') {
      await route.fulfill({ json: { documents: [riskDocument] } })
      return
    }
    if (path === '/documents/doc-risk-1/share' && method === 'GET') {
      await route.fulfill({
        json: {
          inheritedFolderGrants: [],
          directDocumentGrants: [],
          currentUserEffectivePermission: 'full',
          version: 'document-share-v1'
        }
      })
      return
    }
    if (path === '/documents/doc-risk-1/share' && method === 'PUT') {
      requests.documentShare = request.postDataJSON()
      await route.fulfill({
        json: {
          inheritedFolderGrants: [],
          directDocumentGrants: [{
            documentShareGrantId: 'grant-risk-1',
            tenantId: 'default',
            documentId: 'doc-risk-1',
            principalType: 'group',
            principalId: 'risk-reviewers',
            permissionLevel: 'readOnly',
            createdBy: 'risk-admin',
            reason: 'レビュー担当者へ共有',
            createdAt: '2026-05-02T00:00:00.000Z',
            updatedAt: '2026-05-02T00:01:00.000Z'
          }],
          currentUserEffectivePermission: 'full',
          version: 'document-share-v2'
        }
      })
      return
    }
    if (path === '/benchmark-runs' && method === 'GET') {
      await route.fulfill({ json: { benchmarkRuns: [runningBenchmark] } })
      return
    }
    if (path === '/benchmark-runs/bench-risk-1/cancel' && method === 'POST') {
      requests.benchmarkCancel = true
      await route.fulfill({
        json: {
          ...runningBenchmark,
          status: 'cancelled',
          updatedAt: '2026-05-02T00:01:00.000Z',
          completedAt: '2026-05-02T00:01:00.000Z'
        }
      })
      return
    }
    if (path === '/admin/aliases' && method === 'GET') {
      await route.fulfill({ json: { aliases: [approvedAlias] } })
      return
    }
    if (path === '/admin/aliases/audit-log' && method === 'GET') {
      await route.fulfill({ json: { auditLog: [] } })
      return
    }
    if (path === '/admin/aliases/publish' && method === 'POST') {
      requests.aliasPublish = true
      await route.fulfill({ json: { version: 'alias-risk-v2', publishedAt: '2026-05-02T00:02:00.000Z', aliasCount: 1 } })
      return
    }

    await route.fallback()
  })

  return requests
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
  await page.getByRole('textbox', { name: '質問', exact: true }).fill('製品コードは何ですか？')
  await page.getByRole('button', { name: '送信' }).click()
  await expect(page.getByText('製品コードは MVP-2026 です。')).toBeVisible()
  await expect(page.getByText('参照元')).toBeVisible()
  await expect(page).toHaveScreenshot('chat-answer-citations.png', { fullPage: true, animations: 'disabled' })
})

test('デバッグパネルの visual regression @visual', async ({ page }) => {
  await signIn(page)
  await page.getByRole('checkbox').check({ force: true })
  await page.getByRole('textbox', { name: '質問', exact: true }).fill('製品コードは何ですか？')
  await page.getByTitle('送信').click()
  await expect(page.getByRole('complementary', { name: 'デバッグパネル', exact: true })).toBeVisible()
  await expect(page.getByText('回答可否判定')).toBeVisible()
  await expect(page).toHaveScreenshot('debug-panel.png', { fullPage: true, animations: 'disabled' })
})

test('管理系画面の visual regression @visual', async ({ page }) => {
  await signIn(page)

  await page.getByTitle('ドキュメント').click()
  await expect(page.getByRole('region', { name: 'ドキュメント管理', exact: true })).toBeVisible()
  await expect(page).toHaveScreenshot('documents-workspace.png', { fullPage: true, animations: 'disabled' })

  await page.getByTitle('担当者対応').click()
  await expect(page.getByRole('region', { name: '担当者対応', exact: true })).toBeVisible()
  await expect(page).toHaveScreenshot('assignee-workspace.png', { fullPage: true, animations: 'disabled' })

  await page.getByTitle('性能テスト').click()
  await expect(page.getByRole('region', { name: '性能テスト', exact: true })).toBeVisible()
  await expect(page).toHaveScreenshot('benchmark-workspace.png', { fullPage: true, animations: 'disabled' })

  await page.getByTitle('管理者設定').click()
  await expect(page.getByRole('region', { name: '管理者設定', exact: true })).toBeVisible()
  await expect(page).toHaveScreenshot('admin-workspace.png', { fullPage: true, animations: 'disabled' })
})

test('E2E-UI-SEMANTIC-001: 状態表示と確認ダイアログは axe 違反を生じない @semantic-ui', async ({ page }) => {
  await signIn(page)
  await page.getByTitle('性能テスト').click()
  await expect(page.locator('.benchmark-workspace .ui-status-badge')).toBeVisible()

  const statusScan = await new AxeBuilder({ page }).include('.benchmark-workspace .ui-status-badge').analyze()
  expect(statusScan.violations, JSON.stringify(statusScan.violations, null, 2)).toEqual([])

  await page.getByRole('button', { name: '性能テストを実行' }).click()
  await expect(page.getByRole('dialog', { name: '性能テストを実行しますか？' })).toBeVisible()
  const dialogScan = await new AxeBuilder({ page }).include('.confirm-dialog').analyze()
  expect(dialogScan.violations, JSON.stringify(dialogScan.violations, null, 2)).toEqual([])
})

test('E2E-UI-RISK-001: 高影響操作は対象・影響・回復条件と API 根拠を表示する @risky-operation', async ({ page }) => {
  await installCurrentUserPermissions(page, [
    ...permissions,
    'rag:alias:read',
    'rag:alias:publish:group'
  ])
  const requestedOperations = await installRiskyOperationApi(page)
  await signIn(page)

  await test.step('会話履歴削除は確認内容を示し、API 確定後にだけ対象を除去する', async () => {
    await page.getByTitle('履歴').click()
    await expect(page.getByRole('region', { name: '履歴', exact: true })).toBeVisible()
    await page.getByRole('button', { name: '削除', exact: true }).click()
    const dialog = page.getByRole('dialog', { name: 'この会話履歴を削除しますか？' })
    await expect(dialog.getByText('対象', { exact: true })).toBeVisible()
    await expect(dialog.getByText('Risk review conversation', { exact: true })).toBeVisible()
    await expect(dialog.getByText('影響', { exact: true })).toBeVisible()
    await expect(dialog.getByText('この会話履歴と画面から参照するメッセージを削除します', { exact: true })).toBeVisible()
    await expect(dialog.getByText('回復条件', { exact: true })).toBeVisible()
    await expect(dialog.getByText('この画面からは復元できません', { exact: true })).toBeVisible()
    await dialog.getByRole('button', { name: '削除', exact: true }).click()

    const feedback = page.getByRole('status', { name: '会話履歴削除: Risk review conversation' })
    await expect(feedback).toContainText('完了')
    await expect(feedback).toContainText('risk-history-1')
    await expect(page.locator('.history-item', { hasText: 'Risk review conversation' })).toHaveCount(0)
    expect(requestedOperations.historyDelete).toBe(true)
  })

  await test.step('文書共有は理由と policy version を対象に紐づける', async () => {
    await page.getByTitle('ドキュメント').click()
    await expect(page.getByRole('region', { name: 'ドキュメント管理', exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'risk-policy.mdを共有' }).click()
    const dialog = page.getByRole('dialog', { name: 'ファイル共有' })
    await expect(dialog.getByText('現在の権限: 管理可能')).toBeVisible()
    await dialog.getByLabel('共有先種別').selectOption('group')
    await dialog.getByLabel('共有先識別子（管理者向け）').fill('risk-reviewers')
    await dialog.getByLabel('理由').fill('レビュー担当者へ共有')
    await dialog.getByRole('button', { name: '保存' }).click()

    const feedback = page.getByRole('status', { name: '文書共有更新: risk-policy.md' })
    await expect(feedback).toContainText('完了')
    await expect(feedback).toContainText('レビュー担当者へ共有')
    await expect(feedback).toContainText('document-share-v2')
    expect(requestedOperations.documentShare).toEqual({
      grants: [{ principalType: 'group', principalId: 'risk-reviewers', permissionLevel: 'readOnly' }],
      expectedVersion: 'document-share-v1',
      reason: 'レビュー担当者へ共有'
    })
  })

  await test.step('性能テスト取消は実行識別子を保持し、API の取消結果を表示する', async () => {
    await page.getByTitle('性能テスト').click()
    await expect(page.getByRole('region', { name: '性能テスト', exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'bench-risk-1のジョブをキャンセル' }).click()
    const dialog = page.getByRole('dialog', { name: 'この性能テストを取り消しますか？' })
    await expect(dialog.getByText('実行識別子', { exact: true })).toBeVisible()
    await expect(dialog.getByText('bench-risk-1', { exact: true })).toBeVisible()
    await expect(dialog.getByText('影響', { exact: true })).toBeVisible()
    await expect(dialog.getByText('未完了の測定と成果物生成を停止します', { exact: true })).toBeVisible()
    await expect(dialog.getByText('回復条件', { exact: true })).toBeVisible()
    await expect(dialog.getByText('取消後は再開できず、新しい実行が必要です', { exact: true })).toBeVisible()
    await dialog.getByRole('button', { name: '取り消す' }).click()

    const feedback = page.getByRole('status', { name: '性能テスト取消: Agent standard' })
    await expect(feedback).toContainText('完了')
    await expect(feedback).toContainText('risk-admin')
    await expect(feedback).toContainText('bench-risk-1')
    expect(requestedOperations.benchmarkCancel).toBe(true)
  })

  await test.step('用語展開公開は不可逆性を示し、API version を結果根拠として表示する', async () => {
    await page.getByTitle('管理者設定').click()
    await expect(page.getByRole('region', { name: '管理者設定', exact: true })).toBeVisible()
    await page.getByRole('button', { name: '用語展開', exact: true }).click()
    await page.getByRole('button', { name: '公開', exact: true }).click()
    const dialog = page.getByRole('dialog', { name: '用語展開を公開しますか？' })
    await expect(dialog.getByText('影響', { exact: true })).toBeVisible()
    await expect(dialog.getByText('公開後の検索結果が変わる可能性があります', { exact: true })).toBeVisible()
    await expect(dialog.getByText('回復条件', { exact: true })).toBeVisible()
    await expect(dialog.getByText('以前の公開版へ戻す操作は現行 API で未提供です', { exact: true })).toBeVisible()
    await dialog.getByRole('button', { name: '公開', exact: true }).click()

    const feedback = page.getByRole('status', { name: '用語展開公開: 承認済み 1 件' })
    await expect(feedback).toContainText('完了')
    await expect(feedback).toContainText('alias-risk-v2')
    expect(requestedOperations.aliasPublish).toBe(true)

    const feedbackScan = await new AxeBuilder({ page }).include('.operation-feedback').analyze()
    expect(feedbackScan.violations, JSON.stringify(feedbackScan.violations, null, 2)).toEqual([])
  })
})

test('全 AppView の permission-aware 到達性 @smoke', async ({ page }) => {
  await signIn(page)

  const viewSteps = [
    { id: 'E2E-VIEW-CHAT-001', trigger: null, region: 'チャット' },
    { id: 'E2E-VIEW-DOCUMENTS-001', trigger: 'ドキュメント', region: 'ドキュメント管理' },
    { id: 'E2E-VIEW-ASSIGNEE-001', trigger: '担当者対応', region: '担当者対応' },
    { id: 'E2E-VIEW-BENCHMARK-001', trigger: '性能テスト', region: '性能テスト' },
    { id: 'E2E-VIEW-ADMIN-001', trigger: '管理者設定', region: '管理者設定' },
    { id: 'E2E-VIEW-HISTORY-001', trigger: '履歴', region: '履歴' },
    { id: 'E2E-VIEW-FAVORITES-001', trigger: 'お気に入り', region: 'お気に入り' },
    { id: 'E2E-VIEW-PROFILE-001', trigger: '個人設定', region: '個人設定' }
  ] as const

  for (const viewStep of viewSteps) {
    await test.step(`${viewStep.id}: ${viewStep.region} view を表示する`, async () => {
      if (viewStep.trigger === '個人設定') await page.getByRole('button', { name: viewStep.trigger }).click()
      else if (viewStep.trigger) await page.getByTitle(viewStep.trigger).click()
      await expect(page.getByRole('region', { name: viewStep.region, exact: true })).toBeVisible()
    })
  }
})

test('E2E-UI-NAV-002: 最大権限 persona は 320px mobile menu から全許可 view と個人設定へ到達する @smoke', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 720 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await signIn(page)

  const openMenu = () => page.getByRole('button', { name: 'メニューを開く' })
  await openMenu().focus()
  await page.keyboard.press('Enter')
  const mobileNavigation = page.getByRole('navigation', { name: 'モバイル画面' })
  await expect(mobileNavigation.getByRole('button', { name: 'チャット' })).toHaveAttribute('aria-current', 'page')
  await expect(mobileNavigation.getByRole('button', { name: 'チャット' })).toBeFocused()
  await expect(page).toHaveScreenshot('mobile-navigation-320.png', {
    fullPage: true,
    animations: 'disabled'
  })

  await page.keyboard.press('Escape')
  await expect(openMenu()).toBeFocused()

  const destinations = [
    { label: '担当者対応', region: '担当者対応' },
    { label: '履歴', region: '履歴' },
    { label: '性能テスト', region: '性能テスト' },
    { label: 'お気に入り', region: 'お気に入り' },
    { label: 'ドキュメント', region: 'ドキュメント管理' },
    { label: '管理者設定', region: '管理者設定' },
    { label: '個人設定', region: '個人設定' }
  ] as const

  for (const destination of destinations) {
    await openMenu().click()
    const panel = page.getByRole('navigation', { name: 'モバイル画面' })
    const destinationButton = destination.label === '個人設定'
      ? page.locator('.mobile-navigation-panel').getByRole('button', { name: destination.label })
      : panel.getByRole('button', { name: destination.label })
    await destinationButton.click()
    await expect(page.getByRole('region', { name: destination.region, exact: true })).toBeVisible()
    await expect(openMenu()).toBeFocused()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true)
  }

  await page.setViewportSize({ width: 375, height: 720 })
  await openMenu().click()
  await expect(page.getByRole('navigation', { name: 'モバイル画面' })).toBeVisible()
  await expect(page.locator('.mobile-navigation-panel').getByRole('button', { name: '個人設定' })).toBeVisible()
})

test('E2E-UI-NAV-001: standard user は権限外 destination を表示せず許可済み view へ到達する @smoke', async ({ page }) => {
  await installCurrentUserPermissions(page, ['chat:create', 'chat:read:own'])
  await page.setViewportSize({ width: 320, height: 720 })
  await signIn(page)

  await page.getByRole('button', { name: 'メニューを開く' }).click()
  const panel = page.getByRole('navigation', { name: 'モバイル画面' })
  await expect(panel.getByRole('button', { name: 'チャット' })).toBeVisible()
  await expect(panel.getByRole('button', { name: '履歴' })).toBeVisible()
  await expect(panel.getByRole('button', { name: 'お気に入り' })).toBeVisible()
  await expect(page.locator('.mobile-navigation-panel').getByRole('button', { name: '個人設定' })).toBeVisible()
  await expect(panel.getByRole('button', { name: '担当者対応' })).toHaveCount(0)
  await expect(panel.getByRole('button', { name: '性能テスト' })).toHaveCount(0)
  await expect(panel.getByRole('button', { name: 'ドキュメント' })).toHaveCount(0)
  await expect(panel.getByRole('button', { name: '管理者設定' })).toHaveCount(0)

  await page.keyboard.press('Escape')
  const destinations = [
    { label: '履歴', region: '履歴' },
    { label: 'お気に入り', region: 'お気に入り' },
    { label: '個人設定', region: '個人設定' }
  ] as const

  for (const destination of destinations) {
    await page.getByRole('button', { name: 'メニューを開く' }).click()
    const menuPanel = page.locator('.mobile-navigation-panel')
    await menuPanel.getByRole('button', { name: destination.label }).click()
    await expect(page.getByRole('region', { name: destination.region, exact: true })).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true)
  }
})

test('E2E-UI-ROUTE-001: view navigation は back・forward・reload で復元する @smoke', async ({ page }) => {
  await signIn(page)

  await page.getByTitle('履歴').click()
  await expect(page).toHaveURL(/\?view=history$/)
  await expect(page.getByRole('region', { name: '履歴', exact: true })).toBeVisible()

  await page.getByTitle('お気に入り').click()
  await expect(page).toHaveURL(/\?view=favorites$/)
  await expect(page.getByRole('region', { name: 'お気に入り', exact: true })).toBeVisible()

  await page.goBack()
  await expect(page).toHaveURL(/\?view=history$/)
  await expect(page.getByRole('region', { name: '履歴', exact: true })).toBeVisible()

  await page.goForward()
  await expect(page).toHaveURL(/\?view=favorites$/)
  await page.reload()
  await expect(page.getByRole('region', { name: 'お気に入り', exact: true })).toBeVisible()

  await page.goto('/documents?query=policy&sort=fileNameAsc')
  await expect(page.getByRole('region', { name: 'ドキュメント管理', exact: true })).toBeVisible()
  await page.reload()
  await expect(page).toHaveURL(/\/documents\?query=policy&sort=fileNameAsc$/)
  await expect(page.getByRole('region', { name: 'ドキュメント管理', exact: true })).toBeVisible()
})

test('E2E-UI-ROUTE-002: denied・invalid deep link は protected fetch なしで正規化する @smoke', async ({ page }) => {
  await installCurrentUserPermissions(page, ['chat:create', 'chat:read:own'])
  const protectedRequests: string[] = []
  page.on('request', (request) => {
    const pathname = new URL(request.url()).pathname
    if (pathname.startsWith('/admin/')) protectedRequests.push(pathname)
  })
  await signIn(page)

  await page.goto('/?view=admin')
  await expect(page.getByRole('alert')).toContainText('表示する権限を確認できなかった')
  await expect(page.getByRole('region', { name: 'チャット', exact: true })).toBeVisible()
  await expect(page).toHaveURL(/\/$/)
  expect(protectedRequests).toEqual([])

  await page.goto('/?view=obsolete')
  await expect(page.getByRole('status')).toContainText('URLの画面指定を確認できなかった')
  await expect(page.getByRole('region', { name: 'チャット', exact: true })).toBeVisible()
  await expect(page).toHaveURL(/\/$/)

  await page.goto('/?view=history&unknown=value')
  await expect(page.getByRole('status')).toContainText('URLの画面指定を確認できなかった')
  await expect(page.getByRole('region', { name: '履歴', exact: true })).toBeVisible()
  await expect(page).toHaveURL(/\?view=history$/)
})

test('E2E-UI-STATE-001: loading・500・empty・retry recovery を対象 region で区別する @smoke', async ({ page }) => {
  let historyReads = 0
  let releaseFirstRead: (() => void) | undefined
  const firstReadGate = new Promise<void>((resolve) => { releaseFirstRead = resolve })
  await page.route(/http:\/\/(api\.visual\.test|127\.0\.0\.1:8787)\/conversation-history$/, async (route) => {
    if (route.request().method() !== 'GET') {
      await route.fallback()
      return
    }
    historyReads += 1
    if (historyReads === 1) {
      await firstReadGate
      await route.fulfill({ status: 500, contentType: 'text/plain', body: 'RequestId: private-id at InternalHistory (/srv/history.ts:10)' })
      return
    }
    await route.fulfill({ json: { history: [] } })
  })

  await signIn(page)
  await page.getByTitle('履歴').click()
  const historyRegion = page.getByRole('region', { name: '履歴', exact: true })
  const dataRegion = page.locator('#history-resource-region')
  await expect(dataRegion).toHaveAttribute('aria-busy', 'true')
  await expect(historyRegion).toContainText('会話履歴を読み込んでいます')
  await expect(historyRegion).not.toContainText('0 件の会話')

  releaseFirstRead?.()
  const errorState = historyRegion.locator('[data-state-kind="error"]')
  await expect(errorState).toContainText('会話履歴を取得できませんでした')
  await expect(errorState).not.toContainText('private-id')
  await expect(historyRegion).not.toContainText('0 件の会話')

  await errorState.getByRole('button', { name: '再試行' }).click()
  await expect(historyRegion.locator('[data-state-kind="recovered"]')).toContainText('会話履歴を更新しました')
  await expect(historyRegion).toContainText('条件に一致する履歴はありません')
  await expect(historyRegion).toContainText('0 件の会話')
  expect(historyReads).toBe(2)
})

test('E2E-UI-STATE-001: HTTP 403 は empty/zero ではなく permission denied として content を隠す @smoke', async ({ page }) => {
  await page.route(/http:\/\/(api\.visual\.test|127\.0\.0\.1:8787)\/conversation-history$/, async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({ status: 403, contentType: 'text/plain', body: 'forbidden private history id' })
      return
    }
    await route.fallback()
  })

  await signIn(page)
  await page.getByTitle('履歴').click()
  const historyRegion = page.getByRole('region', { name: '履歴', exact: true })
  const permissionState = historyRegion.locator('[data-state-kind="permission"]')
  await expect(permissionState).toHaveAttribute('role', 'alert')
  await expect(permissionState).toContainText('会話履歴を表示できません')
  await expect(permissionState).not.toContainText('private history id')
  await expect(historyRegion).not.toContainText('0 件の会話')
  await expect(page.locator('#history-resource-region')).not.toContainText('条件に一致する履歴はありません')
})

test('E2E-UI-STATE-001: admin partial success は成功・失敗 part を分けて retry recovery する @smoke', async ({ page }) => {
  let auditReads = 0
  await page.route(/http:\/\/(api\.visual\.test|127\.0\.0\.1:8787)\/admin\/audit-log$/, async (route) => {
    auditReads += 1
    if (auditReads === 1) {
      await route.fulfill({ status: 500, contentType: 'text/plain', body: 'audit unavailable' })
      return
    }
    await route.fallback()
  })

  await signIn(page)
  await page.getByTitle('管理者設定').click()
  const adminRegion = page.getByRole('region', { name: '管理者設定', exact: true })
  const partialState = adminRegion.locator('[data-state-kind="partial"]')
  await expect(partialState).toContainText('管理者設定の一部を取得できませんでした')
  await expect(partialState).toContainText('取得済み')
  await expect(partialState).toContainText('管理対象ユーザー')
  await expect(partialState).toContainText('未更新')
  await expect(partialState).toContainText('管理操作履歴')

  await adminRegion.getByRole('button', { name: '監査' }).click()
  await expect(adminRegion).toContainText('管理操作履歴を取得できませんでした')
  await expect(adminRegion).not.toContainText('0 件')

  await partialState.getByRole('button', { name: '失敗した項目を再試行' }).click()
  await expect(adminRegion.locator('[data-state-kind="recovered"]')).toContainText('管理者設定を更新しました')
  await expect(adminRegion).toContainText('role:assign')
  expect(auditReads).toBe(2)
})

test('E2E-UI-STATE-001: refresh failure は as-of/source 付き stale data を保持して回復する @smoke', async ({ page }) => {
  const refreshCounts = new Map<string, number>()
  await page.route(/http:\/\/(api\.visual\.test|127\.0\.0\.1:8787)\/admin\/(users|roles|audit-log|usage|costs)$/, async (route) => {
    const path = new URL(route.request().url()).pathname
    const count = (refreshCounts.get(path) ?? 0) + 1
    refreshCounts.set(path, count)
    if (count === 2) {
      await route.fulfill({ status: 500, contentType: 'text/plain', body: 'temporary refresh failure' })
      return
    }
    await route.fallback()
  })

  await signIn(page)
  await page.getByTitle('管理者設定').click()
  const adminRegion = page.getByRole('region', { name: '管理者設定', exact: true })
  await adminRegion.getByRole('button', { name: 'ユーザー' }).click()
  await expect(adminRegion).toContainText('Visual Admin')
  await adminRegion.getByRole('button', { name: '更新', exact: true }).click()

  const staleState = adminRegion.locator('[data-state-kind="stale"]')
  await expect(staleState).toContainText('管理者設定は最新ではありません')
  await expect(staleState).toContainText('source: 管理 API')
  await expect(staleState.locator('time')).toHaveAttribute('dateTime', '2026-05-02T00:00:00.000Z')
  await expect(adminRegion).toContainText('Visual Admin')

  await staleState.getByRole('button', { name: '最新情報を取得' }).click()
  await expect(adminRegion.locator('[data-state-kind="recovered"]')).toContainText('管理者設定を更新しました')
  await expect(adminRegion).toContainText('Visual Admin')
})

test('性能テストの実行ボタンがサマリーに重ならずクリックできる @smoke', async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 900 })
  await signIn(page)

  await page.getByTitle('性能テスト').click()
  await expect(page.getByLabel('性能テスト')).toBeVisible()

  const startButton = page.getByRole('button', { name: '性能テストを実行' })
  const summaryPanel = page.locator('.benchmark-kpi-grid')
  await expect(startButton).toBeVisible()

  const [startBox, summaryBox] = await Promise.all([
    startButton.boundingBox(),
    summaryPanel.boundingBox()
  ])
  expect(startBox).not.toBeNull()
  expect(summaryBox).not.toBeNull()
  expect((summaryBox?.y ?? 0) + (summaryBox?.height ?? 0)).toBeLessThanOrEqual(startBox?.y ?? 0)

  const startRequest = page.waitForRequest((request) => {
    const url = new URL(request.url())
    return request.method() === 'POST' && url.pathname === '/benchmark-runs'
  })
  await startButton.click()
  await page.getByRole('dialog', { name: '性能テストを実行しますか？' }).getByRole('button', { name: '実行', exact: true }).click()
  await startRequest
  await expect(page.getByText('bench-visual-created', { exact: true })).toBeVisible()
})

test('性能テスト履歴が多い場合もテーブル内で縦スクロールする @smoke', async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 900 })
  await installBenchmarkRuns(page, 16)
  await signIn(page)

  await page.getByTitle('性能テスト').click()
  await expect(page.getByLabel('性能テスト')).toBeVisible()
  await expect(page.getByText('bench-visual-16', { exact: true })).toBeVisible()

  const historyPanel = page.locator('.benchmark-history-panel')
  const tableWrap = page.locator('.benchmark-table-wrap')
  const [historyBox, tableScroll] = await Promise.all([
    historyPanel.boundingBox(),
    tableWrap.evaluate((element) => ({ clientHeight: element.clientHeight, scrollHeight: element.scrollHeight }))
  ])

  expect(historyBox).not.toBeNull()
  expect(historyBox?.height ?? 0).toBeLessThanOrEqual(380)
  expect(tableScroll.scrollHeight).toBeGreaterThan(tableScroll.clientHeight)
})

test('モバイル幅チャットの visual regression @visual', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await signIn(page)
  await expect(page).toHaveScreenshot('chat-empty-mobile.png', { fullPage: true, animations: 'disabled' })
})
