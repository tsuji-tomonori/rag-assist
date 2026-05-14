# Gap Phase D: 4B 名称変更影響調査

作成日: 2026-05-14

対象: Wave 3-pre / D-pre-gap

目的: 仕様 4B 章「チャット内オーケストレーション・ツール実行」の名称変更に対して、現行実装・OpenAPI・docs・benchmark の `Agent` / `agent` 由来名称を棚卸しし、後続 `D-rename-agent-to-chat-orchestration` の scope / scope-out を明確にする。

## 調査コマンド

confirmed:

- `rg --files | rg '(^|/)[^/]*[Aa]gent[^/]*$'`
- `rg -n "\\b[A-Za-z0-9_]*Agent[A-Za-z0-9_]*\\b" --glob '*.ts' --glob '*.tsx' --glob '*.mts' --glob '*.cts'`
- `rg --no-filename -o "\\b[A-Za-z_$][A-Za-z0-9_$]*Agent[A-Za-z0-9_$]*\\b" --glob '*.ts' --glob '*.tsx' --glob '*.mts' --glob '*.cts' apps packages benchmark infra | sort | uniq -c`
- `rg -n "4B|4C|ChatOrchestrationRun|AgentRun|ChatTool|tool invocation|チャット内オーケストレーション|非同期エージェント" docs/spec/2026-chapter-spec.md docs/spec/CHAPTER_TO_REQ_MAP.md docs/1_要求_REQ docs/3_設計_DES`
- `rg -n "AgentStateSchema|QaAgent|runQaAgent|createQaAgentGraph|AGENT_WORKFLOW_VERSION|agentWorkflowVersion|BenchmarkModeSchema|standard-agent-v1|smoke-agent-v1|datasets/agent|mode.*agent|runner.*agent" apps packages benchmark infra docs/generated/openapi docs/generated/infra-inventory docs/LOCAL_VERIFICATION.md`
- `rg -n "agent" apps packages benchmark infra docs --glob '!node_modules' --glob '!dist'`

open_question:

- `node_modules` がないため、`app.request("/openapi.json")` を実行して component schema 名を動的抽出する確認は未実施。checked-in の `apps/api/src/schemas.ts` と生成済み `docs/generated/openapi/*.md` を根拠に調査した。

## 仕様上の章境界

confirmed:

- `docs/spec/CHAPTER_TO_REQ_MAP.md` は 4B を「チャット内オーケストレーション・ツール実行」、対応要件を `FR-049`、現行実装を `apps/api/src/agent/`、状態を `divergent` としている。
- 同 map は 4C を「非同期エージェント実行」、対応要件を `FR-050`、状態を `missing` としている。
- `docs/spec/2026-chapter-spec.md` 4B.1 は、旧「エージェント機能 / AgentRun」を「チャット内オーケストレーション / ChatOrchestrationRun」と呼ぶ定義変更を明記している。
- 4B は `ChatOrchestrationMode`、`ChatOrchestrationRun`、`ChatToolDefinition`、`ChatToolInvocation` を仕様名として持つ。
- 4C は `AgentRuntimeProvider`、`AgentModelSelection`、`AsyncAgentRun`、`AgentWorkspaceMount`、`AgentProfileDefinition`、`AgentExecutionPreset`、`AgentArtifact` を仕様名として持つ。
- `FR-049` は「旧 `AgentRun` 相当の同期チャット処理が `ChatOrchestrationRun` として trace / store / contract 上で参照できる」ことを受け入れ条件にしている。
- `FR-050` は Claude Code / Codex / OpenCode / custom provider による非同期エージェント実行を扱うため、`Agent` 名称を残すべき別章である。

inferred:

- Phase D の rename 対象は、4B の同期 chat RAG state machine を「agent」と呼んでいる実装・契約・docs であり、4C の非同期エージェント仕様名は rename 対象外にするのが自然。

## TypeScript 識別子棚卸し

confirmed:

| 識別子 | 件数 | 主な場所 | 後続 scope 判定 |
| --- | ---: | --- | --- |
| `QaAgentState` | 144 | `apps/api/src/agent/state.ts`, `apps/api/src/agent/graph.ts`, `apps/api/src/agent/nodes/*.ts`, tests | scope: 4B 同期チャット処理の state 型。`ChatOrchestrationState` などへ rename 候補。 |
| `QaAgentUpdate` | 86 | `apps/api/src/agent/state.ts`, `apps/api/src/agent/trace.ts`, nodes, tests | scope: 4B node update 型。`ChatOrchestrationUpdate` などへ rename 候補。 |
| `QaAgentNode` | 2 | `apps/api/src/agent/graph.ts` | scope: 4B internal node 型。 |
| `AgentStateSchema` | 1 export + 参照 | `apps/api/src/agent/state.ts` | scope: 4B state schema。OpenAPI 表面ではなく内部 schema として rename 候補。 |
| `createQaAgentGraph` | 2 | `apps/api/src/agent/graph.ts` | scope: 4B graph factory。 |
| `runQaAgent` | 4 | `apps/api/src/agent/graph.ts`, `apps/api/src/rag/memorag-service.ts` | scope: `POST /chat`, async chat run, `/benchmark/query` が使う同期 chat orchestration 実行入口。 |
| `applyQaAgentUpdate` | 5 | `apps/api/src/agent/graph.ts`, tests | scope: 4B state update helper。 |
| `AGENT_WORKFLOW_VERSION` | 1 export + build | `apps/api/src/rag/pipeline-versions.ts` | scope: version constant。値 `qa-agent-v2` と field `agentWorkflowVersion` は契約互換性に注意。 |
| `agentWorkflowVersion` | API field | `apps/api/src/rag/pipeline-versions.ts`, `apps/api/src/schemas.ts`, `packages/contract/src/schemas/chat.ts`, `apps/api/src/types.ts` | scope: OpenAPI / contract 表面。rename は breaking change になり得る。 |

confirmed:

- `apps/api/src/agent/` 配下のファイルは全体として 4B 同期チャット処理の実装であり、`normalize-query`、`retrieve-memory`、`generate-clues`、`clarification-gate`、`plan_search`、`execute_search_action`、`retrieval_evaluator`、`sufficient_context_gate`、`generate_answer`、`verify_answer_support`、`finalize_response` などの node を持つ。
- `MemoRagService.chat()` と `MemoRagService.executeChatRun()` は `runQaAgent()` を呼び、同期 `/chat` と非同期 `/chat-runs` の実行本体に使っている。
- `/benchmark/query` は `service.chat()` に `benchmark-runner` / `benchmark-corpus` filter を渡すため、agent mode benchmark は同じ 4B 実行経路を評価している。

inferred:

- package directory `apps/api/src/agent/` は後続 rename の中心候補。ただし path rename は import パス、tests、docs、coverage、past reports まで波及するため、scope を限定して段階化する余地がある。
- API field `agentWorkflowVersion` は `pipelineVersions` の既存契約であり、名称変更する場合は `chatOrchestrationWorkflowVersion` の追加と旧 field の互換保持を検討する必要がある。

## OpenAPI schema / contract 表面

confirmed:

| schema / contract | `agent` 出現 | 場所 | 後続 scope 判定 |
| --- | --- | --- | --- |
| `PipelineVersionsSchema` | field `agentWorkflowVersion` | `apps/api/src/schemas.ts`, `packages/contract/src/schemas/chat.ts` | scope候補。ただし response 互換性あり。 |
| `ChatResponseSchema` / `BenchmarkQueryResponseSchema` / debug trace response | nested field `debug.pipelineVersions.agentWorkflowVersion` | `apps/api/src/schemas.ts`, `docs/generated/openapi/post-chat.md`, `post-benchmark-query.md`, debug docs | scope候補。ただし breaking API field。 |
| `BenchmarkModeSchema` | enum value `"agent"` | `apps/api/src/schemas.ts` | scope-out 推奨。benchmark domain の既存 mode として preserve。 |
| `BenchmarkRunSchema` | `mode: BenchmarkModeSchema` | `apps/api/src/schemas.ts`, generated openapi benchmark run docs | scope-out 推奨。run record 互換性を優先。 |
| `CreateBenchmarkRunRequestSchema` | example `mode: "agent"`, `suiteId: "standard-agent-v1"` | `apps/api/src/schemas.ts`, generated openapi benchmark docs | scope-out 推奨。既存 benchmark suite contract。 |
| `BenchmarkSuiteSchema` | `mode: BenchmarkModeSchema`, `suiteId`, `datasetS3Key` | `apps/api/src/schemas.ts`, `GET /benchmark-suites` | scope-out 推奨。suite identity と stored artifact path に関係。 |

confirmed:

- checked-in generated OpenAPI operation docsには `agentWorkflowVersion` が `post-chat.md`、`post-benchmark-query.md`、`get-debug-runs*.md`、`get-conversation-history.md`、`post-conversation-history.md`、`post-documents-documentid-reindex.md` に出る。
- generated OpenAPI benchmark docsには `mode` enum として `agent | search | load` が出る。
- `docs/generated/openapi.md` には component schema 一覧がなく、operation detail Markdown の field table が主な checked-in 生成物である。

open_question:

- `@hono/zod-openapi` が runtime 生成する `components.schemas` に `Agent` を含む component 名が存在するかは、dependency install 後の `app.getOpenAPIDocument()` で再確認する必要がある。
- `agentWorkflowVersion` を rename する場合、旧 field を残す期間、OpenAPI examples、contract package、Web 型、history/debug 保存済み JSON の migration 方針が必要。

## ファイル名 / パス棚卸し

confirmed:

| パス | 種別 | 後続 scope 判定 |
| --- | --- | --- |
| `apps/api/src/agent/` | 実装 directory | scope候補。4B 同期 chat orchestration 実装。 |
| `apps/api/src/agent/graph.ts` | graph 実装 | scope候補。`createQaAgentGraph` / `runQaAgent` を含む。 |
| `apps/api/src/agent/state.ts` | state schema | scope候補。`AgentStateSchema` / `QaAgentState` / `QaAgentUpdate` を含む。 |
| `apps/api/src/agent/trace.ts` | debug trace formatter | scope候補。node trace と `QaAgentUpdate` を扱う。 |
| `apps/api/src/agent/nodes/*.ts` | 4B node群 | scope候補。import path rename が大きい。 |
| `apps/api/src/agent/*test.ts`, `apps/api/src/agent/nodes/*test.ts` | tests | scope候補。実装 rename と同時に更新。 |
| `benchmark/corpus/standard-agent-v1/` | benchmark corpus | scope-out / preserve 推奨。suite identity と seed hash に関係。 |
| `benchmark/suites.codebuild.json` の `smoke-agent-v1`, `standard-agent-v1`, `mode: "agent"`, `runner: "agent"` | benchmark manifest | scope-out / preserve 推奨。性能・品質比較の継続性に関係。 |
| `packages/contract/src/infra.ts`, `packages/contract/infra.d.ts` の `BenchmarkSuiteId` | infra contract | scope-out / preserve 推奨。deployed suite ID と workflow input 互換。 |
| `docs/generated/infra-inventory/*`, `docs/generated/infra-resource-inventory.json` の `datasets/agent` | generated docs | scope-out / preserve 推奨。infra 出力由来で、rename するなら infra と再生成が必要。 |
| `reports/working/*agent*.md`, `tasks/done/*agent*.md` | 過去作業記録 | scope-out 推奨。履歴文書として変更しない。 |
| `skills/*agent*` | repository-local agent process skill | scope-out。product 4B ではなく repo agent 運用。 |

confirmed:

- root level の `AGENTS.md`、`skills/*agent*`、`reports/working/*agent*.md` は repository agent / Codex agent の文脈を多く含むため、4B rename とは別文脈。
- file name として `Agent` を含む現行 product 実装ファイルはなく、主な実装 path は lowercase `apps/api/src/agent/`。

## docs 参照棚卸し

confirmed:

| docs | 内容 | 後続 scope 判定 |
| --- | --- | --- |
| `docs/spec/2026-chapter-spec.md` 4B | 旧 AgentRun から ChatOrchestrationRun への名称変更済み仕様 | source of truth。scope確認対象。 |
| `docs/spec/CHAPTER_TO_REQ_MAP.md` | 4B が `apps/api/src/agent/` と divergent であることを明記 | 原則編集不要。後続 rename 完了後に status 更新候補。 |
| `docs/1_要求_REQ/.../REQ_FUNCTIONAL_049.md` | 4B requirement。旧 `AgentRun` 相当を `ChatOrchestrationRun` として扱う AC | source of truth。後続 rename の受け入れ条件。 |
| `docs/1_要求_REQ/.../REQ_FUNCTIONAL_050.md` | 4C 非同期エージェント実行 | scope-out。`Agent` 名称を preserve。 |
| `docs/3_設計_DES/41_API_API/DES_API_001.md` | `/chat-runs` が `runQaAgent()` へ渡す、benchmark run が agent mode で `/benchmark/query` を使う記述 | scope候補。ただし benchmark mode は preserve。 |
| `docs/3_設計_DES/31_データ_DATA/DES_DATA_001.md` | `PipelineVersions.agentWorkflowVersion` を chat RAG state machine version と説明 | scope候補。field 互換を検討。 |
| `docs/OPERATIONS.md` | benchmark metrics、runner、agent mode、quality gate、latency/cost/ACL隔離を説明 | preserve 優先。性能・品質チューニングの主要根拠。 |
| `docs/LOCAL_VERIFICATION.md` | `standard-agent-v1` / `smoke-agent-v1` / corpus seed / runner 動作を説明 | preserve 優先。ローカル検証手順の互換性。 |
| `docs/GITHUB_ACTIONS_DEPLOY.md` | workflow dispatch の suite ID、agent suite 選択肢 | preserve 優先。CI/benchmark operation 互換。 |
| `docs/API_EXAMPLES.md` | `standard-agent-v1` を使う benchmark API 例 | scope-out / preserve。後続で文言だけ調整する場合も suite ID は維持。 |
| `docs/generated/openapi/*.md` | `agentWorkflowVersion`, `mode=agent`, `standard-agent-v1` が生成結果として出る | source schema 変更時のみ再生成。手編集しない。 |

inferred:

- 4B rename の durable docs 更新は、`docs/spec/2026-chapter-spec.md` と `REQ_FUNCTIONAL_049.md` では概ね済んでいる。後続 task は実装・contract の名称差分が中心。
- `docs/OPERATIONS.md` や `docs/LOCAL_VERIFICATION.md` にある `agent benchmark` は、現行 benchmark suite の domain label として品質時系列をつなぐ役割が強く、同時 rename は避けるべき。

## 既存性能・品質チューニングの踏襲リスト

preserve:

- `ragRuntimePolicy` による `topK`、`memoryTopK`、`minScore`、`maxIterations`、`searchBudgetCalls`、`referenceMaxDepth`、`maxNoNewEvidenceStreak`、`highConfidenceTopScore` などの境界値。
- `plan_search` / `execute_search_action` / `retrieval_evaluator` / `evaluate_search_progress` の反復探索サイクル。
- stop 条件: iteration 上限、新規根拠なし streak、candidate set 枯渇、同一 action repeated no new evidence、simple high confidence evidence。
- primary fact conflict が budget 内で解消できない場合に回答生成前 `finalize_refusal` へ倒す forced refusal。
- `query_rewrite`、`expand_context`、context window score decay、`mergeRetrievedChunks()` による重複除去と score 降順維持。
- `detect_tool_intent`、`extract_policy_computations`、`execute_computation_tools` による、日付・期限・数値・集計などの計算補助。
- `answerability_gate`、`sufficient_context_gate`、`validate_citations`、`verify_answer_support` による根拠性・引用・unsupported answer 抑制。
- conversation flow: `build_conversation_state`、`decontextualize_query`、clarification gate、follow-up 文脈の保持。
- benchmark query の `source=benchmark-runner`、`docType=benchmark-corpus`、`benchmarkSuiteId` filter 強制。
- benchmark seed の `aclGroups: ["BENCHMARK_RUNNER"]`、通常文書一覧・通常 RAG からの隔離。
- `standard-agent-v1` / `smoke-agent-v1` / `clarification-smoke-v1` / dynamic agent suites の suite ID、dataset key、corpus identity。
- `BENCHMARK_CORPUS_SUITE_ID=standard-agent-v1` による corpus identity 固定と、同じ corpus を複数 suite で共有する設計。
- PDF corpus seed の upload session + async ingest run + polling による API payload size / timeout 回避。
- `skipped_unextractable`、Textract OCR timeout の skipped row 処理、その他 worker failure の fatal 扱い。
- results JSONL、summary JSON、report Markdown、`BenchmarkRunsTable.metrics` 更新、CodeBuild log URL 保存。
- quality metrics: answerable accuracy、refusal/abstention、citation/file/page hit、retrieval recall/MRR、unsupported sentence、no-access leak、p50/p95/average latency。
- baseline comparison と evaluator profile version mismatch の不合格扱い。
- benchmark 期待語句・QA sample 固有値・dataset 固有分岐を RAG 実装へ入れない方針。

## 後続 `D-rename-agent-to-chat-orchestration` scope

confirmed:

- `apps/api/src/agent/` 配下の 4B 同期 chat RAG 実装名。
- `QaAgentState`、`QaAgentUpdate`、`QaAgentNode`、`AgentStateSchema`、`createQaAgentGraph`、`runQaAgent`、`applyQaAgentUpdate`。
- `apps/api/src/rag/memorag-service.ts` の `runQaAgent` import / 呼び出し。
- `apps/api/src/rag/pipeline-versions.ts` の `AGENT_WORKFLOW_VERSION` と値 `qa-agent-v2` の扱い。
- `PipelineVersions.agentWorkflowVersion` と関連 schema / contract / generated OpenAPI docs の互換方針。
- `docs/3_設計_DES/31_データ_DATA/DES_DATA_001.md` など、chat RAG state machine を `agentWorkflowVersion` と呼ぶ durable docs。

inferred:

- 最初の rename PR では internal symbol/path rename と compatibility alias の追加を分けると安全。API response field rename まで含める場合は major/breaking 扱いに近い。
- `agentWorkflowVersion` は、旧 field を残したまま新 field `chatOrchestrationWorkflowVersion` を追加し、docs で deprecation 期間を明記するほうが既存 debug/history/reindex response との互換性を保ちやすい。
- `apps/api/src/agent/` directory rename は import churn が大きいため、後続 PR では tests と generated docs を含む広範囲検証が必要。

## 後続 scope-out

confirmed:

- 4C 非同期エージェント実行の仕様名: `AgentRuntimeProvider`、`AgentModelSelection`、`AsyncAgentRun`、`AgentWorkspaceMount`、`AgentProfileDefinition`、`AgentExecutionPreset`、`AgentArtifact`。
- repository agent / Codex agent / AGENTS.md / local skills / worktree PR flow / 過去作業レポートの `agent`。
- benchmark suite identity: `smoke-agent-v1`、`standard-agent-v1`、`clarification-smoke-v1`、`allganize-rag-evaluation-ja-v1`、`mmrag-docqa-v1`、`jp-public-pdf-qa-v1`、`mlit-pdf-figure-table-rag-seed-v1`、`architecture-drawing-qarag-v0.1`。
- storage path / dataset path: `datasets/agent/*`、`benchmark/corpus/standard-agent-v1/*`。
- benchmark mode / runner value: `mode: "agent"`、`runner: "agent"`。
- generated infra inventory に出る `datasets/agent`。変更するなら infra・bucket object layout・seed manifest・docs再生成が必要で、4B rename の scope から外す。

## open_question

open_question:

- OpenAPI component schema 名に `Agent` を含むものが runtime 生成されるか。dependency install 後に `/openapi.json` を生成して確認する。
- `agentWorkflowVersion` を契約上 rename するか、互換 field として保持するか。
- directory `apps/api/src/agent/` を rename する場合、同一 PR で generated OpenAPI docs と design docs まで更新するか、internal rename と contract rename を分割するか。
- benchmark UI の表示文言「エージェント」や label `Agent standard` を `チャット/RAG` 系へ変えるか。suite ID と mode は preserve 推奨だが、UI ラベルだけなら後方互換性への影響は小さい。
- `qa-agent-v2` version string を `chat-orchestration-v*` へ変える場合、過去 debug trace / manifest / benchmark baseline との比較で version discontinuity をどう扱うか。

## 推奨する実施順

inferred:

1. Internal rename: `QaAgent*` と `runQaAgent` などを `ChatOrchestration*` 系へ変更し、必要なら deprecated alias を短期維持する。
2. Path rename: `apps/api/src/agent/` を `apps/api/src/chat-orchestration/` などへ移動し、import と tests を更新する。
3. Contract compatibility: `pipelineVersions.chatOrchestrationWorkflowVersion` を追加し、`agentWorkflowVersion` は互換 field として残すか deprecation 方針を docs 化する。
4. Generated docs update: OpenAPI docs、API docs、data design docs を再生成・更新する。
5. Benchmark label cleanup: suite ID / mode / dataset path は preserve し、表示ラベルのみ必要に応じて調整する。
