# J2 debug 4 tier and middleware

- 状態: in_progress
- タスク種別: 機能追加
- branch: `codex/phase-j2-debug-4tier-middleware`
- worktree: `.worktrees/phase-j2-debug-4tier-middleware`
- base: `origin/main`

## 背景

`docs/spec/gap-phase-j2.md` の後続 scope として、14A の debug 4 tier visibility と 14D の API common middleware / SSE / worker runId contract を、既存 RAG debug trace 互換を壊さず最小実装する。

別 worker が `I-benchmark-suites-and-runner` を並行実施するため、`benchmark/` 主担当ファイルには触れず、互いの変更を revert しない。

## 目的

- `DebugTrace` / debug API / Web debug panel が 4 tier visibility metadata を扱える contract を持つ。
- `/debug-runs` 系 route の認可 metadata を更新し、`chat:admin:read_all` gate を弱めないまま `debug:*` への移行方針を明示する。
- CORS / public allowlist / OPTIONS bypass / SSE `Last-Event-ID` / worker `{ runId }` 互換を regression として固定する。

## Scope

- 主対象:
  - `apps/api/src/schemas.ts`
  - `apps/api/src/routes/debug-routes.ts`
  - `apps/api/src/app.ts`
  - `apps/api/src/routes/chat-routes.ts`
  - `apps/api/src/routes/document-routes.ts`
  - `apps/api/src/chat-run-events-stream.ts`
  - `apps/api/src/chat-run-worker.ts`
  - `apps/api/src/document-ingest-run-worker.ts`
  - `apps/api/src/security/access-control-policy.test.ts`
  - `apps/web/src/features/debug/`
- 必要に応じて docs、contract tests、OpenAPI generated docs。

## Scope-out

- ChatToolInvocation 専用永続 store、承認 workflow、全 tool registry 本実装。
- benchmark run worker / SSE / retry / cancel 本実装。
- async agent run worker と provider workspace 実行。
- `/admin/debug` 独立管理画面の全面実装。
- debug replay 実行 API と raw file 再処理。
- edge / WAF / CDN rate limit 実装。
- worker 実行中の resource permission revoked 強制停止。

## 作業前チェックリスト

- [x] 必読 skill と `docs/spec/gap-phase-j2.md` を確認する。
- [x] 専用 worktree を `origin/main` から作成する。
- [x] task md を `tasks/do/` に作成し、受け入れ条件を明記する。
- [x] 既存 API/Web/debug/SSE/worker 実装とテストを確認する。
- [x] 最小実装と必要 docs/test を追加する。
- [x] 変更範囲に応じた検証を実行する。
- [x] 作業レポートを作成する。
- [ ] commit / push / PR / PR コメント / task done 移動まで完了する。

## Done 条件

- 受け入れ条件を満たす実装、docs、テストが同じ branch に含まれる。
- 実行した検証が pass し、未実施検証は理由を PR 本文・コメント・作業レポートに記録する。
- 作業レポートを `reports/working/` に保存する。
- 日本語 gitmoji 形式で commit し、branch を push する。
- GitHub Apps 優先で PR を作成し、日本語の受け入れ条件確認 comment とセルフレビュー comment を投稿する。
- PR comment 後にこの task md を `tasks/done/` へ移動し、`状態: done` に更新して追加 commit / push する。

## 受け入れ条件

- [x] 14A の 4 tier visibility (`user_safe`, `support_sanitized`, `operator_sanitized`, `internal_restricted`) を `DebugTrace` / debug API / Web debug panel で扱える contract として追加し、既存 RAG debug trace 互換を壊さない。
- [x] `DebugTrace` に `targetType`, `visibility`, sanitize policy version, export redaction metadata を既存互換で追加する。
- [x] 既存 `chat:admin:read_all` gate を弱めず、`debug:*` permission への移行または alias 方針を docs と route metadata に明記する。既存管理者の debug 可視性を壊さない。
- [x] `/debug-runs` list/detail/download authorization metadata と `access-control-policy.test.ts` を更新し、debug route が public 化しないことを固定する。
- [x] CORS / public allowlist / OPTIONS bypass の現行挙動を docs と test で維持し、`Last-Event-ID` header を削らない。本番 wildcard origin 禁止は config guard または運用 policy として判断を記録する。
- [x] chat / document ingest SSE の `Last-Event-ID`、owned run permission、heartbeat / timeout event format を regression test または docs に固定する。
- [x] chat / document ingest worker の `{ runId }` input 互換を維持し、`WorkerEvent` / `WorkerResult` の最小 schema を既存 consumer を壊さない範囲で実装する。
- [x] debug panel は `debugMode && canReadDebugRuns` の場合だけ表示され、権限なしユーザーには DOM 上も出ない既存境界を維持する。
- [x] `includeDebug` / `debug` 指定時の `chat:admin:read_all` gate、`/health` と `/openapi.json` だけの public allowlist、SSE `listAfter(runId, afterSeq)`、heartbeat / timeout event format、worker input `{ runId }` 互換を維持する。

## 実施検証

- `npm exec -w @memorag-mvp/api -- tsx --test src/contract/api-contract.test.ts`
- `npm exec -w @memorag-mvp/api -- tsx --test src/contract/api-hardening.test.ts`
- `npm exec -w @memorag-mvp/api -- tsx --test src/contract/schemas.test.ts`
- `npm exec -w @memorag-mvp/api -- tsx --test src/rag/memorag-service.test.ts`
- `npm exec -w @memorag-mvp/api -- tsx --test src/security/access-control-policy.test.ts`
- `npm exec -w @memorag-mvp/api -- tsx --test src/worker-contract.test.ts`
- `npm run typecheck -w @memorag-mvp/api`
- `npm run typecheck -w @memorag-mvp/web`
- `npm run test -w @memorag-mvp/web -- DebugPanel debugTraceReplay`
- `npm run docs:openapi`
- `npm run docs:openapi:check`
- `git diff --check`

## 検証計画

- `npm run typecheck -w @memorag-mvp/api`
- targeted API tests:
  - debug route / app / stream / worker / `src/security/access-control-policy.test.ts` / contract as changed
- Web debug を変更した場合:
  - `npm run typecheck -w @memorag-mvp/web`
  - targeted `DebugPanel` tests
- OpenAPI schema/docs を変更した場合:
  - `npm run docs:openapi`
  - `npm run docs:openapi:check`
- `git diff --check`

## ドキュメント保守計画

- `docs/spec/gap-phase-j2.md` または関連 spec map に、`debug:*` alias 方針、public allowlist、CORS wildcard 判断、SSE/worker contract の実装結果を反映する。
- API schema / OpenAPI 出力に影響する場合は generated docs を更新する。

## PR レビュー観点

- debug route が public allowlist に入っていないこと。
- `chat:admin:read_all` gate と既存管理者可視性を弱めていないこと。
- 4 tier 追加が既存 RAG debug trace replay と Web debug panel を壊さないこと。
- 通常利用者向けに権限外文書、内部 policy、raw prompt / credential、LLM 内部推論を露出していないこと。
- CORS `Last-Event-ID`、SSE heartbeat/timeout、worker `{ runId }` 互換が固定されていること。

## リスク

- OpenAPI generated docs の差分が大きくなる可能性がある。
- `debug:*` permission を完全移行すると既存管理者可視性に影響するため、今回は alias / metadata 追加を優先する。
- resource permission revoked 中断は scope-out のため、PR 本文と作業レポートに残リスクとして明記する。
