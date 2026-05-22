# Benchmark pipeline contracts

`benchmarks/` は、RAG benchmark を品質ゲートとして実行するための入力定義と共通 I/F を置く場所です。既存の `benchmark/` workspace は互換 runner として維持し、このツリーでは suite、corpus、case、run spec、promotion gate、artifact の責務分離を明示します。

## 共通論理パイプライン

```text
prepare_dataset
  -> seed_corpus_by_init_sh
  -> ingest_or_reindex
  -> verify_index_ready
  -> execute_chat_api_cases
  -> normalize_chat_results
  -> evaluate_results
  -> promotion_gate
  -> export_artifacts
```

## ディレクトリ

```text
benchmarks/
  _shared/
    schemas/
    scripts/
    configs/
    fixtures/
    evaluators/
  suites/
    <useCase>/<suiteId>/
      init.sh
      suite.json
      corpus.json
      cases.jsonl
      benchmark.run.json
      config/
      corpus/
      expected/
      fixtures/

artifacts/
  benchmarks/
```

`benchmarks/suites/<useCase>/<suiteId>/` を 1 つの benchmark 単位にします。`suiteId` は `suite.json`、`corpus.json`、`benchmark.run.json`、`cases.jsonl`、artifact path で同じ値を使います。

## 責務

- `init.sh`: suite 固有の corpus seed entrypoint。実処理は `benchmarks/_shared/scripts/init-suite.sh` に委譲します。
- `corpus.json`: benchmark scope と投入 document を定義します。`benchmarkScope.scopeType` は `benchmark` で固定します。
- `benchmark.run.json`: cases、target config、answer policy、promotion gate、artifact output を宣言します。
- `cases.jsonl`: 1 行 1 case の gold data です。
- `artifacts/benchmarks/`: run summary、case results、chat/evaluation results、trace link などの実行生成物を保存します。Git 管理対象外です。

## コマンド

```bash
./benchmarks/suites/internal_qa/leave_policy_v1/init.sh \
  --env dev \
  --reset-corpus \
  --out ./artifacts/benchmarks/leave_policy_v1/init/2026-05-21.001

./benchmarks/_shared/scripts/validate-suite.sh \
  --suite-dir ./benchmarks/suites/internal_qa/leave_policy_v1

./benchmarks/_shared/scripts/run-suite.sh \
  --spec ./benchmarks/suites/internal_qa/leave_policy_v1/benchmark.run.json \
  --env dev \
  --out ./artifacts/benchmarks/leave_policy_v1/runs/benchrun_001
```

## 検証範囲

`validate-suite.sh` は以下を静的に検証します。

- 必須ファイルが存在する。
- `suiteId` が suite / corpus / run spec / cases で一致する。
- suite 固有 `init.sh` が共通 `init-suite.sh` に委譲している。
- `corpus.json.documents[].filePath` が suite directory 相対で存在する。
- `cases.jsonl.expectedDocumentKeys` が corpus document key に存在する。
- `benchmark.run.json` の config path が存在する。
- `benchmarkScope.scopeType` が `benchmark` である。
- `artifacts/benchmarks` が Git 管理対象外である。
- suite 入力、shared config、shell script、artifact ignore に secret / token / password の実値らしい値がない。

## Secret と trace

runner 認証情報は service user と secret resolver で解決し、token、password、secret の値を stdout、stderr、artifact に出しません。trace は `operator_sanitized` 以上で失敗分析に使える粒度を保持し、権限外文書名、secret、内部 judge prompt を artifact に含めません。
