# 作業完了レポート: tokenizer estimate contract 補強

## 受けた指示

- `.workspace/plan-060101.txt` の継続として、UsageEvent / admin usage / cost audit 実装の完了条件に対する不足を確認し、実装・検証まで進める。

## 要件整理

- UT-USAGE-002: provider usage が存在しない場合、tokenizer estimate により `inputTokens` / `outputTokens` が 0 より大きく保存され、`tokenSource=tokenizer_estimate` になる。
- embedding でも provider usage がない場合は、利用量を 0 に丸めず推定 token として保存する。

## 検討・判断

- 既存 test は generate の推定 token を確認していたが、`tokenSource` は `tokenizer_estimate|mock_estimate` の正規表現で許容していた。
- `.workspace/plan-060101.txt` の UT-USAGE-002 は非 mock の provider usage absent 経路を `tokenizer_estimate` として固定する要求なので、unit test をより明示的にした。
- embedding の provider usage absent 経路も cost/usage 集計に関係するため、同じ test file で補強した。

## 実施作業

- `apps/api/src/rag/usage-tracking-text-model.test.ts` の generate 推定 test を `tokenSource: "tokenizer_estimate"` 固定に変更した。
- provider usage なしの `embed()` が tokenizer estimate の UsageEvent を保存する test を追加した。

## 成果物

- UT-USAGE-002 の tokenSource contract を厳密化。
- embedding 推定 token の UsageEvent contract を追加。

## 検証

- `npm run typecheck -w @memorag-mvp/api`: pass
- `./node_modules/.bin/tsx --test apps/api/src/rag/usage-tracking-text-model.test.ts`: pass（5 件）
- `git diff --check`: pass

## Fit 評価

- provider usage が欠落しても token usage を 0 として cost に混ぜず、推定可能なものは `tokenizer_estimate` として保存する plan の方針に沿う証跡を強めた。

## 未対応・制約・リスク

- 実 AWS Bedrock / DynamoDB での provider usage 永続化は未検証。
- 実 S3 への admin export 保存と署名付き URL の動作は未検証。
- PR 作成、PR コメント、task md の `tasks/done/` 移動は未実施。
- 現在の作業は既存 dirty worktree 上で継続しており、origin/main からの専用 worktree 作成フローは未完了。
