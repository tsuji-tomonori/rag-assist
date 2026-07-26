import { expect, type Locator, type Page, test } from '@playwright/test'

type KeyboardDestination = {
  label: string
  key: 'Enter' | 'Space'
  url: RegExp
  region: string
}

const destinations: KeyboardDestination[] = [
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

test('E2E-UI-KEYBOARD-NAV-001: primary views remain reachable with Tab and Enter or Space @smoke', async ({ page }) => {
  await page.goto('/')
  await keyboardSignIn(page)

  const navigation = page.getByRole('navigation', { name: '画面' })
  await expect(navigation).toBeVisible()
  await expect(page.getByRole('region', { name: 'チャット', exact: true })).toBeVisible()

  const chat = navigation.getByRole('button', { name: 'チャット' })
  await tabTo(page, chat)
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
    await expect(page.getByRole('region', { name: destination.region })).toBeVisible()
    await expect(control).toHaveAttribute('aria-current', 'page')
  }
})

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

async function tabTo(page: Page, target: Locator) {
  for (let index = 0; index < 40; index += 1) {
    await page.keyboard.press('Tab')
    if (await target.evaluate((element) => element === document.activeElement)) return
  }

  throw new Error(`Tab key did not reach ${await target.getAttribute('aria-label') ?? await target.textContent() ?? 'target'}`)
}

async function expectKeyboardFocus(target: Locator) {
  await expect(target).toBeFocused()
  await expect.poll(async () => target.evaluate((element) => {
    const style = getComputedStyle(element)
    return `${style.outlineStyle}:${style.outlineWidth}:${style.outlineColor}`
  })).toMatch(/^solid:3px:/)
}
