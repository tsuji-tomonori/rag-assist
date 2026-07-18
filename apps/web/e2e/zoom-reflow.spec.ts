import { expect, type Page, test } from '@playwright/test'

const physicalReferenceWidth = 1280
const viewportHeight = 720

const zoomCases = [
  { zoomPercent: 200, cssViewportWidth: 640 },
  { zoomPercent: 400, cssViewportWidth: 320 }
] as const

const destinations = [
  { label: 'ドキュメント', region: 'ドキュメント管理', url: /\/documents$/ },
  { label: '担当者対応', region: '担当者対応', url: /\?view=assignee$/ },
  { label: '管理者設定', region: '管理者設定', url: /\?view=admin$/ },
  { label: '個人設定', region: '個人設定', url: /\?view=profile$/ }
] as const

type ReflowState = {
  view: string
  url: string
  innerWidth: number
  clientWidth: number
  scrollWidth: number
}

async function signIn(page: Page) {
  await page.goto('/')
  await page.getByPlaceholder('メールアドレスを入力').fill('local@example.com')
  await page.getByPlaceholder('パスワードを入力').fill('LocalPassword123!')
  await page.getByRole('button', { name: 'サインイン' }).click()
  await expect(page.getByRole('region', { name: 'チャット', exact: true })).toBeVisible()
}

async function assertNoRootOverflow(page: Page, view: string): Promise<ReflowState> {
  const dimensions = await page.evaluate(() => ({
    innerWidth: window.innerWidth,
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth
  }))

  expect(dimensions.scrollWidth, `${view} で document root の水平 overflow が発生しています`)
    .toBeLessThanOrEqual(dimensions.clientWidth)

  return {
    view,
    url: page.url(),
    ...dimensions
  }
}

for (const zoomCase of zoomCases) {
  test(`E2E-UI-ZOOM-REFLOW-001: 1280px 基準 ${zoomCase.zoomPercent}% proxy は主要 view を reflow する @smoke`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: zoomCase.cssViewportWidth, height: viewportHeight })
    await page.emulateMedia({ reducedMotion: 'reduce' })

    const calculatedZoomPercent = (physicalReferenceWidth / zoomCase.cssViewportWidth) * 100
    expect(calculatedZoomPercent).toBe(zoomCase.zoomPercent)

    await signIn(page)
    expect(await page.evaluate(() => window.innerWidth)).toBe(zoomCase.cssViewportWidth)

    const states: ReflowState[] = [await assertNoRootOverflow(page, 'チャット')]

    for (const destination of destinations) {
      await test.step(`${destination.region} へ到達して root reflow を検査する`, async () => {
        await page.getByRole('button', { name: 'メニューを開く' }).click()
        const mobilePanel = page.locator('.mobile-navigation-panel')
        await expect(page.getByRole('navigation', { name: 'モバイル画面' })).toBeVisible()
        await mobilePanel.getByRole('button', { name: destination.label, exact: true }).click()

        await expect(page).toHaveURL(destination.url)
        await expect(page.getByRole('region', { name: destination.region, exact: true })).toBeVisible()
        states.push(await assertNoRootOverflow(page, destination.region))
      })
    }

    await testInfo.attach(`zoom-reflow-${zoomCase.zoomPercent}-percent.json`, {
      body: Buffer.from(JSON.stringify({
        evidenceId: 'E2E-UI-ZOOM-REFLOW-001',
        physicalReferenceWidth,
        zoomPercent: zoomCase.zoomPercent,
        cssViewport: {
          width: zoomCase.cssViewportWidth,
          height: viewportHeight
        },
        evidenceBoundary: 'CSS viewport reflow proxy; not a real browser zoom, text-only zoom, browser chrome, OS scaling, or DPR result',
        states
      }, null, 2)),
      contentType: 'application/json'
    })
  })
}
