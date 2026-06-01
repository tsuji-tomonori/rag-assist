# 作業完了レポート: search embedding usage

## 受けた指示

- `.workspace/plan-060101.txt` の完了に向け、UsageEvent / cost / admin contract の未固定箇所を実装・検証する。
- 完了扱いにせず、未検証項目と未完了 PR flow を明示する。

## 要件整理

- user が実行する semantic search の query embedding も、chat 経路と同様に UsageEvent として記録される必要がある。
- 同一ユーザー・同一検索語の複数回検索で、idempotency key が不自然に衝突して使用量が欠落しないこと。
- 実施した検証のみを記録し、実 AWS / S3 / PR flow は未完了として残す。

## 検討・判断

- `runChatOrchestration` は `depsWithUsageTracking` を通る一方、`MemoragService.search()` は `searchRag(this.deps, ...)` を直接呼んでいたため、通常検索の `deps.textModel.embed()` が tracking wrapper 外にあった。
- search には conversation id がないため、検索リクエストごとに `search:<uuid>` を `orchestrationRunId` として払い出し、UsageTrackingTextModel の既存 idempotency key 生成に載せる判断にした。

## 実施作業

- `MemoragService.search()` を usage tracking 付き deps で `searchRag` を呼ぶよう変更した。
- `depsWithUsageTracking` に任意の `orchestrationRunId` を渡せるようにした。
- `memorag-service.test.ts` に、semantic search を 2 回実行した場合に embedding UsageEvent が 2 件残り、`search:` run id と token contract を満たす test を追加した。

## 成果物

- `apps/api/src/rag/memorag-service.ts`
- `apps/api/src/rag/memorag-service.test.ts`
- `tasks/do/20260516-1625-full-spec-gap-implementation.md`

## 検証

- `./node_modules/.bin/tsx --test apps/api/src/rag/memorag-service.test.ts`: pass（47 件）
- `npm run typecheck -w @memorag-mvp/api`: pass
- `git diff --check`: pass

## fit 評価

- 通常検索の semantic embedding usage が user ごとの UsageEvent に残るようになり、admin usage / cost 集計の embedding token 欠落リスクを下げた。
- 複数回検索の重複排除衝突も test で固定した。

## 未対応・制約・リスク

- 実 AWS Bedrock / DynamoDB での provider usage 永続化は未検証。
- 実 S3 への admin export 保存と署名付き URL の動作は未検証。
- Worktree Task PR Flow の commit / push / PR 作成 / PR コメント / task done 移動は未実施。
