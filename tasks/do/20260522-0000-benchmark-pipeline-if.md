# Benchmark pipeline I/F と suite 構成の追加

状態: in_progress

## 背景

性能テストを `init.sh` と JSON spec に分離し、corpus seed、ingest/index ready、Chat API 実行、評価、promotion gate、artifact export を共通論理パイプラインとして扱う方針が提示された。

## 目的

`benchmarks/suites/` に suite 入力定義を固定し、`benchmarks/_shared/` に共通 schema / script / config を置き、`artifacts/benchmarks/` に実行結果を分離する最小構成を追加する。

## タスク種別

機能追加

## スコープ

- benchmark corpus / run / case / seed manifest / chat result / case result / run summary の JSON Schema を追加する。
- suite directory validation を実装し、提示された UT-BENCH-DIR 系の静的検証をカバーする。
- sample suite `benchmarks/suites/internal_qa/leave_policy_v1/` を追加する。
- suite 固有 `init.sh` は共通 script に委譲する。
- artifact 出力先を `artifacts/benchmarks/` に分離し、Git 管理対象外にする。
- README と作業レポートを更新する。

## 実装計画

1. 既存 benchmark runner / artifact contract と衝突しないよう、新規 `benchmarks/` ツリーを追加する。
2. `_shared/schemas/` に Draft 2020-12 互換の JSON Schema を置く。
3. `_shared/scripts/validate-suite.mjs` と wrapper shell scripts を追加する。
4. sample suite と共通 config を追加する。
5. `artifacts/benchmarks/.gitignore` を追加する。
6. 最小検証として validation script、benchmark workspace test、diff whitespace check を実行する。

## ドキュメント保守計画

- `benchmarks/README.md` に責務分離、ディレクトリ構成、I/F、検証コマンド、artifact 方針を記載する。
- 既存 `docs/spec/benchmark-artifact-contract.md` は既存 runner contract の説明であり、新規ツリーの詳細は `benchmarks/README.md` に限定する。

## 受け入れ条件

- AC1: `benchmarks/_shared/` と `benchmarks/suites/internal_qa/leave_policy_v1/` の最小構成が存在する。
- AC2: suite directory は `init.sh`、`suite.json`、`corpus.json`、`cases.jsonl`、`benchmark.run.json` を持つ。
- AC3: `suiteId` が `suite.json`、`corpus.json`、`benchmark.run.json`、`cases.jsonl` で一致する。
- AC4: suite 固有 `init.sh` は共通 `benchmarks/_shared/scripts/init-suite.sh` を呼び出す。
- AC5: `corpus.json.documents[].filePath` と `benchmark.run.json` の config path は suite directory 相対で解決できる。
- AC6: `cases.jsonl.expectedDocumentKeys` は `corpus.json.documents[].documentKey` に存在する。
- AC7: `artifacts/benchmarks` 配下の生成物は Git 管理対象外である。
- AC8: suite / shared config / shell script / artifact ignore に secret、token、password の実値を含めない。
- AC9: validation script が sample suite に対して pass する。

## 検証計画

- `node benchmarks/_shared/scripts/validate-suite.mjs --suite-dir benchmarks/suites/internal_qa/leave_policy_v1`
- `npm test -w @memorag-mvp/benchmark`
- `git diff --check`

## 検証結果

- `npm ci`: pass。worktree に `tsx` が無かったため依存関係を導入した。
- `node benchmarks/_shared/scripts/validate-suite.mjs --suite-dir benchmarks/suites/internal_qa/leave_policy_v1`: pass。
- `node --test benchmarks/_shared/scripts/validate-suite.test.mjs`: pass。
- `./benchmarks/suites/internal_qa/leave_policy_v1/init.sh --env dev --reset-corpus --out ./artifacts/benchmarks/leave_policy_v1/init/2026-05-21.001`: pass。contract-only runner として validation artifact を生成。
- `./benchmarks/_shared/scripts/run-suite.sh --spec ./benchmarks/suites/internal_qa/leave_policy_v1/benchmark.run.json --env dev --out ./artifacts/benchmarks/leave_policy_v1/runs/benchrun_001`: pass。Chat API 実行は未配線のため blocked summary を生成。
- `npm test -w @memorag-mvp/benchmark`: pass。
- `npm run lint -- benchmarks/_shared/scripts/validate-suite.mjs benchmarks/_shared/scripts/validate-suite.test.mjs`: fail -> 未使用 import を修正後 pass。
- `git diff --cached --check`: pass。

## PR レビュー観点

- 既存 `benchmark/` runner を破壊していないこと。
- schema と README の責務分離が一致していること。
- artifact / secret 方針が静的検証に反映されていること。

## リスク

- `init-suite.sh` と `run-suite.sh` は現時点では I/F validation と artifact skeleton 生成が中心で、実 API upload / chat execution は後続実装になる。
- sample PDF は小さな placeholder であり、実 ingest 成功の検証は API 実装後に行う。
