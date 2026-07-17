import { expect, type Locator, type Page, test } from '@playwright/test'

const viewport = { width: 320, height: 720 }
const evidenceBoundary = 'Injected Chromium stylesheet proxy; not a user stylesheet, browser accessibility setting, screen-reader result, real-device result, or real browser/text-only zoom result'
const spacingOverride = `
  * {
    line-height: 1.5 !important;
    letter-spacing: 0.12em !important;
    word-spacing: 0.16em !important;
  }

  p {
    margin-bottom: 2em !important;
  }
`

type RectEvidence = {
  top: number
  right: number
  bottom: number
  left: number
  width: number
  height: number
}

type SpacingEvidence = {
  fontSize: number
  lineHeight: number
  lineHeightRatio: number
  letterSpacing: number
  letterSpacingRatio: number
  wordSpacing: number
  wordSpacingRatio: number
  marginBottom: number
  marginBottomRatio: number
}

type ViewEvidence = {
  view: string
  url: string
  innerWidth: number
  root: { clientWidth: number, scrollWidth: number }
  region: { clientWidth: number, scrollWidth: number } | null
  controls: Record<string, RectEvidence>
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

async function assertHorizontallyInsideViewport(page: Page, label: string, locator: Locator): Promise<RectEvidence> {
  await expect(locator, `${label} が表示されていません`).toBeVisible()
  const value = await rect(locator)
  const innerWidth = await page.evaluate(() => window.innerWidth)

  expect(value.left, `${label} の左端が viewport 外です`).toBeGreaterThanOrEqual(0)
  expect(value.right, `${label} の右端が viewport 外です`).toBeLessThanOrEqual(innerWidth)
  return value
}

async function collectViewEvidence(
  page: Page,
  view: string,
  controls: Record<string, Locator>,
  region?: Locator
): Promise<ViewEvidence> {
  const dimensions = await page.evaluate(() => ({
    innerWidth: window.innerWidth,
    root: {
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth
    }
  }))
  expect(dimensions.root.scrollWidth, `${view} で document root の水平 overflow が発生しています`)
    .toBeLessThanOrEqual(dimensions.root.clientWidth)

  const regionDimensions = region
    ? await region.evaluate((element) => ({
        clientWidth: element.clientWidth,
        scrollWidth: element.scrollWidth
      }))
    : null
  if (regionDimensions) {
    expect(regionDimensions.scrollWidth, `${view} region で水平 overflow が発生しています`)
      .toBeLessThanOrEqual(regionDimensions.clientWidth)
  }

  const controlRects: Record<string, RectEvidence> = {}
  for (const [label, locator] of Object.entries(controls)) {
    controlRects[label] = await assertHorizontallyInsideViewport(page, `${view}: ${label}`, locator)
  }

  return {
    view,
    url: page.url(),
    innerWidth: dimensions.innerWidth,
    root: dimensions.root,
    region: regionDimensions,
    controls: controlRects
  }
}

async function collectSpacingEvidence(locator: Locator): Promise<SpacingEvidence> {
  return locator.evaluate((element) => {
    const style = getComputedStyle(element)
    const fontSize = Number.parseFloat(style.fontSize)
    const lineHeight = Number.parseFloat(style.lineHeight)
    const letterSpacing = Number.parseFloat(style.letterSpacing)
    const wordSpacing = Number.parseFloat(style.wordSpacing)
    const marginBottom = Number.parseFloat(style.marginBottom)

    return {
      fontSize,
      lineHeight,
      lineHeightRatio: lineHeight / fontSize,
      letterSpacing,
      letterSpacingRatio: letterSpacing / fontSize,
      wordSpacing,
      wordSpacingRatio: wordSpacing / fontSize,
      marginBottom,
      marginBottomRatio: marginBottom / fontSize
    }
  })
}

test('E2E-UI-TEXT-SPACING-001: 320px の主要 journey は代表 text-spacing override でも操作可能である @smoke', async ({ page }, testInfo) => {
  await page.setViewportSize(viewport)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  await page.addStyleTag({ content: spacingOverride })

  const loginHeading = page.getByRole('heading', { name: '社内QAチャットボット', exact: true })
  const loginDescription = page.getByText('Cognitoで安全にサインイン', { exact: true })
  const email = page.getByPlaceholder('メールアドレスを入力')
  const password = page.getByPlaceholder('パスワードを入力')
  const signInButton = page.getByRole('button', { name: 'サインイン', exact: true })

  const headingSpacing = await collectSpacingEvidence(loginHeading)
  const paragraphSpacing = await collectSpacingEvidence(loginDescription)
  expect(headingSpacing.lineHeightRatio).toBeCloseTo(1.5, 2)
  expect(headingSpacing.letterSpacingRatio).toBeCloseTo(0.12, 2)
  expect(headingSpacing.wordSpacingRatio).toBeCloseTo(0.16, 2)
  expect(paragraphSpacing.marginBottomRatio).toBeCloseTo(2, 2)

  const states: ViewEvidence[] = [await collectViewEvidence(page, 'login', {
    heading: loginHeading,
    email,
    password,
    submit: signInButton
  })]

  await email.fill('local@example.com')
  await password.fill('LocalPassword123!')
  await signInButton.click()

  const chat = page.getByRole('region', { name: 'チャット', exact: true })
  const textbox = page.getByRole('textbox', { name: '質問', exact: true })
  const sendButton = page.getByRole('button', { name: '質問を送信', exact: true })
  await expect(chat).toBeVisible()
  states.push(await collectViewEvidence(page, 'chat', { textbox, sendButton }, chat))

  await page.getByRole('button', { name: 'メニューを開く', exact: true }).click()
  const mobilePanel = page.locator('.mobile-navigation-panel')
  await expect(page.getByRole('navigation', { name: 'モバイル画面', exact: true })).toBeVisible()
  await mobilePanel.getByRole('button', { name: 'ドキュメント', exact: true }).click()
  await expect(page).toHaveURL(/\/documents$/)

  const documents = page.getByRole('region', { name: 'ドキュメント管理', exact: true })
  const addDocumentButton = page.getByTitle('ドキュメントを追加', { exact: true })
  await expect(documents).toBeVisible()
  states.push(await collectViewEvidence(page, 'documents', {
    addDocument: addDocumentButton
  }, documents))

  await testInfo.attach('text-spacing-320px.json', {
    body: Buffer.from(JSON.stringify({
      evidenceId: 'E2E-UI-TEXT-SPACING-001',
      viewport,
      requestedSpacing: {
        lineHeight: 1.5,
        paragraphSpacingEm: 2,
        letterSpacingEm: 0.12,
        wordSpacingEm: 0.16
      },
      computedSpacing: {
        heading: headingSpacing,
        paragraph: paragraphSpacing
      },
      evidenceBoundary,
      states
    }, null, 2)),
    contentType: 'application/json'
  })
})
