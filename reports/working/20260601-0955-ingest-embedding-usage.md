# 作業完了レポート: ingest embedding usage

## 受けた指示

- `.workspace/plan-060101.txt` の完了に向け、embedding を含む利用量イベントの保存漏れを減らす。
- 検証済みでない外部環境の動作は未検証として記録する。

## 要件整理

- user 起点の document ingest で実行される chunk embedding も UsageEvent に残す。
- event には userId だけでなく、後から ingest run と突合できる `ingestRunId` を持たせる。
- 既存の direct `service.ingest()` 呼び出しや reindex の挙動を壊さない。

## 検討・判断

- `executeDocumentIngestRun()` は `createdBy` / `userEmail` / `userGroups` を持つ run を処理するが、内部で呼ぶ `this.ingest()` は base deps のままで、`embedWithCache()` が tracking wrapper を通らなかった。
- `ingest()` に内部向けの deps 引数を追加し、通常呼び出しは既定の base deps、非同期 ingest run だけ usage tracking 付き deps を渡す形にした。

## 実施作業

- `UsageTrackingTextModel` の context に `ingestRunId` / `toolInvocationId` を追加し、generate / embed UsageEvent に保存するようにした。
- `MemoRagService.ingest()` と `createMemoryCards()` が内部 deps を受け取れるようにした。
- `executeDocumentIngestRun()` で `ingestRunId` 付き usage tracking deps を渡すようにした。
- 非同期 document ingest run test に、embedding UsageEvent が `ingestRunId` / `orchestrationRunId` / `userId` を持つことを追加した。

## 成果物

- `apps/api/src/rag/memorag-service.ts`
- `apps/api/src/rag/memorag-service.test.ts`
- `apps/api/src/rag/usage-tracking-text-model.ts`
- `tasks/do/20260516-1625-full-spec-gap-implementation.md`

## 検証

- `./node_modules/.bin/tsx --test apps/api/src/rag/memorag-service.test.ts apps/api/src/rag/usage-tracking-text-model.test.ts`: pass（55 件）
- `npm run typecheck -w @memorag-mvp/api`: pass
- `git diff --check`: pass

## fit 評価

- `.workspace/plan-060101.txt` の embedding usage を一次データにする方針に対し、chat/search だけでなく user 起点 document ingest の chunk embedding も記録対象になった。
- `ingestRunId` により、document ingest run と UsageEvent を監査時に突合できる。

## 未対応・制約・リスク

- direct `service.ingest()` や reindex は user context がないため、今回の UsageEvent 記録対象外。
- 実 AWS Bedrock / DynamoDB での provider usage 永続化は未検証。
- 実 S3 への admin export 保存と署名付き URL の動作は未検証。
- Worktree Task PR Flow の commit / push / PR 作成 / PR コメント / task done 移動は未実施。
