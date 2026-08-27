import { expect, type Locator, type Page, type TestInfo, test } from '@playwright/test'

type ChatSemanticRouteState = {
  startRuns: number
  eventReads: number
  releaseAnswer: () => void
}

test('E2E-UI-CROSS-BROWSER-SEMANTICS-001: login and chat expose stable cross-browser semantics @ui-quality', async ({ page }, testInfo) => {
  const routeState = await installChatRoute(page)
  await page.goto('/')

  await expectAriaSnapshot(page.locator('body'), testInfo, 'E2E-UI-CROSS-BROWSER-SEMANTICS-001', 'login', `
    - heading "社内QAチャットボット" [level=1]
    - form "Cognitoで安全にサインイン":
        - textbox "メールアドレス"
        - textbox "パスワード"
        - checkbox "ログイン状態を保持"
        - button "サインイン"
        - button "アカウント作成"
  `)

  await signIn(page)
  const chat = page.getByRole('region', { name: 'チャット', exact: true })
  await expectAriaSnapshot(page.locator('body'), testInfo, 'E2E-UI-CROSS-BROWSER-SEMANTICS-001', 'chat-idle', `
    - complementary "主要ナビゲーション":
        - navigation "画面"
    - main:
        - heading "社内QAチャットボットエージェント" [level=1]
        - region "チャット":
            - form "質問入力":
                - textbox "質問"
                - button "質問を送信"
  `)

  const question = chat.getByRole('textbox', { name: '質問', exact: true })
  await question.fill('FirefoxとWebKitでsemantic stateを確認する')
  await chat.getByRole('button', { name: '質問を送信', exact: true }).click()

  const processing = chat.getByRole('article').filter({ hasText: '回答を生成中' })
  await expect(processing).toBeVisible()
  await expect.poll(() => routeState.startRuns).toBe(1)
  await expect.poll(() => routeState.eventReads).toBe(1)
  await expect(chat).toHaveAttribute('aria-busy', 'true')
  await expect(processing).toHaveAttribute('aria-live', 'polite')
  await attachSemanticEvidence(chat, testInfo, 'E2E-UI-CROSS-BROWSER-SEMANTICS-001', 'chat-processing', {
    chatBusy: await chat.getAttribute('aria-busy'),
    processingComputedRole: 'article',
    processingRoleAttribute: await processing.getAttribute('role'),
    processingLive: await processing.getAttribute('aria-live')
  })

  routeState.releaseAnswer()
  await expect(chat.getByText('cross-browser semantic stateから回答へ復帰しました。')).toBeVisible()
  await expect(processing).toHaveCount(0)
  await expect(chat).toHaveAttribute('aria-busy', 'false')
  await attachSemanticEvidence(chat, testInfo, 'E2E-UI-CROSS-BROWSER-SEMANTICS-001', 'chat-completed', {
    chatBusy: await chat.getAttribute('aria-busy'),
    processingCount: await processing.count()
  })
})

test('E2E-UI-CROSS-BROWSER-SEMANTICS-002: profile exposes stable cross-browser semantics @ui-quality', async ({ page }, testInfo) => {
  const evidenceId = 'E2E-UI-CROSS-BROWSER-SEMANTICS-002'
  await page.goto('/')
  await signIn(page)
  await page.getByRole('button', { name: '個人設定', exact: true }).click()

  const profile = page.getByRole('region', { name: '個人設定', exact: true })
  await expect(profile).toBeVisible()
  await expectAriaSnapshot(profile, testInfo, evidenceId, 'profile-idle', `
    - heading "個人設定" [level=2]
    - button "チャットへ戻る"
    - combobox "送信キー":
        - option "Enterで送信" [selected]
        - option "Ctrl+Enterで送信"
    - button "サインアウト"
  `)

  const shortcut = profile.getByRole('combobox', { name: '送信キー', exact: true })
  await shortcut.selectOption('ctrlEnter')
  await expect(shortcut).toHaveValue('ctrlEnter')

  const status = profile.getByRole('status')
  await expect(status).toHaveText('送信キーを「Ctrl+Enterで送信」に変更しました。この設定は現在のサインイン中だけ有効です。')
  await expect(status).toHaveAttribute('aria-live', 'polite')
  await attachSemanticEvidence(profile, testInfo, evidenceId, 'profile-changed', {
    shortcutValue: await shortcut.inputValue(),
    statusComputedRole: 'status',
    statusRoleAttribute: await status.getAttribute('role'),
    statusLive: await status.getAttribute('aria-live'),
    statusText: await status.innerText()
  })
})

test('E2E-UI-CROSS-BROWSER-SEMANTICS-003: assignee exposes stable cross-browser semantics @ui-quality', async ({ page }, testInfo) => {
  const evidenceId = 'E2E-UI-CROSS-BROWSER-SEMANTICS-003'
  await installAssigneeRoute(page)
  await page.goto('/')
  await signIn(page)
  await page.getByRole('navigation', { name: '画面' }).getByRole('button', { name: '担当者対応' }).click()

  const assignee = page.getByRole('region', { name: '担当者対応', exact: true })
  await expect(assignee).toBeVisible()
  await expectAriaSnapshot(assignee, testInfo, evidenceId, 'assignee-idle', `
    - region "担当者対応":
        - button "チャットへ戻る"
        - heading "担当者対応" [level=2]
        - region "問い合わせ一覧":
            - heading "問い合わせ一覧" [level=3]
            - combobox "ステータス":
                - option "すべて" [selected]
                - option "未対応"
                - option "対応中"
                - option "確認待ち"
                - option "解決済み"
            - searchbox "検索"
        - region "担当者対応カンバン":
            - region "未対応":
                - heading "未対応" [level=3]
                - button "担当者cross-browser semantic証跡を選択" [pressed]
        - complementary "選択中の問い合わせと回答作成":
            - region "問い合わせ概要":
                - heading "問い合わせ概要" [level=3]
            - form "回答作成":
                - heading "回答作成" [level=3]
                - textbox "回答タイトル": 担当者cross-browser semantic証跡への回答
                - textbox "回答内容"
                - checkbox "質問者へ通知する" [checked]
                - status: 入力はこの画面に一時保持されていません
                - button "入力を一時保持" [disabled]
                - button "回答を送信" [disabled]
  `)

  const selectedQuestion = assignee.getByRole('button', { name: '担当者cross-browser semantic証跡を選択' })
  const status = assignee.getByRole('status')
  await expect(selectedQuestion).toHaveAttribute('aria-pressed', 'true')
  await expect(assignee.getByRole('combobox', { name: 'ステータス' })).toHaveValue('all')
  await expect(assignee.getByRole('checkbox', { name: '質問者へ通知する' })).toBeChecked()
  await expect(status).toHaveAttribute('aria-live', 'polite')

  await assignee.getByRole('textbox', { name: '回答内容' }).fill('FirefoxとWebKitで担当者回答のsemantic stateを確認します。')
  await expect(status).toHaveText('未送信の変更があります')
  await attachSemanticEvidence(assignee, testInfo, evidenceId, 'assignee-draft-changed', {
    statusFilterValue: await assignee.getByRole('combobox', { name: 'ステータス' }).inputValue(),
    selectedQuestionPressed: await selectedQuestion.getAttribute('aria-pressed'),
    notifyRequesterChecked: await assignee.getByRole('checkbox', { name: '質問者へ通知する' }).isChecked() ? 'true' : 'false',
    statusComputedRole: 'status',
    statusRoleAttribute: await status.getAttribute('role'),
    statusLive: await status.getAttribute('aria-live'),
    statusText: await status.innerText()
  })
})

test('E2E-UI-CROSS-BROWSER-SEMANTICS-004: documents expose stable cross-browser semantics @ui-quality', async ({ page }, testInfo) => {
  const evidenceId = 'E2E-UI-CROSS-BROWSER-SEMANTICS-004'
  await installDocumentsRoute(page)
  await page.goto('/')
  await signIn(page)
  await page.getByRole('navigation', { name: '画面' }).getByRole('button', { name: 'ドキュメント' }).click()

  const workspace = page.getByRole('region', { name: 'ドキュメント管理', exact: true })
  await expect(workspace).toBeVisible()
  await expectAriaSnapshot(workspace, testInfo, evidenceId, 'documents-idle', `
    - region "ドキュメント管理":
        - button "前の画面へ戻る"
        - heading "ドキュメント管理" [level=2]
        - navigation "パンくず"
        - complementary "フォルダツリー":
            - search:
                - searchbox "フォルダを検索"
        - region "登録文書一覧":
            - heading "すべてのドキュメント" [level=3]
            - region "現在の文書表示条件"
            - searchbox "ファイル名検索"
            - combobox "種別":
                - option "すべて" [selected]
            - combobox "状態":
                - option "すべて" [selected]
            - combobox "所属フォルダ":
                - option "すべて" [selected]
            - combobox "並び替え":
                - option "更新日 新しい順" [selected]
            - combobox "表示件数":
                - option "25件" [selected]
            - table "登録文書"
  `)

  const folderSearch = workspace.getByRole('searchbox', { name: 'フォルダを検索' })
  const fileNameSearch = workspace.getByRole('searchbox', { name: 'ファイル名検索' })
  const typeFilter = workspace.getByRole('combobox', { name: '種別' })
  const statusFilter = workspace.getByRole('combobox', { name: '状態' })
  const folderFilter = workspace.getByRole('combobox', { name: '所属フォルダ' })
  const sortOrder = workspace.getByRole('combobox', { name: '並び替え' })
  const pageSize = workspace.getByRole('combobox', { name: '表示件数' })
  await expect(folderSearch).toHaveValue('')
  await expect(fileNameSearch).toHaveValue('')
  await expect(typeFilter).toHaveValue('all')
  await expect(statusFilter).toHaveValue('all')
  await expect(folderFilter).toHaveValue('all')
  await expect(sortOrder).toHaveValue('updatedDesc')
  await expect(pageSize).toHaveValue('25')

  await workspace.getByRole('button', { name: 'cross-browser-policy.pdfの詳細を表示' }).click()
  const selectedRow = workspace.locator('[role="row"][aria-selected="true"]')
  await expect(selectedRow).toContainText('cross-browser-policy.pdf')

  const dialog = page.getByRole('dialog', { name: 'cross-browser-policy.pdf' })
  await expect(dialog).toBeVisible()
  await expectAriaSnapshot(dialog, testInfo, evidenceId, 'documents-detail', `
    - dialog "cross-browser-policy.pdf":
        - heading "cross-browser-policy.pdf" [level=3]
        - button "文書詳細を閉じる"
        - button "技術・品質詳細を表示"
        - button "この資料に質問する"
  `)

  const technicalDisclosure = dialog.getByRole('button', { name: '技術・品質詳細を表示' })
  await expect(technicalDisclosure).toHaveAttribute('aria-expanded', 'false')
  await technicalDisclosure.click()
  await expect(dialog.getByRole('button', { name: '技術・品質詳細を閉じる' })).toHaveAttribute('aria-expanded', 'true')
  await attachSemanticEvidence(dialog, testInfo, evidenceId, 'documents-detail-expanded', {
    folderSearchValue: await folderSearch.inputValue(),
    fileNameSearchValue: await fileNameSearch.inputValue(),
    typeFilterValue: await typeFilter.inputValue(),
    statusFilterValue: await statusFilter.inputValue(),
    folderFilterValue: await folderFilter.inputValue(),
    sortValue: await sortOrder.inputValue(),
    pageSizeValue: await pageSize.inputValue(),
    selectedRow: await selectedRow.getAttribute('aria-selected'),
    technicalDisclosureExpanded: await dialog.getByRole('button', { name: '技術・品質詳細を閉じる' }).getAttribute('aria-expanded')
  })
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
          runId: 'cross-browser-semantic-run',
          status: 'queued',
          eventsPath: '/chat-runs/cross-browser-semantic-run/events'
        }
      }
    })
  })

  await page.route(/http:\/\/127\.0\.0\.1:8787\/chat-runs\/cross-browser-semantic-run\/events$/, async (route) => {
    state.eventReads += 1
    await answerGate
    await route.fulfill({
      contentType: 'text/event-stream',
      body: 'id: 1\nevent: final\ndata: {"answer":"cross-browser semantic stateから回答へ復帰しました。","isAnswerable":true,"citations":[],"retrieved":[]}\n\n'
    })
  })

  return state
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
          questionId: 'cross-browser-semantic-assignee-1',
          title: '担当者cross-browser semantic証跡',
          question: '担当者画面の意味構造をFirefoxとWebKitで確認してください。',
          requesterName: '依頼者',
          requesterDepartment: '利用部門',
          assigneeDepartment: '総務部',
          assigneeGroupId: 'support',
          category: '手続き',
          priority: 'normal',
          status: 'open',
          sourceQuestion: '担当者画面の意味構造はbrowser間で安定しているか？',
          chatAnswer: '担当者による確認が必要です。',
          createdAt: '2026-08-27T00:00:00.000Z',
          updatedAt: '2026-08-27T00:00:00.000Z'
        }]
      }
    })
  })
}

async function installDocumentsRoute(page: Page) {
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
            documentId: 'cross-browser-document-1',
            fileName: 'cross-browser-policy.pdf',
            mimeType: 'application/pdf',
            chunkCount: 12,
            memoryCardCount: 3,
            status: 'ready',
            metadata: { groupIds: ['cross-browser-group-1'] },
            currentUserEffectivePermission: 'full',
            capabilities: {
              canRead: true,
              canShare: true,
              canMove: true,
              canDelete: true,
              canReindex: true
            },
            createdAt: '2026-08-28T00:00:00.000Z',
            updatedAt: '2026-08-28T00:01:00.000Z'
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
            groupId: 'cross-browser-group-1',
            name: 'cross-browser規程',
            normalizedName: 'cross-browser規程',
            canonicalPath: '/cross-browser規程',
            normalizedCanonicalPath: '/cross-browser規程',
            adminPrincipalType: 'user',
            adminPrincipalId: 'cross-browser-admin',
            adminPathPk: 'local-e2e#user#cross-browser-admin',
            parentPathPk: 'local-e2e#user#cross-browser-admin#ROOT',
            visibility: 'private',
            ownerUserId: 'cross-browser-admin',
            sharedUserIds: [],
            sharedGroups: [],
            managerUserIds: ['cross-browser-admin'],
            effectivePermission: 'full',
            detailLevel: 'manager',
            capabilities: { canRead: true, canManage: true },
            createdAt: '2026-08-28T00:00:00.000Z',
            updatedAt: '2026-08-28T00:01:00.000Z'
          }]
        }
      })
      return
    }

    await route.fulfill({ json: { migrations: [] } })
  })
}

async function signIn(page: Page) {
  await page.getByRole('textbox', { name: 'メールアドレス', exact: true }).fill('cross-browser-semantic@example.com')
  await page.getByRole('textbox', { name: 'パスワード', exact: true }).fill('LocalPassword123!')
  await page.getByRole('button', { name: 'サインイン', exact: true }).click()
  await expect(page.getByRole('region', { name: 'チャット', exact: true })).toBeVisible()
}

async function expectAriaSnapshot(
  locator: Locator,
  testInfo: TestInfo,
  evidenceId: string,
  label: string,
  expected: string
) {
  await expect(locator).toMatchAriaSnapshot(expected)
  await attachSemanticEvidence(locator, testInfo, evidenceId, label, {})
}

async function attachSemanticEvidence(
  locator: Locator,
  testInfo: TestInfo,
  evidenceId: string,
  label: string,
  state: Record<string, string | number | null>
) {
  const snapshot = await locator.ariaSnapshot()
  const project = testInfo.project.name
  await testInfo.attach(`${label}-${project}-aria-snapshot.yml`, {
    body: Buffer.from(`${snapshot}\n`, 'utf8'),
    contentType: 'application/yaml'
  })
  await testInfo.attach(`${label}-${project}-semantic-state.json`, {
    body: Buffer.from(`${JSON.stringify({
      evidenceId,
      project,
      boundary: 'Playwright ARIA snapshot plus DOM ARIA state evidence; not native browser AX-tree debug output or representative screen-reader evidence',
      state
    }, null, 2)}\n`, 'utf8'),
    contentType: 'application/json'
  })
}
