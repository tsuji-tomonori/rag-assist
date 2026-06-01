# 作業完了レポート

保存先: `reports/working/20260601-0856-usage-event-dynamodb-embedding.md`

## 1. 受けた指示

- `.workspace/plan-060101.txt` を objective として継続し、現在の worktree を根拠に未完了箇所を進めること。
- 完了条件を縮小せず、完了できない場合も concrete progress と検証結果を残すこと。

## 2. 要件整理

| 要件ID | 指示・要件 | 重要度 | 対応状況 |
|---|---|---:|---|
| R1 | `InMemoryUsageEventStore` / `DynamoDbUsageEventStore` を実装する | 高 | 対応 |
| R2 | embedding usage も `UsageEvent` として保存する | 高 | 対応 |
| R3 | production infra に usage event 永続化先を追加する | 高 | 対応 |
| R4 | コスト集計で embedding と LLM call を区別する | 中 | 対応 |
| R5 | 型、unit、infra、OpenAPI の検証を実施する | 高 | 対応 |
| R6 | objective 全体の PR flow を完了する | 高 | 未対応 |

## 3. 検討・判断したこと

- `UsageEventStore` は local では既存 ObjectStore 実装を維持しつつ、テスト・軽量用途向けに `InMemoryUsageEventStore`、production 向けに `DynamoDbUsageEventStore` を追加した。
- DynamoDB table は `idempotencyKey` を partition key にし、`putOnce` を conditional put で実装した。
- embedding は completion output token を持たないため、`inputTokens` のみで `feature: "embedding"` として保存し、cost item も別 category にした。
- CDK の IAM policy が overflow managed policy に分割されるため、infra test は inline policy だけでなく managed policy も検査する helper に更新した。

## 4. 実施した作業

- `apps/api/src/adapters/dynamodb-usage-event-store.ts` と adapter unit test を追加した。
- `apps/api/src/adapters/usage-event-store.ts` に `InMemoryUsageEventStore` を追加した。
- `UsageTrackingTextModel.embed()` で usage event を保存するようにした。
- Bedrock embedding response の `inputTextTokenCount` を `EmbedOptions.onUsage` に渡した。
- `/admin/costs` の Bedrock item を chat completion tokens と embedding tokens に分けた。
- `/admin/usage` の `chatMessages` を usage event の unique orchestration/session 数から補完し、チャット後に旧 ledger が未加算でも 0 のまま表示されないようにした。
- `apps/api/src/config.ts` / `dependencies.ts` で usage event store の local/DynamoDB 切り替えを追加した。
- `infra/lib/memorag-mvp-stack.ts` に `UsageEventsTable`、env、IAM grant を追加し、snapshot を更新した。
- `packages/contract` の infra env 型を更新した。

## 5. 成果物

| 成果物 | 形式 | 内容 | 指示との対応 |
|---|---|---|---|
| `apps/api/src/adapters/dynamodb-usage-event-store.ts` | TypeScript | DynamoDB-backed UsageEventStore | R1/R3 |
| `apps/api/src/adapters/usage-event-store.test.ts` | TypeScript test | InMemory/DynamoDB store の dedupe と conditional put 検証 | R1/R5 |
| `apps/api/src/rag/usage-tracking-text-model.ts` | TypeScript | generate/embed usage tracking | R2/R4 |
| `apps/api/src/rag/memorag-service.test.ts` | TypeScript test | UsageEvent から chatMessages/tokens/dataCompleteness を集計する確認 | R2/R4/R5 |
| `infra/lib/memorag-mvp-stack.ts` | CDK | UsageEventsTable と Lambda env/grant | R3 |
| `infra/test/__snapshots__/memorag-mvp-stack.snapshot.json` | Snapshot | CDK template 更新 | R5 |
| `packages/contract/src/infra.ts` / `infra.d.ts` | TypeScript | runtime env contract 更新 | R3/R5 |

## 6. 指示へのfit評価

| 評価軸 | 評価 | 理由 |
|---|---:|---|
| 指示網羅性 | 4/5 | usage/cost 計画の store と embedding まで進んだが、benchmark/async_agent 計測と PR flow は未完了 |
| 制約遵守 | 4.5/5 | 実施した検証と未実施事項を明記し、generated snapshot は正規 test flow で更新した |
| 成果物品質 | 4.2/5 | API/infra/contract/web typecheck と対象 test が通過。実 AWS 検証は未実施 |
| 説明責任 | 4.5/5 | task と report に判断、検証、未対応を追記した |
| 検収容易性 | 4/5 | 変更ファイルと検証コマンドを明記した |

**総合fit: 4.2/5（約84%）**

理由: `.workspace/plan-060101.txt` の usage/cost 主要実装はさらに進んだが、objective 全体は PR 作成・コメント・done 移動まで含むため未完了。

## 7. 実行した検証

- `npm run typecheck -w @memorag-mvp/api`: pass
- `npm run typecheck -w @memorag-mvp/web`: pass
- `npm test -w @memorag-mvp/api -- src/rag/memorag-service.test.ts src/adapters/usage-event-store.test.ts src/rag/usage-tracking-text-model.test.ts`: pass
- `npm run typecheck -w @memorag-mvp/infra`: fail -> contract env 型更新後 pass
- `UPDATE_SNAPSHOTS=1 npm test -w @memorag-mvp/infra`: pass
- `npm test -w @memorag-mvp/infra`: pass
- `npm run typecheck -w @memorag-mvp/contract`: pass
- `npm run docs:openapi:check`: pass
- `git diff --check`: pass

## 8. 未対応・制約・リスク

- 未対応: benchmark / async_agent / debug の usage event 化、PR 作成、PR 受け入れ条件コメント、セルフレビューコメント、task done 移動。
- 制約: 実 AWS Bedrock / DynamoDB で provider usage が期待どおり保存されるかは未検証。
- リスク: PricingCatalog はまだ固定 local version であり、正式な価格表管理 API とは分離されていない。
