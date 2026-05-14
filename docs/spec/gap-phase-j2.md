# Phase J2 Gap: Debug 4-tier, middleware, stream, and worker runId contract

- ファイル: `docs/spec/gap-phase-j2.md`
- 種別: `SPEC_GAP`
- 作成日: 2026-05-14
- 状態: Draft
- 対象 task: `J2-pre-gap`
- 後続 task: `J2-debug-4tier-and-middleware`

## Scope

Phase J2 は、仕様 14A「デバッグ・トレース・運用診断」と 14D「API共通 middleware・public endpoint・非同期 worker 実行契約」を対象にする。

この gap 調査ではコード変更を行わず、現行 debug panel / debug API / API common middleware / SSE / Lambda stream / worker runId 契約の差分を整理する。後続 `J2-debug-4tier-and-middleware` は debug 表示レベルと middleware 境界を整備するが、Phase F/I/G の tool registry、benchmark runner、async agent 本実装は取り込まない。

## Input Inventory

| ID | 種別 | 対象 | 確度 | 用途 |
|---|---|---|---|---|
| J2-SPEC-14A | 仕様 | `docs/spec/2026-chapter-spec.md` 14A 章 | confirmed | Debug target、DebugTrace、4 tier visibility、export/replay、認可、受け入れ条件。 |
| J2-SPEC-14D | 仕様 | `docs/spec/2026-chapter-spec.md` 14D 章 | confirmed | CORS、public endpoint、auth middleware、SSE Last-Event-ID、worker runId 契約。 |
| J2-MAP | 章対応表 | `docs/spec/CHAPTER_TO_REQ_MAP.md` 14A / 14D 行 | confirmed | J2 対象章の REQ / 実装対応。 |
| J2-REQ-FR046 | 要件 | `REQ_FUNCTIONAL_046.md` | confirmed | 管理者が chat run debug trace を時系列 artifact として取得する要求。 |
| J2-REQ-FR055 | 要件 | `REQ_FUNCTIONAL_055.md` | confirmed | API 共通 middleware、SSE、worker runId 契約。 |
| J2-IMPL-APP | 実装 | `apps/api/src/app.ts` | confirmed | CORS、public allowlist、OPTIONS bypass、auth middleware。 |
| J2-IMPL-DEBUG-API | 実装 | `apps/api/src/routes/debug-routes.ts`, `apps/api/src/schemas.ts` | confirmed | `/debug-runs`、詳細、download URL、現行 DebugTrace schema。 |
| J2-IMPL-CHAT-STREAM | 実装 | `apps/api/src/routes/chat-routes.ts`, `apps/api/src/chat-run-events-stream.ts` | confirmed | chat run SSE、Lambda streaming handler、Last-Event-ID、owned run permission。 |
| J2-IMPL-INGEST-STREAM | 実装 | `apps/api/src/routes/document-routes.ts` | confirmed | document ingest run SSE、Last-Event-ID、scoped read permission。 |
| J2-IMPL-WORKER | 実装 | `apps/api/src/chat-run-worker.ts`, `apps/api/src/document-ingest-run-worker.ts`, `apps/api/src/rag/memorag-service.ts` | confirmed | chat / document ingest worker の `runId` 必須処理、runId から executor 起動。 |
| J2-IMPL-POLICY-TEST | テスト | `apps/api/src/security/access-control-policy.test.ts` | confirmed | public allowlist と route-level authorization metadata の静的 guard。 |
| J2-IMPL-WEB-DEBUG | 実装 | `apps/web/src/features/debug/`, `apps/web/src/features/chat/components/ChatView.tsx` | confirmed | debug panel 表示、local JSON replay、拡大表示、permission gate。 |
| J2-REPORT-DEBUG-PERM | 作業レポート | `reports/working/20260510-1106-debug-panel-permission.md` | confirmed | `debug-panel-permission` で確定した Web 側 debug panel 権限境界。 |
| J2-TASK-DEBUG-EXPAND | task | `tasks/done/20260510-1046-debug-panel-expand.md` | confirmed | `debug-panel-expand` で確定した拡大表示動線。 |

## Spec Requirements Summary

| 章 / AC | 要求 summary | 現行分類 |
|---|---|---|
| 14A.2 / AC-DEBUG-001 | RAG run、ingest run、ChatOrchestrationRun、AsyncAgentRun、tool invocation の trace を確認できる。 | partially covered |
| 14A.3 / AC-DEBUG-002..005 | DebugTrace を表示レベルごとに sanitize し、権限外文書、内部 policy、LLM 内部推論を出さない。 | partially covered |
| 14A.5 | `/admin/debug` 相当の debug 画面で run / step / 件数 / warning / error / 除外理由を表示する。 | partially covered |
| 14A.6 / AC-DEBUG-008..009 | sanitize 済み export と replay の権限境界を持つ。 | partially covered |
| 14A.7 | `debug:trace:*`、`debug:ingest:read`、`debug:chunk:read`、`debug:replay` などの細分 permission を使う。 | missing |
| 14D.1 / AC-API-MW-001..003 | CORS allowlist、OPTIONS bypass、public/protected endpoint、非機微 public response を共通 middleware で定義する。 | partially covered |
| 14D.2 / AC-STREAM-001 | SSE stream は run access permission と Last-Event-ID 再接続を扱う。 | partially covered |
| 14D.3 / AC-WORKER-001..003 | worker は `runId` 必須入力で chat / ingest / benchmark / async agent を実行し、失敗時の扱いを統一する。 | partially covered |

## confirmed

| ID | 現行で確認できた事実 | 根拠 | 仕様との差分 |
|---|---|---|---|
| J2-CONF-001 | `apps/api/src/app.ts` は `/health` と `/openapi.json` だけを public allowlist に置き、`OPTIONS` と public path 以外を `authMiddleware` に渡す。 | `apps/api/src/app.ts`, `access-control-policy.test.ts` | 14D.1 の public/protected 境界の骨格はある。 |
| J2-CONF-002 | API CORS は configured allowlist を使い、allowed headers に `Last-Event-ID` を含める。 | `apps/api/src/app.ts` | SSE 再接続用 header は通常 API 側で許可済み。 |
| J2-CONF-003 | protected route と OpenAPI authorization metadata は静的 test で同期され、public path は allowlist 方式に固定されている。 | `apps/api/src/security/access-control-policy.test.ts` | middleware 変更時の回帰 guard として踏襲対象。 |
| J2-CONF-004 | `POST /chat-runs` は `chat:create` を要求し、`includeDebug` または `debug` が true の場合は `chat:admin:read_all` も要求する。 | `apps/api/src/routes/chat-routes.ts` | debug 要求時の追加 permission 境界は現行契約として維持する。 |
| J2-CONF-005 | `GET /chat-runs/{runId}/events` は `chat:read:own` を要求し、run 作成者または `chat:admin:read_all` のみ購読できる。 | `apps/api/src/routes/chat-routes.ts` | stream 購読時の run access permission は実装済み。 |
| J2-CONF-006 | chat / document ingest の SSE route は `Last-Event-ID` を number として読み、`listAfter(runId, afterSeq)` で未送信 event から再開し、heartbeat / timeout を返す。 | `apps/api/src/routes/chat-routes.ts`, `apps/api/src/routes/document-routes.ts` | 14D.2 の再接続処理は通常 API route で実装済み。 |
| J2-CONF-007 | Lambda streaming 用 `chat-run-events-stream.ts` も `Last-Event-ID` / `last-event-id` を読み、run 作成者または `chat:admin:read_all` に限定する。 | `apps/api/src/chat-run-events-stream.ts` | API Gateway/Lambda streaming 側にも同等の購読境界がある。 |
| J2-CONF-008 | `chat-run-worker.ts` と `document-ingest-run-worker.ts` は event の `runId` がない場合に `runId is required` で失敗し、runId から service executor を呼ぶ。 | `apps/api/src/chat-run-worker.ts`, `apps/api/src/document-ingest-run-worker.ts` | 14D.3 の `runId` 必須契約は chat / ingest worker で確認済み。 |
| J2-CONF-009 | `MemoRagService.startChatRun()` / `startDocumentIngestRun()` は run を作成し、Step Functions input に `{ runId }` を渡す。local では executor を非同期実行する。 | `apps/api/src/rag/memorag-service.ts` | runId 単位の worker 起動導線は chat / ingest で存在する。 |
| J2-CONF-010 | Web debug panel は `debugMode && canReadDebugRuns` の場合だけ表示され、権限がない場合は DOM 上も非表示になる。 | `ChatView.tsx`, `reports/working/20260510-1106-debug-panel-permission.md` | `debug-panel-permission` の結果として踏襲する。 |
| J2-CONF-011 | Debug panel は保存済み trace、local JSON replay、可視化 JSON download、拡大表示、step expand/collapse を持つ。 | `apps/web/src/features/debug/components/DebugPanel.tsx`, `DebugPanelHeader.tsx`, `tasks/done/20260510-1046-debug-panel-expand.md` | `debug-panel-expand` の既存 UI 契約として踏襲する。 |

## partially_covered

| ID | 内容 | 根拠 | 残差分 |
|---|---|---|---|
| J2-PART-001 | Debug API は `/debug-runs`、`/debug-runs/{runId}`、`/debug-runs/{runId}/download` を持ち、`chat:admin:read_all` を要求する。 | `apps/api/src/routes/debug-routes.ts` | 仕様の `debug:trace:read:self/sanitized/internal`、`debug:trace:export` などの細分 permission ではなく、現行は `chat:admin:read_all` に集約されている。 |
| J2-PART-002 | `DebugTraceSchema` は runId、question、model、pipelineVersions、conversationState、decontextualizedQuery、retrieved/citations/finalEvidence、toolInvocations、steps を持つ。 | `apps/api/src/schemas.ts`, `apps/web/src/features/debug/types.ts` | 14A の `traceId`、`targetType`、`visibility`、`events[]`、`redactionPolicyVersion`、`expiresAt` は contract 化されていない。 |
| J2-PART-003 | Debug panel は RAG run のフロー、fact coverage、answer support、context assembly、evidence rows を可視化できる。 | `DebugPanelBody.tsx`, `debugTraceReplay.ts` | 仕様の ingest/reindex/async agent/support/benchmark/search improvement debug 画面は未統合。 |
| J2-PART-004 | download route は debug JSON の署名付き URL を返す。 | `debug-routes.ts`, `MemoRagService.createDebugTraceDownloadUrl()` | export 専用 permission、redaction policy version、監査ログ、危険操作承認は未整備。 |
| J2-PART-005 | `/health` と `/openapi.json` は public endpoint として allowlist されている。 | `app.ts` | `/health` response の非機微性は route 実装依存で、public endpoint abuse / rate limit 方針は未文書化。 |
| J2-PART-006 | Hono route の CORS は allowlist を参照する。 | `app.ts` | `config.corsAllowedOrigins` に `*` が含まれる場合は origin をそのまま返すため、本番 wildcard 禁止を config/infra/test で固定していない。 |
| J2-PART-007 | chat / document ingest run は SSE と run store / event store を持つ。 | `chat-routes.ts`, `document-routes.ts`, stores | benchmark run と async agent run の SSE / worker 実行契約は未実装または別 Phase 依存。 |
| J2-PART-008 | chat / document ingest worker は `runId` 必須で executor を起動する。 | `chat-run-worker.ts`, `document-ingest-run-worker.ts` | `WorkerResult` 型、not_found / permission_revoked / retryable classification、実行中 permission revoked 停止は統一されていない。 |

## missing

| Gap ID | 状態 | 内容 | 後続対応 |
|---|---|---|---|
| J2-GAP-001 | missing | 14A の 4 tier visibility (`user_safe`, `support_sanitized`, `operator_sanitized`, `internal_restricted`) が DebugTrace schema / API / Web 表示に contract 化されていない。 | `J2-debug-4tier-and-middleware` で visibility field と sanitize policy を追加し、既存 `chat:admin:read_all` gate から段階移行する。 |
| J2-GAP-002 | missing | 仕様の debug permission (`debug:trace:read:self`, `debug:trace:read:sanitized`, `debug:trace:read:internal`, `debug:trace:export`, `debug:ingest:read`, `debug:chunk:read`, `debug:replay`) が現行 permission model にない。 | 既存 `chat:admin:read_all` を急に外さず、alias / migration 方針と route-level policy test を追加する。 |
| J2-GAP-003 | missing | replay 実行 API と replay 時の対象フォルダ `full` permission、承認、監査ログがない。 | 初回 J2 では replay の実行は scope-out にし、local JSON replay UI は維持する。 |
| J2-GAP-004 | missing | debug trace 閲覧 / export / replay の監査ログ記録が route contract としてない。 | J3 監査ログまたは J2 follow-up で audit event を追加する。 |
| J2-GAP-005 | missing | `/admin/debug` 相当の run 横断画面は Web ルーティング上の独立管理画面としては未確認で、現行は chat 画面内 debug panel 中心。 | 後続 J2 では chat panel の権限境界を維持しつつ、独立 admin debug route は J3 scope とするか判断する。 |
| J2-GAP-006 | missing | benchmark run worker と async agent run worker の runId 契約、SSE、retry/cancel UI は未実装。 | benchmark は I、async agent は G に委譲し、J2 は共通 contract と scope-out を文書化する。 |
| J2-GAP-007 | missing | 本番 CORS wildcard 禁止を config validation / deployment guard / test で固定していない。 | J2 で config guard を入れるか、infra/ops policy として別 task に残す。 |
| J2-GAP-008 | missing | WorkerEvent / WorkerResult の標準 schema と error code (`validation_error`, `not_found`, `permission_revoked`, retryable/non-retryable) がない。 | J2 では chat / ingest 既存契約を崩さず、WorkerResult 標準化は G/I と同期する。 |

## divergent

| ID | 内容 | 根拠 | 判断 |
|---|---|---|---|
| J2-DIV-001 | 仕様 14A は debug 専用 permission と表示レベルを中心にするが、現行 debug API は `chat:admin:read_all` による管理者集約 gate。 | `debug-routes.ts`, `authorization.test.ts`, `ChatView.tsx` | 既存 security boundary と Web 表示条件を踏襲し、細分 permission は互換移行として追加する。 |
| J2-DIV-002 | 仕様 14A の DebugTrace は targetType / visibility / events を持つ汎用 trace だが、現行 schema は RAG chat debug trace に寄った `steps` 中心。 | `schemas.ts`, `apps/web/src/features/debug/types.ts` | 汎用 trace に一気に置換せず、既存 RAG trace replay と download 互換を保つ。 |
| J2-DIV-003 | 仕様 14D は public endpoint と CORS allowlist を本番安全に定義するが、現行 CORS は config に `*` があれば origin を返す。 | `app.ts` | local/dev 互換を壊さず、本番 config guard の導入可否を後続で判断する。 |
| J2-DIV-004 | Lambda stream handler の `corsHeaders` は `Access-Control-Allow-Origin: *` 固定。 | `chat-run-events-stream.ts` | API Gateway 側 authorizer 前提の stream handler だが、14D の本番 wildcard 禁止とは緊張関係があるため J2 で扱う。 |
| J2-DIV-005 | 仕様 14D は worker 実行中の permission revoked を安全停止するが、現行 chat / ingest executor は run 作成時権限と run store を主に参照する。 | `MemoRagService.executeChatRun()`, `executeDocumentIngestRun()` | 実行中再認可の有無は resource model に影響するため、J2 では gap として明示し B/C/E/G と同期する。 |

## Preserve Existing Behavior

| ID | 踏襲すべき既存挙動 | 根拠 | J2 での扱い |
|---|---|---|---|
| J2-PRESERVE-001 | debug panel は `debugMode && canReadDebugRuns` の場合だけ表示し、権限なしユーザーには DOM 上も出さない。 | `ChatView.tsx`, `reports/working/20260510-1106-debug-panel-permission.md` | 4 tier 追加時も権限なしへの fallback 表示や mock debug data を出さない。 |
| J2-PRESERVE-002 | `includeDebug` / `debug` 指定時は `chat:admin:read_all` を要求する。 | `chat-routes.ts` | debug permission 細分化まではこの gate を弱めない。 |
| J2-PRESERVE-003 | `/debug-runs` 系 route は protected route として扱い、public allowlist に入れない。 | `debug-routes.ts`, `access-control-policy.test.ts` | debug trace / download URL / replay を public にしない。 |
| J2-PRESERVE-004 | `/health` と `/openapi.json` だけを public allowlist とし、保護 route は `authMiddleware` を通す。 | `app.ts`, `access-control-policy.test.ts` | public endpoint 追加時は非機微性と policy test 更新を必須にする。 |
| J2-PRESERVE-005 | CORS allowed headers は `Last-Event-ID` を含め、SSE 再接続を壊さない。 | `app.ts`, `chat-routes.ts`, `document-routes.ts` | CORS guard 強化時も `Last-Event-ID` を削らない。 |
| J2-PRESERVE-006 | SSE route は runId 単位で `listAfter(runId, afterSeq)` し、`id` / `event` / JSON `data`、heartbeat、timeout を返す。 | `chat-routes.ts`, `document-routes.ts`, `chat-run-events-stream.ts` | Last-Event-ID 対応と既存 event format を維持する。 |
| J2-PRESERVE-007 | chat / document ingest worker は `runId` 欠落を validation error とし、executor へ `runId` だけを渡す最小契約を維持する。 | `chat-run-worker.ts`, `document-ingest-run-worker.ts`, `MemoRagService.start*Execution()` | WorkerEvent 標準化時も既存 Step Functions input `{ runId }` 互換を壊さない。 |
| J2-PRESERVE-008 | Debug panel の保存 JSON download、可視化 JSON download、local JSON upload、拡大表示、step expand/collapse を維持する。 | `DebugPanelHeader.tsx`, `DebugPanel.tsx`, `tasks/done/20260510-1046-debug-panel-expand.md` | 4 tier 表示化で既存操作を無反応化しない。 |
| J2-PRESERVE-009 | debug trace は権限外文書、内部 policy、raw prompt / credential、LLM 内部推論を通常利用者向けに出さない。 | 14A 仕様, `SPEC-DBG-001`, `gap-phase-h.md` | sanitize 方針の中心不変条件として扱う。 |

## J2-debug-4tier-and-middleware Scope

後続 `J2-debug-4tier-and-middleware` の最小 scope は次とする。

1. 14A の 4 tier visibility を現行 `DebugTrace` / debug API / Web debug panel に追加できる contract として定義する。
2. 既存 `chat:admin:read_all` gate を弱めず、`debug:*` permission への移行または alias 方針を docs と route metadata に明記する。
3. DebugTrace の `targetType` / `visibility` / sanitize policy version / export redaction metadata を、既存 RAG debug trace 互換を保つ形で追加する。
4. `/debug-runs` list / detail / download の authorization metadata と `access-control-policy.test.ts` を更新し、debug route が public 化しないことを固定する。
5. CORS / public allowlist / OPTIONS bypass の現行挙動を docs と test で維持し、本番 wildcard origin 禁止を config guard とするか運用 policy とするか判断する。
6. chat / document ingest SSE の Last-Event-ID、owned run permission、heartbeat / timeout の event format を regression test または docs に固定する。
7. chat / document ingest worker の `{ runId }` input 互換を維持し、WorkerEvent / WorkerResult の標準 schema は最小定義から始める。

## J2-debug-4tier-and-middleware Scope-out

| ID | scope-out | 理由 / 委譲先 |
|---|---|---|
| J2-OUT-001 | ChatToolInvocation 専用永続 store、承認 workflow、全 tool registry の本実装。 | Phase F の領域。J2 は debug 表示 tier と sanitize に必要な metadata だけ扱う。 |
| J2-OUT-002 | benchmark run worker / SSE / retry / cancel の本実装。 | Phase I の benchmark runner 基盤に依存する。 |
| J2-OUT-003 | async agent run worker と provider workspace 実行。 | Phase G の async agent 実装に依存する。 |
| J2-OUT-004 | `/admin/debug` 独立管理画面の全面実装。 | J3 管理画面導線と併せて扱う。J2 は既存 chat debug panel の境界維持を優先する。 |
| J2-OUT-005 | debug replay 実行 API と raw file 再処理。 | 危険操作承認、folder full permission、監査ログが必要。初回 J2 では local JSON replay の既存 UI を維持する。 |
| J2-OUT-006 | edge / WAF / CDN rate limit 実装。 | infra/ops task。J2 では public endpoint 非機微性と app-level allowlist を文書化する。 |
| J2-OUT-007 | worker 実行中の resource permission revoked を全 executor で強制停止する仕組み。 | 文書 ACL / quality gate / long-running execution model に影響するため B/C/E/G/I と同期する。 |

## Open Questions

| ID | 種別 | 内容 | 次の判断 |
|---|---|---|---|
| J2-OQ-001 | open_question | `debug:*` permission を新設する際、既存 `chat:admin:read_all` を alias として残すか、role preset を移行するか。 | 既存管理者の debug 可視性を壊さない migration 方針を決める。 |
| J2-OQ-002 | open_question | `DebugTrace` を汎用 `events[]` へ寄せるか、既存 `steps[]` RAG trace を保持して optional 汎用 metadata を足すか。 | Web replay 互換と 14A 汎用性の trade-off。 |
| J2-OQ-003 | open_question | 本番 CORS wildcard 禁止を app config validation で fail させるか、infra deploy policy で扱うか。 | local/dev 互換と本番安全性の境界を決める。 |
| J2-OQ-004 | open_question | Lambda streaming handler の `Access-Control-Allow-Origin: *` 固定を config 連動に変えるか、API Gateway authorizer と edge CORS に委譲するか。 | 14D と実デプロイ構成の責務分担が必要。 |
| J2-OQ-005 | open_question | WorkerResult の error code を各 worker で返すか、run store に記録して handler は `{ runId, status }` 互換を維持するか。 | 既存 Step Functions / tests / consumers への影響を比較する。 |

## Targeted Validation For J2

| 検証 | 目的 |
|---|---|
| `python3 scripts/validate_spec_recovery.py docs/spec-recovery` | spec-recovery 構造と ID 存在の確認。 |
| `git diff --check` | Markdown whitespace / conflict marker 確認。 |
| `npm run test -w @memorag-mvp/api -- access-control-policy.test.ts` | 後続で route / middleware を変更した場合の静的 policy guard。今回の pre-gap docs 変更では未実施。 |
| `npm run test -w @memorag-mvp/web -- DebugPanel` | 後続で debug panel 表示を変更した場合の UI regression。今回の pre-gap docs 変更では未実施。 |
