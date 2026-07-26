import { expect, type Locator, type Page, type Route, test } from '@playwright/test'

const initialViewport = { width: 320, height: 720 }
const compactViewport = { width: 320, height: 360 }
const answerMarker = 'VIEWPORT-KEYBOARD-PROXY-ANSWER'

type RectEvidence = {
  top: number
  right: number
  bottom: number
  left: number
  width: number
  height: number
}

type ViewportStateEvidence = {
  state: string
  url: string
  innerWidth: number
  innerHeight: number
  visualViewport: { width: number, height: number, offsetTop: number } | null
  activeElement: { tagName: string, ariaLabel: string | null }
  root: { clientWidth: number, scrollWidth: number }
  chat: { clientWidth: number, scrollWidth: number }
  layout: {
    mainArea: RectEvidence | null
    topbar: RectEvidence | null
    workspace: RectEvidence | null
    chatCard: RectEvidence | null
    resourceBoundary: RectEvidence | null
    messageList: RectEvidence | null
    runIdBar: RectEvidence | null
    composerNote: RectEvidence | null
    chatDisplay: string | null
    chatGridRows: string | null
    chatScroll: { clientHeight: number, scrollHeight: number, scrollTop: number } | null
    messageListFlex: string | null
    messageListMinHeight: string | null
  }
  controls: {
    composer: RectEvidence
    textbox: RectEvidence
    sendButton: RectEvidence
  }
}

async function installChatRoute(page: Page) {
  await page.route('http://127.0.0.1:8787/**', async (route: Route) => {
    const request = route.request()
    const path = new URL(request.url()).pathname
    const method = request.method()

    if (path === '/rpc/chat/startRun' && method === 'POST') {
      await route.fulfill({
        json: {
          json: {
            runId: 'viewport-keyboard-proxy-run',
            status: 'queued',
            eventsPath: '/chat-runs/viewport-keyboard-proxy-run/events'
          }
        }
      })
      return
    }
    if (path === '/chat-runs/viewport-keyboard-proxy-run/events' && method === 'GET') {
      await route.fulfill({
        contentType: 'text/event-stream',
        body: `id: 1\nevent: final\ndata: ${JSON.stringify({
          answer: `${answerMarker}: compact viewportでも回答を確認できます。`,
          isAnswerable: true,
          citations: [],
          retrieved: []
        })}\n\n`
      })
      return
    }

    await route.fallback()
  })
}

async function signIn(page: Page) {
  await page.goto('/')
  await page.getByPlaceholder('メールアドレスを入力').fill('local@example.com')
  await page.getByPlaceholder('パスワードを入力').fill('LocalPassword123!')
  await page.getByRole('button', { name: 'サインイン' }).click()
  await expect(page.getByRole('region', { name: 'チャット', exact: true })).toBeVisible()
}

async function rect(locator: Locator): Promise<RectEvidence> {
  return locator.evaluate((element) => {
    const value = element.getBoundingClientRect()
    return {
      top: value.top,
      right: value.right,
      bottom: value.bottom,
      left: value.left,
      width: value.width,
      height: value.height
    }
  })
}

async function collectViewportState(
  page: Page,
  state: string,
  composer: Locator,
  textbox: Locator,
  sendButton: Locator,
  chat: Locator
): Promise<ViewportStateEvidence> {
  const browserState = await page.evaluate(() => {
    const elementRect = (selector: string) => {
      const element = document.querySelector(selector)
      if (!element) return null
      const value = element.getBoundingClientRect()
      return {
        top: value.top,
        right: value.right,
        bottom: value.bottom,
        left: value.left,
        width: value.width,
        height: value.height
      }
    }

    return {
      innerWidth: window.innerWidth,
      innerHeight: window.innerHeight,
      visualViewport: window.visualViewport
        ? {
            width: window.visualViewport.width,
            height: window.visualViewport.height,
            offsetTop: window.visualViewport.offsetTop
          }
        : null,
      activeElement: {
        tagName: document.activeElement?.tagName ?? '',
        ariaLabel: document.activeElement?.getAttribute('aria-label') ?? null
      },
      root: {
        clientWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth
      },
      layout: {
        mainArea: elementRect('.main-area'),
        topbar: elementRect('.topbar'),
        workspace: elementRect('.split-workspace'),
        chatCard: elementRect('.chat-card'),
        resourceBoundary: elementRect('.chat-resource-boundary'),
        messageList: elementRect('.message-list'),
        runIdBar: elementRect('.chat-run-id-bar'),
        composerNote: elementRect('.composer-note'),
        chatDisplay: document.querySelector('.chat-card')
          ? window.getComputedStyle(document.querySelector('.chat-card')!).display
          : null,
        chatGridRows: document.querySelector('.chat-card')
          ? window.getComputedStyle(document.querySelector('.chat-card')!).gridTemplateRows
          : null,
        chatScroll: document.querySelector('.chat-card')
          ? {
              clientHeight: document.querySelector<HTMLElement>('.chat-card')!.clientHeight,
              scrollHeight: document.querySelector<HTMLElement>('.chat-card')!.scrollHeight,
              scrollTop: document.querySelector<HTMLElement>('.chat-card')!.scrollTop
            }
          : null,
        messageListFlex: document.querySelector('.message-list')
          ? window.getComputedStyle(document.querySelector('.message-list')!).flex
          : null,
        messageListMinHeight: document.querySelector('.message-list')
          ? window.getComputedStyle(document.querySelector('.message-list')!).minHeight
          : null
      }
    }
  })

  return {
    state,
    url: page.url(),
    ...browserState,
    chat: await chat.evaluate((element) => ({
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth
    })),
    controls: {
      composer: await rect(composer),
      textbox: await rect(textbox),
      sendButton: await rect(sendButton)
    }
  }
}

function expectControlInsideViewport(control: RectEvidence, viewportState: ViewportStateEvidence, label: string) {
  expect(control.top, `${label} の上端が viewport 外です`).toBeGreaterThanOrEqual(0)
  expect(control.left, `${label} の左端が viewport 外です`).toBeGreaterThanOrEqual(0)
  expect(control.right, `${label} の右端が viewport 外です`).toBeLessThanOrEqual(viewportState.innerWidth)
  expect(control.bottom, `${label} の下端が viewport 外です`).toBeLessThanOrEqual(viewportState.innerHeight)
}

test('E2E-UI-VIRTUAL-KEYBOARD-001: focus中のviewport縮小でもchatを送信できる @smoke', async ({ page }, testInfo) => {
  await page.setViewportSize(initialViewport)
  await installChatRoute(page)
  await signIn(page)

  const chat = page.getByRole('region', { name: 'チャット', exact: true })
  const composer = page.getByRole('form', { name: '質問入力' })
  const textbox = page.getByRole('textbox', { name: '質問', exact: true })
  const sendButton = page.getByRole('button', { name: '質問を送信', exact: true })

  await textbox.focus()
  await expect(textbox).toBeFocused()
  const initial = await collectViewportState(page, 'initial-focused', composer, textbox, sendButton, chat)
  expect(initial.innerWidth).toBe(initialViewport.width)
  expect(initial.innerHeight).toBe(initialViewport.height)

  await page.setViewportSize(compactViewport)
  await expect(textbox).toBeFocused()
  await textbox.fill('compact viewportで送信してください')
  await expect(sendButton).toBeEnabled()
  const compact = await collectViewportState(page, 'compact-focused', composer, textbox, sendButton, chat)

  expect(compact.innerWidth).toBe(compactViewport.width)
  expect(compact.innerHeight).toBe(compactViewport.height)
  if (compact.visualViewport) {
    expect(compact.visualViewport.width).toBe(compactViewport.width)
    expect(compact.visualViewport.height).toBe(compactViewport.height)
  }
  expect(compact.activeElement).toEqual({ tagName: 'TEXTAREA', ariaLabel: '質問' })
  expectControlInsideViewport(compact.controls.composer, compact, 'composer')
  expectControlInsideViewport(compact.controls.textbox, compact, 'textbox')
  expectControlInsideViewport(compact.controls.sendButton, compact, 'send button')
  expect(compact.root.scrollWidth).toBeLessThanOrEqual(compact.root.clientWidth)
  expect(compact.chat.scrollWidth).toBeLessThanOrEqual(compact.chat.clientWidth)

  await page.keyboard.press('Enter')
  const answer = chat.getByText(new RegExp(answerMarker))
  await expect(answer).toBeVisible()
  await answer.scrollIntoViewIfNeeded()
  await expect(answer).toBeInViewport()
  await textbox.focus()
  await expect(textbox).toBeFocused()

  const compactAnswered = await collectViewportState(page, 'compact-answered-refocused', composer, textbox, sendButton, chat)
  expectControlInsideViewport(compactAnswered.controls.composer, compactAnswered, 'answered composer')
  expect(compactAnswered.root.scrollWidth).toBeLessThanOrEqual(compactAnswered.root.clientWidth)
  expect(compactAnswered.chat.scrollWidth).toBeLessThanOrEqual(compactAnswered.chat.clientWidth)

  await page.setViewportSize(initialViewport)
  await expect(composer).toBeVisible()
  await expect(textbox).toBeFocused()
  const restored = await collectViewportState(page, 'restored', composer, textbox, sendButton, chat)
  expect(restored.innerHeight).toBe(initialViewport.height)
  expectControlInsideViewport(restored.controls.composer, restored, 'restored composer')

  await testInfo.attach('viewport-keyboard-proxy.json', {
    body: Buffer.from(JSON.stringify({
      evidenceId: 'E2E-UI-VIRTUAL-KEYBOARD-001',
      initialViewport,
      compactViewport,
      answerMarker,
      states: [initial, compact, compactAnswered, restored],
      evidenceBoundary: 'Viewport-height shrink proxy only; not a real mobile OS keyboard, IME, safe area, browser chrome, screen reader, or real-device result'
    }, null, 2)),
    contentType: 'application/json'
  })
})
