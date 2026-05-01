import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  page.on('dialog', async (dialog) => dialog.accept())
  await page.goto('/')
  await page.getByPlaceholder('メールアドレスを入力').fill('local@example.com')
  await page.getByPlaceholder('パスワードを入力').fill('LocalPassword123!')
  await page.getByRole('button', { name: 'サインイン' }).click()
})

test('資料アップロード後に一覧へ反映される @smoke', async ({ page }) => {
  const filename = `e2e-upload-${Date.now()}.txt`
  const fileInput = page.locator('input[type="file"]')

  await fileInput.setInputFiles({
    name: filename,
    mimeType: 'text/plain',
    buffer: Buffer.from('この文書はE2Eテスト用です。製品コードはMVP-2026です。', 'utf-8')
  })

  await page.getByRole('button', { name: '送信' }).click()
  await expect(page.getByText('資料を取り込みました。知りたいことを入力してください。')).toBeVisible()

  await expect(page.locator('#document-select option').filter({ hasText: filename })).toHaveCount(1)
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

  await page.getByLabel('質問').fill(question)
  await page.getByRole('button', { name: '送信' }).click()

  await expect(page.getByText(/MVP-2026|資料では次のように記載されています。/)).toBeVisible()
  await expect(page.getByText('根拠ドキュメント')).toBeVisible()
})

test('根拠不足質問で no-answer メッセージになる', async ({ page }) => {
  await page.getByLabel('質問').fill('この会社の創業者の誕生日は？')
  await page.getByRole('button', { name: '送信' }).click()
  await expect(page.getByText('資料からは回答できません。')).toBeVisible()
})

test('資料削除で再質問時の挙動が変わる', async ({ page }) => {
  const filename = `e2e-delete-${Date.now()}.txt`

  await page.locator('input[type="file"]').setInputFiles({
    name: filename,
    mimeType: 'text/plain',
    buffer: Buffer.from('削除検証用。秘密の語句はALPHA-DELTAです。', 'utf-8')
  })
  await page.getByRole('button', { name: '送信' }).click()
  await expect(page.getByText('資料を取り込みました。知りたいことを入力してください。')).toBeVisible()

  await page.getByLabel('質問').fill('秘密の語句は何ですか？')
  await page.getByRole('button', { name: '送信' }).click()
  await expect(page.getByText(/ALPHA-DELTA|資料では次のように記載されています。/)).toBeVisible()

  await page.locator('#document-select').selectOption({ label: filename })
  await page.locator('.delete-document-button').click()

  await page.getByLabel('質問').fill('秘密の語句は何ですか？')
  await page.getByRole('button', { name: '送信' }).click()
  await expect(page.getByText('資料からは回答できません。')).toBeVisible()
})
