# GitHub Actions 性能テスト実行ループ

状態: blocked

## 背景

PR #221 で multi-turn / conversational RAG benchmark の P0/P1 が追加された。ユーザーから、新しく追加した性能テストを GitHub Actions から実行して性能改善ループを回すよう依頼された。

## 目的

GitHub Actions から新しい benchmark suite を実行できる状態にし、Actions 実行結果を確認して、必要な性能・実行性の改善を行う。

## スコープ

- `memorag-benchmark-run.yml` の手動実行入力が新 suite を選択できるか確認・修正する。
- GitHub Actions で新 suite を実行し、結果・artifact・ログを確認する。
- 実行失敗または性能上の明確な改善点があれば、範囲内で修正して再実行する。
- PR コメントと作業レポートに実施結果を残す。

## 作業計画

1. GitHub Actions workflow と benchmark suite 定義を確認する。
2. Actions から新 suite を選べない場合は workflow を修正する。
3. ローカルで変更範囲に見合う検証を実行する。
4. 変更を commit / push し、PR #221 を更新する。
5. GitHub Actions から benchmark を実行し、結果を確認する。
6. 結果に応じて修正・再実行のループを回す。
7. PR に受け入れ条件確認・セルフレビュー・性能テスト結果をコメントする。

## ドキュメント保守計画

本作業は CI workflow と benchmark 実行導線の変更が中心。README や仕様ドキュメントに手動 benchmark suite 一覧の同期記述がある場合は更新要否を確認する。該当がなければ PR 本文・コメント・作業レポートで理由を記録する。

## 受け入れ条件

- [x] GitHub Actions の `Run MemoRAG Benchmark` から新 suite を選択できる。
- [ ] 少なくとも 1 つの新 suite を GitHub Actions から実行し、run URL / 結果 / artifact 有無を記録する。
- [x] 実行結果から確認できる失敗または改善点に対して、修正または未対応理由を記録する。
- [x] 変更範囲に見合うローカル検証を実行し、結果を記録する。
- [ ] PR #221 に日本語コメントで受け入れ条件確認とセルフレビューを残す。
- [x] 作業完了レポートを `reports/working/` に作成する。

## 検証計画

- `git diff --check`
- benchmark workflow YAML の suite-id 選択肢と benchmark suite 定義の整合確認
- 必要に応じて `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/benchmark`

## PR レビュー観点

- Actions から実行する suite ID が API 側の suite ID と一致しているか。
- 既存 suite の選択肢や既存実行導線を壊していないか。
- 実 benchmark 結果を未検証なのに pass と扱っていないか。

## リスク

- GitHub Actions の benchmark 実行は AWS 環境・secrets・environment approval に依存するため、リポジトリ権限や環境制約で blocked になる可能性がある。

## 実施結果

- `Run MemoRAG Benchmark` の `suite-id` 選択肢へ `mtrag-v1` / `chatrag-bench-v1` / 既存 API suite を追加した。
- `mtrag-v1` / `chatrag-bench-v1` の軽量 sample dataset を追加し、CDK deploy で `BenchmarkBucket` の `datasets/agent/` に配置するよう更新した。
- CodeBuild runner が新 suite でも `standard-agent-v1` corpus を seed するよう更新した。
- GitHub Actions run `25589515162` を `mtrag-v1` で起動した。
  - URL: https://github.com/tsuji-tomonori/rag-assist/actions/runs/25589515162
  - 結果: failed
  - 失敗理由: `OPERATOR_AUTH_SECRET_ID is required`
  - artifact: `Start benchmark through API` が secret preflight で終了したため、benchmark API artifact は生成されなかった。

## 検証結果

- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/benchmark`: pass
- `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/infra`: pass
- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/infra`: fail。CDK snapshot 差分のみ。
- `env UPDATE_SNAPSHOTS=1 npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/infra`: pass。snapshot 更新。
- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/infra`: pass
- `git diff --check`: pass

## ブロック事項

- GitHub `dev` environment には `AWS_DEPLOY_ROLE_ARN` のみ存在し、`BENCHMARK_OPERATOR_AUTH_SECRET_ID` が未設定だった。
- `mtrag-v1` / `chatrag-bench-v1` の dataset 配置と workflow 選択肢はこの PR の変更であり、dev stack に deploy されるまで deployed API / BenchmarkBucket には反映されない。
- そのため、現時点では新 suite の GitHub Actions 実 benchmark 完走と性能改善値の確認は未達。

## 次に必要な操作

1. `dev` environment に `BENCHMARK_OPERATOR_AUTH_SECRET_ID` を設定する。
2. PR #221 の CDK / API 変更を dev stack に deploy する。
3. `Run MemoRAG Benchmark` を `suite-id=mtrag-v1` または `suite-id=chatrag-bench-v1` で再実行する。
4. artifact の `summary.json` / `report.md` / `results.jsonl` を確認し、失敗行または latency 指標に応じて P2/P3/P4 task へ改善をつなげる。
