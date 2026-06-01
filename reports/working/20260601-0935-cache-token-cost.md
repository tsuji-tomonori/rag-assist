# 作業完了レポート: cache token cost contract 補強

## 受けた指示

- `.workspace/plan-060101.txt` の継続として、UsageEvent / admin usage / cost audit 実装の完了条件に対する不足を確認し、実装・検証まで進める。

## 要件整理

- UsageEvent は `inputTokens` / `outputTokens` に加えて `cacheReadTokens` / `cacheWriteTokens` を持つ。
- PricingCatalog は cache read / cache write 単価を持てるため、cost 計算がそれらを取りこぼさないことを確認する。

## 検討・判断

- 既存の pricing test は input/output、価格 version 固定、missing usage 除外、embedding price を確認していた。
- cache token の計算実装はあったが、test で固定されていなかったため、provider usage が cache token を返すモデルに備えて contract を補強した。

## 実施作業

- `apps/api/src/rag/pricing-catalog.test.ts` に `v-cache` の pricing を追加した。
- input / output / cache read / cache write token をすべて含めて `estimatedCostUsd` が計算される test を追加した。

## 成果物

- PricingCatalog の cache token cost contract を unit test で固定。

## 検証

- `npm run typecheck -w @memorag-mvp/api`: pass
- `./node_modules/.bin/tsx --test apps/api/src/rag/pricing-catalog.test.ts apps/api/src/rag/usage-tracking-text-model.test.ts`: pass（10 件）
- `git diff --check`: pass

## Fit 評価

- `.workspace/plan-060101.txt` の UsageEvent × PricingCatalog 方針に対し、token 内訳をより正確に cost へ反映する証跡を追加できた。

## 未対応・制約・リスク

- 実 AWS Bedrock / DynamoDB での provider usage 永続化は未検証。
- 実 S3 への admin export 保存と署名付き URL の動作は未検証。
- PR 作成、PR コメント、task md の `tasks/done/` 移動は未実施。
- 現在の作業は既存 dirty worktree 上で継続しており、origin/main からの専用 worktree 作成フローは未完了。
