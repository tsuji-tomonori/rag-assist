# 作業完了レポート

保存先: `reports/working/20260522-0000-benchmark-pipeline-if.md`

## 1. 受けた指示

- 性能テストを `init.sh` と JSON spec に分離し、共通論理パイプラインとして扱う。
- `benchmarks/suites/`、`benchmarks/_shared/`、`artifacts/benchmarks/` に責務を分ける。
- corpus、run spec、case、Chat result、評価、出力 artifact、運用ポリシー、最小構成、単体テストの方針を反映する。

## 2. 要件整理

| 要件ID | 指示・要件 | 重要度 | 対応状況 |
|---|---|---:|---|
| R1 | `benchmarks/_shared/` に schema / scripts / configs を置く | 高 | 対応 |
| R2 | `benchmarks/suites/<useCase>/<suiteId>/` の sample suite を置く | 高 | 対応 |
| R3 | suite 固有 `init.sh` は共通 script に委譲する | 高 | 対応 |
| R4 | artifact は `artifacts/benchmarks/` に分離し Git 管理外にする | 高 | 対応 |
| R5 | UT-BENCH-DIR 系の静的 validation を実装する | 高 | 対応 |
| R6 | 実 API upload / chat execution / evaluator 本実装 | 中 | contract-only として後続扱い |

## 3. 検討・判断したこと

- 既存 `benchmark/` workspace は runner 互換層として残し、今回の I/F は新規 `benchmarks/` 契約レイヤとして追加した。
- 実 API 呼び出しを未実装のまま成功扱いしないよう、`run-suite.sh` の出力は blocked summary として明示した。
- validation は外部依存を増やさず Node.js 標準 API で実装し、suite 構造と cross-file consistency を確認する方針にした。
- `docs/spec/benchmark-artifact-contract.md` は既存 runner contract の説明なので、今回の詳細は `benchmarks/README.md` に集約した。

## 4. 実施した作業

- `benchmarks/_shared/schemas/` に corpus / run / case / seed manifest / chat result / case result / run summary の JSON Schema を追加した。
- `benchmarks/_shared/scripts/validate-suite.mjs` と shell wrapper 群を追加した。
- `benchmarks/_shared/configs/`、`fixtures/`、`evaluators/` に共通定義を追加した。
- sample suite `benchmarks/suites/internal_qa/leave_policy_v1/` を追加した。
- `artifacts/benchmarks/.gitignore` を追加し、生成 artifact を Git 管理外にした。
- validation script の単体テストを追加した。

## 5. 成果物

| 成果物 | 形式 | 内容 | 指示との対応 |
|---|---|---|---|
| `benchmarks/README.md` | Markdown | benchmark I/F と運用ルール | 責務分離と推奨構成に対応 |
| `benchmarks/_shared/` | JSON / shell / mjs | 共通 schema、config、script、validation | 共通 runner 層に対応 |
| `benchmarks/suites/internal_qa/leave_policy_v1/` | JSON / JSONL / shell | sample suite | suite 固定入力に対応 |
| `artifacts/benchmarks/.gitignore` | gitignore | artifact 分離 | 生成物の Git 管理除外に対応 |
| `reports/working/20260522-0000-benchmark-pipeline-if.md` | Markdown | 作業完了レポート | Post Task Work Report に対応 |

## 6. 指示への fit 評価

| 評価軸 | 評価 | 理由 |
|---|---|---|
| 指示網羅性 | 4 | directory / I/F / validation / sample suite は反映。実 API runner は後続扱い。 |
| 制約遵守 | 5 | worktree、task md、report、実施済み検証のみ記録する方針を遵守。 |
| 成果物品質 | 4 | 静的 validation とテストはあるが、API 結合は未配線。 |
| 説明責任 | 5 | 未対応範囲と blocked summary を明示。 |
| 検収容易性 | 5 | validation command と sample suite で確認可能。 |

総合fit: 4.5 / 5.0（約90%）

## 7. 実行した検証

- `npm ci`: pass。
- `node benchmarks/_shared/scripts/validate-suite.mjs --suite-dir benchmarks/suites/internal_qa/leave_policy_v1`: pass。
- `node --test benchmarks/_shared/scripts/validate-suite.test.mjs`: pass。
- `./benchmarks/suites/internal_qa/leave_policy_v1/init.sh --env dev --reset-corpus --out ./artifacts/benchmarks/leave_policy_v1/init/2026-05-21.001`: pass。
- `./benchmarks/_shared/scripts/run-suite.sh --spec ./benchmarks/suites/internal_qa/leave_policy_v1/benchmark.run.json --env dev --out ./artifacts/benchmarks/leave_policy_v1/runs/benchrun_001`: pass。
- `npm test -w @memorag-mvp/benchmark`: pass。
- `npm run lint -- benchmarks/_shared/scripts/validate-suite.mjs benchmarks/_shared/scripts/validate-suite.test.mjs`: fail -> 未使用 import を修正後 pass。
- `git diff --cached --check`: pass。

## 8. 未対応・制約・リスク

- `init-suite.sh` は現時点では validation と skeleton artifact 生成までで、PDF upload / ingest polling / index ready の API 結合は未実装。
- `run-suite.sh` は Chat API 呼び出し、正規化、評価、promotion gate の実 execution を未配線として blocked summary にする。
- sample PDF は repository 管理用の小さな placeholder であり、実 ingest 品質を保証する corpus ではない。
