import { expect, type Locator, type Page, test } from '@playwright/test'

type KeyboardDestination = {
  label: string
  key: 'Enter' | 'Space'
  url: RegExp
  region: string
}

type ChatKeyboardRouteState = {
  startRuns: number
  eventReads: number
  releaseAnswer: () => void
}

const destinations: KeyboardDestination[] = [
  {
    label: '履歴',
    key: 'Enter',
    url: /\?view=history$/,
    region: '履歴'
  },
  {
    label: 'お気に入り',
    key: 'Space',
    url: /\?view=favorites$/,
    region: 'お気に入り'
  },
  {
    label: 'ドキュメント',
    key: 'Enter',
    url: /\/documents$/,
    region: 'ドキュメント管理'
  },
  {
    label: '担当者対応',
    key: 'Space',
    url: /\?view=assignee$/,
    region: '担当者対応'
  },
  {
    label: '管理者設定',
    key: 'Enter',
    url: /\?view=admin$/,
    region: '管理者設定'
  },
  {
    label: '個人設定',
    key: 'Space',
    url: /\?view=profile$/,
    region: '個人設定'
  }
]

test('E2E-UI-KEYBOARD-NAV-001: primary views, history, favorites, assignee, and profile controls remain keyboard reachable @smoke @ui-quality', async ({ page }) => {
  const chatRouteState = await installChatRoute(page)
  await installHistoryRoute(page)
  await installFavoritesRoute(page)
  await installAssigneeRoute(page)
  await page.goto('/')
  await keyboardSignIn(page)

  await verifyChatKeyboardJourney(page, chatRouteState)

  const navigation = page.getByRole('navigation', { name: '画面' })
  await expect(navigation).toBeVisible()
  await expect(page.getByRole('region', { name: 'チャット', exact: true })).toBeVisible()

  const chat = navigation.getByRole('button', { name: 'チャット' })
  await tabTo(page, chat, 'Shift+Tab')
  await expectKeyboardFocus(chat)
  await expect(chat).toHaveAttribute('aria-current', 'page')

  for (const destination of destinations) {
    const control = destination.label === '個人設定'
      ? page.getByRole('button', { name: destination.label, exact: true })
      : navigation.getByRole('button', { name: destination.label, exact: true })

    await tabTo(page, control)
    await expectKeyboardFocus(control)
    await page.keyboard.press(destination.key)

    await expect(page).toHaveURL(destination.url)
    await expect(page.getByRole('region', { name: destination.region, exact: true })).toBeVisible()
    await expect(control).toHaveAttribute('aria-current', 'page')

    if (destination.label === '履歴') {
      await verifyHistoryKeyboardJourney(page)
    }
    if (destination.label === 'お気に入り') {
      await verifyFavoritesKeyboardJourney(page)
    }
    if (destination.label === '担当者対応') {
      await verifyAssigneeKeyboardJourney(page)
    }
  }

  const submitShortcut = page.getByRole('combobox', { name: '送信キー' })
  await tabTo(page, submitShortcut)
  await expectKeyboardFocus(submitShortcut)
  await expect(submitShortcut).toHaveValue('enter')
  await page.keyboard.press('ArrowDown')
  await expect(submitShortcut).toHaveValue('ctrlEnter')

  const backToChat = page.getByRole('button', { name: 'チャットへ戻る' })
  await tabTo(page, backToChat)
  await expectKeyboardFocus(backToChat)
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(/\/$/)
  await expect(page.getByRole('region', { name: 'チャット', exact: true })).toBeVisible()
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
          id: 'keyboard-history-1',
          title: '履歴のkeyboard証跡',
          updatedAt: '2026-08-06T00:00:00.000Z',
          isFavorite: true,
          messages: [{
            role: 'user',
            text: 'keyboard-onlyで履歴を確認する',
            createdAt: '2026-08-06T00:00:00.000Z'
          }]
        }]
      }
    })
  })
}

async function installChatRoute(page: Page): Promise<ChatKeyboardRouteState> {
  let releaseAnswer: () => void = () => undefined
  const answerGate = new Promise<void>((resolve) => { releaseAnswer = resolve })
  const state: ChatKeyboardRouteState = {
    startRuns: 0,
    eventReads: 0,
    releaseAnswer: () => releaseAnswer()
  }

  await page.route(/http:\/\/127\.0\.0\.1:8787\/rpc\/chat\/startRun$/, async (route) => {
    state.startRuns += 1
    await route.fulfill({
      json: {
        json: {
          runId: 'keyboard-chat-run',
          status: 'queued',
          eventsPath: '/chat-runs/keyboard-chat-run/events'
        }
      }
    })
  })

  await page.route(/http:\/\/127\.0\.0\.1:8787\/chat-runs\/keyboard-chat-run\/events$/, async (route) => {
    state.eventReads += 1
    await answerGate
    await route.fulfill({
      contentType: 'text/event-stream',
      body: 'id: 1\nevent: final\ndata: {"answer":"keyboard-onlyで回答へ復帰しました。","isAnswerable":true,"citations":[],"retrieved":[]}\n\n'
    })
  })

  return state
}

async function installFavoritesRoute(page: Page) {
  await page.route(/http:\/\/127\.0\.0\.1:8787\/favorites$/, async (route) => {
    if (route.request().method() !== 'GET') {
      await route.fallback()
      return
    }

    await route.fulfill({
      json: {
        favorites: [{
          favoriteId: 'keyboard-favorite-1',
          targetType: 'chatSession',
          targetId: 'keyboard-conversation-1',
          label: 'お気に入りのkeyboard証跡',
          accessible: true,
          createdAt: '2026-08-08T00:00:00.000Z',
          updatedAt: '2026-08-08T00:00:00.000Z'
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
          questionId: 'keyboard-assignee-1',
          title: '担当者keyboard対応',
          question: 'keyboard-onlyで回答を一時保持してください。',
          requesterName: '依頼者',
          requesterDepartment: '利用部門',
          assigneeDepartment: '総務部',
          assigneeGroupId: 'support',
          category: '手続き',
          priority: 'normal',
          status: 'open',
          sourceQuestion: '担当者画面をkeyboardで操作できるか？',
          chatAnswer: '担当者による確認が必要です。',
          createdAt: '2026-08-17T00:00:00.000Z',
          updatedAt: '2026-08-17T00:00:00.000Z'
        }]
      }
    })
  })
}

async function verifyHistoryKeyboardJourney(page: Page) {
  const search = page.getByRole('searchbox', { name: '履歴を検索' })
  await tabTo(page, search)
  await expectKeyboardFocus(search)
  await page.keyboard.type('keyboard')
  await expect(search).toHaveValue('keyboard')

  const sortOrder = page.getByRole('combobox', { name: '履歴の並び順' })
  await tabTo(page, sortOrder)
  await expectKeyboardFocus(sortOrder)
  await page.keyboard.press('ArrowDown')
  await expect(sortOrder).toHaveValue('oldest')

  const favoritesOnly = page.getByRole('checkbox', { name: 'お気に入りのみ' })
  await tabTo(page, favoritesOnly)
  await expectKeyboardFocus(favoritesOnly)
  await page.keyboard.press('Space')
  await expect(favoritesOnly).toBeChecked()

  const conversation = page.locator('.history-item > button:not(.favorite-toggle):not(.history-delete-button)', {
    hasText: '履歴のkeyboard証跡'
  })
  await tabTo(page, conversation)
  await expectKeyboardFocus(conversation)
  await page.keyboard.press('Enter')
  await expect(page.getByRole('region', { name: 'チャット', exact: true })).toBeVisible()
}

async function verifyChatKeyboardJourney(page: Page, routeState: ChatKeyboardRouteState) {
  const chat = page.getByRole('region', { name: 'チャット', exact: true })
  const question = chat.getByRole('textbox', { name: '質問' })
  await tabTo(page, question)
  await expect(question).toBeFocused()

  const composer = chat.getByRole('form', { name: '質問入力' })
  await expect.poll(async () => composer.evaluate((element) => {
    const style = getComputedStyle(element)
    return `${style.outlineStyle}:${style.outlineWidth}:${style.outlineColor}`
  })).toMatch(/^solid:3px:/)

  await page.keyboard.type('keyboard-onlyでチャットを送信する')
  await page.keyboard.press('Enter')

  await expect(chat.locator('.processing-row')).toContainText('回答を生成中')
  await expect.poll(() => routeState.startRuns).toBe(1)
  await expect.poll(() => routeState.eventReads).toBe(1)
  routeState.releaseAnswer()
  await expect(chat.getByText('keyboard-onlyで回答へ復帰しました。')).toBeVisible()
  await expect(chat.locator('.processing-row')).toHaveCount(0)
  await expect(question).toBeEnabled()
}

async function verifyFavoritesKeyboardJourney(page: Page) {
  await expect(page.getByText('お気に入りのkeyboard証跡')).toBeVisible()

  const backToChat = page.getByRole('button', { name: 'チャットへ戻る' })
  await tabTo(page, backToChat)
  await expectKeyboardFocus(backToChat)
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(/\/$/)
  await expect(page.getByRole('region', { name: 'チャット', exact: true })).toBeVisible()
}

async function verifyAssigneeKeyboardJourney(page: Page) {
  const statusFilter = page.getByRole('combobox', { name: 'ステータス' })
  await tabTo(page, statusFilter)
  await expectKeyboardFocus(statusFilter)
  await page.keyboard.press('ArrowDown')
  await expect(statusFilter).toHaveValue('unassigned')

  const search = page.getByRole('searchbox', { name: '検索' })
  await tabTo(page, search)
  await expectKeyboardFocus(search)
  await page.keyboard.type('keyboard')
  await expect(search).toHaveValue('keyboard')

  const question = page.getByRole('button', { name: '担当者keyboard対応を選択' })
  await tabTo(page, question)
  await expectKeyboardFocus(question)
  await expect(question).toHaveAttribute('aria-pressed', 'true')
  await page.keyboard.press('Enter')
  await expect(question).toHaveAttribute('aria-pressed', 'true')

  const answerBody = page.getByRole('textbox', { name: '回答内容' })
  await tabTo(page, answerBody)
  await expectKeyboardFocus(answerBody)
  await page.keyboard.type('keyboard-onlyで入力した一時回答')
  await expect(answerBody).toHaveValue('keyboard-onlyで入力した一時回答')

  const notifyRequester = page.getByRole('checkbox', { name: '質問者へ通知する' })
  await tabTo(page, notifyRequester)
  await expectKeyboardFocus(notifyRequester)
  await expect(notifyRequester).toBeChecked()
  await page.keyboard.press('Space')
  await expect(notifyRequester).not.toBeChecked()

  const holdDraft = page.getByRole('button', { name: '入力を一時保持' })
  await tabTo(page, holdDraft)
  await expectKeyboardFocus(holdDraft)
  await page.keyboard.press('Enter')
  await expect(page.getByRole('status')).toContainText('この画面に入力を一時保持')
}

async function keyboardSignIn(page: Page) {
  const email = page.getByRole('textbox', { name: 'メールアドレス' })
  await tabTo(page, email)
  await page.keyboard.type('keyboard-admin@example.com')

  const password = page.getByRole('textbox', { name: 'パスワード' })
  await tabTo(page, password)
  await page.keyboard.type('LocalPassword123!')

  const submit = page.getByRole('button', { name: 'サインイン' })
  await tabTo(page, submit)
  await page.keyboard.press('Enter')
  await expect(page.getByRole('region', { name: 'チャット', exact: true })).toBeVisible()
}

async function tabTo(page: Page, target: Locator, key: 'Tab' | 'Shift+Tab' = 'Tab') {
  const visitedFocusTargets: string[] = []
  const traversalKeys: Array<'Tab' | 'Shift+Tab'> = [key, key === 'Tab' ? 'Shift+Tab' : 'Tab']

  for (const traversalKey of traversalKeys) {
    let stagnantSteps = 0

    for (let index = 0; index < 120; index += 1) {
      const previousFocus = await page.evaluateHandle(() => document.activeElement)
      await page.keyboard.press(traversalKey)
      const targetReached = await target.evaluate((element) => element === document.activeElement)
      const focusDidNotMove = await previousFocus.evaluate((element) => element === document.activeElement)
      await previousFocus.dispose()
      if (targetReached) return

      const focusTarget = await page.evaluate(() => {
        const activeElement = document.activeElement
        if (!(activeElement instanceof HTMLElement)) return 'unknown'

        const accessibleName = activeElement.getAttribute('aria-label')
          ?? activeElement.getAttribute('name')
          ?? activeElement.textContent?.trim().slice(0, 40)
          ?? ''
        return `${activeElement.tagName.toLowerCase()}${accessibleName ? `:${accessibleName}` : ''}`
      })
      visitedFocusTargets.push(`${traversalKey}:${focusTarget}`)

      stagnantSteps = focusDidNotMove ? stagnantSteps + 1 : 0
      if (stagnantSteps >= 2) break
    }
  }

  const targetName = await target.getAttribute('aria-label') ?? await target.textContent() ?? 'target'
  throw new Error(`Tab traversal did not reach ${targetName}; last focus targets: ${visitedFocusTargets.slice(-12).join(' -> ')}`)
}

async function expectKeyboardFocus(target: Locator) {
  await expect(target).toBeFocused()
  await expect.poll(async () => target.evaluate((element) => {
    const style = getComputedStyle(element)
    return `${style.outlineStyle}:${style.outlineWidth}:${style.outlineColor}`
  })).toMatch(/^solid:3px:/)
}
