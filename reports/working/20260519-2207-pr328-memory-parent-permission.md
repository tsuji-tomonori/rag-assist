# PR #328 memory retrieval / parent permission 追修正レポート

## 受けた指示

PR #328 head `16fa045b49e6917d5c2cad796acc72fe3be36e1d` に対する再レビュー指摘として、chat memory retrieval の group scoped document owner bypass、Web の create/move parent permission、folder API invalid input の 500 化リスクを修正し、テストと検証を行う。

## 要件整理

- memory retrieval でも group scoped document は `ownerUserId` より folder permission を優先する。
- memory card から source chunk へ展開する直前にも manifest の folder permission を再確認する。
- Web の新規フォルダ作成は selected folder ではなく、指定 parent folder の full permission で制御する。
- Web の folder move は移動元 full と移動先 parent full の両方を要求する。
- folder API の parent missing / self parent / descendant move は route で 400 にする。
- 変更範囲に応じた API/Web/docs/lint/typecheck を再実行する。

## 検討・判断

memory retrieval は chat の通常経路で実行されるため、`memorag-service.ts` / `hybrid-search.ts` と同じ ACL 順序へ揃えた。`search-evidence.ts` は memory hit を source chunk に展開する二段目の経路なので、defense-in-depth として同じ manifest ACL を再適用した。

Web は feature permission と resource permission を分離し、root 作成は feature permission があれば可能、parent 配下作成や move は target parent の full permission を要求する形にした。route error mapping は service が既知の validation error として投げる文字列を 400 対象へ追加した。

## 実施作業

- `apps/api/src/chat-orchestration/nodes/retrieve-memory.ts` の `canAccessManifest()` を group scope 優先に修正。
- `apps/api/src/chat-orchestration/nodes/search-evidence.ts` に memory source expansion 前の manifest ACL 再確認を追加。
- `apps/api/src/chat-orchestration/nodes/node-units.test.ts` に owner-owned group scoped memory hit / expansion の除外テストを追加。
- `apps/web/src/features/documents/components/DocumentWorkspace.tsx` の create/move submit 条件を target parent permission ベースに修正。
- `DocumentWorkspace.test.tsx` に readOnly parent create、readOnly selected root create、readOnly parent move の回帰テストを追加。
- `apps/api/src/routes/document-routes.ts` と `apps/api/src/contract/api-contract.test.ts` を更新し、folder API invalid input の 400 化を固定。
- Web inventory generated docs を更新。

## 成果物

- memory retrieval / memory source expansion の owner bypass 防止。
- Web create/move の parent resource permission guard。
- folder API invalid input の 400 mapping。
- API/Web 回帰テストと generated docs 更新。

## 検証

- pass: `./node_modules/.bin/tsx --test apps/api/src/chat-orchestration/nodes/node-units.test.ts --test-name-pattern "query nodes handle memory"`
- pass: `npm run test -w @memorag-mvp/web -- DocumentWorkspace`
- pass: `npm run typecheck -w @memorag-mvp/api`
- pass: `npm exec -- eslint apps/web --cache --cache-location .eslintcache-web --max-warnings=0`
- pass: `npm run typecheck -w @memorag-mvp/web`
- pass: `npm run docs:web-inventory:check`
- pass: `npm run test -w @memorag-mvp/api`
- pass: `npm run docs:openapi:check -w @memorag-mvp/api`
- pass: `git diff --check`

## 指示への fit 評価

再レビューの blocker である memory retrieval owner bypass は修正し、memory source expansion の再認可も追加した。High / Medium の Web parent permission と route 400 mapping も同じ作業範囲で対応した。

## 未対応・制約・リスク

- Playwright E2E は未実施。今回の UI regression は `DocumentWorkspace` の component test で固定した。
- `./node_modules/.bin/tsx --test apps/api/src/contract/api-contract.test.ts --test-name-pattern "HTTP contract"` を repo root から直接実行した試行は cwd 前提の違いで失敗した。正規の workspace test では API 全体 283 件が pass している。
- GitHub Actions の最終結果は push 後に確認する必要がある。
