# Usage non-token events work report

## 受けた指示

- `.workspace/plan-060101.txt` の admin usage / cost 指摘を継続し、UsageEvent を一次データにした利用量・コスト計測へ近づける。
- 実施していない検証や PR 操作を完了扱いしない。

## 要件整理

- chat / RAG / embedding だけでなく、benchmark / async agent / debug の利用事実も UsageEvent として残す。
- provider token usage が取れない経路は `usageConfidence: "missing"` / `tokenSource: "unknown"` として「未計測」を明示する。
- benchmark / async_agent / debug の missing event を LLM token cost や LLM call count に混ぜない。

## 検討・判断

- async agent provider と benchmark runner は現時点で provider token usage を返さないため、推定 token ではなく missing event として保存した。
- benchmark は run 作成時点の queued event を idempotent に記録し、完了 metrics の外部更新とは分離した。
- CostAudit の Bedrock chat completion item は LLM/RAG event のみに限定し、非トークン系 event は dataCompleteness 上の missing として扱う。

## 実施作業

- `MemoRagService` に UsageEvent 記録 helper を追加。
- direct chat / async chat run の debug trace 生成時に `feature: "debug"` の missing UsageEvent を記録。
- async agent blocked / completed / failed 時に `feature: "async_agent"` の missing UsageEvent を記録。
- benchmark run 作成時に `feature: "benchmark"` の missing UsageEvent を記録。
- `/admin/usage` の `llmCallCount` と chat request 補完、`/admin/costs` の chat completion token 集計を LLM/RAG event に限定。
- API service tests に async agent / benchmark UsageEvent の確認を追加。

## 成果物

- `apps/api/src/rag/memorag-service.ts`
- `apps/api/src/rag/memorag-service.test.ts`
- `tasks/do/20260516-1625-full-spec-gap-implementation.md`

## 検証

- `npm run typecheck -w @memorag-mvp/api`: pass
- `./node_modules/.bin/tsx --test apps/api/src/rag/memorag-service.test.ts`: pass（46 件）
- `npm test -w @memorag-mvp/api -- src/rag/memorag-service.test.ts src/rag/usage-tracking-text-model.test.ts src/adapters/usage-event-store.test.ts`: pass（script 展開により API test 256 件）
- `git diff --check`: pass

## Fit 評価

- UsageEvent を一次データにする方針へ、benchmark / debug / async_agent の利用事実も接続できた。
- 未計測 token を 0 cost と誤表示しないための dataCompleteness 反映を維持した。

## 未対応・制約・リスク

- 実 AWS Bedrock / DynamoDB での provider usage 永続化は未検証。
- PR 作成、PR コメント、task done 移動は未実施。
- 外部 runner が benchmark 完了後に詳細 token usage を返す経路は未実装。
