# D-rename-agent-to-chat-orchestration

状態: do

## 背景

Wave 3 Phase D の仕様 4B は、同期チャット内 RAG 処理を旧 `Agent` / `QaAgent` ではなく `ChatOrchestration` 系の名称で扱う。`docs/spec/gap-phase-d.md` では、4B 同期 chat RAG 実装の internal symbols と `PipelineVersions` 互換 field が後続 rename scope として整理されている。

## 目的

4B 同期 chat RAG 実装の内部名称を `ChatOrchestration` 系へ rename し、既存 API / debug / history / reindex / benchmark response の後方互換を維持した PR を作成する。

## タスク種別

機能追加

## Scope

- `ChatOrchestrationState`, `ChatOrchestrationUpdate`, `ChatOrchestrationNode`, `ChatOrchestrationStateSchema`, `createChatOrchestrationGraph`, `runChatOrchestration`, `applyChatOrchestrationUpdate` を `ChatOrchestration` 系へ rename する。
- 可能なら `apps/api/src/agent/` を `apps/api/src/chat-orchestration/` へ rename する。
- `PipelineVersions` に `chatOrchestrationWorkflowVersion` を追加し、既存 `agentWorkflowVersion` を互換 field として維持する。
- `AGENT_WORKFLOW_VERSION` / `qa-agent-v2` の互換方針を docs に明記する。
- `docs/spec/gap-phase-d.md` と関連 design docs に実装結果と残した open question を追記する。
- 作業レポートを `reports/working/*d-rename-agent-to-chat-orchestration*.md` に作成する。

## Scope-out

- 4C 非同期エージェントの `Agent*` 名称。
- benchmark suite ID / mode / runner / dataset path: `standard-agent-v1`, `smoke-agent-v1`, `mode: agent`, `datasets/agent`。
- `AGENTS.md`、skills、過去 reports/tasks の repository agent 文脈。
- C/E の quality/parsing 実装。

## 実施計画

1. 仕様と既存実装の参照箇所を確認する。
2. 4B 実装 directory と internal symbols を rename し、import / test path を更新する。
3. `PipelineVersions` の新 field を追加し、旧 field を互換維持する。
4. schema / contract 変更があれば OpenAPI docs を正規コマンドで再生成または check する。
5. `docs/spec/gap-phase-d.md` と関連 design docs を更新する。
6. 必須検証を実行し、失敗時は修正して再実行する。
7. 作業レポートを作成し、commit / push / PR / PR コメント / task done 移動まで実施する。

## Documentation maintenance plan

- `docs/spec/gap-phase-d.md` に実装結果、互換 field、残した open question を追記する。
- `docs/3_設計_DES/31_データ_DATA/DES_DATA_001.md` で `PipelineVersions` の新旧 field を説明する。
- `docs/3_設計_DES/41_API_API/DES_API_001.md` で `/chat-runs` の実行入口名を更新する。
- source schema 変更に伴い generated OpenAPI docs が変わる場合は、手編集せず正規生成コマンドを使う。

## 受け入れ条件

- [x] 4B 同期 chat RAG 実装の主要 internal symbols が `ChatOrchestration` 系の名称へ rename されている。
- [x] `apps/api/src/agent/` から `apps/api/src/chat-orchestration/` への directory rename が実施されている。
- [x] `PipelineVersions.chatOrchestrationWorkflowVersion` が追加され、`agentWorkflowVersion` は互換 field として残っている。
- [x] `AGENT_WORKFLOW_VERSION` / `qa-agent-v2` の互換方針が docs / report に明記され、benchmark baseline を壊す値変更をしていない。
- [x] `standard-agent-v1`, `smoke-agent-v1`, `mode: agent`, `datasets/agent` など benchmark identity は preserve されている。
- [x] `docs/spec/gap-phase-d.md` と関連 design docs に実装結果と残リスクが追記されている。
- [x] 作業レポートが `reports/working/*d-rename-agent-to-chat-orchestration*.md` に作成されている。
- [x] 必須検証が実行され、未実施がある場合は理由が PR 本文 / コメント / report に明記されている。
- [ ] main 向け PR が作成され、日本語 PR 本文、受け入れ条件コメント、セルフレビューコメントが追加されている。
- [ ] PR コメント後に task md が `tasks/done/` へ移動され、状態が `done` になり、同じ branch に commit / push されている。

## 検証計画

- `npm run typecheck -w @memorag-mvp/api`
- affected API tests: `npm exec -w @memorag-mvp/api -- tsx --test src/chat-orchestration/graph.test.ts src/chat-orchestration/nodes/node-units.test.ts src/contract/api-contract.test.ts`
- schema 変更時: generated OpenAPI docs check / regenerate command を実行する。
- `git diff --check`
- `python3 scripts/validate_spec_recovery.py docs/spec-recovery`

## PR review points

- docs と実装の同期。
- 後方互換 API field の維持。
- RAG の根拠性・認可境界を弱めていないこと。
- benchmark 期待語句・QA sample 固有値・dataset 固有分岐を実装へ入れていないこと。

## リスク

- path rename は import churn が大きく、同時作業 worker との conflict が起きやすい。
- `PipelineVersions` の source schema 変更により generated OpenAPI docs の更新が必要になる。
- `qa-agent-v2` の値変更は過去 benchmark baseline と debug trace 比較を壊すため、今回変更しない。
