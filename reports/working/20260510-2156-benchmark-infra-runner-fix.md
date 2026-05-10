# 作業完了レポート

保存先: `reports/working/20260510-2156-benchmark-infra-runner-fix.md`

## 1. 受けた指示

- 主な依頼: benchmark 失敗の P0 対応として、conversation runner の path 不整合と PDF ingest worker OOM を修正する。
- 追加条件: `jp-public-pdf-qa-v1` の `01zyokan_202603.pdf` 除外や `.txt` / `.textract.json` fixture 化は行わず、インフラ性能込みの性能テストとして infra 増強で対応する。
- 成果物: 実装差分、検証結果、task md、PR、PR コメント、作業レポート。

## 2. 要件整理

| 要件ID | 指示・要件 | 重要度 | 対応状況 |
|---|---|---:|---|
| R1 | `conversation-run.ts` の相対 path 解決を cwd 非依存にする | 高 | 対応 |
| R2 | `jp-public-pdf-qa-v1` の PDF を除外せず infra 増強する | 高 | 対応 |
| R3 | PDF ingest の stage 別計測ログを追加する | 高 | 対応 |
| R4 | 変更範囲に見合う検証を実行する | 高 | 対応 |
| R5 | 作業・未検証・リスクを記録する | 高 | 対応 |

## 3. 検討・判断したこと

- `conversation-run.ts` は `run.ts` / `search-run.ts` と同じ path 解決に揃え、CodeBuild の workspace cwd と repo root 配置のずれを runner 側で吸収する方針にした。
- PDF OOM は除外や fixture 化ではなく、`DocumentIngestRunWorkerFunction` の memory / timeout / ephemeral storage を増やす対応にした。
- ログは文書本文や chunk 本文を出さず、stage、size、文字数、chunk 数、`process.memoryUsage()` のみに限定した。
- `seedBenchmarkCorpus` の fail-soft / cache-friendly 化は P1 と判断し、今回の P0 PR には含めなかった。

## 4. 実施した作業

- `conversation-run.ts` に `resolveExistingPath` / `resolveOutputPath` を追加し、dataset / corpus / output artifact path を cwd 非依存にした。
- `conversation-run.test.ts` を追加し、CodeBuild corpus の repo root 相対 path 解決を検証した。
- `DocumentIngestRunWorkerFunction` を 4096MB memory、30分 timeout、4GiB ephemeral storage に増強した。
- `document_ingest_stage` と `document_extract_stage` の構造化ログを追加した。
- CDK snapshot を更新した。
- `docs/OPERATIONS.md` に worker 増強値とログ確認観点を追記した。

## 5. 成果物

| 成果物 | 形式 | 内容 | 指示との対応 |
|---|---|---|---|
| `memorag-bedrock-mvp/benchmark/conversation-run.ts` | TypeScript | conversation runner path 解決修正 | R1 |
| `memorag-bedrock-mvp/benchmark/conversation-run.test.ts` | TypeScript test | CodeBuild corpus path 回帰テスト | R1/R4 |
| `memorag-bedrock-mvp/infra/lib/memorag-mvp-stack.ts` | CDK | ingest worker 増強 | R2 |
| `memorag-bedrock-mvp/apps/api/src/rag/text-extract.ts` | TypeScript | PDF 抽出 stage ログ | R3 |
| `memorag-bedrock-mvp/apps/api/src/rag/memorag-service.ts` | TypeScript | ingest pipeline stage ログ | R3 |
| `memorag-bedrock-mvp/docs/OPERATIONS.md` | Markdown | 運用ログ確認手順 | R5 |
| `tasks/do/20260510-2146-benchmark-infra-runner-fix.md` | Markdown | task 記録 | R5 |

## 6. 指示へのfit評価

| 評価軸 | 評価 | 理由 |
|---|---|---|
| 指示網羅性 | 5 | P0 の path 修正と infra 増強を実装し、PDF 除外・fixture 化を行っていない |
| 制約遵守 | 5 | 実施していない CodeBuild 再実行は未実施として明記 |
| 成果物品質 | 4 | ローカル検証は通過。実 AWS の重い PDF 再実行は未確認 |
| 説明責任 | 5 | task md、docs、PR 用情報に判断と制約を記録 |
| 検収容易性 | 5 | targeted test と snapshot 差分で確認可能 |

総合fit: 4.8 / 5.0（約96%）
理由: 指示された実装方針は満たしたが、実 AWS CodeBuild / Lambda 上で `01zyokan_202603.pdf` の再 ingest 成功までは未検証のため満点ではない。

## 7. 実行した検証

- `npm ci`: pass。既存依存に `npm audit` の 3 vulnerabilities が表示された。
- `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/benchmark`: pass
- `npm --prefix memorag-bedrock-mvp test -w @memorag-mvp/benchmark`: pass
- `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/api`: pass
- `npm --prefix memorag-bedrock-mvp test -w @memorag-mvp/api`: pass
- `npm --prefix memorag-bedrock-mvp run build -w @memorag-mvp/infra`: pass
- `UPDATE_SNAPSHOTS=1 npm --prefix memorag-bedrock-mvp test -w @memorag-mvp/infra`: pass
- `npm --prefix memorag-bedrock-mvp test -w @memorag-mvp/infra`: pass
- `npm --prefix memorag-bedrock-mvp run lint`: pass
- `git diff --check`: pass

## 8. 未対応・制約・リスク

- 実 AWS の `jp-public-pdf-qa-v1` / `chatrag-bench-v1` / `mtrag-v1` CodeBuild 再実行は未実施。production 側の external state と費用に関わるため、PR 後またはユーザー確認後に実行する。
- `DocumentIngestRunWorkerFunction` の memory 増強は Lambda コスト増につながる。
- `seedBenchmarkCorpus` の fail-soft / cache-friendly 化は今回の P0 対応には含めていない。
