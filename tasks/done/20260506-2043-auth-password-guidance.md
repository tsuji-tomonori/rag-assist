# パスワード条件の達成表示改善

保存先: `tasks/done/20260506-2043-auth-password-guidance.md`

## 状態

- done

## 背景

ログイン画面のアカウント作成で Cognito の password policy に合わない入力を送信すると、「パスワード条件を満たしていません。」という汎用エラーだけが表示され、利用者はどの条件を満たしていないか判断できなかった。

## 目的

アカウント作成時と初回パスワード変更時に、必要なパスワード条件を送信前から表示し、入力中に達成状態を視覚的かつアクセシブルに確認できるようにする。

## 対象範囲

- `memorag-bedrock-mvp/apps/web/src/features/auth/components/LoginPage.tsx`
- `memorag-bedrock-mvp/apps/web/src/styles/features/auth.css`
- `memorag-bedrock-mvp/apps/web/src/features/auth/components/LoginPage.test.tsx`
- `memorag-bedrock-mvp/docs/1_要求_REQ/11_製品要求_PRODUCT/01_機能要求_FUNCTIONAL/08_認証・認可・管理・監査/01_通常利用者セルフサインアップ/REQ_FUNCTIONAL_025.md`
- `reports/working/20260506-2030-auth-password-guidance.md`
- PR #132

## 方針

- Cognito User Pool の password policy に合わせ、12 文字以上、小文字、大文字、数字、記号を UI 条件として明示する。
- 条件リストはアカウント作成フォームと `NEW_PASSWORD_REQUIRED` の初回パスワード変更フォームで共通利用する。
- 条件達成時は緑のチェックを表示し、支援技術向けには `aria-label` で「達成」「未達成」を伝える。
- 条件未達成の送信は Cognito 呼び出し前に抑止する。
- API、Cognito policy、認可、Infra は変更しない。

## 必要情報

- 実装 branch: `codex/auth-password-guidance`
- worktree: `.worktrees/auth-password-guidance`
- commit: `d52e409` `✨ feat(auth): パスワード条件の達成表示を追加`
- PR: https://github.com/tsuji-tomonori/rag-assist/pull/132
- 作業レポート: `reports/working/20260506-2030-auth-password-guidance.md`
- Cognito password policy: `minLength: 12`, `requireLowercase: true`, `requireUppercase: true`, `requireDigits: true`, `requireSymbols: true`

## 実行計画

1. main 起点の dedicated worktree と branch を作成する。
2. Cognito User Pool の password policy を確認する。
3. `LoginPage.tsx` に password requirement 定義、判定関数、条件リスト UI を追加する。
4. アカウント作成と初回パスワード変更で条件リストを表示する。
5. 条件達成時の緑チェックと mobile 表示を `auth.css` に追加する。
6. `LoginPage.test.tsx` に条件表示と submit 有効化のテストを追加する。
7. `FR-025` にパスワード条件の事前表示と達成状態表示の受け入れ条件を追加する。
8. 対象テスト、typecheck、lint、diff check を実行する。
9. 作業レポートを作成し、commit / push する。
10. GitHub Apps connector で main 向け draft PR を作成する。

## ドキュメントメンテナンス計画

- Requirements: ユーザー可視のアカウント作成フロー改善のため、`FR-025` に `AC-FR025-007` を追加する。
- Architecture / design: API、認証基盤、Cognito policy、認可境界、データ構造は変更しないため更新不要。
- README / API examples / operations / deploy docs: 利用手順、環境変数、API contract、運用手順に変更がないため更新不要。
- PR body: 実行した検証、未実施の `task docs:check` とブラウザ目視確認、将来 password policy 変更時の UI 同期リスクを明記する。

## 受け入れ条件

- main ベースの dedicated worktree と branch で作業されている。
- アカウント作成フォームで、送信前からパスワード条件が表示される。
- 初回パスワード変更フォームで、送信前からパスワード条件が表示される。
- パスワード条件は Cognito User Pool の password policy と一致している。
- 条件を満たした項目に緑のチェックが表示される。
- 条件の達成状態が支援技術にも伝わる。
- 条件未達成のパスワードは Cognito 呼び出し前に送信抑止される。
- Web UI の対象テストで条件表示と submit 有効化が検証されている。
- 関連要求 `FR-025` の受け入れ条件が更新されている。
- 対象テスト、Web typecheck、lint、差分チェックが通る。
- 作業レポートが `reports/working/` に作成されている。
- main 向け draft PR が GitHub Apps connector で作成されている。

## 受け入れ条件充足チェック

| 受け入れ条件 | 判定 | 確認内容 |
|---|---|---|
| dedicated worktree / branch | OK | `.worktrees/auth-password-guidance` / `codex/auth-password-guidance` で作業。 |
| アカウント作成フォームの条件事前表示 | OK | `LoginPage.tsx` の `mode === "signUp"` 分岐で `PasswordRequirementList` を表示。 |
| 初回パスワード変更フォームの条件事前表示 | OK | `isChangingPassword` 分岐で `PasswordRequirementList` を表示。 |
| Cognito policy との一致 | OK | `infra/lib/memorag-mvp-stack.ts` の `passwordPolicy` と同じ 12 文字以上、小文字、大文字、数字、記号を `passwordRequirements` に定義。 |
| 緑のチェック表示 | OK | 条件達成時に `password-requirement-met` と `✓` を表示し、`auth.css` で緑色に設定。 |
| 支援技術への達成状態伝達 | OK | 各 `li` に `aria-label` で `達成: ...` / `未達成: ...` を設定。 |
| 条件未達成の送信抑止 | OK | `submitSignUp` / `submitNewPassword` で `isPasswordPolicySatisfied` を確認し、submit button も条件未達成時 disabled。 |
| Web UI 対象テスト | OK | `LoginPage.test.tsx` に条件未達成/達成表示と submit enabled のテストを追加。 |
| `FR-025` 更新 | OK | `REQ_FUNCTIONAL_025.md` に `AC-FR025-007` と変更履歴を追加。 |
| 対象検証 | OK | `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/web -- LoginPage.test.tsx`、`npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/web`、`npm --prefix memorag-bedrock-mvp run lint`、`git diff --check` が pass。 |
| 作業レポート | OK | `reports/working/20260506-2030-auth-password-guidance.md` を作成。 |
| GitHub Apps PR | OK | PR #132 を GitHub Apps connector で作成。 |

## 検証計画

- `npm ci`
- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/web -- LoginPage.test.tsx`
- `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/web`
- `npm --prefix memorag-bedrock-mvp run lint`
- `git diff --check`
- task ファイルの必須セクション、`保存先`、`状態`、受け入れ条件充足チェックを確認する。

## PRレビュー観点

- `blocking`: UI に表示する password policy が Cognito User Pool の設定と食い違っていないこと。
- `blocking`: 条件未達成の送信が Cognito 呼び出し前に抑止されること。
- `should fix`: 達成状態が色だけに依存せず、チェック記号と `aria-label` でも伝わること。
- `should fix`: narrow viewport で条件リストが読めること。
- `should fix`: `FR-025` の受け入れ条件と PR body が未実施検証を正直に記載していること。
- `suggestion`: 将来 password policy を runtime config 化する場合は UI 条件も config 由来に統一する。

## 未決事項・リスク

- 決定事項: 現時点では Cognito password policy は CDK 定義が source of truth であり、UI 条件は同じ値を静的に定義する。
- 決定事項: API、Cognito policy、認可、Infra は変更しない。
- リスク: 将来 Cognito User Pool の password policy を変更した場合、UI 側の `passwordRequirements` も合わせて更新する必要がある。
- リスク: ブラウザ目視確認は未実施のため、細かな見た目崩れは自動テストでは検出できない可能性がある。
