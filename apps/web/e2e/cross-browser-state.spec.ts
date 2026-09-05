import { expect, type Page, type TestInfo, test } from '@playwright/test'

const privateHistoryDetail = 'RequestId: private-history-id at InternalHistory (/srv/history.ts:10)'

test('E2E-UI-CROSS-BROWSER-STATE-001: history loading・error・retry・confirmed emptyを区別する @ui-quality', async ({ page }, testInfo) => {
  let historyReads = 0
  let releaseFirstRead: () => void = () => undefined
  const firstReadGate = new Promise<void>((resolve) => { releaseFirstRead = resolve })

  await page.route(/http:\/\/127\.0\.0\.1:8787\/conversation-history$/, async (route) => {
    if (route.request().method() !== 'GET') {
      await route.fallback()
      return
    }
    historyReads += 1
    if (historyReads === 1) {
      await firstReadGate
      await route.fulfill({ status: 500, contentType: 'text/plain', body: privateHistoryDetail })
      return
    }
    await route.fulfill({ json: { history: [] } })
  })

  await signIn(page)
  await page.getByTitle('履歴').click()

  const history = page.getByRole('region', { name: '履歴', exact: true })
  const resource = page.locator('#history-resource-region')
  await expect(resource).toHaveAttribute('aria-busy', 'true')
  await expect(history).toContainText('会話履歴を読み込んでいます')
  await expect(history).not.toContainText('0 件の会話')

  releaseFirstRead()
  const error = history.locator('[data-state-kind="error"]')
  await expect(error).toHaveAttribute('role', 'alert')
  await expect(error).toContainText('会話履歴を取得できませんでした')
  await expect(error).not.toContainText('private-history-id')
  await expect(history).not.toContainText('0 件の会話')

  await error.getByRole('button', { name: '再試行' }).click()
  await expect(history.locator('[data-state-kind="recovered"]')).toContainText('会話履歴を更新しました')
  await expect(resource).not.toHaveAttribute('aria-busy')
  await expect(history).toContainText('条件に一致する履歴はありません')
  await expect(history).toContainText('0 件の会話')
  expect(historyReads).toBe(2)

  await attachStateEvidence(testInfo, 'E2E-UI-CROSS-BROWSER-STATE-001', 'history', 'loading-error-retry-empty', {
    historyReads,
    sequence: ['loading', 'error', 'retry', 'recovered', 'confirmed-empty'],
    privateDetailExposed: false
  })
})

test('E2E-UI-CROSS-BROWSER-STATE-001: history HTTP 403をemptyではなくpermissionとして扱う @ui-quality', async ({ page }, testInfo) => {
  await page.route(/http:\/\/127\.0\.0\.1:8787\/conversation-history$/, async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({ status: 403, contentType: 'text/plain', body: 'forbidden private history id' })
      return
    }
    await route.fallback()
  })

  await signIn(page)
  await page.getByTitle('履歴').click()

  const history = page.getByRole('region', { name: '履歴', exact: true })
  const permission = history.locator('[data-state-kind="permission"]')
  await expect(permission).toHaveAttribute('role', 'alert')
  await expect(permission).toContainText('会話履歴を表示できません')
  await expect(permission).not.toContainText('private history id')
  await expect(history).not.toContainText('0 件の会話')
  await expect(page.locator('#history-resource-region')).not.toContainText('条件に一致する履歴はありません')

  await attachStateEvidence(testInfo, 'E2E-UI-CROSS-BROWSER-STATE-001', 'history', 'permission', {
    sequence: ['loading', 'permission'],
    emptyExposed: false,
    privateDetailExposed: false
  })
})

test('E2E-UI-CROSS-BROWSER-STATE-002: documents loading・partial・retry・confirmed emptyを区別する @ui-quality', async ({ page }, testInfo) => {
  let documentReads = 0
  let groupReads = 0
  let migrationReads = 0
  let releaseFirstDocumentRead: () => void = () => undefined
  let releaseRetryDocumentRead: () => void = () => undefined
  const firstDocumentReadGate = new Promise<void>((resolve) => { releaseFirstDocumentRead = resolve })
  const retryDocumentReadGate = new Promise<void>((resolve) => { releaseRetryDocumentRead = resolve })

  await page.route(/http:\/\/127\.0\.0\.1:8787\/documents$/, async (route) => {
    if (route.request().method() !== 'GET') {
      await route.fallback()
      return
    }
    documentReads += 1
    if (documentReads === 1) {
      await firstDocumentReadGate
      await route.fulfill({
        status: 500,
        contentType: 'text/plain',
        body: 'RequestId: private-document-id at DocumentStore (/srv/documents.ts:24)'
      })
      return
    }
    await retryDocumentReadGate
    await route.fulfill({ json: { documents: [] } })
  })
  await page.route(/http:\/\/127\.0\.0\.1:8787\/document-groups$/, async (route) => {
    if (route.request().method() !== 'GET') {
      await route.fallback()
      return
    }
    groupReads += 1
    await route.fulfill({ json: { groups: [] } })
  })
  await page.route(/http:\/\/127\.0\.0\.1:8787\/documents\/reindex-migrations$/, async (route) => {
    if (route.request().method() !== 'GET') {
      await route.fallback()
      return
    }
    migrationReads += 1
    await route.fulfill({ json: { migrations: [] } })
  })

  await signIn(page)
  await page.getByTitle('ドキュメント').click()

  const documents = page.getByRole('region', { name: 'ドキュメント管理', exact: true })
  const resource = page.locator('#documents-resource-region')
  await expect(resource).toHaveAttribute('aria-busy', 'true')
  await expect(documents).toContainText('文書ワークスペースを読み込んでいます')
  await expect(resource.locator('.document-file-panel')).toHaveCount(0)
  await expect(resource).not.toContainText('0 / 0 件を表示')
  await expect(resource).not.toContainText('ドキュメントを登録しましょう')

  releaseFirstDocumentRead()
  const partial = documents.locator('[data-state-kind="partial"]')
  await expect(partial).toContainText('文書ワークスペースの一部を取得できませんでした')
  await expect(partial).toContainText('取得済み')
  await expect(partial).toContainText('再インデックス履歴')
  await expect(partial).toContainText('未更新')
  await expect(partial).toContainText('文書とフォルダ')
  await expect(partial).not.toContainText('private-document-id')
  await expect(resource.locator('.document-file-panel')).toHaveCount(0)
  await expect(resource).not.toContainText('0 / 0 件を表示')
  await expect(resource).not.toContainText('ドキュメントを登録しましょう')

  await partial.getByRole('button', { name: '失敗した項目を再試行' }).click()
  await expect(resource).toHaveAttribute('aria-busy', 'true')
  await expect(documents.locator('[data-state-kind="retrying"]')).toContainText('文書ワークスペースを再試行しています')
  await expect(resource.locator('.document-file-panel')).toHaveCount(0)

  releaseRetryDocumentRead()
  await expect(documents.locator('[data-state-kind="recovered"]')).toContainText('文書ワークスペースを更新しました')
  await expect(resource.getByRole('region', { name: '登録文書一覧' })).toBeVisible()
  await expect(resource).toContainText('ドキュメントを登録しましょう')
  await expect(resource).toContainText('0 件（対象内 0 件）')
  await expect(resource).toContainText('0 / 0 件を表示（全体 0 件）')
  expect(documentReads).toBe(2)
  expect(groupReads).toBe(2)
  expect(migrationReads).toBe(2)

  await attachStateEvidence(testInfo, 'E2E-UI-CROSS-BROWSER-STATE-002', 'documents', 'loading-partial-retry-empty', {
    documentReads,
    groupReads,
    migrationReads,
    sequence: ['loading', 'partial', 'retrying', 'recovered', 'confirmed-empty'],
    falseZeroExposedBeforeConfirmation: false,
    privateDetailExposed: false
  })
})

test('E2E-UI-CROSS-BROWSER-STATE-002: documents全resourceのHTTP 403をemptyではなくpermissionとして扱う @ui-quality', async ({ page }, testInfo) => {
  await page.route(/http:\/\/127\.0\.0\.1:8787\/(?:documents|document-groups|documents\/reindex-migrations)$/, async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({ status: 403, contentType: 'text/plain', body: 'forbidden private document principal' })
      return
    }
    await route.fallback()
  })

  await signIn(page)
  await page.getByTitle('ドキュメント').click()

  const documents = page.getByRole('region', { name: 'ドキュメント管理', exact: true })
  const resource = page.locator('#documents-resource-region')
  const permission = documents.locator('[data-state-kind="permission"]')
  await expect(permission).toHaveAttribute('role', 'alert')
  await expect(permission).toContainText('文書ワークスペースを表示できません')
  await expect(permission).not.toContainText('private document principal')
  await expect(permission.getByRole('button', { name: '戻る' })).toBeVisible()
  await expect(resource.locator('.document-file-panel')).toHaveCount(0)
  await expect(resource).not.toContainText('0 / 0 件を表示')
  await expect(resource).not.toContainText('ドキュメントを登録しましょう')

  await attachStateEvidence(testInfo, 'E2E-UI-CROSS-BROWSER-STATE-002', 'documents', 'permission', {
    sequence: ['loading', 'permission'],
    emptyExposed: false,
    falseZeroExposed: false,
    privateDetailExposed: false
  })
})

test('E2E-UI-CROSS-BROWSER-STATE-003: assignee loading・error・retry・confirmed emptyを区別する @ui-quality', async ({ page }, testInfo) => {
  let questionReads = 0
  let releaseFirstRead: () => void = () => undefined
  let releaseRetryRead: () => void = () => undefined
  const firstReadGate = new Promise<void>((resolve) => { releaseFirstRead = resolve })
  const retryReadGate = new Promise<void>((resolve) => { releaseRetryRead = resolve })

  await page.route(/http:\/\/127\.0\.0\.1:8787\/questions$/, async (route) => {
    if (route.request().method() !== 'GET') {
      await route.fallback()
      return
    }
    questionReads += 1
    if (questionReads === 1) {
      await firstReadGate
      await route.fulfill({
        status: 500,
        contentType: 'text/plain',
        body: 'RequestId: private-question-id at QuestionStore (/srv/questions.ts:18)'
      })
      return
    }
    await retryReadGate
    await route.fulfill({ json: { questions: [] } })
  })

  await signIn(page)
  await page.getByTitle('担当者対応').click()

  const assignee = page.getByRole('region', { name: '担当者対応', exact: true })
  const resource = page.locator('#assignee-resource-region')
  await expect(resource).toHaveAttribute('aria-busy', 'true')
  await expect(assignee).toContainText('担当者対応を読み込んでいます')
  await expect(assignee).toContainText('問い合わせを確認中')
  await expect(assignee).not.toContainText('0 件が対応待ち')
  await expect(resource).not.toContainText('担当者へ送信された質問はまだありません。')
  await expect(resource.locator('.assignee-kanban')).toHaveCount(0)

  releaseFirstRead()
  const error = assignee.locator('[data-state-kind="error"]')
  await expect(error).toHaveAttribute('role', 'alert')
  await expect(error).toContainText('担当者対応を取得できませんでした')
  await expect(error).not.toContainText('private-question-id')
  await expect(assignee).not.toContainText('0 件が対応待ち')
  await expect(resource).not.toContainText('担当者へ送信された質問はまだありません。')
  await expect(resource.locator('.assignee-kanban')).toHaveCount(0)

  await error.getByRole('button', { name: '再試行' }).click()
  await expect(resource).toHaveAttribute('aria-busy', 'true')
  await expect(assignee.locator('[data-state-kind="retrying"]')).toContainText('担当者対応を再試行しています')
  await expect(assignee).not.toContainText('0 件が対応待ち')
  await expect(resource.locator('.assignee-kanban')).toHaveCount(0)

  releaseRetryRead()
  await expect(assignee.locator('[data-state-kind="recovered"]')).toContainText('担当者対応を更新しました')
  await expect(resource).not.toHaveAttribute('aria-busy')
  await expect(assignee).toContainText('担当者へ送信された質問はまだありません。')
  await expect(assignee).toContainText('0 件が対応待ち')
  await expect(resource.locator('.assignee-kanban')).toHaveCount(0)
  expect(questionReads).toBe(2)

  await attachStateEvidence(testInfo, 'E2E-UI-CROSS-BROWSER-STATE-003', 'assignee', 'loading-error-retry-empty', {
    questionReads,
    sequence: ['loading', 'error', 'retrying', 'recovered', 'confirmed-empty'],
    falseZeroExposedBeforeConfirmation: false,
    privateDetailExposed: false
  })
})

test('E2E-UI-CROSS-BROWSER-STATE-003: assignee HTTP 403をemptyではなくpermissionとして扱う @ui-quality', async ({ page }, testInfo) => {
  await page.route(/http:\/\/127\.0\.0\.1:8787\/questions$/, async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({ status: 403, contentType: 'text/plain', body: 'forbidden private question id' })
      return
    }
    await route.fallback()
  })

  await signIn(page)
  await page.getByTitle('担当者対応').click()

  const assignee = page.getByRole('region', { name: '担当者対応', exact: true })
  const resource = page.locator('#assignee-resource-region')
  const permission = assignee.locator('[data-state-kind="permission"]')
  await expect(permission).toHaveAttribute('role', 'alert')
  await expect(permission).toContainText('担当者対応を表示できません')
  await expect(permission).not.toContainText('private question id')
  await expect(permission.getByRole('button', { name: '戻る' })).toBeVisible()
  await expect(assignee).not.toContainText('0 件が対応待ち')
  await expect(resource).not.toContainText('担当者へ送信された質問はまだありません。')
  await expect(resource.locator('.assignee-kanban')).toHaveCount(0)

  await attachStateEvidence(testInfo, 'E2E-UI-CROSS-BROWSER-STATE-003', 'assignee', 'permission', {
    sequence: ['loading', 'permission'],
    emptyExposed: false,
    falseZeroExposed: false,
    privateDetailExposed: false
  })
})

test('E2E-UI-CROSS-BROWSER-STATE-004: favorites loading・error・retry・confirmed emptyを区別する @ui-quality', async ({ page }, testInfo) => {
  let favoritesReads = 0
  let releaseFirstRead: () => void = () => undefined
  let releaseRetryRead: () => void = () => undefined
  const firstReadGate = new Promise<void>((resolve) => { releaseFirstRead = resolve })
  const retryReadGate = new Promise<void>((resolve) => { releaseRetryRead = resolve })

  await page.route(/http:\/\/127\.0\.0\.1:8787\/favorites$/, async (route) => {
    if (route.request().method() !== 'GET') {
      await route.fallback()
      return
    }
    favoritesReads += 1
    if (favoritesReads === 1) {
      await firstReadGate
      await route.fulfill({
        status: 500,
        contentType: 'text/plain',
        body: 'RequestId: private-favorite-id at FavoriteStore (/srv/favorites.ts:12)'
      })
      return
    }
    await retryReadGate
    await route.fulfill({ json: { favorites: [] } })
  })

  await signIn(page)
  await page.getByTitle('お気に入り').click()

  const favorites = page.getByRole('region', { name: 'お気に入り', exact: true })
  const resource = page.locator('#favorites-resource-region')
  await expect(resource).toHaveAttribute('aria-busy', 'true')
  await expect(favorites).toContainText('お気に入りを読み込んでいます')
  await expect(favorites).toContainText('お気に入りを確認中')
  await expect(favorites).not.toContainText('0 件のショートカット')
  await expect(resource).not.toContainText('お気に入りはありません。')

  releaseFirstRead()
  const error = favorites.locator('[data-state-kind="error"]')
  await expect(error).toHaveAttribute('role', 'alert')
  await expect(error).toContainText('お気に入りを取得できませんでした')
  await expect(error).not.toContainText('private-favorite-id')
  await expect(favorites).not.toContainText('0 件のショートカット')
  await expect(resource).not.toContainText('お気に入りはありません。')

  await error.getByRole('button', { name: '再試行' }).click()
  await expect(resource).toHaveAttribute('aria-busy', 'true')
  await expect(favorites.locator('[data-state-kind="retrying"]')).toContainText('お気に入りを再試行しています')
  await expect(favorites).not.toContainText('0 件のショートカット')
  await expect(resource).not.toContainText('お気に入りはありません。')

  releaseRetryRead()
  await expect(favorites.locator('[data-state-kind="recovered"]')).toContainText('お気に入りを更新しました')
  await expect(resource).not.toHaveAttribute('aria-busy')
  await expect(favorites).toContainText('お気に入りはありません。')
  await expect(favorites).toContainText('0 件のショートカット')
  expect(favoritesReads).toBe(2)

  await attachStateEvidence(testInfo, 'E2E-UI-CROSS-BROWSER-STATE-004', 'favorites', 'loading-error-retry-empty', {
    favoritesReads,
    sequence: ['loading', 'error', 'retrying', 'recovered', 'confirmed-empty'],
    falseZeroExposedBeforeConfirmation: false,
    privateDetailExposed: false
  })
})

test('E2E-UI-CROSS-BROWSER-STATE-004: favorites HTTP 403をemptyではなくpermissionとして扱う @ui-quality', async ({ page }, testInfo) => {
  await page.route(/http:\/\/127\.0\.0\.1:8787\/favorites$/, async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({ status: 403, contentType: 'text/plain', body: 'forbidden private favorite id' })
      return
    }
    await route.fallback()
  })

  await signIn(page)
  await page.getByTitle('お気に入り').click()

  const favorites = page.getByRole('region', { name: 'お気に入り', exact: true })
  const resource = page.locator('#favorites-resource-region')
  const permission = favorites.locator('[data-state-kind="permission"]')
  await expect(permission).toHaveAttribute('role', 'alert')
  await expect(permission).toContainText('お気に入りを表示できません')
  await expect(permission).not.toContainText('private favorite id')
  await expect(permission.getByRole('button', { name: '戻る' })).toBeVisible()
  await expect(favorites).not.toContainText('0 件のショートカット')
  await expect(resource).not.toContainText('お気に入りはありません。')

  await attachStateEvidence(testInfo, 'E2E-UI-CROSS-BROWSER-STATE-004', 'favorites', 'permission', {
    sequence: ['loading', 'permission'],
    emptyExposed: false,
    falseZeroExposed: false,
    privateDetailExposed: false
  })
})

test('E2E-UI-CROSS-BROWSER-STATE-005: chat initial・processing・SSE timeout・retry・recoveryを区別する @ui-quality', async ({ page }, testInfo) => {
  let eventReads = 0
  let retryLastEventId = ''
  let releaseRetry: () => void = () => undefined
  const retryGate = new Promise<void>((resolve) => { releaseRetry = resolve })

  await page.route(/http:\/\/127\.0\.0\.1:8787\/rpc\/chat\/startRun$/, async (route) => {
    await route.fulfill({
      json: {
        json: {
          runId: 'cross-browser-chat-state-run',
          status: 'queued',
          eventsPath: '/chat-runs/cross-browser-chat-state-run/events'
        }
      }
    })
  })
  await page.route(/http:\/\/127\.0\.0\.1:8787\/chat-runs\/cross-browser-chat-state-run\/events$/, async (route) => {
    eventReads += 1
    if (eventReads === 1) {
      await route.fulfill({
        contentType: 'text/event-stream',
        body: 'id: 3\nevent: timeout\ndata: {"message":"stream timeout"}\n\n'
      })
      return
    }

    retryLastEventId = route.request().headers()['last-event-id'] ?? ''
    await retryGate
    await route.fulfill({
      contentType: 'text/event-stream',
      body: 'id: 4\nevent: final\ndata: {"answer":"横断ブラウザで再接続後の回答です。","isAnswerable":true,"citations":[],"retrieved":[]}\n\n'
    })
  })

  await signIn(page)
  const chat = page.getByRole('region', { name: 'チャット', exact: true })
  await expect(chat.getByRole('region', { name: 'チャット開始' })).toBeVisible()
  await expect(chat.getByRole('heading', { name: '何を確認しますか？' })).toBeVisible()
  await expect(chat).toHaveAttribute('aria-busy', 'false')

  await chat.getByRole('textbox', { name: '質問' }).fill('長い処理を横断ブラウザで確認して')
  await chat.getByRole('button', { name: '質問を送信' }).click()
  await expect(chat).toHaveAttribute('aria-busy', 'true')
  await expect(chat.locator('.processing-row')).toContainText('回答を生成中')
  await expect(chat.getByRole('button', { name: '質問を送信' })).toBeDisabled()
  await expect(chat.locator('.processing-row')).toContainText('処理が続いています。再接続しています')
  await expect(chat).toHaveAttribute('aria-busy', 'true')

  await expect.poll(() => eventReads).toBe(2)
  await expect.poll(() => retryLastEventId).toBe('3')
  releaseRetry()

  await expect(chat.getByText('横断ブラウザで再接続後の回答です。')).toBeVisible()
  await expect(chat.locator('.processing-row')).toHaveCount(0)
  await expect(chat).toHaveAttribute('aria-busy', 'false')
  await expect(chat.getByRole('textbox', { name: '質問' })).toBeEnabled()

  await attachStateEvidence(testInfo, 'E2E-UI-CROSS-BROWSER-STATE-005', 'chat', 'processing-timeout-retry-recovery', {
    eventReads,
    retryLastEventId,
    sequence: ['initial', 'processing', 'timeout', 'reconnecting', 'recovered-answer'],
    busyClearedAfterRecovery: true,
    inputReenabledAfterRecovery: true
  })
})

test('E2E-UI-CROSS-BROWSER-STATE-005: chat HTTP 500は安全なerrorを表示しprivate detailを隠す @ui-quality', async ({ page }, testInfo) => {
  const privateDetail = 'RequestId: private-cross-browser-chat-request at InternalChatService.run()'
  await page.route(/http:\/\/127\.0\.0\.1:8787\/rpc\/chat\/startRun$/, async (route) => {
    await route.fulfill({ status: 500, contentType: 'text/plain', body: privateDetail })
  })

  await signIn(page)
  const chat = page.getByRole('region', { name: 'チャット', exact: true })
  await chat.getByRole('textbox', { name: '質問' }).fill('横断ブラウザで失敗時の表示を確認して')
  await chat.getByRole('button', { name: '質問を送信' }).click()

  const error = page.locator('[data-state-target="chat"][data-state-kind="error"]')
  await expect(error).toHaveAttribute('role', 'alert')
  await expect(error).toContainText('処理を完了できませんでした')
  await expect(error).not.toContainText(privateDetail)
  await expect(chat.getByText('private-cross-browser-chat-request')).toHaveCount(0)
  await expect(chat).toHaveAttribute('aria-busy', 'false')

  await attachStateEvidence(testInfo, 'E2E-UI-CROSS-BROWSER-STATE-005', 'chat', 'safe-error', {
    sequence: ['processing', 'error'],
    busyClearedAfterError: true,
    privateDetailExposed: false
  })
})

test('E2E-UI-CROSS-BROWSER-STATE-005: chat:create不足はpermissionを表示し送信requestを発行しない @ui-quality', async ({ page }, testInfo) => {
  await installCurrentUserPermissions(page, ['chat:read:own'])
  const chatStarts: string[] = []
  page.on('request', (request) => {
    if (new URL(request.url()).pathname === '/rpc/chat/startRun') chatStarts.push(request.method())
  })

  await signIn(page)
  const chat = page.getByRole('region', { name: 'チャット', exact: true })
  const permission = chat.getByRole('alert')
  await expect(permission).toContainText('質問を送信する権限がありません')
  await expect(chat.getByRole('button', { name: '質問を送信' })).toBeDisabled()

  const question = chat.getByRole('textbox', { name: '質問' })
  await question.fill('権限なしでは横断ブラウザでも送信しない')
  await question.press('Enter')
  await expect(chat.getByRole('button', { name: '質問を送信' })).toBeDisabled()
  expect(chatStarts).toEqual([])

  await attachStateEvidence(testInfo, 'E2E-UI-CROSS-BROWSER-STATE-005', 'chat', 'permission', {
    sequence: ['permission', 'blocked-submit'],
    startRequests: chatStarts.length,
    permissionAlertVisible: true,
    submitDisabled: true
  })
})

async function signIn(page: Page) {
  await page.goto('/')
  await page.getByPlaceholder('メールアドレスを入力').fill('local@example.com')
  await page.getByPlaceholder('パスワードを入力').fill('LocalPassword123!')
  await page.getByRole('button', { name: 'サインイン' }).click()
  await expect(page.getByRole('region', { name: 'チャット', exact: true })).toBeVisible()
}

async function installCurrentUserPermissions(page: Page, grantedPermissions: string[]) {
  await page.route(/http:\/\/127\.0\.0\.1:8787\/me$/, async (route) => {
    await route.fulfill({
      json: {
        user: {
          userId: 'cross-browser-state-user',
          email: 'cross-browser-state@example.com',
          groups: [],
          permissions: grantedPermissions
        }
      }
    })
  })
}

async function attachStateEvidence(
  testInfo: TestInfo,
  evidenceId: string,
  view: string,
  scenario: string,
  observed: Record<string, boolean | number | string | string[]>
) {
  const browserProject = testInfo.project.name
  await testInfo.attach(`cross-browser-${view}-state-${scenario}-${browserProject}.json`, {
    body: Buffer.from(`${JSON.stringify({
      evidenceId,
      browserProject,
      view,
      scenario,
      observed,
      evidenceBoundary: 'Deterministic Playwright route fixture; not a production incident, representative screen reader, real browser zoom, touch, real device, or native accessibility-tree result'
    }, null, 2)}\n`, 'utf8'),
    contentType: 'application/json'
  })
}
