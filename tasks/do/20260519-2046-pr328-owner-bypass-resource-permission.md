# PR #328 owner bypass / resource permission 追修正

- 状態: in_progress
- タスク種別: 修正
- 対象 PR: #328
- 現行 head: `66704eaca87977940d51f795a1a2af7368bed8f9`

## 背景

PR #328 の再レビューで、group scoped document の `ownerUserId` が folder permission を bypass している問題と、Web の操作可否が document / share target 単位ではなく scalar permission に残っている問題が指摘された。仕様上は、group scoped document の read/manage は所属 folder の実効権限で制御し、readOnly 未満は一覧・検索・citation に出さず、削除・再インデックス・共有は full を必須にする必要がある。

CI では最新 head `66704eac` の MemoRAG CI が `npm run docs:web-inventory:check` で failure になっている。

## なぜなぜ分析サマリ

- confirmed: `canAccessManifest()` / `canManageManifest()` は `metadata.ownerUserId === user.userId` を group permission 判定より先に許可している。
- confirmed: `hybrid-search.ts` 側にも同等の manifest ACL 判定があり、mode=all 検索の visible manifest 選定に影響する。
- confirmed: Web の `DocumentFilePanel` は `canDelete` / `canReindex` を scalar boolean として受け取り、all view で mixed permission document を行単位に制御できない。
- confirmed: 共有フォームは `shareTargetGroupId` を切り替えられる一方、submit 可否は selected folder の `canWriteSelectedFolder` に依存している。
- confirmed: inherit 作成時も `managerUserIds` 入力が payload に含まれ、API 側で explicit policy と判定されうる。
- root cause: feature permission と resource permission の分離を API/Web の一部経路に適用しきれておらず、document scope と folder scope の優先順位が曖昧だった。
- remediation: group scoped document では owner bypass を無効にし、read は any readable group、manage は all full group を必須にする。Web では row document / share target / inherit 状態の resource permission をテストで固定する。

## 受け入れ条件

- [x] API: group scoped document owner は folder read 権限なしなら `listDocuments()` と parsed preview で対象文書にアクセスできない。
- [x] API: group scoped document owner は folder full 権限なしなら delete authorization / reindex stage が拒否され、migration が作られない。
- [x] API/Search: mode=all 検索でも folder permission none の owner-owned group scoped document が results / diagnostics に出ない。
- [x] Web: all view では full/readOnly 混在時に readOnly document の delete / reindex が disabled になり handler が呼ばれない。
- [x] Web: 共有更新は selected folder ではなく share target group の full permission を要求する。
- [x] Web: inherit 作成時は `managerUserIds` を送らない、または入力不可にする。
- [x] 最新 CI failure の `docs:web-inventory:check` を再現・修正し、関連 check を通す。

## 実装計画

- `apps/api/src/rag/memorag-service.test.ts` に owner bypass read/manage の赤テストを追加する。
- `apps/api/src/search/hybrid-search.test.ts` または service search test に mode=all 漏えい防止テストを追加する。
- API の manifest access/manage 判定を、group scoped document では folder permission 優先に修正する。
- `DocumentWorkspace.test.tsx` に all view row permission、share target permission、inherit manager 制御のテストを追加する。
- `DocumentWorkspace` / `DocumentFilePanel` / `DocumentDetailPanel` の props と handler guard を row/target/resource 単位に修正する。
- `docs:web-inventory:check` の failure を再現し、必要な生成 inventory 更新または実装調整を行う。

## 検証計画

- `./node_modules/.bin/tsx --test apps/api/src/rag/memorag-service.test.ts --test-name-pattern "ownerUserId without folder|owner to delete|owner-owned group scoped"`
- `npm run test -w @memorag-mvp/web -- DocumentWorkspace`
- `npm run docs:web-inventory:check`
- `npm run typecheck -w @memorag-mvp/api`
- `npm run typecheck -w @memorag-mvp/web`
- `npm run test -w @memorag-mvp/api`
- `npm run docs:openapi:check -w @memorag-mvp/api`
- `git diff --check`

## ドキュメント保守

API/Web の認可境界修正であり、OpenAPI schema 追加は予定しない。Web inventory check が generated docs を要求する場合は同じ PR branch で更新する。仕様文書の追加更新が必要かは差分確認後に判断する。

## PR レビュー観点

- group scoped document で owner bypass が personal/non-group scope にだけ残っていること。
- multiple group document の manage が全 group full を要求していること。
- search results / diagnostics に unauthorized document identifier や本文が混入しないこと。
- Web の disabled と handler guard が同じ resource permission に基づくこと。

## 実施結果

- `canAccessManifest()` / `canManageManifest()` と `hybrid-search.ts` の manifest ACL を、group scoped document では folder permission 優先に修正した。
- `memorag-service.test.ts` に owner bypass read/manage/search の回帰テストを追加した。
- `DocumentFilePanel` の delete / reindex を文書行ごとの所属 folder permission で制御するようにした。
- 共有更新の submit 可否を share target group の full permission に切り替えた。
- inherit 作成時は manager user IDs を disabled とし、payload に含めないようにした。
- CI 失敗箇所の Web inventory generated docs を再生成した。

## 検証結果

- pass: `./node_modules/.bin/tsx --test apps/api/src/rag/memorag-service.test.ts --test-name-pattern "ownerUserId without folder|owner to delete|owner-owned group scoped"`
- pass: `npm run test -w @memorag-mvp/web -- DocumentWorkspace`
- pass: `npm run docs:web-inventory:check`
- pass: `npm run typecheck -w @memorag-mvp/api`
- pass: `npm run typecheck -w @memorag-mvp/web`
- pass: `npm run test -w @memorag-mvp/api`
- pass: `npm run docs:openapi:check -w @memorag-mvp/api`
- pass: `git diff --check`

## 残リスク

- Playwright E2E は今回の scoped regression では未実施。row-level guard は Vitest で固定した。
