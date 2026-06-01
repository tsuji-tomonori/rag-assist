# PR331 legacy ledger fallback と分散競合修正

状態: done

## 背景

PR #331 の再レビューで、per-document grant file が `grants: []` の場合に旧 global ledger へ fallback し、削除済み direct grant が復活し得る P0 が指摘された。あわせて、同一 document share replacement の競合検出が in-process guard に閉じており、分散実行では silent last-write-wins になり得る P1 と、PUT share の 409 response が OpenAPI にない P2 が指摘された。

## 目的

legacy global ledger 互換を維持しつつ、per-document file の存在と空 grants を区別する。さらに ObjectStore に versioned read / conditional put を追加し、別 instance の同一 document share replacement 競合を 409 相当にする。audit append は conflict retry で両方の entry を残す。

## チェックリスト

- [x] per-document grant file missing の場合だけ legacy global ledger へ fallback する。
- [x] per-document grant file が `grants: []` の場合は空 grants を正として扱う。
- [x] per-document grant file が legacy と異なる grants を持つ場合は per-document 側だけを返す。
- [x] ObjectStore に `getTextWithVersion` / `putTextIfVersion` を追加する。
- [x] LocalObjectStore / S3ObjectStore に conditional write 実装を追加する。
- [x] 既存 test fixture の ObjectStore wrapper 互換 fallback を service 側に入れる。
- [x] multi-instance share replacement conflict test を追加する。
- [x] multi-instance audit append retry test を追加する。
- [x] PUT `/documents/{documentId}/share` の OpenAPI 409 response を追加する。
- [x] 関連 lint / typecheck / test / coverage / docs check / build を実行する。
- [x] 作業レポート、commit、push、PR コメントを更新する。

## 受け入れ条件

- AC-LEGACY-001: legacy global ledger に grant があり per-document file がない場合、legacy grant が読める。
- AC-LEGACY-002: legacy global ledger に grant があっても per-document `grants: []` があれば direct grants は空になる。
- AC-LEGACY-003: legacy global ledger と per-document grants が両方ある場合、per-document grants だけが返る。
- AC-CONFLICT-001: serviceA / serviceB の別 instance が同一 tenant/document の同一 revision を更新すると片方だけ成功し、片方は `DocumentShareConflictError` になる。
- AC-CONFLICT-002: serviceA / serviceB の別 instance が同一 tenant/document に audit append しても両方の entry が残る。
- AC-OPENAPI-001: PUT `/documents/{documentId}/share` の OpenAPI responses に 409 が含まれる。

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

## 未対応・制約

- E2E smoke は未実行。
- GitHub Actions head commit green は push 後の GitHub 側確認が必要。
- S3 conditional write は object ETag / conditional headers を利用する。S3 以外の ObjectStore 実装が増える場合は同 interface の実装が必要。
