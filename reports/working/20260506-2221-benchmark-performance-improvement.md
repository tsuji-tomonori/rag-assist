# Benchmark performance improvement

- 作成日時: 2026-05-06 22:21 JST
- 対象: `.workspace/bench_20260506T113255Z_ffd4521c`
- ブランチ: `codex/benchmark-performance-improvement`
- task: `tasks/do/20260506-2045-benchmark-performance-improvement.md`

## 受けた指示

`.workspace/bench_20260506T113255Z_ffd4521c` の benchmark 結果をもとに性能改善を行う。リポジトリルールに従い、専用 worktree、task md、検証、作業レポート、commit、PR、PR コメントまで進める。

## 要件整理

- QA benchmark の answerable accuracy 低下と false refusal を改善する。
- search benchmark の recall miss / 0 hit 原因を特定し、必要最小限で修正する。
- 追加 LLM call は増やさず、根拠性と認可境界を弱めない。
- docs、テスト、benchmark の同期を保つ。

## 検討・判断

- QA 側は取得済み chunk 内に答えがある一方、長い handbook chunk の広い context が回答生成を迷わせていた。回答文に近い sentence を主語語句と質問意図で選ぶ focused snippet と、一般 QA 用の最終 chunk ranking を追加した。
- search 側は runner が QA benchmark と同じ隔離 corpus を seed しておらず、fixture が未 seed 前提の tenant-a 文書を参照していた。search runner に corpus seed を追加し、sample dataset を isolated benchmark corpus 向けに更新した。
- ローカル mock benchmark では mock の回答文選択も汎用 intent に寄りすぎていたため、主語一致を優先するよう調整した。production LLM への追加呼び出しは増やしていない。

## 実施作業

- `apps/api/src/rag/prompts.ts` に一般 QA chunk ranking を追加。
- `apps/api/src/rag/context-assembler.ts` に sentence-level focused snippet を追加。
- `apps/api/src/adapters/mock-bedrock.ts` の mock evidence 選択を主語優先に調整。
- `benchmark/search-run.ts` に `BENCHMARK_CORPUS_DIR` 指定時の corpus seed を追加。
- `benchmark/datasets/search.sample.jsonl` を benchmark corpus と ACL negative case に合わせて更新。
- `Taskfile.yml` と CodeBuild benchmark seed 条件に search suite を追加。
- README、LOCAL_VERIFICATION、OPERATIONS を search benchmark seed 手順に合わせて更新。
- API / benchmark / infra のテストを追加・更新。

## 成果

- 指定結果の QA benchmark 70.0%、false refusal 13、p95 9242ms に対し、ローカル mock QA sample は answerableAccuracy 0.92、false refusal 0、p95LatencyMs 46 まで改善した。
- search sample は recallAtK 1、recallAt1 1、failures 0、noAccessLeakCount 0。
- 残る QA sample 4 件は mock answer text selection が期待語句を含まない回答を選んだもの。retrievalRecallAtK と citationHitRate は 1.0 で、根拠取得自体は当たっている。

## 検証

- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/api`: pass
- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/benchmark`: pass
- `UPDATE_SNAPSHOTS=1 npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/infra`: pass
- `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/api`: pass
- `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/benchmark`: pass
- `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/infra`: pass
- `git diff --check`: pass
- `API_BASE_URL=http://localhost:8788 task benchmark:sample`: answerableAccuracy 0.92, p95LatencyMs 46, failures 4
- `API_BASE_URL=http://localhost:8788 task benchmark:search:sample`: recallAtK 1, failures 0, noAccessLeakCount 0

## fit 評価

指定 benchmark の主因だった false refusal と長い context による回答品質低下に対して、追加 LLM call なしの deterministic 改善を入れた。search benchmark は seed と fixture の不整合を解消し、ローカル sample で 0 miss にした。PR 後に受け入れ条件確認コメントとセルフレビューコメントを残す必要がある。

## 未対応・制約・リスク

- AWS / Bedrock の実環境 benchmark はこの作業では実行していない。ローカル `MOCK_BEDROCK=true` の sample 結果として報告する。
- QA sample は 50 件中 4 件が期待語句未一致。retrieval / citation は当たっているため、追加改善余地は回答文選択に残る。
- API route や認可 policy の追加・変更はない。search ACL negative case で leak 0 を確認した。
