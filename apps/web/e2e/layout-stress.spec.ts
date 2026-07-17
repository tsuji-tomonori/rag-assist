import { expect, type Locator, type Page, type Route, test } from '@playwright/test'

const viewport = { width: 320, height: 720 }
const longFileName = `2026_全社横断アクセシビリティ確認資料_${'非常に長い識別子'.repeat(10)}_最終版.pdf`
const longAnswer = [
  'LAYOUT-STRESS-START: 長文回答の先頭です。',
  ...Array.from({ length: 24 }, (_, index) => `確認項目 ${index + 1}: 画面幅が狭い場合も、情報を省略せず折り返して表示します。`),
  'LAYOUT-STRESS-END: 長文回答の末尾です。'
].join('\n\n')
const historyItems = Array.from({ length: 35 }, (_, index) => ({
  id: `layout-history-${String(index + 1).padStart(2, '0')}`,
  title: `履歴 ${String(index + 1).padStart(2, '0')} ${'長い会話タイトル'.repeat(index === 0 || index === 34 ? 6 : 1)}`,
  updatedAt: `2026-07-17T${String(index % 24).padStart(2, '0')}:${String(index).padStart(2, '0')}:00.000Z`,
  isFavorite: false,
  messages: [{
    role: 'user',
    text: `履歴 ${index + 1} の確認内容`,
    createdAt: '2026-07-17T00:00:00.000Z'
  }]
}))

type ScrollRecord = {
  behavior: ScrollBehavior | null
  className: string
  text: string
}

type DimensionEvidence = {
  view: string
  url: string
  root: { clientWidth: number, scrollWidth: number }
  region: { clientWidth: number, scrollWidth: number }
}

async function installScrollObservation(page: Page) {
  await page.addInitScript(() => {
    const observedWindow = window as Window & { __layoutStressScrollCalls?: ScrollRecord[] }
    observedWindow.__layoutStressScrollCalls = []
    const originalScrollIntoView = Element.prototype.scrollIntoView

    Element.prototype.scrollIntoView = function (options?: boolean | ScrollIntoViewOptions) {
      observedWindow.__layoutStressScrollCalls?.push({
        behavior: typeof options === 'object' ? options.behavior ?? null : null,
        className: this instanceof HTMLElement ? this.className : '',
        text: (this.textContent ?? '').slice(-160)
      })
      originalScrollIntoView?.call(this, options)
    }
  })
}

async function installLayoutStressRoutes(page: Page) {
  await page.route('http://127.0.0.1:8787/**', async (route: Route) => {
    const request = route.request()
    const path = new URL(request.url()).pathname
    const method = request.method()

    if (path === '/documents' && method === 'GET') {
      await route.fulfill({
        json: {
          documents: [{
            documentId: 'layout-stress-document',
            fileName: longFileName,
            mimeType: 'application/pdf',
            chunkCount: 42,
            memoryCardCount: 8,
            status: 'ready',
            createdAt: '2026-07-17T00:00:00.000Z',
            updatedAt: '2026-07-17T00:01:00.000Z'
          }]
        }
      })
      return
    }
    if (path === '/document-groups' && method === 'GET') {
      await route.fulfill({ json: { groups: [] } })
      return
    }
    if (path === '/documents/reindex-migrations' && method === 'GET') {
      await route.fulfill({ json: { migrations: [] } })
      return
    }
    if (path === '/conversation-history' && method === 'GET') {
      await route.fulfill({ json: { history: historyItems } })
      return
    }
    if (path === '/favorites' && method === 'GET') {
      await route.fulfill({ json: { favorites: [] } })
      return
    }
    if (path === '/rpc/chat/startRun' && method === 'POST') {
      await route.fulfill({
        json: {
          json: {
            runId: 'layout-stress-chat-run',
            status: 'queued',
            eventsPath: '/chat-runs/layout-stress-chat-run/events'
          }
        }
      })
      return
    }
    if (path === '/chat-runs/layout-stress-chat-run/events' && method === 'GET') {
      await route.fulfill({
        contentType: 'text/event-stream',
        body: `id: 1\nevent: final\ndata: ${JSON.stringify({
          answer: longAnswer,
          isAnswerable: true,
          citations: [{
            documentId: 'layout-stress-document',
            fileName: longFileName,
            chunkId: 'layout-stress-chunk',
            score: 0.98,
            text: '長文回答を支えるテスト専用の参照文です。'
          }],
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

async function openMobileDestination(page: Page, label: string, regionName: string) {
  await page.getByRole('button', { name: 'メニューを開く' }).click()
  const panel = page.locator('.mobile-navigation-panel')
  await expect(page.getByRole('navigation', { name: 'モバイル画面' })).toBeVisible()
  await panel.getByRole('button', { name: label, exact: true }).click()
  const region = page.getByRole('region', { name: regionName, exact: true })
  await expect(region).toBeVisible()
  return region
}

async function assertNoHorizontalOverflow(page: Page, region: Locator, view: string): Promise<DimensionEvidence> {
  const dimensions = {
    root: await page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth
    })),
    region: await region.evaluate((element) => ({
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth
    }))
  }

  expect(dimensions.root.scrollWidth, `${view} の document root が水平 overflow しています`)
    .toBeLessThanOrEqual(dimensions.root.clientWidth)
  expect(dimensions.region.scrollWidth, `${view} region が水平 overflow しています`)
    .toBeLessThanOrEqual(dimensions.region.clientWidth)

  return { view, url: page.url(), ...dimensions }
}

test.beforeEach(async ({ page }) => {
  await page.setViewportSize(viewport)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await installScrollObservation(page)
  await installLayoutStressRoutes(page)
})

test('E2E-UI-LAYOUT-STRESS-001: reduced-motion で長文回答と長い引用名が reflow する @smoke', async ({ page }, testInfo) => {
  await signIn(page)
  expect(await page.evaluate(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches)).toBe(true)
  await page.evaluate(() => {
    const observedWindow = window as Window & { __layoutStressScrollCalls?: ScrollRecord[] }
    observedWindow.__layoutStressScrollCalls = []
  })

  await page.getByRole('textbox', { name: '質問', exact: true }).fill('長文レイアウトを確認してください')
  await page.getByRole('button', { name: '質問を送信', exact: true }).click()

  const chatRegion = page.getByRole('region', { name: 'チャット', exact: true })
  await expect(chatRegion.getByText('LAYOUT-STRESS-START: 長文回答の先頭です。')).toBeVisible()
  await expect(chatRegion.getByText('LAYOUT-STRESS-END: 長文回答の末尾です。')).toBeVisible()
  await expect(chatRegion.getByText(longFileName, { exact: true })).toBeVisible()

  const scrollRecords = await page.evaluate(() => {
    const observedWindow = window as Window & { __layoutStressScrollCalls?: ScrollRecord[] }
    return observedWindow.__layoutStressScrollCalls ?? []
  })
  expect(scrollRecords.some((record) => record.behavior === 'auto' && record.className.includes('message-row'))).toBe(true)

  const dimensions = await assertNoHorizontalOverflow(page, chatRegion, 'chat-long-answer')
  await testInfo.attach('layout-stress-reduced-motion-chat.json', {
    body: Buffer.from(JSON.stringify({
      evidenceId: 'E2E-UI-LAYOUT-STRESS-001',
      viewport,
      prefersReducedMotion: true,
      longAnswerLength: longAnswer.length,
      longFileNameLength: longFileName.length,
      scrollRecords,
      dimensions,
      evidenceBoundary: 'Representative Chromium E2E; not a replacement for real browser zoom, screen reader, real-device, or all CSS animation review'
    }, null, 2)),
    contentType: 'application/json'
  })
})

test('E2E-UI-LAYOUT-STRESS-001: 長いファイル名・多数件・0件が320pxで reflow する @smoke', async ({ page }, testInfo) => {
  await signIn(page)
  expect(await page.evaluate(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches)).toBe(true)
  const states: DimensionEvidence[] = []

  const documentsRegion = await openMobileDestination(page, 'ドキュメント', 'ドキュメント管理')
  await expect(page).toHaveURL(/\/documents$/)
  await expect(documentsRegion.getByText(longFileName, { exact: true })).toBeVisible()
  states.push(await assertNoHorizontalOverflow(page, documentsRegion, 'documents-long-file-name'))

  const historyRegion = await openMobileDestination(page, '履歴', '履歴')
  await expect(page).toHaveURL(/\?view=history$/)
  await expect(historyRegion).toContainText('35 件の会話')
  await expect(historyRegion.locator('.history-item')).toHaveCount(35)
  await expect(historyRegion.getByText(historyItems[0].title, { exact: true })).toBeVisible()
  await expect(historyRegion.getByText(historyItems[34].title, { exact: true })).toBeVisible()
  states.push(await assertNoHorizontalOverflow(page, historyRegion, 'history-35-items'))

  const favoritesRegion = await openMobileDestination(page, 'お気に入り', 'お気に入り')
  await expect(page).toHaveURL(/\?view=favorites$/)
  await expect(favoritesRegion).toContainText('0 件のショートカット')
  await expect(favoritesRegion).toContainText('取得は完了しており、保存済みのお気に入りは 0 件です。')
  states.push(await assertNoHorizontalOverflow(page, favoritesRegion, 'favorites-zero-items'))

  await testInfo.attach('layout-stress-collection-states.json', {
    body: Buffer.from(JSON.stringify({
      evidenceId: 'E2E-UI-LAYOUT-STRESS-001',
      viewport,
      prefersReducedMotion: true,
      fixtures: {
        documentCount: 1,
        longFileNameLength: longFileName.length,
        historyCount: historyItems.length,
        favoritesCount: 0
      },
      states,
      evidenceBoundary: 'Representative layout stress only; not exhaustive for every locale, string, item count, browser, zoom mode, screen reader, or device'
    }, null, 2)),
    contentType: 'application/json'
  })
})
