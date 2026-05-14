# 章 ID から REQ / 実装への対応表

状態: draft
canonical 仕様: `docs/spec/2026-chapter-spec.md`
作成タスク: `tasks/do/20260514-1432-a2-chapter-to-req-map.md`

## 読み方

- `confirmed`: 既存 docs または実装で直接確認できる。
- `inferred`: 近い docs / 実装はあるが、章別仕様と完全一致するとは限らない。
- `missing`: 対応する既存 docs / 実装が確認できない。
- `divergent`: 現行 docs / 実装と章別仕様のモデル差が大きい。

既存 `FR-*` / `NFR-*` は renumber しない。
新規または不足領域は `status: planning` の REQ 雛形として追加し、詳細化は各 Phase の task で行う。

## 対応表

| 章 ID | 章タイトル | REQ 対応 | spec-recovery 対応 | 主な実装ファイル / 領域 | 状態 | 後続 Phase |
|---|---|---|---|---|---|---|
| 0 | 全体方針 | `REQ_PROJECT_*`, `REQ-DOCS-001` | `TASK-023`, `TASK-024`, `GAP-013` | `docs/REQUIREMENTS.md`, `docs/spec/README.md` | inferred | A |
| 1 | 共通概念 | `FR-024`, `FR-025`, `FR-027`, `NFR-011` | `REQ-AUTH-001`, `SPEC-AUTH-001` | `apps/api/src/auth.ts`, `apps/api/src/routes/system-routes.ts`, `apps/api/src/routes/admin-routes.ts` | partially covered | B/J3 |
| 1A | 認証・アカウント | `FR-025`, `NFR-011` | `REQ-AUTH-001`, `E2E-AUTH-001` | `apps/api/src/auth.ts`, `apps/web/src/features/auth/`, `apps/api/src/routes/system-routes.ts` | partially covered | B/J3 |
| 2 | フォルダ管理 | `FR-041`, `FR-024`, `FR-052` | `REQ-DOC-001`, `SPEC-SEC-001`, `GAP-014` | `apps/api/src/routes/document-routes.ts`, `apps/api/src/rag/memorag-service.ts`, `apps/api/src/adapters/document-group-store.ts` | divergent | B |
| 3 | 文書管理 | `FR-001`, `FR-002`, `FR-007`, `FR-008`, `FR-038`, `FR-041` | `TASK-001`, `TASK-015`, `REQ-DOC-001`, `REQ-DOC-002` | `apps/api/src/routes/document-routes.ts`, `apps/api/src/rag/memorag-service.ts`, `apps/web/src/features/documents/` | confirmed | C/E |
| 3A | 取り込み・抽出・チャンク化 | `FR-002`, `FR-038`, `TC-001`, `SQ-001` | `SPEC-DOC-001`, `SPEC-DOC-002`, `GAP-003` | `apps/api/src/rag/chunk.ts`, `apps/api/src/rag/text-extract.ts`, `apps/api/src/document-ingest-run-worker.ts` | partially covered | E |
| 3B | ナレッジ品質・RAG利用可否 | `FR-002`, `FR-045` | `GAP-013`, `GAP-014` | 近接: `apps/api/src/rag/memorag-service.ts`, `apps/api/src/chat-orchestration/nodes/search-evidence.ts`。4軸 model は Phase C で反映済み | partially covered | C |
| 3C | 高度文書解析・構造化抽出 | `FR-002`, `FR-047` | `GAP-003` | 未実装。近接: `apps/api/src/rag/text-extract.ts`, `apps/api/src/rag/chunk.ts` | missing | E |
| 4 | チャット | `FR-003`, `FR-004`, `FR-005`, `FR-006`, `FR-009`, `FR-042`, `FR-043` | `TASK-002`, `REQ-CHAT-001`, `SPEC-CHAT-001` | `apps/api/src/routes/chat-routes.ts`, `apps/web/src/features/chat/`, `apps/api/src/chat-run-worker.ts` | confirmed | D/F |
| 4A | チャット内RAG・回答生成 | `FR-003`, `FR-004`, `FR-005`, `FR-014`, `FR-015`, `FR-016`, `FR-045`, `FR-049` | `REQ-RAG-001`, `REQ-RAG-002`, `SPEC-RAG-001`, `SPEC-RAG-002`, `GAP-016` | `apps/api/src/chat-orchestration/graph.ts`, `apps/api/src/chat-orchestration/nodes/`, `apps/api/src/rag/context-assembler.ts`, `apps/api/src/chat-orchestration/runtime-policy.ts` | partially covered | F |
| 4B | チャット内オーケストレーション・ツール実行 | `FR-049` | `GAP-016` | `apps/api/src/chat-orchestration/` は名称移行済み。`ChatToolDefinition` registry / `ChatToolInvocation` は未実装 | partially covered | F |
| 4C | 非同期エージェント実行 | `FR-050` | `GAP-013` | 未実装。流用候補: `apps/api/src/chat-run-worker.ts`, `infra/`, CodeBuild runner | missing | G |
| 5 | 履歴 | `FR-022`, `FR-030`, `FR-044` | `TASK-005`, `REQ-HIST-001`, `SPEC-HIST-001` | `apps/api/src/routes/conversation-history-routes.ts`, `apps/api/src/adapters/*conversation-history-store.ts`, `apps/web/src/features/history/` | confirmed | F |
| 6 | お気に入り | `FR-028`, `FR-044` | `REQ-HIST-002`, `SPEC-HIST-003` | `apps/api/src/adapters/conversation-history-store.ts`, `apps/web/src/features/history/` | partially covered | F/J3 |
| 6A | 個人設定 | `FR-051` | `GAP-013` | `apps/web/src/app/components/PersonalSettingsView.tsx`, chat UI state。永続 UserPreference API は未実装 | divergent | J/G |
| 7 | 問い合わせ対応 | `FR-021`, `FR-031`, `FR-032`, `FR-033`, `FR-034`, `FR-035`, `FR-036`, `FR-037` | `TASK-003`, `REQ-QA-001`, `SPEC-QA-001`, `SPEC-QA-002`, `GAP-015` | `apps/api/src/routes/question-routes.ts`, `apps/api/src/adapters/question-store.ts`, `apps/web/src/features/questions/` | partially covered | H |
| 7A | 回答不能・担当者対応の詳細 | `FR-005`, `FR-021`, `FR-031` | `AC-QA-001`, `AC-QA-003`, `E2E-QA-001`, `GAP-015` | `apps/api/src/routes/question-routes.ts`, `apps/api/src/chat-orchestration/nodes/finalize-refusal.ts` | partially covered | H |
| 7B | 品質起因の担当者対応・改善ループ | `FR-037`, `FR-045` | `GAP-010`, `GAP-015` | 近接: `question-routes.ts`, Phase C quality gate, Phase E extraction warnings, alias management。品質起因 loop は未整備 | partially covered | H |
| 8 | 検索改善 | `FR-023`, `FR-037` | `TASK-004`, `REQ-SRCH-001`, `SPEC-SRCH-001`, `SPEC-SRCH-003`, `AC-SRCH-003`, `GAP-007`, `GAP-010`, `GAP-015` | `apps/api/src/search/alias-artifacts.ts`, `apps/api/src/routes/admin-routes.ts`, `apps/api/src/rag/memorag-service.ts` alias lifecycle | partially covered | H |
| 9 | 評価・ベンチマーク | `FR-010`, `FR-011`, `FR-012`, `FR-013`, `FR-019`, `FR-039`, `FR-040`, `FR-047`, `FR-048` | `TASK-007`, `SPEC-BENCH-001`, `GAP-011`, `docs/spec/gap-phase-i.md` | `apps/api/src/routes/benchmark-routes.ts`, `apps/api/src/authorization.ts`, `benchmark/`, `.github/workflows/memorag-benchmark-run.yml` | partially covered | I |
| 9A | チャット・RAG・非同期エージェントのベンチマーク設計 | `FR-019`, `FR-047`, `FR-048`, `FR-050` | `SPEC-BENCH-002`, `SPEC-BENCH-003`, `docs/spec/gap-phase-i.md` | `benchmark/run.ts`, `benchmark/conversation-run.ts`, `benchmark/metrics/`, `apps/api/src/routes/benchmark-routes.ts` | partially covered | I/G |
| 9B | ナレッジ品質・文書解析ベンチマーク | `FR-047`, `FR-048`, `FR-045` | `GAP-003`, `GAP-011`, `docs/spec/gap-phase-i.md` | 近接: `benchmark/metrics/quality.ts`, `benchmark/metrics/drawing-normalization.ts`, document ingest / extraction tests。品質 4 軸 benchmark は未整備 | missing | I |
| 9C | ベンチマーク運用・外部データセット・runner 実行基盤 | `FR-039`, `FR-040`, `FR-048`, `REQ-OPS-001` | `AC-BENCH-001`, `AC-OPS-001`, `docs/spec/gap-phase-i.md` | `benchmark/codebuild-suite.ts`, `benchmark/corpus.ts`, `benchmark/suites.codebuild.json`, `apps/api/src/routes/benchmark-seed.ts`, `apps/api/src/adapters/benchmark-run-store.ts`, `infra/`, `.github/workflows/memorag-benchmark-run.yml` | partially covered | I |
| 10 | 管理ダッシュボード | `FR-024`, `FR-027` | `TASK-008`, `REQ-ADM-001`, `SPEC-ADM-001` | `apps/web/src/features/admin/`, `apps/api/src/routes/admin-routes.ts` | partially covered | J3 |
| 11 | ユーザー・グループ管理 | `FR-024`, `FR-027` | `FACT-007`, `FACT-008`, `REQ-ADM-001` | `apps/api/src/routes/admin-routes.ts`, `apps/api/src/adapters/user-directory.ts` | confirmed | J3 |
| 12 | ロール・権限管理 | `FR-027`, `FR-052`, `NFR-011` | `GAP-014`, `SPEC-SEC-001` | `apps/api/src/authorization.ts`, `apps/api/src/security/access-control-policy.test.ts` | divergent | B/J3 |
| 13 | 利用状況・コスト | `FR-027`, `NFR-012` | `REQ-OPS-001` | `apps/api/src/routes/admin-routes.ts`, `apps/web/src/features/admin/` | partially covered | J3 |
| 14 | 監査ログ | `FR-027`, `FR-052` | `REQ-SEC-001`, `SPEC-SEC-001` | `apps/api/src/routes/admin-routes.ts`, audit log surface | partially covered | J3 |
| 14A | デバッグ・トレース・運用診断 | `FR-010`, `FR-011`, `FR-046` | `TASK-006`, `REQ-DBG-001`, `SPEC-DBG-001`, `SPEC-DBG-002`, `GAP-008`, `GAP-016`, `docs/spec/gap-phase-j2.md` | `apps/api/src/routes/debug-routes.ts`, `apps/api/src/schemas.ts`, `apps/web/src/features/debug/`, `apps/web/src/features/chat/components/ChatView.tsx`, `apps/api/src/chat-orchestration/trace.ts` | partially covered | J2 |
| 14B | API契約・OpenAPI / oRPC・開発品質ゲート | `FR-053` | `TASK-023`, `REQ-DOCS-001`, `REQ-API-001`, `SPEC-API-001` | `apps/api/src/app.ts`, `apps/api/src/generate-openapi-docs.ts`, `apps/api/src/validate-openapi-docs.ts`, `apps/api/src/orpc/router.ts`, `docs/generated/openapi.md`, `docs/spec/gap-phase-j1.md` | partially covered | J1 |
| 14C | デプロイ・リリース・GitHub Actions 運用 | `FR-054`, `REQ_PROJECT_*` | `REQ-OPS-001` | `.github/workflows/`, `infra/`, `docs/GITHUB_ACTIONS_DEPLOY.md` | partially covered | J |
| 14D | API共通 middleware・public endpoint・非同期 worker 実行契約 | `FR-055` | `GAP-014`, `REQ-API-001`, `SPEC-API-001`, `docs/spec/gap-phase-j2.md` | `apps/api/src/app.ts`, `apps/api/src/routes/chat-routes.ts`, `apps/api/src/routes/document-routes.ts`, `apps/api/src/chat-run-events-stream.ts`, `apps/api/src/chat-run-worker.ts`, `apps/api/src/document-ingest-run-worker.ts`, `apps/api/src/security/access-control-policy.test.ts` | partially covered | J2/G |
| 15 | 再インデックス | `FR-002`, `FR-023`, `FR-038` | `GAP-010` | `apps/api/src/routes/document-routes.ts`, `apps/api/src/rag/memorag-service.ts` | partially covered | E/H |
| 16 | 全体権限定義 | `FR-052`, `NFR-011` | `GAP-014` | `apps/api/src/authorization.ts` | divergent | B |
| 17 | Resource-level permission | `FR-052`, `FR-041` | `GAP-014` | document group ACL / owner / manager logic | divergent | B |
| 18 | Feature-level permission | `FR-052`, `FR-027` | `GAP-014` | `apps/api/src/authorization.ts`, route metadata | partially covered | B |
| 19 | ロールプリセット | `FR-052`, `FR-027` | `GAP-014` | `apps/api/src/authorization.ts`, admin roles route | divergent | B/J3 |
| 20 | 操作別の最終認可表 | `FR-052` | `GAP-014` | `apps/api/src/security/access-control-policy.test.ts` | missing | B |
| 21 | RAG 認可の不変条件 | `FR-004`, `FR-014`, `FR-015`, `FR-045`, `FR-052` | `SPEC-SEC-001`, `SPEC-RAG-001`, `GAP-004` | `apps/api/src/search/hybrid-search.ts`, `apps/api/src/chat-orchestration/nodes/search-evidence.ts` | partially covered | B/C/F |
| 21A | API lifecycle と互換性の不変条件 | `FR-053`, `FR-055` | `REQ-API-001`, `SPEC-API-001` | `apps/api/src/app.ts`, `apps/api/src/schemas.ts`, `packages/contract/src/`, `docs/spec/gap-phase-j1.md` | partially covered | J1/J2 |
| 22 | 危険操作の共通要件 | `FR-027`, `FR-052` | `REQ-SEC-001` | admin routes, document delete / reindex routes | partially covered | B/J3 |
| 23 | 推奨 URL 構成 | `FR-024`, `FR-027`, `FR-053` | `REQ-DOCS-001` | `apps/web/src/app/AppRoutes.tsx`, API routes | inferred | J |
| 23A | 簡易処理フロー | `REQ-DOCS-001`, related FRs | `docs/spec-recovery/04_e2e_scenarios.md` | cross-cutting flow docs / worker routes | inferred | all |
| 24 | 最終まとめ | all related FRs, `FR-049`-`FR-055` | `GAP-013`, `GAP-014` | cross-cutting | confirmed | all |

## Planning REQ 一覧

| REQ | 対象章 | 保存先 |
|---|---|---|
| `FR-049` | 4B | `docs/1_要求_REQ/11_製品要求_PRODUCT/01_機能要求_FUNCTIONAL/02_チャットQA・根拠提示・回答不能制御/08_チャット内オーケストレーション/REQ_FUNCTIONAL_049.md` |
| `FR-050` | 4C | `docs/1_要求_REQ/11_製品要求_PRODUCT/01_機能要求_FUNCTIONAL/08_認証・認可・管理・監査/04_非同期エージェント実行/REQ_FUNCTIONAL_050.md` |
| `FR-051` | 6A | `docs/1_要求_REQ/11_製品要求_PRODUCT/01_機能要求_FUNCTIONAL/08_認証・認可・管理・監査/05_個人設定/REQ_FUNCTIONAL_051.md` |
| `FR-052` | 16-20 | `docs/1_要求_REQ/11_製品要求_PRODUCT/01_機能要求_FUNCTIONAL/08_認証・認可・管理・監査/06_3層認可モデル/REQ_FUNCTIONAL_052.md` |
| `FR-053` | 14B | `docs/1_要求_REQ/11_製品要求_PRODUCT/01_機能要求_FUNCTIONAL/07_評価・debug・benchmark/11_API契約・品質ゲート/REQ_FUNCTIONAL_053.md` |
| `FR-054` | 14C | `docs/1_要求_REQ/11_製品要求_PRODUCT/01_機能要求_FUNCTIONAL/07_評価・debug・benchmark/11_API契約・品質ゲート/REQ_FUNCTIONAL_054.md` |
| `FR-055` | 14D | `docs/1_要求_REQ/11_製品要求_PRODUCT/01_機能要求_FUNCTIONAL/07_評価・debug・benchmark/11_API契約・品質ゲート/REQ_FUNCTIONAL_055.md` |

## Phase F-pre 補助表: 4A/4B tool registry / multi-turn

| 対象 | 現状 | 後続 task |
|---|---|---|
| 4A RAG pipeline | `apps/api/src/chat-orchestration/graph.ts` と nodes に主要処理は存在するが、toolId registry には未接続。 | `F-chat-tool-registry-multiturn` で RAG 系 toolId と現行 node の対応を固定する。 |
| 4A multi-turn | `conversation`, `conversationState`, `decontextualizedQuery`, `previousCitations` は request/debug trace にある。`rollingSummary`, `queryFocusedSummary`, `citationMemory`, `taskState` は永続 store にない。 | conversation history schema version up と互換 migration 方針を定義する。 |
| 4B ChatToolDefinition | `ChatToolDefinition` schema / 型と `apps/api/src/chat-orchestration/tool-registry.ts` を追加済み。RAG 系は enabled、後続 phase 依存 tool は disabled metadata。 | 後続 task で disabled tool の本実装・承認 UI・resource permission 実行時チェックを追加する。 |
| 4B ChatToolInvocation | `ChatToolInvocation` schema / 型を追加し、debug trace から `DebugTrace.toolInvocations` を生成する基盤を追加済み。 | 専用永続 store / 承認 workflow / debug tier 表示は後続 task。 |
| 既存挙動の踏襲 | follow-up 軽量化、required fact planning 汎化、policy computation 汎化、answer support verify/repair、minScore filter、diversity、context budget は現行 runtime policy / nodes に存在する。 | registry 化で低 score chunk 復活、全履歴常時 LLM 投入、benchmark 固有分岐混入を避ける。 |

## Phase I-pre 補助表: 9/9A/9B/9C benchmark suites / runner

| 対象 | 現状 | 後続 task |
|---|---|---|
| 9 BenchmarkSuite / BenchmarkRun | `/benchmark-suites`、`/benchmark-runs`、DynamoDB run store、artifact download、cancel、CodeBuild metrics update はある。`BenchmarkCase` CRUD、promotion gate、本番反映 API は未実装。 | `I-benchmark-suites-and-runner` で既存 JSONL / suite manifest と canonical suite / case / run schema の mapping を定義し、promotion gate は read-only artifact から開始する。 |
| 9A useCase / pipeline | agent / search / conversation runner、MTRAG / ChatRAG / MMRAG / public PDF / drawing 系 converter と metrics はある。baseline / candidate diff、unified pipeline stage、async agent benchmark は不足。 | runner 種別、useCase、evaluator profile、case-level result、seed / skip artifact を manifest 化し、async agent は Phase G 依存として scope-out する。 |
| 9A benchmark answer policy | `benchmark_grounded_short` 方針と benchmark suite filter はある。dataset row id による本番ロジック分岐は禁止。 | answer policy は benchmark metadata / suite profile で切り替え、通常回答 policy と分離する。ChatRAG refusal expected values と expected phrases を regression として維持する。 |
| 9B quality / parse benchmark | quality / drawing metrics の部品はあるが、verified / unverified / stale / expired / superseded、OCR / table / figure citation を横断する品質 4 軸 suite は未整備。 | Phase C/E metadata を使った最小 sample と artifact contract を作り、dataset 固有値を実装へ漏らさない。 |
| 9C runner ops | CodeBuild runner、Secrets Manager auth、GitHub Actions manual start、suite manifest、corpus seed isolation、S3 artifact、metrics update はある。`BenchmarkDatasetPrepareRun` / skip manifest は未整備。 | auth fail-fast、token mask、BENCHMARK_RUNNER 最小権限、S3 Vectors metadata budget、Lambda 15 分 / 3008MB quota 方針を維持したまま不足 artifact を追加する。 |
| 既存挙動の踏襲 | `source=benchmark-runner`、`docType=benchmark-corpus`、`benchmarkSuiteId`、`aclGroups=["BENCHMARK_RUNNER"]` による corpus isolation、`benchmark:query` / `benchmark:seed_corpus` の runner 境界、`benchmark:download` の現行互換がある。 | permission 名 `benchmark:artifact:download` への移行は Phase B 方針と合わせる。即時 rename ではなく alias / compatibility を検討する。 |

## Phase J2-pre 補助表: 14A/14D debug / middleware / worker

| 対象 | 現状 | 後続 task |
|---|---|---|
| 14A debug API | `/debug-runs` list/detail/download は `chat:admin:read_all` で保護され、RAG chat debug trace を返す。 | `J2-debug-4tier-and-middleware` で 4 tier visibility と `debug:*` permission の互換移行を定義する。 |
| 14A debug panel | `debugMode && canReadDebugRuns` の場合だけ表示し、保存 JSON / 可視化 JSON / local JSON upload / 拡大表示 / step expand を提供する。 | 権限なしユーザーへの DOM 非表示、local JSON replay、拡大表示を維持したまま tier 表示を追加する。 |
| 14A DebugTrace | 現行 schema は RAG chat trace の `steps`、conversation metadata、retrieved/citations/finalEvidence、toolInvocations に寄っている。 | `targetType`、`visibility`、sanitize policy version、export redaction metadata を既存互換で追加する。 |
| 14D middleware | `/health` と `/openapi.json` だけを public allowlist とし、`OPTIONS` と public path 以外は `authMiddleware` を通す。CORS は `Last-Event-ID` header を許可する。 | public endpoint 追加時は非機微性と `access-control-policy.test.ts` 更新を必須化し、本番 CORS wildcard guard の扱いを決める。 |
| 14D SSE | chat / document ingest stream は runId 単位、owned-run permission、`Last-Event-ID`、heartbeat、timeout を持つ。Lambda stream handler も同様の Last-Event-ID と permission check を持つ。 | event format と再接続挙動を regression test / docs に固定し、CORS wildcard 固定の扱いを整理する。 |
| 14D worker runId | chat / document ingest worker は `{ runId }` を必須入力とし、欠落時に validation error として失敗する。 | `WorkerEvent` / `WorkerResult` 標準化は既存 Step Functions input `{ runId }` 互換を壊さず進める。benchmark / async agent worker は I/G に委譲する。 |
| 既存挙動の踏襲 | debug route を public 化しない、`includeDebug` 時の `chat:admin:read_all` gate を弱めない、SSE `Last-Event-ID` を削らない、worker input `{ runId }` 互換を壊さない。 | J2 実装時の scope / scope-out として `docs/spec/gap-phase-j2.md` を参照する。 |

### Phase J2-debug-4tier-and-middleware 補足

| 対象 | 実装結果 | 残作業 |
|---|---|---|
| 14A DebugTrace 4 tier | 既存 `schemaVersion: 1` RAG trace 互換のまま `targetType`、`visibility`、`sanitizePolicyVersion`、`exportRedaction` metadata を追加した。legacy trace は normalize 時に `rag_run` / `operator_sanitized` / `debug-trace-sanitize-v1` を補う。 | replay 実行 API、監査ログ、raw file 再処理は後続。 |
| 14A debug permission | `debug:*` permission contract と `SYSTEM_ADMIN` role mapping を追加した。`/debug-runs` 系 route は既存管理者可視性を壊さないため `chat:admin:read_all` を alias gate として維持し、OpenAPI route metadata notes に移行方針を記録した。 | `debug:*` 単独 gate への完全移行は role migration と監査ログ整備後。 |
| 14D middleware / SSE | `/health` と `/openapi.json` のみ public、`OPTIONS` bypass、`Last-Event-ID` allowed header、production wildcard CORS guard、chat/document ingest SSE event format を test で固定した。 | edge / WAF / CDN rate limit は infra/ops task。 |
| 14D worker | chat / document ingest worker は `{ runId }` input を維持し、`WorkerEventSchema` / `WorkerResultSchema` を追加した。 | benchmark worker は Phase I、async agent worker は Phase G に委譲。 |

## 後続更新ルール

- Phase B 以降の `*-pre-gap` では、この map の対象章行を更新し、必要に応じて節単位の補助表を追加する。
- `missing` または `divergent` の章を実装 task で扱う場合は、task md の `スコープ -> 含まない` と `リスク` に既存挙動の踏襲条件を明記する。
