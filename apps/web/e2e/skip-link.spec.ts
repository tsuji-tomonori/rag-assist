import { expect, test } from '@playwright/test'

const viewportCases = [
  { name: 'desktop', viewport: { width: 1280, height: 720 } },
  { name: 'mobile', viewport: { width: 320, height: 720 } }
] as const

for (const viewportCase of viewportCases) {
  test(`E2E-UI-SKIP-001: ${viewportCase.name} で反復 navigation を迂回して main へ移動できる @smoke`, async ({ page }, testInfo) => {
    await page.setViewportSize(viewportCase.viewport)
    await page.goto('/')
    await page.getByPlaceholder('メールアドレスを入力').fill('local@example.com')
    await page.getByPlaceholder('パスワードを入力').fill('LocalPassword123!')
    await page.getByRole('button', { name: 'サインイン', exact: true }).click()

    const chat = page.getByRole('region', { name: 'チャット', exact: true })
    const skipLink = page.getByRole('link', { name: 'メインコンテンツへ移動', exact: true })
    const main = page.getByRole('main')
    await expect(chat).toBeVisible()
    await expect(main).toHaveCount(1)
    await expect(skipLink).not.toBeInViewport()
    await expect(skipLink).toHaveAttribute('href', '#main-content')
    await expect(main).toHaveAttribute('id', 'main-content')
    await expect(main).toHaveAttribute('tabindex', '-1')

    await page.keyboard.press('Tab')
    await expect(skipLink).toBeFocused()
    await expect(skipLink).toBeInViewport()

    const focusedLinkEvidence = await skipLink.evaluate((element) => {
      const rect = element.getBoundingClientRect()
      const style = getComputedStyle(element)
      return {
        rect: {
          top: rect.top,
          right: rect.right,
          bottom: rect.bottom,
          left: rect.left,
          width: rect.width,
          height: rect.height
        },
        outlineStyle: style.outlineStyle,
        outlineWidth: style.outlineWidth,
        transform: style.transform
      }
    })
    expect(focusedLinkEvidence.rect.top).toBeGreaterThanOrEqual(0)
    expect(focusedLinkEvidence.rect.left).toBeGreaterThanOrEqual(0)
    expect(focusedLinkEvidence.rect.right).toBeLessThanOrEqual(viewportCase.viewport.width)
    expect(focusedLinkEvidence.outlineStyle).not.toBe('none')
    expect(Number.parseFloat(focusedLinkEvidence.outlineWidth)).toBeGreaterThanOrEqual(3)

    const urlBeforeSkip = new URL(page.url())
    await page.keyboard.press('Enter')
    await expect(main).toBeFocused()
    const urlAfterSkip = new URL(page.url())
    expect(urlAfterSkip.pathname).toBe(urlBeforeSkip.pathname)
    expect(urlAfterSkip.search).toBe(urlBeforeSkip.search)
    expect(urlAfterSkip.hash).toBe('')
    expect(urlAfterSkip.toString()).toBe(urlBeforeSkip.toString())

    const layout = await page.evaluate(() => ({
      activeElement: {
        tagName: document.activeElement?.tagName ?? '',
        id: document.activeElement?.id ?? ''
      },
      root: {
        clientWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth
      },
      mainCount: document.querySelectorAll('main').length,
      navigationInsideMain: document.querySelector('main nav') !== null
    }))
    expect(layout.activeElement).toEqual({ tagName: 'MAIN', id: 'main-content' })
    expect(layout.root.scrollWidth).toBeLessThanOrEqual(layout.root.clientWidth)
    expect(layout.mainCount).toBe(1)
    expect(layout.navigationInsideMain).toBe(false)

    await testInfo.attach(`skip-link-${viewportCase.name}.json`, {
      body: Buffer.from(JSON.stringify({
        evidenceId: 'E2E-UI-SKIP-001',
        viewport: viewportCase.viewport,
        focusedLinkEvidence,
        urlBeforeSkip: urlBeforeSkip.toString(),
        urlAfterSkip: urlAfterSkip.toString(),
        layout,
        evidenceBoundary: 'Representative Chromium keyboard automation; not a screen-reader, real-device, Firefox, WebKit, or manual browser result'
      }, null, 2)),
      contentType: 'application/json'
    })
  })
}
