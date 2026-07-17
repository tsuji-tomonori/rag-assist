import { expect, type Locator, type Page, test } from '@playwright/test'

type FocusEvidence = {
  label: string
  tagName: string
  outlineStyle: string
  outlineWidth: number
  outlineColor: string
  left: number
  right: number
}

type ViewportEvidence = {
  viewport: { width: number, height: number }
  focusOrder: FocusEvidence[]
  emptySubmit: { invalid: boolean, focusedEmail: boolean }
  rememberChecked: boolean
  root: { clientWidth: number, scrollWidth: number }
  form: { clientWidth: number, scrollWidth: number }
  finalUrl: string
}

const viewports = [
  { width: 1280, height: 720 },
  { width: 320, height: 720 }
]

async function focusedEvidence(page: Page, label: string, locator: Locator): Promise<FocusEvidence> {
  await expect(locator).toBeFocused()
  const evidence = await locator.evaluate((element, currentLabel) => {
    const style = getComputedStyle(element)
    const rect = element.getBoundingClientRect()
    return {
      label: currentLabel,
      tagName: element.tagName.toLowerCase(),
      outlineStyle: style.outlineStyle,
      outlineWidth: Number.parseFloat(style.outlineWidth),
      outlineColor: style.outlineColor,
      left: rect.left,
      right: rect.right
    }
  }, label)
  const innerWidth = await page.evaluate(() => window.innerWidth)
  expect(evidence.outlineStyle).not.toBe('none')
  expect(evidence.outlineWidth).toBeGreaterThanOrEqual(3)
  expect(evidence.left).toBeGreaterThanOrEqual(0)
  expect(evidence.right).toBeLessThanOrEqual(innerWidth)
  return evidence
}

test('E2E-UI-LOGIN-KEYBOARD-001: login前画面をkeyboard-onlyで完了できる @smoke', async ({ page }, testInfo) => {
  const results: ViewportEvidence[] = []

  for (const viewport of viewports) {
    await page.setViewportSize(viewport)
    await page.goto('/')
    await page.evaluate(() => {
      window.localStorage.clear()
      window.sessionStorage.clear()
    })
    await page.reload()

    const form = page.getByRole('form', { name: 'Cognitoで安全にサインイン', exact: true })
    const email = page.getByRole('textbox', { name: 'メールアドレス', exact: true })
    const password = page.getByLabel('パスワード', { exact: true })
    const remember = page.getByRole('checkbox', { name: 'ログイン状態を保持', exact: true })
    const submit = page.getByRole('button', { name: 'サインイン', exact: true })
    const createAccount = page.getByRole('button', { name: 'アカウント作成', exact: true })

    await expect(form).toBeVisible()
    await expect(email).toHaveAttribute('required', '')
    await expect(password).toHaveAttribute('required', '')

    const focusOrder: FocusEvidence[] = []
    await page.keyboard.press('Tab')
    focusOrder.push(await focusedEvidence(page, 'email', email))

    await page.keyboard.press('Enter')
    await expect(email).toBeFocused()
    const emptySubmit = await email.evaluate((element) => ({
      invalid: !(element as HTMLInputElement).validity.valid,
      focusedEmail: document.activeElement === element
    }))
    expect(emptySubmit).toEqual({ invalid: true, focusedEmail: true })

    await page.keyboard.type('local@example.com')
    await page.keyboard.press('Tab')
    focusOrder.push(await focusedEvidence(page, 'password', password))
    await page.keyboard.type('LocalPassword123!')

    await page.keyboard.press('Tab')
    focusOrder.push(await focusedEvidence(page, 'remember', remember))
    await page.keyboard.press('Space')
    await expect(remember).toBeChecked()

    await page.keyboard.press('Tab')
    focusOrder.push(await focusedEvidence(page, 'submit', submit))
    await page.keyboard.press('Tab')
    focusOrder.push(await focusedEvidence(page, 'createAccount', createAccount))

    const dimensions = await page.evaluate(() => {
      const loginForm = document.querySelector('.login-form')
      return {
        root: {
          clientWidth: document.documentElement.clientWidth,
          scrollWidth: document.documentElement.scrollWidth
        },
        form: loginForm
          ? { clientWidth: loginForm.clientWidth, scrollWidth: loginForm.scrollWidth }
          : { clientWidth: 0, scrollWidth: 0 }
      }
    })
    expect(dimensions.root.scrollWidth).toBeLessThanOrEqual(dimensions.root.clientWidth)
    expect(dimensions.form.clientWidth).toBeGreaterThan(0)
    expect(dimensions.form.scrollWidth).toBeLessThanOrEqual(dimensions.form.clientWidth)

    await page.keyboard.press('Shift+Tab')
    await page.keyboard.press('Shift+Tab')
    await page.keyboard.press('Shift+Tab')
    await expect(password).toBeFocused()
    await page.keyboard.press('Enter')

    await expect(page.getByRole('region', { name: 'チャット', exact: true })).toBeVisible()

    results.push({
      viewport,
      focusOrder,
      emptySubmit,
      rememberChecked: true,
      ...dimensions,
      finalUrl: page.url()
    })
  }

  await testInfo.attach('login-keyboard-evidence.json', {
    body: Buffer.from(JSON.stringify({
      evidenceId: 'E2E-UI-LOGIN-KEYBOARD-001',
      evidenceBoundary: 'Automated Chromium keyboard and native validation evidence; not representative screen-reader, real browser zoom, real-device, Firefox, or WebKit evidence',
      results
    }, null, 2)),
    contentType: 'application/json'
  })
})
