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
- `FR-048`
- `SQ-001`
- `SQ-008`
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

### Model first-token timing

1. chat orchestration entry で `node:perf_hooks.performance.now()` の origin を一度だけ取得する。
2. `finalAnswer` / `answerRepair` の provider 呼び出しだけ `ConverseStream` を使い、最初の非空 `contentBlockDelta.delta.text` で callback を一度だけ発火する。他 task と callback のない呼び出しは既存 `Converse` を維持する。
3. callback と origin の差を同一 process/clock の `latencyMs` とし、成功した answer attempt のうち最終のものだけを採用する。失敗 attempt の delta、別 turn、wall clock、provider aggregate、API completion latency は混在させない。
4. evidence は `schemaVersion=1`、`unit=ms`、`clock=node_performance`、`origin=chat_orchestration_ingress`、`boundary=answer_model_first_content_delta`、`clientVisible=false` を固定する。
5. refusal / clarification は `not_applicable`、回答なのに delta 未観測は `unavailable` とし、値と attempt ordinal を持たせない。
6. sanitized debug trace、chat response、benchmark case artifact へ同じ evidence を伝播し、case evidence から summary/run metrics の p50/p95/p99/sample count を再導出する。
7. production source sample では first-token を diagnostic measurement とする。stakeholder 承認済み threshold がないため required signal catalog / promotion gate へ追加しない。
8. 現行 chat API は生成結果を buffer して JSON または SSE final event として返すため、この evidence は client-visible first-token ではない。client streaming が導入されるまで client-visible TTFT は未測定とする。

### 評価 summary / report

1. Benchmark Report Exporter は case results から summary metrics を計算する。
2. answerable accuracy、unanswerable precision、false refusal rate、retrieval recall、context relevance、citation hit、faithfulness、latency を出す。
   - `falseRefusalRate` は answerable case のうち actual response type が refusal の割合とする。
   - answerable case が0件なら `null` とし、0%またはpassへ変換しない。
   - regression gate は evaluator profile に承認済み threshold が明示された場合だけ評価し、default profileへ未承認値を補わない。
   - `faithfulness` は answer support で評価した全回答文のうち支持された文の micro-rate とし、support evidence が0件なら `null` とする。
   - `contextRelevance` は expected file/document が指定された行の raw retrieved item のうち期待識別子に一致した item の micro-rate とし、期待識別子なしまたは retrieved 0件なら `null` とする。
   - versioned case artifact は supported/unsupported/evaluated claim count と relevant/evaluated retrieved count を保持し、run metrics は case evidence から再導出する。aggregate 自己申告値だけでは production observation を作らない。
   - context relevance は owner 承認済み policy signal ではないため producer の diagnostic measurement に保持し、未承認の required gate として追加しない。
   - first-token percentile は `measured` かつ schema/clock/origin/boundary/attempt が整合する case evidence だけから計算し、missing/invalid/non-answer を total latency で補完しない。sample count は採用 case 数と一致させる。
3. failure classification は検索不足、回答可否誤判定、引用不一致、支持不足、計算不可などに分ける。
4. Markdown report は人間の調査用、JSON summary は CI や回帰検知用とする。

### Benchmark run と artifact integrity

1. run status は `queued | running | succeeded | failed | timed_out | cancelled` を正とし、`timed_out` は terminal state とする。
2. CodeBuild 同期 task は CodeBuild project timeout より長く state machine 全体 timeout より短い task timeout を持ち、`States.Timeout` または CodeBuild の `TIMED_OUT` 結果を `timed_out` へ分類する。
3. results、summary、report、release audit は schema version 付き `artifactIntegrity` に、artifact ごとの `pending | available | generation_failed | upload_failed`、安全な failure reason、available/failure count を保存する。
4. post-build は欠損 file を空または擬似値で作らず、存在する artifact を独立して upload した後に integrity record を running run へ条件付き保存する。
5. required artifact がすべて `available` の場合だけ `succeeded` へ条件付き遷移し、部分失敗または全失敗は `failed` のまま利用可能 artifact を保持する。
6. metrics update は integrity が `complete` の後だけ実行する。producer は `succeeded + complete` の組だけを品質 evidence とし、integrity のない legacy run、timeout、artifact failure は unavailable/diagnostic measurement に分離する。
7. artifact download は integrity が `available` の対象だけ署名し、UI は利用可能 artifact と生成/保存失敗 artifact を同じ run 内で区別する。CodeBuild log は S3 required artifact とは独立した log metadata として扱う。

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
| CodeBuild task timeout | run を `timed_out` とし、未記録の required artifact を generation failure として明示する。 |
| artifact 部分失敗 | 利用可能 artifact を保持し、run を成功へ遷移させず、metric を unavailable とする。 |

## テスト観点

| 観点 | 期待 |
|---|---|
| trace step | 検索、判定、生成、検証の主要 step が記録される。 |
| diagnostics | indexVersion、aliasVersion、source count、score distribution が残る。 |
| redaction | raw prompt、ACL metadata、alias 本文、secret が通常 response に出ない。 |
| benchmark path | UI 非依存で `/chat` と同等の RAG path を使う。 |
| 固有分岐防止 | dataset expected phrase や row id が runtime branch に入らない。 |
| metrics | `NaN` / `undefined` を出さず、失敗分類が残る。 |
| first-token | 空 delta を数えず callback は1回、成功した最終 answer attempt の同一 monotonic clock evidence だけを採用し、missing/invalid/non-answer を unavailable/not-applicable にする。 |
| report | JSON summary と Markdown report が再現可能な profile 情報を含む。 |
| timeout / artifact | timeout が terminal state となり、部分失敗を成功や metric zero に変換せず、利用可能 artifact だけ download できる。 |
