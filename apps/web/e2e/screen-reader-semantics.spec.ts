import { expect, type Page, type TestInfo, test } from '@playwright/test'

type AccessibilityContractNode = {
  role: string
  name: string
}

type ExpectedNode = {
  role: string
  name?: string
}

const evidenceRoles = new Set([
  'alert',
  'button',
  'complementary',
  'form',
  'heading',
  'main',
  'navigation',
  'region',
  'status',
  'table',
  'textbox'
])

test('E2E-UI-SR-SEMANTICS-001: representative views expose stable Chromium accessibility tree contracts @smoke', async ({ page }, testInfo) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: '社内QAチャットボット' })).toBeVisible()

  await expectAccessibilityContract(page, testInfo, 'login', [
    { role: 'heading', name: '社内QAチャットボット' },
    { role: 'form', name: 'Cognitoで安全にサインイン' },
    { role: 'textbox', name: 'メールアドレス' },
    { role: 'textbox', name: 'パスワード' },
    { role: 'button', name: 'サインイン' }
  ])

  await signIn(page)
  await expectAccessibilityContract(page, testInfo, 'chat', [
    { role: 'main' },
    { role: 'heading', name: '社内QAチャットボットエージェント' },
    { role: 'navigation', name: '画面' },
    { role: 'region', name: 'チャット' },
    { role: 'form', name: '質問入力' },
    { role: 'textbox', name: '質問' },
    { role: 'button', name: '質問を送信' }
  ])

  await page.getByRole('navigation', { name: '画面' }).getByRole('button', { name: 'ドキュメント' }).click()
  await expect(page.getByRole('region', { name: 'ドキュメント管理' })).toBeVisible()
  await expectAccessibilityContract(page, testInfo, 'documents', [
    { role: 'main' },
    { role: 'navigation', name: '画面' },
    { role: 'region', name: 'ドキュメント管理' },
    { role: 'complementary', name: 'フォルダツリー' },
    { role: 'region', name: '登録文書一覧' },
    { role: 'region', name: '現在の文書表示条件' }
  ])
})

async function signIn(page: Page) {
  await page.getByRole('textbox', { name: 'メールアドレス' }).fill('semantic-admin@example.com')
  await page.getByRole('textbox', { name: 'パスワード' }).fill('LocalPassword123!')
  await page.getByRole('button', { name: 'サインイン' }).click()
  await expect(page.getByRole('region', { name: 'チャット', exact: true })).toBeVisible()
}

async function expectAccessibilityContract(
  page: Page,
  testInfo: TestInfo,
  label: string,
  expectedNodes: ExpectedNode[]
) {
  const nodes = await readAccessibilityTree(page)

  await testInfo.attach(`${label}-chromium-accessibility-tree.json`, {
    body: Buffer.from(`${JSON.stringify(nodes, null, 2)}\n`, 'utf8'),
    contentType: 'application/json'
  })

  for (const expectedNode of expectedNodes) {
    const matched = nodes.some((node) => (
      node.role === expectedNode.role &&
      (expectedNode.name === undefined || node.name === expectedNode.name)
    ))
    expect(matched, `missing accessibility node ${JSON.stringify(expectedNode)} in ${label}`).toBe(true)
  }
}

async function readAccessibilityTree(page: Page): Promise<AccessibilityContractNode[]> {
  const session = await page.context().newCDPSession(page)
  try {
    const { nodes } = await session.send('Accessibility.getFullAXTree')
    return nodes
      .filter((node) => !node.ignored && typeof node.role?.value === 'string' && evidenceRoles.has(node.role.value))
      .map((node) => ({
        role: String(node.role?.value ?? ''),
        name: String(node.name?.value ?? '')
      }))
  } finally {
    await session.detach()
  }
}
