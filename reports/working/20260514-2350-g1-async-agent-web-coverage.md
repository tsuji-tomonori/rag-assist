# G1 async agent web coverage fix 作業レポート

## 指示

PR #312 merge 後の MemoRAG CI で Web/API coverage が閾値未達となったため、G1 非同期エージェント追加分のテストを補強して CI を回復する。

## 要件整理

- CI の Web/API coverage 閾値を満たす。
- 本番 UI/API の挙動は原則変更しない。既存 OpenAPI と実挙動がずれている場合は G1 契約に合わせる。
- No Mock Product UI に反する本番 fallback は追加しない。

## 実施作業

- `agentsApi` の provider/run list、create、cancel endpoint 送信テストを追加。
- `useAsyncAgentRuns` の refresh、cancel 成功、cancel 失敗時の state/error/loading テストを追加。
- `AsyncAgentWorkspace` の empty / permission denied / not configured / read-only run detail / cancel 表示テストを追加。
- API 側で async agent route、service、worker contract のテストを補強。
- 存在しない run の artifact list が 200/empty になる挙動を、OpenAPI どおり 404 に修正。
- worker の `{ agentRunId }` alias、blocked/completed/cancelled result 変換、provider 実行なしの blocked 化をテストで固定。

## 成果物

- `apps/web/src/features/agents/api/agentsApi.test.ts`
- `apps/web/src/features/agents/hooks/useAsyncAgentRuns.test.ts`
- `apps/web/src/features/agents/components/AsyncAgentWorkspace.test.tsx`
- `apps/api/src/agent-routes.test.ts`
- `apps/api/src/rag/memorag-service.test.ts`
- `apps/api/src/rag/memorag-service.ts`
- `apps/api/src/worker-contract.test.ts`

## 検証

- `npm test -w @memorag-mvp/web -- src/features/agents/api/agentsApi.test.ts src/features/agents/hooks/useAsyncAgentRuns.test.ts src/features/agents/components/AsyncAgentWorkspace.test.tsx`
- `npm run typecheck -w @memorag-mvp/web`
- `npm test -w @memorag-mvp/web -- --coverage`
  - Statements: 91.16%
  - Branches: 86.44%
- `npm run build -w @memorag-mvp/web`
- `npm run typecheck -w @memorag-mvp/api`
- `npm test -w @memorag-mvp/api -- src/security/access-control-policy.test.ts src/authorization.test.ts src/agent-routes.test.ts src/worker-contract.test.ts src/rag/memorag-service.test.ts`
- `npm exec -w @memorag-mvp/api -- c8 --check-coverage --statements 90 --branches 85 --functions 90 --lines 90 --reporter=text-summary --reporter=json-summary tsx --test src/**/*.test.ts src/**/**/*.test.ts`
  - Statements: 94.20%
  - Branches: 85.00%
- `npm run docs:openapi:check`
- `npm run docs:web-inventory:check`
- `git diff --check`

## Fit 評価

G1 で追加した Web/API feature の実挙動だけをテストし、production path に架空 provider/run/artifact/cost は追加していない。存在しない artifact run は正直に 404 を返すようになり、CI coverage 閾値は満たした。

## 未対応・制約・リスク

- `npm ci` 実行時に npm audit notice が表示されたが、この作業では依存更新を行っていない。
- API coverage の最終再実行は同一内容で一度 pass 後、確認再実行が `questions-access.test.ts` のローカルサーバ待ちで停止したため中断した。中断前の確定 pass 値は上記に記録済みで、その後の変更は type import と fixture field の型整合のみ。
