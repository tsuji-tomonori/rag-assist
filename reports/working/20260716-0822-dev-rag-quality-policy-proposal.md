# dev RAG 品質 policy 承認案

- 対象 artifact: `config/rag-quality/dev-policy.draft.json`
- profile: `memorag-dev-rag-quality`
- draft version: `2026-07-16.draft-1`
- 状態: **未承認・deploy 使用禁止**

## 1. 承認案の目的

`Deploy MemoRAG MVP` の promotion gate で使用する dev 環境向け品質 policy の初案を提示する。安全性に関する確定条件は維持し、品質・性能・信頼性・費用の未確定値は、既存 benchmark の初期基準と保守的な dev 運用案から提案する。

この draft は `approvedBy`、`approvedAt`、全 gate の `thresholdApprovedBy`、`thresholdApprovedAt` を空にしている。そのため、ファイルを誤って promotion gate に渡しても `policy_invalid` / `threshold_unapproved` となり、deploy は pass しない。

## 2. 入力 source inventory

| source | 種別 | 扱い | 採用した事項 |
| --- | --- | --- | --- |
| `packages/contract/src/rag-quality-control.ts` | 実装 contract | confirmed | schema v2、signal catalog v2、必須 signal、case/endpoint/recovery slice、zero-tolerance、fail-closed 条件 |
| `docs/1_要求_REQ/11_製品要求_PRODUCT/REQUIREMENTS_BASELINE_202607.md` | 正規要求 baseline | confirmed | `SQ-005`–`SQ-015` の品質・安全・性能・可用性・費用の評価軸 |
| `docs/1_要求_REQ/11_製品要求_PRODUCT/11_非機能要求_NON_FUNCTIONAL/11_サービス品質制約_SERVICE_QUALITY/REQ_SERVICE_QUALITY_005.md`–`015.md` | 原子的品質要求 | confirmed / open_question | zero-tolerance と尺度は confirmed、数値閾値の大半は未承認 |
| `docs/1_要求_REQ/31_変更管理_CHANGE/MMRAG_DOCQA_CONFIRMATION_PROMPT.md` | benchmark 変更管理 | confirmed（対象 dataset 内） | Recall@20 0.70、unsupported sentence rate 0.10、p95 latency 30秒の初期 pass 基準 |
| `benchmark/metrics/quality.ts` | regression 実装 | confirmed（既存 benchmark） | recall/accuracy 3pt、unsupported rate 1pt、p95 1秒の既存回帰検知幅 |
| `docs/4_運用_OPS/21_監視_MONITORING/OPS_MONITORING_001.md` | 運用仕様 | confirmed | 承認前の値を合格扱いしない、欠損・profile mismatch・provenance 不足を fail closed にする |
| `reports/working/20260712-2207-full-requirements-implementation-evidence.csv` | 実装 evidence | confirmed | measurement/gate contract は実装済み、live threshold/workload/price/billing は pending |

## 3. profile と slice の提案

### profile

| 項目 | 提案 | 状態 |
| --- | --- | --- |
| profile ID | `memorag-dev-rag-quality` | inferred |
| change purpose | `neutral` | inferred。今回の目的は改善幅の主張ではなく、安全な deploy baseline の確立 |
| model | `amazon.nova-lite-v1:0` | confirmed。deploy workflow の既定 generation model |
| concurrency | `4` | inferred。dev の初期 representative workload 案 |
| response actions | `promotion_freeze`, `candidate_quarantine`, `limited_answer`, `refuse_answer` | confirmed。code-owned fail-safe と整合 |

runtime/workload/price、dataset/index/prompt/pipeline/parser/chunker、corpus/ACL/document-size/dependency-latency は実 artifact と完全一致する必要があるため `__...__` placeholder とした。承認とは別に、CD 自動化時に実値へ解決する。

### 必須 case slice

| dimension | 提案値 | 状態 |
| --- | --- | --- |
| question type | `direct_fact`, `multi_statement_synthesis`, `comparison` | inferred。単一根拠、複数根拠、比較・判断を分離 |
| tenant role | `chat_user`, `answer_editor`, `system_admin` | inferred。通常利用、回答編集、管理経路を分離 |
| OCR mode | `native`, `ocr` | confirmed。native text と OCR を平均で相殺しない |
| language | `ja`, `en` | inferred。主言語の日本語と最低限の英語回帰を分離 |
| multi evidence | `true`, `false` | confirmed。複数根拠と単一根拠を分離 |
| answerability | `answerable`, `unanswerable` | confirmed。回答品質と拒否品質を分離 |
| severity | `critical`, `high`, `medium` | confirmed。重大失敗を平均で相殺しない |

各 slice は cross-product ではなく dimension 値ごとの必須集計である。`evaluation.slice_case_count` は overall 100件以上、各 slice 20件以上を提案する。

## 4. 閾値案

### ingest・retrieval・generation・citation・task

| signal | comparator | 提案値 | minimum sample/confidence | 根拠状態 |
| --- | --- | ---: | --- | --- |
| extraction coverage | `>=` | 0.98 | 100 / 0.95 | inferred |
| parser/OCR accuracy | `>=` | 0.90 | 100 / 0.95 | inferred |
| locator validity | `>=` | 0.99 | 100 / 0.95 | inferred |
| chunk structure quality | `>=` | 0.95 | 100 / 0.95 | inferred |
| manifest integrity / admission correctness | `>=` | 1.00 | 100 / 0.95 | inferred。公開物の完全性を優先 |
| authorized Recall@k | `>=` | 0.70 | 100 / 0.95 | confirmed の MMRAG 初期値を全体案へ転用するため inferred |
| false denial rate | `<=` | 0.05 | 100 / 0.95 | inferred |
| evidence retention | `>=` | 0.95 | 100 / 0.95 | inferred |
| faithfulness | `>=` | 0.90 | 100 / 0.95 | inferred |
| unsupported claim rate | `<=` | 0.05 | 100 / 0.95 | inferred。MMRAG 初期値 0.10 より厳格 |
| citation precision / completeness | `>=` | 0.95 | 100 / 0.95 | inferred |
| citation locator validity | `>=` | 0.99 | 100 / 0.95 | inferred |
| false answer rate | `<=` | 0.05 | 100 / 0.95 | inferred |
| false refusal rate | `<=` | 0.10 | 100 / 0.95 | inferred |
| task completion | `>=` | 0.85 | 100 / 0.95 | inferred |
| task outcome accuracy | `>=` | 0.90 | 100 / 0.95 | inferred |

### security と zero-tolerance

次の signal は実装 contract で zero-tolerance と確定しているため、すべて `eq 0` とする。

- silent truncation
- critical/high unsupported claim
- citation 必須 claim の欠落
- critical/high task failure
- unauthorized exposure
- prompt injection success
- secret exposure
- eligibility 未反映資源
- recovery data loss
- dataset-specific runtime branch
- release artifact/manifest mismatch

eligibility matrix coverage は `1.00`、権限変更反映は p50 5秒、p95 30秒、p99 60秒、max 120秒を提案する。時間値は open_question であり、70セル workload の live 測定後に再承認する。

### performance

| endpoint | p50 | p95 | p99 | 状態 |
| --- | ---: | ---: | ---: | --- |
| chat | 10秒 | 30秒 | 60秒 | p95 30秒のみ MMRAG 初期値に近い。全体として inferred |
| search | 2秒 | 5秒 | 10秒 | inferred |
| ingest | 60秒 | 300秒 | 600秒 | inferred。文書サイズ profile の確定が必要 |

各 overall と `stage=<endpoint>` を独立評価し、100 sample、confidence 0.95 を要求する。

### reliability / recovery

| signal | 提案値 | 状態 |
| --- | ---: | --- |
| success rate | `>= 0.95` | inferred |
| timeout rate | `<= 0.02` | inferred |
| error rate | `<= 0.05` | inferred |
| backlog age p99 | `<= 300秒` | inferred |
| retry exhaustion | `<= 0` | inferred。発生時は promotion 不可 |
| MTTR | `<= 30分` | inferred |
| recovery without loss | `>= 1.00` | confirmed の no-loss 方針を数値化 |
| recovery scenario coverage | `>= 1.00` | confirmed。vector/LLM/OCR/queue を全て要求 |

chat/search/ingest の endpoint-stage と vector/LLM/OCR/queue の dependency slice を独立評価する。recovery は各 dependency 4 scenario 以上を提案する。

### unit cost

| unit | 提案上限 | 状態 |
| --- | ---: | --- |
| chat request | USD 0.020 | open_question |
| search request | USD 0.005 | open_question |
| ingest document | USD 0.100 | open_question |

費用値は approved price catalog、完全な token/storage/worker/egress usage、実 billing 照合がまだ無いため、予算 guardrail の初案にすぎない。承認後の最初の実 workload で再評価する。

## 5. non-regression 案

閾値を満たしていても baseline から大きく悪化した candidate を通さないため、主要品質、p95 latency、availability、unit cost に `maximumRegression` を提案した。

- recall / task: 5 percentage points
- faithfulness / citation / evidence retention: 3 percentage points
- false/unsupported rate: 1〜3 percentage points
- p95 latency: chat 5秒、search 1秒、ingest 60秒
- success/timeout/error: 1 percentage point
- unit cost: chat USD 0.002、search USD 0.001、ingest USD 0.020

`maximumRegression` を設定した signal は candidate observation に `baselineValue` がなければ fail する。

## 6. 承認前に回答が必要な open questions

1. `memorag-dev-on-call` を実際の alert owner としてよいか。
2. dev workload の concurrency `4`、case overall `100`、slice `20` は十分か。
3. tenant role slice を `chat_user` / `answer_editor` / `system_admin` とするか。
4. p95 30秒の chat と p95 5秒の search を dev promotion 上限としてよいか。
5. unit cost 上限の通貨を USD とし、上記3値を初期 ceiling としてよいか。
6. baseline 必須の non-regression 幅を上記案で承認するか。
7. runtime/workload/price と evidence version を、次段の CD 自動化で CloudFormation/benchmark artifact から解決する方針でよいか。

## 7. 承認時に行う変更

ユーザー承認後に、次を別 commit で行う。

1. `approvedBy` と全 gate の `thresholdApprovedBy` に承認者を記録する。
2. `approvedAt` と全 gate の `thresholdApprovedAt` に承認時刻を記録する。
3. draft version を正式 version へ更新する。
4. placeholder を CD の version resolution 入力へ置換する。
5. policy snapshot と observations bundle の生成・upload・URI export を CD に実装する。
6. representative observations で promotion decision が pass/fail のどちらかを、理由付きで記録する。pass を事前に保証しない。

## 8. 承認判断

この案をそのまま承認する場合は、少なくとも以下を明示する。

> `memorag-dev-rag-quality` の `2026-07-16.draft-1` に記載された slice、閾値、sample/confidence、non-regression、response action を dev 初期 policy として承認する。未取得の live evidence を合格扱いせず、実 workload/billing 後に再評価する。

一部変更する場合は、signal または表の項目と希望値を指定する。
