# ローカルベンチマーク改善ループ方針検討レポート

## 受けた指示

- ベンチマーク実行、性能改善をもっと早く進めるため、ローカルで実行できるようにする方針を検討する。
- Codex に性能テスト実行、結果確認、修正、再実施のループを継続的にやらせたい場合の進め方を検討する。
- `/plan` 指示のため、実装には着手しない。

## 要件整理

| 要件ID | 要件 | 対応 |
| --- | --- | --- |
| R1 | 既存のローカル benchmark 導線を確認する | 対応 |
| R2 | Codex に回させる改善ループの方針を提示する | 対応 |
| R3 | 実装には着手しない | 対応 |
| R4 | 未確認・制約を明示する | 対応 |

## 検討・判断の要約

- 既存の `task benchmark:sample`、`task benchmark:search:sample`、`npm run start -w @memorag-mvp/benchmark` 系の導線を前提に、ローカル API と `.local-data` を使う反復を最短経路と判断した。
- 無限ループは文字通りの無制限実行ではなく、停止条件、予算、悪化判定、差分記録を持つ long-running loop として設計するのが安全と判断した。
- 改善可否は Codex の文章判断ではなく、`summary.json` と baseline summary の機械比較を主判定にする方針が妥当と判断した。

## 実施した作業

- 関連 skill と Taskfile の benchmark target を確認した。
- `memorag-bedrock-mvp/benchmark` の runner、summary、metrics、evaluator profile 周辺を確認した。
- 既存の `LOCAL_VERIFICATION.md`、`OPERATIONS.md`、過去の benchmark performance report を確認した。
- 実装変更、テスト実行、ベンチマーク実行は行っていない。

## 成果物

| 成果物 | 内容 |
| --- | --- |
| 最終回答 | ローカル benchmark 改善ループの方針案 |
| `reports/working/20260512-2020-local-benchmark-loop-plan.md` | 本作業レポート |

## Fit 評価

総合fit: 4.6 / 5.0

理由: 実装に入らず、既存導線に基づく方針検討に絞った。実際の benchmark 実行や改善実装は指示により未実施のため、運用時の所要時間や失敗パターンは未測定。

## 未対応・制約・リスク

- benchmark は実行していないため、現時点の実測 latency / accuracy / recall は未確認。
- Codex の完全な無限自律実行は、コスト、外部 API、認証、破壊的操作、PR 更新の観点で停止条件なしには推奨しない。
- 実装候補は方針レベルに留め、スクリプトや Taskfile の追加は行っていない。
