import { expect, type Page, type Route, test } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

type Actor = 'requester' | 'assignee'

type QuestionTicket = {
  questionId: string
  title: string
  question: string
  requesterName: string
  requesterUserId: string
  requesterDepartment: string
  assigneeDepartment: string
  assigneeGroupId: string
  category: string
  priority: 'normal' | 'high' | 'urgent'
  status: 'open' | 'in_progress' | 'waiting_requester' | 'answered' | 'resolved'
  messageId?: string
  sourceQuestion?: string
  chatAnswer?: string
  answerTitle?: string
  answerBody?: string
  responderName?: string
  responderDepartment?: string
  references?: string
  internalMemo?: string
  createdAt: string
  updatedAt: string
  answeredAt?: string
  resolvedAt?: string
}

test('E2E-UI-QUESTION-001: requester refusal → assigned answer → owner resolution keeps target state and evidence @smoke', async ({ page }) => {
  let actor: Actor = 'requester'
  let ticket: QuestionTicket | undefined
  let history: Array<Record<string, unknown>> = []
  const createBodies: Array<Record<string, unknown>> = []

  await installQuestionJourneyApi(page, () => actor, {
    getTicket: () => ticket,
    setTicket: (next) => { ticket = next },
    getHistory: () => history,
    setHistory: (next) => { history = next },
    createBodies
  })

  await signIn(page, 'requester@example.com')
  const prompt = page.getByRole('textbox', { name: '質問', exact: true })
  await prompt.fill('申請期限の例外を確認したい')
  await prompt.press('Enter')

  await expect(page.getByText('処理中', { exact: true })).toBeVisible()
  await expect(page.getByRole('group', { name: '回答状態' })).toContainText('回答不能')
  await expect(page.getByRole('group', { name: '回答状態' })).toContainText('参照元 0 件')
  await expect(page.getByRole('form', { name: '担当者へ質問' })).toBeVisible()
  await assertNoAxeViolations(page, '.message-list')

  const escalationTitle = page.getByRole('textbox', { name: '件名' })
  await escalationTitle.focus()
  await page.keyboard.press('Tab')
  await expect(page.getByRole('textbox', { name: '質問内容' })).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(page.getByRole('combobox', { name: 'カテゴリ' })).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(page.getByRole('combobox', { name: '優先度' })).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(page.getByRole('textbox', { name: '担当部署' })).toBeFocused()
  await page.keyboard.press('Tab')
  const escalationSubmit = page.getByRole('button', { name: '担当者へ送信' })
  await expect(escalationSubmit).toBeFocused()
  await page.keyboard.press('Enter')
  const ticketRegion = page.getByRole('region', { name: /問い合わせ状態/ })
  await expect(ticketRegion).toContainText('担当割当済み')
  await expect(ticketRegion).toContainText('question-journey-1')
  await expect(page.getByRole('status', { name: /担当者への問い合わせ送信/ })).toContainText('完了')
  expect(createBodies).toHaveLength(1)
  expect(createBodies[0]?.messageId).toMatch(/^[-a-zA-Z0-9]+$/)

  actor = 'assignee'
  await page.goto('/?view=assignee')
  await expect(page.getByRole('region', { name: '担当者対応' })).toBeVisible()
  await expect(page.getByRole('button', { name: /申請期限の例外を確認したい.*を選択/ })).toBeVisible()
  await expect(page.getByText('未対応 / 総務')).toBeVisible()
  await page.getByRole('textbox', { name: '回答内容' }).fill(
    Array.from({ length: 16 }, (_, index) => `確認結果 ${index + 1}: 例外申請は所属長の承認後に提出します。`).join('\n')
  )
  await page.getByRole('textbox', { name: '参照資料 / 関連リンク' }).fill('就業規則 7章')
  await page.getByRole('textbox', { name: '内部メモ' }).fill('内部限定メモ')
  await page.getByRole('button', { name: '回答を送信' }).click()
  await expect(page.getByRole('status', { name: /担当者回答の送信/ })).toContainText('完了')
  await expect(page.getByText('依頼者確認待ち', { exact: true }).first()).toBeVisible()
  await assertNoAxeViolations(page, '.assignee-workspace')
  await expect.poll(() => history.length).toBe(1)

  history = [
    ...history,
    ...Array.from({ length: 18 }, (_, index) => ({
      schemaVersion: 1,
      id: `history-extra-${index + 1}`,
      title: `過去の会話 ${index + 1}`,
      updatedAt: `2026-07-13T${String(index).padStart(2, '0')}:00:00.000Z`,
      isFavorite: false,
      messages: [{ role: 'user', text: `過去の質問 ${index + 1}`, createdAt: '2026-07-13T00:00:00.000Z' }]
    }))
  ]
  actor = 'requester'
  await page.goto('/?view=history')
  await expect(page.getByText(/19 件の会話/)).toBeVisible()
  const historyConversation = page.locator('.history-item').filter({ hasText: '申請期限の例外を確認したい' })
  await expect(historyConversation).toContainText('担当者回答あり')
  await expect(historyConversation).toContainText('次の操作')
  await assertNoAxeViolations(page, 'section[aria-label="履歴"]')
  await historyConversation.locator('button').filter({ hasText: '申請期限の例外を確認したい' }).click()

  const answerPanel = page.getByLabel('担当者からの回答')
  await expect(answerPanel).toContainText('就業規則 7章')
  await expect(answerPanel).toContainText('確認結果 16')
  await expect(page.getByText('内部限定メモ')).toHaveCount(0)
  await page.getByRole('button', { name: '解決した' }).click()
  await expect(page.getByRole('status', { name: /問い合わせの解決/ })).toContainText('完了')
  await expect(ticketRegion).toContainText('解決済み')

  await page.setViewportSize({ width: 390, height: 844 })
  await expect(answerPanel).toBeVisible()
  const horizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  expect(horizontalOverflow).toBeLessThanOrEqual(1)
})

test('E2E-UI-QUESTION-002: answer with citations and clarification remain distinct at mobile width', async ({ page }) => {
  let run = 0
  await page.route('**/config.json', (route) => route.fulfill({ json: { apiBaseUrl: 'http://api.question.test' } }))
  await page.route(/http:\/\/(?:api\.question\.test|127\.0\.0\.1:8787)\/.*/, async (route) => {
    const path = new URL(route.request().url()).pathname
    const method = route.request().method()
    if (path === '/me') {
      await route.fulfill({ json: { user: requesterUser() } })
      return
    }
    if (path === '/conversation-history') {
      if (method === 'GET') await route.fulfill({ json: { history: [] } })
      else await route.fulfill({ json: JSON.parse(route.request().postData() ?? '{}') })
      return
    }
    if (path === '/favorites') {
      await route.fulfill({ json: { favorites: [] } })
      return
    }
    if (path === '/rpc/chat/startRun') {
      run += 1
      await route.fulfill({ json: { json: { runId: `chat-${run}`, status: 'queued', eventsPath: `/chat-runs/chat-${run}/events` } } })
      return
    }
    if (path === '/chat-runs/chat-1/events') {
      await route.fulfill({
        contentType: 'text/event-stream',
        body: sseFinal({
          responseType: 'answer',
          answer: Array.from({ length: 18 }, (_, index) => `長い回答 ${index + 1}: 申請内容を確認してください。`).join('\n'),
          isAnswerable: true,
          citations: [{ documentId: 'doc-1', fileName: 'policy.md', chunkId: 'chunk-1', score: 0.93 }],
          retrieved: []
        })
      })
      return
    }
    if (path === '/chat-runs/chat-2/events') {
      await route.fulfill({
        contentType: 'text/event-stream',
        body: sseFinal({
          responseType: 'clarification',
          answer: '対象の申請を確認してください。',
          isAnswerable: false,
          needsClarification: true,
          clarification: {
            question: 'どの申請ですか？',
            options: [{ id: 'leave', label: '休暇申請', resolvedQuery: '休暇申請の期限は？' }]
          },
          citations: [],
          retrieved: []
        })
      })
      return
    }
    await route.fulfill({ json: {} })
  })

  await page.setViewportSize({ width: 390, height: 844 })
  await signIn(page, 'requester@example.com')
  const prompt = page.getByRole('textbox', { name: '質問', exact: true })
  await prompt.fill('申請期限を教えて')
  await prompt.press('Enter')
  await expect(page.getByRole('group', { name: '回答状態' })).toContainText('回答')
  await expect(page.getByRole('group', { name: '回答状態' })).toContainText('参照元 1 件')
  await expect(page.getByRole('link', { name: /policy.md/ })).toBeVisible()

  await prompt.fill('それはどの申請？')
  await prompt.press('Enter')
  await expect(page.getByRole('group', { name: '回答状態' }).last()).toContainText('確認が必要')
  await expect(page.getByRole('button', { name: '休暇申請' })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1)
  await assertNoAxeViolations(page, '.message-list')
})

async function installQuestionJourneyApi(
  page: Page,
  actor: () => Actor,
  state: {
    getTicket: () => QuestionTicket | undefined
    setTicket: (ticket: QuestionTicket) => void
    getHistory: () => Array<Record<string, unknown>>
    setHistory: (history: Array<Record<string, unknown>>) => void
    createBodies: Array<Record<string, unknown>>
  }
) {
  await page.route('**/config.json', (route) => route.fulfill({ json: { apiBaseUrl: 'http://api.question.test' } }))
  await page.route(/http:\/\/(?:api\.question\.test|127\.0\.0\.1:8787)\/.*/, async (route) => handleQuestionJourneyRoute(route, actor, state))
}

async function handleQuestionJourneyRoute(
  route: Route,
  actor: () => Actor,
  state: {
    getTicket: () => QuestionTicket | undefined
    setTicket: (ticket: QuestionTicket) => void
    getHistory: () => Array<Record<string, unknown>>
    setHistory: (history: Array<Record<string, unknown>>) => void
    createBodies: Array<Record<string, unknown>>
  }
) {
  const request = route.request()
  const path = new URL(request.url()).pathname
  const method = request.method()
  if (path === '/me') {
    await route.fulfill({ json: { user: actor() === 'requester' ? requesterUser() : assigneeUser() } })
    return
  }
  if (path === '/conversation-history') {
    if (method === 'GET') {
      await route.fulfill({ json: { history: state.getHistory() } })
    } else {
      const item = JSON.parse(request.postData() ?? '{}') as Record<string, unknown>
      state.setHistory([item, ...state.getHistory().filter((candidate) => candidate.id !== item.id)])
      await route.fulfill({ json: item })
    }
    return
  }
  if (path === '/favorites') {
    await route.fulfill({ json: { favorites: [] } })
    return
  }
  if (path === '/rpc/chat/startRun') {
    await route.fulfill({ json: { json: { runId: 'question-run', status: 'queued', eventsPath: '/chat-runs/question-run/events' } } })
    return
  }
  if (path === '/chat-runs/question-run/events') {
    await new Promise((resolve) => setTimeout(resolve, 180))
    await route.fulfill({
      contentType: 'text/event-stream',
      body: sseFinal({ responseType: 'refusal', answer: '資料からは回答できません。', isAnswerable: false, citations: [], retrieved: [] })
    })
    return
  }
  if (path === '/questions' && method === 'POST') {
    const body = JSON.parse(request.postData() ?? '{}') as Record<string, unknown>
    state.createBodies.push(body)
    const created: QuestionTicket = {
      questionId: 'question-journey-1',
      title: String(body.title),
      question: String(body.question),
      requesterName: '依頼者',
      requesterUserId: 'requester-1',
      requesterDepartment: '利用部門',
      assigneeDepartment: String(body.assigneeDepartment || '総務'),
      assigneeGroupId: 'support',
      category: String(body.category || 'その他の質問'),
      priority: (body.priority as QuestionTicket['priority']) || 'normal',
      status: 'open',
      messageId: String(body.messageId),
      sourceQuestion: String(body.sourceQuestion),
      chatAnswer: String(body.chatAnswer),
      createdAt: '2026-07-14T00:00:00.000Z',
      updatedAt: '2026-07-14T00:00:00.000Z'
    }
    state.setTicket(created)
    await route.fulfill({ json: created })
    return
  }
  if (path === '/questions' && method === 'GET') {
    await route.fulfill({ json: { questions: state.getTicket() ? [state.getTicket()] : [] } })
    return
  }
  if (path === '/questions/question-journey-1' && method === 'GET') {
    const current = state.getTicket()
    if (actor() === 'requester' && current) {
      const requesterVisible: Partial<QuestionTicket> = { ...current }
      delete requesterVisible.internalMemo
      await route.fulfill({ json: requesterVisible })
    } else {
      await route.fulfill({ json: current })
    }
    return
  }
  if (path === '/questions/question-journey-1/answer' && method === 'POST') {
    const body = JSON.parse(request.postData() ?? '{}') as Record<string, unknown>
    const current = state.getTicket()
    if (!current) throw new Error('ticket fixture is missing')
    const answered: QuestionTicket = {
      ...current,
      ...body,
      status: 'answered',
      answeredAt: '2026-07-14T01:00:00.000Z',
      updatedAt: '2026-07-14T01:00:00.000Z'
    }
    state.setTicket(answered)
    await route.fulfill({ json: answered })
    return
  }
  if (path === '/questions/question-journey-1/resolve' && method === 'POST') {
    const current = state.getTicket()
    if (!current) throw new Error('ticket fixture is missing')
    const resolved: QuestionTicket = {
      ...current,
      status: 'resolved',
      resolvedAt: '2026-07-14T02:00:00.000Z',
      updatedAt: '2026-07-14T02:00:00.000Z'
    }
    state.setTicket(resolved)
    await route.fulfill({ json: resolved })
    return
  }
  await route.fulfill({ json: {} })
}

function requesterUser() {
  return {
    userId: 'requester-1',
    email: 'requester@example.com',
    groups: ['CHAT_USER'],
    permissions: ['chat:create', 'chat:read:own', 'chat:delete:own']
  }
}

function assigneeUser() {
  return {
    userId: 'answerer-1',
    email: 'answerer@example.com',
    groups: ['ANSWER_EDITOR', 'support'],
    permissions: ['chat:create', 'answer:edit', 'answer:publish']
  }
}

async function signIn(page: Page, email: string) {
  await page.goto('/')
  await page.getByPlaceholder('メールアドレスを入力').fill(email)
  await page.getByPlaceholder('パスワードを入力').fill('LocalPassword123!')
  await page.getByRole('button', { name: 'サインイン' }).click()
  await expect(page.locator('section[aria-label="チャット"]')).toBeVisible()
}

async function assertNoAxeViolations(page: Page, selector: string) {
  const scan = await new AxeBuilder({ page }).include(selector).analyze()
  expect(scan.violations, JSON.stringify(scan.violations, null, 2)).toEqual([])
}

function sseFinal(data: Record<string, unknown>): string {
  return `id: 1\nevent: final\ndata: ${JSON.stringify(data)}\n\n`
}
