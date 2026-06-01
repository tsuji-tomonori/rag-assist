# 非同期エージェント成果物の writeback 承認 workflow を追加する

保存先: `tasks/todo/20260516-1618-async-agent-writeback-approval.md`

## 状態

- todo

## タスク種別

- 機能追加

## 背景

Phase G1-G4 で非同期エージェントの provider-neutral API、Claude Code / Codex / OpenCode command provider、artifact metadata、log redaction は実装済み。残差分として、writableCopy、patch diff、writeback approval、rollback reason、実ファイル同期は scope-out になっている。

## 目的

非同期エージェントが生成した成果物を、folder/document `full` 権限と明示承認に基づいて安全に保存・反映できる workflow を追加する。

## 対象範囲

- `apps/api/src/routes/agent-routes.ts`
- `apps/api/src/rag/memorag-service.ts`
- async agent artifact store
- Web agents feature
- audit log / access-control policy

## 実行計画

1. AgentArtifact の writeback candidate / patch / target metadata を定義する。
2. selected folder/document の `full` 権限と `agent:artifact:writeback` を必須にする。
3. diff preview、approval、reject、apply、rollback reason を API と UI で扱う。
4. provider output を直接上書きせず、承認済み artifact だけを反映する。
5. audit log に who / when / source run / target / decision を残す。

## 受け入れ条件

- writeback は full resource permission と明示承認なしに実行されない。
- diff preview と reject が可能で、承認前に対象ファイルを変更しない。
- provider log / stdout の secret redaction が維持される。
- 権限が失われた run は writeback できない。
- audit log から source run と target が追跡できる。

## 検証計画

- `npm run test -w @memorag-mvp/api -- src/routes/agent-routes.test.ts`
- `npm run test -w @memorag-mvp/api -- src/rag/memorag-service.test.ts`
- `npm run test -w @memorag-mvp/api -- src/security/access-control-policy.test.ts`
- `npm run test -w @memorag-mvp/web`
- `git diff --check`

## PRレビュー観点

- 破壊的変更や上書きが承認なしで走らないか。
- provider artifact に含まれる secret や機微情報を UI/API で過剰表示していないか。
- writableCopy と original file の境界が曖昧になっていないか。

## 関連

- `docs/spec/gap-phase-g.md`
- `tasks/done/20260514-2325-g1-async-agent-foundation.md`
- `tasks/done/20260515-0058-g3-async-agent-codex.md`
