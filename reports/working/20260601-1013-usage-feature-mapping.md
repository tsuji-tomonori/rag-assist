# usage feature mapping 作業完了レポート

## 受けた指示

- `.workspace/plan-060101.txt` の usage / cost 実装計画を満たすため、未充足箇所を継続して実装・検証する。
- 完了扱いにせず、実施済み検証と未検証事項を明確に分ける。

## 要件整理

- UsageEvent は内部 LLM 呼び出し単位で監査可能に残す必要がある。
- 機能別 breakdown では、retrieval judge や memory card generation が一般 `chat` に混ざらない方が、計画の「機能別集計」に合う。

## 検討・判断

- `GenerateOptions["usageTask"]` には `retrievalJudge` / `memoryCard` が定義済みだったが、UsageEvent feature には対応する値がなく default `chat` に落ちていた。
- 既存の `rag.*` 命名に合わせ、`rag.retrieval_judge` / `rag.memory_card` を追加した。

## 実施作業

- `UsageEventFeature` に `rag.retrieval_judge` / `rag.memory_card` を追加。
- `UsageTrackingTextModel` の `featureForTask()` で `retrievalJudge` / `memoryCard` を明示的に写像。
- `usage-tracking-text-model.test.ts` に feature mapping の unit test を追加。

## 成果物

- `apps/api/src/types.ts`
- `apps/api/src/rag/usage-tracking-text-model.ts`
- `apps/api/src/rag/usage-tracking-text-model.test.ts`

## 検証

- `./node_modules/.bin/tsx --test apps/api/src/rag/usage-tracking-text-model.test.ts`: pass（8 件）
- `npm run typecheck -w @memorag-mvp/api`: pass
- `git diff --check`: pass

## Fit 評価

- retrieval judge と memory card generation の利用量が `chat` に紛れず、feature breakdown で個別に確認できるため、計画の機能別 usage 集計に近づいた。

## 未対応・制約・リスク

- 実 AWS Bedrock / DynamoDB での provider usage 永続化は未検証。
- 実 S3 への admin export 保存と署名付き URL の動作は未検証。
- Worktree Task PR Flow の commit / push / PR 作成 / PR コメント / task done 移動は未実施。
