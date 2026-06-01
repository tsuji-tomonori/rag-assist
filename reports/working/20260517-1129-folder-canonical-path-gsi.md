# folder canonical path / GSI 一意性 実装レポート

## 受けた指示

- `DocumentGroup` に canonical path と管理者単位一意性を追加する。
- GSI 設計まで含め、`AdminCanonicalPathIndex` と transaction lock item による重複拒否を実装する。
- API / Web / OpenAPI / infra snapshot / docs を同期し、API test、Web test、typecheck、OpenAPI check、CDK test、`git diff --check` を通す。

## 要件整理

- 一意性の単位は `tenantId + adminPrincipalType + adminPrincipalId + normalizedCanonicalPath`。
- GSI は lookup / 検証用途であり、一意性保証は同一 DynamoDB table 内の `documentGroupPathLock` item と `TransactWriteItems` で行う。
- legacy group は読み込み時に補完し、既存 ACL、RAG 検索範囲、文書 upload scope の権限境界を維持する。
- 大きな subtree move は DynamoDB transaction 25 item 制限に当たるため、初回は同期更新上限を設ける。

## 実施作業

- `DocumentGroup` 型、API schema、Web type に canonical path 系フィールド、admin principal、GSI key、schema version を追加。
- service 層に name/path 正規化、legacy 補完、create / rename / move の重複検証、subtree path 再計算を追加。
- Local store に path lock 相当の保存と重複拒否を追加。
- DynamoDB store に `createWithPathLock`、`updateWithPathLocks`、`listByAdminPath`、`findByCanonicalPath` を追加し、transaction lock item を実装。
- CDK の `DocumentGroupsTable` に `AdminCanonicalPathIndex` を追加し、assertion と snapshot を更新。
- dry-run 専用の `scripts/document-group-canonical-path-backfill.mjs` と npm script を追加。
- Web folder tree で canonical path を表示・検索対象に反映し、生成 OpenAPI / Web inventory / Infra inventory / 設計 docs を更新。

## 成果物

- 実装: `apps/api/src/rag/memorag-service.ts`, `apps/api/src/adapters/*document-group-store.ts`, `infra/lib/memorag-mvp-stack.ts`
- UI/type: `apps/web/src/features/documents/*`
- migration 支援: `scripts/document-group-canonical-path-backfill.mjs`
- docs: `docs/generated/openapi/*`, `docs/generated/infra-inventory/*`, `docs/generated/web-*`, `docs/3_設計_DES/*`
- task: `tasks/do/20260517-1103-folder-canonical-path-gsi.md`

## 検証

- `npm run test -w @memorag-mvp/api`: pass
- `npm run test -w @memorag-mvp/web`: pass
- `npm run typecheck --workspaces --if-present`: pass
- `npm run docs:openapi:check`: pass
- `npm run docs:web-inventory:check`: pass
- `npm run docs:infra-inventory:check`: pass
- `task cdk:test`: pass
- `npm run document-groups:canonical-path:dry-run`: pass
- `git diff --check`: pass

## fit 評価

- 指示された canonical path fields、GSI、transaction lock item、Local store 制約、legacy 補完、subtree 再計算、schema/docs 同期、検証コマンドに対応した。
- `ParentFolderIndex` は今回の API / UI が parent query を利用しないため未追加。task md に明示済み。
- 本番 migration apply は未実施。dry-run report と duplicate detection までを今回の範囲にした。

## 未対応・制約・リスク

- 既存 table への GSI 追加は deploy 時に AWS 側 backfill が走るため、production deploy 前に dry-run duplicate report の確認が必要。
- subtree move は同期 transaction 上限を超える場合に 400 相当の入力エラーとして拒否する。大規模移動の async migration は後続 task。
- backfill script は dry-run 専用で、自動修復や apply は実装していない。
