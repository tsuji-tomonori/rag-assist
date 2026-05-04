# 作業完了レポート

保存先: `reports/working/20260504-1358-benchmark-review-fixes.md`

## 1. 受けた指示

- PR #102 のレビュー指摘に対応する。
- 競合はレビュー対象外として扱う。
- CodeBuild の corpus seed 条件、seed 済み判定、`BENCHMARK_RUNNER` の権限説明を確認・改善する。

## 2. 要件整理

| 要件ID | 指示・要件 | 重要度 | 対応状況 |
|---|---|---:|---|
| R1 | `standard-agent-v1` 以外で標準 corpus を seed しない | 高 | 対応 |
| R2 | seed 済み判定に ingest 条件差分を含める | 中 | 対応 |
| R3 | `BENCHMARK_RUNNER` が `/search` も呼べることを明記する | 中 | 対応 |
| R4 | 対象検証を実行する | 高 | 対応 |

## 3. 検討・判断したこと

- #1 は要修正として、CodeBuild buildspec の条件を `MODE=agent` から `SUITE_ID=standard-agent-v1` に変更した。
- #2 は最低限の改善として `benchmarkIngestSignature` を導入し、source hash、suiteId、`skipMemory`、明示 embedding model、seed signature version を比較対象にした。
- 明示された `EMBEDDING_MODEL_ID` は seed upload payload にも渡し、query 側と seed 側の embedding model がずれにくいようにした。
- #3 は現状の permission 設計を維持し、`rag:doc:read` により `POST /search` も実行可能であることを運用 docs と API 権限表に明記した。

## 4. 実施した作業

- `infra/lib/memorag-mvp-stack.ts` の corpus seed 条件を `SUITE_ID=standard-agent-v1` に変更した。
- `benchmark/corpus.ts` に `benchmarkIngestSignature` 作成・保存・比較を追加した。
- `benchmark/run.ts` から seed 処理へ `EMBEDDING_MODEL_ID` を渡すようにした。
- corpus seed の unit test を拡張し、signature 差分時の再 upload と metadata / embedding model payload を確認した。
- `README.md`、`OPERATIONS.md`、`DES_API_001.md` を更新した。
- infra snapshot を更新した。

## 5. 成果物

| 成果物 | 形式 | 内容 | 指示との対応 |
|---|---|---|---|
| `memorag-bedrock-mvp/infra/lib/memorag-mvp-stack.ts` | TypeScript | `standard-agent-v1` 限定 seed 条件 | R1 |
| `memorag-bedrock-mvp/benchmark/corpus.ts` | TypeScript | ingest signature による skip 判定 | R2 |
| `memorag-bedrock-mvp/benchmark/corpus.test.ts` | TypeScript | signature 差分と upload metadata のテスト | R2 |
| `memorag-bedrock-mvp/docs/OPERATIONS.md` | Markdown | `/search` も実行可能な権限境界を明記 | R3 |
| `memorag-bedrock-mvp/docs/3_設計_DES/41_API_API/DES_API_001.md` | Markdown | `POST /search` の role 表を追加 | R3 |

## 6. 指示へのfit評価

総合fit: 5.0 / 5.0（約100%）
理由: 要修正の #1 に加え、確認推奨の #2/#3 も実装・文書化し、対象検証と実動 smoke を完了した。

## 7. 検証

- `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/benchmark`: PASS
- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/benchmark`: PASS
- `env UPDATE_SNAPSHOTS=1 npm --prefix memorag-bedrock-mvp/infra test`: PASS
- `npm --prefix memorag-bedrock-mvp/infra test`: PASS
- `task benchmark:sample API_BASE_URL=http://localhost:18998`: PASS。`retrievalRecallAt20 = 1` を確認した。
- `git diff --check`: PASS

## 8. 未対応・制約・リスク

- `benchmarkIngestSignature` は runner が明示できる seed 条件を比較する。API 内部の pipeline version が変わった場合は、signature version の更新や将来の manifest 比較拡張で対応する。
- `BENCHMARK_RUNNER` の `rag:doc:read` は `/search` も許可する。専用 `benchmark:seed` permission / seed endpoint の追加は今回の範囲外。
