# API待機中のスピナー表示改善

保存先: `tasks/done/20260506-1950-web-loading-spinner.md`

## 状態

- done

## 背景

API 呼び出しが完了していない状態で、画面上はボタンが disabled になるだけの箇所があり、利用者が処理中であることを把握しにくかった。PR #126 では、Web UI 全体の pending 表示を見直し、ぐるぐるマークと状態テキストで API 待機中であることを明示する必要があった。

## 目的

ログイン、チャット、ドキュメント管理、担当者対応、性能テスト、管理画面で、API pending 中であることが視覚的・アクセシブルに分かる UI にする。

## 対象範囲

- `memorag-bedrock-mvp/apps/web/src/app/AppShell.tsx`
- `memorag-bedrock-mvp/apps/web/src/app/hooks/useAppShellState.ts`
- `memorag-bedrock-mvp/apps/web/src/shared/components/LoadingSpinner.tsx`
- `memorag-bedrock-mvp/apps/web/src/features/auth/components/LoginPage.tsx`
- `memorag-bedrock-mvp/apps/web/src/features/chat/components/`
- `memorag-bedrock-mvp/apps/web/src/features/documents/components/DocumentWorkspace.tsx`
- `memorag-bedrock-mvp/apps/web/src/features/questions/components/AssigneeWorkspace.tsx`
- `memorag-bedrock-mvp/apps/web/src/features/benchmark/components/BenchmarkWorkspace.tsx`
- `memorag-bedrock-mvp/apps/web/src/features/admin/components/AdminWorkspace.tsx`
- `memorag-bedrock-mvp/apps/web/src/styles/`
- `memorag-bedrock-mvp/apps/web/src/App.test.tsx`
- `memorag-bedrock-mvp/apps/web/src/LoginPage.test.tsx`
- PR #126

## 方針

- 既存の `.loading-spinner` を共通 component 化し、チャット以外の画面でも再利用する。
- 単一 boolean ではなく pending count で API 待機状態を管理し、並行 API の一部完了で loading が早く消えないようにする。
- API pending 中はグローバルな `API処理中` 表示と、主要操作ボタンのスピナー表示を出す。
- API contract、RAG workflow、認可、Infra、Benchmark runner は変更しない。

## 必要情報

- 実装 commit: `5ecb4ef` `✨ feat(web): API待機中のスピナー表示を追加`
- PR: https://github.com/tsuji-tomonori/rag-assist/pull/126
- 作業レポート: `reports/working/20260506-1931-web-loading-spinner.md`
- レビュー作業レポート: `reports/working/20260506-1935-pr126-review.md`
- `gh auth status` は既存トークン無効だったため、PR 作成は GitHub Apps connector で実施した。

## 実行計画

1. main ベースの worktree と `codex/web-loading-spinner` branch を作成する。
2. Web UI の既存 loading 表示と API pending 箇所を確認する。
3. `LoadingSpinner` / `LoadingStatus` を追加する。
4. `useAppShellState` の loading 管理を pending count 化する。
5. ログイン、チャット、ドキュメント管理、担当者対応、性能テスト、管理画面の pending UI を更新する。
6. pending 表示のテストを追加する。
7. Web typecheck、test、build、差分チェックを実行する。
8. 作業レポートを作成し、commit / push する。
9. GitHub Apps connector で main 向け draft PR を作成する。

## ドキュメントメンテナンス計画

- Requirements: API contract や機能要求の新規能力追加ではなく既存 Web UI の pending 表示改善のため、`FR-*` / `NFR-*` の追加更新は不要と判断する。
- Architecture / design: RAG workflow、認可、検索、benchmark、debug trace、データ構造に影響しないため更新不要。
- README / API examples / operations: 公開 API、環境変数、運用手順、ローカル検証手順に変更がないため更新不要。
- PR body: ドキュメント更新不要の理由、未実施の目視確認、検証コマンドを明記する。

## 受け入れ条件

- main ベースの dedicated worktree と branch で作業されている。
- API pending 中に、グローバルな `API処理中` 表示が出る。
- ログイン送信中に、送信ボタンへスピナーが表示され、入力操作が抑止される。
- チャット送信中に、送信ボタンへスピナーが表示され、重複送信が抑止される。
- ドキュメント管理、担当者対応、性能テスト、管理者設定で、API pending 中の状態表示またはボタン内スピナーが表示される。
- 複数 API が並行する初期ロード中に、一部 API の完了だけで loading が消えない。
- Web の typecheck、test、build が通る。
- `git diff --check` で末尾空白などの差分エラーがない。
- 作業レポートが `reports/working/` に作成されている。
- main 向け PR が GitHub Apps connector で作成されている。

## 受け入れ条件充足チェック

| 受け入れ条件 | 判定 | 確認内容 |
|---|---|---|
| dedicated worktree / branch | OK | `.worktrees/web-loading-spinner` / `codex/web-loading-spinner` で作業。 |
| グローバル `API処理中` 表示 | OK | `AppShell` に `LoadingStatus label=\"API処理中\"` を追加し、`App.test.tsx` で表示と消去を確認。 |
| ログイン送信中スピナー | OK | `LoginPage.tsx` に `LoadingSpinner` を追加し、`LoginPage.test.tsx` で pending 中の disabled / spinner を確認。 |
| チャット送信中スピナーと重複送信抑止 | OK | `ChatComposer` に spinner と disabled を追加。既存 test と追加 test で pending 中の送信抑止を確認。 |
| 主要管理画面の pending 表示 | OK | documents / assignee / benchmark / admin に `LoadingStatus` または button spinner を追加。 |
| 並行 API 中の loading 維持 | OK | `useAppShellState` を `pendingApiCalls` count に変更。初期 loader は `Promise.all(loaders).finally` で count を閉じる。 |
| Web typecheck / test / build | OK | `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/web`、`npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/web`、`npm --prefix memorag-bedrock-mvp run build -w @memorag-mvp/web` が pass。 |
| 差分チェック | OK | `git diff --check` が pass。 |
| 作業レポート | OK | `reports/working/20260506-1931-web-loading-spinner.md` を作成。 |
| GitHub Apps PR | OK | PR #126 を GitHub Apps connector で作成。 |

## 検証計画

- `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/web`
- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/web`
- `npm --prefix memorag-bedrock-mvp run build -w @memorag-mvp/web`
- `git diff --check`
- PR body と作業レポートの未実施事項確認

## PRレビュー観点

- `blocking`: API / RAG workflow / 認可 / Infra / Benchmark runner に意図しない差分がないこと。
- `blocking`: pending count の増減が不整合になり、永続 loading または早期 loading 解除を起こさないこと。
- `should fix`: pending UI が主要画面に偏りなく出て、未実施の目視確認が PR body に明記されていること。
- `should fix`: テストが pending 表示の期待動作を固定していること。
- `suggestion`: 実ブラウザでの目視確認を追加すると UI 表示崩れの残リスクを下げられる。

## 未決事項・リスク

- 決定事項: loading は画面単位ではなくアプリ共通 pending count を基準にする。
- 決定事項: 公開 API、環境変数、運用手順に影響しないため durable docs は更新しない。
- リスク: 実ブラウザでの目視確認は未実施のため、狭幅 viewport での細かな見た目崩れは CI では検出されない可能性がある。
- リスク: 同時 API 実行中は複数ボタンにスピナーが出る場合があるが、処理中であることを優先した仕様として扱う。
