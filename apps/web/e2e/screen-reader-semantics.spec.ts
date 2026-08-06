import { expect, type Page, type TestInfo, test } from '@playwright/test'

type AccessibilityContractNode = {
  role: string
  name: string
  value: string
  checked: string
}

type ExpectedNode = {
  role: string
  name?: string
  value?: string
  checked?: string
}

const evidenceRoles = new Set([
  'alert',
  'button',
  'checkbox',
  'combobox',
  'complementary',
  'form',
  'heading',
  'main',
  'navigation',
  'region',
  'searchbox',
  'spinbutton',
  'status',
  'table',
  'textbox'
])

test('E2E-UI-SR-SEMANTICS-001: representative views expose stable Chromium accessibility tree contracts @smoke @ui-quality', async ({ page }, testInfo) => {
  await installHistoryRoute(page)
  await installBenchmarkRoutes(page)
  await page.goto('/')
  await expect(page.getByRole('heading', { name: '社内QAチャットボット' })).toBeVisible()

  await expectAccessibilityContract(page, testInfo, 'login', [
    { role: 'heading', name: '社内QAチャットボット' },
    { role: 'form', name: 'Cognitoで安全にサインイン' },
    { role: 'textbox', name: 'メールアドレス' },
    { role: 'textbox', name: 'パスワード' },
    { role: 'button', name: 'サインイン' }
  ])

  await signIn(page)
  await expectAccessibilityContract(page, testInfo, 'chat', [
    { role: 'main' },
    { role: 'heading', name: '社内QAチャットボットエージェント' },
    { role: 'navigation', name: '画面' },
    { role: 'region', name: 'チャット' },
    { role: 'form', name: '質問入力' },
    { role: 'textbox', name: '質問' },
    { role: 'button', name: '質問を送信' }
  ])

  await page.getByRole('navigation', { name: '画面' }).getByRole('button', { name: 'ドキュメント' }).click()
  await expect(page.getByRole('region', { name: 'ドキュメント管理' })).toBeVisible()
  await expectAccessibilityContract(page, testInfo, 'documents', [
    { role: 'main' },
    { role: 'navigation', name: '画面' },
    { role: 'region', name: 'ドキュメント管理' },
    { role: 'complementary', name: 'フォルダツリー' },
    { role: 'region', name: '登録文書一覧' },
    { role: 'region', name: '現在の文書表示条件' }
  ])

  await page.getByRole('navigation', { name: '画面' }).getByRole('button', { name: '履歴' }).click()
  await expect(page.getByRole('region', { name: '履歴', exact: true })).toBeVisible()
  await expectAccessibilityContract(page, testInfo, 'history', [
    { role: 'main' },
    { role: 'navigation', name: '画面' },
    { role: 'region', name: '履歴' },
    { role: 'heading', name: '履歴' },
    { role: 'searchbox', name: '履歴を検索' },
    { role: 'combobox', name: '履歴の並び順', value: '新しい順' },
    { role: 'checkbox', name: 'お気に入りのみ', checked: 'false' },
    { role: 'button', name: '履歴のsemantic証跡をお気に入りに追加' },
    { role: 'button', name: '削除' },
    { role: 'button', name: 'チャットへ戻る' }
  ])

  await page.getByRole('navigation', { name: '画面' }).getByRole('button', { name: '性能テスト' }).click()
  await expect(page.getByRole('region', { name: '性能テスト', exact: true })).toBeVisible()
  await expectAccessibilityContract(page, testInfo, 'benchmark', [
    { role: 'main' },
    { role: 'navigation', name: '画面' },
    { role: 'region', name: '性能テスト' },
    { role: 'heading', name: '性能テスト' },
    { role: 'heading', name: 'ジョブ起動' },
    { role: 'combobox', name: 'テスト種別', value: 'Agent standard' },
    { role: 'textbox', name: 'データセット', value: 'datasets/agent/standard-v1.jsonl' },
    { role: 'combobox', name: 'モデル', value: 'Nova Lite v1' },
    { role: 'spinbutton', name: '並列数', value: '1' },
    { role: 'button', name: '性能テストを実行' },
    { role: 'button', name: '更新' },
    { role: 'button', name: 'チャットへ戻る' },
    { role: 'region', name: '性能テスト実行履歴。左右にスクロールできます' },
    { role: 'table' }
  ])

  await page.getByRole('button', { name: '個人設定', exact: true }).click()
  await expect(page.getByRole('region', { name: '個人設定', exact: true })).toBeVisible()
  await expectAccessibilityContract(page, testInfo, 'profile', [
    { role: 'main' },
    { role: 'navigation', name: '画面' },
    { role: 'region', name: '個人設定' },
    { role: 'heading', name: '個人設定' },
    { role: 'combobox', name: '送信キー', value: 'Enterで送信' },
    { role: 'button', name: 'チャットへ戻る' },
    { role: 'button', name: 'サインアウト' }
  ])
})

async function installHistoryRoute(page: Page) {
  await page.route(/http:\/\/127\.0\.0\.1:8787\/conversation-history$/, async (route) => {
    if (route.request().method() !== 'GET') {
      await route.fallback()
      return
    }

    await route.fulfill({
      json: {
        history: [{
          schemaVersion: 1,
          id: 'semantic-history-1',
          title: '履歴のsemantic証跡',
          updatedAt: '2026-08-06T00:00:00.000Z',
          isFavorite: false,
          messages: [{
            role: 'user',
            text: '支援技術向けの意味論を確認する',
            createdAt: '2026-08-06T00:00:00.000Z'
          }]
        }]
      }
    })
  })
}

async function installBenchmarkRoutes(page: Page) {
  await page.route(/http:\/\/127\.0\.0\.1:8787\/benchmark-suites(?:\?.*)?$/, async (route) => {
    await route.fulfill({
      json: {
        suites: [{
          suiteId: 'standard-agent-v1',
          label: 'Agent standard',
          mode: 'agent',
          datasetS3Key: 'datasets/agent/standard-v1.jsonl',
          preset: 'standard',
          defaultConcurrency: 1
        }]
      }
    })
  })

  await page.route(/http:\/\/127\.0\.0\.1:8787\/benchmark-runs(?:\?.*)?$/, async (route) => {
    await route.fulfill({
      json: {
        benchmarkRuns: [{
          runId: 'semantic-benchmark-1',
          suiteId: 'standard-agent-v1',
          status: 'succeeded',
          mode: 'agent',
          runner: 'codebuild',
          modelId: 'amazon.nova-lite-v1:0',
          datasetS3Key: 'datasets/agent/standard-v1.jsonl',
          createdBy: 'semantic-admin',
          createdAt: '2026-08-07T00:00:00.000Z',
          updatedAt: '2026-08-07T00:01:00.000Z',
          startedAt: '2026-08-07T00:00:00.000Z',
          completedAt: '2026-08-07T00:01:00.000Z',
          metrics: { p50LatencyMs: 850, p95LatencyMs: 1400, answerableAccuracy: 0.92, retrievalRecallAt20: 0.88 }
        }]
      }
    })
  })
}

async function signIn(page: Page) {
  await page.getByRole('textbox', { name: 'メールアドレス' }).fill('semantic-admin@example.com')
  await page.getByRole('textbox', { name: 'パスワード' }).fill('LocalPassword123!')
  await page.getByRole('button', { name: 'サインイン' }).click()
  await expect(page.getByRole('region', { name: 'チャット', exact: true })).toBeVisible()
}

async function expectAccessibilityContract(
  page: Page,
  testInfo: TestInfo,
  label: string,
  expectedNodes: ExpectedNode[]
) {
  const nodes = await readAccessibilityTree(page)

  await testInfo.attach(`${label}-chromium-accessibility-tree.json`, {
    body: Buffer.from(`${JSON.stringify(nodes, null, 2)}\n`, 'utf8'),
    contentType: 'application/json'
  })

  for (const expectedNode of expectedNodes) {
    const matched = nodes.some((node) => (
      node.role === expectedNode.role &&
      (expectedNode.name === undefined || node.name === expectedNode.name) &&
      (expectedNode.value === undefined || node.value === expectedNode.value) &&
      (expectedNode.checked === undefined || node.checked === expectedNode.checked)
    ))
    expect(matched, `missing accessibility node ${JSON.stringify(expectedNode)} in ${label}`).toBe(true)
  }
}

async function readAccessibilityTree(page: Page): Promise<AccessibilityContractNode[]> {
  const session = await page.context().newCDPSession(page)
  try {
    const { nodes } = await session.send('Accessibility.getFullAXTree')
    return nodes
      .filter((node) => !node.ignored && typeof node.role?.value === 'string' && evidenceRoles.has(node.role.value))
      .map((node) => ({
        role: String(node.role?.value ?? ''),
        name: String(node.name?.value ?? ''),
        value: String(node.value?.value ?? ''),
        checked: String(node.properties?.find((property) => property.name === 'checked')?.value?.value ?? '')
      }))
  } finally {
    await session.detach()
  }
}
