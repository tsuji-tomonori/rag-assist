# admin usage breakdown UI 作業完了レポート

## 受けた指示

- `.workspace/plan-060101.txt` の usage / cost 実装計画を満たすため、未充足箇所を継続して実装・検証する。
- 実施した検証と未検証事項を区別し、完了条件を満たしていない外部検証は完了扱いにしない。

## 要件整理

- API に追加した feature / model / group breakdown を Web 管理 UI でもユーザーが確認できる必要がある。
- 既存のユーザー別 table と summary 表示は維持し、追加情報として compact に表示する。

## 検討・判断

- Usage / Cost タブの既存 `AdminUsagePanel` 内に、機能別・モデル別・グループ別の 3 列 breakdown を追加した。
- 表示は上位 5 件に絞り、長い model id / feature id は折り返し可能にした。
- 計測状態は既存の actual / estimated / missing 表示 helper を再利用し、API と同じ completeness semantics を保った。

## 実施作業

- Web `UsageSummaryResponse` 型に `breakdowns` と `UsageSummaryBreakdown` を追加。
- `AdminUsagePanel` に breakdown list を追加。
- `admin.css` に responsive な breakdown grid / item styling を追加。
- AdminWorkspace / useAdminData / App test fixtures を新 response contract に更新。
- Usage / Cost タブのテストに breakdown 表示 assertion を追加。

## 成果物

- `apps/web/src/features/admin/types.ts`
- `apps/web/src/features/admin/components/panels/AdminUsagePanel.tsx`
- `apps/web/src/styles/features/admin.css`
- `apps/web/src/features/admin/components/AdminWorkspace.test.tsx`
- `apps/web/src/features/admin/hooks/useAdminData.test.ts`
- `apps/web/src/App.test.tsx`

## 検証

- `npm run typecheck -w @memorag-mvp/web`: pass
- `npm run test -w @memorag-mvp/web -- src/features/admin/hooks/useAdminData.test.ts src/features/admin/components/AdminWorkspace.test.tsx`: fail（追加表示により既存 text query が複数一致）-> assertion 修正後 pass（17 件）
- `npm run test -w @memorag-mvp/web -- src/app/hooks/useAppShellState.test.ts src/App.test.tsx`: pass（45 件）
- `git diff --check`: pass

## Fit 評価

- 計画で求められていた機能別・モデル別・ユーザー別・グループ別集計のうち、API response に加えて Web 管理 UI でも確認できる状態にした。
- 架空値や demo fallback は追加せず、API response に含まれる breakdown のみを表示する。

## 未対応・制約・リスク

- 実 AWS Bedrock / DynamoDB での provider usage 永続化は未検証。
- 実 S3 への admin export 保存と署名付き URL の動作は未検証。
- Worktree Task PR Flow の commit / push / PR 作成 / PR コメント / task done 移動は未実施。
