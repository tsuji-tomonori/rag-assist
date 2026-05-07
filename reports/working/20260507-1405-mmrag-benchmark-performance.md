# MMRAG-DocQA benchmark 性能改善 作業レポート

- 作業日時: 2026-05-07 14:05
- 対象 worktree: `.worktrees/mmrag-benchmark-performance`
- 対象 branch: `codex/mmrag-benchmark-performance`

## 指示

`.workspace/bench_20260507T043640Z_5710a31c` の benchmark artifact をもとに、MMRAG-DocQA benchmark の性能劣化原因を調査し、改善する。

## 要件整理

- `mmrag-docqa-v1` sample corpus の `mmrag-docqa-method.md` を retrieval / selected context に乗せる。
- 十分な根拠がある質問を `UNANSWERABLE` と誤判定しない。
- 同じ検索 action や同一候補集合の再探索で不要に最大 iteration まで進まないようにする。
- benchmark 期待語句や dataset 固有分岐を回答実装へ hard-code しない。
- 認可境界と RAG 根拠性を弱めない。

## 原因

artifact では `corpusSeed` が `mmrag-docqa-method.md` を登録していた一方、`/benchmark/query` は通常の agent chat と同じ検索条件で動いていた。そのため `BENCHMARK_RUNNER` から参照可能な一般文書が benchmark corpus より上位に入り、`retrieval_recall_at_20=0`、`citation_hit_rate=0`、3/3 行の誤拒否につながっていた。

また、検索結果が既存 evidence と同じ候補集合だけを返す場合でも探索を継続でき、不要に iteration と retrieval call が増える経路があった。

## 実施作業

- agent state / chat input に内部用 `searchFilters` を追加し、`searchRag` へ伝播した。
- `/benchmark/query` では内部的に `source=benchmark-runner` と `docType=benchmark-corpus` の filter を適用し、一般文書が benchmark retrieval / citation に混入しないようにした。
- 検索評価後、hit はあるが新規 evidence がない候補集合、または同一 action の新規 evidence なし再実行を検知した場合に検索を終了する停止条件を追加した。
- benchmark filter が `mmrag-docqa-method.md` のみを retrieval / citation へ残し、`sufficient_context_gate` が `ANSWERABLE` になる回帰テストを追加した。
- search evidence node が filter を vector query に渡す unit test を追加した。
- 調査中に benchmark package の duplicate helper 定義による test / typecheck blocker を確認したが、`origin/main` 取り込み後の最終差分では先行修正済みだったため、この PR の変更対象からは外れた。
- `memorag-bedrock-mvp/docs/OPERATIONS.md` に `/benchmark/query` の corpus filter 運用を追記した。

## 検証

- `./node_modules/.bin/tsx --test apps/api/src/agent/graph.test.ts apps/api/src/agent/nodes/node-units.test.ts apps/api/src/search/hybrid-search.test.ts`: pass
- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/api`: pass
- `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/api`: pass
- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/benchmark`: pass
- `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/benchmark`: pass
- `git diff --check`: pass
- mock API に対する `mmrag-docqa-v1` sample benchmark: runner exit 0

mock benchmark summary:

- `retrievalRecallAt20`: 1
- `expectedFileHitRate`: 1
- `citationHitRate`: 1
- `refused_rows`: 0
- `avgIterations`: 1.33
- `avgRetrievalCalls`: 1.33
- `p95_latency_ms`: 42

## Fit 評価

- AC1: `graph.test.ts` と mock benchmark で `mmrag-docqa-method.md` が retrieval / citation に入ることを確認した。
- AC2: `graph.test.ts` で `sufficient_context_gate` の `ANSWERABLE` を確認し、mock benchmark でも誤拒否は 0 行になった。
- AC3: 同一候補集合・同一 action の新規 evidence なし再探索を停止する実装を入れ、mock benchmark の平均 retrieval call は 1.33 になった。
- AC4: API / benchmark の test と typecheck を実行し pass を確認した。
- AC5: `/benchmark/query` は既存の `benchmark:query` permission 境界のまま検索範囲を benchmark corpus に狭めており、benchmark 固有の期待語句や QA sample 固有値は回答実装へ入れていない。

## 未対応・制約・リスク

- production API / Bedrock を使った live benchmark は実行していない。今回は local mock API で runner と retrieval/citation 指標を確認した。
- mock benchmark の `answerableAccuracy` は 0.3333 のまま残った。mock final answer が期待文字列を含まない snippet を返したためで、retrieval / citation / refusal の今回の原因とは別扱い。
- `npm ci` 実行時に `1 moderate severity vulnerability` の audit notice が出たが、本件の性能改善スコープ外として未対応。
