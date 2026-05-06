# Search benchmark performance improvement report

## 指示

- 対象 benchmark: `.workspace/bench_20260506T113300Z_e19441d7`
- 依頼: 性能改善を実装する
- 運用ルール: worktree task PR flow に従い、task md、検証、report、commit、PR、PR コメントまで進める

## 要件整理

| 要件ID | 要件 | 対応 |
| --- | --- | --- |
| R1 | positive search case の candidate 0 件を解消する | 対応 |
| R2 | alias case が `aliasVersion=none` のまま失敗しない | 対応 |
| R3 | ACL negative case の漏えい 0 を維持する | 対応 |
| R4 | search benchmark を再実行し改善結果を残す | 対応 |
| R5 | 関連 docs / tests / infra を同期する | 対応 |

## 判断の要約

対象 run は HTTP success 3/3 かつ p50 約294msで、主問題は latency ではなく retrieval quality だった。各行で `lexicalCount=0`、`semanticCount=0`、`fusedCount=0` となっており、search benchmark runner が corpus seed を行わないこと、CodeBuild が `search-standard-v1` に標準 corpus を割り当てないこと、sample dataset が seed 文書の `docType` / ACL / stable relevance と一致していないことを原因候補として扱った。

## 実施作業

- `search-run.ts` に benchmark corpus seed を追加し、summary / Markdown report に Corpus Seed を出力するようにした。
- benchmark seed の per-file metadata sidecar `<file>.metadata.json` から `searchAliases` を取り込み、alias case を seed corpus だけで再現できるようにした。
- benchmark seed upload の許可 metadata に `searchAliases` を追加し、形を検証するガードを追加した。
- `search.sample.jsonl` を標準 seed corpus と一致する `source=benchmark-runner` / `docType=benchmark-corpus` / stable file relevance に修正した。
- `search-standard-v1` の CodeBuild runner に標準 corpus seed を割り当てた。
- nDCG が同一 expected file の複数 chunk で 1 を超えないよう、評価済み relevance item の重複加点を防いだ。
- README、LOCAL_VERIFICATION、OPERATIONS を更新した。

## 成果物

| 成果物 | 内容 |
| --- | --- |
| `memorag-bedrock-mvp/benchmark/search-run.ts` | search benchmark の seed / corpus report 対応 |
| `memorag-bedrock-mvp/benchmark/corpus.ts` | sidecar metadata / searchAliases seed 対応 |
| `memorag-bedrock-mvp/benchmark/datasets/search.sample.jsonl` | seed corpus と一致する search sample dataset |
| `memorag-bedrock-mvp/benchmark/metrics/retrieval.ts` | nDCG 重複加点の補正 |
| `memorag-bedrock-mvp/infra/lib/memorag-mvp-stack.ts` | `search-standard-v1` の corpus seed 設定 |
| `memorag-bedrock-mvp/README.md`, `docs/LOCAL_VERIFICATION.md`, `docs/OPERATIONS.md` | 運用・検証手順の同期 |

## 検証結果

- `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/benchmark`: pass
- `npm --prefix memorag-bedrock-mvp test -w @memorag-mvp/benchmark`: pass
- `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/api`: pass
- `npm --prefix memorag-bedrock-mvp test -w @memorag-mvp/api -- src/contract/api-contract.test.ts src/search/hybrid-search.test.ts`: pass
- `UPDATE_SNAPSHOTS=1 npm --prefix memorag-bedrock-mvp test -w @memorag-mvp/infra`: pass
- `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/infra`: pass
- `API_BASE_URL=http://localhost:18791 task benchmark:search:sample`: pass。HTTP success 3/3、recallAt20 1、expectedFileHitRate 1、noAccessLeakCount 0、p95LatencyMs 25。
- `API_BASE_URL=http://localhost:18791 task benchmark:sample`: pass。HTTP success 50/50、answerableAccuracy 0.92、retrievalRecallAt20 1、expectedFileHitRate 1、p95LatencyMs 30。
- `git diff --check`: pass

## docs / security review

- docs は benchmark seed と search runner の運用手順が変わるため更新した。
- 追加 route はない。`/documents` の benchmark seed upload で許可する metadata key を `searchAliases` に拡張したが、`benchmarkSeed=true`、suite allowlist、`source=benchmark-runner`、`docType=benchmark-corpus`、`aclGroups=["BENCHMARK_RUNNER"]`、file size / extension guard は維持した。
- `searchAliases` は文字列配列の alias expansion のみに限定し、ACL group や任意 metadata の拡張は許可していない。

## Fit 評価

総合fit: 4.8 / 5.0

理由: 対象 benchmark の candidate 0 件を再現可能な seed / dataset / runner の不整合として修正し、search benchmark 実測で recall と expected file hit を 0 から 1 へ改善した。remote CodeBuild での再実行は PR 後の CI / benchmark run に依存するため満点ではない。

## 未対応・制約・リスク

- remote production API に対する benchmark rerun は未実施。ローカル API + mock Bedrock で検証した。
- `search-acl-negative-001` は forbidden file が seed corpus に存在しない状態で leak 0 を確認している。実データ ACL 境界の詳細検証は既存 contract test の dataset user group test に依存する。
- `task docs:check` はこの worktree の root Taskfile に存在しないため実行できなかった。代替として docs 差分確認と `git diff --check` を実施した。
