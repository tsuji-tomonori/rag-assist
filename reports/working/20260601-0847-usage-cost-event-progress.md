# 作業完了レポート

保存先: `reports/working/20260601-0847-usage-cost-event-progress.md`

## 1. 受けた指示

- `.workspace/plan-060101.txt` を objective として、現在の worktree と外部状態を根拠に継続作業を進めること。
- 完了条件を狭めず、未完了の場合も concrete progress を残すこと。
- リポジトリの AGENTS.md とローカル skills に従い、実施した検証を正直に記録すること。

## 2. 要件整理

| 要件ID | 指示・要件 | 重要度 | 対応状況 |
|---|---|---:|---|
| R1 | `UsageEvent` を一次データとして保存する | 高 | 一部対応 |
| R2 | TextModel 呼び出しを usage tracking で計測する | 高 | 一部対応 |
| R3 | `/admin/usage` と `/admin/costs` を token/event 集計へ寄せる | 高 | 対応 |
| R4 | UI で 0、未計測、推定を区別する | 高 | 対応 |
| R5 | OpenAPI/generated docs とテストを同期する | 高 | 対応 |
| R6 | 章別仕様差分全体の PR flow を完了する | 高 | 未対応 |

## 3. 検討・判断したこと

- 既存 `TextModel.generate()` の戻り値を変えず、`GenerateOptions.onUsage` と usage wrapper で計測を追加した。
- provider usage が取れない local/mock 経路では、実コスト扱いせず estimated/missing を明示する方針にした。
- 既存途中変更により `quality.ts` が存在しない shared module を参照していたため、検証不能状態を解消する範囲で実体を復元した。
- DynamoDB 専用 store や embedding 計測は objective の最終状態には必要だが、このターンでは ObjectStore-backed store と chat LLM 計測を優先した。

## 4. 実施した作業

- `UsageEvent` / `UsageDataCompleteness` 型、`UsageEventStore`、`ObjectStoreUsageEventStore` を追加した。
- `UsageTrackingTextModel` を追加し、provider usage、推定、missing、idempotency を扱う単体テストを追加した。
- Bedrock `ConverseCommand` の `response.usage` を `GenerateOptions.onUsage` へ渡すようにした。
- `llmOptions()` に usage task を渡し、RAG 内部 LLM 呼び出しを feature へ分類できるようにした。
- `/admin/usage` と `/admin/costs` の schema/route/service/web types/UI を更新した。
- `docs/generated/openapi` を runtime OpenAPI から再生成した。
- `quality.ts` の実体を復元し、low confidence extraction warning を normal RAG gate に反映した。

## 5. 成果物

| 成果物 | 形式 | 内容 | 指示との対応 |
|---|---|---|---|
| `apps/api/src/adapters/usage-event-store.ts` | TypeScript | usage event store interface と ObjectStore 実装 | R1 |
| `apps/api/src/rag/usage-tracking-text-model.ts` | TypeScript | TextModel usage tracking wrapper | R2 |
| `apps/api/src/rag/usage-tracking-text-model.test.ts` | TypeScript test | provider/estimate/missing/idempotency の単体テスト | R2/R5 |
| `apps/api/src/rag/memorag-service.ts` ほか | TypeScript | admin usage/cost 集計更新 | R3 |
| `apps/web/src/features/admin/components/panels/*` | TSX/CSS | 未計測/推定/実測表示 | R4 |
| `docs/generated/openapi/*` | Markdown | runtime OpenAPI 由来の generated docs | R5 |

## 6. 指示へのfit評価

| 評価軸 | 評価 | 理由 |
|---|---:|---|
| 指示網羅性 | 3.6/5 | usage/cost objective の中核は進んだが、最終 PR flow と DynamoDB/embedding 計測は未完了 |
| 制約遵守 | 4/5 | ローカル skill、検証記録、未実施事項の明記に対応。既存 main worktree 変更は current state 優先で継続 |
| 成果物品質 | 4/5 | typecheck、API/Web test、OpenAPI check が通過。実 AWS provider usage は未検証 |
| 説明責任 | 4.5/5 | 実施内容、未対応、検証結果を task と report に残した |
| 検収容易性 | 4/5 | ファイル単位の成果物と検証コマンドを明記した |

**総合fit: 4.0/5（約80%）**

理由: `.workspace/plan-060101.txt` の usage/cost 改善について実装・検証済みの前進はあるが、objective 全体はまだ完了していないため。

## 7. 未対応・制約・リスク

- 未対応: DynamoDB 専用 UsageEventStore、embedding usage 計測、PR 作成・PR コメント・task done 移動。
- 制約: 実 AWS Bedrock 呼び出しによる provider usage の実測確認はローカルで未実施。
- リスク: pricing は local catalog version の固定値であり、正式な価格表運用とはまだ分離されている。

## 8. 次に改善できること

- UsageEventStore の DynamoDB 実装と IaC/table 設計を追加する。
- embedding / benchmark / async_agent の usage event 計測を広げる。
- admin usage/cost の contract tests をさらに追加し、PR flow の commit/push/PR コメントまで進める。
