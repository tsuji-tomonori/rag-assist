# 作業完了レポート

保存先: `reports/working/20260506-2022-benchmark-run-metrics.md`

## 1. 受けた指示

- 主な依頼: 性能テストで成功しているのに未計測になる理由を踏まえ、worktree を作成して修正する。
- 成果物: 修正 commit と `main` 向け PR。
- 形式・条件: Git commit message と PR 本文は日本語ルールに従い、PR 作成は GitHub Apps を利用する。

## 2. 要件整理

| 要件ID | 指示・要件 | 重要度 | 対応状況 |
|---|---|---:|---|
| R1 | 専用 worktree で作業する | 高 | 対応 |
| R2 | 成功 run が未計測表示になる原因を修正する | 高 | 対応 |
| R3 | 必要な検証を実行する | 高 | 対応 |
| R4 | commit と PR 作成まで進める | 高 | 対応 |
| R5 | 作業レポートを残す | 高 | 対応 |

## 3. 検討・判断したこと

- 原因は CodeBuild runner が `summary.json` を生成して S3 へ保存する一方、`BenchmarkRunsTable` の run record に `metrics` を保存していない点にあると判断した。
- 管理画面は `run.metrics` の `p50LatencyMs` / `p95LatencyMs` / `answerableAccuracy` / `retrievalRecallAt20` を表示しており、`metrics` が欠落すると `-` 表示になる。
- Step Functions 側で JSON を分解するより、CodeBuild の post_build でローカルの `summary.json` を読み、必要な数値だけ DynamoDB に更新する方式を採用した。
- CodeBuild の DynamoDB 権限は `dynamodb:UpdateItem` のみに絞り、run record の metrics 更新に必要な最小範囲とした。

## 4. 実施した作業

- `origin/main` から `codex/benchmark-run-metrics` worktree を作成した。
- `infra/scripts/update-benchmark-run-metrics.mjs` を追加し、agent/search benchmark summary から管理画面表示用 metrics を抽出して DynamoDB に保存するようにした。
- CDK の CodeBuild buildspec に metrics 更新 script を接続し、`BENCHMARK_RUNS_TABLE_NAME` 環境変数と最小 IAM 権限を追加した。
- infra test と snapshot を更新し、agent/search summary の metrics 抽出テストを追加した。
- `OPERATIONS.md` と `DES_API_001.md` に metrics 反映動作を追記した。

## 5. 成果物

| 成果物 | 形式 | 内容 | 指示との対応 |
|---|---|---|---|
| `memorag-bedrock-mvp/infra/scripts/update-benchmark-run-metrics.mjs` | JavaScript | benchmark summary から run metrics を DynamoDB 更新する script | R2 |
| `memorag-bedrock-mvp/infra/lib/memorag-mvp-stack.ts` | TypeScript | CodeBuild post_build と IAM/env の接続 | R2 |
| `memorag-bedrock-mvp/infra/test/update-benchmark-run-metrics.test.ts` | TypeScript test | agent/search metrics 抽出の回帰テスト | R3 |
| `memorag-bedrock-mvp/docs/OPERATIONS.md` | Markdown | 運用説明の更新 | R2 |
| `memorag-bedrock-mvp/docs/3_設計_DES/41_API_API/DES_API_001.md` | Markdown | API 設計説明の更新 | R2 |

## 6. 指示へのfit評価

| 評価軸 | 評価 | 理由 |
|---|---|---|
| 指示網羅性 | 5 | worktree 作成、修正、検証、commit、GitHub Apps での PR 作成まで対応。 |
| 制約遵守 | 5 | 日本語 commit / PR ルール、作業レポート、最小権限、未実施検証の明示方針を遵守。 |
| 成果物品質 | 4 | 原因箇所へ限定した修正で、agent/search の両 summary に対応。 |
| 説明責任 | 5 | 原因、判断、検証、権限境界を明記。 |
| 検収容易性 | 5 | 変更ファイルと検証コマンドを明確化。 |

総合fit: 4.8 / 5.0（約96%）
理由: 主要要件は満たした。実 AWS 環境での CodeBuild 実行は未実施のため満点ではない。

## 7. 検証

- `npm ci`: 成功。worktree 内に依存関係を導入。
- `UPDATE_SNAPSHOTS=1 npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/infra`: 成功。CDK snapshot 更新。
- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/infra`: 成功。
- `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/infra`: 成功。
- `git diff --check`: 成功。
- `pre-commit run --files ...`: 成功。
- GitHub Apps による PR 作成: 成功。`https://github.com/tsuji-tomonori/rag-assist/pull/131`

## 8. 未対応・制約・リスク

- 実 AWS 環境での CodeBuild 実行は未実施。PR 後のデプロイ環境で確認する必要がある。
- `gh auth status` は既存 token が無効だったため、PR 作成は GitHub Apps connector で実施した。
