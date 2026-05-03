# 作業計画レポート

保存先: `reports/working/20260503-1047-codebuild-auth-failure-plan.md`

## 1. 受けた指示

- CodeBuild ログ上は成功しているが、認証 token 解決で AWS CLI エラーが出ている件を設計、実装、テストで修正する。
- worktree とブランチを作成して作業する。
- きりの良いタイミングでテスト確認を行い、git commit と push を実施する。
- すべて完了後に GitHub Apps を使って `main` 向け PR を作成する。
- 最初に実行計画を立て、レポートを作成し、タスク分割してから一気通貫で進める。

## 2. タスク分割

| ID | タスク | Done 条件 | 状態 |
|---|---|---|---|
| T1 | worktree とブランチ作成 | `.worktrees/codebuild-auth-failure` と `codex/codebuild-benchmark-auth-failure` が作成済み | 完了 |
| T2 | 原因調査 | CodeBuild が成功扱いになる理由と AWS CLI auth parameter parse エラーの原因を特定 | 進行中 |
| T3 | 設計 | 失敗を隠さない buildspec と特殊文字を安全に渡す Cognito auth 実装方針を決定 | 未着手 |
| T4 | 実装 | token 解決処理と runner buildspec を修正し、必要な docs を更新 | 未着手 |
| T5 | テスト | 変更範囲に対して最小十分なユニット/スナップショット/差分検査を実行 | 未着手 |
| T6 | コミットと push | ステージ済み差分を確認し、日本語 gitmoji commit message で commit、branch push | 未着手 |
| T7 | PR 作成 | GitHub Apps を使い、日本語 PR title/body で `main` へ PR 作成 | 未着手 |

## 3. 初期判断

- ログの `resolve-benchmark-auth-token.mjs` 失敗は内容的にエラーであり、成功扱いは不正。
- `export API_AUTH_TOKEN="$(node ...)"` は command substitution の失敗を `export` 自体の成功で覆い隠す可能性があるため、token 取得と export を分ける。
- `aws cognito-idp initiate-auth --auth-parameters USERNAME=...,PASSWORD=...` は AWS CLI shorthand parser がパスワード内の記号を解釈するため、JSON 入力に切り替えて特殊文字を安全に扱う。
- docs は運用上の注意点が `README.md` / `docs/OPERATIONS.md` に存在するため、挙動変更に合わせて最小更新する。

## 4. 予定する検証

- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/infra`
- 必要に応じて `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/infra`
- `git diff --check`
- ステージ済み確認: `git diff --cached --name-only`

## 5. リスクと制約

- 実 AWS CodeBuild / Cognito / Secrets Manager への実行はローカル検証対象外。CDK snapshot とスクリプトの単体検証で失敗伝播と引数生成を固定する。
- PR 作成は GitHub Apps の利用可能な MCP tool に依存する。利用不能な場合は blocked として記録し、代替可能な範囲を明記する。
