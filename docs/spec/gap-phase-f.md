# Phase F-pre gap: Chat tool registry and multi-turn state

状態: draft
対象: 仕様 4A / 4B
作成タスク: `tasks/do/20260514-1932-f-pre-gap.md`

## 調査対象

| 種別 | 対象 |
|---|---|
| canonical 仕様 | `docs/spec/2026-chapter-spec.md` 4A, 4B, 関連 14A |
| API 実装 | `apps/api/src/chat-orchestration/graph.ts`, `apps/api/src/chat-orchestration/state.ts`, `apps/api/src/chat-orchestration/nodes/` |
| contract / store | `packages/contract/src/schemas/chat.ts`, `apps/api/src/adapters/*conversation-history-store.ts`, `apps/api/src/types.ts` |
| docs / trace | `docs/spec/CHAPTER_TO_REQ_MAP.md`, `docs/spec-recovery/08_traceability_matrix.md`, `docs/spec-recovery/09_gap_analysis.md`, `FR-049` |

## サマリ

Phase D 後の main では、旧 `agent` 実装は `apps/api/src/chat-orchestration/` に名称移行済みで、RAG pipeline の多くは graph node と debug step として確認できる。4A の `decontextualizedQuery`、previous citation anchoring、RequiredFact、answerability / sufficient context / citation / support verification は部分的に実装済みである。

一方、4B が要求する `ChatToolDefinition` 集中 registry、`toolId` ごとの permission / approval / audit metadata、`ChatToolInvocation` 永続記録は未実装である。現行 node は内部 pipeline step であり、仕様上の toolId と 1:1 の public registry ではない。4A の multi-turn 状態も request/debug trace 内には存在するが、conversation history store には `rollingSummary`、`queryFocusedSummary`、`citationMemory`、`taskState` として永続化されていない。

## 差分分類

| ID | 分類 | 仕様項目 | 現行確認 | 理由 / 根拠 |
|---|---|---|---|---|
| F-CONF-001 | confirmed | 4A pipeline の主要 node 分割 | `graph.ts` は `build_conversation_state`, `decontextualize_query`, `plan_search`, `execute_search_action`, `retrieval_evaluator`, `rerank_chunks`, `answerability_gate`, `sufficient_context_gate`, `generate_answer`, `validate_citations`, `verify_answer_support`, `finalize_response/refusal` を順に実行する。 | 仕様 4A.4A の pipeline とほぼ対応する node 名が trace label として実装されている。 |
| F-CONF-002 | confirmed | `decontextualizedQuery` と previous citation anchoring | `state.ts` に `DecontextualizedQuerySchema`、`ConversationStateSchema.previousCitations`、`previousCitationCount` があり、`build-conversation-state.ts` が citation anchor を retrieval query に混ぜる。 | マルチターン follow-up の軽量な前処理は実装済み。 |
| F-CONF-003 | confirmed | RequiredFact / structured fact planning | `RequiredFactSchema`, `SearchPlanSchema.requiredFacts`, `question-requirements.ts`, `sufficient_context` prompt が RequiredFact id / necessity を扱う。 | 4A の RequiredFact モデルは graph state 内で利用されている。 |
| F-CONF-004 | confirmed | answer support verification / supported-only repair | `verify-answer-support.ts` が `AnswerSupportJudgement` を正規化し、不支持文がある場合に repair prompt で supported-only 再生成を試みる。 | 4A.4B / 4A.13 の回答後検証は現行挙動として踏襲対象。 |
| F-CONF-005 | confirmed | minScore filter と final context selection | `rerank-chunks.ts` は `chunk.score >= state.minScore` で絞り、`selectFinalAnswerChunks(...).slice(0, state.topK)` で final evidence を選ぶ。 | 4A.4B の low score chunk 除外は実装済み。 |
| F-PART-001 | partially covered | `RagQueryRun` / `ChatOrchestrationRun` の trace | `runChatOrchestration` は `runId` と debug trace を保存し、`pipelineVersions.chatOrchestrationWorkflowVersion` を返す。 | 実行 trace はあるが、仕様の `ChatOrchestrationRun` / `RagQueryRun` 型としての永続 store は未分離。 |
| F-PART-002 | partially covered | multi-turn state | request schema と runtime state は `conversation`, `conversationState`, `decontextualizedQuery`, `previousCitations` を持つ。 | 仕様の `rollingSummary`, `queryFocusedSummary`, `citationMemory`, `taskState` は conversation history store にない。 |
| F-PART-003 | partially covered | context budget / diversity | `ragRuntimePolicy` が topK、memoryTopK、maxIterations、judge/token/limit 系を集約し、`rerank-chunks.ts` が layout / page continuity / previous citation boost を持つ。 | 仕様の `ContextBudgetProfile` と diversity 制約は runtime policy と selection logic に分散しており、registry metadata ではない。 |
| F-PART-004 | partially covered | policy computation | `extract-policy-computations.ts` と `policy-computation.ts` が evidence quote と question amount を検証して computed facts を生成する。 | 汎化済みの policy computation はあるが、`rag.compute_policy_facts` toolId として登録されていない。 |
| F-MISS-001 | missing | `ChatToolDefinition` registry | `ChatToolDefinition` / `ChatToolInvocation` schema、registry、permission metadata は contract / API に見当たらない。 | 4B.4 / 4B.5 / 4B.6 の中心機能は後続実装が必要。 |
| F-MISS-002 | missing | toolId ごとの認可・承認・監査 metadata | 現行 route permission はあるが、chat internal tool の `requiredFeaturePermission`, `requiredResourcePermission`, `approvalRequired`, `auditRequired` は未定義。 | Phase B の 3 層認可骨格を前提に Phase F で tool registry へ接続する必要がある。 |
| F-MISS-003 | missing | `ChatToolInvocation` 永続監査 | debug trace step はあるが、`invocationId`, `toolId`, `inputSummary`, `outputSummary`, approval fields を持つ invocation record はない。 | 監査可能な tool invocation は 4B の未実装事項。 |
| F-MISS-004 | missing | conversation history の multi-turn 永続構造 | `ConversationHistoryItem` は `messages` のみで、store は `messages.slice(0, 100)` と item 20 件制限を持つ。 | 長期 state を raw messages から分離する仕様 4A/4.11 と未整合。 |
| F-MISS-005 | missing | 約 30 toolId の document / drawing / support / search improvement / benchmark / debug / external / quality / parse 登録 | 現行 chat graph は主に RAG 回答 path。support、external、quality update、parse review 等は chat-internal tool として未登録。 | Phase H/I/J/E/C の成果に依存する tool は registry 上で disabled / scope-out 管理が必要。 |
| F-DIV-001 | divergent | graph node と toolId の粒度 | 現行 `execute_search_action` は `evidence_search`, `query_rewrite`, `expand_context`, `rerank`, `finalize_refusal` を `SearchAction` として扱うが、仕様は `rag.search`, `rag.rerank`, `rag.select_final_context` 等の toolId に分ける。 | node 名、SearchAction、toolId は別概念として整理しないと trace / audit / permission が混線する。 |
| F-DIV-002 | divergent | `ConversationStateSchema.turnDependency` | 現行は自由文字列で `coreference`, `ellipsis` などを返す。仕様 4A.3 は `"standalone" / "follow_up" / "correction" / "comparison" / "refinement"` を例示する。 | 後続で enum / compatibility mapping を設計する必要がある。 |

## 現行 node と後続 toolId 候補

| 現行 node / 実装 | 対応候補 toolId | 状態 | 後続方針 |
|---|---|---|---|
| `build_conversation_state` | internal preprocessing / `rag.decontextualize_query` の前段 | partially covered | registry では公開 tool にせず、`rag.decontextualize_query` invocation の input assembly として扱う候補。 |
| `decontextualize_query` | `rag.decontextualize_query` | confirmed -> registry missing | 既存 lightweight follow-up rewrite と previous citation anchor をそのまま tool 実装へ接続する。 |
| `normalize_query`, `generate_clues`, `embed_queries`, `execute_search_action` + `search-evidence.ts` | `rag.search` | partially covered | lexical / semantic / RRF / memory-source expansion を 1 tool の内部処理として扱うか、sub-step trace に残す。 |
| `rerank_chunks` | `rag.rerank`, `rag.select_final_context` | partially covered | minScore filter、previous citation boost、layout/page continuity boost、topK context selection を preserve する。 |
| `plan_search`, `question-requirements.ts` | `rag.plan_required_facts` | partially covered | required fact planning 汎化を preserve し、dataset 固有語句を入れない。 |
| `retrieval_evaluator` | `rag.evaluate_answerability`, `rag.detect_claim_conflict` | partially covered | riskSignals は routing signal とし、即拒否に固定しない。claim conflict は I/J の benchmark/debug と同期する。 |
| `answerability_gate`, `sufficient_context_gate` | `rag.evaluate_answerability` | confirmed -> registry missing | primary fact missing / conflicting の拒否挙動を preserve する。 |
| `extract_policy_computations`, `execute_computation_tools` | `rag.compute_policy_facts` | partially covered | policy computation 汎化と computedFacts 根拠扱いを preserve する。 |
| `generate_answer` | `rag.answer` | confirmed -> registry missing | `benchmark_grounded_short` policy と通常回答 policy の分離を維持する。 |
| `validate_citations` | `rag.validate_citations` | confirmed -> registry missing | citation と requirement slot の検証を preserve する。 |
| `verify_answer_support` | `rag.verify_answer_support`, `rag.repair_supported_only` | confirmed -> registry missing | unsupported sentence limit、fallback confidence、supported-only repair を preserve する。 |
| `finalize_refusal` | `rag.explain_unavailable` | partially covered | 利用者向け refusal は存在示唆を避け、Phase H の support ticket 導線とは分ける。 |
| `retrieve_memory` | `rag.search` / memory grounding sub-step | partially covered | memory summary を final citation にしない不変条件を preserve する。 |
| なし | `document.*`, `ingest.*`, `drawing.*`, `support.*`, `search_improvement.*`, `benchmark.*`, `debug.*`, `external.*`, `quality.*`, `parse.*` | missing | Phase F では registry metadata だけ先に disabled / delegated として定義し、実体は C/E/H/I/J/G に送る候補。 |

## 踏襲すべき既存挙動

| ID | 既存挙動 | 根拠 / 影響 |
|---|---|---|
| F-PRESERVE-001 | ChatRAG follow-up 軽量化 | `build-conversation-state.ts` は compact follow-up の場合に previous citation anchor を最大 3 retrieval query に圧縮する。Phase F 実装で全履歴 LLM rewrite を常時追加して latency を悪化させない。 |
| F-PRESERVE-002 | required fact planning 汎化 | `RequiredFact` は factType / necessity / plannerSource / priority を持ち、sufficient context prompt は id ベースで判定する。特定 benchmark 期待語句や dataset 固有分岐を入れない。 |
| F-PRESERVE-003 | policy computation 汎化 | `policy-computation.ts` は quote の実在、金額表記、comparator/effect mapping、confidence threshold を検証して computedFacts を作る。Phase F の `rag.compute_policy_facts` はこの検証を緩めない。 |
| F-PRESERVE-004 | `verify-answer-support` 閾値・制限 | `ragRuntimePolicy.confidence.answerSupport*`, `unsupportedSentenceLimit`, `judgeReasonMaxChars`, `supportingChunkFallbackLimit` を維持する。supported-only repair 後も再 verify する。 |
| F-PRESERVE-005 | minScore filter | `rerank_chunks` は final answer context へ入れる前に `state.minScore` で filter する。tool registry 化で低 score chunk を回答 context / citation に戻さない。 |
| F-PRESERVE-006 | diversity / layout 制約 | `rerank_chunks` の layout boost、page continuity boost、previous citation boost と `selectFinalAnswerChunks` の文脈選択を preserve する。長文・図表・前回引用 anchor の扱いを単純 topK に退化させない。 |
| F-PRESERVE-007 | context budget | `ragRuntimePolicy` の topK、memoryTopK、maxIterations、searchBudgetCalls、LLM maxTokens、各種 limit を preserve する。`ChatToolDefinition.maxToolCalls` 等を足す場合も現行 RAG budget を上書きしない。 |
| F-PRESERVE-008 | memory grounding | memory card / conversation history / assistant 発話を最終 citation として扱わない。final answer は selected evidence / computedFacts のみを根拠にする。 |
| F-PRESERVE-009 | debug / trace sanitize | debug trace は必要な範囲で pipeline step を残すが、権限外文書や内部 policy 詳細を利用者向けに露出しない。tool invocation debug は 14A/J と同期する。 |
| F-PRESERVE-010 | benchmark 固有値の非混入 | `benchmark_grounded_short` は answer policy として分離し、Phase F の registry / multi-turn 実装へ expected phrase、QA sample row id、dataset 固有分岐を入れない。 |

## 後続 `F-chat-tool-registry-multiturn` scope

1. `packages/contract` と API 側に `ChatToolDefinition` / `ChatToolInvocation` / `ChatOrchestrationMode` の schema を追加する。
2. 4B.5 の toolId を registry に登録し、各 tool に `requiredFeaturePermission`, `requiredResourcePermission`, `approvalRequired`, `auditRequired`, `enabled` を必須化する。
3. RAG 系 toolId について、現行 graph node と registry metadata の対応を持たせる。ただし graph を大きく作り替える前に trace label と toolId の対応を docs / tests で固定する。
4. `rag.decontextualize_query`, `rag.plan_required_facts`, `rag.search`, `rag.rerank`, `rag.select_final_context`, `rag.compute_policy_facts`, `rag.evaluate_answerability`, `rag.answer`, `rag.validate_citations`, `rag.verify_answer_support`, `rag.repair_supported_only`, `rag.explain_unavailable` を実装済み RAG path に接続する。
5. conversation history schema を version up し、`rollingSummary`, `queryFocusedSummary`, `citationMemory`, `taskState`, `decontextualizedQuery` の保存方針を定義する。既存 `messages` 互換と item size / 20 item / 100 message 制限の扱いを明記する。
6. `turnDependency` の互換 mapping を設計する。現行 `coreference` / `ellipsis` を仕様 enum にそのまま潰すか、拡張 enum として contract 化するかを決める。
7. registry / invocation / multi-turn state に対する unit / contract test を追加する。

## 後続 scope-out 候補

| scope-out | 理由 | 送付先 |
|---|---|---|
| document / ingest / drawing tool の実処理新設 | Phase E の parsing / chunker と document APIs に依存する。 | E / F follow-up |
| support ticket tool の本実装 | sanitize 済み引き継ぎ、問い合わせ workflow は Phase H の主題。 | H |
| search improvement publish / suggest の本実装 | alias review / publish 方針と UI 非露出方針は Phase H。 | H |
| benchmark runner tool の本実装 | suite 分離、runner、CodeBuild 基盤は Phase I。 | I |
| debug 4 tier の完全実装 | 14A/J の debug tier 設計と UI に依存する。 | J |
| external webhook / workflow 連携 | credential / approval / payload sanitize / audit の横断設計が必要。 | G/J 後 |
| quality update / parse review tool の本実装 | Phase C/E の quality / parsed document model に依存する。 | C/E |
| 非同期エージェント実行との統合 | Phase G は最後に完全実装する方針。Chat registry と別物として扱う。 | G |

## Open questions

| ID | 未確定点 | 判断が必要な理由 |
|---|---|---|
| F-Q-001 | `ChatToolInvocation` をすべての RAG internal step で作るか、公開 toolId 単位だけで作るか。 | 全 node を invocation 化すると trace / audit は強くなるが、保存量と latency が増える。 |
| F-Q-002 | `turnDependency` は仕様 enum へ正規化するか、現行 `coreference` / `ellipsis` を保持するか。 | 既存 benchmark / debug trace の互換性と、仕様読みやすさの trade-off。 |
| F-Q-003 | conversation history の state 永続化を API request/response contract に出すか、server-side debug/history artifact に閉じるか。 | UI 表示、履歴検索、item size、権限境界に影響する。 |
| F-Q-004 | disabled tool を registry に含める場合、クライアントへ表示するか operator/debug のみにするか。 | No Mock Product UI と未実装操作を実データのように見せないルールに関係する。 |
