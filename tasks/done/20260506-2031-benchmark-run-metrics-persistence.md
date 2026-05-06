# 性能テスト成功 run の metrics 永続化

保存先: `tasks/done/20260506-2031-benchmark-run-metrics-persistence.md`

## 状態

- done

## 背景

性能テスト run `bench_20260506T102324Z_6d70da9b` は成功しているにもかかわらず、管理画面で p50 / p95 / accuracy / recall が未計測表示になっていた。調査の結果、CodeBuild runner は `summary.json` を S3 に保存していたが、管理画面が参照する `BenchmarkRunsTable.metrics` へ summary metrics を保存していなかった。

## 目的

CodeBuild runner が完了時に benchmark summary の主要 metrics を run record へ永続化し、成功 run の性能指標を管理画面で表示できる状態にする。

## 対象範囲

- `memorag-bedrock-mvp/infra/lib/memorag-mvp-stack.ts`
- `memorag-bedrock-mvp/infra/scripts/update-benchmark-run-metrics.mjs`
- `memorag-bedrock-mvp/infra/test/update-benchmark-run-metrics.test.ts`
- `memorag-bedrock-mvp/infra/test/memorag-mvp-stack.test.ts`
- `memorag-bedrock-mvp/infra/test/__snapshots__/memorag-mvp-stack.snapshot.json`
- `memorag-bedrock-mvp/infra/package.json`
- `memorag-bedrock-mvp/package-lock.json`
- `memorag-bedrock-mvp/docs/OPERATIONS.md`
- `memorag-bedrock-mvp/docs/3_設計_DES/41_API_API/DES_API_001.md`
- `reports/working/20260506-2022-benchmark-run-metrics.md`
- PR #131: `https://github.com/tsuji-tomonori/rag-assist/pull/131`

## 方針

- CodeBuild の `post_build` で S3 artifact upload 後に `summary.json` を読み、管理画面に必要な数値だけ `BenchmarkRunsTable.metrics` に保存する。
- agent benchmark の `retrievalRecallAt20` と search benchmark の `recallAt20` を同じ run metrics の `retrievalRecallAt20` に正規化する。
- DynamoDB 権限は `dynamodb:UpdateItem` のみに限定し、CodeBuild role の権限拡大を最小化する。
- API route、認可 middleware、公開 response schema は変更しない。
- 運用手順と API 設計には、runner が metrics を run record に反映することを追記する。

## 必要情報

- 管理画面の性能テスト履歴は `run.metrics?.p50LatencyMs`、`run.metrics?.p95LatencyMs`、`run.metrics?.answerableAccuracy`、`run.metrics?.retrievalRecallAt20` を参照する。
- 既存の benchmark CLI は `summary.json` の top-level `total` / `succeeded` / `failedHttp` と nested `metrics` を出力する。
- search benchmark summary は `metrics.recallAt20` を出力するため、run record では `retrievalRecallAt20` へ対応付ける。
- 最新 `origin/main` には CodeBuild build ID / log URL 永続化が入っているため、rebase 時にその変更と統合した。

## 実行計画

1. `origin/main` から `codex/benchmark-run-metrics` worktree を作成する。
2. `summary.json` から run metrics を抽出して DynamoDB に保存する script を追加する。
3. CDK buildspec の `post_build` に metrics 更新 script を接続する。
4. CodeBuild project に `BENCHMARK_RUNS_TABLE_NAME` を渡し、`dynamodb:UpdateItem` のみ付与する。
5. agent/search summary の metrics mapping を自動テストに追加する。
6. CDK assertion / snapshot を更新する。
7. 運用 docs と API design docs を更新する。
8. 検証を実行し、作業レポートを作成する。
9. commit / push し、GitHub Apps で PR #131 を作成する。
10. 本 task を `tasks/done/` に作成し、受け入れ条件チェック結果を PR コメントに投稿する。

## ドキュメントメンテナンス計画

- 要求仕様: 既存の `FR-019` と `SQ-001` の benchmark summary / latency metric 出力を管理画面 run record へ反映する修正であり、新しい要求 ID は追加しない。
- architecture / design: `DES_API_001` の `/benchmark-runs` 説明に、runner が `summary.json` から `metrics` を抽出して同じ run record に保存することを追記する。
- operations: `OPERATIONS.md` に、CodeBuild runner が `BenchmarkRunsTable.metrics` を更新し、管理画面の p50 / p95 / accuracy / recall 表示に使うことを追記する。
- README / API examples / OpenAPI: API request / response schema と利用例は変えないため更新不要。
- PR body / PR comment: 未実施の実 AWS CodeBuild 確認と、受け入れ条件の充足状況を日本語で明記する。

## 受け入れ条件

- AC1: CodeBuild runner は `summary.json` を S3 に保存した後、同じ run record の `metrics` を更新する。
- AC2: run metrics には `total`、`succeeded`、`failedHttp`、`p50LatencyMs`、`p95LatencyMs`、`averageLatencyMs`、`errorRate` が保存される。
- AC3: agent benchmark summary の `answerableAccuracy` と `retrievalRecallAt20` が run metrics に保存される。
- AC4: search benchmark summary の `recallAt20` が run metrics の `retrievalRecallAt20` に保存される。
- AC5: CodeBuild role の DynamoDB 権限は benchmark runs table の `dynamodb:UpdateItem` に限定される。
- AC6: CodeBuild build ID / log URL 永続化の最新 `main` 変更と共存している。
- AC7: API route、認可 middleware、公開 response schema を変更しない。
- AC8: 運用 docs と API design docs に metrics 永続化の説明がある。
- AC9: infra test、infra typecheck、差分チェック、pre-commit が通る。
- AC10: 実 AWS CodeBuild 未実施の制約が PR body、作業レポート、または PR コメントに明記される。
- AC11: 受け入れ条件チェック結果が PR #131 に日本語コメントとして投稿される。

## 受け入れ条件チェック結果

- [x] AC1: `memorag-mvp-stack.ts` の CodeBuild `post_build` が `results.jsonl`、`summary.json`、`report.md` を S3 へ保存した後に `node infra/scripts/update-benchmark-run-metrics.mjs` を実行する。
- [x] AC2: `update-benchmark-run-metrics.mjs` の `buildBenchmarkRunMetrics` が `total`、`succeeded`、`failedHttp`、`p50LatencyMs`、`p95LatencyMs`、`averageLatencyMs`、`errorRate` を抽出する。
- [x] AC3: `update-benchmark-run-metrics.test.ts` の agent summary test で `answerableAccuracy` と `retrievalRecallAt20` の保存対象化を確認した。
- [x] AC4: `update-benchmark-run-metrics.test.ts` の search summary test で `recallAt20` が `retrievalRecallAt20` に mapping されることを確認した。
- [x] AC5: `memorag-mvp-stack.ts` で CodeBuild project role に `dynamodb:UpdateItem` のみを `benchmarkRunsTable.tableArn` へ付与している。
- [x] AC6: rebase 時に最新 `main` の CodeBuild build ID / log URL 保存処理と統合し、CDK snapshot test が通った。
- [x] AC7: 変更は infra script / CDK / docs / tests / package dependency に限定され、API route、認可 middleware、公開 response schema は変更していない。
- [x] AC8: `OPERATIONS.md` と `DES_API_001.md` に metrics 永続化の説明を追記した。
- [x] AC9: `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/infra`、`npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/infra`、`git diff --check HEAD~1..HEAD`、`pre-commit run --files ...` が pass した。
- [x] AC10: PR #131 body と `reports/working/20260506-2022-benchmark-run-metrics.md` に実 AWS CodeBuild 実行未実施を明記した。
- [x] AC11: PR #131 に受け入れ条件チェック結果コメントを投稿した。コメント ID: `4387543444`。

## 検証計画

- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/infra`
- `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/infra`
- `git diff --check HEAD~1..HEAD`
- `pre-commit run --files memorag-bedrock-mvp/infra/scripts/update-benchmark-run-metrics.mjs memorag-bedrock-mvp/infra/test/update-benchmark-run-metrics.test.ts memorag-bedrock-mvp/docs/3_設計_DES/41_API_API/DES_API_001.md memorag-bedrock-mvp/docs/OPERATIONS.md memorag-bedrock-mvp/infra/lib/memorag-mvp-stack.ts memorag-bedrock-mvp/infra/package.json memorag-bedrock-mvp/infra/test/__snapshots__/memorag-mvp-stack.snapshot.json memorag-bedrock-mvp/infra/test/memorag-mvp-stack.test.ts memorag-bedrock-mvp/package-lock.json reports/working/20260506-2022-benchmark-run-metrics.md`
- 実環境確認を行う場合は、デプロイ後に新規 benchmark run を 1 件起動し、`BenchmarkRunsTable.metrics` と管理画面 p50 / p95 / accuracy / recall 表示を確認する。

## PRレビュー観点

- `summary.json` から保存する metrics が管理画面の表示項目と一致しているか。
- search benchmark の `recallAt20` を `retrievalRecallAt20` に正規化する判断が妥当か。
- DynamoDB 更新 script が token、raw prompt、chunk text、ACL metadata などの機微情報を保存していないか。
- CodeBuild role の DynamoDB 権限が `UpdateItem` と benchmark runs table に限定されているか。
- CodeBuild build ID / log URL 永続化処理と metrics 更新処理が同じ buildspec 内で矛盾していないか。
- API route / permission / response schema 変更が混ざっていないか。
- 実 AWS 未検証の残リスクが PR body / コメントに明記されているか。

## 未決事項・リスク

- 決定事項: metrics 更新は Step Functions ではなく CodeBuild post_build で実行する。理由は、runner が生成済みの `summary.json` をローカルに持っており、JSON parsing と mapping を script と unit test で検証しやすいため。
- 決定事項: CodeBuild role の DynamoDB 権限は `dynamodb:UpdateItem` のみに限定する。
- リスク: 実 AWS CodeBuild の runtime で DynamoDB 更新が失敗すると、S3 artifact はあるが run metrics は表示されない可能性がある。デプロイ後 smoke で確認する。
- リスク: 既存の過去 run には retroactive に metrics を補完しない。今回の修正は新規実行分から有効になる。
