import { expect, type Locator, type Page, test } from '@playwright/test'

type TouchDestination = {
  label: string
  url: RegExp
  region: string
}

type TouchTargetEvidence = {
  label: string
  width: number
  height: number
}

const minimumTargetSize = 24
const destinations: TouchDestination[] = [
  {
    label: 'ドキュメント',
    url: /\/documents$/,
    region: 'ドキュメント管理'
  },
  {
    label: '担当者対応',
    url: /\?view=assignee$/,
    region: '担当者対応'
  },
  {
    label: '管理者設定',
    url: /\?view=admin$/,
    region: '管理者設定'
  },
  {
    label: '個人設定',
    url: /\?view=profile$/,
    region: '個人設定'
  }
]

test.use({
  viewport: { width: 320, height: 720 },
  isMobile: true,
  hasTouch: true
})

test('E2E-UI-TOUCH-NAV-001: touch users can sign in and reach permitted primary views with AA-sized targets @smoke', async ({ page }, testInfo) => {
  const targetEvidence: TouchTargetEvidence[] = []

  await page.goto('/')
  await expect.poll(() => page.evaluate(() => navigator.maxTouchPoints)).toBeGreaterThan(0)
  await expect.poll(() => page.evaluate(() => window.matchMedia('(pointer: coarse)').matches)).toBe(true)

  const email = page.getByRole('textbox', { name: 'メールアドレス' })
  await tapTarget(email, 'login email', targetEvidence)
  await email.fill('touch-admin@example.com')

  const password = page.getByRole('textbox', { name: 'パスワード' })
  await tapTarget(password, 'login password', targetEvidence)
  await password.fill('LocalPassword123!')

  await tapTarget(page.getByRole('button', { name: 'サインイン' }), 'login submit', targetEvidence)
  await expect(page.getByRole('region', { name: 'チャット', exact: true })).toBeVisible()

  for (const destination of destinations) {
    const navigation = await openMobileNavigation(page, targetEvidence)
    const control = mobileDestinationControl(navigation, destination.label)
    await tapTarget(control, `mobile navigation: ${destination.label}`, targetEvidence)

    await expect(page).toHaveURL(destination.url)
    await expect(page.getByRole('region', { name: destination.region })).toBeVisible()

    const reopenedNavigation = await openMobileNavigation(page, targetEvidence)
    await expect(mobileDestinationControl(reopenedNavigation, destination.label)).toHaveAttribute('aria-current', 'page')
    await page.getByRole('button', { name: 'メニューを閉じる' }).tap()
  }

  await testInfo.attach('touch-target-evidence.json', {
    body: Buffer.from(`${JSON.stringify({
      context: {
        viewport: { width: 320, height: 720 },
        hasTouch: true,
        isMobile: true,
        minimumCssPixels: minimumTargetSize
      },
      targets: targetEvidence
    }, null, 2)}\n`, 'utf8'),
    contentType: 'application/json'
  })
})

async function openMobileNavigation(page: Page, evidence: TouchTargetEvidence[]) {
  const trigger = page.getByRole('button', { name: 'メニューを開く' })
  await tapTarget(trigger, 'mobile menu trigger', evidence)
  const navigation = page.getByRole('navigation', { name: 'モバイル画面' })
  await expect(navigation).toBeVisible()
  return navigation
}

function mobileDestinationControl(navigation: Locator, label: string) {
  const scope = label === '個人設定' ? navigation.locator('..') : navigation
  return scope.getByRole('button', { name: label, exact: true })
}

async function tapTarget(locator: Locator, label: string, evidence: TouchTargetEvidence[]) {
  await expect(locator).toBeVisible()
  const box = await locator.boundingBox()
  expect(box, `${label} must have a measurable touch target`).not.toBeNull()
  expect(box!.width, `${label} width`).toBeGreaterThanOrEqual(minimumTargetSize)
  expect(box!.height, `${label} height`).toBeGreaterThanOrEqual(minimumTargetSize)
  evidence.push({ label, width: box!.width, height: box!.height })
  await locator.tap()
}
