# 作業完了レポート

保存先: `reports/working/20260502-1439-search-benchmark-todo.md`

## 1. 受けた指示

- PR #70 のマージ後、別ブランチに TODO として残っているタスクがあれば実施する。

## 2. 要件整理

| 要件ID | 指示・要件 | 重要度 | 対応状況 |
|---|---|---:|---|
| R1 | 最新 `main` を確認する | 高 | 対応 |
| R2 | 後続 TODO branch を確認する | 高 | 対応 |
| R3 | Search API 評価 runner の branch を最新 `main` に合わせる | 高 | 対応 |
| R4 | PR #70 と重複する管理 API/UI/infra 差分を整理する | 高 | 対応 |
| R5 | Search 評価の実装・テスト・snapshot を検証する | 高 | 対応 |

## 3. 検討・判断したこと

- PR #70 の作業レポートに残っていた後続 TODO のうち、既存 branch `codex/search-benchmark-runner` が Search API 評価 runner を実装済みだったため、この branch を対象にした。
- 既存 branch は PR #70 より古い `main` から切られており、非同期 benchmark 管理 API/UI/Step Functions の実装が重複していたため、`origin/main` へ rebase し、main 側実装を正として採用した。
- Search 評価に必要な差分は、qrels runner、retrieval metrics、Search suite、Search dataset deployment、CodeBuild mode 切替、`lexicalTopK=0` / `semanticTopK=0` 対応に絞った。

## 4. 実施した作業

- `codex/search-benchmark-runner` を `origin/main` に rebase した。
- Search suite では既定 `topK` を 10 にし、Agent suite の既定値 6 と分けた。
- `benchmark/search-run.ts` で `TOP_K`、`LEXICAL_TOP_K`、`SEMANTIC_TOP_K`、`EMBEDDING_MODEL_ID` の環境変数 fallback を扱うよう補強した。
- hybrid search の ablation 用に `lexicalTopK=0` と `semanticTopK=0` を許可する既存差分に対し、回帰テストを追加した。
- Infra snapshot を Search dataset deployment と CodeBuild buildspec 変更に合わせて更新した。

## 5. 成果物

| 成果物 | 内容 |
|---|---|
| `memorag-bedrock-mvp/benchmark/search-run.ts` | Search API qrels runner |
| `memorag-bedrock-mvp/benchmark/metrics/retrieval.ts` | Recall/MRR/nDCG/Precision/ACL leak metrics |
| `memorag-bedrock-mvp/benchmark/datasets/search.sample.jsonl` | Search benchmark sample dataset |
| `memorag-bedrock-mvp/apps/api/src/rag/memorag-service.ts` | Search benchmark suite 接続 |
| `memorag-bedrock-mvp/infra/lib/memorag-mvp-stack.ts` | Search dataset deployment と runner mode 切替 |

## 6. 指示への fit 評価

| 評価軸 | 評価 | 理由 |
|---|---|---|
| 指示網羅性 | 4.7 / 5 | PR #70 後続 TODO の Search API 評価を branch として整理し、実装と検証まで完了した。 |
| 制約遵守 | 4.8 / 5 | main 側実装を優先し、未実施検証を実施済みとは書かず、作業レポートを追加した。 |
| 成果物品質 | 4.6 / 5 | 関連 typecheck/test/lint/snapshot を通した。AWS 上の CodeBuild 実行は環境外のため未実施。 |

総合 fit: 4.7 / 5.0

## 7. 検証

- `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/benchmark`: pass
- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/benchmark`: pass
- `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/api`: pass
- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/api -- src/search/hybrid-search.test.ts src/security/access-control-policy.test.ts`: pass
- `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/web`: pass
- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/web`: pass
- `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/infra`: pass
- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/infra`: pass
- `npm --prefix memorag-bedrock-mvp run lint`: pass
- `git diff --check`: pass

## 8. 未対応・制約・リスク

- CodeBuild runner の AWS 実行はローカル環境からは未実施。
- 実運用用の大規模 Search qrels dataset 作成は未対応。
- 負荷テスト runner は今回の対象外で、PR #70 の Phase 3 TODO として残る。
