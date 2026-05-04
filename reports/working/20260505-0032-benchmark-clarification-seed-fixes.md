# 作業完了レポート

保存先: `reports/working/20260505-0032-benchmark-clarification-seed-fixes.md`

## 1. 受けた指示

- PR #102 の追加レビュー指摘に対応する。
- `clarification-smoke-v1` を handbook seed 対象に含める。
- `EMBEDDING_MODEL_ID` を seed と query / follow-up で揃える。
- PR 本文を最新の `benchmark:seed_corpus` 設計に更新する。
- 文書一覧にも seed 文書を見せない設計なら ACL filter を入れる。

## 2. 要件整理

| 要件ID | 指示・要件 | 重要度 | 対応状況 |
|---|---|---:|---|
| R1 | `clarification-smoke-v1` の CodeBuild seed 漏れを直す | 高 | 対応 |
| R2 | env `EMBEDDING_MODEL_ID` を query / follow-up にも渡す | 高 | 対応 |
| R3 | `GET /documents` を ACL filter する | 中 | 対応 |
| R4 | docs / infra snapshot / tests を更新する | 高 | 対応 |
| R5 | PR 本文を最新実装に合わせる | 中 | 対応予定 |

## 3. 検討・判断したこと

- `clarification-smoke-v1` は `dataset.clarification.sample.jsonl` の follow-up で `30日以内` を期待するため、`standard-agent-v1` と同じ `handbook.md` corpus を seed 対象に含めた。
- `EMBEDDING_MODEL_ID` は seed だけでなく `/benchmark/query` と follow-up query の default にも使い、dataset row の `embeddingModelId` がある場合だけ row 側を優先する形にした。
- benchmark seed は通常 RAG から隔離する方針なので、`GET /documents` も caller の ACL で filter し、通常利用者の文書一覧に benchmark seed が出ないようにした。
- `BENCHMARK_CORPUS_SUITE_ID=standard-agent-v1` は維持し、smoke / standard / clarification が同じ corpus identity を共有する。

## 4. 実施した作業

- CodeBuild buildspec の corpus seed 条件に `clarification-smoke-v1` を追加した。
- `benchmark/run.ts` に `defaultEmbeddingModelId` を追加し、seed / initial query / follow-up query へ適用した。
- `/documents` list route から `service.listDocuments(c.get("user"))` を呼ぶように変更した。
- `MemoRagService.listDocuments(user?)` に manifest ACL filter を追加した。
- ACL filter の unit test を追加した。
- README、運用 docs、local verification docs、infra assertion、snapshot を更新した。

## 5. 成果物

| 成果物 | 形式 | 内容 | 指示との対応 |
|---|---|---|---|
| `memorag-bedrock-mvp/infra/lib/memorag-mvp-stack.ts` | TypeScript | `clarification-smoke-v1` の corpus seed 対象化 | R1 |
| `memorag-bedrock-mvp/benchmark/run.ts` | TypeScript | env embedding model を seed / query / follow-up に適用 | R2 |
| `memorag-bedrock-mvp/apps/api/src/rag/memorag-service.ts` | TypeScript | 文書一覧 ACL filter | R3 |
| `memorag-bedrock-mvp/apps/api/src/rag/memorag-service.test.ts` | TypeScript | 文書一覧 ACL filter の回帰テスト | R3 |
| `memorag-bedrock-mvp/docs/OPERATIONS.md` ほか | Markdown | seed 対象 suite と一覧隔離の説明更新 | R4 |

## 6. 指示へのfit評価

総合fit: 4.9 / 5.0（約98%）
理由: 2件の要修正と文書一覧 ACL filter に対応し、対象検証を通した。PR 本文更新は commit / push 後に GitHub App で反映する。

## 7. 検証

- `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/benchmark`: PASS
- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/benchmark`: PASS
- `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/api`: PASS
- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/api`: PASS
- `env UPDATE_SNAPSHOTS=1 npm --prefix memorag-bedrock-mvp/infra test`: PASS
- `npm --prefix memorag-bedrock-mvp/infra test`: PASS
- `env ... BENCHMARK_SUITE_ID=clarification-smoke-v1 ... npm run start -w @memorag-mvp/benchmark`: PASS。fresh local data で `handbook.md` seed、3 row 実行、`corpusSeed` 出力、debug trace の `embeddingModelId = amazon.titan-embed-text-v2:0` を確認した。

## 8. 未対応・制約・リスク

- local mock での `clarification-smoke-v1` は HTTP と seed 経路の確認を目的に実行した。quality metrics の満点化は今回の修正範囲ではない。
- 既存環境に過去投入済みの ACL なし seed を自動 cleanup する処理は未実装。
