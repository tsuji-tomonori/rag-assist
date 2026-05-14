# Benchmark artifact contract

## 目的

Phase I の benchmark runner は、既存 JSONL dataset と suite manifest を維持したまま、summary artifact に canonical contract を併記する。管理画面刷新、promotion API、async agent runner 本実装、外部 dataset full 実行はこの contract の後続 scope とする。

## Canonical mapping

| Canonical entity | 現行入力・出力との対応 |
| --- | --- |
| `BenchmarkSuite` | `benchmark/suites.codebuild.json` の `suiteId`, `runner`, `metadata.useCase`, `dataset`, `corpus` と runner env から summary の `suite` に出力する。 |
| `BenchmarkCase` | 既存 JSONL 行の `id`, `question` / `query`, `expectedContains`, `expectedRegex`, `expectedFiles`, `expectedPages`, `answerable`, `expectedResponseType`, `metadata` を互換 mapping とする。 |
| `BenchmarkRun` | runner summary の `artifactContractVersion`, `suite`, `baselineConfig`, `candidateConfig`, `caseResults`, `datasetPrepareRuns`, `seedManifest`, `skipManifest` とする。 |
| `BenchmarkTargetConfig` | `MODEL_ID`, `EMBEDDING_MODEL_ID`, `TOP_K`, `MEMORY_TOP_K`, `MIN_SCORE`, API base URL, evaluator profile, runner 種別を保存する。 |
| `BenchmarkDatasetPrepareRun` | dataset source、corpus seed 結果、抽出不能・未実行 skip、変換 version を保存する。 |

Schema の正本は `packages/contract/src/schemas/benchmark.ts`、runner 側の生成 helper は `benchmark/artifact-contract.ts` に置く。

## Suite metadata

agent / search / conversation runner の suite metadata は以下を明示する。

| Field | 意味 |
| --- | --- |
| `useCase` | `internal_qa`, `multi_turn_rag`, `chat_rag`, `search_retrieval`, `long_pdf_qa`, `design_drawing_qa`, `knowledge_quality`, `public_pdf_qa`, `async_agent_task` のいずれか。 |
| `runner` | `agent`, `search`, `conversation`, `async_agent` のいずれか。`async_agent` は contract だけで、本実装は scope-out。 |
| `corpus` | `source=benchmark-runner`, `docType=benchmark-corpus`, `benchmarkSuiteId`, `aclGroups=["BENCHMARK_RUNNER"]` の isolation を含む。 |
| `datasetSource` | `local`, `codebuild-input`, `prepare`, `external` と dataset name/version/conversion version。 |
| `evaluatorProfile` | suite-level evaluator profile。case-level override は runner が互換維持のため読むが、suite と比較可能であることを検証する。 |

## Benchmark answer policy

`benchmark_grounded_short` は `BenchmarkSuite.answerPolicy` として固定する。

- `answerStyle`: `benchmark_grounded_short`
- `switchBy`: `benchmark_metadata`
- `normalAnswerPolicySeparated`: `true`
- `runtimeDatasetBranchAllowed`: `false`

切替条件は benchmark metadata / suite profile に限る。dataset row id、期待語句、個別ファイル名を RAG runtime の分岐条件にしてはいけない。通常回答 policy は benchmark policy と分離する。

## Artifact fields

Runner summary は既存 field を残したうえで以下を追加する。

- `artifactContractVersion: 1`
- `suite`
- `baselineConfig`
- `candidateConfig`
- `caseResults`
- `datasetPrepareRuns`
- `seedManifest`
- `skipManifest`

`caseResults` は case-level の `status`, `failureReasons`, `retrieval`, `citation`, `latency`, `cost` を持つ。cost は provider usage が取得できる場合だけ入れ、取得できない場合は架空値で埋めない。

`seedManifest` と `skipManifest` には secret、signed URL、token、raw debug trace を入れない。artifact download URL は API の signed URL response に限定し、runner artifact には保存しない。

## Operational constraints

- CodeBuild runner は auth fail-fast、token mask、suite input validation、timeout、artifact upload、metrics update の既存経路を維持する。
- S3 Vectors filterable metadata budget は 2048 bytes。benchmark compact metadata は 1500 bytes 以内を目安にする。
- benchmark / ingest 系 Lambda quota は 15 分 timeout / 3008MB を前提にし、この task では 30 分 / 4096MB へ戻さない。
- BENCHMARK_RUNNER は `benchmark:query` と `benchmark:seed_corpus` を中心にした最小権限境界を維持する。
- benchmark corpus は通常チャット検索対象に混ぜない。
