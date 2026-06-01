# admin usage breakdowns 作業完了レポート

## 受けた指示

- `.workspace/plan-060101.txt` の usage / cost 実装計画を満たすため、未充足箇所を継続して実装・検証する。
- 完了条件を満たすまで完了扱いにせず、実施した検証と未検証事項を明示する。

## 要件整理

- `/admin/usage` はユーザー別だけでなく、計画にある機能別・モデル別・グループ別の集計を返す必要がある。
- 既存の token/cost/completeness 算出と整合し、OpenAPI schema と HTTP contract test で固定する。

## 検討・判断

- `UsageEvent` を source of truth として feature / model / group の breakdown を生成した。
- group breakdown はユーザー所属 group への attribution とし、複数 group 所属時は同一 event を各 group に帰属させる。これは totals と加算一致させる目的ではなく、group 観点の利用状況把握のための内訳とした。
- deleted user は active group map から除外し、group が解決できない event は `unassigned` に集約する。

## 実施作業

- `UsageSummaryBreakdown` / `UsageSummaryBreakdowns` 型と OpenAPI schema を追加。
- `MemoRagService.getUsageSummaryBreakdowns()` と集計 helper を追加。
- `/admin/usage` response に `breakdowns.byFeature` / `byModel` / `byGroup` を追加。
- `api-contract.test.ts` に通常 response と empty response の breakdown assertion を追加。
- OpenAPI generated docs を再生成。

## 成果物

- `apps/api/src/types.ts`
- `apps/api/src/schemas.ts`
- `apps/api/src/rag/memorag-service.ts`
- `apps/api/src/routes/admin-routes.ts`
- `apps/api/src/contract/api-contract.test.ts`
- `docs/generated/openapi.md`
- `docs/generated/openapi/get-admin-usage.md`

## 検証

- `npm run typecheck -w @memorag-mvp/api`: pass
- `npm run docs:openapi`: pass
- `../../node_modules/.bin/tsx --test src/contract/api-contract.test.ts`（`apps/api` cwd）: pass（16 件）
- `npm run docs:openapi:check`: pass
- `git diff --check`: pass
- `npm test -w @memorag-mvp/api -- src/contract/api-contract.test.ts`: fail（workspace script が全 API test を実行し、追加 assertion 初版が `feature === "chat"` 固定だったため 1 件失敗）。assertion 修正後、direct contract test は pass。

## Fit 評価

- 計画の「機能別・モデル別・ユーザー別・グループ別に集計」のうち、API response と OpenAPI contract 上の不足を補った。
- ユーザー別集計と totals の既存 response は維持し、追加 field として breakdown を返すため後方互換性を大きく崩していない。

## 未対応・制約・リスク

- 実 AWS Bedrock / DynamoDB での provider usage 永続化は未検証。
- 実 S3 への admin export 保存と署名付き URL の動作は未検証。
- Worktree Task PR Flow の commit / push / PR 作成 / PR コメント / task done 移動は未実施。
- Web UI は今回追加した breakdown をまだ表示していない。現時点では API contract の充足を優先した。
