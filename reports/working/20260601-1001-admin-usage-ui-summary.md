# 作業完了レポート: admin usage UI summary

## 受けた指示

- `.workspace/plan-060101.txt` の完了に向け、`/admin/usage` の UI contract を current worktree から再監査し、未固定箇所を実装・検証する。
- 実施していない外部検証や PR flow は完了扱いしない。

## 要件整理

- UI は user-level rows だけでなく、API が返す `periodStart` / `periodEnd` / `totals` / `dataCompleteness` を捨てずに表示する。
- `0`、`未計測`、`推定`、`利用なし` を区別する既存表示を維持する。
- Web hook / props / component test を API contract に同期する。

## 検討・判断

- API は `/admin/usage` で aggregate response を返すようになっていたが、Web の `listUsageSummaries()` は `users` だけを返し、集計期間・total token・estimated cost・全体 completeness を破棄していた。
- 既存の user table は維持しつつ、panel 上部に summary line を追加し、全体の token / cost / 計測状態をスキャンできるようにした。

## 実施作業

- `UsageSummaryResponse` 型と `getUsageSummary()` API を追加した。
- `useAdminData` で usage response 全体を保持し、`AdminWorkspace` から `AdminUsagePanel` へ渡すようにした。
- `AdminUsagePanel` に集計期間、total tokens、estimatedCostUsd、全体 completeness label を追加した。
- admin hook / workspace tests を更新した。

## 成果物

- `apps/web/src/features/admin/types.ts`
- `apps/web/src/features/admin/api/usageApi.ts`
- `apps/web/src/features/admin/hooks/useAdminData.ts`
- `apps/web/src/features/admin/components/AdminWorkspace.tsx`
- `apps/web/src/features/admin/components/panels/AdminUsagePanel.tsx`
- `apps/web/src/features/admin/hooks/useAdminData.test.ts`
- `apps/web/src/features/admin/components/AdminWorkspace.test.tsx`
- `apps/web/src/app/hooks/useAppShellState.ts`
- `tasks/do/20260516-1625-full-spec-gap-implementation.md`

## 検証

- `npm run typecheck -w @memorag-mvp/web`: pass
- `npm run test -w @memorag-mvp/web -- src/features/admin/hooks/useAdminData.test.ts src/features/admin/components/AdminWorkspace.test.tsx`: fail（summary と user row の同一文言に対する単一 query）-> assertion 修正後 pass（17 件）
- `npm run test -w @memorag-mvp/web -- src/app/hooks/useAppShellState.test.ts src/App.test.tsx`: pass（45 件）
- `git diff --check`: pass

## fit 評価

- `.workspace/plan-060101.txt` の UsageSummaryResponse 方針に沿って、Web UI が API aggregate contract を保持・表示するようになった。
- user 行と aggregate 行の両方で推定・一部未計測・未計測または利用なしを区別できる。

## 未対応・制約・リスク

- 実 AWS Bedrock / DynamoDB での provider usage 永続化は未検証。
- 実 S3 への admin export 保存と署名付き URL の動作は未検証。
- Worktree Task PR Flow の commit / push / PR 作成 / PR コメント / task done 移動は未実施。
