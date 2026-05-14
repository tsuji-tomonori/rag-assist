# Phase I Gap: benchmark suites and runner

- ファイル: `docs/spec/gap-phase-i.md`
- 種別: `SPEC_GAP`
- 作成日: 2026-05-14
- 状態: Draft
- 対象 task: `I-pre-gap`
- 後続 task: `I-benchmark-suites-and-runner`

## Scope

Phase I は、仕様 9「評価・ベンチマーク」、9A「チャット・RAG・非同期エージェントのベンチマーク設計」、9B「ナレッジ品質・文書解析ベンチマーク」、9C「ベンチマーク運用・外部データセット・runner 実行基盤」を対象にする。

この gap 調査ではコード変更を行わず、現行 `benchmark/`、benchmark API route、benchmark seed 認可、CodeBuild runner、GitHub Actions 起動、既存 benchmark 関連 task / report の差分、踏襲すべき既存挙動、後続実装の scope / scope-out を整理する。

## Input Inventory

| ID | 種別 | 対象 | 確度 | 用途 |
| --- | --- | --- | --- | --- |
| I-SPEC-9 | 仕様 | `docs/spec/2026-chapter-spec.md` 章 9 | confirmed | BenchmarkSuite / BenchmarkCase / BenchmarkRun、画面、認可、promotion gate の要求。 |
| I-SPEC-9A | 仕様 | `docs/spec/2026-chapter-spec.md` 章 9A | confirmed | useCase、pipeline、benchmark_grounded_short、評価指標、成果物の要求。 |
| I-SPEC-9B | 仕様 | `docs/spec/2026-chapter-spec.md` 章 9B | confirmed | 品質状態、文書解析、OCR / 表 / 図 / citation の品質 benchmark 要求。 |
| I-SPEC-9C | 仕様 | `docs/spec/2026-chapter-spec.md` 章 9C | confirmed | runner 認証、corpus seed lifecycle、外部 dataset 変換、S3 Vectors metadata budget、GitHub Actions 起動の要求。 |
| I-MAP | 章対応表 | `docs/spec/CHAPTER_TO_REQ_MAP.md` 9 / 9A / 9B / 9C 行 | confirmed | 章別仕様と既存 REQ / 実装の対応状態。 |
| I-IMPL-BENCH | 実装 | `benchmark/` | confirmed | agent / search / conversation runner、dataset converter、metrics、sample corpus。 |
| I-IMPL-API | 実装 | `apps/api/src/routes/benchmark-routes.ts`, `apps/api/src/routes/benchmark-seed.ts` | confirmed | `/benchmark/query`, `/benchmark/search`, `/benchmark-suites`, `/benchmark-runs`, seed isolation。 |
| I-IMPL-SECURITY | 実装 | `apps/api/src/security/access-control-policy.test.ts`, `apps/api/src/authorization.ts` | confirmed | benchmark route permission と BENCHMARK_RUNNER / OPERATOR 境界。 |
| I-IMPL-INFRA | 実装 | `infra/`, `.github/workflows/memorag-benchmark-run.yml`, `Taskfile.yml` | confirmed | CodeBuild runner、Step Functions、S3 artifacts、GitHub Actions manual run、local benchmark tasks。 |
| I-REPORTS | 作業記録 | `reports/working/*benchmark*`, `tasks/done/*benchmark*`, `reports/working/20260512-0911-chatrag-refusal-bench-fix.md`, `reports/working/20260511-2327-s3-vectors-metadata-budget.md`, `reports/working/20260510-2240-ingest-lambda-timeout-limit.md`, `reports/working/20260511-1937-adjust-heavy-api-lambda-quota.md` | confirmed | 踏襲すべき既存挙動、制約、未実施 benchmark、quota / timeout 方針。 |

## Spec Requirements Summary

| 章 / AC | 要求 summary | 現行分類 |
| --- | --- | --- |
| 9 / AC-BENCH-001..008 | suite / case / run、前回比、失敗ケース、成果物 download、対象 folder readOnly、本番反映権限。 | partially covered |
| 9A / AC-BENCH-USECASE-* | multiturn、図面、社内 QA、500P 超 PDF、async agent、baseline / candidate diff、case-level metrics。 | partially covered |
| 9A | `benchmark_grounded_short` は通常回答 policy と分け、dataset 固有 row id ではなく benchmark metadata で切り替える。 | partially covered |
| 9B / AC-KQ-BENCH-* | verified / unverified / stale / expired / superseded、OCR、表、図、citation、品質 gate、改善 task 化。 | missing |
| 9C / AC-BENCH-OPS-* | runner secret、fail-fast auth、suite ごとの corpus seed、skip manifest、metadata budget、GitHub Actions 起動。 | partially covered |

## confirmed

| ID | 現行で確認できた事実 | 根拠 | 仕様との差分 |
| --- | --- | --- | --- |
| I-CONF-001 | `benchmark/` は agent runner、search runner、conversation runner、dataset converter、metrics、report 出力を持つ。 | `benchmark/run.ts`, `benchmark/search-run.ts`, `benchmark/conversation-run.ts`, `benchmark/package.json` | 9 / 9A の runner foundation は存在する。 |
| I-CONF-002 | dataset row は `expectedContains`、`expectedRegex`、`expectedFiles`、`expectedPages`、`answerable`、`expectedResponseType`、fact slots、drawing extraction expectations を扱える。 | `benchmark/run.ts`, `benchmark/metrics/quality.ts`, `benchmark/metrics/conversation.ts` | case-level 評価の基礎はある。 |
| I-CONF-003 | ChatRAG / MTRAG は conversation runner に接続され、前 turn citation を history に引き継ぐ。 | `benchmark/conversation-run.ts`, `benchmark/datasets/conversation/*.jsonl` | multiturn 評価の基礎はある。 |
| I-CONF-004 | `/benchmark/query` と `/benchmark/search` は `benchmark:query` を要求し、`source=benchmark-runner`、`docType=benchmark-corpus`、`benchmarkSuiteId` で検索対象を benchmark corpus に絞る。 | `apps/api/src/routes/benchmark-routes.ts` | corpus isolation は踏襲対象。 |
| I-CONF-005 | `BENCHMARK_RUNNER` は `benchmark:query` と `benchmark:seed_corpus` のみを持ち、`BENCHMARK_OPERATOR` は `benchmark:read` と `benchmark:run` のみを持つ。 | `apps/api/src/authorization.ts`, `apps/api/src/authorization.test.ts` | runner / operator の最小権限境界は存在する。 |
| I-CONF-006 | benchmark seed は allowlist suite、`benchmarkSeed=true`、`source=benchmark-runner`、`docType=benchmark-corpus`、`aclGroups=["BENCHMARK_RUNNER"]`、safe file name、metadata key allowlist を要求する。 | `apps/api/src/routes/benchmark-seed.ts` | 通常チャット検索対象への混入を防ぐ基礎はある。 |
| I-CONF-007 | CodeBuild suite manifest は agent / search / conversation runner と local / prepare / codebuild-input dataset source を選べる。 | `benchmark/suites.codebuild.json`, `benchmark/codebuild-suite.ts` | suite 単位 runner selection は存在する。 |
| I-CONF-008 | CodeBuild runner は Secrets Manager 由来の runner credential を `resolve-benchmark-auth-token.mjs` で解決し、解決失敗時は build を継続しない。 | `infra/scripts/resolve-benchmark-auth-token.mjs`, `infra/lib/memorag-mvp-stack.ts`, `infra/test/memorag-mvp-stack.test.ts` | 9C.2 の fail-fast auth は実装済み。 |
| I-CONF-009 | CodeBuild project は 180 分、Step Functions は 9 時間 timeout で、runner artifacts を S3 に保存し、metrics を DynamoDB run に反映する。 | `infra/lib/memorag-mvp-stack.ts`, `infra/scripts/update-benchmark-run-metrics.mjs`, `infra/test/update-benchmark-run-metrics.test.ts` | 運用 runner と artifact 保存はある。 |
| I-CONF-010 | GitHub Actions から suite / mode / model / embedding / topK / timeout を入力し、API 経由で benchmark run を開始し、artifact download metadata を扱う workflow がある。 | `.github/workflows/memorag-benchmark-run.yml` | 9C.6 は部分充足。 |
| I-CONF-011 | S3 Vectors filterable metadata は 2048 bytes budget を意識し、benchmark corpus metadata は 1500 bytes まで compact 化する。 | `benchmark/corpus.ts`, `reports/working/20260511-2327-s3-vectors-metadata-budget.md` | 9C.5 は踏襲対象。 |
| I-CONF-012 | `DocumentIngestRunWorkerFunction` は 15 分 timeout / 3008MB、`HeavyApiFunction` も 3008MB に調整済みで、30 分 Lambda timeout / 4096MB quota 前提へ戻さない方針がある。 | `reports/working/20260510-2240-ingest-lambda-timeout-limit.md`, `reports/working/20260511-1937-adjust-heavy-api-lambda-quota.md`, `infra/test/memorag-mvp-stack.test.ts` | 後続 I で長時間化や memory 増を安易に戻さない。 |

## partially covered

| ID | 部分充足している仕様 | 現状 | 残差分 |
| --- | --- | --- | --- |
| I-PART-001 | BenchmarkSuite / BenchmarkRun 管理 | `/benchmark-suites`, `/benchmark-runs`, DynamoDB run store、status、metrics、artifact URL がある。 | 仕様 9 の `BenchmarkCase` CRUD、suite create/update、case create/update、promotion gate entity はない。 |
| I-PART-002 | run 詳細と成果物 | run list/get/cancel/download/logs API と S3 artifacts がある。 | 前回比、失敗ケース drilldown、非技術者向け合否理由、UI 上の promotion 判定は不足。 |
| I-PART-003 | 認可 | route-level permission と runner seed scope は静的 test で守られている。 | 仕様名 `benchmark:artifact:download` と現行 `benchmark:download` がずれている。run cancel は実行者または管理者限定ではなく permission のみ。 |
| I-PART-004 | useCase benchmark | `mtrag-v1`, `chatrag-bench-v1`, `mmrag-docqa-v1`, `jp-public-pdf-qa-v1`, `mlit-pdf-figure-table-rag-seed-v1`, `architecture-drawing-qarag-v0.1` がある。 | unified `BenchmarkUseCase` tag / `BenchmarkCase` data contract と baseline / candidate diff は十分ではない。 |
| I-PART-005 | `benchmark_grounded_short` | 仕様 4A / 9A で方針化され、runner は benchmark metadata / suite filter を渡す。 | runtime policy と dataset metadata による明示切替の完全な data contract は不足。通常回答との分離を後続で固定する必要がある。 |
| I-PART-006 | 外部 dataset prepare | Allganize JA、MTRAG、ChatRAG Bench、MMLongBench DocQA、jp-public PDF、MLIT / 図面系 converter がある。 | `BenchmarkDatasetPrepareRun` と skip manifest の永続 run model はない。license / version / conversionVersion の標準 artifact 化も不足。 |
| I-PART-007 | skip / fatal handling | unextractable corpus は `skipped_unextractable` として seed result に残せる。CodeBuild input missing や auth failure は fatal。 | `skipped_network_unavailable`、`skipped_license_or_terms`、skip reason 集計、古い corpus 混入の fatal manifest は体系化されていない。 |
| I-PART-008 | metrics | answer correctness、abstention、retrieval recall、Mrr、citation / page / region / support / drawing extraction / cost latency の一部がある。 | 9A の promotion gate、unsupported sentence rate / repair success / computed fact / claim conflict / final context contamination を一貫して run metrics に出す体系は不足。 |

## missing

| ID | 未実装 / 未整備 | 根拠 | 後続対応 |
| --- | --- | --- | --- |
| I-GAP-001 | `BenchmarkCase` / `BenchmarkSuite` の CRUD と canonical data contract。 | 現行 suite は service / manifest / static dataset 中心。 | 後続では runner 既存 JSONL を壊さず、canonical schema との mapping から始める。 |
| I-GAP-002 | `PromotionGate` と本番反映 API / UI。 | `benchmark:promote_result` は仕様にあるが、現行 permission / route にない。 | I では gate 判定 artifact を優先し、本番設定反映は別 task へ分ける。 |
| I-GAP-003 | baseline config / candidate config diff の永続保存と比較 UI。 | run request は model / topK / thresholds を持つが、baseline-candidate pair はない。 | まず artifact summary に config snapshot / diff を保存する。 |
| I-GAP-004 | 品質 4 軸 benchmark suite。 | 9B の verified / unverified / stale / expired / superseded / OCR / 表 / 図の統合 suite は確認できない。 | Phase C/E の quality / extraction metadata と接続し、dataset 固有分岐を避ける。 |
| I-GAP-005 | 非同期エージェント benchmark。 | 4C / async agent 実装自体が missing。benchmark runner に `async_agent_task` 用 raw file mount / skill profile 評価はない。 | Phase G / 4C 実装後の scope。I では schema と scope-out を明記する。 |
| I-GAP-006 | 失敗ケースから改善 task への遷移。 | benchmark report は出るが、検索改善 / chunker / prompt / skill / 文書検証 task 化 API はない。 | H / C / E / F / G と接続する後続 task として分割する。 |
| I-GAP-007 | runner の corpus seed manifest / skip manifest / dataset prepare run の標準 artifact。 | seed result は summary に入るが、9C の `BenchmarkDatasetPrepareRun` entity ではない。 | `I-benchmark-suites-and-runner` で artifact contract を定義する。 |
| I-GAP-008 | GitHub Actions summary の structured result と機微情報 mask の検証。 | workflow は token mask と artifact download を持つが、summary の検証や logs artifact の扱いは限定的。 | Workflow 入力・timeout・mask・summary の docs / tests を追加する。 |

## divergent

| ID | 乖離 | 内容 | 扱い |
| --- | --- | --- | --- |
| I-DIV-001 | permission 名 | 仕様は `benchmark:artifact:download`、現行は `benchmark:download`。operationKey は `benchmark.artifact.download`。 | 後続で permission alias / rename 方針を Phase B の権限モデルと合わせる。即時 rename は既存 role 互換に注意する。 |
| I-DIV-002 | run status 名 | 仕様 9 は `completed`、現行 schema は `succeeded`。 | 既存 API 互換を壊さず、docs / UI 表示で mapping するか schema migration を別 task 化する。 |
| I-DIV-003 | runner API 経路 | `benchmark/api-client.ts` は oRPC `/rpc` を使う一方、9C は `POST /benchmark-runs` など REST 起動を想定する。 | 現行 runner query は oRPC、run orchestration は REST/API route として併存。J1 の contract drift 方針と合わせる。 |
| I-DIV-004 | Product benchmark vs local benchmark | 仕様は品質判断画面を中心にするが、現行は CLI / CodeBuild / reports が中心。 | I では runner / artifact contract を先に固め、管理画面の判断 UI は J3 / Web task と連携する。 |

## Preserve Existing Behavior

| ID | 踏襲すべき既存挙動 | 根拠 | I での扱い |
| --- | --- | --- | --- |
| I-PRESERVE-001 | ChatRAG refusal benchmark の期待語句・拒否期待値を regression として維持する。 | `reports/working/20260512-0911-chatrag-refusal-bench-fix.md`, `benchmark/datasets/conversation/chatrag-bench-v1.jsonl` | 後続で answer policy を変える場合も expected phrase / refusal calibration を消さない。 |
| I-PRESERVE-002 | benchmark expected phrase、QA sample 固有値、dataset row id を RAG 実装へ hard-code しない。 | `reports/working/20260510-1246-multiturn-p1-p2.md`, `reports/working/20260512-0911-chatrag-refusal-bench-fix.md` | dataset 固有条件は runner / dataset metadata / evaluator profile に閉じる。 |
| I-PRESERVE-003 | benchmark corpus は `source=benchmark-runner`、`docType=benchmark-corpus`、`benchmarkSuiteId`、`aclGroups=["BENCHMARK_RUNNER"]` で通常検索対象から隔離する。 | `benchmark/corpus.ts`, `benchmark-seed.ts`, `benchmark-routes.ts` | 新 suite / seed lifecycle でも通常 chat corpus に混ぜない。 |
| I-PRESERVE-004 | BENCHMARK_RUNNER は通常ユーザー文書・会話へ横断アクセスできない。 | `authorization.ts`, `access-control-policy.test.ts`, `document-routes.ts` | runner 権限追加時は static policy と contract test を更新する。 |
| I-PRESERVE-005 | S3 Vectors filterable metadata は 2048 bytes budget を守り、rich drawing metadata / chunk 本文 / OCR 全文 / debug trace を filterable metadata に入れない。 | `benchmark/corpus.ts`, `reports/working/20260511-2327-s3-vectors-metadata-budget.md`, 9C.5 | 9B / 図面 benchmark 拡張時も artifact 参照 ID に分離する。 |
| I-PRESERVE-006 | Document ingest worker は Lambda 15 分 / 3008MB 制約、Heavy API は 3008MB を前提にする。 | `reports/working/20260510-2240-ingest-lambda-timeout-limit.md`, `reports/working/20260511-1937-adjust-heavy-api-lambda-quota.md` | 長大 PDF / heavy benchmark は Lambda timeout 延長ではなく CodeBuild / async runner 側で扱う。 |
| I-PRESERVE-007 | API / runner token、password、secret、signed URL は logs / artifact / debug trace に出さない。 | `.github/workflows/memorag-benchmark-run.yml`, `resolve-benchmark-auth-token.mjs`, 9C.2 | Workflow / CodeBuild 変更時も mask と artifact sanitization を維持する。 |

## I-benchmark-suites-and-runner Scope

後続 `I-benchmark-suites-and-runner` の最小 scope は次とする。

1. 現行 JSONL / suite manifest を壊さず、9 / 9A / 9C の `BenchmarkSuite`、`BenchmarkCase`、`BenchmarkRun`、`BenchmarkTargetConfig`、`BenchmarkDatasetPrepareRun` に対応する mapping docs / schema を定義する。
2. existing runner の agent / search / conversation を維持し、suite ごとの `useCase`、runner、corpus、dataset source、evaluator profile を明示する。
3. `benchmark_grounded_short` は dataset row id ではなく benchmark metadata / suite profile で切り替える方針を固定し、通常回答 policy と分離する。
4. ChatRAG / MTRAG の expected phrases、refusal expected values、history / previous citation regression を維持する。
5. baseline / candidate config、case-level result、failure reason、retrieval / citation / latency / cost、seed manifest、skip manifest を artifact contract として整理する。
6. CodeBuild runner の auth fail-fast、token mask、suite input validation、timeout、artifact upload、metrics update を維持し、必要な不足だけを補う。
7. S3 Vectors metadata budget と Lambda quota / timeout 制約を後続 task の受け入れ条件へ入れる。
8. route / permission を変更する場合は `apps/api/src/security/access-control-policy.test.ts`、API contract、OpenAPI docs を同時更新する。
9. 品質 4 軸 benchmark は Phase C/E の metadata を使う最小 sample から始め、dataset 固有分岐を実装へ入れない。

## I-benchmark-suites-and-runner Scope-out

| ID | scope-out | 理由 / 委譲先 |
| --- | --- | --- |
| I-OUT-001 | benchmark 管理画面の全面刷新。 | runner / artifact contract を先に固める。UI は J3 / Web task と連携する。 |
| I-OUT-002 | async agent benchmark の本実装。 | 4C / Phase G の非同期エージェント基盤が先行依存。I では schema 予約に留める。 |
| I-OUT-003 | 本番設定への promotion API 実装。 | risk が大きい。まず promotion gate 判定 artifact と権限 gap を記録する。 |
| I-OUT-004 | 全外部 dataset の実 download / full benchmark 再実行。 | network、license、AWS cost、credential に依存する。converter と sample / manifest 検証を優先する。 |
| I-OUT-005 | Lambda timeout / memory quota の再引き上げ。 | 既存 quota 調整方針に反する。重い処理は CodeBuild / async runner に寄せる。 |
| I-OUT-006 | 全 RAG 指標の LLM-as-a-judge 本番 gate 化。 | 人手確認・cost・judge 安定性の設計が必要。自動評価だけに依存しない仕様 9A.2 を維持する。 |

## Open Questions

| ID | 種別 | 内容 | 次の判断 |
| --- | --- | --- | --- |
| I-OQ-001 | open_question | `benchmark:download` を `benchmark:artifact:download` へ rename / alias するか。 | Phase B の permission alias 方針と既存 role 互換で決める。 |
| I-OQ-002 | open_question | run status `succeeded` と仕様 `completed` のどちらを canonical とするか。 | API 互換と UI 表示を見て migration 要否を決める。 |
| I-OQ-003 | open_question | `BenchmarkCase` CRUD を product API として先に作るか、repository-managed dataset + manifest を canonical にするか。 | 管理 UI の必要性と dataset review workflow で決める。 |
| I-OQ-004 | open_question | promotion gate は benchmark run 内の read-only 判定から始めるか、実際の設定反映 workflow まで含めるか。 | 本番反映リスクと承認フロー設計で決める。 |
| I-OQ-005 | open_question | 品質 4 軸 benchmark の最小 corpus を synthetic sample と既存 public PDF のどちらで始めるか。 | dataset 固有値を実装へ漏らさないこと、license、再現性で決める。 |

## Targeted Validation For I

| 検証 | 目的 |
| --- | --- |
| `npm run typecheck -w @memorag-mvp/benchmark` | benchmark runner / converter / metrics の型整合性。 |
| `npm test -w @memorag-mvp/benchmark` | runner / metrics / dataset converter の regression。 |
| `npm run typecheck -w @memorag-mvp/api` | benchmark API / schema / permission 変更時の型整合性。 |
| `npm test -w @memorag-mvp/api -- src/security/access-control-policy.test.ts src/contract/api-contract.test.ts` | route-level permission、BENCHMARK_RUNNER / OPERATOR 境界、OpenAPI contract。 |
| `npm run test -w @memorag-mvp/infra -- memorag-mvp-stack.test.ts` | CodeBuild runner、timeout、heavy API / ingest Lambda quota、artifact bucket、state machine。 |
| `git diff --check` | whitespace / conflict marker 確認。 |
| `python3 scripts/validate_spec_recovery.py docs/spec-recovery` | spec-recovery 更新の構造確認。 |
