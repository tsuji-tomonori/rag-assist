# PR331 legacy ledger fallback と分散競合修正 作業レポート

## 受けた指示

PR #331 の再レビュー指摘に対し、legacy global ledger fallback による削除済み direct grant 復活、分散実行時の同一 document share replacement 競合、PUT share 409 の OpenAPI 不整合を修正する。

## 要件整理

- per-document grant file が存在しない場合だけ legacy global ledger を読む。
- per-document grant file が `grants: []` の場合は共有解除済みとして扱い、legacy grant を復活させない。
- 同一 tenant/document の share replacement は別 service instance 間でも expected version mismatch を検出する。
- 同一 tenant/document の audit append は同時実行でも両方の entry を残す。
- runtime で返す 409 を OpenAPI responses に明記する。

## 実施作業

- `ObjectStore` に `getTextWithVersion` / `putTextIfVersion` を追加した。
- `LocalObjectStore` は content hash を version とし、key 単位 queue で conditional write を判定するようにした。
- `S3ObjectStore` は ETag と conditional headers を使う versioned read / conditional put を追加した。
- `DocumentPermissionService` は per-document grant file の missing と empty を区別するようにした。
- `replaceDocumentShareGrants` は expected version 付き conditional write に変更し、競合時は `DocumentShareConflictError` を返すようにした。
- `appendDocumentAudit` は conditional write conflict 時に再読込 retry し、同時 append の片方が消えないようにした。
- 既存 test fixture の ObjectStore wrapper 互換のため、service 内に versioned read / conditional put fallback を追加した。
- PUT `/documents/{documentId}/share` の route responses に 409 を追加し、OpenAPI Markdown を再生成した。
- legacy fallback、multi-instance conflict、multi-instance audit append、OpenAPI 409 のテストを追加した。

## 成果物

- `apps/api/src/adapters/object-store.ts`
- `apps/api/src/adapters/local-object-store.ts`
- `apps/api/src/adapters/s3-object-store.ts`
- `apps/api/src/documents/document-permission-service.ts`
- `apps/api/src/documents/document-permission-service.test.ts`
- `apps/api/src/routes/document-routes.ts`
- `apps/api/src/security/access-control-policy.test.ts`
- `docs/generated/openapi/put-documents-documentid-share.md`
- `tasks/done/20260521-2337-pr331-legacy-ledger-conflict.md`

## 検証結果

- pass: `npm exec -w @memorag-mvp/api -- tsx --test src/documents/document-permission-service.test.ts src/security/access-control-policy.test.ts`
- pass: `npm run typecheck -w @memorag-mvp/api`
- pass: `npm exec -- eslint apps/api --cache --cache-location .eslintcache-api --max-warnings=0`
- pass: `npm run docs:openapi:check`
- pass: `npm test -w @memorag-mvp/api`
- pass: `npm run test:coverage -w @memorag-mvp/api`
- pass: `npm run build -w @memorag-mvp/api`
- pass: `npm exec -- eslint apps/web --cache --cache-location .eslintcache-web --max-warnings=0`
- pass: `npm run docs:web-inventory:check`
- pass: `npm run typecheck -w @memorag-mvp/web`
- pass: `npm exec -w @memorag-mvp/web -- vitest run --coverage`
- pass: `npm run build -w @memorag-mvp/web`
- pass: `git diff --check`

## Fit 評価

再レビュー指摘 1-3 には対応した。legacy fallback は missing のみに限定され、空 grants による共有解除が legacy ledger で復活しない。share replacement は ObjectStore version に基づく conditional write になり、別 `DocumentPermissionService` instance の同時更新でも silent last-write-wins にならない。audit append は retry により両方の entry を保持する。

## 未対応・制約・リスク

- E2E smoke は未実行。
- GitHub Actions head commit green は未確認。
- S3 conditional write は ETag / conditional headers に依存する。将来 ObjectStore 実装を追加する場合は `getTextWithVersion` / `putTextIfVersion` の実装が必要。
