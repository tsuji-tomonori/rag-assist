# 作業完了レポート

保存先: `reports/working/20260522-2329-async-agent-entry-disable.md`

## 1. 受けた指示

- 主な依頼: 非同期エージェント実行だけを削除対象とし、チャット内オーケストレーションは残す方針で進める。
- 実施範囲: 分割 PR 方針の PR1 として、feature flag / UI 導線停止に相当する入口閉塞を行う。
- 条件: repository-local `AGENTS.md` と関連 skill に従い、専用 worktree、task md、受け入れ条件、検証、作業レポート、commit/PR flow を守る。
- 明示的に残すもの: `ChatOrchestrationRun`、`ChatToolInvocation`、`ChatToolDefinition`、RAG / 検索 / 回答生成経路。

## 2. 要件整理

| 要件ID | 指示・要件 | 重要度 | 対応状況 |
|---|---|---:|---|
| R1 | `/agents` 系 API を 404 または 410 にする | 高 | 対応 |
| R2 | `/agents` 系 UI 導線を非表示にする | 高 | 対応 |
| R3 | `agent:run` が Web capability として true にならない | 高 | 対応 |
| R4 | `agent:run`、`agent:provider:manage`、`agent:artifact:writeback` を role seed から外す | 高 | 対応 |
| R5 | async agent run/provider API を画面初期化で呼ばない | 高 | 対応 |
| R6 | チャット内オーケストレーションと RAG 回答経路を残す | 高 | 対応 |
| R7 | 生成 docs / inventory を差分に追従させる | 中 | 対応 |
| R8 | 検証結果と未実施事項を正直に記録する | 高 | 対応 |

## 3. 検討・判断したこと

- 一括削除ではなく PR1 に限定し、contract/schema/service/worker の大規模削除は後続 PR に残した。
- API は `registerAgentRoutes` の登録解除だけだと route source の静的監査に残るため、`apps/api/src/routes/agent-routes.ts` を削除して active route 定義を消した。
- role seed は Phase 1 の明示条件に合わせ、`agent:run`、`agent:provider:manage`、`agent:artifact:writeback` を外した。read/cancel/skill/profile/preset の型互換は後続削除に残した。
- Web は `useAsyncAgentRuns` の初期化と route props を外し、`AppView` から `agents` を除外した。`?view=agents` は有効 view として扱われず chat に戻る。
- `ChatOrchestrationRun`、RAG tool registry、`rag_answer` の型・実装には触れていない。

## 4. 実施作業

- `tasks/do/20260522-2317-async-agent-entry-disable.md` を作成し、受け入れ条件と検証計画を明記した。
- API route 登録から agent route を外し、agent route 実装ファイルを削除した。
- API role seed から非同期エージェントの実行・provider 管理・writeback permission を除外した。
- Web app shell から async agent hook、route、sidebar 項目、`agents` view を除去した。
- Web permission hook で async agent capability が常に false になるようにした。
- OpenAPI generated docs と Web UI inventory を再生成し、stale な `/agents` OpenAPI Markdown を削除した。
- 関連テストを入口停止後の期待値へ更新した。

## 5. 成果物

| 成果物 | 内容 |
|---|---|
| `apps/api/src/routes/api-routes.ts` | `registerAgentRoutes` 登録を削除 |
| `apps/api/src/routes/agent-routes.ts` | `/agents` active route 定義を削除 |
| `apps/api/src/authorization.ts` | 危険入口 permission を role seed から除外 |
| `apps/web/src/app/*` | `/agents` view、sidebar、初期ロード、capability を無効化 |
| `docs/generated/openapi*` | runtime OpenAPI から `/agents` を除去 |
| `docs/generated/web-*` | sidebar / app view 変更を UI inventory に反映 |
| `tasks/do/20260522-2317-async-agent-entry-disable.md` | task md と受け入れ条件 |

## 6. 実行した検証

- `npm ci`: pass。専用 worktree に依存関係を展開。
- `npm test -w @memorag-mvp/api`: pass。343 tests pass。
- `npm test -w @memorag-mvp/web -- src/app/hooks/usePermissions.test.ts src/app/hooks/useAppShellState.test.ts src/app/components/RailNav.test.tsx src/App.test.tsx`: pass。4 files / 51 tests pass。
- `npm run typecheck -w @memorag-mvp/api`: pass。
- `npm run typecheck -w @memorag-mvp/web`: pass。
- `npm run docs:openapi:check`: 初回 fail。OpenAPI generated docs が stale。`npm run docs:openapi` 後に pass。
- `npm run docs:web-inventory:check`: 初回 fail。Web inventory が stale。`npm run docs:web-inventory` 後に pass。
- `git diff --check`: pass。
- `npm run lint`: pass。

## 7. 未対応・制約・リスク

- contract/schema/service/worker/benchmark/docs/spec からの `AsyncAgentRun` 等の完全削除は未対応。後続 PR2 以降の対象。
- `apps/web/src/features/agents` の未使用 component/hook/type は残っている。Web UI 本体削除は PR4 の対象。
- `docs/generated/web-features/agents.md` は inventory generator が未使用ファイルも拾うため残る。active app route / sidebar では参照されない。
- `npm audit` は `npm ci` 後に 5 件の既存 vulnerability を報告したが、今回の依存追加・更新は行っていない。

## 8. Fit 評価

総合fit: 4.6 / 5.0（約92%）

理由: PR1 の入口停止、検証、生成 docs 更新は満たした。完全削除や DB/data migration まではユーザー提示の分割方針上で後続 PR と判断したため、今回の fit は PR1 範囲に対して高いが、全 Phase 完了ではない。
