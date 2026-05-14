# G1 async agent web coverage fix 作業レポート

## 指示

PR #312 merge 後の MemoRAG CI で Web coverage が閾値未達となったため、G1 非同期エージェント Web 追加分のテストを補強して CI を回復する。

## 要件整理

- CI の Web coverage 閾値 C0 90%、C1 85% を満たす。
- 本番 UI/API の挙動は変更しない。
- No Mock Product UI に反する本番 fallback は追加しない。

## 実施作業

- `agentsApi` の provider/run list、create、cancel endpoint 送信テストを追加。
- `useAsyncAgentRuns` の refresh、cancel 成功、cancel 失敗時の state/error/loading テストを追加。
- `AsyncAgentWorkspace` の empty / permission denied / not configured / read-only run detail / cancel 表示テストを追加。

## 成果物

- `apps/web/src/features/agents/api/agentsApi.test.ts`
- `apps/web/src/features/agents/hooks/useAsyncAgentRuns.test.ts`
- `apps/web/src/features/agents/components/AsyncAgentWorkspace.test.tsx`

## 検証

- `npm test -w @memorag-mvp/web -- src/features/agents/api/agentsApi.test.ts src/features/agents/hooks/useAsyncAgentRuns.test.ts src/features/agents/components/AsyncAgentWorkspace.test.tsx`
- `npm run typecheck -w @memorag-mvp/web`
- `npm test -w @memorag-mvp/web -- --coverage`
  - Statements: 91.16%
  - Branches: 86.44%
- `npm run build -w @memorag-mvp/web`
- `git diff --check`

## Fit 評価

G1 で追加した Web feature の実挙動だけをテストし、production path に架空 provider/run/artifact/cost は追加していない。CI coverage 閾値は満たした。

## 未対応・制約・リスク

- `npm ci` 実行時に npm audit notice が表示されたが、この作業では依存更新を行っていない。
