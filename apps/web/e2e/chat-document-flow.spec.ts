import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  page.on('dialog', async (dialog) => dialog.accept())
  await page.goto('/')
  await page.getByPlaceholder('メールアドレスを入力').fill('local@example.com')
  await page.getByPlaceholder('パスワードを入力').fill('LocalPassword123!')
  await page.getByRole('button', { name: 'サインイン' }).click()
  await expect(page.locator('section[aria-label="チャット"]')).toBeVisible()
})

test('根拠不足質問で no-answer メッセージになる', async ({ page }) => {
  await page.getByRole('textbox', { name: '質問', exact: true }).fill('この会社の創業者の誕生日は？')
  await page.getByRole('button', { name: '質問を送信', exact: true }).click()
  await expect(page.getByText('資料からは回答できません。')).toBeVisible()
})

test('一時添付の取り込み後も永続文書一覧へ混入しない @smoke', async ({ page }) => {
  const filename = `e2e-upload-${Date.now()}.txt`
  const fileInput = page.locator('input[type="file"]')

  await fileInput.setInputFiles({
    name: filename,
    mimeType: 'text/plain',
    buffer: Buffer.from('この文書はE2Eテスト用です。製品コードはMVP-2026です。', 'utf-8')
  })

  await page.getByRole('button', { name: '送信' }).click()
  await expect(page.getByText('資料を取り込みました。知りたいことを入力してください。')).toBeVisible()

  await expect(page.locator('#document-select option').filter({ hasText: filename })).toHaveCount(0)
})

test('質問送信で回答と citations が表示される @smoke', async ({ page }) => {
  const filename = `e2e-chat-${Date.now()}.txt`
  const question = '製品コードは何ですか？'

  await page.locator('input[type="file"]').setInputFiles({
    name: filename,
    mimeType: 'text/plain',
    buffer: Buffer.from('テスト資料: 製品コードはMVP-2026です。', 'utf-8')
  })
  await page.getByRole('button', { name: '送信' }).click()
  await expect(page.getByText('資料を取り込みました。知りたいことを入力してください。')).toBeVisible()

  await page.getByRole('textbox', { name: '質問', exact: true }).fill(question)
  const chatRunRequestPromise = page.waitForRequest((request) => request.method() === 'POST' && new URL(request.url()).pathname.replace(/\/$/, '') !== '/conversation-history')
  await page.getByRole('button', { name: '送信' }).click()
  const chatRunRequest = await chatRunRequestPromise
  expect(new URL(chatRunRequest.url()).pathname.replace(/\/$/, '')).toBe('/rpc/chat/startRun')
  expect(chatRunRequest.postDataJSON()).toMatchObject({
    json: {
      searchScope: {
        includeTemporary: true,
        temporaryScopeId: expect.any(String)
      }
    }
  })

  await expect(page.getByText(/MVP-2026|資料では次のように記載されています。/)).toBeVisible()
  await expect(page.getByText('参照元', { exact: true })).toBeVisible()
})

test('新しい会話では旧会話の一時資料 scope を検索へ含めない', async ({ page }) => {
  const filename = `e2e-delete-${Date.now()}.txt`

  await page.locator('input[type="file"]').setInputFiles({
    name: filename,
    mimeType: 'text/plain',
    buffer: Buffer.from('削除検証用。秘密の語句はALPHA-DELTAです。', 'utf-8')
  })
  await page.getByRole('button', { name: '送信' }).click()
  await expect(page.getByText('資料を取り込みました。知りたいことを入力してください。')).toBeVisible()

  await page.getByRole('textbox', { name: '質問', exact: true }).fill('秘密の語句は何ですか？')
  await page.getByRole('button', { name: '質問を送信', exact: true }).click()
  await expect(page.getByText(/ALPHA-DELTA|資料では次のように記載されています。/)).toBeVisible()

  await page.getByRole('button', { name: '新しい会話', exact: true }).click()
  await expect(page.locator('section[aria-label="チャット"]')).toBeVisible()

  await page.getByRole('textbox', { name: '質問', exact: true }).fill('秘密の語句は何ですか？')
  await page.getByRole('button', { name: '質問を送信', exact: true }).click()
  await expect(page.getByText('資料からは回答できません。')).toBeVisible()
})
