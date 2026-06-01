# admin export UI 作業完了レポート

## 受けた指示

- `.workspace/plan-060101.txt` の usage / cost 実装計画を満たすため、未充足箇所を継続して実装・検証する。
- 実施済み検証と未検証の外部動作を分けて記録する。

## 要件整理

- 計画では admin export に `pricingVersion` と `dataCompleteness` を含めることが求められている。
- API 側には admin audit / cost export route があるため、Web 側で export 未提供と表示し続けるのは実装状態と合わない。

## 検討・判断

- 既存の debug / benchmark download と同じ signed URL download pattern を使った。
- export 権限は既存の読み取り権限に合わせ、Audit は `canReadAdminAuditLog`、Cost は `canReadCosts` の場合だけ hook が実行する。
- 実 S3 signed URL の疎通はローカルテストでは確認できないため、未検証として残した。

## 実施作業

- Web `AdminExportArtifact` 型を追加。
- `createAdminAuditLogExport()` / `createCostSummaryExport()` API wrapper を追加。
- `downloadAdminAuditLogExport()` / `downloadAdminCostSummaryExport()` helper を追加。
- `useAdminData` に export handlers を追加し、`useAppShellState` と `AdminWorkspace` に配線。
- `AdminAuditPanel` / `AdminCostPanel` に download icon button を追加。
- Audit panel の文言から「export は未提供」を削除。
- AdminWorkspace / useAdminData tests を更新。

## 成果物

- `apps/web/src/features/admin/types.ts`
- `apps/web/src/features/admin/api/auditLogApi.ts`
- `apps/web/src/features/admin/api/costApi.ts`
- `apps/web/src/shared/utils/downloads.ts`
- `apps/web/src/features/admin/hooks/useAdminData.ts`
- `apps/web/src/app/hooks/useAppShellState.ts`
- `apps/web/src/features/admin/components/AdminWorkspace.tsx`
- `apps/web/src/features/admin/components/panels/AdminAuditPanel.tsx`
- `apps/web/src/features/admin/components/panels/AdminCostPanel.tsx`
- `apps/web/src/features/admin/hooks/useAdminData.test.ts`
- `apps/web/src/features/admin/components/AdminWorkspace.test.tsx`

## 検証

- `npm run typecheck -w @memorag-mvp/web`: pass
- `npm run test -w @memorag-mvp/web -- src/features/admin/hooks/useAdminData.test.ts src/features/admin/components/AdminWorkspace.test.tsx src/shared/utils/downloads.test.ts`: pass（24 件）
- `npm run test -w @memorag-mvp/web -- src/app/hooks/useAppShellState.test.ts src/App.test.tsx`: pass（45 件）
- `git diff --check`: pass

## Fit 評価

- API 実装済みの admin export を Web から操作できるようにし、plan の export 方針に近づけた。
- Cost export payload の `pricingVersion` / `dataCompleteness` は API 側の `costSummary` に含まれる前提で Web は signed URL を取得する。

## 未対応・制約・リスク

- 実 AWS/S3 に対する export object 保存と signed URL download は未検証。
- 実 AWS Bedrock / DynamoDB での provider usage 永続化は未検証。
- Worktree Task PR Flow の commit / push / PR 作成 / PR コメント / task done 移動は未実施。
