# 作業完了レポート: chat usage idempotency

## 受けた指示

- `.workspace/plan-060101.txt` の完了に向け、UsageEvent を一次データとして漏れなく保存する実装・検証を進める。
- 検証済みでない外部環境の動作は未検証として扱う。

## 要件整理

- sync chat の LLM UsageEvent は、同一ユーザー・同一質問の別リクエストで欠落してはいけない。
- retry dedupe は維持しつつ、別リクエストは別 `orchestrationRunId` で記録する。
- debug UsageEvent も同じ chat request context に紐づく。

## 検討・判断

- `MemoRagService.chat()` は conversation id がない場合、`UsageTrackingTextModel` の idempotency key が `userId` fallback になり、同一 prompt hash が横断的に重複排除され得た。
- conversation がある場合も turn id がなければ request ごとに uuid を付け、同一 conversation 内の同じ質問再送を別 usage として扱うようにした。

## 実施作業

- `MemoRagService.chat()` で sync request ごとの usage run id を生成し、`depsWithUsageTracking` に渡すようにした。
- debug UsageEvent の `orchestrationRunId` も同じ usage run id に揃えた。
- 同じ stateless chat を 2 回実行しても RAG UsageEvent が増え、idempotencyKey が一意であることを service test に追加した。

## 成果物

- `apps/api/src/rag/memorag-service.ts`
- `apps/api/src/rag/memorag-service.test.ts`
- `tasks/do/20260516-1625-full-spec-gap-implementation.md`

## 検証

- `./node_modules/.bin/tsx --test apps/api/src/rag/memorag-service.test.ts`: pass（48 件）
- `npm run typecheck -w @memorag-mvp/api`: pass
- `git diff --check`: pass

## fit 評価

- `.workspace/plan-060101.txt` の「UsageEvent を監査可能な事実として取り逃がさない」方針に対し、stateless chat の重複排除衝突を解消した。
- async chat run の retry dedupe は runId context のまま維持している。

## 未対応・制約・リスク

- 実 AWS Bedrock / DynamoDB での provider usage 永続化は未検証。
- 実 S3 への admin export 保存と署名付き URL の動作は未検証。
- Worktree Task PR Flow の commit / push / PR 作成 / PR コメント / task done 移動は未実施。
