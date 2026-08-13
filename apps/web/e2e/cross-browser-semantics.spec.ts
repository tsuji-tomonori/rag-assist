import { expect, type Locator, type Page, type TestInfo, test } from '@playwright/test'

type ChatSemanticRouteState = {
  startRuns: number
  eventReads: number
  releaseAnswer: () => void
}

test('E2E-UI-CROSS-BROWSER-SEMANTICS-001: login and chat expose stable cross-browser semantics @ui-quality', async ({ page }, testInfo) => {
  const routeState = await installChatRoute(page)
  await page.goto('/')

  await expectAriaSnapshot(page.locator('body'), testInfo, 'login', `
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
  await expectAriaSnapshot(page.locator('body'), testInfo, 'chat-idle', `
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
  await attachSemanticEvidence(chat, testInfo, 'chat-processing', {
    chatBusy: await chat.getAttribute('aria-busy'),
    processingComputedRole: 'article',
    processingRoleAttribute: await processing.getAttribute('role'),
    processingLive: await processing.getAttribute('aria-live')
  })

  routeState.releaseAnswer()
  await expect(chat.getByText('cross-browser semantic stateから回答へ復帰しました。')).toBeVisible()
  await expect(processing).toHaveCount(0)
  await expect(chat).toHaveAttribute('aria-busy', 'false')
  await attachSemanticEvidence(chat, testInfo, 'chat-completed', {
    chatBusy: await chat.getAttribute('aria-busy'),
    processingCount: await processing.count()
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

async function signIn(page: Page) {
  await page.getByRole('textbox', { name: 'メールアドレス', exact: true }).fill('cross-browser-semantic@example.com')
  await page.getByRole('textbox', { name: 'パスワード', exact: true }).fill('LocalPassword123!')
  await page.getByRole('button', { name: 'サインイン', exact: true }).click()
  await expect(page.getByRole('region', { name: 'チャット', exact: true })).toBeVisible()
}

async function expectAriaSnapshot(
  locator: Locator,
  testInfo: TestInfo,
  label: string,
  expected: string
) {
  await expect(locator).toMatchAriaSnapshot(expected)
  await attachSemanticEvidence(locator, testInfo, label, {})
}

async function attachSemanticEvidence(
  locator: Locator,
  testInfo: TestInfo,
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
      evidenceId: 'E2E-UI-CROSS-BROWSER-SEMANTICS-001',
      project,
      boundary: 'Playwright ARIA snapshot plus DOM ARIA state evidence; not native browser AX-tree debug output or representative screen-reader evidence',
      state
    }, null, 2)}\n`, 'utf8'),
    contentType: 'application/json'
  })
}
