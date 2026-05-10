# benchmark runner 初期化失敗と PDF ingest OOM 対応

- 状態: done
- タスク種別: 修正
- branch: `codex/benchmark-infra-runner-fix`
- base: `origin/main`

## 背景

`chatrag-bench-v1` / `mtrag-v1` の CodeBuild benchmark が corpus path の `ENOENT` で QA 実行前に失敗している。また `jp-public-pdf-qa-v1` は `01zyokan_202603.pdf` の async document ingest worker が `Runtime.OutOfMemory` で失敗している。

ユーザー指示により、`jp-public-pdf-qa-v1` の PDF 除外や `.txt` / `.textract.json` fixture 化による暫定回避は行わない。インフラ性能を含めた性能テストとして、ingest worker の増強と計測で対応する。

## なぜなぜ分析サマリ

### 問題文

CodeBuild benchmark の BUILD フェーズが QA 実行前の corpus seed / runner 初期化で失敗し、POST_BUILD が空の `results.jsonl` と `errorRate: 1` の summary をアップロードしている。

### 確認済み事実

- `conversation-run.ts` は `DATASET`, `OUTPUT`, `SUMMARY`, `REPORT`, `BENCHMARK_CORPUS_DIR` を env 値のまま使用している。
- `run.ts` / `search-run.ts` は `process.cwd()`, benchmark dir, repo root を候補に `resolveExistingPath` で入力 path を解決し、出力 path は repo root 基準にしている。
- `DocumentIngestRunWorkerFunction` は `memorySize: 1024`, `timeout: 15 minutes` である。
- PDF 抽出は buffer 全体を使い、`pdf-parse`, `pdftotext`, 必要時 Textract fallback を実行する。
- ユーザー調査では `01zyokan_202603.pdf` ingest run が `Runtime.OutOfMemory` で kill されている。

### 推定原因

- CodeBuild の prepare が repo root 基準に corpus を配置する一方、workspace 実行時の cwd と runner の相対 path 解釈がずれ、conversation runner だけ `ENOENT` になる。
- 大きい/複雑な PDF を 1GB Lambda で全体 buffer 抽出すると、PDF parser や外部抽出の peak memory が上限に達しやすい。

### 根本原因

- conversation runner に他 runner と同じ cwd 非依存の path 解決が実装されていない。
- async ingest worker の memory/timeout 設計と PDF 抽出 stage の観測ログが、インフラ込みの重い PDF benchmark に対して不足している。

### 対策

- `conversation-run.ts` に `run.ts` / `search-run.ts` と同等の path 解決を追加する。
- `DocumentIngestRunWorkerFunction` の memory/timeout/ephemeral storage を増強する。
- PDF 抽出 stage の前後に file size、mime、抽出方式、文字数、memory usage を構造化ログとして追加する。

## 作業範囲

- `memorag-bedrock-mvp/benchmark/conversation-run.ts`
- `memorag-bedrock-mvp/infra/lib/memorag-mvp-stack.ts`
- `memorag-bedrock-mvp/apps/api/src/rag/text-extract.ts`
- 必要に応じた infra snapshot / docs / tests

## 対象外

- `01zyokan_202603.pdf` の除外
- PDF corpus の `.txt` / `.textract.json` fixture 化
- production deploy / 実 AWS CodeBuild 再実行
- `seedBenchmarkCorpus` の fail-soft / cache-friendly 化

## 受け入れ条件

- [x] `conversation-run.ts` が `DATASET`, `OUTPUT`, `SUMMARY`, `REPORT`, `BENCHMARK_CORPUS_DIR` を cwd 非依存に解決する。
- [x] `BENCHMARK_CORPUS_DIR=./benchmark/.runner-chatrag-bench-corpus` のような repo root 相対 path が workspace 実行 cwd に依存せず解決できる。
- [x] `DocumentIngestRunWorkerFunction` が PDF benchmark 用に 3GB 以上の memory、延長 timeout、必要十分な ephemeral storage を持つ。
- [x] PDF 抽出で stage 別 memory / file size / text length ログが残る。
- [x] PDF 除外や fixture 化を行っていない。
- [x] 変更範囲に見合う benchmark / API / infra の検証を実行し、未実施項目は理由を記録する。
- [x] 作業レポート、PR 本文、PR コメントに実施内容と未検証事項を正直に記録する。

## 検証計画

- `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/benchmark`
- `npm --prefix memorag-bedrock-mvp test -w @memorag-mvp/benchmark`
- `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/api`
- `npm --prefix memorag-bedrock-mvp test -w @memorag-mvp/api`
- `npm --prefix memorag-bedrock-mvp run build -w @memorag-mvp/infra`
- `npm --prefix memorag-bedrock-mvp test -w @memorag-mvp/infra`
- `git diff --check`

## ドキュメント保守計画

`README.md`, `docs/OPERATIONS.md`, `docs/LOCAL_VERIFICATION.md`, `docs/GITHUB_ACTIONS_DEPLOY.md` の benchmark / ingest worker / CodeBuild path 記述への影響を確認し、恒久的な運用差分がある場合のみ更新する。

## PR レビュー観点

- runner path 解決が agent/search/conversation で揃っていること。
- infra 増強が snapshot と一致し、コスト影響が PR に明記されていること。
- PDF 抽出ログが機密本文を出さず、サイズや memory など診断情報だけを出すこと。
- RAG の根拠性・認可境界・benchmark 固有の期待語句 hard-code を弱めていないこと。

## リスク

- 実 AWS の `01zyokan_202603.pdf` 再 ingest 成功は CodeBuild / Lambda 実行が必要で、ローカル検証だけでは完全確認できない。
- memory 増強により Lambda 実行コストは増える。

## 実施結果

- `conversation-run.ts` に `resolveExistingPath` / `resolveOutputPath` を追加し、dataset / output / summary / report / corpus dir の解決を `run.ts` / `search-run.ts` と揃えた。
- `conversation-run.test.ts` を追加し、repo root 相対の CodeBuild corpus path 解決を検証した。
- `DocumentIngestRunWorkerFunction` を 4096MB memory、30分 timeout、4GiB ephemeral storage に増強し、CDK snapshot を更新した。
- `document_ingest_stage` / `document_extract_stage` の構造化ログを追加し、S3 read、PDF extract、pdf-parse、pdftotext、Textract、chunk、embedding、vector put の stage と memory snapshot を確認できるようにした。
- `docs/OPERATIONS.md` に worker 増強値と CloudWatch Logs の確認観点を追記した。
- `01zyokan_202603.pdf` の除外や fixture 化は行っていない。

## 検証結果

- `npm ci`: pass。既存依存に `npm audit` の 3 vulnerabilities が表示されたが、今回の変更範囲外。
- `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/benchmark`: pass
- `npm --prefix memorag-bedrock-mvp test -w @memorag-mvp/benchmark`: pass
- `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/api`: pass
- `npm --prefix memorag-bedrock-mvp test -w @memorag-mvp/api`: pass
- `npm --prefix memorag-bedrock-mvp run build -w @memorag-mvp/infra`: pass
- `UPDATE_SNAPSHOTS=1 npm --prefix memorag-bedrock-mvp test -w @memorag-mvp/infra`: pass。snapshot 更新用。
- `npm --prefix memorag-bedrock-mvp test -w @memorag-mvp/infra`: pass
- `npm --prefix memorag-bedrock-mvp run lint`: pass
- `git diff --check`: pass

## 未実施・制約

- 実 AWS の `jp-public-pdf-qa-v1` / `chatrag-bench-v1` / `mtrag-v1` CodeBuild 再実行は未実施。production 側の external state と費用に関わるため、PR 後またはユーザー確認後に実行する。
