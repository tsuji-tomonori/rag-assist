# J2 debug 4 tier and middleware 作業完了レポート

- 日時: 2026-05-14 22:09 JST
- branch: `codex/phase-j2-debug-4tier-middleware`
- worktree: `.worktrees/phase-j2-debug-4tier-middleware`
- task: `tasks/do/20260514-2149-j2-debug-4tier-and-middleware.md`

## 受けた指示

`docs/spec/gap-phase-j2.md` の後続 scope に基づき、14A debug 4 tier visibility と 14D middleware / SSE / worker runId contract の最小実装を Worktree Task PR Flow で完了する。別 worker の `benchmark/` 主担当ファイルは触らない。

## 要件整理

- `DebugTrace` に `targetType`, `visibility`, sanitize policy version, export redaction metadata を既存互換で追加する。
- `/debug-runs` は `chat:admin:read_all` gate を弱めず、`debug:*` への移行方針を route metadata と docs に明記する。
- `/debug-runs` を public allowlist に入れず、`/health` と `/openapi.json` の public 境界、OPTIONS bypass、SSE `Last-Event-ID` を固定する。
- chat / document ingest worker は `{ runId }` input 互換を維持しつつ、最小 `WorkerEvent` / `WorkerResult` schema を導入する。
- debug panel は `debugMode && canReadDebugRuns` 境界を維持し、権限なしユーザーに DOM 表示しない既存方針を崩さない。

## 検討・判断

- `debug:*` へ完全移行すると既存管理者の debug 可視性を壊す可能性があるため、今回は `chat:admin:read_all` を alias gate として維持し、`debug:*` は role mapping と route metadata の移行先として追加した。
- 本番 wildcard CORS は運用 policy だけでなく `config` guard と regression test で拒否する方針にした。
- OpenAPI generated docs は `DebugTraceSchema` を参照する既存 response に metadata が反映されるため、debug 以外の chat/history/benchmark response docs にも schema 差分が出た。

## 実施作業

- API の `DebugTrace` 型・Zod schema に 4 tier visibility、target type、sanitize policy version、export redaction metadata を追加した。
- 永続化・download JSON の DebugTrace に J2 metadata を付与し、legacy trace は default 値で parse できるようにした。
- `debug:*` permissions を定義し、`SYSTEM_ADMIN` に追加した。debug route metadata には alias gate と移行先 permission を記録した。
- CORS allowed origin の本番 wildcard guard を追加し、SSE `Last-Event-ID` header を維持した。
- chat / document ingest worker に `WorkerEventSchema` / `WorkerResultSchema` を導入し、`{ runId }` 互換を維持した。
- Web debug panel に target / visibility / sanitize / redaction summary 表示を追加した。
- access-control policy、schema contract、worker contract、RAG debug trace JSON、Web debug tests を更新した。
- `docs/spec/gap-phase-j2.md` と `docs/spec/CHAPTER_TO_REQ_MAP.md` に実装方針・残 scope を追記し、OpenAPI generated docs を更新した。

## 成果物

- 実装: `apps/api/src/types.ts`, `apps/api/src/schemas.ts`, `apps/api/src/routes/debug-routes.ts`, `apps/api/src/config.ts`, `apps/api/src/chat-run-events-stream.ts`, `apps/api/src/chat-run-worker.ts`, `apps/api/src/document-ingest-run-worker.ts`, `apps/api/src/rag/memorag-service.ts`, `apps/api/src/chat-orchestration/graph.ts`
- Web: `apps/web/src/features/debug/`
- テスト: `apps/api/src/security/access-control-policy.test.ts`, `apps/api/src/contract/schemas.test.ts`, `apps/api/src/contract/api-hardening.test.ts`, `apps/api/src/rag/memorag-service.test.ts`, `apps/api/src/worker-contract.test.ts`, `apps/web/src/features/debug/components/DebugPanel.test.tsx`
- Docs: `docs/spec/gap-phase-j2.md`, `docs/spec/CHAPTER_TO_REQ_MAP.md`, `docs/generated/openapi/`

## 検証

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

## Fit 評価

受け入れ条件の実装・docs・targeted validation は満たした。`chat:admin:read_all` gate、public allowlist、SSE reconnect format、worker `{ runId }` 互換は regression として固定した。

## 未対応・制約・リスク

- `debug:*` permission への完全移行は未実施。既存互換のため alias gate を維持した。
- resource permission revoked による実行中 worker 強制停止は明示 scope-out。
- full workspace test / build は実行していない。変更範囲に合わせた targeted tests、typecheck、OpenAPI check を実施した。
- `npm ci` 実行時に既存 dependency audit として `4 vulnerabilities (1 moderate, 3 high)` が報告されたが、本タスクでは依存更新を行っていない。
