# Tenant 受け入れ証跡補完 作業レポート

- 実施日時: 2026-07-11 20:32 JST
- 状態: focused scope done
- 分類: 修正

## 受けた指示

- FR076 所有の user-group / membership store 本体には触れず、残存する tenant 受け入れ証跡を補完する。
- chat / document ingest / benchmark の DynamoDB run・event について、物理複合 key、`TenantItemIndex` の `Query`、通常 read で `Scan` しない契約をテストする。
- benchmark service / route で同一 raw ID の tenant 分離と、cross-tenant / absent ID の非列挙 response 同値性を listener なしで検証する。
- IaC の `TenantItemIndex` と benchmark state machine の `storageRunId` を snapshot と明示 assertion で検証する。
- migration/backfill、tenant storage、benchmark artifact の運用手順と requirements coverage / static policy を更新する。
- focused test、typecheck、diff check を行い、commit / push / PR は行わない。

## Done 条件

- tenant が異なる同一 raw run ID が異なる物理 key へ保存されることを executable test で確認できる。
- tenant 一覧が `TenantItemIndex` の `Query` を使い、対象契約テストで `Scan` がない。
- benchmark の read/cancel/download/log が cross-tenant と absent で同一 404 profile を返し、別 tenant の状態を変えない。
- synthesized IaC で4 table の `TenantItemIndex` と、benchmark の3 state update の `$.storageRunId` 利用を確認できる。
- tenant 不明の backfill が fail-closed となり、安全な copy/verify/cutover/rollback 手順が文書化されている。
- focused validations が全て成功し、残存制約が明記されている。

## 原因分析

tenant-aware 実装自体は存在していたが、個別の受け入れ条件を固定するテスト、IaC snapshot の明示 assertion、legacy data の移行手順が分散・不足していた。この状態では、raw ID key への退行、tenant list の `Scan` 化、state machine の raw ID 更新、旧 artifact prefix fallback が入っても、要件単位で検知しにくい。対策として command-level store 契約、listener なし route 契約、synthesized template 契約、fail-closed dry-run、運用手順を同じ tenant 境界へ接続した。

## 実施作業

- `dynamodb-tenant-run-stores.test.ts` を追加し、chat / document ingest / benchmark run の同一 raw ID を2 tenant で保存した場合の物理 key と tenant index attribute を検証した。
- chat / document ingest event の append/list が tenant 複合 run key を使い、`Query` のみで取得することを検証した。
- `benchmark-tenant-boundary.test.ts` を追加し、service と Hono route を in-memory で実行して同一 raw ID の tenant 分離と、get/cancel/download/log の非列挙 response 同値性を検証した。
- benchmark route の認可 metadata を `tenantCollection` / `tenantRun` とし、resource route を `resource-hidden` profile へ登録した。静的 operation matrix と FR-057 / FR-060 / FR-091 coverage へ新規証跡を追加した。
- IaC test に、`BenchmarkRunsTable`、`ChatRunsTable`、`DocumentIngestRunsTable`、`DocumentGroupsTable` の `TenantItemIndex`、benchmark state machine の3つの物理 key update、`STORAGE_RUN_ID` / `TENANT_ID` 引き渡し assertion を追加した。
- synthesized CloudFormation snapshot を更新した。
- document group dry-run を、authoritative tenant 欠落、missing parent、duplicate raw ID、parent cycle で `canApply=false` にする fail-closed 処理へ変更した。物理 group/path-lock key と tenant index field を report に追加し、正常系・tenant 欠落系のテストを追加した。
- `docs/OPERATIONS.md` に export/PITR、GSI active、条件付き copy、tenant Query 照合、非列挙 smoke、rollback window の順序と、benchmark / async-agent の tenant artifact prefix を記載した。
- FR076 の tenant-first interface 変更により残っていた administrative-principal-transfer の呼び出しだけを tenant-aware に修正し、store 本体には触れなかった。

## 成果物

- `apps/api/src/adapters/dynamodb-tenant-run-stores.test.ts`
- `apps/api/src/routes/benchmark-tenant-boundary.test.ts`
- `apps/api/src/authorization.ts`
- `apps/api/src/routes/benchmark-routes.ts`
- `apps/api/src/security/access-control-policy.test.ts`
- `apps/api/src/rag/requirements-coverage.test.ts`
- `apps/api/src/security/administrative-principal-transfer-service.ts`
- `apps/api/src/security/administrative-principal-transfer-service.test.ts`
- `infra/test/memorag-mvp-stack.test.ts`
- `infra/test/__snapshots__/memorag-mvp-stack.snapshot.json`
- `scripts/document-group-canonical-path-backfill.mjs`
- `scripts/document-group-canonical-path-backfill.test.mjs`
- `docs/OPERATIONS.md`

## 検証結果

すべて成功した。

- `node --import tsx --test src/adapters/dynamodb-tenant-run-stores.test.ts`
- `node --import tsx --test src/adapters/tenant-scoped-run-stores.test.ts`
- `node --import tsx --test src/routes/benchmark-tenant-boundary.test.ts`
- `node --import tsx --test src/security/administrative-principal-transfer-service.test.ts`
- `node --import tsx --test src/security/access-control-policy.test.ts`
- `node --import tsx --test src/rag/requirements-coverage.test.ts`
- `npm run typecheck` (`apps/api`)
- `node --test scripts/document-group-canonical-path-backfill.test.mjs`
- `npm run typecheck` (`infra`)
- `UPDATE_SNAPSHOTS=1 node --import tsx --test test/memorag-mvp-stack.test.ts`
- `node --import tsx --test test/memorag-mvp-stack.test.ts`（更新後 snapshot 再現）
- 変更ファイル対象 ESLint（既存 root install の実行ファイルを使用）
- `npm run docs:hidden-unicode:check`
- `git diff --check`

途中で static policy test が、追加した `resource-hidden` route をレビュー済み集合へ未登録として1回失敗した。benchmark の4 resource route を集合へ追加後に再実行して成功した。IaC snapshot は旧期待値との差分を確認後に更新し、環境変数なしの再実行で一致を確認した。targeted ESLint の初回は worktree 直下に binary がなく command resolution で失敗したため、既存 main worktree の同一 dependency binary を絶対 path で使用して成功した。

## 指示への fit 評価

- FR076 store 本体を変更せず、担当境界を維持した。
- DynamoDB、route/service、IaC、移行運用、静的 trace の各受け入れ条件を executable evidence へ接続した。
- listener、live AWS、production migration は起動していない。
- 指示どおり commit、push、PR 作成は行っていない。

## 未対応・制約・リスク

- production data の export/backfill/cutover は不可逆性と外部状態変更を伴うため未実施。今回の script は local document-group export の dry-run report までで、AWS 適用は運用手順に従う別作業である。
- live DynamoDB / Step Functions / S3 の integration smoke は未実施。証跡は adapter command、in-memory route、CDK synth snapshot である。
- shared worktree 全体の full suite / CI は、この focused handoff では待機・実行していない。担当範囲の package typecheck と focused tests は成功している。
- generated OpenAPI はこの focused scope では再生成していない。認可 metadata の source と static policy は同期済みであり、統合作業の既定 docs generation で反映する。
- worktree には他 agent の並行変更が多数あり、snapshot は現在の統合 stack 全体を反映する。commit 前に統合 owner が最終差分を再確認する必要がある。
