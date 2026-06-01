# ChatToolInvocation の実行・承認・永続監査を追加する

保存先: `tasks/todo/20260516-1618-chat-tool-execution-audit.md`

## 状態

- todo

## タスク種別

- 機能追加

## 背景

Phase F で `ChatToolDefinition` registry と `ChatToolInvocation` schema の基盤は追加された。ただし document / ingest / drawing / support / search improvement / benchmark / debug / external / quality / parse 系 tool は `enabled: false` / `implementationStatus: placeholder` のままで、承認 UI、実行、永続監査は scope-out として残っている。

## 目的

安全に有効化できる tool から順に、toolId ごとの permission、resource permission、approval、audit record、debug visibility を実装する。

## 対象範囲

- `apps/api/src/chat-orchestration/tool-registry.ts`
- chat orchestration tool execution service
- tool invocation store
- approval UI/API
- debug trace / audit log

## 実行計画

1. 有効化する最小 tool 群を選ぶ。
2. tool 実行前の feature permission / resource permission / approvalRequired を共通 guard 化する。
3. `ChatToolInvocation` を永続保存し、input/output summary と redaction policy を固定する。
4. 承認が必要な tool は人間承認なしで実行しない。
5. disabled tool は利用者向け UI に実行可能として表示しない。

## 受け入れ条件

- 有効 tool は registry metadata と実行 guard が一致する。
- 承認必須 tool は承認前に実行されない。
- tool invocation は audit/debug 用に保存され、raw secret や権限外文書情報を含まない。
- disabled/placeholder tool は本番 UI/API で実行可能に見えない。
- route/API 追加時は OpenAPI docs と access-control policy が更新される。

## 検証計画

- `npm run test -w @memorag-mvp/api -- src/chat-orchestration/tool-registry.test.ts`
- `npm run test -w @memorag-mvp/api -- src/security/access-control-policy.test.ts`
- `npm run test -w @memorag-mvp/api -- src/contract/api-contract.test.ts`
- `npm run test -w @memorag-mvp/web`
- `git diff --check`

## PRレビュー観点

- tool 実行が LLM 判断だけに依存していないか。
- tool 入出力 summary に機微情報や権限外情報が混入していないか。
- 未実装 tool を mock/demo fallback で埋めていないか。

## 関連

- `docs/spec/gap-phase-f.md`
- `docs/spec/gap-phase-j2.md`
