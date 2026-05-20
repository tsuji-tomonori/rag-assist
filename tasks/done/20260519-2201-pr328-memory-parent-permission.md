# PR #328 memory retrieval / parent permission 追修正

- 状態: done
- タスク種別: 修正
- 対象 PR: #328
- 現行 head: `16fa045b49e6917d5c2cad796acc72fe3be36e1d`

## 背景

PR #328 の再レビューで、`memorag-service.ts` / `hybrid-search.ts` の group scoped document owner bypass は解消済みだが、chat memory retrieval 経路の `retrieve-memory.ts` に同じ bypass が残っていると指摘された。通常 chat は memory retrieval を有効にするため、RAG 回答経路の認可境界として merge 前に修正が必要。

あわせて Web の新規フォルダ作成・移動先 parent permission が selected folder に引きずられている点、folder API の invalid input が route で 400 にならず 500 化し得る点も指摘された。

## なぜなぜ分析サマリ

- confirmed: `retrieve-memory.ts` の `canAccessManifest()` は `ownerUserId` を group permission より先に許可している。
- confirmed: `search-evidence.ts` の `expandMemorySourceChunks()` は memory card から source chunk へ展開するときに manifest の folder permission を再確認していない。
- confirmed: Web の create submit guard は `canWriteSelectedFolder` に依存し、実際の parent target permission を見ていない。
- confirmed: Web の edit/move submit guard は移動先 parent の full permission を見ていない。
- confirmed: route helper `isDocumentGroupInputError()` は parent missing / self parent / descendant move を 400 対象に含めていない。
- root cause: document group resource permission の適用点が service/search/UI の主要経路へ段階的に広がった一方、memory retrieval と parent target 操作の副経路が同じ基準へ統一されていなかった。
- remediation: memory retrieval と memory source expansion を service/search と同じ ACL に揃え、Web create/move は target parent full を見る。route の input error mapping も service の既知 validation error と同期する。

## 受け入れ条件

- [x] API/chat: memory retrieval でも owner-owned group scoped document が folder permission none のユーザーに出ない。
- [x] API/chat: memory card から source chunk 展開する直前にも folder permission が再確認される。
- [x] Web: readOnly parent を選んだ新規フォルダ作成は disabled で `onCreateGroup` を呼ばない。
- [x] Web: selected folder が readOnly でも parent 未指定の root 作成は feature permission があれば可能。
- [x] Web: full source folder を readOnly parent 配下へ移動する更新は disabled で `onShareGroup` を呼ばない。
- [x] API route: parent missing / self parent / descendant move の document group input error は 400 扱いになる。
- [x] 変更範囲に応じた API / Web / docs inventory / lint 検証が pass する。

## 実装計画

- `retrieve-memory.ts` の manifest ACL を group scope 優先へ修正する。
- `search-evidence.ts` の memory source chunk 展開で manifest 再認可を追加する。
- `memorag-service.test.ts` または chat orchestration test に memory retrieval owner bypass の回帰テストを追加する。
- `DocumentWorkspace` の create/move submit 可否を parent target permission へ分離し、テストを追加する。
- `document-routes.ts` の input error mapping に既知の parent/move validation error を追加し、route test を追加または既存 contract で確認する。

## 検証計画

- `./node_modules/.bin/tsx --test apps/api/src/rag/memorag-service.test.ts --test-name-pattern "memory retrieval|owner-owned group scoped"`
- `npm run test -w @memorag-mvp/web -- DocumentWorkspace`
- `npm exec -- eslint apps/web --cache --cache-location .eslintcache-web --max-warnings=0`
- `npm run typecheck -w @memorag-mvp/api`
- `npm run typecheck -w @memorag-mvp/web`
- `npm run docs:web-inventory:check`
- `npm run test -w @memorag-mvp/api`
- `npm run docs:openapi:check -w @memorag-mvp/api`
- `git diff --check`

## ドキュメント保守

OpenAPI schema 変更は予定しない。Web inventory generated docs が stale になった場合は同じ PR branch で更新する。

## PR レビュー観点

- memory retrieval と memory source expansion が service/search と同じ group scope ACL を使うこと。
- Web create/move の UI guard と handler guard が target parent permission に基づくこと。
- route の 400 mapping が service validation error と同期していること。

## 実施結果

- `retrieve-memory.ts` の manifest ACL を group scope 優先へ修正した。
- `search-evidence.ts` の memory source chunk 展開前に manifest の folder permission 再確認を追加した。
- chat orchestration node test に owner-owned group scoped memory hit / memory source expansion の漏えい防止ケースを追加した。
- Web の新規フォルダ作成を selected folder ではなく target parent permission で制御するようにした。
- Web の folder move を移動元 full と移動先 parent full の両方で制御するようにした。
- route の document group input error mapping に parent missing / self parent / descendant move を追加した。
- Web inventory generated docs を再生成した。

## 検証結果

- pass: `./node_modules/.bin/tsx --test apps/api/src/chat-orchestration/nodes/node-units.test.ts --test-name-pattern "query nodes handle memory"`
- pass: `npm run test -w @memorag-mvp/web -- DocumentWorkspace`
- pass: `npm run typecheck -w @memorag-mvp/api`
- pass: `npm exec -- eslint apps/web --cache --cache-location .eslintcache-web --max-warnings=0`
- pass: `npm run typecheck -w @memorag-mvp/web`
- pass: `npm run docs:web-inventory:check`
- pass: `npm run test -w @memorag-mvp/api`
- pass: `npm run docs:openapi:check -w @memorag-mvp/api`
- pass: `git diff --check`

## 補足

- `./node_modules/.bin/tsx --test apps/api/src/contract/api-contract.test.ts --test-name-pattern "HTTP contract"` を repo root から直接実行した試行は、contract fixture と child process の cwd 解決がずれて失敗した。正規の npm workspace test として `npm run test -w @memorag-mvp/api` を実行し、HTTP contract を含む API 全体 283 件が pass した。
