# Web coverage 改善

保存先: `tasks/do/20260509-1133-web-coverage-improvement.md`

状態: do

## 背景

ユーザーから「webのカバレッジ改善を行って /plan」の計画後に「go」と依頼された。過去の作業レポートでは `@memorag-mvp/web` の branch coverage が 85% gate 近傍で推移しており、CI で再び閾値未達になるリスクがある。

## 目的

`@memorag-mvp/web` の coverage を、低価値な snapshot や実装詳細固定ではなく、ユーザー可視または保守価値のある分岐テストで改善する。

## スコープ

- 対象: `memorag-bedrock-mvp/apps/web`
- 対象外: API、infra、benchmark の挙動変更
- 対象外: coverage threshold の緩和

## 実施計画

1. 現行 `origin/main` ベースで Web coverage を再測定する。
2. coverage summary と既存テスト構成から、branch coverage 改善に効く対象を選ぶ。
3. ユーザー可視の loading/error/empty/permission/input state または API wrapper の失敗分岐を中心にテストを追加する。
4. Web coverage、Web typecheck、`git diff --check` を実行する。
5. docs 更新要否を確認し、作業レポートを残す。
6. commit、push、PR 作成、受け入れ条件確認コメント、セルフレビューコメントまで実施する。

## ドキュメント保守方針

テスト追加のみで UI/API/運用手順/CI command の挙動変更がない場合、README や durable docs は更新しない。挙動や手順に影響が出た場合のみ、関連 docs を最小範囲で更新する。

## 受け入れ条件

- `npm run test:coverage -w @memorag-mvp/web` が pass すること。
- Web branch coverage が gate 85% から余裕を持つこと。目安として 86.5% 以上、可能なら 87% 以上を狙う。
- `npm run typecheck -w @memorag-mvp/web` が pass すること。
- `git diff --check` が pass すること。
- coverage threshold を緩和していないこと。
- 追加テストがユーザー可視または保守価値のある分岐を検証していること。
- README、`docs/`、`memorag-bedrock-mvp/docs/` の更新要否が確認されていること。
- PR 作成後に受け入れ条件確認コメントとセルフレビューコメントを日本語で投稿すること。

## 検証計画

- `npm run test:coverage -w @memorag-mvp/web`
- `npm run typecheck -w @memorag-mvp/web`
- `git diff --check`

## PR review 観点

- Web coverage gate を弱めていないこと。
- 実装挙動を変えず、テストのみで対象分岐を補強していること。
- docs と実装の同期が崩れていないこと。
- RAG の根拠性・認可境界を弱めていないこと。
- benchmark 期待語句・QA sample 固有値・dataset 固有分岐を実装へ入れていないこと。

## リスク

- coverage report の粒度が粗い場合、対象選定に再測定が必要になる。
- branch coverage は既存 UI の条件分岐追加で下がりやすいため、今回の改善後も継続的なテスト追加が必要になる。

## 実施結果

- 初回測定では `@memorag-mvp/web` の coverage は pass したが、branch coverage は 85.20% で gate 85% に近かった。
- `useAdminData.test.ts` に admin 読み取り権限なし、ユーザー管理・Alias 管理の Error / 非 Error 失敗分岐を追加した。
- `useDocuments.test.ts` に資料グループ選択 fallback、書き込み・再インデックス権限なし、資料管理操作の Error / 非 Error 失敗分岐を追加した。
- `useBenchmarkRuns.test.ts` に選択 suite が存在しない場合の agent mode fallback と start 失敗分岐を追加した。
- coverage 実行時に既存 UI テストが 5 秒 timeout へ複数回到達したため、`vitest.config.ts` の `testTimeout` を 10 秒へ上げて coverage 実行を安定化した。coverage threshold は変更していない。
- 最新 `origin/main` への rebase 後の最終 coverage は statements 92.16%、branches 86.93%、functions 90.46%、lines 95.33% で pass した。
- durable docs は未更新。理由: 今回は Web テストと Vitest の実行 timeout の調整のみで、プロダクト UI/API/運用手順/CI command の利用方法は変わらないため。

## 実行した検証

- `npm run test -w @memorag-mvp/web -- src/features/admin/hooks/useAdminData.test.ts src/features/documents/hooks/useDocuments.test.ts src/features/benchmark/hooks/useBenchmarkRuns.test.ts`: pass
- `npm run test -w @memorag-mvp/web -- src/features/admin/hooks/useAdminData.test.ts`: pass
- `npm run test:coverage -w @memorag-mvp/web`: pass
- `npm run typecheck -w @memorag-mvp/web`: pass
- `git diff --check`: pass

## 未対応・制約

- `npm ci` は依存復元のため実行し、3 vulnerabilities (1 moderate, 2 high) を報告した。依存更新・監査修正は今回の Web coverage 改善の範囲外。
