import { expect, type Page, type TestInfo, test } from '@playwright/test'

const privateHistoryDetail = 'RequestId: private-history-id at InternalHistory (/srv/history.ts:10)'

test('E2E-UI-CROSS-BROWSER-STATE-001: history loading・error・retry・confirmed emptyを区別する @ui-quality', async ({ page }, testInfo) => {
  let historyReads = 0
  let releaseFirstRead: () => void = () => undefined
  const firstReadGate = new Promise<void>((resolve) => { releaseFirstRead = resolve })

  await page.route(/http:\/\/127\.0\.0\.1:8787\/conversation-history$/, async (route) => {
    if (route.request().method() !== 'GET') {
      await route.fallback()
      return
    }
    historyReads += 1
    if (historyReads === 1) {
      await firstReadGate
      await route.fulfill({ status: 500, contentType: 'text/plain', body: privateHistoryDetail })
      return
    }
    await route.fulfill({ json: { history: [] } })
  })

  await signIn(page)
  await page.getByTitle('履歴').click()

  const history = page.getByRole('region', { name: '履歴', exact: true })
  const resource = page.locator('#history-resource-region')
  await expect(resource).toHaveAttribute('aria-busy', 'true')
  await expect(history).toContainText('会話履歴を読み込んでいます')
  await expect(history).not.toContainText('0 件の会話')

  releaseFirstRead()
  const error = history.locator('[data-state-kind="error"]')
  await expect(error).toHaveAttribute('role', 'alert')
  await expect(error).toContainText('会話履歴を取得できませんでした')
  await expect(error).not.toContainText('private-history-id')
  await expect(history).not.toContainText('0 件の会話')

  await error.getByRole('button', { name: '再試行' }).click()
  await expect(history.locator('[data-state-kind="recovered"]')).toContainText('会話履歴を更新しました')
  await expect(resource).not.toHaveAttribute('aria-busy')
  await expect(history).toContainText('条件に一致する履歴はありません')
  await expect(history).toContainText('0 件の会話')
  expect(historyReads).toBe(2)

  await attachStateEvidence(testInfo, 'loading-error-retry-empty', {
    historyReads,
    sequence: ['loading', 'error', 'retry', 'recovered', 'confirmed-empty'],
    privateDetailExposed: false
  })
})

test('E2E-UI-CROSS-BROWSER-STATE-001: history HTTP 403をemptyではなくpermissionとして扱う @ui-quality', async ({ page }, testInfo) => {
  await page.route(/http:\/\/127\.0\.0\.1:8787\/conversation-history$/, async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({ status: 403, contentType: 'text/plain', body: 'forbidden private history id' })
      return
    }
    await route.fallback()
  })

  await signIn(page)
  await page.getByTitle('履歴').click()

  const history = page.getByRole('region', { name: '履歴', exact: true })
  const permission = history.locator('[data-state-kind="permission"]')
  await expect(permission).toHaveAttribute('role', 'alert')
  await expect(permission).toContainText('会話履歴を表示できません')
  await expect(permission).not.toContainText('private history id')
  await expect(history).not.toContainText('0 件の会話')
  await expect(page.locator('#history-resource-region')).not.toContainText('条件に一致する履歴はありません')

  await attachStateEvidence(testInfo, 'permission', {
    sequence: ['loading', 'permission'],
    emptyExposed: false,
    privateDetailExposed: false
  })
})

async function signIn(page: Page) {
  await page.goto('/')
  await page.getByPlaceholder('メールアドレスを入力').fill('local@example.com')
  await page.getByPlaceholder('パスワードを入力').fill('LocalPassword123!')
  await page.getByRole('button', { name: 'サインイン' }).click()
  await expect(page.getByRole('region', { name: 'チャット', exact: true })).toBeVisible()
}

async function attachStateEvidence(
  testInfo: TestInfo,
  scenario: string,
  observed: Record<string, boolean | number | string[]>
) {
  const browserProject = testInfo.project.name
  await testInfo.attach(`cross-browser-history-state-${scenario}-${browserProject}.json`, {
    body: Buffer.from(`${JSON.stringify({
      evidenceId: 'E2E-UI-CROSS-BROWSER-STATE-001',
      browserProject,
      view: 'history',
      scenario,
      observed,
      evidenceBoundary: 'Deterministic Playwright route fixture; not a production incident, representative screen reader, real browser zoom, touch, real device, or native accessibility-tree result'
    }, null, 2)}\n`, 'utf8'),
    contentType: 'application/json'
  })
}
