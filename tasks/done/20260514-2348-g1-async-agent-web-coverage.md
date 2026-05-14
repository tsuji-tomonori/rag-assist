# G1 async agent web coverage fix

- 状態: done
- タスク種別: CI 修正
- ブランチ: `codex/phase-g1-async-agent-coverage`
- worktree: `.worktrees/phase-g1-async-agent-coverage`

## 背景

PR #312 merge 後の MemoRAG CI で、Web coverage が statements 89.83%、branches 84.41% となり閾値 C0 90%、C1 85% を下回った。Web 修正後の CI では API coverage も branches 85% を下回ったため、同一 PR で API coverage も補強する。

## 目的

G1 で追加した非同期エージェント Web UI/API hook と API route/service/worker contract の実挙動をテストし、coverage 閾値を満たす。

## Scope

- `apps/web/src/features/agents/` の UI/hook/API 分岐に対するテストを追加する。
- `apps/api/src/agent-routes.test.ts`、`apps/api/src/rag/memorag-service.test.ts`、`apps/api/src/worker-contract.test.ts` の G1 分岐に対するテストを追加する。
- CI で再度 API branch coverage が閾値未達となった場合は、G1 契約に沿う provider unavailable / worker result 分岐を追加で固定する。
- 本番 UI/API の挙動は原則変更しない。OpenAPI と実挙動がずれている場合は G1 契約に合わせる。
- 架空 provider/run/artifact/cost を本番経路へ追加しない。

## 受け入れ条件

- [x] Web coverage が CI 閾値 C0 90%、C1 85% を満たす。
- [x] API coverage が CI 閾値 statements 90%、branches 85%、functions 90%、lines 90% を満たす。
- [x] 追加テストが non-mock product UI 方針に反しない。
- [x] `npm test -w @memorag-mvp/web -- --coverage` または同等の coverage 検証が通る。
- [x] `npm exec -w @memorag-mvp/api -- c8 --check-coverage --statements 90 --branches 85 --functions 90 --lines 90 --reporter=text-summary --reporter=json-summary tsx --test src/**/*.test.ts src/**/**/*.test.ts` が通る。
- [x] `git diff --check` が通る。
- [x] 作業レポートを `reports/working/` に追加し、PR コメント後に task を `tasks/done/` へ移動する。

## 検証計画

- `npm test -w @memorag-mvp/web -- --coverage`
- `npm run typecheck -w @memorag-mvp/api`
- `npm test -w @memorag-mvp/api -- src/agent-routes.test.ts src/worker-contract.test.ts src/rag/memorag-service.test.ts`
- `npm exec -w @memorag-mvp/api -- c8 --check-coverage --statements 90 --branches 85 --functions 90 --lines 90 --reporter=text-summary --reporter=json-summary tsx --test src/**/*.test.ts src/**/**/*.test.ts`
- `npm run docs:openapi:check`
- `git diff --check`
