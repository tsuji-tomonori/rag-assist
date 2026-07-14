# MemoRAG MVP 監視・検証ランブック

- ファイル: `docs/4_運用_OPS/21_監視_MONITORING/OPS_MONITORING_001.md`
- 種別: `OPS_MONITORING`
- 状態: Draft
- 最終更新: 2026-07-14

## 目的

現行実装で利用できる health、ログ、benchmark、生成物 freshness と、本 PR で追加した RAG 品質 control loop を使い、障害・品質劣化・安全性違反の初動確認を再現可能にする。

本番 RAG の品質・安全性・性能・信頼性・コスト signal を、承認済み profile/version/slice 単位で監視し、欠損や critical 違反を安全側の action へ接続できるようにする。stakeholder 未承認の threshold や未取得の live evidence を合格値として補わない。

## 現行の観測点

| 対象 | 現行の観測点 | 確認先 |
| --- | --- | --- |
| API 生存性 | health endpoint の HTTP status | `GET /health`、API Gateway/Lambda logs |
| chat / ingestion | request、error、処理段階の application log | CloudWatch Logs、対象 Lambda log group |
| RAG 品質 control loop | source sample、observation、alert、safe action、runtime safety state | docs bucket の `quality-control/` prefix、`MemoRAG/QualityControl` metrics |
| debug trace | 認可・redaction 済み trace API と保存 artifact | `DES_API_001`、`DES_DATA_001` |
| benchmark | run status、report、release audit、runner log | benchmark API、Step Functions、CodeBuild logs |
| deploy | promotion 判定、workflow run、CloudFormation event、smoke result | GitHub Actions、CloudFormation、health endpoint |
| API/docs drift | 自動生成物の freshness check | `npm run docs:openapi:check` |
| Web/infra docs drift | inventory の freshness check | `npm run docs:web-inventory:check`、`npm run docs:infra-inventory:check` |

認証情報、source 本文、chunk 本文、prompt、raw model response を一般ログへ出力しない。debug trace と品質 artifact は認可・tenant partition・sanitization の境界を維持する。

## RAG 品質・安全監視

### 前提となる承認済み policy

運用開始前に docs bucket の `quality-control/policies/active.json` へ、`RagQualityPolicyProfile` contract に適合する承認済み policy を配置する。policy は `profileId`、`version`、dataset/model/index/prompt/pipeline/parser/chunker の evidence version、workload/runtime/price catalog version、corpus/ACL/concurrency/document-size/dependency-latency dimension、必須 case slice、全必須 signal の threshold、承認者、承認時刻、許可済み safe action を明示する。stakeholder 未承認の threshold を既定値で補わない。`maximumRegression` を使う gate は baseline を必須とする。改善を宣言する変更だけ、承認済み最小改善幅を `changeControl.improvementCriteria` に指定し、neutral 変更に改善条件を混ぜない。

active policy が無い、壊れている、または必須 threshold が欠けている場合は正常扱いにしない。runtime producer は本文処理を妨げず警告を残し、5分間隔の `RagQualityMonitorFunction` は失敗するため、`RagQualityMonitorLambdaErrorAlarm` または `RagQualityControlLoopFailureAlarm` を一次検知に使う。

### 観測 source と保存先

| source | production producer | 主な signal | 保存先 |
| --- | --- | --- | --- |
| ingest manifest | document ingest pipeline | 抽出範囲、silent truncation、locator、chunk structure、manifest integrity、ingest latency | `quality-control/source-samples/` |
| sanitized debug trace | chat orchestration | evidence retention、citation locator、chat latency、成功/失敗 | `quality-control/source-samples/` |
| search runtime | hybrid search | search latency、成功/失敗 | `quality-control/source-samples/` |
| worker outcome | chat/document ingest worker | backlog age、latency、成功/失敗 | `quality-control/source-samples/` |
| benchmark summary | completed benchmark run | ground-truth 品質、安全性、性能、versioned price に基づく cost | `quality-control/source-samples/` |
| release audit | benchmark CodeBuild post-build | product runtime の dataset expected-field 分岐、summary/seed/prepare manifest 整合性 | benchmark run の `release-audit.json` と `quality-control/source-samples/` |
| aggregated observation | 5分 scheduled monitor | 全必須 signal × policy-required slice | `quality-control/observations/` |

source sample と observation は signal catalog、active profile/version、workload/runtime/price catalog version、slice、artifact/trace identity、policy/index/model/prompt/pipeline/parser/chunker version の取得状況を保持する。tenant slice は raw tenant ID を保存せず pseudonymous hash を使う。既知 role 以外も hash 化する。

ground truth、price、probe、復旧相関などが測定できない signal は推定値や 0 で補わず、`available=false`、`value=null`、`confidence=null` と unavailable reason を記録する。source が1件も無い必須 signal も aggregate 時に observation 自体を生成し、`no_measured_source_in_window` とする。

benchmark metric 更新は、versioned summary の case artifact から claim-level faithfulness/unsupported severity、citation precision/completeness/locator、false answer/refusal、business task outcome/handoff、endpoint/stage p50/p95/p99 を再計算する。case は question type、tenant-role、OCR、language、multi-evidence、answerability、severity の slice を全て持つ。summary の任意 aggregate field だけでこれらを合格値にしない。eligibility は10 trigger×7 path の70プローブと unreflected resource、recovery は vector/LLM/OCR/queue、endpoint-stage は chat/search/ingest の完全な evidence を要求する。eligibility p50/p95/p99/max、timeout/error/backlog/retry exhaustion、MTTR/no-loss を算出する。必要な組、workload dimension、versioned workload/price artifact が無い、version が一致しない、usage が不完全、または価格 rate が欠ける場合は値を生成しない。

CodeBuild へ workload/price evidence を渡す場合は、benchmark bucket 内の object key を CDK context `ragWorkloadEvidenceS3Key` と `ragPriceCatalogS3Key` へ明示する。あわせて `ragRuntimeProfileVersion`、`ragWorkloadProfileVersion`、`ragPriceCatalogVersion`、`ragIndexVersion`、`ragPromptVersion`、`ragPipelineVersion`、`ragParserVersion`、`ragChunkerVersion` を承認済み artifact の値へ固定する。これらに未承認の既定値は設けない。

### 公開・deploy gate

`npm run rag:release:audit -- --summary <summary.json> --source-root apps/api/src --source-root apps/web/src --output <release-audit.json>` は dataset 固有 expected field / identity branch と benchmark artifact/manifest 不整合を決定的に検査する。違反は zero-tolerance signal として記録する。CodeBuild は `--report-only` で evidence を必ず保存し、最終的な公開可否は promotion profile の論理積で決める。

手動の candidate promotion 判定は `MemoRAG CI` の `run-rag-promotion-gate=true` と repository-relative policy/observations path を明示して実行する。通常の PR は stakeholder threshold を仮作成せず、契約・runner の test のみ行う。

`Deploy MemoRAG MVP` は build/synth/deploy より前に `RAG_QUALITY_POLICY_S3_URI` と `RAG_QUALITY_OBSERVATIONS_S3_URI`（GitHub Environment variables、または手動 dispatch input）を取得し、`npm run rag:promotion:check` を実行する。URI 欠損、policy 未承認、version/profile 不一致、必須 signal/slice 欠損、source provenance 不足、release audit 不在、または threshold/non-regression/zero-tolerance 違反では deploy を開始しない。

### 判定、alert、safe action

`RagQualityMonitorFunction` は5分 window の最新 observation を全必須 gate と照合する。欠損、unavailable、profile mismatch、sample/confidence 不足、baseline 欠損、threshold/non-regression/improvement 違反を pass にしない。unauthorized exposure、injection success、secret exposure、silent truncation、critical/high unsupported claim、citation 必須 claim 欠損、critical/high task failure、unreflected eligibility resource、recovery data loss、dataset-specific branch、artifact mismatch の zero-tolerance signal は1件でも critical とする。

alert は `quality-control/alerts/`、実行 action は `quality-control/actions/`、現在の interlock 状態は `quality-control/runtime/safety-state.json` に保存する。allowed action は少なくとも promotion freeze、candidate quarantine、limited/refuse answer を含み、last-known-safe runtime を設定する場合は rollback も含める。リストが空、重複、または必須 action 欠損なら policy invalid とし、code-owned の availability-reducing action を用いて安全 action 全体の無効化を防ぐ。promotion freeze、candidate/document quarantine、last-known-safe rollback、limited answer、refuse answer の範囲を超えない。`RAG_MONITORING_REQUIRED=1` の runtime は安全状態が無い、対象 runtime が quarantine 済み、または response mode が normal でない場合に RAG 実行を拒否する。

### 初動確認

1. `MemoRAG/QualityControl` の `ControlLoopHeartbeat`、`ControlLoopFailure`、`CriticalAlertCount`、`ObservationCount`、`UnavailableObservationCount` を確認する。
2. `UnavailableObservationCount` が増えた場合は observation の `source.unavailableReasons` と `source.missingVersionDimensions` を確認する。
3. critical alert では alert の profile/version/slice/trace ID と active policy を突合する。
4. safe action 後は `quality-control/runtime/safety-state.json` を確認し、原因を解消して承認済み profile を再評価するまで quarantine や limited/refuse state を手動で正常化しない。
5. `RagQualityMonitorLambdaErrorAlarm` では active policy の存在・JSON contract・docs bucket access を先に確認する。

## 監視対象

| AWS service | MemoRAG MVP の必要リソース | 用途 | 継続判断 |
| --- | --- | --- | --- |
| AWS Key Management Service | `BenchmarkProjectKey` | CodeBuild project artifact 暗号化設定用の customer managed key | benchmark runner を管理画面から実行する場合は必要 |
| AWS Secrets Manager | `BenchmarkRunnerAuthSecret` | `BENCHMARK_RUNNER` service user credential の保存 | production API を叩く benchmark runner では必要 |
| AWS Key Management Service | AWS managed key `aws/secretsmanager` | Secrets Manager secret の保存時暗号化 | Secrets Manager を使う限り AWS 側で利用される |

`BenchmarkProjectKey` は customer managed KMS key として CDK stack が作成するため、CodeBuild 実行履歴がない場合でも key storage 由来の少額コスト候補になる。Cost Explorer または Cost and Usage Report では、usage type が key storage 由来か request 由来かを確認する。

AWS KMS の AWS managed key は key storage 自体の課金対象外だが、AWS managed key への API request は利用量として請求されうる。Secrets Manager は secret 保存数と API call に基づく課金対象であり、secret を維持する限り少額 anomaly の候補になる。

## Anomaly 突合メモ

2026-05-02 の Cost Anomaly Detection では、Member Account `713881826246 (GenU)` に対して AWS Key Management Service の Total Impact `$0.02` と AWS Secrets Manager の Total Impact `$0.01` が検知された。

この金額が MemoRAG MVP deploy 後に発生した場合、第一候補は benchmark runner 用の `BenchmarkProjectKey`、`BenchmarkRunnerAuthSecret`、および Secrets Manager の AWS managed key 利用である。

## 初動確認

1. Cost Explorer または Cost and Usage Report で account、region、service、usage type を確認する。
2. CloudFormation stack に `BenchmarkProjectKey` と `BenchmarkRunnerAuthSecret` が存在するか確認する。
3. `benchmarkRunnerAuthSecretId` context で外部 secret を参照している場合、外部 secret の所有者と利用目的を確認する。
4. CodeBuild benchmark runner の実行履歴と Secrets Manager `GetSecretValue` の時刻を突合する。
5. 性能テスト画面または `GET /benchmark-runs/{runId}/logs` から CodeBuild ログ本文を `.txt` として取得し、runner setup、dataset 準備、API 呼び出し、artifact upload のどこで失敗したかを確認する。
6. 予算超過や想定外 region での発生があれば、benchmark runner の起動を止めて stack drift と未使用 stack を確認する。

## 削除・抑制できる条件

| リソース | 削除・抑制条件 | 注意点 |
| --- | --- | --- |
| `BenchmarkProjectKey` | Step Functions + CodeBuild benchmark runner を使わない | CodeBuild project artifact 暗号化設定と cdk-nag 要件を再評価する |
| `BenchmarkRunnerAuthSecret` | production API を叩く runner を使わない、または外部管理 secret へ移行する | 外部管理 secret を使う場合も Secrets Manager の保存・API call コストは残る |
| AWS managed key `aws/secretsmanager` | Secrets Manager secret を全廃する | AWS managed key 自体の保存は管理対象外だが、関連 API request は請求表示に出る可能性がある |

## ローカル／CI 検証

リポジトリ定義を正とし、実行前に `Taskfile.yml` または `package.json` の解決コマンドを確認する。

| 目的 | コマンド |
| --- | --- |
| docs 構成と自動生成物 | `python3 scripts/validate_docs.py` |
| OpenAPI freshness | `npm run docs:openapi:check` |
| API コード対応文書の再生成／freshness | `npm run docs:api-code` / `npm run docs:api-code:check` |
| Web inventory freshness | `npm run docs:web-inventory:check` |
| infra inventory freshness | `npm run docs:infra-inventory:check` |
| hidden Unicode | `npm run docs:hidden-unicode:check` |
| production runtime の dataset 固有分岐 | `npm run rag:release:source-audit` |

変更範囲に見合う lint、typecheck、test、build、smoke は `Taskfile.yml` と package scripts から追加選択する。未実施の確認は運用記録や PR で実施済みとしない。

## 運用検証状況

repository-local の実装・単体／統合テストと infrastructure 定義は確認対象に含む。一方、live AWS 上の backfill convergence、通知、drift、rollback、chaos、承認済み dataset・threshold・workload・price・billing evidence はこの文書だけでは完了扱いにしない。これらは `tasks/todo/20260714-0104-full-requirements-operational-acceptance.md` で追跡する。

## 受け入れ条件

- AC-OPS-MON-001: Cost anomaly で KMS または Secrets Manager が検知された場合、上記の必要リソース表で MemoRAG MVP の既知リソースか判断できること。
- AC-OPS-MON-002: benchmark runner を使わない運用では、削除・抑制条件に従って関連リソースの停止候補を説明できること。
- AC-OPS-MON-003: benchmark runner の失敗時に、CodeBuild ログ本文を API または画面から取得して一次調査できること。
- AC-OPS-MON-004: active policy と全必須 signal observation を profile/version/slice 単位で突合できること。
- AC-OPS-MON-005: 測定不能な必須 signal を unavailable reason 付きで識別できること。
- AC-OPS-MON-006: critical alert から trace と実行済み safe action と runtime safety state を追跡できること。
- AC-OPS-MON-007: versioned case/workload/price evidence が無い metric を推定値で補わず、promotion gate で unavailable として拒否できること。
- AC-OPS-MON-008: deploy が承認済み policy と完全な observations の promotion pass より前に build、synth、deploy を開始しないこと。
- AC-OPS-MON-009: release audit から dataset-specific runtime branch と artifact/manifest mismatch の finding、digest、zero-tolerance count を再現できること。
- AC-OPS-MON-010: policy と observation の dataset/model/index/prompt/pipeline/parser/chunker/runtime/workload/price が厳密に一致し、全必須 case/workload/endpoint/recovery slice の欠損を promotion 不可として識別できること。
- AC-OPS-MON-011: API、chat/ingestion、RAG 品質、benchmark、deploy、docs freshness の観測点を特定できること。
- AC-OPS-MON-012: 障害調査時に機微な本文や credential を一般ログへ追加せず、時刻と ID で相関できること。
- AC-OPS-MON-013: repository-local の検証と未取得の live operational evidence を区別できること。

## 参照

- AWS Key Management Service pricing: https://aws.amazon.com/kms/pricing/
- AWS Secrets Manager pricing: https://aws.amazon.com/secrets-manager/pricing/
