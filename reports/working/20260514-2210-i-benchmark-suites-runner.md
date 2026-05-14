# 作業完了レポート

保存先: `reports/working/20260514-2210-i-benchmark-suites-runner.md`

## 1. 受けた指示

- 主な依頼: Wave 5 `I-benchmark-suites-and-runner` として、benchmark suite / runner / artifact contract の最小実装を Worktree Task PR Flow で完了する。
- 成果物: benchmark contract schema、runner summary artifact 追加、suite metadata manifest、docs、tests、task md、PR。
- 条件: `origin/main` から専用 worktree / branch を作成し、task md に受け入れ条件を作業前に記載する。PR title/body/comment は日本語、commit message は日本語 gitmoji 形式にする。
- 制約: J2 debug / middleware worker の変更を revert せず、debug/middleware files は触らない。API route / infra は必要最小限に留める。

## 2. 要件整理

| 要件ID | 指示・要件 | 重要度 | 対応状況 |
| --- | --- | ---: | --- |
| R1 | 既存 JSONL / suite manifest を壊さず canonical benchmark contract を追加 | 高 | 対応 |
| R2 | agent / search / conversation runner の suite metadata を明示 | 高 | 対応 |
| R3 | `benchmark_grounded_short` を metadata / suite profile 切替 contract として固定 | 高 | 対応 |
| R4 | baseline / candidate、case result、failure reason、retrieval / citation / latency / cost、seed / skip manifest を artifact contract 化 | 高 | 対応 |
| R5 | CodeBuild runner の既存 fail-fast / validation / artifact flow を壊さない | 高 | 対応 |
| R6 | S3 Vectors metadata budget と Lambda quota / timeout 方針を docs/test に残す | 高 | 対応 |
| R7 | 検証を実行し、未実施を実施済み扱いしない | 高 | 対応 |

## 3. 検討・判断したこと

- API route / permission は変更せず、benchmark package と `packages/contract` への互換的な optional artifact 追加に絞った。
- 既存 JSONL 行の schema を強制変更せず、summary artifact に canonical `suite`, `candidateConfig`, `caseResults`, `datasetPrepareRuns`, `seedManifest`, `skipManifest` を追加する方針にした。
- `benchmark_grounded_short` は runtime の dataset row id 分岐ではなく、`BenchmarkSuite.answerPolicy` の contract として `switchBy=benchmark_metadata` を固定した。
- cost は実測 usage がまだ runner response から安定取得できないため、架空値を入れず optional contract とした。
- CodeBuild manifest は既存 suite id / runner / dataset source を維持し、`metadata` を追加するだけに留めた。

## 4. 実施した作業

- `packages/contract/src/schemas/benchmark.ts` に `BenchmarkSuite`, `BenchmarkCase`, `BenchmarkRun`, `BenchmarkTargetConfig`, `BenchmarkDatasetPrepareRun` などの zod schema / TS type を追加。
- `benchmark/artifact-contract.ts` を追加し、runner 共通の suite metadata、target config、case result、dataset prepare run、quota constants を生成する helper を実装。
- `benchmark/run.ts`, `benchmark/search-run.ts`, `benchmark/conversation-run.ts` の summary output に artifact contract fields を追加。
- `benchmark/suites.codebuild.json` と `benchmark/codebuild-suite.ts` に suite metadata / env propagation / validation を追加。
- `benchmark/artifact-contract.test.ts` と既存 CodeBuild suite test を更新。
- `docs/spec/benchmark-artifact-contract.md` と `docs/spec/CHAPTER_TO_REQ_MAP.md` を更新。

## 5. 成果物

| 成果物 | 形式 | 内容 | 指示との対応 |
| --- | --- | --- | --- |
| `packages/contract/src/schemas/benchmark.ts` | TypeScript | canonical benchmark schema / type | R1, R3, R4 |
| `benchmark/artifact-contract.ts` | TypeScript | runner artifact helper / quota constants | R2, R3, R4, R6 |
| `benchmark/run.ts`, `benchmark/search-run.ts`, `benchmark/conversation-run.ts` | TypeScript | summary artifact fields 追加 | R2, R4 |
| `benchmark/suites.codebuild.json` | JSON | suite metadata 追加 | R2, R5 |
| `docs/spec/benchmark-artifact-contract.md` | Markdown | artifact contract と運用制約の説明 | R1, R3, R4, R6 |
| `benchmark/artifact-contract.test.ts` | TypeScript test | schema / policy / quota regression | R1, R3, R4, R6 |

## 6. 指示へのfit評価

| 評価軸 | 評価 | 理由 |
| --- | --- | --- |
| 指示網羅性 | 4.7 / 5 | 指定の最小 scope は満たした。API route / infra は不要と判断して触っていない。 |
| 制約遵守 | 4.8 / 5 | debug/middleware files と J2 領域は触らず、dataset 固有分岐も入れていない。 |
| 成果物品質 | 4.5 / 5 | 型・helper・docs・tests を揃えた。cost は optional contract に留めた。 |
| 説明責任 | 4.6 / 5 | docs と report に scope-out / quota / risk を記録した。 |
| 検収容易性 | 4.6 / 5 | contract schema と runner summary fields がレビューしやすい形になっている。 |

総合fit: 4.6 / 5.0（約92%）
理由: 最小実装として主要要件は満たしたが、外部 dataset full 実行、CodeBuild 実環境 artifact upload、promotion gate は明示 scope-out / 未実施のため満点ではない。

## 7. 実行した検証

- `npm ci`: pass
- `npm run typecheck -w @memorag-mvp/benchmark`: 初回は `tsc` 未導入で fail、`npm ci` 後に pass
- `npm test -w @memorag-mvp/benchmark`: pass
- `npm run typecheck -w @memorag-mvp/contract`: pass
- `git diff --check`: pass

## 8. 未対応・制約・リスク

- 外部 dataset の実 download / full benchmark 再実行は scope-out のため未実施。
- CodeBuild 実環境での artifact upload / metrics update はローカル unit test と既存 flow 維持の確認に留めた。
- API route / permission は変更していないため、API contract / OpenAPI 更新は不要と判断した。
- `npm ci` 後に npm audit が 4 件の脆弱性を報告したが、依存更新は今回 scope ではないため未対応。
