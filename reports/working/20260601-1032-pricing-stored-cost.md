# Pricing stored cost 作業完了レポート

- 日時: 2026-06-01 10:32 JST
- 対象タスク: `tasks/do/20260516-1625-full-spec-gap-implementation.md`

## 受けた指示

- `.workspace/plan-060101.txt` の章別仕様 gap 実装を継続する。
- 完了条件を満たすまで完了扱いせず、実施した検証だけを記録する。

## 要件整理

- plan は UsageEvent に `pricingVersion` と `estimatedCostUsd` を持たせ、価格改定後に過去イベントの金額が勝手に変わらないことを求めている。
- 既存実装は価格表が見つからない場合に保存済み `estimatedCostUsd` を使う一方、価格表が見つかる場合は再計算していた。

## 検討・判断

- 保存済み `estimatedCostUsd` はイベント保存時点の監査値として扱うべきなので、有限 number として存在する場合は catalog 再計算より優先する方針にした。
- `usageConfidence=missing` のイベントは引き続き cost に混ぜない方針を維持した。

## 実施作業

- `calculateUsageEventCost()` で保存済み `estimatedCostUsd` を優先するようにした。
- `pricing-catalog.test.ts` に保存済み推定金額が再計算値より優先される assertion を追加した。

## 成果物

- `apps/api/src/rag/pricing-catalog.ts`
- `apps/api/src/rag/pricing-catalog.test.ts`
- `tasks/do/20260516-1625-full-spec-gap-implementation.md`

## 検証

- `./node_modules/.bin/tsx --test apps/api/src/rag/pricing-catalog.test.ts apps/api/src/rag/memorag-service.test.ts apps/api/src/rag/usage-tracking-text-model.test.ts`: pass（62 件）
- `npm run typecheck -w @memorag-mvp/api`: pass
- `git diff --check`: pass

## fit 評価

- plan の「過去イベントの金額を価格改定から守る」意図に対し、保存済み UsageEvent 金額を優先する形で整合性を高めた。
- 価格表自体の外部管理 UI/API は今回の対象外で、既存 default catalog を前提にした検証に留まる。

## 未対応・制約・リスク

- 実 AWS Bedrock / DynamoDB での provider usage 永続化は未検証。
- 実 AWS/S3 への admin export 保存と署名付き URL の実ダウンロードは未検証。
- 章別仕様差分全体の PR 作成、PR コメント、task done 移動は未実施。
