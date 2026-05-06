# search benchmark PR conflict resolution

## 受けた指示

- PR branch の競合を解消する。

## 要件整理

- `origin/main` の最新変更を取り込み、PR branch `codex/search-benchmark-performance` が conflict なしで merge 可能な状態にする。
- 既存の search benchmark 性能改善を維持する。
- main 側の `mmrag-docqa-v1`、`search-smoke-v1`、PDF corpus seed、Allganize runner 変更を落とさない。
- 解消後に必要な最小検証を実行する。

## 検討・判断

- `origin/main` へ rebase し、search benchmark seed / alias metadata / report 出力の変更を main 側の benchmark runner 拡張に重ねた。
- `benchmark/datasets/search.sample.jsonl` は、local mock 環境で安定して検証できる lexical + alias + ACL negative の 3 行に維持した。
- ACL negative は dataset user override を使うため、local benchmark 検証では `LOCAL_AUTH_GROUPS=BENCHMARK_RUNNER` を付けて実運用 runner と同じ権限前提にした。

## 実施作業

- `git fetch origin` 後、`git rebase origin/main` を実行。
- 以下の conflict を解消。
  - `.codex/completion-status.json`
  - `memorag-bedrock-mvp/README.md`
  - `memorag-bedrock-mvp/apps/api/src/app.ts`
  - `memorag-bedrock-mvp/benchmark/datasets/search.sample.jsonl`
  - `memorag-bedrock-mvp/benchmark/search-run.ts`
  - `memorag-bedrock-mvp/docs/LOCAL_VERIFICATION.md`
  - `memorag-bedrock-mvp/docs/OPERATIONS.md`
  - `memorag-bedrock-mvp/infra/lib/memorag-mvp-stack.ts`
  - `memorag-bedrock-mvp/infra/test/__snapshots__/memorag-mvp-stack.snapshot.json`
  - `memorag-bedrock-mvp/infra/test/memorag-mvp-stack.test.ts`
- completion status に rebase 後検証を追記。

## 検証

- `rg -n "<<<<<<<|=======|>>>>>>>" memorag-bedrock-mvp .codex tasks --glob '!reports/**'`: pass
- `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/benchmark`: pass
- `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/api`: pass
- `npm --prefix memorag-bedrock-mvp test -w @memorag-mvp/benchmark`: pass
- `npm --prefix memorag-bedrock-mvp test -w @memorag-mvp/api -- src/contract/api-contract.test.ts src/search/hybrid-search.test.ts`: pass
- `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/infra`: pass
- `npm --prefix memorag-bedrock-mvp test -w @memorag-mvp/infra`: pass
- `API_BASE_URL=http://localhost:18792 task benchmark:search:sample`: pass
  - local API: `MOCK_BEDROCK=1 LOCAL_AUTH_GROUPS=BENCHMARK_RUNNER PORT=18792`
  - `total=3`, `succeeded=3`, `failedHttp=0`
  - `recallAt20=1`, `expectedFileHitRate=1`, `ndcgAt10=1`
  - `noAccessLeakCount=0`, `errorRate=0`, `p95LatencyMs=18`
- `git diff --check`: pass

## 成果物

- Rebased PR branch: `codex/search-benchmark-performance`
- PR: https://github.com/tsuji-tomonori/rag-assist/pull/138
- 本レポート: `reports/working/20260507-0000-resolve-search-benchmark-conflicts.md`

## fit 評価

- 指示された競合解消は完了。
- search benchmark の改善結果は rebase 後も維持されている。
- main 側の追加 benchmark suite / PDF corpus seed / Allganize runner 変更は保持した。

## 未対応・制約・リスク

- remote CodeBuild / production API での benchmark 再実行は未実施。
- root Taskfile の `benchmark:search:sample` は存在しないため、検証は `memorag-bedrock-mvp` 配下の Taskfile で実行した。
