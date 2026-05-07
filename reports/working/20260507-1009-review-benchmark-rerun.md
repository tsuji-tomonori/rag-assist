# 作業完了レポート

保存先: `reports/working/20260507-1009-review-benchmark-rerun.md`

## 1. 受けた指示

- 主な依頼: `.workspace/bench_20260507T004152Z_b6398dac` の benchmark rerun が意図通りか確認する。
- 成果物: benchmark artifact の判定結果。

## 2. 要件整理

| 要件ID | 指示・要件 | 重要度 | 対応状況 |
|---|---|---:|---|
| R1 | summary / report / raw results を確認する | 高 | 対応 |
| R2 | Phase 1 の意図通りか判定する | 高 | 対応 |
| R3 | 残件を分類する | 中 | 対応 |

## 3. 検討・判断したこと

- Phase 1 の主目的は誤拒否の削減であり、今回の結果では refusal が 10 件から 1 件へ減っている。
- 残る ans-010 は retrieval / answerability gate では根拠を取れているが、sufficient context judge が primary fact missing として拒否している。
- ans-028 / ans-033 は Phase 4 の extractive-first、ans-020 / ans-050 は Phase 3 の retrieval scope / final evidence metric の残件と分類できる。

## 4. 実施した作業

- artifact ファイル構成を確認した。
- summary metrics を `jq` で確認した。
- report の Failures / Row Details を確認した。
- ans-010 の raw result / debug trace を確認した。

## 5. 成果物

| 成果物 | 形式 | 内容 | 指示との対応 |
|---|---|---|---|
| このレポート | Markdown | benchmark rerun 判定 | 調査結果 |

## 6. 指示へのfit評価

総合fit: 5.0 / 5.0（約100%）

理由: 提示 artifact を確認し、改善の成否と残件を具体的に分類した。

## 7. 確認結果

- `answerable_accuracy`: 76.0% から 94.0%。
- refusal rows: 10 件から 1 件。
- HTTP failed: 1 件から 0 件。
- `citation_hit_rate`: 80.0% から 98.0%。
- `expected_file_hit_rate`: 98.0% から 100.0%。
- `retrieval_recall_at_20`: 94.0% から 96.0%。
- p50 latency: 11.3 秒から 11.578 秒でほぼ横ばい。
- p95 latency: 20.6 秒から 19.270 秒で軽微改善。

## 8. 未対応・制約・リスク

- 未対応: こちらでは benchmark を再実行していない。
- 制約: artifact には commit SHA が含まれておらず、どの deployed revision かは artifact だけでは確定できない。
- リスク: answer-only dataset のため、refusal 緩和後の unanswerable safety は引き続き mixed dataset で確認が必要。
