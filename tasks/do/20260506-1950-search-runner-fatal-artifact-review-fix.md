# 検索 benchmark runner fatal artifact レビュー指摘対応

保存先: `tasks/do/20260506-1950-search-runner-fatal-artifact-review-fix.md`

## 状態

- do

## 背景

PR #125 のレビューで、検索 benchmark runner の fatal error fallback artifact について 2 件の `should fix` 指摘が出た。1 件目は `BASELINE_SUMMARY` 読み込み失敗時に `EVALUATOR_PROFILE=strict-ja` を指定しても fallback summary/report が `default@1` と表示される診断情報の不整合。2 件目は、fatal error 時に `OUTPUT`、`SUMMARY`、`REPORT` を生成する主契約に対する自動 regression test 不足である。

## 目的

検索 benchmark runner の fatal error artifact が指定 evaluator profile を正しく記録し、同じ契約を自動テストで継続検証できる状態にする。

## 対象範囲

- `memorag-bedrock-mvp/benchmark/search-run.ts`
- `memorag-bedrock-mvp/benchmark/search-run.test.ts`
- `tasks/do/20260506-1950-search-runner-fatal-artifact-review-fix.md`
- 必要に応じた作業レポートと PR コメント

## 方針

- `EVALUATOR_PROFILE` の解決を baseline summary 読み込みより前に行い、baseline 読み込み失敗時でも fallback summary/report が指定 profile を保持するようにする。
- `search-run.ts` は CLI script としての挙動を維持し、fatal error 時は artifact を生成してから元のエラーで終了する。
- 自動テストは child process で `search-run.ts` を実行し、unknown profile と missing baseline の artifact 生成を検証する。
- 既存 API / Web / Infra / RAG workflow / 認可境界には触れない。

## 必要情報

- PR #125: `https://github.com/tsuji-tomonori/rag-assist/pull/125`
- review ID: `4235367706`
- 関連レビュー指摘:
  - `BASELINE_SUMMARY` 読み込み失敗時の evaluator profile 表示不整合
  - fatal artifact 生成契約の regression test 不足
- 関連要求・設計:
  - `FR-012`, `FR-019`, `SQ-001`
  - `ASR-EVAL-001`

## 実行計画

1. `tasks/do/` に本 task を作成し、受け入れ条件を明記する。
2. `search-run.ts` の evaluator profile 解決順序を修正する。
3. `search-run.test.ts` を追加し、fatal error 時の artifact 生成と profile 記録を検証する。
4. benchmark workspace の typecheck / test / build と差分チェックを実行する。
5. 受け入れ条件を task にチェック結果として記録する。
6. 作業レポートを作成する。
7. commit / push し、PR #125 に受け入れ条件確認コメントを投稿する。
8. task を `tasks/done/` へ移動し、状態を `done` に更新して追加 commit / push する。

## ドキュメントメンテナンス計画

- 要求仕様: fatal artifact の診断精度と regression test 追加であり、新しい機能要求・非機能要求は追加しない。`FR-012`、`FR-019`、`SQ-001` の既存評価可能性を維持する範囲と判断する。
- architecture / design: RAG workflow、API、認可、データ永続 schema は変更しないため更新不要。
- README / API examples / OpenAPI: API contract 変更がないため更新不要。
- local verification / operations: PR #125 で `LOCAL_VERIFICATION.md` に fatal artifact 生成方針を追記済み。今回の変更はその記述の正確性を補強するため追加更新不要。
- PR body / PR comment: 実施した検証と受け入れ条件の充足状況を PR コメントで明記する。

## 受け入れ条件

- AC1: `BASELINE_SUMMARY` 読み込み失敗時でも、`EVALUATOR_PROFILE=strict-ja` の fallback summary/report が `strict-ja@1` を記録する。
- AC2: unknown evaluator profile の fatal error 時に、process は失敗終了し、`OUTPUT`、`SUMMARY`、`REPORT` が生成される。
- AC3: missing baseline の fatal error 時に、process は失敗終了し、`OUTPUT`、`SUMMARY`、`REPORT` が生成される。
- AC4: AC1 から AC3 を自動 regression test で確認できる。
- AC5: 既存の通常 search benchmark 実行経路で report / summary / results 生成が維持される。
- AC6: `npm run typecheck -w @memorag-mvp/benchmark`、`npm run test -w @memorag-mvp/benchmark`、`npm run build -w @memorag-mvp/benchmark` が通る。
- AC7: `git diff --check` と関連 Markdown / TypeScript への pre-commit が通る。
- AC8: PR #125 に受け入れ条件の確認結果が日本語コメントとして投稿される。
- AC9: 本 task が完了時に `tasks/done/` へ移動され、状態が `done` になる。

## 検証計画

- `npm run typecheck -w @memorag-mvp/benchmark`
- `npm run test -w @memorag-mvp/benchmark`
- `npm run build -w @memorag-mvp/benchmark`
- `API_BASE_URL=http://127.0.0.1:1 DATASET=benchmark/datasets/search.sample.jsonl OUTPUT=.local-data/search-validation-results.jsonl SUMMARY=.local-data/search-validation-summary.json REPORT=.local-data/search-validation-report.md npm run start:search -w @memorag-mvp/benchmark`
- `pre-commit run --files memorag-bedrock-mvp/benchmark/search-run.ts memorag-bedrock-mvp/benchmark/search-run.test.ts tasks/do/20260506-1950-search-runner-fatal-artifact-review-fix.md`
- `git diff --check`

## PRレビュー観点

- `should fix` 2 件がコードとテストの両方で解消されているか。
- fatal error 時の artifact 生成が元のエラー終了を隠していないか。
- summary JSON / report Markdown の evaluator profile が運用診断に使える正確な値になっているか。
- テストが実装詳細に寄りすぎず、CLI の観測可能な契約を検証しているか。
- API / Web / Infra / 認可境界に不要な変更が混ざっていないか。

## 未決事項・リスク

- 決定事項: unknown evaluator profile は指定値が無効なため、fallback summary/report の profile は default fallback のままとし、runner error に原因を記録する。
- 決定事項: missing baseline など profile 解決後の fatal error では、指定 profile を fallback artifact に記録する。
- リスク: child process test はファイル I/O と `tsx` loader に依存するため、単体関数テストより実行時間が長い。ただし CLI artifact 契約を直接検証できるため、この PR では妥当とする。
