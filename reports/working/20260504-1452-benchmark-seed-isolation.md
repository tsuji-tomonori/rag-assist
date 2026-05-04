# 作業完了レポート

保存先: `reports/working/20260504-1452-benchmark-seed-isolation.md`

## 1. 受けた指示

- PR #102 のレビュー指摘に対応する。
- benchmark 用 `handbook.md` が通常 RAG corpus に混入しないようにする。
- `smoke-agent-v1` でも fresh environment で前提 corpus を seed する。
- seed 結果を summary / report に残す。
- 権限境界、docs、テストを更新する。

## 2. 要件整理

| 要件ID | 指示・要件 | 重要度 | 対応状況 |
|---|---|---:|---|
| R1 | benchmark seed を通常ユーザーの検索・回答から隔離する | 高 | 対応 |
| R2 | `BENCHMARK_RUNNER` の通常文書 upload 権限を狭める | 高 | 対応 |
| R3 | `smoke-agent-v1` でも `handbook.md` を seed する | 高 | 対応 |
| R4 | seed 結果を `summary.json` / `report.md` に出す | 中 | 対応 |
| R5 | docs / tests / infra snapshot を更新する | 高 | 対応 |

## 3. 検討・判断したこと

- 通常 RAG への混入対策は、seed metadata に `aclGroups: ["BENCHMARK_RUNNER"]` と `docType: "benchmark-corpus"` を強制し、既存 ACL 検索フィルタに乗せる方針にした。
- `BENCHMARK_RUNNER` には通常の `rag:doc:write:group` を付けず、`benchmark:seed_corpus` 専用 permission を追加した。
- `/documents` は既存 route を維持しつつ、`benchmark:seed_corpus` の場合だけ allowlist 済み benchmark seed payload を許可する形にした。
- `smoke-agent-v1` と `standard-agent-v1` は同じ `handbook.md` corpus を使うため、CodeBuild では `BENCHMARK_CORPUS_SUITE_ID=standard-agent-v1` を設定し、同一 corpus の重複 seed を抑える。
- 古い active seed の cleanup / supersede 専用 endpoint は今回の最小修正範囲外とし、通常検索からの隔離と新規 seed の安全化を優先した。

## 4. 実施した作業

- `benchmark/corpus.ts` の upload metadata に `aclGroups`、`docType`、`source` を追加し、skip 判定にも含めた。
- `apps/api/src/authorization.ts` に `benchmark:seed_corpus` を追加し、`BENCHMARK_RUNNER` から `rag:doc:write:group` を外した。
- `POST /documents` で `benchmark:seed_corpus` の seed payload を検証し、一般文書 upload を拒否するようにした。
- `benchmark/run.ts` の summary / Markdown report に `corpusSeed` を追加した。
- CodeBuild buildspec を `smoke-agent-v1` / `standard-agent-v1` の両方で標準 corpus seed するように更新した。
- README、運用 docs、API 設計、local verification、GitHub Actions deploy docs を更新した。
- API / benchmark / infra の unit test と contract test を更新した。

## 5. 成果物

| 成果物 | 形式 | 内容 | 指示との対応 |
|---|---|---|---|
| `memorag-bedrock-mvp/benchmark/corpus.ts` | TypeScript | isolated seed metadata と skip 判定 | R1 |
| `memorag-bedrock-mvp/apps/api/src/app.ts` | TypeScript | benchmark seed upload の専用認可・payload 検証 | R2 |
| `memorag-bedrock-mvp/apps/api/src/authorization.ts` | TypeScript | `benchmark:seed_corpus` permission | R2 |
| `memorag-bedrock-mvp/infra/lib/memorag-mvp-stack.ts` | TypeScript | smoke/standard の標準 corpus seed 設定 | R3 |
| `memorag-bedrock-mvp/benchmark/run.ts` | TypeScript | `corpusSeed` summary / report 出力 | R4 |
| `memorag-bedrock-mvp/docs/OPERATIONS.md` ほか | Markdown | 権限境界と seed 隔離の説明 | R5 |

## 6. 指示へのfit評価

総合fit: 4.8 / 5.0（約96%）
理由: マージ前 blocker の通常 RAG 混入、権限過大、smoke seed、seed 結果可視化に対応した。古い active seed を superseded にする専用 cleanup endpoint は今回の範囲外として残している。

## 7. 検証

- `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/benchmark`: PASS
- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/benchmark`: PASS
- `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/api`: PASS
- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/api`: PASS
- `env UPDATE_SNAPSHOTS=1 npm --prefix memorag-bedrock-mvp/infra test`: PASS
- `npm --prefix memorag-bedrock-mvp/infra test`: PASS
- `task benchmark:sample API_BASE_URL=http://localhost:18998`: PASS。`BENCHMARK_RUNNER` のローカル API で `handbook.md` upload、`corpusSeed` summary/report 出力を確認した。
- `curl -s http://127.0.0.1:18998/search ...`: PASS。同じ local data を `CHAT_USER` で起動し、`経費精算 30日以内` の検索結果が空であることを確認した。
- `git diff --check`: PASS
- `task docs:check:changed`: 未実行扱い。root `Taskfile.yml` に該当 task が存在しなかったため、docs は差分確認と pre-commit 対象ファイル検証で代替した。

## 8. 未対応・制約・リスク

- 既に過去環境へ active で投入済みの旧 benchmark seed を自動で superseded / delete する処理は未実装。今回の変更後に投入される seed は ACL で隔離される。
- `BENCHMARK_RUNNER` は `rag:doc:read` を持つため `/search` は実行可能。これは既存説明どおりで、seed 用 write 権限は専用 permission に分離した。
