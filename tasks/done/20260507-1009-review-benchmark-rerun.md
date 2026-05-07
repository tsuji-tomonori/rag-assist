# benchmark rerun 結果確認

保存先: `tasks/done/20260507-1009-review-benchmark-rerun.md`

状態: done

## 背景

ユーザーが Phase 1 変更後の benchmark を再実行し、結果ディレクトリ `.workspace/bench_20260507T004152Z_b6398dac` が提示された。

## 目的

benchmark summary / report / raw results を確認し、Phase 1 の意図通りに改善しているかを判定する。

## 対象範囲

- `.workspace/bench_20260507T004152Z_b6398dac/benchmark-summary-bench_20260507T004152Z_b6398dac.json`
- `.workspace/bench_20260507T004152Z_b6398dac/benchmark-report-bench_20260507T004152Z_b6398dac.md`
- `.workspace/bench_20260507T004152Z_b6398dac/benchmark-results-bench_20260507T004152Z_b6398dac.jsonl`

## 方針

- 前回提示値と今回の主要 metric を比較する。
- remaining failures を Phase 1 / Phase 3 / Phase 4 に分類する。
- 実行していない追加 benchmark は実施済み扱いしない。

## 必要情報

- 前回の主要 metric: `answerable_accuracy=76.0%`、`citation_hit_rate=80.0%`、`expected_file_hit_rate=98.0%`、`retrieval_recall_at_20=94.0%`、`refusal_precision=0.0%`、p50 11.3 秒、p95 20.6 秒。
- 今回の summary / report は 2026-05-07T00:53:59Z 生成。

## 実行計画

1. artifact のファイル構成を確認する。
2. summary metrics を確認する。
3. report failures と row details を確認する。
4. ans-010 の raw trace を確認する。
5. 意図通りかと残件を整理する。

## ドキュメントメンテナンス計画

- 実装や公開 docs の変更は行わない。
- 調査結果は `reports/working/` に保存する。

## 受け入れ条件

- [x] benchmark artifact の主要指標を確認した。
- [x] 残失敗を分類した。
- [x] Phase 1 の意図通りかを判定した。
- [x] 未実施検証を実施済み扱いしていない。

## 検証計画

- `jq` / `sed` / `rg` による artifact 読み取り。

## PRレビュー観点

- なし。調査のみ。

## 未決事項・リスク

- benchmark 全量の再実行自体はユーザー実行結果を確認したもので、こちらでは再実行していない。
