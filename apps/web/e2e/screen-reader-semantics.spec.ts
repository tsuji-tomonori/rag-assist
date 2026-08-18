import { expect, type Page, type TestInfo, test } from '@playwright/test'

type AccessibilityContractNode = {
  role: string
  name: string
  value: string
  checked: string
  pressed: string
  selected: string
  busy: string
  live: string
}

type ExpectedNode = {
  role: string
  name?: string
  value?: string
  checked?: string
  pressed?: string
  selected?: string
  busy?: string
  live?: string
}

type ChatSemanticRouteState = {
  startRuns: number
  eventReads: number
  releaseAnswer: () => void
}

const evidenceRoles = new Set([
  'alert',
  'article',
  'button',
  'checkbox',
  'combobox',
  'complementary',
  'dialog',
  'form',
  'heading',
  'main',
  'navigation',
  'region',
  'row',
  'searchbox',
  'spinbutton',
  'status',
  'table',
  'textbox'
])

test('E2E-UI-SR-SEMANTICS-001: representative views expose stable Chromium accessibility tree contracts @smoke @ui-quality', async ({ page }, testInfo) => {
  const chatRouteState = await installChatRoute(page)
  await installHistoryRoute(page)
  await installFavoritesRoute(page)
  await installDocumentsRoutes(page)
  await installBenchmarkRoutes(page)
  await installAssigneeRoute(page)
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
    { role: 'region', name: 'チャット', busy: 'false' },
    { role: 'form', name: '質問入力' },
    { role: 'textbox', name: '質問' },
    { role: 'button', name: '質問を送信' }
  ])

  await verifyChatDynamicSemantics(page, testInfo, chatRouteState)

  await page.getByRole('navigation', { name: '画面' }).getByRole('button', { name: 'ドキュメント' }).click()
  await expect(page.getByRole('region', { name: 'ドキュメント管理' })).toBeVisible()
  await expectAccessibilityContract(page, testInfo, 'documents', [
    { role: 'main' },
    { role: 'heading', name: 'ドキュメント管理' },
    { role: 'navigation', name: '画面' },
    { role: 'region', name: 'ドキュメント管理' },
    { role: 'navigation', name: 'パンくず' },
    { role: 'complementary', name: 'フォルダツリー' },
    { role: 'searchbox', name: 'フォルダを検索' },
    { role: 'region', name: '登録文書一覧' },
    { role: 'region', name: '現在の文書表示条件' },
    { role: 'searchbox', name: 'ファイル名検索' },
    { role: 'combobox', name: '種別', value: 'すべて' },
    { role: 'combobox', name: '状態', value: 'すべて' },
    { role: 'combobox', name: '所属フォルダ', value: 'すべて' },
    { role: 'combobox', name: '並び替え', value: '更新日 新しい順' },
    { role: 'combobox', name: '表示件数', value: '25件' },
    { role: 'table', name: '登録文書' },
    { role: 'button', name: 'semantic-policy.pdfの詳細を表示' }
  ])

  await page.getByRole('button', { name: 'semantic-policy.pdfの詳細を表示' }).click()
  await expect(page.getByRole('dialog', { name: 'semantic-policy.pdf' })).toBeVisible()
  await expectAccessibilityContract(page, testInfo, 'documents-selected', [
    { role: 'row', selected: 'true' },
    { role: 'dialog', name: 'semantic-policy.pdf' },
    { role: 'button', name: '文書詳細を閉じる' },
    { role: 'button', name: '技術・品質詳細を表示' },
    { role: 'button', name: 'この資料に質問する' }
  ])
  await page.getByRole('button', { name: '文書詳細を閉じる' }).click()

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

  await page.getByRole('navigation', { name: '画面' }).getByRole('button', { name: 'お気に入り' }).click()
  await expect(page.getByRole('region', { name: 'お気に入り', exact: true })).toBeVisible()
  await expectAccessibilityContract(page, testInfo, 'favorites', [
    { role: 'main' },
    { role: 'navigation', name: '画面' },
    { role: 'region', name: 'お気に入り' },
    { role: 'heading', name: 'お気に入り' },
    { role: 'heading', name: '項目一覧' },
    { role: 'heading', name: '会話' },
    { role: 'heading', name: '文書' },
    { role: 'button', name: 'チャットへ戻る' }
  ])

  await page.getByRole('navigation', { name: '画面' }).getByRole('button', { name: '担当者対応' }).click()
  await expect(page.getByRole('region', { name: '担当者対応', exact: true })).toBeVisible()
  await expectAccessibilityContract(page, testInfo, 'assignee', [
    { role: 'main' },
    { role: 'navigation', name: '画面' },
    { role: 'region', name: '担当者対応' },
    { role: 'heading', name: '担当者対応' },
    { role: 'region', name: '問い合わせ一覧' },
    { role: 'combobox', name: 'ステータス', value: 'すべて' },
    { role: 'searchbox', name: '検索' },
    { role: 'region', name: '担当者対応カンバン' },
    { role: 'region', name: '未対応' },
    { role: 'button', name: '担当者a11y証跡を選択', pressed: 'true' },
    { role: 'complementary', name: '選択中の問い合わせと回答作成' },
    { role: 'region', name: '問い合わせ概要' },
    { role: 'form', name: '回答作成' },
    { role: 'textbox', name: '回答タイトル', value: '担当者a11y証跡への回答' },
    { role: 'textbox', name: '回答内容' },
    { role: 'checkbox', name: '質問者へ通知する', checked: 'true' },
    { role: 'status', live: 'polite' },
    { role: 'button', name: '入力を一時保持' },
    { role: 'button', name: '回答を送信' }
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

async function installChatRoute(page: Page): Promise<ChatSemanticRouteState> {
  let releaseAnswer: () => void = () => undefined
  const answerGate = new Promise<void>((resolve) => { releaseAnswer = resolve })
  const state: ChatSemanticRouteState = {
    startRuns: 0,
    eventReads: 0,
    releaseAnswer: () => releaseAnswer()
  }

  await page.route(/http:\/\/127\.0\.0\.1:8787\/rpc\/chat\/startRun$/, async (route) => {
    state.startRuns += 1
    await route.fulfill({
      json: {
        json: {
          runId: 'semantic-chat-run',
          status: 'queued',
          eventsPath: '/chat-runs/semantic-chat-run/events'
        }
      }
    })
  })

  await page.route(/http:\/\/127\.0\.0\.1:8787\/chat-runs\/semantic-chat-run\/events$/, async (route) => {
    state.eventReads += 1
    await answerGate
    await route.fulfill({
      contentType: 'text/event-stream',
      body: 'id: 1\nevent: final\ndata: {"answer":"semantic stateから回答へ復帰しました。","isAnswerable":true,"citations":[],"retrieved":[]}\n\n'
    })
  })

  return state
}

async function verifyChatDynamicSemantics(
  page: Page,
  testInfo: TestInfo,
  routeState: ChatSemanticRouteState
) {
  const chat = page.getByRole('region', { name: 'チャット', exact: true })
  const question = chat.getByRole('textbox', { name: '質問' })
  await question.fill('回答処理中のsemantic stateを確認する')
  await chat.getByRole('button', { name: '質問を送信' }).click()

  await expect(chat.locator('.processing-row')).toContainText('回答を生成中')
  await expect.poll(() => routeState.startRuns).toBe(1)
  await expect.poll(() => routeState.eventReads).toBe(1)
  await expectAccessibilityContract(page, testInfo, 'chat-processing', [
    { role: 'region', name: 'チャット', busy: 'true' },
    { role: 'article', live: 'polite' }
  ])

  routeState.releaseAnswer()
  await expect(chat.getByText('semantic stateから回答へ復帰しました。')).toBeVisible()
  await expectAccessibilityContract(page, testInfo, 'chat-completed', [
    { role: 'region', name: 'チャット', busy: 'false' }
  ])
}

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

async function installFavoritesRoute(page: Page) {
  await page.route(/http:\/\/127\.0\.0\.1:8787\/favorites$/, async (route) => {
    if (route.request().method() !== 'GET') {
      await route.fallback()
      return
    }

    await route.fulfill({
      json: {
        favorites: [
          {
            favoriteId: 'semantic-favorite-chat',
            targetType: 'chatSession',
            targetId: 'semantic-conversation-1',
            label: 'お気に入りのsemantic会話',
            accessible: true,
            createdAt: '2026-08-08T00:00:00.000Z',
            updatedAt: '2026-08-08T00:00:00.000Z'
          },
          {
            favoriteId: 'semantic-favorite-document',
            targetType: 'document',
            targetId: 'semantic-document-1',
            label: 'お気に入りのsemantic文書',
            accessible: false,
            createdAt: '2026-08-08T00:00:00.000Z',
            updatedAt: '2026-08-08T00:00:00.000Z'
          }
        ]
      }
    })
  })
}

async function installDocumentsRoutes(page: Page) {
  await page.route(/http:\/\/127\.0\.0\.1:8787\/(?:documents(?:\/reindex-migrations)?|document-groups)$/, async (route) => {
    if (route.request().method() !== 'GET') {
      await route.fallback()
      return
    }

    const path = new URL(route.request().url()).pathname
    if (path === '/documents') {
      await route.fulfill({
        json: {
          documents: [{
            detailLevel: 'manager',
            documentId: 'semantic-document-1',
            fileName: 'semantic-policy.pdf',
            mimeType: 'application/pdf',
            chunkCount: 12,
            memoryCardCount: 3,
            status: 'ready',
            metadata: { groupIds: ['semantic-group-1'] },
            currentUserEffectivePermission: 'full',
            capabilities: {
              canRead: true,
              canShare: true,
              canMove: true,
              canDelete: true,
              canReindex: true
            },
            createdAt: '2026-08-18T00:00:00.000Z',
            updatedAt: '2026-08-18T00:01:00.000Z'
          }]
        }
      })
      return
    }

    if (path === '/document-groups') {
      await route.fulfill({
        json: {
          groups: [{
            schemaVersion: 2,
            itemType: 'documentGroup',
            tenantId: 'local-e2e',
            groupId: 'semantic-group-1',
            name: 'semantic規程',
            normalizedName: 'semantic規程',
            canonicalPath: '/semantic規程',
            normalizedCanonicalPath: '/semantic規程',
            adminPrincipalType: 'user',
            adminPrincipalId: 'semantic-admin',
            adminPathPk: 'local-e2e#user#semantic-admin',
            parentPathPk: 'local-e2e#user#semantic-admin#ROOT',
            visibility: 'private',
            ownerUserId: 'semantic-admin',
            sharedUserIds: [],
            sharedGroups: [],
            managerUserIds: ['semantic-admin'],
            effectivePermission: 'full',
            detailLevel: 'manager',
            capabilities: { canRead: true, canManage: true },
            createdAt: '2026-08-18T00:00:00.000Z',
            updatedAt: '2026-08-18T00:01:00.000Z'
          }]
        }
      })
      return
    }

    await route.fulfill({ json: { migrations: [] } })
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

async function installAssigneeRoute(page: Page) {
  await page.route(/http:\/\/127\.0\.0\.1:8787\/questions(?:\?.*)?$/, async (route) => {
    if (route.request().method() !== 'GET') {
      await route.fallback()
      return
    }

    await route.fulfill({
      json: {
        questions: [{
          questionId: 'semantic-assignee-1',
          title: '担当者a11y証跡',
          question: '担当者画面の意味構造を確認してください。',
          requesterName: '依頼者',
          requesterDepartment: '利用部門',
          assigneeDepartment: '総務部',
          assigneeGroupId: 'support',
          category: '手続き',
          priority: 'normal',
          status: 'open',
          sourceQuestion: '担当者画面の意味構造は？',
          chatAnswer: '担当者による確認が必要です。',
          createdAt: '2026-08-17T00:00:00.000Z',
          updatedAt: '2026-08-17T00:00:00.000Z'
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
      (expectedNode.checked === undefined || node.checked === expectedNode.checked) &&
      (expectedNode.pressed === undefined || node.pressed === expectedNode.pressed) &&
      (expectedNode.selected === undefined || node.selected === expectedNode.selected) &&
      (expectedNode.busy === undefined || node.busy === expectedNode.busy) &&
      (expectedNode.live === undefined || node.live === expectedNode.live)
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
        checked: String(node.properties?.find((property) => property.name === 'checked')?.value?.value ?? ''),
        pressed: String(node.properties?.find((property) => property.name === 'pressed')?.value?.value ?? ''),
        selected: normalizeBooleanAxProperty(node.properties?.find((property) => property.name === 'selected')?.value?.value),
        busy: normalizeBooleanAxProperty(node.properties?.find((property) => property.name === 'busy')?.value?.value),
        live: String(node.properties?.find((property) => property.name === 'live')?.value?.value ?? '')
      }))
  } finally {
    await session.detach()
  }
}

function normalizeBooleanAxProperty(value: unknown): string {
  return value === true || value === 1 || value === 'true' || value === '1' ? 'true' : 'false'
}
