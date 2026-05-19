# PR #328 retrieve-memory 明示回帰テスト追加レポート

## 受けた指示

PR #328 の再レビューで、chat orchestration の memory retrieval 経路に group scoped document の `ownerUserId` bypass が残っているとして、専用の回帰テスト追加と検証を求められた。

## 要件整理

- group scoped document は、memory retrieval でも `ownerUserId` より所属 folder の実効 read permission を優先する。
- `retrieve memory excludes group scoped owner document when user lacks folder read permission` 相当のテストを追加する。
- 親共有継承の positive case と、子 explicit private 優先の negative case も可能なら追加する。
- API test と typecheck を実行し、未実施の検証は実施済みにしない。

## 検討・判断

`retrieve-memory.ts` 本体は既に group scope first の ACL になっていたため、追加実装は不要と判断した。一方で、レビュー指摘を直接固定する専用 test file がある方が回帰防止とレビュー確認に有効なため、`retrieve-memory.test.ts` を新設した。

## 実施作業

- `apps/api/src/chat-orchestration/nodes/retrieve-memory.test.ts` を追加した。
- group scoped owner document が folder read permission なしでは memory retrieval から除外されることを固定した。
- parent shared を継承する child memory card が見えることを固定した。
- explicit private child memory card は parent shared reader に見えないことを固定した。
- task md を作成し、受け入れ条件と検証結果を記録した。

## 成果物

- `apps/api/src/chat-orchestration/nodes/retrieve-memory.test.ts`
- `tasks/do/20260519-2219-pr328-retrieve-memory-explicit-tests.md`

## 検証

- pass: `./node_modules/.bin/tsx --test apps/api/src/chat-orchestration/nodes/retrieve-memory.test.ts`
- pass: `npm run test -w @memorag-mvp/api -- retrieve-memory`
- pass: `npm run test -w @memorag-mvp/api -- --test-name-pattern="document group|memory"`
- pass: `npm run typecheck -w @memorag-mvp/api`
- pass: `git diff --check`

## Fit 評価

指示された blocking owner bypass ケースは、専用 test 名で直接固定した。加えて、任意扱いだった parent shared inherited child と explicit private child の memory retrieval も同じ test file に追加した。

## 未対応・制約・リスク

- この追加では `retrieve-memory.ts` 本体には差分を入れていない。現 head では既に group scope first の実装だったため。
- `npm run test -w @memorag-mvp/api -- retrieve-memory` と `--test-name-pattern` は、API test script の glob と合わせて API test 全体を実行する形になった。専用 test だけは `tsx --test apps/api/src/chat-orchestration/nodes/retrieve-memory.test.ts` で個別確認した。
- CI はこの作業 commit push 後に再確認する。
