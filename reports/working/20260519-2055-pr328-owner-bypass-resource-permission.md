# PR #328 owner bypass / resource permission 追修正レポート

## 受けた指示

PR #328 head `66704eaca87977940d51f795a1a2af7368bed8f9` について、再レビューで指摘された group scoped document の owner bypass と Web の resource-level permission 不足を、落ちるテストとして追加したうえで実装修正し、再検証する。

## 要件整理

- group scoped document は `metadata.ownerUserId` より所属 folder の実効権限を優先する。
- read 権限なしの owner は一覧、preview、search results / diagnostics に対象文書を見られない。
- full 権限なしの owner は delete / reindex を実行できない。
- Web の delete / reindex は all view でも文書行ごとの所属 folder permission で制御する。
- 共有更新は selected folder ではなく share target group の full permission を要求する。
- inherit 作成時は `managerUserIds` を送らず、UI 入力も不可にする。
- CI failure の `docs:web-inventory:check` を修正する。

## 検討・判断

group scope の文書は folder resource permission が主権限であり、owner bypass は personal / non-group scope に限定した。複数 group 所属文書の manage は、既存設計どおり全 group が full の場合だけ許可する。Search 側にも独自の manifest ACL があるため、service 側と同じ優先順位へ揃えた。

Web は feature permission を残しつつ、row document / share target group / inherit 状態の resource permission を追加した。disabled 表示だけでなく click/submit handler でも同じ条件で止めるようにした。

## 実施作業

- `apps/api/src/rag/memorag-service.test.ts` に owner bypass read/manage/search の回帰テストを追加。
- `apps/api/src/rag/memorag-service.ts` の `canAccessManifest()` / `canManageManifest()` を group scope 優先へ修正。
- `apps/api/src/search/hybrid-search.ts` の manifest ACL を group scope 優先へ修正。
- `apps/web/src/features/documents/components/DocumentWorkspace.test.tsx` に all view row permission、share target permission、inherit manager 制御のテストを追加。
- `DocumentWorkspace` / `DocumentFilePanel` / `DocumentDetailPanel` を resource permission 単位の guard に修正。
- `npm run docs:web-inventory` で generated Web inventory docs を更新。
- CI の Web lint failure を確認し、`canSubmitShare` へ集約後に残っていた未使用 prop `shareTargetGroupId` を削除。
- 未使用 prop 削除後に Web inventory が再度 stale になったため、generated docs を再更新。

## 成果物

- API owner bypass 防止の回帰テストと実装。
- Search mode=all の owner-owned unauthorized group document 混入防止。
- Web all view の per-document delete / reindex guard。
- Web 共有更新の share target group guard。
- Web inherit 作成時の manager payload 抑止。
- Web inventory generated docs 更新。

## 検証

- pass: `./node_modules/.bin/tsx --test apps/api/src/rag/memorag-service.test.ts --test-name-pattern "ownerUserId without folder|owner to delete|owner-owned group scoped"`
- pass: `npm run test -w @memorag-mvp/web -- DocumentWorkspace`
- pass: `npm run docs:web-inventory:check`
- pass: `npm run typecheck -w @memorag-mvp/api`
- pass: `npm run typecheck -w @memorag-mvp/web`
- pass: `npm exec -- eslint apps/web --cache --cache-location .eslintcache-web --max-warnings=0`
- pass: `npm run docs:web-inventory:check`（lint fix 後に再実行）
- pass: `npm run test -w @memorag-mvp/api`
- pass: `npm run docs:openapi:check -w @memorag-mvp/api`
- pass: `git diff --check`

## 指示への fit 評価

要求された 6 件の regression test を追加し、現行実装で落ちる想定だった箇所を API/Web ともに実装修正した。CI failure として確認した Web inventory stale も生成物更新で解消した。

## 未対応・制約・リスク

- Playwright E2E は未実施。今回の Web regression は Vitest の component test で固定した。
- GitHub Actions の最終結果は lint fix push 後に再確認する必要がある。
