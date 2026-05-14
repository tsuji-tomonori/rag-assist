# G1 async agent foundation 作業レポート

## 指示

Wave7 `G1-async-agent-foundation` として、provider 実行を実装しない前提で非同期エージェント基盤の schema/type、permission、API、worker contract、最小 Web 表示を追加し、OpenAPI / Web inventory / access-control policy を同期する。

## 要件整理

- `AgentRuntimeProvider`, `AgentModelSelection`, `AsyncAgentRun`, `AgentWorkspaceMount`, `AgentArtifact`, `SkillDefinition`, `AgentProfileDefinition`, `AgentExecutionPreset` を provider-neutral に定義する。
- `agent:*`, `skill:*`, `agent_profile:*`, `agent_preset:*` permission と role preset を追加し、route metadata と静的 access-control policy に固定する。
- `/agents/runs` の create/list/get/cancel と read-only artifact metadata API を追加する。
- provider が disabled / not configured / unavailable の場合、mock run や架空 artifact を作らず `blocked` run として `not_configured` または `provider_unavailable` を返す。
- selected folder/document は readOnly、writeback target は full、run は owner または managed read で扱う条件を docs/test/route metadata に残す。
- J2 worker contract の `{ runId }` 互換を維持し、`agentRunId` と `runId` を同一値 alias として扱う。
- Web は empty / permission denied / not configured / read-only run detail の最小表示に限定し、架空 provider/run/artifact/固定コストを表示しない。

## 判断

- G1 では provider credential と実行基盤が scope-out のため、provider 一覧は設定状態のみを返す API とした。
- run metadata は既存 service/object store pattern に合わせ、後続 G2-G4 で永続 store や provider worker へ置き換えやすい最小実装にした。
- Web は run 作成 UI を置かず、API 由来の provider/run 状態だけを read-only 表示することで No Mock Product UI を満たす構成にした。

## 実施作業

- API/contract に provider-neutral agent schema/type を追加。
- authorization に agent/skill/profile/preset permission、role preset、resource condition を追加。
- `/agents/providers`, `/agents/runs`, `/agents/runs/{agentRunId}`, cancel、artifact metadata API を追加。
- async agent worker handler を追加し、J2 `runId` と `agentRunId` alias を許容。
- access-control policy、authorization、route、worker contract のテストを追加・更新。
- Web に非同期エージェント view、API hook、navigation、permission guard、最小 read-only UI を追加。
- 初回 PR CI で Web full coverage が global threshold を下回ったため、`agentsApi`、`useAsyncAgentRuns`、`AsyncAgentWorkspace` の unit/component test を追加し、provider 未設定・権限不足・read-only detail・cancel・fallback 非表示を検証した。
- OpenAPI generated docs と Web inventory を更新。
- `docs/spec/gap-phase-g.md` に G1 実装メモを追記。

## 成果物

- task: `tasks/do/20260514-2325-g1-async-agent-foundation.md`
- API route: `apps/api/src/routes/agent-routes.ts`
- worker: `apps/api/src/async-agent-run-worker.ts`
- Web feature: `apps/web/src/features/agents/`
- generated docs: `docs/generated/openapi*`, `docs/generated/web-*`

## 検証

- `npm run typecheck -w @memorag-mvp/api`
- `npm run typecheck -w @memorag-mvp/web`
- `npm run typecheck -w @memorag-mvp/contract`
- `npm test -w @memorag-mvp/api -- src/security/access-control-policy.test.ts src/authorization.test.ts src/agent-routes.test.ts src/worker-contract.test.ts`
- `npm test -w @memorag-mvp/web -- src/app/hooks/usePermissions.test.ts src/app/components/RailNav.test.tsx src/app/hooks/useAppShellState.test.ts src/App.test.tsx`
- `npm run test -w @memorag-mvp/web -- agents`
- `npm run test:coverage -w @memorag-mvp/web` (Statements 91%, Branches 86.13%, Functions 90.42%, Lines 94.53%)
- `npm run docs:openapi`
- `npm run docs:openapi:check`
- `npm run docs:web-inventory`
- `npm run docs:web-inventory:check`
- `git diff --check`

## Fit 評価

G1 の範囲である provider-neutral contract、permission/route metadata、read-only API、J2 worker alias、最小 Web 表示、生成 docs 同期は実施済み。provider 実行、credential、workspace execution、writeback 適用、Claude Code / Codex / OpenCode 本実行は scope-out として残した。

## 未対応・制約・リスク

- provider 実行は未実装のため、作成 run は現時点では `blocked` になる。
- 実ファイル mount、writableCopy、writeback 適用は G2-G4 で別途実装が必要。
- `npm ci` 実行時に audit notice が表示されたが、この作業では依存更新を行っていない。
