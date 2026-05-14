# G1 async agent foundation

- 状態: done
- タスク種別: 機能追加
- ブランチ: `codex/phase-g1-async-agent-foundation`
- worktree: `.worktrees/phase-g1-async-agent-foundation`

## 背景

Wave7-pre `G-pre-gap` で、Chapter 4C の非同期エージェント基盤に対して provider-neutral contract、permission、run API、worker contract、最小 Web 表示が未整備であることが整理された。G1 では provider 実行を入れず、正直な未設定/利用不可状態と read-only metadata contract を先に固定する。

## 目的

非同期エージェント実行の基盤 contract と API/UI の最小導線を追加し、後続 G2-G4 の provider 実行、workspace execution、writeback 適用に拡張できる状態にする。

## Scope

- provider-neutral な agent runtime schema/type を追加する。
- `agent:*` / `skill:*` / `agent_profile:*` / `agent_preset:*` permission と role preset、route metadata、access-control policy test を追加する。
- `/agents/runs` create/list/get/cancel と read-only artifact metadata API を追加する。
- provider disabled / not configured / unavailable は mock run や架空 artifact を作らず、failed/blocked run として返す。
- selected folder/document readOnly、writeback target full、run ownership / managed read resource condition を docs/test/route metadata に固定する。
- J2 worker contract の `{ runId }` 互換を維持し、`agentRunId` と `runId` の同一値/alias を明示する。
- Web は empty / permission denied / not configured / read-only run detail を最小表示する。

## Scope-out

- provider credentials の保存・実行。
- workspace execution、実ファイル mount、writableCopy、writeback 適用。
- Claude Code / Codex / OpenCode などの本実行。
- 架空 provider/run/artifact/固定コストの表示。

## 実装計画

1. 必読 docs と既存 API/Web/authorization pattern を確認する。
2. API schema/type/store/service/route を最小追加し、permission と route metadata を更新する。
3. access-control policy / authorization / route contract tests を追加する。
4. OpenAPI generated docs と Web inventory の更新要否を確認し、必要な生成差分を含める。
5. Web の最小 navigation/API hook/component を追加する。
6. 対象検証を実行し、失敗があれば修正して再実行する。
7. 作業レポート、commit/push、PR、受け入れ条件コメント、セルフレビューコメント、task done 移動まで完了する。

## ドキュメント保守方針

- API route/schema 追加に伴い OpenAPI 生成 docs を更新する。
- Web UI 追加に伴い web inventory を更新する。
- `docs/spec/gap-phase-g.md` と関連 gap docs は実装前提として読み、必要な durable docs 更新があれば最小範囲で追加する。

## 受け入れ条件

- [x] `AgentRuntimeProvider`, `AgentModelSelection`, `AsyncAgentRun`, `AgentWorkspaceMount`, `AgentArtifact`, `SkillDefinition`, `AgentProfileDefinition`, `AgentExecutionPreset` の provider-neutral schema/type が追加されている。
- [x] `agent:*`, `skill:*`, `agent_profile:*`, `agent_preset:*` permission と role preset、route metadata、`access-control-policy.test.ts` が更新されている。
- [x] `/agents/runs` の create/list/get/cancel と read-only artifact metadata API が追加され、OpenAPI に反映されている。
- [x] provider 実行は実装せず、disabled/not configured/unavailable では mock run や架空 artifact を作らず `not_configured` または `provider_unavailable` の failed/blocked run を返す。
- [x] selected folder/document readOnly、writeback target full、run ownership / managed read resource condition が docs/test/route metadata に固定されている。
- [x] worker contract は J2 の `{ runId }` 互換を維持し、`agentRunId` と `runId` が同一値または alias として明示されている。
- [x] Web は empty / permission denied / not configured / read-only run detail を最小表示し、架空 provider/run/artifact/固定コストを表示しない。
- [x] provider credentials / workspace execution / writeback 適用 / Claude Code / Codex / OpenCode 本実行は scope-out として残されている。
- [x] 作業レポートを `reports/working/` に追加し、task を PR コメント後に `tasks/done/` へ移動している。

## 検証計画

- `npm run typecheck -w @memorag-mvp/api`
- `npm test -w @memorag-mvp/api -- src/security/access-control-policy.test.ts src/authorization.test.ts`
- 追加した API route/contract の関連 API tests
- `npm run typecheck -w @memorag-mvp/web`
- 追加した Web 関連 tests
- `npm run docs:openapi:check`
- `npm run docs:web-inventory:check`
- `git diff --check`

## PR review points

- API route の permission と ownership/managed read 条件が不足していないこと。
- 本番 UI/API に fake provider/run/artifact/cost が混入していないこと。
- provider 未設定時の挙動が正直で、後続 provider 実行と矛盾しないこと。
- OpenAPI と Web inventory が実装に同期していること。

## リスク

- 既存 role preset の名称や permission pattern とずれると access-control policy が不整合になる。
- API と Web を同時に触るため、生成 docs と typecheck の両方で調整が必要になる。
- provider 実行を scope-out するため、UI は read-only/empty/not configured に限定する必要がある。
