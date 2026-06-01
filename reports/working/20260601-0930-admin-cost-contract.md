# 作業完了レポート: admin cost contract 補強

## 受けた指示

- `.workspace/plan-060101.txt` の継続として、UsageEvent / admin usage / cost audit 実装の完了条件に対する不足を確認し、実装・検証まで進める。

## 要件整理

- `/admin/costs` は message 件数ベースの固定推定ではなく、UsageEvent と pricingVersion に基づく cost summary を返す。
- HTTP route / OpenAPI schema 経由でも、`pricingVersion` と `dataCompleteness` が response に残ることを確認する。

## 検討・判断

- pricing catalog の unit test と service test では、UsageEvent 由来の cost 計算と export payload は確認済みだった。
- ただし major endpoint contract では `/admin/costs` の `currency` と schema validation だけで、token usage / pricingVersion / dataCompleteness の contract が弱かった。
- 既存 major endpoint contract は `/chat` と `/chat-runs` 実行後に `/admin/usage` と `/admin/costs` を確認しているため、同じ flow 上で cost audit response の中身を固定した。

## 実施作業

- `apps/api/src/contract/api-contract.test.ts` の major endpoint contract に `/admin/costs` の assertion を追加した。
- `Bedrock / chat completion tokens` item が存在し、`usage > 0`、`estimatedCostUsd > 0`、`pricingVersion` を持つことを確認した。
- `/admin/costs.dataCompleteness` が直前の `/admin/usage.dataCompleteness` と一致することを確認した。

## 成果物

- `/admin/costs` が route / schema 経由で UsageEvent と pricingVersion に基づく cost audit summary を返す contract を補強。
- cost audit の data completeness が usage summary と同期していることを HTTP contract で固定。

## 検証

- `npm run typecheck -w @memorag-mvp/api`: pass
- `npm test -w @memorag-mvp/api -- src/contract/api-contract.test.ts`: fail（`CostAuditItem` の数量フィールドを `usageQuantity` と誤参照）-> `usage` へ修正後 pass（script 展開により API test 261 件実行）
- `git diff --check`: pass

## Fit 評価

- `.workspace/plan-060101.txt` の `/admin/costs` を UsageEvent + ModelPricing 集計へ差し替える方針について、HTTP contract-level の証跡を追加できた。
- 誤った assertion は既存 schema に合わせて修正し、失敗を残さず再実行できた。

## 未対応・制約・リスク

- 実 AWS Bedrock / DynamoDB での provider usage 永続化は未検証。
- 実 S3 への admin export 保存と署名付き URL の動作は未検証。
- PR 作成、PR コメント、task md の `tasks/done/` 移動は未実施。
- 現在の作業は既存 dirty worktree 上で継続しており、origin/main からの専用 worktree 作成フローは未完了。
