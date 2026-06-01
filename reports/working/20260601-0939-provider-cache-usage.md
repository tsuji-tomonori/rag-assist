# 作業完了レポート: provider cache usage contract 補強

## 受けた指示

- `.workspace/plan-060101.txt` の継続として、UsageEvent / admin usage / cost audit 実装の完了条件に対する不足を確認し、実装・検証まで進める。

## 要件整理

- provider usage が `cacheReadTokens` / `cacheWriteTokens` を返す場合、UsageEvent に保存する。
- cache token は `totalTokens` に含め、後続の cost / usage 集計で取りこぼさない。

## 検討・判断

- `UsageTrackingTextModel` の実装は cache token を event へ入れる形だった。
- ただし unit test の fake usage 型が input/output のみで、cache token 保存 contract を直接検証していなかった。

## 実施作業

- `usage-tracking-text-model.test.ts` の `FakeTextModel` usage 型を `TextModelTokenUsage` に揃えた。
- provider usage に `cacheReadTokens` / `cacheWriteTokens` が含まれる場合、UsageEvent に保存され `totalTokens` に合算される test を追加した。

## 成果物

- provider cache token usage の保存 contract を unit test で固定。

## 検証

- `npm run typecheck -w @memorag-mvp/api`: pass
- `./node_modules/.bin/tsx --test apps/api/src/rag/usage-tracking-text-model.test.ts apps/api/src/rag/pricing-catalog.test.ts`: pass（12 件）
- `git diff --check`: pass

## Fit 評価

- `.workspace/plan-060101.txt` の UsageEvent token 内訳と PricingCatalog 集計方針に対し、provider から返る cache token の保存証跡を追加できた。

## 未対応・制約・リスク

- 実 AWS Bedrock / DynamoDB での provider usage 永続化は未検証。
- 実 S3 への admin export 保存と署名付き URL の動作は未検証。
- PR 作成、PR コメント、task md の `tasks/done/` 移動は未実施。
- 現在の作業は既存 dirty worktree 上で継続しており、origin/main からの専用 worktree 作成フローは未完了。
