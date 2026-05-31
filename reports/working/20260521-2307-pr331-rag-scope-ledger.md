# PR331 RAG scope と share ledger 修正 作業レポート

## 受けた指示

PR #331 `doc-ui-share-move` の再レビュー指摘に対し、Request changes 継続理由になっている RAG folder scope の direct share 混入、share ledger の lost update リスク、share validation の 500 化リスクを修正する。

## 要件整理

- RAG `mode=all` / `mode=documents` は直接 document read grant を検索対象に含める。
- RAG `mode=groups` は requested folder に対する folder read 以上を要求し、直接 document grant だけでは通さない。
- share grants / audit は global ledger ではなく tenant/document 単位で保存する。
- 別 document の share 更新は互いに消さず、同一 document の同時 replacement は競合として扱う。
- duplicate grant / 空白 principalId は validation error として 400 にする。
- E2E と GitHub Actions head green は未実行・未確認ならそのまま記録する。

## 実施作業

- `hybrid-retriever` の lexical / semantic 経路で scope 判定を permission-aware に変更した。
- `DocumentPermissionService` の share grant / audit 保存先を `documents/share-grants/{tenantId}/{documentId}.json` と `documents/share-audit/{tenantId}/{documentId}.json` に分割し、旧 `documents/share-grants.json` の読み取り互換を残した。
- 同一 document の share replacement に in-process conflict guard を追加し、同時 replacement は `DocumentShareConflictError` で検出するようにした。
- audit append は document 単位の queue で直列化し、share 更新と move audit の同時実行で audit が欠落しないようにした。
- share request validation を `DocumentShareValidationError` に寄せ、route で 400、競合は 409 を返すようにした。
- RAG scope、ledger、validation の unit / route tests を追加した。

## 成果物

- `apps/api/src/rag/online/retrieval/hybrid/hybrid-retriever.ts`
- `apps/api/src/documents/document-permission-service.ts`
- `apps/api/src/routes/document-routes.ts`
- `apps/api/src/search/hybrid-search.test.ts`
- `apps/api/src/documents/document-permission-service.test.ts`
- `apps/api/src/document-share-routes.test.ts`
- `tasks/do/20260521-2256-pr331-rag-scope-ledger.md`

## 検証結果

- pass: `npm exec -w @memorag-mvp/api -- tsx --test src/search/hybrid-search.test.ts src/documents/document-permission-service.test.ts src/document-share-routes.test.ts`
- pass: `npm run typecheck -w @memorag-mvp/api`
- pass: `npm exec -- eslint apps/api --cache --cache-location .eslintcache-api --max-warnings=0`
- pass: `npm run docs:openapi:check`
- pass: `npm test -w @memorag-mvp/api`
- pass: `npm run test:coverage -w @memorag-mvp/api`
- pass: `npm exec -- eslint apps/web --cache --cache-location .eslintcache-web --max-warnings=0`
- pass: `npm run docs:web-inventory:check`
- pass: `npm exec -w @memorag-mvp/web -- vitest run --coverage`
- pass: `npm run typecheck -w @memorag-mvp/web`
- pass: `npm run build -w @memorag-mvp/api`
- pass: `npm run build -w @memorag-mvp/web`
- pass: `git diff --check`

## Fit 評価

再レビュー指摘 1-3 の code / test 条件には対応した。RAG folder scope は core retriever 側でも folder permission を要求するため、pre-check 漏れ時にも direct share だけでは folder scope に混入しない。

## 未対応・制約・リスク

- E2E smoke は未実行。
- GitHub Actions の head commit green は push 後に GitHub 側で確認が必要。
- 同一 document share replacement の競合検出は in-process guard であり、分散実行環境での強い conditional write までは未実装。今回の保存粒度分割により別 document と audit の lost update は避けるが、将来的には object store 側の revision / etag 条件付き write が望ましい。
