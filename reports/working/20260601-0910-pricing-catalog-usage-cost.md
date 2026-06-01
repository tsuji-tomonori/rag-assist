# Pricing catalog usage cost work report

## 受けた指示

- `.workspace/plan-060101.txt` の admin usage / cost 計画を継続し、コスト計算を `UsageEvent × PricingCatalog` に近づける。
- 実施していない検証や PR 操作を完了扱いしない。

## 要件整理

- UsageEvent は `pricingVersion` を持ち、価格改定後も過去イベントの金額が勝手に変わらない。
- コスト計算は message 件数ベースや実装内定数ではなく、価格表と UsageEvent の token 数から算出する。
- `tokenSource=unknown` / `usageConfidence=missing` は actual cost に混ぜず、dataCompleteness 側で未計測として扱う。

## 検討・判断

- pricing catalog はまずローカル定義の `defaultPricingCatalog` として実装し、将来永続化・管理画面化しやすい `ModelPricing` 型にした。
- event 保存時の `estimatedCostUsd` は引き続き保持しつつ、admin 集計では `pricingVersion` に基づいて再計算するようにした。
- 複数 pricingVersion が混在する集計 item は `pricingVersion: "mixed"` とし、単一 version の場合は具体的な version を返す。

## 実施作業

- `apps/api/src/rag/pricing-catalog.ts` を追加。
- `UsageTrackingTextModel` の cost 算出を pricing catalog 経由に変更。
- `MemoRagService` の usage / cost summary を pricing catalog 再計算へ変更。
- `apps/api/src/rag/pricing-catalog.test.ts` を追加し、v1/v2 価格、missing usage 除外、embedding price を検証。
- `usage-tracking-text-model.test.ts` に pricingVersion / estimatedCostUsd の検証を追加。

## 成果物

- `apps/api/src/rag/pricing-catalog.ts`
- `apps/api/src/rag/pricing-catalog.test.ts`
- `apps/api/src/rag/usage-tracking-text-model.ts`
- `apps/api/src/rag/usage-tracking-text-model.test.ts`
- `apps/api/src/rag/memorag-service.ts`
- `tasks/do/20260516-1625-full-spec-gap-implementation.md`

## 検証

- `npm run typecheck -w @memorag-mvp/api`: pass
- `./node_modules/.bin/tsx --test apps/api/src/rag/pricing-catalog.test.ts apps/api/src/rag/usage-tracking-text-model.test.ts apps/api/src/rag/memorag-service.test.ts`: pass（54 件）
- `npm test -w @memorag-mvp/api -- src/rag/pricing-catalog.test.ts src/rag/usage-tracking-text-model.test.ts src/rag/memorag-service.test.ts src/adapters/usage-event-store.test.ts`: pass（script 展開により API test 260 件）
- `git diff --check`: pass

## Fit 評価

- `UsageEvent × PricingCatalog` の明示要件に対し、pricingVersion 付きの価格表計算と v1/v2 regression test を追加できた。
- missing usage を cost に混ぜない挙動は pricing catalog レイヤでも確認できた。

## 未対応・制約・リスク

- PricingCatalog の永続管理 API/UI は未実装。
- 実 AWS Bedrock / DynamoDB での provider usage 永続化は未検証。
- PR 作成、PR コメント、task done 移動は未実施。
