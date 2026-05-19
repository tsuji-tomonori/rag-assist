# PR #328 retrieve-memory explicit regression tests

- 状態: done
- タスク種別: テスト追加
- 対象 PR: #328
- 現行 head: `e563e1962d93665e0e5e650bd03c57b0f430381a`

## 背景

PR #328 の再レビューで、chat orchestration の memory retrieval 経路に group scoped document の `ownerUserId` bypass が残っているとの指摘があった。実装上は `retrieve-memory.ts` が group scope first の ACL へ修正済みだが、レビューで指定された単体テスト名に近い明示的な regression test を追加し、挙動をより直接固定する。

## 受け入れ条件

- [x] `retrieve-memory.ts` が group scoped document では `ownerUserId` より先に folder permission を評価していることを確認する。
- [x] `retrieve memory excludes group scoped owner document when user lacks folder read permission` 相当の単体テストを追加する。
- [x] `parent shared -> inherited child memory card is visible to parent-shared reader` 相当の positive test を追加する。
- [x] `parent shared -> explicit private child memory card is not visible to parent-shared reader` 相当の negative test を追加する。
- [x] `npm run test -w @memorag-mvp/api -- retrieve-memory` が pass する。
- [x] `npm run test -w @memorag-mvp/api -- --test-name-pattern "document group|memory"` が pass する。
- [x] `npm run typecheck -w @memorag-mvp/api` が pass する。

## 実装計画

- 既存 `node-units.test.ts` の `createRetrieveMemoryNode` test 群へ専用 test を追加する。
- テスト fixture は private parent / shared parent / inherited child / explicit private child を store と manifest JSON で構成する。
- 実装本体に差分が不要か確認し、必要な場合だけ最小修正する。

## 検証計画

- `npm run test -w @memorag-mvp/api -- retrieve-memory`
- `npm run test -w @memorag-mvp/api -- --test-name-pattern "document group|memory"`
- `npm run typecheck -w @memorag-mvp/api`
- `git diff --check`

## 実施結果

- `apps/api/src/chat-orchestration/nodes/retrieve-memory.ts` が group scope first の ACL であることを確認した。実装差分は不要。
- `apps/api/src/chat-orchestration/nodes/retrieve-memory.test.ts` を追加し、以下 3 ケースを固定した。
  - group scoped owner document は folder read permission がなければ memory retrieval から除外する。
  - parent shared を継承する child の memory card は parent shared reader に見える。
  - parent shared でも explicit private child の memory card は parent shared reader に見えない。

## 検証結果

- pass: `./node_modules/.bin/tsx --test apps/api/src/chat-orchestration/nodes/retrieve-memory.test.ts`
- pass: `npm run test -w @memorag-mvp/api -- retrieve-memory`
- pass: `npm run test -w @memorag-mvp/api -- --test-name-pattern="document group|memory"`
- pass: `npm run typecheck -w @memorag-mvp/api`
- pass: `git diff --check`

## 補足

- `npm run test -w @memorag-mvp/api -- retrieve-memory` と `--test-name-pattern` は、このリポジトリの API test script では glob と合わせて API test 全体を実行する形になった。追加した専用 test の 3 件は `./node_modules/.bin/tsx --test apps/api/src/chat-orchestration/nodes/retrieve-memory.test.ts` で個別に pass することも確認した。
