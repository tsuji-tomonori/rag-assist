# Debug Trace・Benchmark 詳細設計

- ファイル: `docs/3_設計_DES/11_詳細設計_DLD/DES_DLD_009.md`
- 種別: `DES_DLD`
- 作成日: 2026-05-07
- 状態: Draft

## 何を書く場所か

RAG workflow の debug trace、UI 非依存 benchmark 実行、評価 summary / report export の設計を定義する。

## 対象

- Debug Trace Store
- Benchmark Runner
- Benchmark Report Exporter
- trace metadata
- benchmark dataset case
- evaluation metrics

## 関連要求

- `FR-010`
- `FR-011`
- `FR-012`
- `FR-013`
- `FR-019`
- `SQ-001`
- `NFR-005`
- `NFR-006`

## 入出力

| 処理 | 入力 | 出力 |
|---|---|---|
| `record_trace_event` | runId、step、decision、score、reason、metadata | trace event |
| `get_debug_run` | authorized user、runId | redacted run trace |
| `download_debug_artifact` | authorized user、runId、format | downloadable artifact |
| `run_benchmark_case` | dataset case、runtime profile、asOfDate | case result、trace reference |
| `summarize_benchmark` | case results | summary metrics、failure classification |
| `export_benchmark_report` | summary、case results、runtime profile | JSON / Markdown report |

## Trace event 方針

| 項目 | 説明 |
|---|---|
| `runId` | chat または benchmark 実行単位の ID。 |
| `step` | `normalize_query`、`search_evidence`、`retrieval_evaluator`、`answerability_gate` などの workflow step。 |
| `decision` | 分岐や判定値。 |
| `reason` | 判定理由の要約。 |
| `scores` | retrieval score、coverage、confidence など。 |
| `references` | chunk id、computed fact id、indexVersion、aliasVersion などの再現情報。 |
| `redaction` | 通常閲覧時に隠す項目の分類。 |

## 処理手順

### Debug Trace 保存

1. Query Orchestrator は workflow step ごとに trace event を作る。
2. Hybrid Retriever は query 数、lexical / semantic / fused count、indexVersion、aliasVersion、source count、score distribution を diagnostics として出す。
3. Retrieval Evaluator は required facts、missingFactIds、riskSignals、nextAction、reason を記録する。
4. Answerability Gate、Citation Validator、Answer Support Verifier は判定、引用、支持関係、拒否理由を記録する。
5. Debug Trace Store は runId と user/resource scope を付けて保存する。
6. 通常 response には trace metadata の参照だけを返し、詳細 trace は permission 付き API から取得する。

### Debug Trace 閲覧・download

1. API は debug run 閲覧 permission と resource scope を検証する。
2. response は raw prompt、secret、ACL metadata、alias 本文、過剰な chunk text を redaction する。
3. download artifact は同じ redaction policy を適用する。
4. 内部調査向けに詳細閲覧が必要な場合は、別 permission と audit log を要求する。

### Benchmark 実行

1. Benchmark Runner は dataset case、runtime profile、asOfDate を読み込む。
2. UI を経由せず、`/chat` と同等の RAG path を実行する。
3. case ごとに answerability、retrieval、citation、faithfulness、latency、trace reference を記録する。
4. dataset 固有の期待語句、row id、corpus 固有分岐を runtime 実装へ渡さない。
5. benchmark 専用の asOfDate は trace に `source: benchmark` として記録する。

### 評価 summary / report

1. Benchmark Report Exporter は case results から summary metrics を計算する。
2. answerable accuracy、unanswerable precision、retrieval recall、citation hit、faithfulness、latency を出す。
3. failure classification は検索不足、回答可否誤判定、引用不一致、支持不足、計算不可などに分ける。
4. Markdown report は人間の調査用、JSON summary は CI や回帰検知用とする。

## セキュリティ・非漏えい

- debug trace は raw prompt、ACL metadata、alias 本文、内部 project code、secret を通常権限へ返さない。
- benchmark artifact は dataset 内の機微情報を含む可能性があるため、download permission を分ける。
- trace は回答改善に必要な根拠を残すが、権限境界を弱めるための backdoor にしない。

## エラー処理

| 事象 | 方針 |
|---|---|
| trace 保存失敗 | main response は可能な範囲で返し、trace 保存失敗 metadata を付ける。 |
| trace 閲覧権限なし | 403 とし、runId の存在有無を過剰に示さない。 |
| redaction policy 未定義 | fail closed とし、詳細 trace を返さない。 |
| benchmark case 実行失敗 | case result に failure を記録し、summary で失敗分類する。 |
| report export 失敗 | raw case results を成功扱いにせず、export failure を返す。 |
| metric が `NaN` になる | summary 生成を失敗扱いにし、対象 metric と入力欠落を記録する。 |

## テスト観点

| 観点 | 期待 |
|---|---|
| trace step | 検索、判定、生成、検証の主要 step が記録される。 |
| diagnostics | indexVersion、aliasVersion、source count、score distribution が残る。 |
| redaction | raw prompt、ACL metadata、alias 本文、secret が通常 response に出ない。 |
| benchmark path | UI 非依存で `/chat` と同等の RAG path を使う。 |
| 固有分岐防止 | dataset expected phrase や row id が runtime branch に入らない。 |
| metrics | `NaN` / `undefined` を出さず、失敗分類が残る。 |
| report | JSON summary と Markdown report が再現可能な profile 情報を含む。 |
